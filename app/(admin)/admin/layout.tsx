import { redirect } from 'next/navigation'
import { AppShell } from '@/components/app-shell'
import { resolveWorkspaceAccess, LOGIN_ROUTE, MFA_VERIFICATION_ROUTE } from '@/lib/auth/session'
import { getOwnProfile, getUnreadNotificationCount } from '@/lib/db/stagiaire'

/**
 * Protected layout for the administration workspace.
 *
 * Role resolution happens on the SERVER for every single request, against the
 * `user_roles` table. This layout — not the middleware — is the enforcement
 * point:
 *   - a guest is redirected to /connexion;
 *   - a stagiaire is bounced to their own workspace instead of seeing a 403
 *     dead end (a UX choice, not a security one — no admin data is ever sent);
 *   - only a verified admin reaches the children.
 *
 * Every admin page ALSO relies on RLS (`is_admin()` inside the SQL functions),
 * so even a hypothetical bug in this layout would not expose another user's
 * application: the database would return zero rows.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const access = await resolveWorkspaceAccess('admin')

  if (access.kind === 'guest') redirect(LOGIN_ROUTE)
  if (access.kind === 'wrong-role') redirect(access.redirectTo)
  // A verified TOTP factor exists but this session has not shown the code yet.
  if (access.kind === 'mfa-required') redirect(MFA_VERIFICATION_ROUTE)

  const user = access.user

  const [profile, unreadCount] = await Promise.all([
    getOwnProfile(user.id),
    getUnreadNotificationCount(user.id),
  ])

  return (
    <AppShell
      role="admin"
      breadcrumb={['Espace administration', 'Tableau de bord']}
      unreadCount={unreadCount}
      user={{
        firstName: profile?.first_name ?? 'Administrateur',
        lastName: profile?.last_name ?? '',
        email: user.email ?? '',
        roleLabel: 'Administrateur',
      }}
    >
      {children}
    </AppShell>
  )
}
