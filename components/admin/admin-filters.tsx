'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Filter, Search, X } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { APPLICATION_STATUSES, STATUS_META, PAGE_SIZE_DEFAULT } from '@/lib/constants'

/**
 * SCREEN 10 — filter bar.
 *
 * Filters are written into the URL query string, not into React state. That
 * choice buys three things for free:
 *   - the list is server-rendered from the same validated query object, so a
 *     filtered view is shareable and reload-safe;
 *   - the browser back button behaves as users expect;
 *   - there is exactly ONE place that decides what is being filtered.
 *
 * The text input is debounced so typing does not fire a request per keystroke,
 * and every navigation preserves the other active filters.
 */

type Option = { value: string; label: string }

export function AdminFilters({
  formations,
  stageTypes,
}: {
  formations: Option[]
  stageTypes: Option[]
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const currentQ = searchParams.get('q') ?? ''
  const currentStatus = searchParams.get('status') ?? 'ALL'
  const currentFormation = searchParams.get('formation') ?? ''
  const currentStageType = searchParams.get('stageType') ?? ''
  const currentDateFrom = searchParams.get('dateFrom') ?? ''
  const currentDateTo = searchParams.get('dateTo') ?? ''
  const currentPageSize = searchParams.get('pageSize') ?? String(PAGE_SIZE_DEFAULT)

  const [searchValue, setSearchValue] = useState(currentQ)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Keep the input in sync when the URL changes from outside (back button,
  // a status tile on the dashboard, a "réinitialiser" click).
  useEffect(() => {
    setSearchValue(currentQ)
  }, [currentQ])

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  /** Merge a patch into the query string and reset to page 1. */
  const applyPatch = (patch: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString())

    for (const [key, value] of Object.entries(patch)) {
      if (value === null || value === '' || value === 'ALL') {
        params.delete(key)
      } else {
        params.set(key, value)
      }
    }

    // Any filter change invalidates the current offset.
    params.delete('page')

    const queryString = params.toString()
    startTransition(() => {
      router.push(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false })
    })
  }

  const handleSearchChange = (value: string) => {
    setSearchValue(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      applyPatch({ q: value.trim() || null })
    }, 350)
  }

  const activeFilterCount = [
    currentStatus !== 'ALL',
    Boolean(currentFormation),
    Boolean(currentStageType),
    Boolean(currentDateFrom),
    Boolean(currentDateTo),
  ].filter(Boolean).length

  const resetAll = () => {
    setSearchValue('')
    startTransition(() => router.push(pathname, { scroll: false }))
  }

  return (
    <div className="border-b border-border px-5 py-4 sm:px-6">
      {/* ---------------- Search row ---------------- */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint"
          />
          <input
            type="search"
            value={searchValue}
            onChange={(event) => handleSearchChange(event.target.value)}
            placeholder="Rechercher un candidat, une formation, un domaine…"
            aria-label="Rechercher dans les demandes"
            className="sf-input pl-10 pr-9"
          />
          {searchValue && (
            <button
              type="button"
              onClick={() => handleSearchChange('')}
              aria-label="Effacer la recherche"
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-0.5 text-ink-faint transition-colors hover:text-ink"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Status is the filter admins reach for most: keep it always visible. */}
          <label className="sr-only" htmlFor="admin-status-filter">
            Filtrer par statut
          </label>
          <select
            id="admin-status-filter"
            value={currentStatus}
            onChange={(event) => applyPatch({ status: event.target.value })}
            className="sf-select w-full sm:w-[190px]"
          >
            <option value="ALL">Tous les statuts</option>
            {APPLICATION_STATUSES.map((status) => (
              <option key={status} value={status}>
                {STATUS_META[status].shortLabel}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => setFiltersOpen((open) => !open)}
            aria-expanded={filtersOpen}
            aria-controls="admin-advanced-filters"
            className={cn(
              'sf-btn shrink-0 border',
              filtersOpen || activeFilterCount > 0
                ? 'border-primary-300 bg-primary-50 text-primary-700'
                : 'border-border-strong bg-surface text-ink hover:bg-canvas',
            )}
          >
            <Filter className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">Filtres</span>
            {activeFilterCount > 0 && (
              <span className="ml-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary-600 px-1.5 text-2xs font-semibold text-white">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ---------------- Advanced filters ---------------- */}
      <div
        id="admin-advanced-filters"
        hidden={!filtersOpen}
        className="mt-4 grid gap-3 border-t border-border pt-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <div>
          <label htmlFor="filter-formation" className="sf-label">
            Formation
          </label>
          <select
            id="filter-formation"
            value={currentFormation}
            onChange={(event) => applyPatch({ formation: event.target.value })}
            className="sf-select"
          >
            <option value="">Toutes les formations</option>
            {formations.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="filter-stage-type" className="sf-label">
            Type de stage
          </label>
          <select
            id="filter-stage-type"
            value={currentStageType}
            onChange={(event) => applyPatch({ stageType: event.target.value })}
            className="sf-select"
          >
            <option value="">Tous les types</option>
            {stageTypes.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="filter-date-from" className="sf-label">
            Reçues à partir du
          </label>
          <input
            id="filter-date-from"
            type="date"
            value={currentDateFrom}
            max={currentDateTo || undefined}
            onChange={(event) => applyPatch({ dateFrom: event.target.value })}
            className="sf-input"
          />
        </div>

        <div>
          <label htmlFor="filter-date-to" className="sf-label">
            Jusqu’au
          </label>
          <input
            id="filter-date-to"
            type="date"
            value={currentDateTo}
            min={currentDateFrom || undefined}
            onChange={(event) => applyPatch({ dateTo: event.target.value })}
            className="sf-input"
          />
        </div>

        <div className="sm:col-span-2 lg:col-span-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <label htmlFor="filter-page-size" className="text-[13px] text-ink-muted">
              Lignes par page
            </label>
            <select
              id="filter-page-size"
              value={currentPageSize}
              onChange={(event) => applyPatch({ pageSize: event.target.value })}
              className="sf-select w-auto py-1.5 text-[13px]"
            >
              <option value="10">10</option>
              <option value="25">25</option>
            </select>
          </div>

          {activeFilterCount > 0 && (
            <button type="button" onClick={resetAll} className="sf-btn sf-btn-ghost sf-btn-sm">
              <X className="h-3.5 w-3.5" aria-hidden="true" />
              Réinitialiser les filtres
            </button>
          )}
        </div>
      </div>

      {/* Announce that a server request is in flight without blocking the UI. */}
      <p aria-live="polite" className="sr-only">
        {isPending ? 'Mise à jour des résultats…' : ''}
      </p>
    </div>
  )
}
