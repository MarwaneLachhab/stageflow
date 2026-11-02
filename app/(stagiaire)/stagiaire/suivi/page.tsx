import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  ArrowLeft,
  Building2,
  CalendarRange,
  Clock,
  FileText,
  GraduationCap,
  Inbox,
  MapPin,
  Send,
  ShieldAlert,
} from 'lucide-react'
import { Alert } from '@/components/ui/alert'
import { Card, CardBody, CardSectionTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { StatusBadge } from '@/components/ui/status-badge'
import { ProgressTimeline } from '@/components/stagiaire/progress-timeline'
import { ActivityFeed, type ActivityItem } from '@/components/stagiaire/activity-feed'
import { getSessionUser } from '@/lib/auth/session'
import {
  getCurrentApplication,
  getApplicationDocuments,
  getApplicationHistory,
} from '@/lib/db/stagiaire'
import { DOCUMENT_TYPES, STATUS_META } from '@/lib/constants'
import { formatDateLong, computeDurationLabel } from '@/lib/utils/format'

export const metadata: Metadata = { title: 'Suivi de ma demande' }

/**
 * SCREEN 8 — suivi de la demande.
 *
 * The written decision outcome is deliberately separated from the status badge:
 *   - `ACCEPTED` → friendly green confirmation;
 *   - `REJECTED` → red panel showing ONLY `public_rejection_reason`, which the
 *     database guarantees is >= 10 characters (constraint
 *     `applications_rejected_requires_reason`). Administrator-only notes live in
 *     `admin_private_notes` and are never queried here.
 */
export default async function SuiviPage() {
  const user = await getSessionUser()
  if (!user) redirect('/connexion')

  const application = await getCurrentApplication(user.id)

  if (!application) {
    return (
      <EmptyState
        icon={<Inbox className="h-7 w-7" />}
        title="Aucune demande à suivre"
        description="Dès que vous aurez rempli et envoyé votre demande de stage, son avancement s’affichera ici, étape par étape."
        action={
          <Link href="/stagiaire/demande" className="sf-btn sf-btn-primary">
            <Send className="h-4 w-4" aria-hidden="true" />
            Créer ma demande
          </Link>
        }
      />
    )
  }

  const [documents, history] = await Promise.all([
    getApplicationDocuments(application.id),
    getApplicationHistory(application.id),
  ])

  const activity: ActivityItem[] = history.map((row) => ({
    id: row.id,
    status: row.to_status,
    note: row.public_note,
    createdAt: row.created_at,
  }))

  const documentsByType = new Map(documents.map((doc) => [doc.document_type, doc]))

  const details: { icon: React.ReactNode; label: string; value: React.ReactNode }[] = [
    {
      icon: <Building2 className="h-4 w-4" aria-hidden="true" />,
      label: 'Type de stage',
      value: application.stage_type,
    },
    {
      icon: <GraduationCap className="h-4 w-4" aria-hidden="true" />,
      label: 'Domaine',
      value: application.domain,
    },
    {
      icon: <CalendarRange className="h-4 w-4" aria-hidden="true" />,
      label: 'Période souhaitée',
      value:
        application.start_date && application.end_date
          ? `${formatDateLong(application.start_date)} → ${formatDateLong(application.end_date)}`
          : 'À préciser',
    },
    {
      icon: <Clock className="h-4 w-4" aria-hidden="true" />,
      label: 'Durée',
      value: computeDurationLabel(application.start_date, application.end_date) ?? '—',
    },
    {
      icon: <MapPin className="h-4 w-4" aria-hidden="true" />,
      label: 'Mode de travail',
      value: application.mode ?? 'Non précisé',
    },
  ]

  const isDraft = application.status === 'DRAFT'
  const isAccepted = application.status === 'ACCEPTED'
  const isRejected = application.status === 'REJECTED'

  return (
    <>
      {/* ---------------- Header ---------------- */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary-600">
            Votre espace
          </p>
          <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-navy sm:text-[28px]">
            Suivi de ma demande
          </h1>
          <p className="mt-2 text-sm text-ink-muted">
            {STATUS_META[application.status].label}
            {application.submitted_at
              ? ` · envoyée le ${formatDateLong(application.submitted_at)}`
              : ' · pas encore envoyée'}
          </p>
        </div>
        <StatusBadge status={application.status} className="shrink-0" />
      </div>

      {/* ---------------- Draft reminder ---------------- */}
      {isDraft && (
        <Alert
          variant="warning"
          className="mb-6"
          title="Votre demande n’a pas encore été envoyée"
        >
          Elle reste enregistrée comme brouillon. Remplir le formulaire ne suffit pas : ouvrez la
          page documents et cliquez sur « Envoyer la demande » pour la transmettre à
          l’administration.{' '}
          <Link href="/stagiaire/documents" className="font-semibold underline">
            Finaliser ma demande
          </Link>
        </Alert>
      )}

      {/* ---------------- Outcome panels ---------------- */}
      {isAccepted && (
        <div className="mb-6 rounded-card border border-success-border bg-success-bg p-5 sm:p-6">
          <span
            aria-hidden="true"
            className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-success shadow-card"
          >
            <ShieldAlert className="h-5 w-5" />
          </span>
          <h2 className="text-lg font-bold text-success">Votre demande de stage a été acceptée</h2>
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-success/90">
            Félicitations ! L’administration a validé votre candidature
            {application.decided_at ? ` le ${formatDateLong(application.decided_at)}` : ''}. Vous
            serez contacté(e) par e-mail pour la suite du processus.
          </p>
        </div>
      )}

      {isRejected && (
        <div className="mb-6 rounded-card border border-danger-border bg-danger-bg p-5 sm:p-6">
          <span
            aria-hidden="true"
            className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-danger shadow-card"
          >
            <ShieldAlert className="h-5 w-5" />
          </span>
          <h2 className="text-lg font-bold text-danger">Votre demande n’a pas été retenue</h2>
          {application.public_rejection_reason ? (
            <>
              <p className="mt-2 text-xs font-semibold uppercase tracking-[0.1em] text-danger/80">
                Motif communiqué
              </p>
              <p className="mt-1 max-w-2xl whitespace-pre-line text-sm leading-relaxed text-danger/90">
                {application.public_rejection_reason}
              </p>
            </>
          ) : (
            // Should not happen: the DB constraint requires a reason to move to
            // REJECTED. If it somehow does, say so plainly rather than invent one.
            <p className="mt-2 text-sm text-danger/90">
              Aucun motif n’a été communiqué. Contactez l’administration pour en savoir plus.
            </p>
          )}
        </div>
      )}

      {/* ---------------- Tracker + activity ---------------- */}
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Card className="p-5 sm:p-6">
          <CardSectionTitle className="mb-5">Avancement de la demande</CardSectionTitle>

          {/* Horizontal on tablet/desktop, vertical on phones. */}
          <div className="hidden sm:block">
            <ProgressTimeline
              status={application.status}
              submittedAt={application.submitted_at}
              reviewedAt={application.reviewed_at}
              decidedAt={application.decided_at}
              variant="horizontal"
            />
          </div>
          <div className="sm:hidden">
            <ProgressTimeline
              status={application.status}
              submittedAt={application.submitted_at}
              reviewedAt={application.reviewed_at}
              decidedAt={application.decided_at}
              variant="vertical"
            />
          </div>
        </Card>

        <Card className="p-5 sm:p-6">
          <CardSectionTitle className="mb-5">Historique de la candidature</CardSectionTitle>
          <ActivityFeed
            items={activity}
            emptyMessage="L’historique s’enrichira dès l’envoi de votre demande."
          />
        </Card>
      </div>

      {/* ---------------- Details + documents ---------------- */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardBody className="pt-5 sm:pt-6">
            <CardSectionTitle className="mb-4">Détails de la demande</CardSectionTitle>
            <dl className="space-y-3.5">
              {details.map((row) => (
                <div key={row.label} className="flex items-start gap-3">
                  <span
                    aria-hidden="true"
                    className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600"
                  >
                    {row.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <dt className="text-2xs font-semibold uppercase tracking-[0.1em] text-ink-subtle">
                      {row.label}
                    </dt>
                    <dd className="mt-0.5 text-sm text-ink">{row.value}</dd>
                  </div>
                </div>
              ))}
            </dl>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="pt-5 sm:pt-6">
            <CardSectionTitle className="mb-4">Pièces justificatives</CardSectionTitle>
            <ul className="space-y-0">
              {DOCUMENT_TYPES.map((slot) => {
                const doc = documentsByType.get(slot.value)
                const present = Boolean(doc)

                return (
                  <li
                    key={slot.value}
                    className="flex items-center justify-between gap-3 border-t border-border py-3 first:border-t-0"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span
                        aria-hidden="true"
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                          present ? 'bg-primary-50 text-primary-600' : 'bg-warning-bg text-warning'
                        }`}
                      >
                        <FileText className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-ink">{slot.label}</p>
                        <p className="text-2xs text-ink-subtle">
                          {doc ? doc.original_name : slot.required ? 'Requis' : 'Facultatif'}
                        </p>
                      </div>
                    </div>

                    {doc ? (
                      <a
                        href={`/api/documents/${doc.id}`}
                        className="sf-btn sf-btn-ghost sf-btn-sm shrink-0"
                      >
                        Télécharger
                      </a>
                    ) : (
                      <span className="shrink-0 text-2xs font-medium text-warning">
                        {slot.required ? 'Manquant' : '—'}
                      </span>
                    )}
                  </li>
                )
              })}
            </ul>
            {!isDraft && (
              <p className="mt-4 text-2xs leading-relaxed text-ink-subtle">
                Ces pièces sont verrouillées. Contactez l’administration si l’une d’elles doit être
                remplacée.
              </p>
            )}
          </CardBody>
        </Card>
      </div>

      <div className="mt-6">
        <Link href="/stagiaire/tableau-de-bord" className="sf-btn sf-btn-secondary sf-btn-sm">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Retour au tableau de bord
        </Link>
      </div>
    </>
  )
}
