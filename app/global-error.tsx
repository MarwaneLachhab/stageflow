'use client'

import { useEffect } from 'react'
import { ServerCrash, RefreshCw } from 'lucide-react'
import { Logo } from '@/components/ui/logo'

/**
 * Global error UI. Rendered when the root layout itself throws.
 *
 * This MUST be a Client Component: Next.js needs an interactive boundary in
 * order to offer `reset()`. For the same reason it cannot export `metadata` —
 * a client module has no metadata export — so the page title is set with
 * `document.title` in an effect instead.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  // `metadata` is unavailable here; this is the documented escape hatch.
  useDocumentTitle('Service indisponible')

  return (
    <html lang="fr">
      <body className="bg-canvas font-sans text-ink antialiased">
        <div className="flex min-h-screen flex-col items-center justify-center px-5 py-16">
          <div className="w-full max-w-md text-center">
            <div className="mb-8 flex justify-center">
              <Logo href={null} size="lg" />
            </div>

            <span
              aria-hidden="true"
              className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-warning-bg text-warning"
            >
              <ServerCrash className="h-8 w-8" />
            </span>

            <p className="mt-6 text-xs font-semibold uppercase tracking-[0.14em] text-warning">
              Erreur 500
            </p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-navy">
              Service momentanément indisponible
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-ink-muted">
              Le service rencontre un problème temporaire. Vos données sont intactes. Merci de
              réessayer dans quelques instants.
            </p>

            {error.digest && (
              <p className="mt-3 font-mono text-xs text-ink-subtle">
                Référence : {error.digest}
              </p>
            )}

            <div className="mt-8 flex justify-center">
              <button type="button" onClick={reset} className="sf-btn-primary">
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                Réessayer
              </button>
            </div>
          </div>
        </div>
      </body>
    </html>
  )
}

function useDocumentTitle(title: string) {
  useEffect(() => {
    document.title = title
  }, [title])
}
