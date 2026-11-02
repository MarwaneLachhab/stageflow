import { createAdminClient } from '@/lib/supabase/server'

export async function listAdminUsers() {
  const admin = createAdminClient()
  if (!admin) return []
  const { data, error } = await admin.from('user_roles').select('user_id, role, granted_at')
  if (error) return []
  const { data: authUsers } = await admin.auth.admin.listUsers({ perPage: 1000 })
  const byId = new Map((authUsers?.users ?? []).map((user) => [user.id, user]))
  return (data ?? []).filter((row) => row.role === 'admin').map((row) => ({
    ...row,
    email: byId.get(row.user_id)?.email ?? '—',
    confirmed: Boolean(byId.get(row.user_id)?.email_confirmed_at),
  }))
}
