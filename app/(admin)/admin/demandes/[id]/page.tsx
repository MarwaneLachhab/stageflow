import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  ArrowLeft,
  Briefcase,
  CalendarRange,
  Clock,
  Download,
  FileText,
  GraduationCap,
  Mail,
  MapPin,
  Phone,
  User,
} from 'lucide-react'
import { Card, CardSectionTitle, CardBody } from '@/components/ui/card'
import { StatusBadge } from '@/components/ui/status-badge'
import { DecisionPanel } from '@/components/admin/decision-panel'
import { PrivateNotesPanel } from '@/components/admin/private-notes-panel'
import { ProgressTimeline } from '@/components/stagiaire/progress-timeline'
import { ActivityFeed, type ActivityItem } from '@/components/stagiaire/activity-feed'
import { getAdminApplicationDetail, getAdminApplicationHistory } from '@/lib/db/admin'
import { DOCUMENT_TYPES, STATUS_META, type DocumentType } from '@/lib/constants'
import {
  formatDateLong,
  formatDateShort,
  formatDateTime,
  formatBytes,
  computeDurationLabel,
  fullName,
} from '@/lib/utils/format'

export const metadata: Metadata = { title: 'Dossier de candidature — Administration' }

/**
 * SCREEN 11 — application detail and decision.
 *
 * Access control is layered:
 *  1. the `(admin)` layout has already proven the caller is an admin;
 *  2. `getAdminApplicationDetail` reads through the user-scoped client, so RLS
 *     returns the row only if `is_admin()` holds — a stagiaire gets `null` and
 *     therefore a 404, never a partially redacted page;
 *  3. contact details (e-mail) are resolved separately through the elevated
 *     client, and only AFTER the RLS-protected read has already succeeded.
 *
 * A `notFound()` for a missing OR forbidden row is deliberate: it avoids
 * confirming the existence of another user's application.
 */
export default async function AdminApplicationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  // Cheap shape check before touching the database: a malformed id can never
  // match a UUID column, so there is no reason to issue the query.
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!UUID_RE.test(id)) notFound()

  const [application, history] = await Promise.all([
    getAdminApplicationDetail(id),
    getAdminApplicationHistory(id),
  ])

  if (!application) notFound()

  const activity: ActivityItem[] = history.map((row) => ({
    id: row.id,
    status: row.toStatus,
    note: row.note,
    createdAt: row.createdAt,
  }))

  const documentsByType = new Map(
    application.documents.map((doc) => [doc.documentType as DocumentType, doc]),
  )

  const requiredSlots = DOCUMENT_TYPES.filter((slot) => slot.required)
  const missingCount = requiredSlots.filter((slot) => !documentsByType.has(slot.value)).length

  return (
    <>
      {/* ---------------- Breadcrumb + header ---------------- */}
      <div className="mb-5">
        <Link
          href="/admin/demandes"
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-muted transition-colors hover:text-primary-600"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          Retour à la liste des demandes
        </Link>
      </div>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary-600">
            Dossier de candidature
          </p>
          <h1 className="mt-1.5 truncate text-2xl font-bold tracking-tight text-navy sm:text-[28px]">
            {fullName(application.applicant.firstName, application.applicant.lastName)}
          </h1>
          <p className="mt-2 text-sm text-ink-muted">
            {application.stageType} · {application.domain}
            {application.submittedAt
              ? ` · reçue le ${formatDateShort(application.submittedAt)}`
              : ' · non encore envoyée'}
          </p>
        </div>
        <StatusBadge status={application.status} className="shrink-0" />
      </div>

      {/* ---------------- Timeline ---------------- */}
      <Card className="mb-6 p-5 sm:p-6">
        <CardSectionTitle className="mb-5">Avancement du dossier</CardSectionTitle>
        <div className="hidden sm:block">
          <ProgressTimeline
            status={application.status}
            submittedAt={application.submittedAt}
            reviewedAt={application.reviewedAt}
            decidedAt={application.decidedAt}
            variant="horizontal"
          />
        </div>
        <div className="sm:hidden">
          <ProgressTimeline
            status={application.status}
            submittedAt={application.submittedAt}
            reviewedAt={application.reviewedAt}
            decidedAt={application.decidedAt}
            variant="vertical"
          />
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1fr_370px]">
        {/* ================= Left column ================= */}
        <div className="space-y-6">
          {/* ---------------- Candidate ---------------- */}
          <Card>
            <CardBody className="pt-5 sm:pt-6">
              <CardSectionTitle className="mb-4 flex items-center gap-2">
                <User className="h-4 w-4 text-primary-600" aria-hidden="true" />
                Informations du candidat
              </CardSectionTitle>

              <dl className="grid gap-4 sm:grid-cols-2">
                <DetailItem icon={<User className="h-3.5 w-3.5" />} label="Nom complet">
                  {fullName(application.applicant.firstName, application.applicant.lastName)}
                </DetailItem>

                <DetailItem icon={<Mail className="h-3.5 w-3.5" />} label="Adresse e-mail">
                  {application.applicant.email ? (
                    <a
                      href={`mailto:${application.applicant.email}`}
                      className="text-primary-600 hover:underline"
                    >
                      {application.applicant.email}
                    </a>
                  ) : (
                    <span className="text-ink-subtle">Non disponible</span>
                  )}
                </DetailItem>

                <DetailItem icon={<Phone className="h-3.5 w-3.5" />} label="Téléphone">
                  {application.applicant.phone ?? (
                    <span className="text-ink-subtle">Non renseigné</span>
                  )}
                </DetailItem>

                <DetailItem icon={<CalendarRange className="h-3.5 w-3.5" />} label="Date de naissance">
                  {application.applicant.birthDate ? (
                    formatDateLong(application.applicant.birthDate)
                  ) : (
                    <span className="text-ink-subtle">Non renseignée</span>
                  )}
                </DetailItem>

                <DetailItem
                  icon={<MapPin className="h-3.5 w-3.5" />}
                  label="Ville"
                  className="sm:col-span-2"
                >
                  {[application.applicant.address, application.applicant.city]
                    .filter(Boolean)
                    .join(', ') || <span className="text-ink-subtle">Non renseignée</span>}
                </DetailItem>
              </dl>
            </CardBody>
          </Card>

          {/* ---------------- Academics ---------------- */}
          <Card>
            <CardBody className="pt-5 sm:pt-6">
              <CardSectionTitle className="mb-4 flex items-center gap-2">
                <GraduationCap className="h-4 w-4 text-primary-600" aria-hidden="true" />
                Informations académiques
              </CardSectionTitle>

              <dl className="grid gap-4 sm:grid-cols-2">
                <DetailItem icon={<GraduationCap className="h-3.5 w-3.5" />} label="Établissement">
                  {application.academics.school ?? <span className="text-ink-subtle">—</span>}
                </DetailItem>
                <DetailItem icon={<Briefcase className="h-3.5 w-3.5" />} label="Filière">
                  {application.academics.program ?? <span className="text-ink-subtle">—</span>}
                </DetailItem>
                <DetailItem icon={<GraduationCap className="h-3.5 w-3.5" />} label="Niveau d’études">
                  {application.academics.studyLevel ?? <span className="text-ink-subtle">—</span>}
                </DetailItem>
                <DetailItem icon={<Briefcase className="h-3.5 w-3.5" />} label="Spécialité">
                  {application.academics.specialty ?? <span className="text-ink-subtle">—</span>}
                </DetailItem>
              </dl>
            </CardBody>
          </Card>

          {/* ---------------- Internship request ---------------- */}
          <Card>
            <CardBody className="pt-5 sm:pt-6">
              <CardSectionTitle className="mb-4 flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-primary-600" aria-hidden="true" />
                Détails de la demande
              </CardSectionTitle>

              <dl className="grid gap-4 sm:grid-cols-2">
                <DetailItem icon={<Briefcase className="h-3.5 w-3.5" />} label="Type de stage">
                  {application.stageType}
                </DetailItem>
                <DetailItem icon={<Briefcase className="h-3.5 w-3.5" />} label="Domaine">
                  {application.domain}
                </DetailItem>
                <DetailItem icon={<CalendarRange className="h-3.5 w-3.5" />} label="Période souhaitée">
                  {application.startDate && application.endDate
                    ? `${formatDateLong(application.startDate)} → ${formatDateLong(application.endDate)}`
                    : <span className="text-ink-subtle">Non précisée</span>}
                </DetailItem>
                <DetailItem icon={<Clock className="h-3.5 w-3.5" />} label="Durée">
                  {computeDurationLabel(application.startDate, application.endDate) ?? '—'}
                </DetailItem>
                <DetailItem icon={<MapPin className="h-3.5 w-3.5" />} label="Mode de travail">
                  {application.mode ?? <span className="text-ink-subtle">Non précisé</span>}
                </DetailItem>
                <DetailItem icon={<Clock className="h-3.5 w-3.5" />} label="Créée le">
                  {formatDateTime(application.createdAt)}
                </DetailItem>
              </dl>

              <div className="mt-5 border-t border-border pt-5">
                <p className="text-2xs font-semibold uppercase tracking-[0.1em] text-ink-subtle">
                  Lettre de motivation
                </p>
                <p className="mt-2 whitespace-pre-line text-[13px] leading-relaxed text-ink">
                  {application.motivation || (
                    <span className="text-ink-subtle">Aucune motivation fournie.</span>
                  )}
                </p>
              </div>
            </CardBody>
          </Card>

          {/* ---------------- Documents ---------------- */}
          <Card>
            <CardBody className="pt-5 sm:pt-6">
              <CardSectionTitle className="mb-1 flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary-600" aria-hidden="true" />
                Pièces justificatives
              </CardSectionTitle>
              <p className="mb-4 text-[13px] text-ink-muted">
                {missingCount === 0
                  ? 'Toutes les pièces obligatoires ont été fournies.'
                  : `${missingCount} pièce${missingCount > 1 ? 's' : ''} obligatoire${missingCount > 1 ? 's' : ''} manquante${missingCount > 1 ? 's' : ''}.`}
              </p>

              <ul className="space-y-0">
                {DOCUMENT_TYPES.map((slot) => {
                  const doc = documentsByType.get(slot.value)

                  return (
                    <li
                      key={slot.value}
                      className="flex flex-col gap-3 border-t border-border py-3.5 first:border-t-0 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex min-w-0 items-start gap-3">
                        <span
                          aria-hidden="true"
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                            doc ? 'bg-primary-50 text-primary-600' : 'bg-warning-bg text-warning'
                          }`}
                        >
                          <FileText className="h-4 w-4" />
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-ink">
                            {slot.label}
                            {slot.required && (
                              <span className="ml-1.5 text-2xs font-normal text-danger">
                                obligatoire
                              </span>
                            )}
                          </p>
                          <p className="mt-0.5 truncate text-2xs text-ink-subtle">
                            {doc
                              ? `${doc.originalName} · ${formatBytes(doc.bytes)} · déposé le ${formatDateShort(doc.createdAt)}`
                              : 'Aucun fichier déposé'}
                          </p>
                        </div>
                      </div>

                      {doc ? (
                        <a
                          href={`/api/documents/${doc.id}`}
                          className="sf-btn sf-btn-secondary sf-btn-sm shrink-0"
                        >
                          <Download className="h-3.5 w-3.5" aria-hidden="true" />
                          Télécharger
                        </a>
                      ) : (
                        <span className="shrink-0 text-2xs font-medium text-warning">
                          {slot.required ? 'Manquant' : 'Facultatif'}
                        </span>
                      )}
                    </li>
                  )
                })}
              </ul>

              {/* The submissions that exist but are not part of the declared slots
                  are still shown — nothing the candidate sent is hidden. */}
              {application.documents.filter(
                (doc) => !DOCUMENT_TYPES.some((slot) => slot.value === doc.documentType),
              ).length > 0 && (
                <div className="mt-4 border-t border-border pt-4">
                  <p className="mb-2 text-2xs font-semibold uppercase tracking-[0.1em] text-ink-subtle">
                    Autres fichiers déposés
                  </p>
                  <ul className="space-y-2">
                    {application.documents
                      .filter(
                        (doc) => !DOCUMENT_TYPES.some((slot) => slot.value === doc.documentType),
                      )
                      .map((doc) => (
                        <li
                          key={doc.id}
                          className="flex items-center justify-between gap-3 text-[13px]"
                        >
                          <span className="truncate text-ink-muted">
                            {doc.originalName} · {formatBytes(doc.bytes)}
                          </span>
                          <a
                            href={`/api/documents/${doc.id}`}
                            className="shrink-0 font-medium text-primary-600 hover:underline"
                          >
                            Télécharger
                          </a>
                        </li>
                      ))}
                  </ul>
                </div>
              )}
            </CardBody>
          </Card>

          {/* ---------------- History ---------------- */}
          <Card className="p-5 sm:p-6">
            <CardSectionTitle className="mb-5">Historique du dossier</CardSectionTitle>
            <ActivityFeed
              items={activity}
              emptyMessage="Aucun événement enregistré pour cette demande."
            />
          </Card>
        </div>

        {/* ================= Right column ================= */}
        <div className="space-y-6">
          <DecisionPanel
            applicationId={application.id}
            status={application.status}
            publicReason={application.publicRejectionReason}
          />

          <PrivateNotesPanel applicationId={application.id} notes={application.privateNotes} />

          <Card className="p-5">
            <CardSectionTitle className="mb-3">Informations système</CardSectionTitle>
            <dl className="space-y-2.5 text-[13px]">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-ink-muted">Statut actuel</dt>
                <dd className="font-medium text-ink">{STATUS_META[application.status].label}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-ink-muted">Version du dossier</dt>
                <dd className="font-medium tabular-nums text-ink">v{application.version}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-ink-muted">Documents joints</dt>
                <dd className="font-medium tabular-nums text-ink">
                  {application.documents.length}
                </dd>
              </div>
              {application.decidedAt && (
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-ink-muted">Décision rendue le</dt>
                  <dd className="font-medium text-ink">
                    {formatDateShort(application.decidedAt)}
                  </dd>
                </div>
              )}
            </dl>
          </Card>
        </div>
      </div>
    </>
  )
}

/* -------------------------------------------------------------------------- */
/* Local presentational helper                                                 */
/* -------------------------------------------------------------------------- */

function DetailItem({
  icon,
  label,
  children,
  className,
}: {
  icon: React.ReactNode
  label: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={className}>
      <dt className="flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-[0.1em] text-ink-subtle">
        <span aria-hidden="true" className="text-ink-faint">
          {icon}
        </span>
        {label}
      </dt>
      <dd className="mt-1 text-sm leading-relaxed text-ink">{children}</dd>
    </div>
  )
}
