'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, Check, CheckCheck } from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'
import { cn } from '@/lib/utils/cn'
import { markAllAsRead, markAsRead } from '@/lib/actions/notifications'
import type { NotificationRow } from '@/lib/db/stagiaire'

/**
 * Notification centre.
 *
 * Dates are formatted with an explicit locale AND time zone so the server and
 * the browser always produce the same string — otherwise SSR and hydration
 * disagree and React throws a mismatch warning.
 */
const dateFormatter = new Intl.DateTimeFormat('fr-FR', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Paris',
})

/**
 * Mirrors the `public.notification_type` enum from migration 0001 exactly, so
 * no raw SCREAMING_CASE value can leak into the interface.
 */
const TYPE_LABELS: Record<string, string> = {
  WELCOME: 'Bienvenue',
  APPLICATION_SUBMITTED: 'Demande envoyée',
  APPLICATION_UNDER_REVIEW: 'Dossier en cours d’examen',
  APPLICATION_ACCEPTED: 'Demande acceptée',
  APPLICATION_REJECTED: 'Demande refusée',
}

/** Readable fallback for a type added to the enum but not yet labelled here. */
function labelFor(type: string): string {
  if (TYPE_LABELS[type]) return TYPE_LABELS[type]
  const words = type.toLowerCase().replace(/_/g, ' ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}

export function NotificationCenter({
  notifications,
  emptyAction,
}: {
  notifications: NotificationRow[]
  emptyAction?: React.ReactNode
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const unread = notifications.filter((n) => !n.read_at)

  function handleRead(id: string) {
    setBusyId(id)
    setError(null)
    startTransition(async () => {
      const result = await markAsRead(id)
      if (!result.ok) setError(result.error)
      setBusyId(null)
      router.refresh()
    })
  }

  function handleReadAll() {
    setError(null)
    startTransition(async () => {
      const result = await markAllAsRead()
      if (!result.ok) setError(result.error)
      router.refresh()
    })
  }

  if (notifications.length === 0) {
    return (
      <EmptyState
        icon={<Bell className="h-7 w-7" />}
        title="Aucune notification"
        description="Vous serez averti ici dès qu’un événement concernera votre dossier."
        action={emptyAction}
      />
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-muted">
          {unread.length === 0
            ? 'Toutes les notifications ont été lues.'
            : `${unread.length} notification${unread.length > 1 ? 's' : ''} non lue${unread.length > 1 ? 's' : ''}.`}
        </p>
        {unread.length > 0 && (
          <button
            type="button"
            onClick={handleReadAll}
            disabled={pending}
            className="sf-btn sf-btn-secondary sf-btn-sm disabled:cursor-not-allowed disabled:opacity-60"
          >
            <CheckCheck className="h-4 w-4" aria-hidden="true" />
            Tout marquer comme lu
          </button>
        )}
      </div>

      {error && (
        <p role="alert" className="rounded-control bg-danger-bg px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      <ul className="sf-card divide-y divide-border overflow-hidden">
        {notifications.map((n) => {
          const isUnread = !n.read_at
          return (
            <li
              key={n.id}
              className={cn(
                'flex flex-col gap-2 p-4 sm:flex-row sm:items-start sm:gap-4 sm:p-5',
                isUnread && 'bg-primary-50/40',
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
                  isUnread ? 'bg-primary-50 text-primary-600' : 'bg-slate-100 text-slate-400',
                )}
              >
                <Bell className="h-4 w-4" />
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p
                    className={cn(
                      'text-sm',
                      isUnread ? 'font-semibold text-ink' : 'font-medium text-ink-muted',
                    )}
                  >
                    {n.title}
                  </p>
                  {isUnread && (
                    <span className="rounded-full bg-primary-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                      Non lue
                    </span>
                  )}
                </div>
                {n.body && <p className="mt-1 text-sm leading-relaxed text-ink-muted">{n.body}</p>}
                <p className="mt-1.5 text-2xs text-ink-subtle">
                  {labelFor(n.type)} · {dateFormatter.format(new Date(n.created_at))}
                </p>
              </div>

              {isUnread && (
                <button
                  type="button"
                  onClick={() => handleRead(n.id)}
                  disabled={pending && busyId === n.id}
                  className="sf-btn sf-btn-ghost sf-btn-sm shrink-0 self-start disabled:opacity-60"
                >
                  <Check className="h-4 w-4" aria-hidden="true" />
                  <span className="sf-sr-only sm:not-sr-only">Marquer comme lu</span>
                </button>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
