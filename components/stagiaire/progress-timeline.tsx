import { Check } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { TRACKER_STAGES, TRACKER_STAGE_LABELS } from '@/lib/constants'
import type { ApplicationStatus } from '@/lib/constants'
import { formatDateShort } from '@/lib/utils/format'

/**
 * ProgressTimeline — the four-stage tracker from mockups 04 and 08.
 *
 * IMPORTANT: `Acceptée` and `Refusée` are ALTERNATIVE terminal outcomes, not
 * consecutive stages. The mockup draws them in sequence, but here the fourth
 * node is a single « Décision » step whose label resolves to the real outcome.
 * This keeps a rejected application from showing a "pending" looking timeline.
 *
 * Four stages: Brouillon → Envoyée → En examen → Décision.
 */

function stageIndexFor(status: ApplicationStatus): number {
  switch (status) {
    case 'DRAFT':
      return 0
    case 'SUBMITTED':
      return 1
    case 'UNDER_REVIEW':
      return 2
    case 'ACCEPTED':
    case 'REJECTED':
      return 3
  }
}

export function ProgressTimeline({
  status,
  submittedAt,
  reviewedAt,
  decidedAt,
  variant = 'horizontal',
}: {
  status: ApplicationStatus
  submittedAt?: string | null
  reviewedAt?: string | null
  decidedAt?: string | null
  /** `vertical` is the mobile/compact rendering. */
  variant?: 'horizontal' | 'vertical'
}) {
  const current = stageIndexFor(status)
  const decided = status === 'ACCEPTED' || status === 'REJECTED'

  const dates: (string | null)[] = [
    null,
    submittedAt ?? null,
    reviewedAt ?? null,
    decidedAt ?? null,
  ]

  const labelFor = (index: number) => {
    if (index === 3 && decided) {
      return { label: status === 'ACCEPTED' ? 'Acceptée' : 'Refusée', hint: 'Décision finale' }
    }
    return TRACKER_STAGE_LABELS[TRACKER_STAGES[index]!]
  }

  if (variant === 'vertical') {
    return (
      <ol className="space-y-0">
        {TRACKER_STAGES.map((_, index) => {
          const done = index < current || (index === current && decided)
          const active = index === current && !decided
          const { label, hint } = labelFor(index)

          return (
            <li key={index} className="relative flex gap-4 pb-6 last:pb-0">
              {index < TRACKER_STAGES.length - 1 && (
                <span
                  aria-hidden="true"
                  className={cn(
                    'absolute left-[15px] top-8 h-full w-0.5',
                    done ? 'bg-primary-600' : 'bg-border',
                  )}
                />
              )}
              <span
                className={cn(
                  'relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                  done && 'bg-primary-600 text-white',
                  active && 'bg-primary-600 text-white ring-4 ring-primary-100',
                  !done && !active && 'bg-slate-100 text-slate-400',
                )}
              >
                {done ? <Check className="h-4 w-4" aria-hidden="true" /> : index + 1}
              </span>
              <span className="min-w-0 pt-1">
                <span
                  className={cn(
                    'block text-sm font-semibold',
                    done || active ? 'text-ink' : 'text-ink-subtle',
                  )}
                >
                  {label}
                </span>
                <span className="mt-0.5 block text-xs text-ink-muted">
                  {dates[index] ? formatDateShort(dates[index]) : hint}
                </span>
              </span>
            </li>
          )
        })}
      </ol>
    )
  }

  return (
    <ol className="flex w-full items-start">
      {TRACKER_STAGES.map((_, index) => {
        const done = index < current || (index === current && decided)
        const active = index === current && !decided
        const { label, hint } = labelFor(index)

        return (
          <li key={index} className="relative flex flex-1 flex-col items-center">
            {/* Connector to the previous node */}
            {index > 0 && (
              <span
                aria-hidden="true"
                className={cn(
                  'absolute right-1/2 top-4 h-0.5 w-full',
                  index <= current ? 'bg-primary-600' : 'bg-border',
                )}
              />
            )}

            <span
              className={cn(
                'relative z-10 flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold',
                done && 'bg-primary-600 text-white',
                active && 'bg-primary-600 text-white ring-4 ring-primary-100',
                !done && !active && 'bg-slate-100 text-slate-400',
              )}
            >
              {done ? <Check className="h-4 w-4" aria-hidden="true" /> : index + 1}
            </span>

            <span
              className={cn(
                'mt-2.5 text-center text-xs font-semibold',
                done || active ? 'text-ink' : 'text-ink-subtle',
              )}
            >
              {label}
            </span>
            <span className="mt-0.5 text-center text-2xs text-ink-subtle">
              {dates[index] ? formatDateShort(dates[index]) : hint}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
