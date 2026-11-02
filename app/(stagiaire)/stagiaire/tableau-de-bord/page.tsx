import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  FileText,
  FolderOpen,
  Sparkles,
  User,
} from 'lucide-react'
import { Card, CardHeader } from '@/components/ui/card'
import { PageHeader } from '@/components/ui/page-header'
import { StatCard } from '@/components/ui/stat-card'
import { EmptyState } from '@/components/ui/empty-state'
import { Alert } from '@/components/ui/alert'
import { ProgressTimeline } from '@/components/stagiaire/progress-timeline'
import { ActivityFeed } from '@/components/stagiaire/activity-feed'
import { StatusPanel } from '@/components/stagiaire/status-panel'
import { TileCard } from '@/components/stagiaire/tile-card'
import { getSessionUser } from '@/lib/auth/session'
import {
  getCurrentApplication,
  getApplicationDocuments,
  getApplicationHistory,
  getOwnProfile,
} from '@/lib/db/stagiaire'
import { REQUIRED_DOCUMENT_TYPES, STATUS_META } from '@/lib/constants'
import { formatRelative } from '@/lib/utils/format'

export const metadata: Metadata = { title: 'Tableau de bord' }

/**
 * SCREEN 4 — Stagiaire dashboard.
 *
 * Every value shown here is read from the database for the authenticated user.
 * There are no fixtures: a brand-new account sees `Vous n'avez pas encore créé
 * de demande`, a draft sees `Reprendre mon brouillon`, and a submitted request
 * shows its real status and event history.
 */
export default async function StagiaireDashboardPage() {
  const user = await getSessionUser()
  if (!user) redirect('/connexion')

  const [profile, application] = await Promise.all([
    getOwnProfile(user.id),
    getCurrentApplication(user.id),
  ])

  const [documents, history] = application
    ? await Promise.all([
        getApplicationDocuments(application.id),
        getApplicationHistory(application.id),
      ])
    : [[], []]

  const presentTypes = new Set(documents.map((d) => d.document_type))
  const missingRequired = REQUIRED_DOCUMENT_TYPES.filter((t) => !presentTypes.has(t))
  const firstName = profile?.first_name || 'Stagiaire'

  const statMeta = application ? STATUS_META[application.status] : null

  return (
    <>
      <PageHeader
        eyebrow="Votre espace"
        title={
          <>
            Bonjour {firstName} <span aria-hidden="true">👋</span>
          </>
        }
        description="Voici un aperçu de votre candidature et des prochaines étapes."
        action={
          <Link href="/stagiaire/suivi" className="sf-btn-secondary">
            <FileText className="h-4 w-4" aria-hidden="true" />
            Voir ma demande
          </Link>
        }
      />

      {!user.emailConfirmed && (
        <Alert variant="warning" title="Adresse e-mail non confirmée" className="mb-6">
          Vérifiez votre boîte de réception et cliquez sur le lien de confirmation pour sécuriser
          votre compte.{' '}
          <Link href="/verification-email" className="font-semibold underline underline-offset-2">
            Renvoyer l’e-mail
          </Link>
        </Alert>
      )}

      {/* ---------------- Status panel ---------------- */}
      {application ? (
        <StatusPanel
          status={application.status}
          applicationId={application.id}
          updatedAt={application.updated_at}
        />
      ) : (
        <Card className="mb-6">
          <EmptyState
            icon={<FileText className="h-7 w-7" />}
            title="Vous n’avez pas encore créé de demande"
            description="Complétez votre dossier de stage : informations du stage, informations académiques puis vos documents. Rien n’est transmis tant que vous n’avez pas cliqué sur « Envoyer la demande »."
            action={
              <Link href="/stagiaire/demande" className="sf-btn-primary">
                Créer une demande
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            }
          />
        </Card>
      )}

      {/* ---------------- Quick metrics ---------------- */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Statut de ma demande"
          value={statMeta ? statMeta.shortLabel : 'Aucune'}
          caption={application ? undefined : 'Aucune demande pour le moment'}
          icon={<Sparkles className="h-4 w-4" />}
          tone={statMeta?.tone ?? 'neutral'}
        />
        <StatCard
          label="Documents requis"
          value={`${REQUIRED_DOCUMENT_TYPES.length - missingRequired.length} / ${REQUIRED_DOCUMENT_TYPES.length}`}
          caption={
            missingRequired.length === 0
              ? 'Dossier complet'
              : `${missingRequired.length} document(s) manquant(s)`
          }
          icon={<FolderOpen className="h-4 w-4" />}
          tone={missingRequired.length === 0 ? 'success' : 'warning'}
        />
        <StatCard
          label="Documents déposés"
          value={documents.length}
          caption="Pièces jointes à votre dossier"
          icon={<CheckCircle2 className="h-4 w-4" />}
          tone="success"
        />
        <StatCard
          label="Dernière activité"
          value={history.length > 0 ? formatRelative(history[history.length - 1]!.created_at) : '—'}
          caption="Événements enregistrés"
          icon={<Clock className="h-4 w-4" />}
          tone="info"
        />
      </div>

      {/* ---------------- Quick access ---------------- */}
      <h2 className="mb-4 text-base font-semibold text-ink">Accès rapide</h2>
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <TileCard
          href="/stagiaire/profil"
          icon={<User className="h-4 w-4" />}
          title="Mon profil"
          description="Consulter et modifier mes informations."
          tone="primary"
        />
        <TileCard
          href="/stagiaire/demande"
          icon={<FileText className="h-4 w-4" />}
          title="Ma demande"
          description="Informations de stage et formation."
          tone="warning"
        />
        <TileCard
          href="/stagiaire/documents"
          icon={<FolderOpen className="h-4 w-4" />}
          title="Mes documents"
          description="Gérer mes pièces justificatives."
          tone="success"
        />
      </div>

      {/* ---------------- Timeline + activity ---------------- */}
      {application && (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader
              title="Prochaines étapes"
              action={
                <Link
                  href="/stagiaire/suivi"
                  className="text-sm font-semibold text-primary-600 hover:underline"
                >
                  Voir le suivi
                </Link>
              }
            />
            <div className="px-5 pb-5 sm:px-6 sm:pb-6">
              <ProgressTimeline
                status={application.status}
                submittedAt={application.submitted_at}
                reviewedAt={application.reviewed_at}
                decidedAt={application.decided_at}
              />
              <p className="mt-5 text-xs leading-relaxed text-ink-muted">
                Votre dossier progresse. Un avis apparaîtra ici dès que l’équipe aura pris sa
                décision.
              </p>
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Activité récente"
              action={
                <Link
                  href="/stagiaire/suivi"
                  className="text-sm font-semibold text-primary-600 hover:underline"
                >
                  Tout voir
                </Link>
              }
            />
            <div className="px-5 pb-5 sm:px-6 sm:pb-6">
              <ActivityFeed
                items={[...history].reverse().slice(0, 4).map((entry) => ({
                  id: entry.id,
                  status: entry.to_status,
                  note: entry.public_note,
                  createdAt: entry.created_at,
                }))}
              />
            </div>
          </Card>
        </div>
      )}

      {application?.status === 'DRAFT' && (
        <Alert variant="info" className="mt-6">
          <span className="font-semibold">Votre demande est enregistrée en brouillon.</span>{' '}
          Enregistrer un formulaire ne signifie pas que la demande a été envoyée : finalisez-la
          depuis{' '}
          <Link href="/stagiaire/documents" className="font-semibold underline underline-offset-2">
            Mes documents
          </Link>
          .
        </Alert>
      )}

      {!application && (
        <Alert variant="info" className="mt-6">
          <span className="font-semibold">Première visite ?</span> Commencez par compléter votre
          profil académique : ces informations prérempliront automatiquement votre demande de stage.
        </Alert>
      )}
    </>
  )
}
