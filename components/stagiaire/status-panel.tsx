import Link from 'next/link'
import { ArrowRight, Calendar, CheckCircle2, Clock, FileText, XCircle } from 'lucide-react'
import { STATUS_META, type ApplicationStatus } from '@/lib/constants'
import { cn } from '@/lib/utils/cn'
import { formatDateLong } from '@/lib/utils/format'

/**
 * StatusPanel — the large gradient panel at the top of the stagiaire dashboard
 * (mockup 04: « Votre dossier est en cours d'examen » with a date card).
 *
 * The colour and copy are driven entirely by the persisted status, so the panel
 * can never claim something the database does not say.
 */

const PANELS: Record<
  ApplicationStatus,
  { headline: string; body: string; cta: string; href: string }
> = {
  DRAFT: {
    headline: 'Votre dossier est en cours de préparation',
    body: 'Complétez les informations du stage, vos informations académiques et vos documents, puis envoyez votre demande.',
    cta: 'Reprendre mon brouillon',
    href: '/stagiaire/demande',
  },
  SUBMITTED: {
    headline: 'Votre demande a bien été envoyée',
    body: 'Votre candidature est entre les mains de l’administration. Vous serez informé dès qu’une décision sera prise.',
    cta: 'Suivre ma demande',
    href: '/stagiaire/suivi',
  },
  UNDER_REVIEW: {
    headline: 'Votre dossier est en cours d’examen',
    body: 'Votre candidature a bien été reçue. Notre équipe étudie actuellement votre demande.',
    cta: 'Suivre ma demande',
    href: '/stagiaire/suivi',
  },
  ACCEPTED: {
    headline: 'Votre demande de stage a été acceptée',
    body: 'Félicitations ! Le service a validé votre candidature. Consultez les détails pour la suite des démarches.',
    cta: 'Voir la décision',
    href: '/stagiaire/suivi',
  },
  REJECTED: {
    headline: 'Votre demande de stage a été refusée',
    body: 'Votre candidature n’a pas été retenue pour cette période. Le motif est disponible dans le suivi.',
    cta: 'Voir le motif',
    href: '/stagiaire/suivi',
  },
}

export function StatusPanel({
  status,
  applicationId,
  updatedAt,
}: {
  status: ApplicationStatus
  applicationId: string
  updatedAt: string
}) {
  const meta = STATUS_META[status]
  const panel = PANELS[status]
  const Icon =
    status === 'ACCEPTED'
      ? CheckCircle2
      : status === 'REJECTED'
        ? XCircle
        : status === 'DRAFT'
          ? FileText
          : Clock

  return (
    <section
      aria-label="Statut de ma demande"
      className={cn(
        'relative mb-6 overflow-hidden rounded-card p-6 sm:p-7',
        status === 'DRAFT' && 'bg-gradient-to-br from-navy to-[#12234A]',
        status !== 'DRAFT' && 'bg-gradient-to-br from-primary-600 to-primary-800',
      )}
    >
      {/* Decorative rings, matching the mockup's soft geometry */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full border border-white/10"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-24 right-16 h-64 w-64 rounded-full border border-white/10"
      />

      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-2xs font-semibold uppercase tracking-wide text-white">
            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
            Votre demande actuelle
          </span>

          <h2 className="mt-4 text-xl font-bold leading-snug text-white sm:text-2xl">
            {panel.headline}
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-blue-100">{panel.body}</p>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Link
              href={panel.href}
              className="sf-btn bg-white text-primary-700 hover:bg-blue-50"
            >
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
              {panel.cta}
            </Link>
            <span className="rounded-full border border-white/20 px-3 py-1.5 text-xs font-semibold text-white">
              {meta.label}
            </span>
          </div>
        </div>

        <div className="shrink-0 lg:w-[228px]">
          <div className="rounded-card border border-white/15 bg-white/10 p-4 backdrop-blur-sm">
            <p className="flex items-center gap-2 text-2xs font-semibold uppercase tracking-wide text-blue-100">
              <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
              Dernière mise à jour
            </p>
            <p className="mt-2 text-lg font-bold text-white">{formatDateLong(updatedAt)}</p>
            <p className="mt-0.5 text-2xs text-blue-200">
              Référence : {applicationId.slice(0, 8).toUpperCase()}
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
