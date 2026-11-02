// StageFlow — provision local-only test accounts.
//
// This script intentionally refuses hosted Supabase URLs and production mode.
// It creates confirmed users through the local Auth admin API, then assigns the
// requested application role. Passwords are supplied as command-line arguments
// so no credential is committed to the repository.
//
// Usage:
//   node --env-file=.env.local scripts/provision-local-test-accounts.mjs \
//     admin@stageflow.local "<admin-password>" \
//     stagiaire@stageflow.local "<stagiaire-password>"

import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (process.env.NODE_ENV === 'production') {
  throw new Error('Refusing to provision test accounts in production.')
}

if (!url || !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(url)) {
  throw new Error('This script only accepts the local Supabase URL from .env.local.')
}

if (!serviceRoleKey) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY is required in .env.local.')
}

const [adminEmail, adminPassword, traineeEmail, traineePassword] = process.argv.slice(2)
if (!adminEmail || !adminPassword || !traineeEmail || !traineePassword) {
  throw new Error('Provide admin email/password and stagiaire email/password arguments.')
}

const supabase = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function upsertUser(email, password, role) {
  const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (error) throw error

  const existing = data.users.find((user) => user.email?.toLowerCase() === email.toLowerCase())
  let userId = existing?.id

  if (existing) {
    const updated = await supabase.auth.admin.updateUserById(existing.id, {
      email,
      password,
      email_confirm: true,
      user_metadata: { first_name: role === 'admin' ? 'Admin' : 'Demo', last_name: role === 'admin' ? 'StageFlow' : 'Stagiaire' },
    })
    if (updated.error) throw updated.error
    userId = updated.data.user.id
  } else {
    const created = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { first_name: role === 'admin' ? 'Admin' : 'Demo', last_name: role === 'admin' ? 'StageFlow' : 'Stagiaire' },
    })
    if (created.error) throw created.error
    userId = created.data.user.id
  }

  const { error: roleError } = await supabase.from('user_roles').upsert({
    user_id: userId,
    role,
    granted_by: null,
    granted_at: new Date().toISOString(),
  })
  if (roleError) throw roleError

  return userId
}

const adminId = await upsertUser(adminEmail, adminPassword, 'admin')
const traineeId = await upsertUser(traineeEmail, traineePassword, 'stagiaire')

console.log(JSON.stringify({
  localOnly: true,
  admin: { email: adminEmail, role: 'admin', id: adminId },
  stagiaire: { email: traineeEmail, role: 'stagiaire', id: traineeId },
}, null, 2))
