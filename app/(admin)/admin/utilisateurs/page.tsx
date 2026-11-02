import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/ui/page-header'
import { AdminInviteForm } from '@/components/admin/admin-invite-form'
import { getSessionUser } from '@/lib/auth/session'
import { listAdminUsers } from '@/lib/db/admin-users'

export const metadata: Metadata = { title: 'Utilisateurs et administrateurs' }

export default async function AdminUsersPage() {
  const user = await getSessionUser()
  if (!user || user.role !== 'admin') redirect('/connexion')
  const admins = await listAdminUsers()
  return <><PageHeader eyebrow="Espace administration" title="Utilisateurs et administrateurs" description="Invitez des administrateurs et vérifiez l’état de leurs comptes." /><div className="grid gap-6 lg:grid-cols-[1fr_420px]"><section className="rounded-card border border-border bg-surface p-5"><h2 className="text-base font-semibold text-ink">Administrateurs ({admins.length})</h2><ul className="mt-4 divide-y divide-border">{admins.map((admin) => <li key={admin.user_id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-medium text-ink">{admin.email}</p><p className="text-xs text-ink-muted">{admin.confirmed ? 'E-mail confirmé' : 'Invitation en attente'}</p></div><span className="sf-badge border-primary-200 bg-primary-50 text-primary-700">Administrateur</span></li>)}</ul></section><AdminInviteForm /></div></>
}
