'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { AlertTriangle, RefreshCw } from 'lucide-react'

/**
 * Route-level error boundary.
 *
 * Shows a friendly message and a retry, and never renders `error.message` or a
 * stack trace in production — those leak schema and file paths. The digest is
 * shown instead so a support request can be correlated with the server log.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Server-side logging happens in the action layer; this catches render errors.
    console.error('[stageflow] render error', { digest: error.digest })
  }, [error])

  const isDev = process.env.NODE_ENV !== 'production'

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-canvas px-5 py-16">
      <div className="w-full max-w-md text-center">
        <span
          aria-hidden="true"
          className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-danger-bg text-danger"
        >
          <AlertTriangle className="h-8 w-8" />
        </span>

        <p className="mt-6 text-xs font-semibold uppercase tracking-[0.14em] text-danger">
          Erreur inattendue
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-navy sm:text-3xl">
          Une erreur est survenue
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-muted">
          L’opération n’a pas pu être terminée. Vos données n’ont pas été modifiées. Vous pouvez
          réessayer immédiatement.
        </p>

        {error.digest && (
          <p className="mt-3 font-mono text-xs text-ink-subtle">
            Référence à communiquer au support : {error.digest}
          </p>
        )}

        {isDev && (
          <pre className="mt-5 max-h-48 overflow-auto rounded-control border border-border bg-surface p-3 text-left text-xs text-ink-muted">
            {error.message}
          </pre>
        )}

        <div className="mt-8 flex flex-col justify-center gap-2.5 sm:flex-row">
          <button type="button" onClick={reset} className="sf-btn-primary">
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Réessayer
          </button>
          <Link href="/" className="sf-btn-secondary">
            Retour à l’accueil
          </Link>
        </div>
      </div>
    </div>
  )
}
