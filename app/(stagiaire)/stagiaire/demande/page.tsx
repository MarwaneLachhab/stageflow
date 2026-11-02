import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { ApplicationWizard } from '@/components/stagiaire/application-wizard'
import { getSessionUser } from '@/lib/auth/session'
import { getCurrentApplication, getApplicationDocuments, getOwnProfile } from '@/lib/db/stagiaire'
import { REQUIRED_DOCUMENT_TYPES, DOCUMENT_TYPES } from '@/lib/constants'

export const metadata: Metadata = { title: 'Ma demande' }

/**
 * SCREEN 6 — the wizard shell.
 *
 * The data fetch happens on the server so the form arrives already populated
 * with the persisted draft (resume behaviour) instead of flashing empty fields.
 */
export default async function DemandePage() {
  const user = await getSessionUser()
  if (!user) redirect('/connexion')

  const [application, profile] = await Promise.all([
    getCurrentApplication(user.id),
    getOwnProfile(user.id),
  ])

  const documents = application ? await getApplicationDocuments(application.id) : []
  const present = new Set(documents.map((d) => d.document_type))
  const missing = REQUIRED_DOCUMENT_TYPES.filter((t) => !present.has(t))
  const documentsComplete = missing.length === 0

  const missingLabels = missing.map(
    (type) => DOCUMENT_TYPES.find((d) => d.value === type)?.label ?? type,
  )

  return (
    <ApplicationWizard
      application={application}
      profile={profile}
      documentsComplete={documentsComplete}
      missingDocuments={missingLabels}
    />
  )
}
