/**
 * Regression tests for the user_roles delete-trigger fix (0010).
 *
 * Before the fix, `prevent_role_self_assignment()` ended with `return new;`.
 * In a BEFORE DELETE trigger NEW is NULL, so the delete was silently cancelled —
 * deleting a user removed the profile but left the role row behind, and no
 * DELETE on user_roles could ever succeed.
 *
 * Gate: same marker file as the other post-fix suites (.auth-fixes-applied).
 *
 * These tests also assert that the fix did NOT weaken protection: a stagiaire
 * still cannot assign themselves a role, and authorized operator writes still
 * work.
 */

import { describe, expect, it, beforeAll, afterAll } from 'vitest'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { isPlaceholderValue } from '@/lib/env'

const URL_ = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON = process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SECRET = process.env.SUPABASE_SERVICE_ROLE_KEY

const APPLIED =
  process.env.STAGEFLOW_AUTH_FIXES_APPLIED === '1' ||
  existsSync(resolve(__dirname, '../../.auth-fixes-applied'))

const configured =
  Boolean(URL_ && ANON && SECRET) &&
  !isPlaceholderValue(URL_) &&
  !isPlaceholderValue(ANON) &&
  !isPlaceholderValue(SECRET)

describe.skipIf(!configured || !APPLIED)('user_roles delete trigger (0010)', () => {
  let service: SupabaseClient
  let client: SupabaseClient
  let userId: string
  let email: string
  let deleted = false

  beforeAll(async () => {
    service = createClient(URL_!, SECRET!, { auth: { persistSession: false, autoRefreshToken: false } })
    const stamp = Date.now()
    email = `stageflow.cascade.${stamp}@stageflow-qa-test.com`
    const password = `Casc!${stamp}Z4q`

    const { data, error } = await service.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { first_name: 'Casc', last_name: 'Ade', phone: '+212612345678' },
    })
    if (error || !data.user) throw new Error(`fixture: ${error?.message}`)
    userId = data.user.id

    client = createClient(URL_!, ANON!, { auth: { persistSession: false, autoRefreshToken: false } })
    const s = await client.auth.signInWithPassword({ email, password })
    if (s.error) throw new Error(`sign-in: ${s.error.message}`)
  }, 60_000)

  afterAll(async () => {
    if (!deleted && userId) await service.auth.admin.deleteUser(userId).catch(() => {})
  }, 60_000)

  it('provisions profile, stagiaire role and welcome notification', async () => {
    const p = await service.from('profiles').select('id').eq('id', userId).maybeSingle()
    expect(p.data).not.toBeNull()

    const r = await service.from('user_roles').select('role').eq('user_id', userId).maybeSingle()
    expect(r.data?.role).toBe('stagiaire')

    const n = await service.from('notifications').select('id').eq('recipient_id', userId).eq('type', 'WELCOME')
    expect(n.data).toHaveLength(1)
  }, 20_000)

  /* ------------------------------------------------------------------ */
  /* Protection must be unchanged                                        */
  /* ------------------------------------------------------------------ */

  it('a stagiaire still cannot promote themselves', async () => {
    const { data } = await client
      .from('user_roles')
      .update({ role: 'admin' })
      .eq('user_id', userId)
      .select('role')
    expect(data ?? []).toHaveLength(0)

    const check = await service.from('user_roles').select('role').eq('user_id', userId).single()
    expect(check.data?.role).toBe('stagiaire')
  }, 20_000)

  it('a stagiaire cannot delete their role row', async () => {
    const { data, error } = await client
      .from('user_roles')
      .delete()
      .eq('user_id', userId)
      .select('user_id')
    expect(data ?? []).toHaveLength(0)
    void error

    const check = await service.from('user_roles').select('role').eq('user_id', userId).maybeSingle()
    expect(check.data?.role).toBe('stagiaire')
  }, 20_000)

  it('a stagiaire cannot insert a role row', async () => {
    const { error } = await client
      .from('user_roles')
      .insert({ user_id: userId, role: 'admin' })
      .select('user_id')
    expect(error).not.toBeNull()
  }, 20_000)

  /* ------------------------------------------------------------------ */
  /* Authorized operator writes must still work                          */
  /* ------------------------------------------------------------------ */

  it('an authorized operator can still UPDATE a role row', async () => {
    const { data, error } = await service
      .from('user_roles')
      .update({ granted_at: new Date().toISOString() })
      .eq('user_id', userId)
      .select('user_id, role')
    expect(error).toBeNull()
    expect(data).toHaveLength(1)
  }, 20_000)

  it('an authorized operator can DELETE a role row (the actual fix)', async () => {
    const { error } = await service.from('user_roles').delete().eq('user_id', userId)
    expect(error).toBeNull()

    const check = await service.from('user_roles').select('role').eq('user_id', userId).maybeSingle()
    // Before 0010 this row survived every delete attempt.
    expect(check.data).toBeNull()
  }, 20_000)

  it('an authorized operator can re-INSERT the role row', async () => {
    const { data, error } = await service
      .from('user_roles')
      .insert({ user_id: userId, role: 'stagiaire' })
      .select('user_id, role')
    expect(error).toBeNull()
    expect(data).toHaveLength(1)
  }, 20_000)

  /* ------------------------------------------------------------------ */
  /* Cascade on account deletion                                         */
  /* ------------------------------------------------------------------ */

  it('deleting the account removes profile AND role, leaving no orphan', async () => {
    const del = await service.auth.admin.deleteUser(userId)
    expect(del.error).toBeNull()
    deleted = true

    const p = await service.from('profiles').select('id').eq('id', userId)
    expect(p.data ?? []).toHaveLength(0)

    const r = await service.from('user_roles').select('user_id').eq('user_id', userId)
    expect(r.data ?? []).toHaveLength(0)

    const orphan = await service
      .from('user_roles')
      .select('user_id')
      .eq('user_id', userId)
      .maybeSingle()
    expect(orphan.data).toBeNull()
  }, 30_000)
})
