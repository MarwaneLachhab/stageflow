/**
 * Row Level Security — REAL integration tests.
 *
 * History: this file used to be a skeleton. Every test was `expect(true)` and the
 * `beforeAll` threw as soon as credentials existed, so the suite either skipped or
 * failed — it never asserted anything. It now creates real fixtures and makes real
 * requests. Nothing here is mocked.
 *
 * Run with `npm run test:rls:env` (loads .env.local via Node's --env-file).
 *
 * Two clients are used deliberately:
 *   - `service` (secret key) ONLY to provision fixtures — it bypasses RLS.
 *   - user-scoped clients (anon key + a real session) for every assertion, because
 *     the service role would make every test vacuously pass.
 *
 * Admin-only positive tests are gated behind PHASE3_TEST_ADMIN=1: promoting a test
 * account to administrator needs separate approval, so they report as skipped
 * rather than silently passing.
 */

import { describe, expect, it, beforeAll, afterAll } from 'vitest'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { isPlaceholderValue } from '@/lib/env'

/*
 * Some guarantees can only be asserted once the Phase 3C database fixes are
 * applied (0008: non-retryable conflict errors, 0009: read_at-only updates).
 * The marker file is created at apply time, so this file stays honest in both
 * states instead of silently asserting the weaker behaviour.
 */
const FIXES_APPLIED = existsSync(resolve(__dirname, '../../.auth-fixes-applied'))

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON_KEY = process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const configured =
  Boolean(SUPABASE_URL && ANON_KEY && SERVICE_KEY) &&
  !isPlaceholderValue(SUPABASE_URL) &&
  !isPlaceholderValue(ANON_KEY) &&
  !isPlaceholderValue(SERVICE_KEY)

const BUCKET = 'application-documents'
const itAdmin = process.env.PHASE3_TEST_ADMIN === '1' ? it : it.skip

type Actor = {
  id: string
  email: string
  password: string
  client: SupabaseClient
}

describe.skipIf(!configured)('Row Level Security', () => {
  let service: SupabaseClient
  let alice: Actor
  let bob: Actor
  let aliceAppId: string
  let bobAppId: string
  let bobDocKey: string | null = null
  const createdUserIds: string[] = []

  /*
   * Administrator fixtures. Only created when PHASE3_TEST_ADMIN=1, because the
   * authorization for a temporary test administrator is explicit and scoped.
   * carol/dave exist solely so the admin tests have applications to act on
   * without disturbing alice's and bob's state (the storage tests depend on it).
   */
  const adminEnabled = process.env.PHASE3_TEST_ADMIN === '1'
  let admin: Actor | null = null
  let carolAppId = ''
  let daveAppId = ''
  let adminDeleted = false

  async function makeActor(label: string, stamp: number): Promise<Actor> {
    const email = `stageflow.rls.${label}.${stamp}@stageflow-qa-test.com`
    const password = `Rls!${stamp}${label.toUpperCase()}7z`

    const { data, error } = await service.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { first_name: 'Rls', last_name: label.toUpperCase(), phone: '+212612345678' },
    })
    if (error || !data.user) throw new Error(`fixture user ${label}: ${error?.message}`)
    createdUserIds.push(data.user.id)

    const client = createClient(SUPABASE_URL!, ANON_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const signIn = await client.auth.signInWithPassword({ email, password })
    if (signIn.error) throw new Error(`fixture sign-in ${label}: ${signIn.error.message}`)

    return { id: data.user.id, email, password, client }
  }

  beforeAll(async () => {
    service = createClient(SUPABASE_URL!, SERVICE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const stamp = Date.now()
    alice = await makeActor('a', stamp)
    bob = await makeActor('b', stamp)

    const a = await alice.client.rpc('create_draft_application')
    if (a.error) throw new Error(`alice draft: ${a.error.message}`)
    aliceAppId = a.data as string

    const b = await bob.client.rpc('create_draft_application')
    if (b.error) throw new Error(`bob draft: ${b.error.message}`)
    bobAppId = b.data as string

    if (adminEnabled) {
      // Two extra applicants so the admin tests never mutate alice/bob state.
      const carol = await makeActor('c', stamp)
      const dave = await makeActor('d', stamp)

      const submitted = (applicantId: string, motivation: string) => ({
        applicant_id: applicantId,
        stage_type: 'PFE',
        domain: 'Développement web',
        motivation,
        school: 'ENSET Rabat',
        program: 'Génie informatique',
        study_level: 'Bac+4',
        start_date: '2026-11-02',
        end_date: '2027-02-27',
        status: 'SUBMITTED',
        submitted_at: new Date().toISOString(),
      })

      const ca = await service
        .from('internship_applications')
        .insert(submitted(carol.id, 'Motivation de test suffisamment longue pour satisfaire la validation du workflow.'))
        .select('id')
        .single()
      if (ca.error) throw new Error(`carol application: ${ca.error.message}`)
      carolAppId = ca.data.id

      const da = await service
        .from('internship_applications')
        .insert(submitted(dave.id, 'Seconde motivation de test suffisamment longue pour la validation du workflow.'))
        .select('id')
        .single()
      if (da.error) throw new Error(`dave application: ${da.error.message}`)
      daveAppId = da.data.id

      // Temporary administrator: created as stagiaire, then promoted through the
      // trusted bootstrap function (callable only by an operator role).
      admin = await makeActor('admin', stamp)
      const promoted = await service.rpc('promote_to_admin', { p_email: admin.email })
      if (promoted.error) throw new Error(`promote_to_admin: ${promoted.error.message}`)

      const role = await service.from('user_roles').select('role').eq('user_id', admin.id).single()
      if (role.data?.role !== 'admin') throw new Error('admin promotion did not take effect')
    }
  }, 90_000)

  afterAll(async () => {
    // Only the accounts this suite created are removed. Deleting a user cascades
    // to their profile, role, applications and documents.
    for (const id of createdUserIds) {
      if (adminDeleted && admin && id === admin.id) continue
      await service.auth.admin.deleteUser(id).catch(() => {})
    }
  }, 90_000)

  /* ------------------------------------------------------------------ */
  /* Cross-user isolation                                                */
  /* ------------------------------------------------------------------ */

  it('a stagiaire cannot read another stagiaire’s application', async () => {
    const { data, error } = await alice.client
      .from('internship_applications')
      .select('id')
      .eq('id', bobAppId)
    expect(error).toBeNull()
    expect(data).toHaveLength(0)

    // Control: the same query for their own row must return it, proving the
    // emptiness above is RLS and not a broken filter.
    const own = await alice.client.from('internship_applications').select('id').eq('id', aliceAppId)
    expect(own.data).toHaveLength(1)
  })

  it('a stagiaire cannot UPDATE another user’s profile', async () => {
    const { data } = await alice.client
      .from('profiles')
      .update({ first_name: 'Hijacked' })
      .eq('id', bob.id)
      .select('id')
    expect(data).toHaveLength(0)

    const check = await service.from('profiles').select('first_name').eq('id', bob.id).single()
    expect(check.data?.first_name).not.toBe('Hijacked')
  })

  it('a stagiaire cannot grant themselves the admin role', async () => {
    const { data, error } = await alice.client
      .from('user_roles')
      .update({ role: 'admin' })
      .eq('user_id', alice.id)
      .select('role')
    expect(data ?? []).toHaveLength(0)

    const check = await service.from('user_roles').select('role').eq('user_id', alice.id).single()
    expect(check.data?.role).toBe('stagiaire')
    void error
  })

  it('a stagiaire cannot call promote_to_admin()', async () => {
    const { error } = await alice.client.rpc('promote_to_admin', { p_email: alice.email })
    expect(error).not.toBeNull()
    expect(error!.message.toLowerCase()).toMatch(/permission denied|not found/)
  })

  /* ------------------------------------------------------------------ */
  /* Column-level write protection                                       */
  /* ------------------------------------------------------------------ */

  it('a stagiaire cannot set their own status to ACCEPTED', async () => {
    // Row policy allows updating their own DRAFT row; the COLUMN grant is what
    // omits `status`. If this ever passes, a candidate can accept themselves.
    const { error } = await alice.client
      .from('internship_applications')
      .update({ status: 'ACCEPTED' })
      .eq('id', aliceAppId)
      .select('id')
    expect(error).not.toBeNull()

    const check = await service.from('internship_applications').select('status').eq('id', aliceAppId).single()
    expect(check.data?.status).toBe('DRAFT')
  })

  it('a stagiaire cannot set decided_at or public_rejection_reason', async () => {
    const { error } = await alice.client
      .from('internship_applications')
      .update({ decided_at: new Date().toISOString(), public_rejection_reason: 'self-approved' })
      .eq('id', aliceAppId)
      .select('id')
    expect(error).not.toBeNull()

    const check = await service
      .from('internship_applications')
      .select('decided_at, public_rejection_reason')
      .eq('id', aliceAppId)
      .single()
    expect(check.data?.decided_at).toBeNull()
    expect(check.data?.public_rejection_reason).toBeNull()
  })

  it('a stagiaire cannot UPDATE a non-draft application at all', async () => {
    /*
     * Fixture: move Alice's draft out of DRAFT via the service role.
     * `submitted_at` must be supplied too — a CHECK constraint
     * (`applications_submitted_consistency`) rejects SUBMITTED without it, and an
     * unchecked failure here would silently leave the row in DRAFT and make this
     * test assert the wrong thing.
     */
    const fx = await service
      .from('internship_applications')
      .update({ status: 'SUBMITTED', submitted_at: new Date().toISOString() })
      .eq('id', aliceAppId)
      .select('id, status')
    expect(fx.error).toBeNull()
    expect(fx.data?.[0]?.status).toBe('SUBMITTED')

    const { data } = await alice.client
      .from('internship_applications')
      .update({ motivation: 'edited after submission' })
      .eq('id', aliceAppId)
      .select('id')
    expect(data).toHaveLength(0)

    const check = await service.from('internship_applications').select('motivation').eq('id', aliceAppId).single()
    expect(check.data?.motivation).not.toBe('edited after submission')
  }, 15_000)

  /* ------------------------------------------------------------------ */
  /* Workflow integrity                                                  */
  /* ------------------------------------------------------------------ */

  it('a stagiaire cannot submit an application missing required documents', async () => {
    const { error } = await bob.client.rpc('submit_application', { p_application_id: bobAppId })
    expect(error).not.toBeNull()
    // The RPC validates dates before documents; either refusal is correct — what
    // matters is that submission is refused and the row stays DRAFT.
    expect(error!.message).toMatch(/VALIDATION|DOCUMENT|document/i)

    const check = await service.from('internship_applications').select('status').eq('id', bobAppId).single()
    expect(check.data?.status).toBe('DRAFT')
  }, 15_000)

  it('a stagiaire cannot move a request straight from DRAFT to UNDER_REVIEW', async () => {
    const { error } = await bob.client
      .from('internship_applications')
      .update({ status: 'UNDER_REVIEW' })
      .eq('id', bobAppId)
      .select('id')
    expect(error).not.toBeNull()

    const check = await service.from('internship_applications').select('status').eq('id', bobAppId).single()
    expect(check.data?.status).toBe('DRAFT')
  }, 15_000)

  /*
   * Blocked until 0008 is applied: `submit_application` raises its conflict with
   * SQLSTATE 40001 (serialization_failure), which PostgREST retries forever, so
   * the call never returns. Once the errcode fix lands this runs normally.
   */
  const itAfterErcodeFix = FIXES_APPLIED ? it : it.skip

  itAfterErcodeFix('a stagiaire cannot submit the same application twice', async () => {
    const { error } = await alice.client.rpc('submit_application', { p_application_id: aliceAppId })
    expect(error).not.toBeNull()
    expect(error!.message).toMatch(/CONFLICT/i)
  }, 20_000)

  it('only one active application per applicant is possible', async () => {
    const { error } = await bob.client.rpc('create_draft_application')
    expect(error).not.toBeNull()
    expect(error!.message).toMatch(/CONFLICT|unique|already|ACTIVE_APPLICATION_EXISTS/i)
  }, 15_000)

  it('a stagiaire cannot call decide_application()', async () => {
    const { error } = await alice.client.rpc('decide_application', {
      p_application_id: bobAppId,
      p_decision: 'ACCEPTED',
      p_public_reason: 'a reason that is long enough',
      p_expected_status: 'UNDER_REVIEW',
    })
    expect(error).not.toBeNull()
    expect(error!.message).toMatch(/FORBIDDEN|permission/i)
  })

  /* ------------------------------------------------------------------ */
  /* Administrator-only behaviour (needs an approved test admin)         */
  /* ------------------------------------------------------------------ */

  itAdmin('an admin can accept a submitted application', async () => {
    // The admin must be able to SEE the application first (RLS: is_admin()).
    const visible = await admin!.client.from('internship_applications').select('id').eq('id', carolAppId)
    expect(visible.data).toHaveLength(1)

    const { data, error } = await admin!.client.rpc('decide_application', {
      p_application_id: carolAppId,
      p_decision: 'ACCEPTED',
      p_public_reason: 'Dossier conforme, candidature acceptée.',
      p_expected_status: 'SUBMITTED',
    })
    expect(error).toBeNull()
    expect(data).toBe('ACCEPTED')

    const row = await service
      .from('internship_applications')
      .select('status, decided_at, decided_by')
      .eq('id', carolAppId)
      .single()
    expect(row.data?.status).toBe('ACCEPTED')
    expect(row.data?.decided_at).not.toBeNull()
    expect(row.data?.decided_by).toBe(admin!.id)
  }, 30_000)

  itAdmin('a rejection without a reason is refused by the database', async () => {
    const { error } = await admin!.client.rpc('decide_application', {
      p_application_id: daveAppId,
      p_decision: 'REJECTED',
      p_public_reason: '   ',
      p_expected_status: 'SUBMITTED',
    })
    expect(error).not.toBeNull()

    const row = await service.from('internship_applications').select('status').eq('id', daveAppId).single()
    expect(row.data?.status).toBe('SUBMITTED')
  }, 30_000)

  itAdmin('a decided application cannot be decided again', async () => {
    // Valid rejection first (precondition for this test).
    const first = await admin!.client.rpc('decide_application', {
      p_application_id: daveAppId,
      p_decision: 'REJECTED',
      p_public_reason: 'Profil ne correspondant pas au poste demandé.',
      p_expected_status: 'SUBMITTED',
    })
    expect(first.error).toBeNull()
    expect(first.data).toBe('REJECTED')

    const second = await admin!.client.rpc('decide_application', {
      p_application_id: daveAppId,
      p_decision: 'ACCEPTED',
      p_public_reason: 'Tentative de décision sur un dossier déjà décidé.',
      p_expected_status: 'REJECTED',
    })
    expect(second.error).not.toBeNull()
    expect(second.error!.message).toMatch(/CONFLICT/i)
  }, 30_000)

  itAdmin('a stale decision is rejected (optimistic concurrency)', async () => {
    // dave is REJECTED; claiming it is still SUBMITTED must be refused.
    const { error } = await admin!.client.rpc('decide_application', {
      p_application_id: daveAppId,
      p_decision: 'ACCEPTED',
      p_public_reason: 'Décision fondée sur un état périmé du dossier.',
      p_expected_status: 'SUBMITTED',
    })
    expect(error).not.toBeNull()
    expect(error!.message).toMatch(/CONFLICT/i)

    const row = await service.from('internship_applications').select('status').eq('id', daveAppId).single()
    expect(row.data?.status).toBe('REJECTED')
  }, 30_000)

  itAdmin('an admin can use the administrator RPCs and read document rows', async () => {
    const stats = await admin!.client.rpc('get_admin_stats')
    expect(stats.error).toBeNull()
    expect(stats.data).toBeTruthy()

    const search = await admin!.client.rpc('search_admin_applications', {})
    expect(search.error).toBeNull()

    // documents_select_admin policy: reading the table must not be refused.
    const docs = await admin!.client.from('application_documents').select('id')
    expect(docs.error).toBeNull()
  }, 30_000)

  /* ------------------------------------------------------------------ */
  /* Private notes and audit trail                                       */
  /* ------------------------------------------------------------------ */

  it('a stagiaire reads ZERO rows from admin_private_notes', async () => {
    const { data, error } = await alice.client.from('admin_private_notes').select('id')
    expect(error).toBeNull()
    expect(data).toHaveLength(0)
  })

  itAdmin('an admin can read private notes on an application', async () => {
    const note = await service
      .from('admin_private_notes')
      .insert({ application_id: carolAppId, author_id: admin!.id, body: 'Note interne de test.' })
      .select('id')
      .single()
    expect(note.error).toBeNull()

    const read = await admin!.client.from('admin_private_notes').select('id').eq('id', note.data!.id)
    expect(read.data).toHaveLength(1)
  }, 30_000)

  it('a stagiaire cannot read audit_events', async () => {
    const { data, error } = await alice.client.from('audit_events').select('id')
    expect(error).toBeNull()
    expect(data).toHaveLength(0)
  })

  itAdmin('an admin cannot UPDATE or DELETE audit_events', async () => {
    // audit_events grants SELECT only; there is no write policy even for admins.
    const target = await service.from('audit_events').select('id').limit(1).maybeSingle()
    expect(target.data).not.toBeNull()

    const upd = await admin!.client
      .from('audit_events')
      .update({ action: 'tampered' })
      .eq('id', target.data!.id)
      .select('id')
    expect(upd.data ?? []).toHaveLength(0)

    const del = await admin!.client
      .from('audit_events')
      .delete()
      .eq('id', target.data!.id)
      .select('id')
    expect(del.data ?? []).toHaveLength(0)

    const still = await service.from('audit_events').select('action').eq('id', target.data!.id).single()
    expect(still.data?.action).not.toBe('tampered')
  }, 30_000)

  /* ------------------------------------------------------------------ */
  /* Storage                                                             */
  /* ------------------------------------------------------------------ */

  it('the storage bucket is private', async () => {
    const res = await fetch(
      `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/probe.txt`,
      { headers: { apikey: ANON_KEY! } },
    )
    expect(res.ok).toBe(false)
  })

  it('a stagiaire cannot upload into another user’s folder', async () => {
    const { error } = await bob.client.storage
      .from(BUCKET)
      .upload(`${alice.id}/${aliceAppId}/cv-injected.pdf`, new Uint8Array([1, 2, 3]), {
        contentType: 'application/pdf',
      })
    expect(error).not.toBeNull()
  })

  it('a stagiaire cannot upload to an application that is no longer a draft', async () => {
    // Alice's application is SUBMITTED at this point.
    const { error } = await alice.client.storage
      .from(BUCKET)
      .upload(`${alice.id}/${aliceAppId}/cv-late.pdf`, new Uint8Array([1, 2, 3]), {
        contentType: 'application/pdf',
      })
    expect(error).not.toBeNull()
  })

  it('a stagiaire cannot read another user’s stored document', async () => {
    // Bob uploads a legitimate document into his own draft folder.
    const key = `${bob.id}/${bobAppId}/cv-bob.pdf`
    const up = await bob.client.storage
      .from(BUCKET)
      .upload(key, new Uint8Array([1, 2, 3]), { contentType: 'application/pdf' })
    if (!up.error) bobDocKey = key

    if (!bobDocKey) {
      // If the upload policy refused even the owner, that is itself a finding —
      // fail loudly rather than pass silently.
      throw new Error(`owner upload failed: ${up.error?.message}`)
    }

    const { error } = await alice.client.storage.from(BUCKET).download(bobDocKey)
    expect(error).not.toBeNull()
  })

  /* ------------------------------------------------------------------ */
  /* Notifications                                                       */
  /* ------------------------------------------------------------------ */

  it('a stagiaire can only mark their own notifications as read', async () => {
    const own = await alice.client
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('recipient_id', alice.id)
      .select('id')
    expect((own.data ?? []).length).toBeGreaterThan(0)

    const other = await alice.client
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('recipient_id', bob.id)
      .select('id')
    expect(other.data ?? []).toHaveLength(0)
  })

  it('a stagiaire cannot rewrite the body of a notification', async () => {
    /*
     * Before 0009: `authenticated` holds a TABLE-LEVEL UPDATE grant, so a user
     * CAN rewrite the body of their own notification. This test then records the
     * weakness rather than a protection, so it cannot be forgotten.
     *
     * After 0009: the grant is reduced to `read_at`, so the write must be refused.
     */
    const { data: before } = await alice.client
      .from('notifications')
      .select('id, body')
      .eq('recipient_id', alice.id)
      .limit(1)
      .maybeSingle()

    if (!before) return

    const { data: updated, error } = await alice.client
      .from('notifications')
      .update({ body: 'REWRITTEN BY THE OWNER' })
      .eq('id', before.id)
      .select('id, body')

    const rewritten = (updated ?? []).some((n) => n.body === 'REWRITTEN BY THE OWNER')

    if (FIXES_APPLIED) {
      expect(error).not.toBeNull()
      expect(rewritten).toBe(false)
    } else {
      expect(error === null && rewritten).toBe(true) // documents the weakness
    }
  }, 20_000)

  /* ------------------------------------------------------------------ */
  /* Temporary administrator cleanup                                     */
  /* ------------------------------------------------------------------ */

  itAdmin('deleting the temporary administrator removes its profile and role', async () => {
    const del = await service.auth.admin.deleteUser(admin!.id)
    expect(del.error).toBeNull()
    adminDeleted = true

    const profile = await service.from('profiles').select('id').eq('id', admin!.id)
    expect(profile.data ?? []).toHaveLength(0)

    const role = await service.from('user_roles').select('user_id').eq('user_id', admin!.id)
    expect(role.data ?? []).toHaveLength(0)
  }, 30_000)
})

describe('RLS configuration', () => {
  it('reports why the suite is skipped when unconfigured', () => {
    if (!configured) {
      console.warn(
        '\n⚠️  La suite RLS a été IGNORÉE : aucune base de données configurée.\n' +
          '   Renseignez .env.local puis lancez `npm run test:rls:env`.\n',
      )
    }
    expect(true).toBe(true)
  })
})
