#!/usr/bin/env node
/**
 * Phase 3B — real authentication integration tests.
 *
 * Runs against the linked DEVELOPMENT project only. Creates isolated test users
 * through the Auth admin API with `email_confirm: true`, so no confirmation
 * e-mail is sent and the built-in SMTP quota is never touched.
 *
 * Usage (loads .env.local, so no secret is ever typed on a command line):
 *   npm run test:auth:phase3
 *   npm run test:auth:phase3 -- --cleanup     # remove the users this script created
 *
 * Safety:
 *   - Never prints a password, token or key.
 *   - Never touches pre-existing accounts: cleanup only deletes IDs recorded in
 *     .phase3-test-users.json, written by this script.
 *   - Refuses to run when the privileged key is missing or still a placeholder.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const RECORD_FILE = '.phase3-test-users.json'
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SECRET = process.env.SUPABASE_SERVICE_ROLE_KEY

const results = []
function check(name, ok, detail = '') {
  results.push({ name, ok, detail })
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
}

function isPlaceholder(v) {
  if (!v || v.trim() === '') return true
  return /your-service-role-key|your-anon-key|your-project-ref/i.test(v)
}

function secretType(v) {
  if (v.startsWith('sb_secret_')) return 'sb_secret_'
  if (v.startsWith('eyJ')) return 'legacy service_role JWT'
  return 'unrecognised'
}

function loadRecord() {
  if (!existsSync(RECORD_FILE)) return []
  try {
    return JSON.parse(readFileSync(RECORD_FILE, 'utf8'))
  } catch {
    return []
  }
}

function saveRecord(users) {
  writeFileSync(RECORD_FILE, JSON.stringify(users, null, 2))
}

async function main() {
  console.log('StageFlow — Phase 3B authentication tests\n')

  if (!URL_ || isPlaceholder(ANON)) {
    console.error('BLOCKED: NEXT_PUBLIC_SUPABASE_URL / ANON_KEY are not configured.')
    process.exit(1)
  }
  if (!SECRET || isPlaceholder(SECRET)) {
    console.error('BLOCKED: SUPABASE_SERVICE_ROLE_KEY is missing or still the .env.example placeholder.')
    console.error('Add a real key to .env.local, then re-run `npm run test:auth:phase3`.')
    process.exit(1)
  }

  console.log('Privileged key type:', secretType(SECRET), `(length ${SECRET.trim().length})`)
  console.log('')

  const admin = createClient(URL_, SECRET, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // ---------------------------------------------------------------- cleanup ---
  if (process.argv.includes('--cleanup')) {
    const recorded = loadRecord()
    if (recorded.length === 0) {
      console.log('Nothing to clean up.')
      return
    }
    console.log(`Deleting ${recorded.length} test user(s) created by this script…`)
    for (const u of recorded) {
      const { error } = await admin.auth.admin.deleteUser(u.id)
      console.log(`  ${error ? 'FAIL' : 'OK  '}  ${u.email}  ${error ? error.message : ''}`)
    }
    saveRecord([])
    return
  }

  // --------------------------------------------------------- 1. admin access ---
  console.log('1. Trusted server-side access')
  const probe = await admin.auth.admin.listUsers({ page: 1, perPage: 1 })
  check('service key can call the Auth admin API', !probe.error, probe.error?.message ?? '')

  // ------------------------------------------------------ 2. create test users ---
  console.log('\n2. Isolated test identities (email_confirm: true, no e-mail sent)')
  const stamp = Date.now()
  const created = []

  for (const label of ['a', 'b']) {
    const email = `stageflow.qa.${label}.${stamp}@stageflow-qa-test.com`
    const password = `Qa!${stamp}${label.toUpperCase()}9x`
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { first_name: 'Qa', last_name: `Testeur ${label.toUpperCase()}`, phone: '+212612345678' },
    })
    if (error || !data.user) {
      check(`create test user ${label}`, false, error?.message ?? 'no user returned')
      continue
    }
    created.push({ id: data.user.id, email, password })
    check(`create test user ${label}`, true, `confirmed=${Boolean(data.user.email_confirmed_at)}`)
  }

  if (created.length < 2) {
    console.error('\nCould not create both test users — aborting before dependent tests.')
    saveRecord(created.map(({ id, email }) => ({ id, email })))
    process.exit(1)
  }

  saveRecord(created.map(({ id, email }) => ({ id, email })))

  // ------------------------------------------------- 3. trigger provisioning ---
  console.log('\n3. Signup trigger provisioning (admin-provisioned, NOT a public signup)')
  for (const u of created) {
    const { data: profile, error: pErr } = await admin
      .from('profiles').select('id, first_name, last_name').eq('id', u.id).maybeSingle()
    check(`profile row for ${u.email.split('@')[0]}`, Boolean(profile) && !pErr, pErr?.message ?? '')

    const { data: role, error: rErr } = await admin
      .from('user_roles').select('role').eq('user_id', u.id).maybeSingle()
    check(`role is stagiaire for ${u.email.split('@')[0]}`, role?.role === 'stagiaire', rErr?.message ?? `got ${role?.role}`)

    const { count, error: nErr } = await admin
      .from('notifications').select('id', { count: 'exact', head: true }).eq('recipient_id', u.id).eq('type', 'WELCOME')
    check(`welcome notification for ${u.email.split('@')[0]}`, (count ?? 0) === 1, nErr?.message ?? `count=${count}`)
  }

  // ------------------------------------------------------------- 4. login ---
  console.log('\n4. Login')
  const userA = created[0]
  const userB = created[1]

  const anonA = createClient(URL_, ANON, { auth: { persistSession: false, autoRefreshToken: false } })
  const goodLogin = await anonA.auth.signInWithPassword({ email: userA.email, password: userA.password })
  check('correct credentials return a session', Boolean(goodLogin.data.session?.access_token), goodLogin.error?.message ?? '')
  check('session carries a refresh token', Boolean(goodLogin.data.session?.refresh_token))

  const anonBad = createClient(URL_, ANON, { auth: { persistSession: false, autoRefreshToken: false } })
  const badLogin = await anonBad.auth.signInWithPassword({ email: userA.email, password: userA.password + 'x' })
  check('wrong password is rejected', Boolean(badLogin.error))
  check('wrong password is not disclosed as "user unknown"', /invalid login credentials/i.test(badLogin.error?.message ?? ''), badLogin.error?.message ?? '')

  // ------------------------------------------------------- 5. session refresh ---
  console.log('\n5. Session persistence / refresh')
  const refreshed = await anonA.auth.refreshSession({ refresh_token: goodLogin.data.session.refresh_token })
  check('refresh token yields a new access token', Boolean(refreshed.data.session?.access_token), refreshed.error?.message ?? '')
  check('refreshed token differs from the original', refreshed.data.session?.access_token !== goodLogin.data.session.access_token)

  const tokenA = refreshed.data.session.access_token

  // ------------------------------------------------- 6. authenticated access ---
  console.log('\n6. Authenticated access as stagiaire')
  const asA = createClient(URL_, ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${tokenA}` } },
  })

  const ownProfile = await asA.from('profiles').select('id').eq('id', userA.id)
  check('stagiaire can read their own profile', (ownProfile.data?.length ?? 0) === 1, ownProfile.error?.message ?? '')

  const otherProfile = await asA.from('profiles').select('id').eq('id', userB.id)
  check("stagiaire cannot read another trainee's profile", (otherProfile.data?.length ?? 0) === 0, `rows=${otherProfile.data?.length}`)

  const otherApps = await asA.from('internship_applications').select('id').eq('applicant_id', userB.id)
  check("stagiaire cannot read another trainee's applications", (otherApps.data?.length ?? 0) === 0, `rows=${otherApps.data?.length}`)

  const notes = await asA.from('admin_private_notes').select('id').limit(1)
  check('stagiaire cannot read admin private notes', (notes.data?.length ?? 0) === 0, `rows=${notes.data?.length}`)

  const audit = await asA.from('audit_events').select('id').limit(1)
  check('stagiaire cannot read audit events', (audit.data?.length ?? 0) === 0, `rows=${audit.data?.length}`)

  // ------------------------------------------------------ 7. admin surfaces ---
  console.log('\n7. Administrator surfaces as stagiaire')
  const stats = await asA.rpc('get_admin_stats')
  check('get_admin_stats is refused', Boolean(stats.error), stats.error?.message ?? 'unexpected success')

  const search = await asA.rpc('search_admin_applications', {})
  check('search_admin_applications is refused', Boolean(search.error), search.error?.message ?? 'unexpected success')

  const decide = await asA.rpc('decide_application', {
    p_application_id: '00000000-0000-4000-8000-000000000000',
    p_decision: 'ACCEPTED',
    p_public_reason: 'test reason long enough',
    p_expected_status: 'UNDER_REVIEW',
  })
  check('decide_application is refused', Boolean(decide.error), decide.error?.message ?? 'unexpected success')

  // --------------------------------------------------- 8. role self-assignment ---
  console.log('\n8. Role tampering')
  const promote = await asA.from('user_roles').update({ role: 'admin' }).eq('user_id', userA.id).select()
  const stillStagiaire = await admin.from('user_roles').select('role').eq('user_id', userA.id).maybeSingle()
  check('stagiaire cannot promote themselves', stillStagiaire.data?.role === 'stagiaire', `role now ${stillStagiaire.data?.role}${promote.error ? ' (' + promote.error.message + ')' : ''}`)

  const auditForge = await asA.rpc('log_audit', {
    p_action: 'forged', p_entity_type: 'test', p_entity_id: '00000000-0000-4000-8000-000000000000', p_metadata: {},
  })
  check('stagiaire cannot forge audit events', Boolean(auditForge.error), auditForge.error?.message ?? 'unexpected success')

  // ------------------------------------------------------------ 9. logout ---
  console.log('\n9. Logout')
  const signOut = await anonA.auth.signOut()
  check('sign-out succeeds', !signOut.error, signOut.error?.message ?? '')

  const afterLogout = createClient(URL_, ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${tokenA}` } },
  })
  const afterLogoutRead = await afterLogout.from('profiles').select('id').eq('id', userA.id)
  // The access token stays cryptographically valid until it expires; what matters
  // is that the client no longer holds a session and cannot refresh it.
  const sessionAfter = await anonA.auth.getSession()
  check('client no longer holds a session', !sessionAfter.data.session)
  check('old token is still a valid JWT (expected, short-lived)', afterLogoutRead.status === 200, `rows=${afterLogoutRead.data?.length}`)

  // ------------------------------------------------------------- summary ---
  const passed = results.filter((r) => r.ok).length
  const failed = results.length - passed
  console.log(`\n${'='.repeat(60)}`)
  console.log(`RESULT: ${passed} passed, ${failed} failed, 0 skipped`)
  console.log(`Test users recorded in ${RECORD_FILE} (run with --cleanup to remove)`)
  console.log('='.repeat(60))
  if (failed > 0) process.exitCode = 1
}

main().catch((e) => {
  console.error('Unexpected error:', e?.message ?? e)
  process.exitCode = 1
})
