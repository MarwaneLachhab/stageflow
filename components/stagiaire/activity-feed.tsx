import { CheckCircle2, Clock, FileText, Info, Send, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { STATUS_META, type ApplicationStatus } from '@/lib/constants'
import { formatDateTime } from '@/lib/utils/format'

/**
 * ActivityFeed — the "Activité récente" / "Historique de la candidature" list
 * from mockups 04 and 08.
 *
 * Only `public_note` and the status transition are rendered. Administrator-only
 * notes live in a separate RLS-protected table and are never passed here.
 */

export type ActivityItem = {
  id: string
  status: ApplicationStatus
  note: string | null
  createdAt: string
}

export function ActivityFeed({
  items,
  emptyMessage = 'Aucune activité pour le moment.',
}: {
  items: ActivityItem[]
  emptyMessage?: string
}) {
  if (items.length === 0) {
    return <p className="py-6 text-center text-sm text-ink-muted">{emptyMessage}</p>
  }

  return (
    <ol className="space-y-0">
      {items.map((item, index) => {
        const meta = STATUS_META[item.status]
        const { Icon, tone } = iconFor(item.status)

        return (
          <li key={item.id} className="relative flex gap-3.5 pb-5 last:pb-0">
            {index < items.length - 1 && (
              <span
                aria-hidden="true"
                className="absolute left-[13px] top-7 h-full w-px bg-border"
              />
            )}

            <span
              aria-hidden="true"
              className={cn(
                'relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
                tone === 'success' && 'bg-success-bg text-success',
                tone === 'danger' && 'bg-danger-bg text-danger',
                tone === 'info' && 'bg-info-bg text-info',
                tone === 'warning' && 'bg-warning-bg text-warning',
                tone === 'neutral' && 'bg-slate-100 text-slate-500',
              )}
            >
              <Icon className="h-3.5 w-3.5" />
            </span>

            <div className="min-w-0 pt-0.5">
              <p className="text-[13px] font-semibold text-ink">{meta.label}</p>
              {item.note && (
                <p className="mt-0.5 text-[13px] leading-relaxed text-ink-muted">{item.note}</p>
              )}
              <p className="mt-1 text-2xs text-ink-subtle">{formatDateTime(item.createdAt)}</p>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

function iconFor(status: ApplicationStatus) {
  switch (status) {
    case 'DRAFT':
      return { Icon: FileText, tone: 'neutral' as const }
    case 'SUBMITTED':
      return { Icon: Send, tone: 'warning' as const }
    case 'UNDER_REVIEW':
      return { Icon: Clock, tone: 'info' as const }
    case 'ACCEPTED':
      return { Icon: CheckCircle2, tone: 'success' as const }
    case 'REJECTED':
      return { Icon: XCircle, tone: 'danger' as const }
    default:
      return { Icon: Info, tone: 'neutral' as const }
  }
}

/** Compact single-line variant used in the topbar dropdown. */
export function ActivityRow({ item }: { item: ActivityItem }) {
  const meta = STATUS_META[item.status]
  const { Icon, tone } = iconFor(item.status)

  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <span
        aria-hidden="true"
        className={cn(
          'flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
          tone === 'success' && 'bg-success-bg text-success',
          tone === 'danger' && 'bg-danger-bg text-danger',
          tone === 'info' && 'bg-info-bg text-info',
          tone === 'warning' && 'bg-warning-bg text-warning',
          tone === 'neutral' && 'bg-slate-100 text-slate-500',
        )}
      >
        <Icon className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0">
        <p className="text-[13px] font-semibold text-ink">{meta.label}</p>
        <p className="mt-0.5 text-2xs text-ink-subtle">{formatDateTime(item.createdAt)}</p>
      </div>
    </div>
  )
}
