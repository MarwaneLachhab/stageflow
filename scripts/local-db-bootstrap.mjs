// =============================================================================
// StageFlow — local database bootstrap (DEV ONLY)
// =============================================================================
// Runs against the LOCAL Supabase stack started by `supabase start`.
// Never point it at a hosted project: it enables the demo fixture flag and
// writes to auth.users directly, which must never happen on remote data.
//
// What it does, in order:
//   1. enables the guarded demo seed (stageflow.seed_demo database setting);
//   2. executes supabase/migrations/9999_dev_seed.sql (7 fictional applicants);
//   3. optionally promotes one e-mail to administrator via the audited
//      0005 equivalent writes (user_roles + audit_events), so no unguarded
//      privileged function needs to be invoked;
//   4. prints row counts and account roles as evidence.
//
// Usage:
//   node --env-file=.env.local scripts/local-db-bootstrap.mjs [adminEmail]
// Connection: postgresql://postgres:postgres@127.0.0.1:54322/postgres
// =============================================================================

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import pg from 'pg'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SEED_PATH = path.join(ROOT, 'supabase', 'migrations', '9999_dev_seed.sql')
const URL = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

const adminEmail = process.argv[2]

const client = new pg.Client({ connectionString: URL })
await client.connect()

try {
  // ALTER DATABASE is refused locally: the staged `postgres` role is not a
  // superuser. A session-level SET of the guarded custom GUC is allowed and is
  // exactly what migration 9999 reads while the file executes on this same
  // connection.
  await client.query(`set stageflow.seed_demo = 'on'`)
  console.log('seed flag: stageflow.seed_demo = on (session)')

  // Idempotency guard: the seed is designed for a one-shot run on a fresh
  // database (auth.users has a unique partial key on e-mail). Re-running it on
  // a seeded database is not needed and must not crash the promotion step.
  const appCount = await client.query(`select count(*)::int as n from public.internship_applications`)
  if (appCount.rows[0].n > 0) {
    console.log(`seed skipped: ${appCount.rows[0].n} applications already present`)
  } else {
    await client.query(readFileSync(SEED_PATH, 'utf8'))
    console.log('seed file executed:', path.basename(SEED_PATH))
  }

  if (adminEmail) {
    const trimmed = adminEmail.trim().toLowerCase()
    const { rows } = await client.query(
      `select id from auth.users where lower(email) = $1 limit 1`,
      [trimmed],
    )
    if (rows.length === 0) {
      throw new Error(`no user found with e-mail ${trimmed} — create it via /inscription first`)
    }
    const uid = rows[0].id
    // The trigger in 0005 blocks 'anon'/'authenticated' sessions only; the
    // direct postgres connection is the documented operator path.
    await client.query(
      `insert into public.user_roles (user_id, role, granted_by, granted_at)
       values ($1, 'admin', null, timezone('utc', now()))
       on conflict (user_id) do update
         set role = 'admin', granted_at = timezone('utc', now())`,
      [uid],
    )
    await client.query(
      `insert into public.audit_events (actor_id, actor_role, action, entity_type, entity_id, metadata)
       values (null, 'admin', 'admin.promoted', 'user_role', $1::uuid, jsonb_build_object('email', $2::text, 'source', 'local-db-bootstrap'))`,
      [uid, trimmed],
    )
    console.log(`admin promoted: ${trimmed} (${uid})`)
  }

  const counts = await client.query(`
    select
      (select count(*) from auth.users)                              as users,
      (select count(*) from public.profiles)                         as profiles,
      (select count(*) from public.internship_applications)          as applications,
      (select count(*) from public.application_status_history)       as history,
      (select count(*) from public.user_roles where role = 'admin')  as admins,
      (select count(*) from public.audit_events)                     as audit
  `)
  console.log('counts:', counts.rows[0])

  const roles = await client.query(`
    select u.email, r.role
    from public.user_roles r join auth.users u on u.id = r.user_id
    order by r.role, u.email
  `)
  for (const row of roles.rows) console.log('role:', row.role.padEnd(9), row.email)
} finally {
  await client.end()
}
