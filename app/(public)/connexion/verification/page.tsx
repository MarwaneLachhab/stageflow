import { redirect } from 'next/navigation'
import { ShieldCheck } from 'lucide-react'
import { AuthLayout } from '@/components/public/auth-layout'
import { MfaVerificationForm } from '@/components/security/mfa-verification-form'
import { issueMfaChallenge } from '@/lib/auth/actions'
import {
  getSessionUser,
  getMfaState,
  homeRouteForRole,
  LOGIN_ROUTE,
} from '@/lib/auth/session'
import { safeRedirectPath } from '@/lib/auth/redirect'

export const metadata = {
  title: 'Vérification en deux étapes',
  description:
    'Saisissez le code de votre application d’authentification pour finaliser votre connexion StageFlow.',
}

type SearchParams = Promise<{ next?: string }>

/**
 * `/connexion/verification` — the second-factor step for a session that was
 * interrupted between the password grant and the code.
 *
 * When it is reached: the account owns a verified TOTP factor and the session
 * is still aal1 (password only). The redirect loop is impossible here because
 * the middleware does not bounce authenticated users away from this route, and
 * a guest is sent back to the sign-in page — /connexion itself only redirects
 * *complete* sessions (this page's concern ends where /redirection begins).
 */
export default async function MfaVerificationPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams

  const user = await getSessionUser()
  if (!user) redirect(LOGIN_ROUTE)

  const mfa = await getMfaState()
  const next = safeRedirectPath(params.next, '')

  if (!mfa.enforced) {
    // Already satisfied (aal2), or the factor list moved on since the redirect.
    redirect(next || homeRouteForRole(user.role))
  }

  // A challenge lives on the server; a lost view gets a fresh one here.
  const issued = await issueMfaChallenge()

  return (
    <AuthLayout
      eyebrow="Connexion sécurisée"
      title={
        <>
          Vérification en deux étapes <span aria-hidden="true">🔐</span>
        </>
      }
      subtitle="Une seconde preuve d’identité est nécessaire pour accéder à votre espace."
      asideTitle={
        <>
          Un compte, <span className="text-primary-600">une protection renforcée.</span>
        </>
      }
      asideSubtitle="Avec la double authentification, une fuite de mot de passe ne suffit plus à usurper votre identité."
      asideSlot={
        <div className="rounded-card border border-white/70 bg-surface p-5 shadow-raised">
          <ul className="space-y-3">
            <li className="flex items-start gap-3">
              <span
                aria-hidden="true"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600"
              >
                <ShieldCheck className="h-4 w-4" />
              </span>
              <div>
                <p className="text-[13px] font-semibold text-ink">Second facteur obligatoire</p>
                <p className="text-2xs text-ink-muted">
                  Le code généré par votre appareil est exigé à chaque connexion.
                </p>
              </div>
            </li>
          </ul>
        </div>
      }
    >
      {issued.ok && issued.data ? (
        <MfaVerificationForm
          factorId={issued.data.factorId}
          challengeId={issued.data.challengeId}
          email={user.email ?? undefined}
          next={next || undefined}
        />
      ) : (
        // Transient failure (Auth service briefly unreachable): do NOT redirect
        // a session that still owes its code step — that would ping-pong with
        // the protected layouts. Offer the two real escapes instead.
        <div className="space-y-4 rounded-control border border-border bg-canvas p-4 text-sm text-ink-muted">
          <p>
            Impossible d’initialiser la vérification pour le moment. Rafraîchissez la page
            pour réessayer, ou fermez votre session :
          </p>
          <form action="/api/auth/signout" method="post">
            <button type="submit" className="text-sm font-semibold text-danger hover:underline">
              Se déconnecter
            </button>
          </form>
        </div>
      )}
    </AuthLayout>
  )
}
