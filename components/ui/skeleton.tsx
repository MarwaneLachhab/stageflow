import { cn } from '@/lib/utils/cn'

/**
 * Loading skeletons.
 *
 * Every async surface has a real skeleton so the UI never flashes an empty
 * layout, which the master prompt requires as a distinct state.
 */

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('sf-skeleton', className)} aria-hidden="true" />
}

/** KPI tile placeholder — mirrors StatCard proportions. */
export function StatCardSkeleton() {
  return (
    <div className="sf-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="w-full space-y-3">
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-3 w-28" />
        </div>
        <Skeleton className="h-9 w-9 rounded-lg" />
      </div>
    </div>
  )
}

export function TableSkeleton({ rows = 6, columns = 6 }: { rows?: number; columns?: number }) {
  return (
    <div className="w-full overflow-hidden rounded-card border border-border bg-surface">
      <div className="flex items-center gap-4 bg-canvas px-4 py-3">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} className="h-3 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-4 border-t border-border px-4 py-4">
          {Array.from({ length: columns }).map((_, c) => (
            <Skeleton
              key={c}
              className={cn('h-3.5', c === 0 ? 'w-40 flex-[1.5]' : 'flex-1')}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

export function CardSkeleton({ lines = 4 }: { lines?: number }) {
  return (
    <div className="sf-card-padded space-y-4">
      <Skeleton className="h-5 w-48" />
      <div className="space-y-3">
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-full" />
        ))}
      </div>
    </div>
  )
}

export function FormSkeleton({ fields = 6 }: { fields?: number }) {
  return (
    <div className="sf-card-padded">
      <Skeleton className="mb-6 h-5 w-44" />
      <div className="grid gap-5 sm:grid-cols-2">
        {Array.from({ length: fields }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-11 w-full rounded-control" />
          </div>
        ))}
      </div>
    </div>
  )
}

/** Inline spinner used inside buttons during submission. */
export function Spinner({ className }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Chargement"
      className={cn(
        'inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent',
        className,
      )}
    />
  )
}
