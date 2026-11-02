import { cn } from '@/lib/utils/cn'

/**
 * StatCard — the KPI tile used across the admin dashboard and the applications
 * list, matching the mockups: small caption, large value, sub-caption, and a
 * pastel icon tile on the right.
 */

const TONES = {
  primary: { tile: 'bg-primary-50 text-primary-600', value: 'text-ink' },
  warning: { tile: 'bg-warning-bg text-warning', value: 'text-warning' },
  info: { tile: 'bg-info-bg text-info', value: 'text-info' },
  success: { tile: 'bg-success-bg text-success', value: 'text-success' },
  danger: { tile: 'bg-danger-bg text-danger', value: 'text-danger' },
  neutral: { tile: 'bg-slate-100 text-slate-500', value: 'text-ink' },
} as const

export type StatTone = keyof typeof TONES

export function StatCard({
  label,
  value,
  caption,
  icon,
  tone = 'primary',
  className,
  href,
  trend,
}: {
  label: string
  value: number | string
  caption?: string
  icon: React.ReactNode
  tone?: StatTone
  className?: string
  /** When set the whole tile becomes a link (the applications list uses this). */
  href?: string
  trend?: { value: string; positive: boolean }
}) {
  const palette = TONES[tone]

  const inner = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-ink-muted">{label}</p>
          <p className={cn('mt-2 text-3xl font-bold leading-none', palette.value)}>
            {typeof value === 'number' ? value.toLocaleString('fr-FR') : value}
          </p>
          {caption && <p className="mt-2 truncate text-xs text-ink-subtle">{caption}</p>}
          {trend && (
            <p
              className={cn(
                'mt-1.5 text-xs font-semibold',
                trend.positive ? 'text-success' : 'text-danger',
              )}
            >
              {trend.value}
            </p>
          )}
        </div>
        <span
          aria-hidden="true"
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
            palette.tile,
          )}
        >
          {icon}
        </span>
      </div>
    </>
  )

  if (href) {
    return (
      <a
        href={href}
        className={cn(
          'sf-card block p-5 transition-shadow hover:shadow-raised focus-visible:ring-2 focus-visible:ring-primary-600/40',
          className,
        )}
      >
        {inner}
      </a>
    )
  }

  return <div className={cn('sf-card p-5', className)}>{inner}</div>
}
