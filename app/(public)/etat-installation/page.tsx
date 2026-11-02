import type { Metadata } from 'next'
import Link from 'next/link'
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Database,
  MinusCircle,
  RefreshCw,
  ServerCog,
  XCircle,
} from 'lucide-react'
import { Logo } from '@/components/ui/logo'
import { getSetupReport, type CheckState, type SetupCheck } from '@/lib/setup-status'

export const metadata: Metadata = {
  title: 'État de l’installation',
  robots: { index: false, follow: false },
}

// The report performs live network probes: never cache it.
export const dynamic = 'force-dynamic'

/**
 * `/etat-installation` — operator-facing self-diagnosis.
 *
 * This page exists because a misconfigured deployment currently fails with a
 * generic message that gives no indication of what is wrong. Here every
 * prerequisite is probed for real and reported with the exact remedy.
 *
 * It exposes only variable NAMES and connection outcomes — never a key, never a
 * stack trace, never a schema detail beyond "this table does not exist". It is
 * marked noindex, and it is safe to leave deployed.
 */

const STATE_STYLE: Record<
  CheckState,
  { icon: typeof CheckCircle2; label: string; badge: string; iconColor: string }
> = {
  ok: {
    icon: CheckCircle2,
    label: 'Conforme',
    badge: 'bg-success/10 text-success border-success/20',
    iconColor: 'text-success',
  },
  missing: {
    icon: XCircle,
    label: 'Manquant',
    badge: 'bg-danger/10 text-danger border-danger/20',
    iconColor: 'text-danger',
  },
  blocked: {
    icon: MinusCircle,
    label: 'Non vérifiable',
    badge: 'bg-muted text-ink-muted border-border',
    iconColor: 'text-ink-muted',
  },
  warning: {
    icon: AlertTriangle,
    label: 'Attention',
    badge: 'bg-warning/10 text-warning border-warning/20',
    iconColor: 'text-warning',
  },
}

export default async function InstallationStatusPage() {
  const report = await getSetupReport()

  return (
    <div className="min-h-screen bg-canvas">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex h-[72px] max-w-[900px] items-center px-5 sm:px-8">
          <Logo />
          <span className="ml-auto text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted">
            Diagnostic opérateur
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-[900px] px-5 py-10 sm:px-8 sm:py-14">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-navy sm:text-3xl">
              État de l’installation
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-muted">
              Chaque contrôle ci-dessous effectue une vérification réelle. Aucun résultat n’est
              présumé : lorsqu’un test ne peut pas s’exécuter, il est signalé comme non vérifiable
              plutôt que comme réussi.
            </p>
          </div>
          <Link href="/etat-installation" className="sf-btn-secondary shrink-0">
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Relancer
          </Link>
        </div>

        {/* Verdict */}
        <div
          className={
            report.ready
              ? 'mt-8 rounded-xl border border-success/25 bg-success/5 p-5'
              : 'mt-8 rounded-xl border border-warning/30 bg-warning/5 p-5'
          }
        >
          <div className="flex items-start gap-3">
            {report.ready ? (
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" aria-hidden="true" />
            ) : (
              <ServerCog className="mt-0.5 h-5 w-5 shrink-0 text-warning" aria-hidden="true" />
            )}
            <div>
              <p className="text-sm font-semibold text-navy">
                {report.ready
                  ? 'L’application est connectée à une base de données.'
                  : 'L’application n’est pas encore opérationnelle.'}
              </p>
              <p className="mt-1 text-sm leading-relaxed text-ink-muted">
                {report.ready
                  ? 'L’authentification et les pages de données peuvent fonctionner. Vérifiez le compte administrateur ci-dessous avant de vous connecter.'
                  : 'Toutes les pages publiques sont consultables, mais l’inscription, la connexion et toute page affichant des données échoueront jusqu’à ce que les éléments ci-dessous soient corrigés.'}
              </p>
            </div>
          </div>
        </div>

        {/* Checks */}
        <ul className="mt-6 space-y-3">
          {report.checks.map((check) => (
            <CheckRow key={check.id} check={check} />
          ))}
        </ul>

        {/* Next steps */}
        <section className="mt-10 rounded-xl border border-border bg-surface p-6">
          <h2 className="text-sm font-bold uppercase tracking-[0.1em] text-ink-muted">
            Marche à suivre
          </h2>
          <ol className="mt-4 space-y-4 text-sm text-ink">
            <Step
              n={1}
              title="Créer un projet Supabase"
              body="Sur supabase.com, créez un projet, puis ouvrez Project Settings → API pour récupérer l’URL du projet et la clé anon (publishable)."
            />
            <Step
              n={2}
              title="Renseigner .env.local"
              body="Copiez .env.example vers .env.local à la racine du projet et collez les deux valeurs. Redémarrez ensuite le serveur : Next.js ne relit ce fichier qu’au démarrage."
            />
            <Step
              n={3}
              title="Appliquer les migrations SQL"
              body="Dans l’éditeur SQL de Supabase, exécutez dans l’ordre 0001, 0002, 0003, 0004 puis 0005 depuis supabase/migrations/. Chaque fichier est conçu pour être rejoué sans erreur."
            />
            <Step
              n={4}
              title="Créer le premier administrateur"
              body="Inscrivez-vous normalement via /inscription, confirmez l’adresse e-mail, puis exécutez dans l’éditeur SQL : select promote_to_admin('votre-adresse@exemple.fr');"
            />
          </ol>

          <div className="mt-6 rounded-lg border border-border bg-canvas p-4">
            <p className="text-xs leading-relaxed text-ink-muted">
              <span className="font-semibold text-ink">Aucune interface d’administration des
              comptes n’existe.</span>{' '}
              La promotion d’un utilisateur au rôle administrateur se fait uniquement par la
              commande SQL ci-dessus. Ce n’est pas un oubli : une page web permettant de s’octroyer
              le rôle administrateur serait une élévation de privilèges. Le rôle vit dans la table
              <code className="mx-1 rounded bg-muted px-1 py-0.5 font-mono text-[11px]">user_roles</code>
              qui n’est accessible en écriture à aucun client.
            </p>
          </div>
        </section>

        <p className="mt-8 text-xs leading-relaxed text-ink-muted">
          Cette page ne divulgue aucune clé et n’affiche aucune trace technique. Elle est exclue de
          l’indexation des moteurs de recherche. Supprimez-la avant une mise en production publique
          si vous préférez ne pas exposer l’état de la configuration.
        </p>

        <div className="mt-8">
          <Link href="/" className="sf-btn-primary">
            Retour à l’accueil
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </main>
    </div>
  )
}

function CheckRow({ check }: { check: SetupCheck }) {
  const style = STATE_STYLE[check.state]
  const Icon = style.icon

  return (
    <li className="rounded-xl border border-border bg-surface p-5">
      <div className="flex items-start gap-3">
        <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${style.iconColor}`} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-sm font-semibold text-navy">{check.label}</span>
            <span
              className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${style.badge}`}
            >
              {style.label}
            </span>
          </div>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{check.detail}</p>
          {check.remedy && (
            <p className="mt-2 flex items-start gap-2 text-sm leading-relaxed text-ink">
              <ArrowRight className="mt-1 h-3.5 w-3.5 shrink-0 text-primary-600" aria-hidden="true" />
              <span>{check.remedy}</span>
            </p>
          )}
        </div>
        {check.id === 'database' && (
          <Database className="ml-auto h-4 w-4 shrink-0 text-ink-subtle" aria-hidden="true" />
        )}
      </div>
    </li>
  )
}

function Step({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <li className="flex gap-4">
      <span
        aria-hidden="true"
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-50 text-xs font-bold text-primary-600"
      >
        {n}
      </span>
      <div>
        <p className="font-semibold text-navy">{title}</p>
        <p className="mt-1 leading-relaxed text-ink-muted">{body}</p>
      </div>
    </li>
  )
}
