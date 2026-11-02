import Link from 'next/link'
import { ShieldAlert, ArrowLeft } from 'lucide-react'
import { Logo } from '@/components/ui/logo'
import { getSessionUser, homeRouteForRole } from '@/lib/auth/session'

export const metadata = {
  title: 'Accès refusé',
  robots: { index: false, follow: false },
}

/**
 * `/acces-refuse` — the 403 view.
 *
 * Deliberately does not reveal what exists behind the requested URL. The return
 * link points to the visitor's own space when signed in, otherwise home.
 */
export default async function AccessDeniedPage() {
  const user = await getSessionUser()
  const backHref = user ? homeRouteForRole(user.role) : '/'

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-canvas px-5 py-16">
      <div className="w-full max-w-md text-center">
        <div className="mb-8 flex justify-center">
          <Logo href={null} size="lg" />
        </div>

        <span
          aria-hidden="true"
          className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-danger-bg text-danger"
        >
          <ShieldAlert className="h-8 w-8" />
        </span>

        <p className="mt-6 text-xs font-semibold uppercase tracking-[0.14em] text-danger">
          Erreur 403
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-navy sm:text-3xl">
          Accès refusé
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-muted">
          Votre compte n’a pas les droits nécessaires pour consulter cette page. Si vous pensez
          qu’il s’agit d’une erreur, contactez l’administration.
        </p>

        <div className="mt-8 flex flex-col justify-center gap-2.5 sm:flex-row">
          <Link href={backHref} className="sf-btn-primary">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            {user ? 'Retour à mon espace' : 'Retour à l’accueil'}
          </Link>
          {user && (
            <form action="/api/auth/signout" method="post">
              <button type="submit" className="sf-btn-secondary w-full">
                Se déconnecter
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
