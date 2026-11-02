import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, BarChart3, TrendingUp } from 'lucide-react'
import { Alert } from '@/components/ui/alert'
import { Card, CardSectionTitle } from '@/components/ui/card'
import { PageHeader } from '@/components/ui/page-header'
import { StatCard } from '@/components/ui/stat-card'
import {
  ApplicationsBarChart,
  MonthlyApplicationsChart,
  StatusDistributionChart,
} from '@/components/admin/dashboard-charts'
import { getAdminStats, listAdminApplications } from '@/lib/db/admin'
import { adminListQuerySchema } from '@/lib/validation/schemas'
import { STATUS_META } from '@/lib/constants'

export const metadata: Metadata = { title: 'Statistiques — Administration' }

/**
 * Statistiques — aggregate view over the real data set.
 *
 * The per-formation breakdown is derived from the SAME bounded, admin-gated
 * search used by the list screen: we ask the database for the largest page it
 * will serve (25 rows) rather than shipping the whole table to the server
 * process. The caption states that explicitly, so the chart is never read as a
 * claim about every single application when the corpus exceeds that window.
 */
export default async function AdminStatsPage() {
  const [stats, topFormations] = await Promise.all([
    getAdminStats(),
    listAdminApplications(adminListQuerySchema.parse({ pageSize: 25, sort: 'created_at' })),
  ])

  const hasData = stats.totalApplications > 0

  /** Count by formation within the sampled window. */
  const formationCounts = new Map<string, number>()
  for (const row of topFormations.rows) {
    const key = row.program?.trim() || row.school?.trim() || 'Non renseigné'
    formationCounts.set(key, (formationCounts.get(key) ?? 0) + 1)
  }

  const formationData = Array.from(formationCounts.entries())
    .map(([name, value]) => ({
      name: name.length > 16 ? `${name.slice(0, 15)}…` : name,
      value,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8)

  const stageTypeCounts = new Map<string, number>()
  for (const row of topFormations.rows) {
    const key = row.stageType?.trim() || 'Non précisé'
    stageTypeCounts.set(key, (stageTypeCounts.get(key) ?? 0) + 1)
  }

  const stageTypeData = Array.from(stageTypeCounts.entries())
    .map(([name, value]) => ({
      name: name.length > 16 ? `${name.slice(0, 15)}…` : name,
      value,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8)

  const distribution = [
    { name: STATUS_META.SUBMITTED.shortLabel, value: stats.submitted },
    { name: STATUS_META.UNDER_REVIEW.shortLabel, value: stats.underReview },
    { name: STATUS_META.ACCEPTED.shortLabel, value: stats.accepted },
    { name: STATUS_META.REJECTED.shortLabel, value: stats.rejected },
    { name: STATUS_META.DRAFT.shortLabel, value: stats.drafts },
  ].filter((entry) => entry.value > 0)

  const decisions = stats.accepted + stats.rejected
  const acceptanceRate = decisions > 0 ? Math.round((stats.accepted / decisions) * 100) : null
  const processingRate =
    stats.totalApplications > 0
      ? Math.round(((stats.underReview + decisions) / stats.totalApplications) * 100)
      : null

  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="Statistiques"
        description="Répartition et évolution des demandes de stage, calculées en direct sur la base de données."
      />

      {!hasData && (
        <Alert variant="info" className="mb-6" title="Aucune donnée statistique">
          La base ne contient encore aucune demande. Les graphiques ci-dessous resteront vides
          jusqu’à la première candidature — aucune valeur de démonstration n’est affichée.
        </Alert>
      )}

      {/* ---------------- Headline indicators ---------------- */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Demandes reçues"
          value={stats.totalApplications}
          caption={`${stats.totalApplicants} candidat${stats.totalApplicants > 1 ? 's' : ''}`}
          icon={<BarChart3 className="h-5 w-5" />}
          tone="primary"
        />
        <StatCard
          label="Taux d’acceptation"
          value={acceptanceRate === null ? '—' : `${acceptanceRate} %`}
          caption={
            decisions > 0
              ? `${stats.accepted} acceptée${stats.accepted > 1 ? 's' : ''} sur ${decisions} décision${decisions > 1 ? 's' : ''}`
              : 'Aucune décision rendue'
          }
          icon={<TrendingUp className="h-5 w-5" />}
          tone="success"
        />
        <StatCard
          label="En attente de traitement"
          value={stats.submitted + stats.underReview}
          caption="Dossiers non clôturés"
          icon={<BarChart3 className="h-5 w-5" />}
          tone="warning"
        />
        <StatCard
          label="Taux de traitement"
          value={processingRate === null ? '—' : `${processingRate} %`}
          caption="Dossiers examinés ou décidés"
          icon={<TrendingUp className="h-5 w-5" />}
          tone="info"
        />
      </div>

      {/* ---------------- Evolution ---------------- */}
      <Card className="mt-6 p-5 sm:p-6">
        <CardSectionTitle className="mb-1 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary-600" aria-hidden="true" />
          Évolution mensuelle des candidatures
        </CardSectionTitle>
        <p className="mb-4 text-[13px] text-ink-muted">
          Nombre de demandes créées pour chacun des douze derniers mois.
        </p>
        <MonthlyApplicationsChart data={stats.monthly} />
      </Card>

      {/* ---------------- Breakdowns ---------------- */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card className="p-5 sm:p-6">
          <CardSectionTitle className="mb-1">Répartition par statut</CardSectionTitle>
          <p className="mb-4 text-[13px] text-ink-muted">
            Proportion de chaque étape du cycle de vie sur l’ensemble des demandes.
          </p>
          <StatusDistributionChart data={distribution} />
        </Card>

        <Card className="p-5 sm:p-6">
          <CardSectionTitle className="mb-1">Demandes par formation</CardSectionTitle>
          <p className="mb-4 text-[13px] text-ink-muted">
            Répartition sur les {topFormations.rows.length} demandes les plus récentes prises en
            compte pour ce calcul.
          </p>
          <ApplicationsBarChart
            data={formationData}
            emptyMessage="Aucune formation renseignée dans les demandes enregistrées."
          />
        </Card>
      </div>

      <Card className="mt-6 p-5 sm:p-6">
        <CardSectionTitle className="mb-1">Demandes par type de stage</CardSectionTitle>
        <p className="mb-4 text-[13px] text-ink-muted">
          Même fenêtre d’observation que le graphique précédent.
        </p>
        <ApplicationsBarChart
          data={stageTypeData}
          emptyMessage="Aucun type de stage enregistré pour le moment."
        />
      </Card>

      <div className="mt-6">
        <Link href="/admin/demandes" className="sf-btn sf-btn-secondary sf-btn-sm">
          Consulter la liste détaillée des demandes
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </div>
    </>
  )
}
