import Link from 'next/link'
import { FileQuestion, Home } from 'lucide-react'
import { Logo } from '@/components/ui/logo'
import { getSessionUser, homeRouteForRole } from '@/lib/auth/session'

export const metadata = {
  title: 'Page introuvable',
  robots: { index: false, follow: false },
}

/** 404 view. No stack traces, no internal identifiers. */
export default async function NotFound() {
  const user = await getSessionUser()

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-canvas px-5 py-16">
      <div className="w-full max-w-md text-center">
        <div className="mb-8 flex justify-center">
          <Logo href={null} size="lg" />
        </div>

        <span
          aria-hidden="true"
          className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-50 text-primary-600"
        >
          <FileQuestion className="h-8 w-8" />
        </span>

        <p className="mt-6 text-xs font-semibold uppercase tracking-[0.14em] text-primary-600">
          Erreur 404
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-navy sm:text-3xl">
          Page introuvable
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-muted">
          La page que vous cherchez n’existe pas ou a été déplacée. Vérifiez l’adresse saisie ou
          revenez à votre espace.
        </p>

        <div className="mt-8 flex flex-col justify-center gap-2.5 sm:flex-row">
          <Link href={user ? homeRouteForRole(user.role) : '/'} className="sf-btn-primary">
            <Home className="h-4 w-4" aria-hidden="true" />
            {user ? 'Retour à mon espace' : 'Retour à l’accueil'}
          </Link>
          {!user && (
            <Link href="/connexion" className="sf-btn-secondary">
              Se connecter
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
