import { redirect } from 'next/navigation'
import { AppShell } from '@/components/app-shell'
import { resolveWorkspaceAccess, LOGIN_ROUTE, MFA_VERIFICATION_ROUTE } from '@/lib/auth/session'
import { getOwnProfile, getUnreadNotificationCount } from '@/lib/db/stagiaire'

/**
 * Protected layout for the stagiaire workspace.
 *
 * The role is resolved from `user_roles` on the server for EVERY request. An
 * administrator hitting /stagiaire/* is redirected to their own area; a guest is
 * sent to the login page. This is the real enforcement — the middleware redirect
 * is only a fast-path UX optimisation, and it is never trusted on its own.
 */
export default async function StagiaireLayout({ children }: { children: React.ReactNode }) {
  const access = await resolveWorkspaceAccess('stagiaire')

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
      role="stagiaire"
      breadcrumb={['Espace stagiaire', 'Tableau de bord']}
      unreadCount={unreadCount}
      user={{
        firstName: profile?.first_name ?? 'Stagiaire',
        lastName: profile?.last_name ?? '',
        email: user.email ?? '',
        roleLabel: 'Stagiaire',
      }}
    >
      {children}
    </AppShell>
  )
}
