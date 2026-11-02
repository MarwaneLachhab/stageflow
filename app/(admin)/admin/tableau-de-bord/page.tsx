import type { Metadata } from 'next'
import Link from 'next/link'
import {
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Clock,
  FileText,
  Inbox,
  TrendingUp,
  Users,
  XCircle,
} from 'lucide-react'
import { Alert } from '@/components/ui/alert'
import { Card, CardSectionTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { PageHeader } from '@/components/ui/page-header'
import { StatCard } from '@/components/ui/stat-card'
import { StatusBadge } from '@/components/ui/status-badge'
import { Avatar } from '@/components/ui/avatar'
import {
  MonthlyApplicationsChart,
  StatusDistributionChart,
} from '@/components/admin/dashboard-charts'
import { getAdminStats } from '@/lib/db/admin'
import { formatDateShort, fullName, initials } from '@/lib/utils/format'
import { STATUS_META } from '@/lib/constants'

export const metadata: Metadata = { title: 'Tableau de bord — Administration' }

/**
 * SCREEN 9 — admin dashboard.
 *
 * Every number on this page comes from `get_admin_stats()`, a single
 * SECURITY DEFINER aggregation that calls `is_admin()` internally. Nothing is
 * hard-coded and nothing is mocked: on an empty database the tiles honestly
 * read 0 and the charts show an explanatory empty state.
 */
export default async function AdminDashboardPage() {
  const stats = await getAdminStats()

  const hasApplications = stats.totalApplications > 0

  const distribution = [
    { name: STATUS_META.SUBMITTED.shortLabel, value: stats.submitted },
    { name: STATUS_META.UNDER_REVIEW.shortLabel, value: stats.underReview },
    { name: STATUS_META.ACCEPTED.shortLabel, value: stats.accepted },
    { name: STATUS_META.REJECTED.shortLabel, value: stats.rejected },
    { name: STATUS_META.DRAFT.shortLabel, value: stats.drafts },
  ].filter((entry) => entry.value > 0)

  const pending = stats.submitted + stats.underReview

  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="Tableau de bord"
        description="Vue d’ensemble des demandes de stage, du volume de candidatures et de leur avancement."
        action={
          <Link href="/admin/demandes" className="sf-btn sf-btn-primary">
            <ClipboardList className="h-4 w-4" aria-hidden="true" />
            Gérer les demandes
          </Link>
        }
      />

      {!hasApplications && (
        <Alert variant="info" className="mb-6" title="Aucune candidature pour le moment">
          La base ne contient encore aucune demande de stage. Les indicateurs et les graphiques
          ci-dessous s’alimenteront automatiquement dès les premières candidatures.
        </Alert>
      )}

      {/* ---------------- KPI row ---------------- */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Demandes totales"
          value={stats.totalApplications}
          caption={`${stats.totalApplicants} candidat${stats.totalApplicants > 1 ? 's' : ''} inscrit${stats.totalApplicants > 1 ? 's' : ''}`}
          icon={<FileText className="h-5 w-5" />}
          tone="primary"
          href="/admin/demandes"
        />
        <StatCard
          label="En attente de traitement"
          value={pending}
          caption="Envoyées ou en cours d’examen"
          icon={<Clock className="h-5 w-5" />}
          tone="warning"
          href="/admin/demandes?status=SUBMITTED"
        />
        <StatCard
          label="Acceptées"
          value={stats.accepted}
          caption="Dossiers validés"
          icon={<CheckCircle2 className="h-5 w-5" />}
          tone="success"
          href="/admin/demandes?status=ACCEPTED"
        />
        <StatCard
          label="Refusées"
          value={stats.rejected}
          caption="Dossiers non retenus"
          icon={<XCircle className="h-5 w-5" />}
          tone="danger"
          href="/admin/demandes?status=REJECTED"
        />
      </div>

      {/* ---------------- Charts ---------------- */}
      <div className="mt-6 grid gap-6 xl:grid-cols-[1.55fr_1fr]">
        <Card className="p-5 sm:p-6">
          <CardSectionTitle className="mb-4 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary-600" aria-hidden="true" />
            Volume de candidatures par mois
          </CardSectionTitle>
          <MonthlyApplicationsChart data={stats.monthly} />
        </Card>

        <Card className="p-5 sm:p-6">
          <CardSectionTitle className="mb-4">Répartition par statut</CardSectionTitle>
          <StatusDistributionChart data={distribution} />
        </Card>
      </div>

      {/* ---------------- Recent activity ---------------- */}
      <Card className="mt-6 p-5 sm:p-6">
        <CardSectionTitle className="mb-1">Dernières demandes reçues</CardSectionTitle>
        <p className="mb-4 text-[13px] text-ink-muted">
          Les cinq candidatures les plus récentes, tous statuts confondus.
        </p>

        {stats.recent.length === 0 ? (
          <EmptyState
            icon={<Inbox className="h-7 w-7" />}
            title="Aucune demande récente"
            description="Les nouvelles candidatures apparaîtront ici dès leur création."
            tone="neutral"
          />
        ) : (
          <ul className="divide-y divide-border">
            {stats.recent.map((row) => (
              <li key={row.id}>
                <Link
                  href={`/admin/demandes/${row.id}`}
                  className="-mx-2 flex items-center gap-3.5 rounded-control px-2 py-3.5 transition-colors hover:bg-canvas"
                >
                  <Avatar
                    initials={initials(row.firstName, row.lastName)}
                    size="sm"
                    className="shrink-0"
                  />

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">
                      {fullName(row.firstName, row.lastName)}
                    </p>
                    <p className="mt-0.5 truncate text-[13px] text-ink-muted">
                      {row.stageType}
                      {row.program ? ` · ${row.program}` : ''}
                    </p>
                  </div>

                  <div className="hidden shrink-0 text-right sm:block">
                    <p className="text-2xs text-ink-subtle">Reçue le</p>
                    <p className="text-[13px] font-medium text-ink-muted">
                      {formatDateShort(row.createdAt)}
                    </p>
                  </div>

                  <StatusBadge status={row.status} variant="short" size="sm" className="shrink-0" />
                  <ArrowRight
                    aria-hidden="true"
                    className="hidden h-4 w-4 shrink-0 text-ink-faint sm:block"
                  />
                </Link>
              </li>
            ))}
          </ul>
        )}

        {stats.recent.length > 0 && (
          <div className="mt-4 border-t border-border pt-4">
            <Link href="/admin/demandes" className="sf-btn sf-btn-secondary sf-btn-sm">
              Voir toutes les demandes
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>
        )}
      </Card>

      {/* ---------------- Secondary KPIs ---------------- */}
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Brouillons non envoyés"
          value={stats.drafts}
          caption="Candidats n’ayant pas finalisé"
          icon={<FileText className="h-5 w-5" />}
          tone="neutral"
        />
        <StatCard
          label="Candidats inscrits"
          value={stats.totalApplicants}
          caption="Comptes stagiaires actifs"
          icon={<Users className="h-5 w-5" />}
          tone="info"
        />
        <StatCard
          label="Taux d’acceptation"
          value={
            stats.accepted + stats.rejected > 0
              ? `${Math.round((stats.accepted / (stats.accepted + stats.rejected)) * 100)} %`
              : '—'
          }
          caption={
            stats.accepted + stats.rejected > 0
              ? `Sur ${stats.accepted + stats.rejected} décision${stats.accepted + stats.rejected > 1 ? 's' : ''} rendue${stats.accepted + stats.rejected > 1 ? 's' : ''}`
              : 'Aucune décision rendue'
          }
          icon={<CheckCircle2 className="h-5 w-5" />}
          tone="success"
        />
      </div>
    </>
  )
}
