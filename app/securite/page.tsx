import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AppShell } from '@/components/app-shell'
import { issueMfaChallenge } from '@/lib/auth/actions'
import { MfaVerificationForm } from '@/components/security/mfa-verification-form'
import {
  SecurityPanel,
  type SafetyFactorView,
} from '@/components/security/security-panel'
import {
  getSessionUser,
  getMfaState,
  LOGIN_ROUTE,
} from '@/lib/auth/session'
import { getOwnProfile, getUnreadNotificationCount } from '@/lib/db/stagiaire'

export const metadata = {
  title: 'Sécurité',
  description: 'Gérez la double authentification de votre compte StageFlow.',
}

/**
 * `/securite` — MFA management, available to BOTH roles.
 *
 * It deliberately sits outside the stagiaire/admin layouts (those enforce aal2
 * and bouncing here would loop): this page never requires the second factor.
 * Instead, when a verified factor exists but the session is still password-only,
 * the factor list is with-held behind the same re-verification wall used at
 * sign-in. Nothing is enrolled, unenrolled or even listed until the wall passes.
 */
export default async function SecurityPage() {
  const user = await getSessionUser()
  if (!user) redirect(LOGIN_ROUTE)

  const isAdmin = user.role === 'admin'

  const [profile, unreadCount, mfa] = await Promise.all([
    getOwnProfile(user.id),
    getUnreadNotificationCount(user.id),
    getMfaState(),
  ])

  let factors: SafetyFactorView[] = []
  let challenge: { factorId: string; challengeId: string } | null = null

  if (mfa.enforced) {
    const issued = await issueMfaChallenge()
    if (issued.ok) challenge = issued.data
  } else {
    const supabase = await createClient()
    const { data: factorsData } = await supabase.auth.mfa.listFactors()
    factors = (factorsData?.totp ?? []).map((factor) => ({
      id: factor.id,
      status: factor.status,
      friendlyName: factor.friendly_name ?? null,
      createdAt: factor.created_at ?? null,
    }))
  }

  return (
    <AppShell
      role={isAdmin ? 'admin' : 'stagiaire'}
      breadcrumb={isAdmin ? ['Espace administration', 'Sécurité'] : ['Espace stagiaire', 'Sécurité']}
      unreadCount={unreadCount}
      user={{
        firstName: profile?.first_name ?? (isAdmin ? 'Administrateur' : 'Stagiaire'),
        lastName: profile?.last_name ?? '',
        email: user.email ?? '',
        roleLabel: isAdmin ? 'Administrateur' : 'Stagiaire',
      }}
    >
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary-600">
            {isAdmin ? 'Administration' : 'Espace personnel'}
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">Sécurité</h1>
          <p className="text-sm text-ink-muted">
            Protégez l’accès à votre compte avec la double authentification par code d’usage
            unique généré sur votre appareil (TOTP).
          </p>
        </header>

        {mfa.enforced ? (
          <section className="rounded-card border border-border bg-surface p-5 shadow-raised sm:p-6">
            <h2 className="text-base font-semibold text-ink">
              Vérifiez votre second facteur pour continuer
            </h2>
            <p className="mt-1.5 text-sm text-ink-muted">
              La gestion de la double authentification est elle-même protégée : assurez-vous
              d’abord que vous êtes bien le titulaire de ce compte.
            </p>
            <div className="mt-5 max-w-md">
              {challenge ? (
                <MfaVerificationForm
                  factorId={challenge.factorId}
                  challengeId={challenge.challengeId}
                  email={user.email ?? undefined}
                  stayAfterVerify
                />
              ) : (
                <div className="space-y-3 rounded-control border border-border bg-canvas p-4 text-sm text-ink-muted">
                  <p>
                    Impossible d’initialiser la vérification pour le moment. Rafraîchissez la
                    page pour réessayer, ou fermez votre session :
                  </p>
                  <form action="/api/auth/signout" method="post">
                    <button type="submit" className="text-sm font-semibold text-danger hover:underline">
                      Se déconnecter
                    </button>
                  </form>
                </div>
              )}
            </div>
          </section>
        ) : (
          <SecurityPanel factors={factors} />
        )}
      </div>
    </AppShell>
  )
}
