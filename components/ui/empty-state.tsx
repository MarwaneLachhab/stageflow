import { cn } from '@/lib/utils/cn'

/** Shared empty-state illustration: a pastel icon tile, a title and an action. */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  tone = 'primary',
}: {
  icon: React.ReactNode
  title: string
  description?: React.ReactNode
  action?: React.ReactNode
  className?: string
  tone?: 'primary' | 'neutral'
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center px-6 py-12 text-center',
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'mb-4 flex h-14 w-14 items-center justify-center rounded-2xl',
          tone === 'primary' ? 'bg-primary-50 text-primary-500' : 'bg-slate-100 text-slate-400',
        )}
      >
        {icon}
      </span>
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      {description && (
        <p className="mt-1.5 max-w-md text-sm leading-relaxed text-ink-muted">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
