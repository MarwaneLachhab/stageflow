import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { FileText, Send } from 'lucide-react'
import { Alert } from '@/components/ui/alert'
import { EmptyState } from '@/components/ui/empty-state'
import { DocumentsManager } from '@/components/stagiaire/documents-manager'
import { getSessionUser } from '@/lib/auth/session'
import { getCurrentApplication, getApplicationDocuments } from '@/lib/db/stagiaire'
import { DOCUMENT_TYPES, REQUIRED_DOCUMENT_TYPES } from '@/lib/constants'
import type { DocumentRowItem } from '@/components/ui/file-uploader'

export const metadata: Metadata = { title: 'Mes documents' }

/**
 * SCREEN 7 — documents & submission shell.
 *
 * The server is the only place that decides what is "required" and what is
 * already present; the client component receives the finished slot list. This
 * keeps a single source of truth and means a tampered client cannot make the
 * UI believe a missing document is present (the RPC re-checks on submit
 * regardless — see submit_application()).
 */
export default async function DocumentsPage() {
  const user = await getSessionUser()
  if (!user) redirect('/connexion')

  const application = await getCurrentApplication(user.id)

  // No request yet: sending someone to an empty uploader would be confusing,
  // so point them at the wizard that creates the draft.
  if (!application) {
    return (
      <EmptyState
        icon={<FileText className="h-7 w-7" />}
        title="Aucune demande en cours"
        description="Créez d’abord votre demande de stage : vous pourrez ensuite y joindre vos pièces justificatives."
        action={
          <Link href="/stagiaire/demande" className="sf-btn sf-btn-primary">
            <Send className="h-4 w-4" aria-hidden="true" />
            Créer ma demande
          </Link>
        }
      />
    )
  }

  const documents = await getApplicationDocuments(application.id)

  const uploadedByType = new Map(documents.map((doc) => [doc.document_type, doc]))

  // One row per declared slot, so an empty mandatory slot is visible as a
  // missing item rather than simply absent from the list.
  const rows: DocumentRowItem[] = DOCUMENT_TYPES.map((slot) => {
    const doc = uploadedByType.get(slot.value)
    return {
      id: doc?.id ?? `slot-${slot.value}`,
      documentType: slot.value,
      label: slot.label,
      originalName: doc?.original_name ?? null,
      bytes: doc?.bytes ?? null,
      uploadedAt: doc?.created_at ?? null,
      downloadHref: doc ? `/api/documents/${doc.id}` : null,
    }
  })

  const presentTypes = new Set(documents.map((doc) => doc.document_type))
  const missingRequired = REQUIRED_DOCUMENT_TYPES.filter((type) => !presentTypes.has(type)).map(
    (type) => DOCUMENT_TYPES.find((d) => d.value === type)?.label ?? type,
  )

  const isDraft = application.status === 'DRAFT'

  return (
    <>
      {!isDraft && (
        <Alert variant="info" className="mb-6" title="Dossier verrouillé">
          Votre demande a été envoyée le{' '}
          {application.submitted_at
            ? new Date(application.submitted_at).toLocaleDateString('fr-FR')
            : '—'}
          . Les pièces justificatives ne peuvent plus être modifiées. Contactez l’administration si
          un document doit être remplacé.
        </Alert>
      )}

      <DocumentsManager
        application={application}
        documents={rows}
        slots={DOCUMENT_TYPES.map((d) => ({
          value: d.value,
          label: d.label,
          required: d.required,
          hint: d.hint,
        }))}
        missingRequired={missingRequired}
      />
    </>
  )
}
