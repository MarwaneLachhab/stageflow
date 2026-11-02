import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { formatNumber } from '@/lib/utils/format'

/**
 * Pagination — mirrors the mockups: result count on the left, page buttons on
 * the right. Rendered as real links so pagination works without JavaScript and
 * each page is shareable/bookmarkable.
 */

export function Pagination({
  page,
  pageSize,
  total,
  buildHref,
  className,
}: {
  page: number
  pageSize: number
  total: number
  /** Returns the href for a given page, preserving all active filters. */
  buildHref: (page: number) => string
  className?: string
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)

  const pages = buildPageList(page, totalPages)

  return (
    <nav
      aria-label="Pagination des résultats"
      className={cn(
        'flex flex-col items-center justify-between gap-4 px-5 py-4 sm:flex-row sm:px-6',
        className,
      )}
    >
      <p className="text-sm text-ink-muted">
        {total === 0 ? (
          'Aucun résultat'
        ) : (
          <>
            Affichage de <span className="font-semibold text-ink">{formatNumber(from)}</span> à{' '}
            <span className="font-semibold text-ink">{formatNumber(to)}</span> sur{' '}
            <span className="font-semibold text-ink">{formatNumber(total)}</span> résultats
          </>
        )}
      </p>

      {totalPages > 1 && (
        <div className="flex items-center gap-1.5">
          <PageLink
            href={buildHref(page - 1)}
            disabled={page <= 1}
            label="Page précédente"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </PageLink>

          {pages.map((entry, index) =>
            entry === 'gap' ? (
              <span
                key={`gap-${index}`}
                className="px-1.5 text-sm text-ink-subtle"
                aria-hidden="true"
              >
                …
              </span>
            ) : (
              <Link
                key={entry}
                href={buildHref(entry)}
                aria-current={entry === page ? 'page' : undefined}
                className={cn(
                  'inline-flex h-9 min-w-9 items-center justify-center rounded-control px-2.5 text-sm font-medium transition-colors',
                  entry === page
                    ? 'bg-primary-600 text-white'
                    : 'border border-border-strong bg-surface text-ink hover:bg-canvas',
                )}
              >
                {entry}
              </Link>
            ),
          )}

          <PageLink
            href={buildHref(page + 1)}
            disabled={page >= totalPages}
            label="Page suivante"
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </PageLink>
        </div>
      )}
    </nav>
  )
}

function PageLink({
  href,
  disabled,
  label,
  children,
}: {
  href: string
  disabled: boolean
  label: string
  children: React.ReactNode
}) {
  const classes =
    'inline-flex h-9 w-9 items-center justify-center rounded-control border border-border-strong bg-surface text-ink-muted'

  if (disabled) {
    return (
      <span aria-disabled="true" aria-label={label} className={cn(classes, 'cursor-not-allowed opacity-45')}>
        {children}
      </span>
    )
  }

  return (
    <Link href={href} aria-label={label} className={cn(classes, 'hover:bg-canvas hover:text-ink')}>
      {children}
    </Link>
  )
}

/** Compact page list: 1 … 4 5 6 … 20 */
function buildPageList(current: number, total: number): (number | 'gap')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)

  const entries: (number | 'gap')[] = [1]
  const start = Math.max(2, current - 1)
  const end = Math.min(total - 1, current + 1)

  if (start > 2) entries.push('gap')
  for (let i = start; i <= end; i++) entries.push(i)
  if (end < total - 1) entries.push('gap')
  entries.push(total)

  return entries
}
