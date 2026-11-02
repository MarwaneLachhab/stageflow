import Link from 'next/link'
import { redirect } from 'next/navigation'
import { CheckCircle2, Clock, ClipboardList, Lock } from 'lucide-react'
import { AuthLayout } from '@/components/public/auth-layout'
import { SignInForm } from '@/components/public/sign-in-form'
import { Alert } from '@/components/ui/alert'
import { getSessionUser, homeRouteForRole } from '@/lib/auth/session'

export const metadata = {
  title: 'Se connecter',
  description: 'Connectez-vous pour accéder à votre espace personnel StageFlow.',
}

type SearchParams = Promise<{ next?: string; erreur?: string; deconnexion?: string; confirme?: string }>

export default async function ConnexionPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams

  const user = await getSessionUser()
  if (user) redirect(homeRouteForRole(user.role))

  // Only forward same-origin relative paths, so `next` cannot be an open redirect.
  const next =
    params.next && params.next.startsWith('/') && !params.next.startsWith('//')
      ? params.next
      : undefined

  return (
    <AuthLayout
      eyebrow="Ravi de vous revoir"
      title={
        <>
          Bon retour&nbsp;! <span aria-hidden="true">👋</span>
        </>
      }
      subtitle="Connectez-vous pour accéder à votre espace personnel."
      topRight={
        <p className="text-sm text-ink-muted">
          Vous découvrez StageFlow ?{' '}
          <Link href="/inscription" className="font-semibold text-primary-600 hover:underline">
            Créer un compte
          </Link>
        </p>
      }
      asideTitle={
        <>
          Content de vous <span className="text-primary-600">revoir.</span>
        </>
      }
      asideSubtitle="Retrouvez l’état de votre candidature et poursuivez votre dossier là où vous l’avez laissé."
      asideSlot={
        <div className="rounded-card border border-white/70 bg-surface p-5 shadow-raised">
          <div className="flex items-center justify-between gap-3 pb-4">
            <p className="text-sm font-bold text-ink">Votre tableau de bord</p>
            <span className="sf-badge border-info-border bg-info-bg text-info">En cours</span>
          </div>

          <div className="rounded-control border border-border bg-canvas p-3.5">
            <p className="text-2xs font-semibold uppercase tracking-wide text-ink-subtle">
              Ma candidature
            </p>
            <div className="mt-1.5 flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-ink">Stage — Développement Web</p>
              <ClipboardList className="h-4 w-4 shrink-0 text-ink-subtle" aria-hidden="true" />
            </div>
          </div>

          <ul className="mt-4 space-y-3">
            {[
              { icon: CheckCircle2, title: 'Demande envoyée', subtitle: 'Vous gardez le contrôle à chaque étape' },
              { icon: Clock, title: 'Réponse à venir', subtitle: 'Consultez l’évolution depuis votre espace' },
            ].map((row) => {
              const Icon = row.icon
              return (
                <li key={row.title} className="flex items-start gap-3">
                  <span
                    aria-hidden="true"
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-success-bg text-success"
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-[13px] font-semibold text-ink">{row.title}</p>
                    <p className="text-2xs text-ink-muted">{row.subtitle}</p>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      }
    >
      <div className="space-y-5">
        {params.deconnexion === '1' && (
          <Alert variant="success" title="Vous êtes déconnecté">
            Votre session a été fermée en toute sécurité.
          </Alert>
        )}
        {params.confirme === '1' && (
          <Alert variant="success" title="Adresse confirmée">
            Votre compte est activé. Vous pouvez maintenant vous connecter.
          </Alert>
        )}

        <SignInForm next={next} initialError={params.erreur} />
      </div>

      <p className="mt-6 flex items-center justify-center gap-1.5 text-xs text-ink-subtle">
        <Lock className="h-3.5 w-3.5" aria-hidden="true" />
        Connexion chiffrée · Aucune donnée partagée avec des tiers
      </p>
    </AuthLayout>
  )
}
