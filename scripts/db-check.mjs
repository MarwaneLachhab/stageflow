/** Quick local DB read: application statuses + recent audit rows. */
import { Client } from 'pg'

const client = new Client('postgresql://postgres:postgres@127.0.0.1:54322/postgres')
await client.connect()

const apps = await client.query(`
  select u.email, a.status, a.updated_at
  from public.internship_applications a
  join auth.users u on u.id = a.applicant_id
  order by a.status, a.updated_at desc
`)
console.log('applications:')
for (const row of apps.rows) console.log(`  ${row.email}  →  ${row.status}`)

const audit = await client.query(`
  select action, entity_type, count(*)::int as n
  from public.audit_events
  group by action, entity_type
  order by n desc
  limit 12
`)
console.log('audit summary:')
for (const row of audit.rows) console.log(`  ${row.action} (${row.entity_type}) × ${row.n}`)

await client.end()
