/**
 * Regression tests for the two Phase 3C database fixes.
 *
 * These tests assert the POST-FIX behaviour, so they must not run against a
 * database where the patches have not been applied — they would fail for the
 * right reason and look like regressions.
 *
 * Gate: STAGEFLOW_AUTH_FIXES_APPLIED=1
 *
 *   npm run test:auth-fixes
 *     → node --env-file=.env.local … with the flag already set by the script
 *
 * Covers:
 *   0008 — conflict branches must return promptly instead of hanging (SQLSTATE
 *          40001 is retried forever by PostgREST).
 *   0009 — a user may write only `read_at` on their own notifications.
 */

import { describe, expect, it, beforeAll, afterAll } from 'vitest'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { isPlaceholderValue } from '@/lib/env'

const URL_ = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON = process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SECRET = process.env.SUPABASE_SERVICE_ROLE_KEY

/*
 * Gate. Inline `VAR=1` does not work in npm scripts on Windows (cmd.exe), so the
 * signal is a marker file created at the moment the patches are applied. It also
 * doubles as a record of which state the database is in.
 */
const APPLIED =
  process.env.STAGEFLOW_AUTH_FIXES_APPLIED === '1' ||
  existsSync(resolve(__dirname, '../../.auth-fixes-applied'))

const configured =
  Boolean(URL_ && ANON && SECRET) &&
  !isPlaceholderValue(URL_) &&
  !isPlaceholderValue(ANON) &&
  !isPlaceholderValue(SECRET)

/** The whole point of 0008: a refusal must arrive, not hang. */
const RESPONSE_BUDGET_MS = 5_000

type Actor = { id: string; email: string; client: SupabaseClient }

describe.skipIf(!configured || !APPLIED)('auth fixes (0008 + 0009)', () => {
  let service: SupabaseClient
  let alice: Actor
  let bob: Actor
  let aliceAppId: string
  /** Captured before any test mutates anything, so later writes cannot skew them. */
  let aliceNotificationId: string
  let bobNotificationId: string
  const created: string[] = []

  async function makeActor(label: string, stamp: number): Promise<Actor> {
    const email = `stageflow.fix.${label}.${stamp}@stageflow-qa-test.com`
    const password = `Fix!${stamp}${label.toUpperCase()}5q`
    const { data, error } = await service.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { first_name: 'Fix', last_name: label.toUpperCase(), phone: '+212612345678' },
    })
    if (error || !data.user) throw new Error(`fixture ${label}: ${error?.message}`)
    created.push(data.user.id)

    const client = createClient(URL_!, ANON!, { auth: { persistSession: false, autoRefreshToken: false } })
    const s = await client.auth.signInWithPassword({ email, password })
    if (s.error) throw new Error(`sign-in ${label}: ${s.error.message}`)
    return { id: data.user.id, email, client }
  }

  beforeAll(async () => {
    service = createClient(URL_!, SECRET!, { auth: { persistSession: false, autoRefreshToken: false } })
    const stamp = Date.now()
    alice = await makeActor('a', stamp)
    bob = await makeActor('b', stamp)

    const d = await alice.client.rpc('create_draft_application')
    if (d.error) throw new Error(`draft: ${d.error.message}`)
    aliceAppId = d.data as string

    // Move out of DRAFT. `submitted_at` is required by the
    // applications_submitted_consistency CHECK constraint.
    const fx = await service
      .from('internship_applications')
      .update({ status: 'SUBMITTED', submitted_at: new Date().toISOString() })
      .eq('id', aliceAppId)
      .select('id, status')
    if (fx.error) throw new Error(`fixture submitted: ${fx.error.message}`)

    // Capture the trigger-created notifications BEFORE any test rewrites them.
    const an = await service.from('notifications').select('id').eq('recipient_id', alice.id).eq('type', 'WELCOME').maybeSingle()
    const bn = await service.from('notifications').select('id').eq('recipient_id', bob.id).eq('type', 'WELCOME').maybeSingle()
    if (!an.data || !bn.data) throw new Error('fixture: signup trigger did not create a WELCOME notification')
    aliceNotificationId = an.data.id
    bobNotificationId = bn.data.id
  }, 60_000)

  afterAll(async () => {
    for (const id of created) await service.auth.admin.deleteUser(id).catch(() => {})
  }, 60_000)

  /* ---------------------------------------------------------------- 0008 --- */

  it('submit_application on a non-draft application returns promptly', async () => {
    const started = Date.now()
    const { error } = await alice.client.rpc('submit_application', { p_application_id: aliceAppId })
    const elapsed = Date.now() - started

    expect(error).not.toBeNull()
    expect(error!.message).toMatch(/CONFLICT/i)
    // The regression: before the fix this never returned at all.
    expect(elapsed).toBeLessThan(RESPONSE_BUDGET_MS)
  }, 20_000)

  it('register_document on a non-draft application returns promptly', async () => {
    const started = Date.now()
    const { error } = await alice.client.rpc('register_document', {
      p_application_id: aliceAppId,
      p_document_type: 'CV',
      p_storage_key: `${alice.id}/${aliceAppId}/cv-late.pdf`,
      p_original_name: 'cv.pdf',
      p_mime_type: 'application/pdf',
      p_bytes: 10,
    })
    const elapsed = Date.now() - started

    expect(error).not.toBeNull()
    expect(error!.message).toMatch(/CONFLICT/i)
    expect(elapsed).toBeLessThan(RESPONSE_BUDGET_MS)
  }, 20_000)

  it('the conflict carries the non-retryable application code', async () => {
    const { error } = await alice.client.rpc('submit_application', { p_application_id: aliceAppId })
    // PostgrestError exposes the SQLSTATE as `code` (no HTTP status field).
    // P0001 is what makes the request terminate; 40001 is what made it retry.
    expect(error!.code).toBe('P0001')
    expect(error!.message).toMatch(/^CONFLICT/i)
  }, 20_000)

  /* ---------------------------------------------------------------- 0009 --- */

  it('a user cannot rewrite the body of their own notification', async () => {
    const { error } = await alice.client
      .from('notifications')
      .update({ body: 'REWRITTEN' })
      .eq('id', aliceNotificationId)
      .select('id')
    expect(error).not.toBeNull()

    const check = await service.from('notifications').select('body').eq('id', aliceNotificationId).single()
    expect(check.data?.body).not.toBe('REWRITTEN')
  }, 20_000)

  /*
   * Values are deliberately VALID for the row (a real user id, a real application
   * id) so the only possible reason for refusal is the missing column privilege —
   * not a foreign-key violation masquerading as a pass.
   */
  it.each([
    ['title', () => ({ title: 'Hijacked title' })],
    ['type', () => ({ type: 'APPLICATION_ACCEPTED' })],
    ['recipient_id', () => ({ recipient_id: bob.id })],
    ['application_id', () => ({ application_id: aliceAppId })],
  ])('a user cannot rewrite %s', async (_label, makePatch) => {
    const { error } = await alice.client
      .from('notifications')
      .update(makePatch())
      .eq('id', aliceNotificationId)
      .select('id')
    expect(error).not.toBeNull()
  }, 20_000)

  it('a user CAN still mark their own notification as read', async () => {
    const { data, error } = await alice.client
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', aliceNotificationId)
      .select('id, read_at')
    expect(error).toBeNull()
    expect(data).toHaveLength(1)
    expect(data?.[0]?.read_at).not.toBeNull()
  }, 20_000)

  it('RLS still blocks writing to another user’s notification', async () => {
    const { data } = await alice.client
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', bobNotificationId)
      .select('id')
    expect(data ?? []).toHaveLength(0)
  }, 20_000)

  it('notification creation by the signup trigger still works', async () => {
    // Both rows were created by handle_new_user before any test ran (captured in
    // beforeAll); they must still exist after the grant change.
    const { data, error } = await service
      .from('notifications')
      .select('id')
      .in('id', [aliceNotificationId, bobNotificationId])
    expect(error).toBeNull()
    expect(data).toHaveLength(2)
  }, 20_000)
})
