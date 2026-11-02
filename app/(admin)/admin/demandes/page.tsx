import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, ClipboardList, Inbox, Paperclip } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Avatar } from '@/components/ui/avatar'
import { EmptyState } from '@/components/ui/empty-state'
import { PageHeader } from '@/components/ui/page-header'
import { Pagination } from '@/components/ui/pagination'
import { StatusBadge } from '@/components/ui/status-badge'
import { AdminFilters } from '@/components/admin/admin-filters'
import { listAdminApplications, getDistinctFormations, getDistinctStageTypes } from '@/lib/db/admin'
import { adminListQuerySchema } from '@/lib/validation/schemas'
import { formatDateShort, fullName, initials, computeDurationLabel } from '@/lib/utils/format'

export const metadata: Metadata = { title: 'Demandes de stage — Administration' }

type SearchParams = Record<string, string | string[] | undefined>

/** Collapse `?a=1&a=2` into `?a=2` so parsing never receives an array. */
function firstValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[value.length - 1]
  return value
}

/**
 * SCREEN 10 — all applications.
 *
 * SECURITY NOTE: the search term is passed to a parameterised SQL function
 * (`search_admin_applications`), never concatenated into a query string. The
 * function also applies `is_admin()` internally and clamps `p_limit` to 25, so
 * a crafted `?pageSize=100000` cannot be used to exfiltrate the whole table.
 *
 * Invalid query parameters are NOT a 500: Zod falls back to its defaults, so a
 * hand-edited URL renders a sane, unfiltered list.
 */
export default async function AdminApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const raw = await searchParams

  const parsed = adminListQuerySchema.safeParse({
    q: firstValue(raw.q),
    status: firstValue(raw.status),
    formation: firstValue(raw.formation),
    stageType: firstValue(raw.stageType),
    dateFrom: firstValue(raw.dateFrom),
    dateTo: firstValue(raw.dateTo),
    sort: firstValue(raw.sort),
    dir: firstValue(raw.dir),
    page: firstValue(raw.page),
    pageSize: firstValue(raw.pageSize),
  })

  // Defaults are guaranteed present by `.default()`, so this branch is only
  // reachable if a value violates a bound (e.g. pageSize=999).
  const query = parsed.success ? parsed.data : adminListQuerySchema.parse({})

  const [result, formations, stageTypes] = await Promise.all([
    listAdminApplications(query),
    getDistinctFormations(),
    getDistinctStageTypes(),
  ])

  const isFiltered =
    Boolean(query.q) ||
    query.status !== 'ALL' ||
    Boolean(query.formation) ||
    Boolean(query.stageType) ||
    Boolean(query.dateFrom) ||
    Boolean(query.dateTo)

  /** Preserve every active filter when moving between pages. */
  const buildHref = (page: number) => {
    const params = new URLSearchParams()
    if (query.q) params.set('q', query.q)
    if (query.status !== 'ALL') params.set('status', query.status)
    if (query.formation) params.set('formation', query.formation)
    if (query.stageType) params.set('stageType', query.stageType)
    if (query.dateFrom) params.set('dateFrom', query.dateFrom)
    if (query.dateTo) params.set('dateTo', query.dateTo)
    params.set('pageSize', String(query.pageSize))
    if (page > 1) params.set('page', String(page))
    const qs = params.toString()
    return qs ? `/admin/demandes?${qs}` : '/admin/demandes'
  }

  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="Toutes les demandes"
        description="Recherchez, filtrez et traitez les demandes de stage reçues. Cliquez sur une ligne pour ouvrir le dossier complet."
      />

      <Card className="overflow-hidden">
        <AdminFilters
          formations={formations.map((value) => ({ value, label: value }))}
          stageTypes={stageTypes.map((value) => ({ value, label: value }))}
        />

        {result.rows.length === 0 ? (
          <EmptyState
            icon={<Inbox className="h-7 w-7" />}
            title={isFiltered ? 'Aucun résultat' : 'Aucune demande enregistrée'}
            description={
              isFiltered
                ? 'Aucune demande ne correspond aux critères sélectionnés. Essayez d’élargir la recherche ou de réinitialiser les filtres.'
                : 'Les demandes de stage apparaîtront ici dès que des candidats auront soumis leur dossier.'
            }
            tone={isFiltered ? 'neutral' : 'primary'}
          />
        ) : (
          <>
            {/* ---------------- Desktop / tablet table ---------------- */}
            <div className="hidden overflow-x-auto md:block">
              <table className="sf-table">
                <caption className="sf-sr-only">
                  Liste des demandes de stage, triée et filtrée selon les critères sélectionnés.
                </caption>
                <thead>
                  <tr>
                    <th scope="col" className="sf-th">Candidat</th>
                    <th scope="col" className="sf-th">Formation</th>
                    <th scope="col" className="sf-th">Type de stage</th>
                    <th scope="col" className="sf-th">Période</th>
                    <th scope="col" className="sf-th">Reçue le</th>
                    <th scope="col" className="sf-th">Statut</th>
                    <th scope="col" className="sf-th text-right">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((row) => (
                    <tr key={row.id} className="group transition-colors hover:bg-canvas">
                      <td className="sf-td">
                        <Link
                          href={`/admin/demandes/${row.id}`}
                          className="flex items-center gap-3 focus-visible:outline-none"
                        >
                          <Avatar
                            initials={initials(row.firstName, row.lastName)}
                            size="sm"
                            className="shrink-0"
                          />
                          <span className="min-w-0">
                            <span className="block truncate font-semibold text-ink group-hover:text-primary-700">
                              {fullName(row.firstName, row.lastName)}
                            </span>
                            <span className="mt-0.5 flex items-center gap-1 text-2xs text-ink-subtle">
                              <Paperclip className="h-3 w-3" aria-hidden="true" />
                              {row.documentCount} document{row.documentCount > 1 ? 's' : ''}
                            </span>
                          </span>
                        </Link>
                      </td>

                      <td className="sf-td">
                        <span className="block max-w-[190px] truncate">
                          {row.program ?? row.school ?? '—'}
                        </span>
                        {row.studyLevel && (
                          <span className="mt-0.5 block text-2xs text-ink-subtle">
                            {row.studyLevel}
                          </span>
                        )}
                      </td>

                      <td className="sf-td">
                        <span className="block max-w-[170px] truncate">{row.stageType}</span>
                        <span className="mt-0.5 block max-w-[170px] truncate text-2xs text-ink-subtle">
                          {row.domain}
                        </span>
                      </td>

                      <td className="sf-td whitespace-nowrap">
                        {row.startDate && row.endDate ? (
                          <>
                            <span className="block text-[13px]">
                              {formatDateShort(row.startDate)} → {formatDateShort(row.endDate)}
                            </span>
                            <span className="mt-0.5 block text-2xs text-ink-subtle">
                              {computeDurationLabel(row.startDate, row.endDate)}
                            </span>
                          </>
                        ) : (
                          <span className="text-ink-subtle">—</span>
                        )}
                      </td>

                      <td className="sf-td whitespace-nowrap text-[13px] text-ink-muted">
                        {formatDateShort(row.submittedAt ?? row.createdAt)}
                      </td>

                      <td className="sf-td">
                        <StatusBadge status={row.status} variant="short" size="sm" />
                      </td>

                      <td className="sf-td text-right">
                        <Link
                          href={`/admin/demandes/${row.id}`}
                          className="sf-btn sf-btn-ghost sf-btn-sm"
                          aria-label={`Ouvrir le dossier de ${fullName(row.firstName, row.lastName)}`}
                        >
                          Ouvrir
                          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* ---------------- Mobile card list ---------------- */}
            <ul className="divide-y divide-border md:hidden">
              {result.rows.map((row) => (
                <li key={row.id}>
                  <Link
                    href={`/admin/demandes/${row.id}`}
                    className="flex flex-col gap-3 px-5 py-4 transition-colors hover:bg-canvas"
                  >
                    <div className="flex items-start gap-3">
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
                          {row.program ?? row.school ?? 'Formation non précisée'}
                        </p>
                      </div>
                      <StatusBadge status={row.status} variant="short" size="sm" className="shrink-0" />
                    </div>

                    <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-[13px]">
                      <div>
                        <dt className="text-2xs uppercase tracking-[0.08em] text-ink-subtle">
                          Type de stage
                        </dt>
                        <dd className="mt-0.5 truncate text-ink">{row.stageType}</dd>
                      </div>
                      <div>
                        <dt className="text-2xs uppercase tracking-[0.08em] text-ink-subtle">
                          Reçue le
                        </dt>
                        <dd className="mt-0.5 text-ink">
                          {formatDateShort(row.submittedAt ?? row.createdAt)}
                        </dd>
                      </div>
                    </dl>
                  </Link>
                </li>
              ))}
            </ul>

            <div className="border-t border-border">
              <Pagination
                page={result.page}
                pageSize={result.pageSize}
                total={result.total}
                buildHref={buildHref}
              />
            </div>
          </>
        )}
      </Card>

      <p className="mt-4 flex items-center gap-1.5 text-2xs text-ink-subtle">
        <ClipboardList className="h-3.5 w-3.5" aria-hidden="true" />
        Le tri et la pagination sont exécutés par la base de données ; seules les lignes affichées
        sont transmises au navigateur.
      </p>
    </>
  )
}
