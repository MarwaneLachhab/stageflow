'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { CheckCircle2, Info, Send, Save, ShieldCheck, X, XCircle } from 'lucide-react'
import { Card, CardHeader } from '@/components/ui/card'
import { Alert } from '@/components/ui/alert'
import { FileUploader, DocumentRow, type DocumentRowItem } from '@/components/ui/file-uploader'
import { Modal } from '@/components/ui/modal'
import { Spinner } from '@/components/ui/skeleton'
import { ToneBadge } from '@/components/ui/status-badge'
import { useToast } from '@/components/ui/toast'
import { cn } from '@/lib/utils/cn'
import { STATUS_META, type DocumentType } from '@/lib/constants'
import { uploadDocument, deleteDraftDocument } from '@/lib/actions/documents'
import { submitApplication } from '@/lib/actions/application'
import type { ApplicationRow } from '@/lib/db/stagiaire'

/**
 * SCREEN 7 — Documents + submission.
 *
 * Two things this screen must never do:
 *  1. imply that filling a form submitted the application — the send button is
 *     explicit and opens a confirmation dialog;
 *  2. allow a second submit on double-click — the button disables while the
 *     action runs, and the database function rejects a repeat transition.
 */

type Props = {
  application: ApplicationRow
  documents: DocumentRowItem[]
  /** Which document slots exist, including ones with no file yet. */
  slots: { value: DocumentType; label: string; required: boolean; hint: string }[]
  missingRequired: string[]
}

export function DocumentsManager({ application, documents, slots, missingRequired }: Props) {
  const router = useRouter()
  const toast = useToast()
  const [uploadingType, setUploadingType] = useState<DocumentType | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [submitting, startSubmitting] = useTransition()
  const [deleting, startDeleting] = useTransition()
  const [submitError, setSubmitError] = useState<string | null>(null)

  const isDraft = application.status === 'DRAFT'
  const presentTypes = new Set(documents.filter((d) => d.originalName).map((d) => d.documentType))
  const requiredSlots = slots.filter((s) => s.required)
  const requiredDone = requiredSlots.filter((s) => presentTypes.has(s.value)).length
  const allRequiredPresent = requiredDone === requiredSlots.length

  const handleUpload = async (documentType: DocumentType, file: File) => {
    setUploadingType(documentType)
    const formData = new FormData()
    formData.append('documentType', documentType)
    formData.append('file', file)

    const result = await uploadDocument(formData)
    setUploadingType(null)

    if (!result.ok) {
      toast.error('Téléversement refusé', result.error)
      throw new Error(result.error)
    }

    toast.success('Document ajouté', result.message)
    router.refresh()
  }

  const handleDelete = (documentId: string) => {
    startDeleting(async () => {
      const result = await deleteDraftDocument(documentId)
      if (!result.ok) {
        toast.error('Suppression impossible', result.error)
        return
      }
      toast.success('Document supprimé', result.message)
      router.refresh()
    })
  }

  const handleSubmit = () => {
    setSubmitError(null)
    startSubmitting(async () => {
      const result = await submitApplication()
      if (!result.ok) {
        setSubmitError(result.error)
        toast.error('Envoi impossible', result.error)
        return
      }
      setConfirmOpen(false)
      toast.success('Demande envoyée', result.message)
      router.refresh()
      router.push('/stagiaire/suivi')
    })
  }

  return (
    <>
      {/* ---------------- Header ---------------- */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary-600">
            Votre espace
          </p>
          <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-navy sm:text-[28px]">
            Mes documents
          </h1>
          <p className="mt-2 text-sm text-ink-muted">
            {isDraft
              ? 'Ajoutez les pièces demandées avant d’envoyer votre candidature.'
              : 'Vos pièces justificatives sont enregistrées et verrouillées.'}
          </p>
        </div>
        <span
          className={cn(
            'sf-badge shrink-0',
            application.status === 'DRAFT' && 'border-warning-border bg-warning-bg text-warning',
            application.status === 'SUBMITTED' && 'border-warning-border bg-warning-bg text-warning',
            application.status === 'UNDER_REVIEW' && 'border-info-border bg-info-bg text-info',
            application.status === 'ACCEPTED' && 'border-success-border bg-success-bg text-success',
            application.status === 'REJECTED' && 'border-danger-border bg-danger-bg text-danger',
          )}
        >
          {STATUS_META[application.status].label}
        </span>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          {/* ---------------- Uploader ---------------- */}
          {isDraft ? (
            <Card className="p-5 sm:p-6">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-5">
                <h2 className="text-base font-semibold text-ink">Ajouter des documents</h2>
                <span className="text-xs text-ink-muted">Formats : PDF, PNG, JPG · Max 5 Mo</span>
              </div>

              <p className="sf-label">Quel type de document souhaitez-vous ajouter ?</p>
              <div className="mb-5 flex flex-wrap gap-2">
                {slots.map((slot) => {
                  const present = presentTypes.has(slot.value)
                  const selected = uploadingType === slot.value
                  return (
                    <button
                      key={slot.value}
                      type="button"
                      onClick={() => setUploadingType(selected ? null : slot.value)}
                      aria-pressed={selected}
                      className={cn(
                        'sf-btn sf-btn-sm border',
                        selected
                          ? 'border-primary-600 bg-primary-50 text-primary-700'
                          : 'border-border-strong bg-surface text-ink hover:bg-canvas',
                      )}
                    >
                      {present && (
                        <CheckCircle2 className="h-3.5 w-3.5 text-success" aria-hidden="true" />
                      )}
                      {slot.label}
                      {slot.required && (
                        <span className="text-danger" aria-hidden="true">
                          *
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>

              {uploadingType ? (
                <FileUploader
                  key={uploadingType}
                  onUpload={(file) => handleUpload(uploadingType, file)}
                  label={`Déposez votre « ${
                    slots.find((s) => s.value === uploadingType)?.label ?? 'document'
                  } » ici`}
                />
              ) : (
                <Alert variant="info">
                  Sélectionnez d’abord le type de document à ajouter. Chaque emplacement accepte un
                  seul fichier : un nouvel envoi remplace le précédent.
                </Alert>
              )}
            </Card>
          ) : (
            <Alert variant="info" title="Dossier verrouillé">
              Votre demande a été envoyée. Les documents ne peuvent plus être modifiés ni supprimés.
              Contactez l’administration si un justificatif doit être remplacé.
            </Alert>
          )}

          {/* ---------------- Document list ---------------- */}
          <Card>
            <CardHeader
              title="Documents de ma demande"
              action={
                <span className="text-sm font-medium text-ink-muted">
                  {presentTypes.size} fichier{presentTypes.size > 1 ? 's' : ''} ajouté
                  {presentTypes.size > 1 ? 's' : ''}
                </span>
              }
            />
            <ul className="px-5 pb-5 sm:px-6 sm:pb-6">
              {documents.map((doc) => (
                <DocumentRow
                  key={doc.id}
                  item={doc}
                  canDelete={isDraft}
                  busy={deleting}
                  onDelete={() => handleDelete(doc.id)}
                />
              ))}
            </ul>
          </Card>
        </div>

        {/* ---------------- Readiness panel ---------------- */}
        <aside className="space-y-5">
          <Card className="p-5">
            <p className="flex items-center gap-2 text-base font-semibold text-ink">
              <CheckCircle2 className="h-4 w-4 text-primary-600" aria-hidden="true" />
              {isDraft ? 'Prêt à envoyer ?' : 'Demande envoyée'}
            </p>
            <p className="mt-2 text-xs leading-relaxed text-ink-muted">
              {isDraft
                ? 'Vérifiez que vos informations sont correctes et que les pièces nécessaires sont jointes. Une fois soumise, votre demande sera transmise à l’administration.'
                : 'Votre dossier est en cours de traitement. Vous serez notifié de la décision.'}
            </p>

            <ul className="mt-5 divide-y divide-border">
              {[
                {
                  label: 'Informations du stage',
                  state:
                    application.stage_type && application.domain && application.motivation.length >= 50
                      ? 'complete'
                      : 'incomplete',
                },
                {
                  label: 'Informations académiques',
                  state:
                    application.school && application.program && application.study_level
                      ? 'complete'
                      : 'incomplete',
                },
                {
                  label: 'Documents',
                  state: allRequiredPresent ? 'complete' : 'partial',
                  detail: `${requiredDone} / ${requiredSlots.length}`,
                },
              ].map((row) => (
                <li key={row.label} className="flex items-center justify-between gap-3 py-3">
                  <span className="text-[13px] text-ink">{row.label}</span>
                  {row.state === 'complete' ? (
                    <ToneBadge tone="success" size="sm">
                      Complètes
                    </ToneBadge>
                  ) : row.state === 'partial' ? (
                    <ToneBadge tone="warning" size="sm">
                      {row.detail}
                    </ToneBadge>
                  ) : (
                    <ToneBadge tone="danger" size="sm">
                      À compléter
                    </ToneBadge>
                  )}
                </li>
              ))}
            </ul>

            {isDraft && (
              <div className="mt-5 space-y-2.5">
                <button
                  type="button"
                  onClick={() => setConfirmOpen(true)}
                  disabled={!allRequiredPresent || submitting}
                  className="sf-btn-primary w-full"
                >
                  <Send className="h-4 w-4" aria-hidden="true" />
                  Envoyer la demande
                </button>

                {!allRequiredPresent && (
                  <p className="flex items-start gap-1.5 text-xs text-warning">
                    <Info className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    Ajoutez les documents obligatoires ({missingRequired.join(', ')}) pour pouvoir
                    envoyer votre demande.
                  </p>
                )}

                <Link href="/stagiaire/demande" className="sf-btn-secondary w-full">
                  <Save className="h-4 w-4" aria-hidden="true" />
                  Modifier ma demande
                </Link>
              </div>
            )}

            {!isDraft && (
              <Link href="/stagiaire/suivi" className="sf-btn-secondary mt-5 w-full">
                Voir le suivi de ma demande
              </Link>
            )}
          </Card>

          <div className="rounded-card border border-border bg-canvas p-4">
            <p className="flex items-start gap-2 text-xs leading-relaxed text-ink-muted">
              <ShieldCheck className="mt-px h-3.5 w-3.5 shrink-0 text-ink-subtle" aria-hidden="true" />
              Vos documents sont stockés dans un espace privé. Ils ne sont accessibles qu’à vous et
              aux personnes chargées de l’étude de votre dossier.
            </p>
          </div>
        </aside>
      </div>

      {/* ---------------- Submission confirmation ---------------- */}
      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Envoyer votre demande de stage ?"
        description="Cette action est définitive dans le cadre de la procédure actuelle."
        busy={submitting}
        footer={
          <>
            <button
              type="button"
              onClick={() => setConfirmOpen(false)}
              disabled={submitting}
              className="sf-btn-secondary"
            >
              <X className="h-4 w-4" aria-hidden="true" />
              Annuler
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="sf-btn-primary"
            >
              {submitting ? <Spinner /> : <Send className="h-4 w-4" aria-hidden="true" />}
              Confirmer et envoyer
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <ul className="divide-y divide-border rounded-control border border-border">
            {[
              ['Type de stage', application.stage_type || '—'],
              ['Domaine', application.domain || '—'],
              ['Établissement', application.school || '—'],
              ['Formation', application.program || '—'],
              ['Documents requis', `${requiredDone} / ${requiredSlots.length}`],
            ].map(([label, value]) => (
              <li key={label} className="flex justify-between gap-4 px-4 py-3">
                <span className="text-[13px] text-ink-muted">{label}</span>
                <span className="text-right text-[13px] font-semibold text-ink">{value}</span>
              </li>
            ))}
          </ul>

          <Alert variant="warning">
            Après l’envoi, votre demande devient <strong>non modifiable</strong>. Assurez-vous que
            toutes les informations et pièces jointes sont correctes.
          </Alert>

          {submitError && (
            <Alert variant="error">
              <span className="flex items-start gap-2">
                <XCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                {submitError}
              </span>
            </Alert>
          )}
        </div>
      </Modal>
    </>
  )
}
