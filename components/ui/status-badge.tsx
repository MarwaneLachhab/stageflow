import { cn } from '@/lib/utils/cn'
import { STATUS_META } from '@/lib/constants'
import type { ApplicationStatus } from '@/lib/constants'

/**
 * StatusBadge — the single place a workflow status is turned into a colour.
 *
 * The mapping lives in `STATUS_META` so the stagiaire screens, the admin table
 * and the KPI tiles can never drift apart.
 */

const TONE_CLASSES: Record<string, string> = {
  neutral: 'border-neutral-border bg-neutral-bg text-neutral',
  info: 'border-info-border bg-info-bg text-info',
  warning: 'border-warning-border bg-warning-bg text-warning',
  success: 'border-success-border bg-success-bg text-success',
  danger: 'border-danger-border bg-danger-bg text-danger',
}

type StatusBadgeProps = {
  status: ApplicationStatus
  /** `short` renders the KPI label (e.g. « En attente ») instead of the timeline one. */
  variant?: 'full' | 'short'
  size?: 'sm' | 'md'
  withDot?: boolean
  className?: string
}

export function StatusBadge({
  status,
  variant = 'full',
  size = 'md',
  withDot = false,
  className,
}: StatusBadgeProps) {
  const meta = STATUS_META[status]
  const label = variant === 'short' ? meta.shortLabel : meta.label

  return (
    <span
      className={cn(
        'sf-badge',
        size === 'sm' && 'px-2 py-0.5 text-2xs',
        TONE_CLASSES[meta.tone],
        className,
      )}
    >
      {withDot && (
        <span
          aria-hidden="true"
          className="h-1.5 w-1.5 shrink-0 rounded-full bg-current"
        />
      )}
      {label}
      {/* Full status text is read by screen readers even in the compact variant. */}
      {variant === 'short' && <span className="sf-sr-only">— {meta.label}</span>}
    </span>
  )
}

/** Generic tone badge for non-status labels (e.g. "Profil actif", "À ajouter"). */
export function ToneBadge({
  tone,
  children,
  className,
  size = 'md',
}: {
  tone: keyof typeof TONE_CLASSES
  children: React.ReactNode
  className?: string
  size?: 'sm' | 'md'
}) {
  return (
    <span
      className={cn(
        'sf-badge',
        size === 'sm' && 'px-2 py-0.5 text-2xs',
        TONE_CLASSES[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}
