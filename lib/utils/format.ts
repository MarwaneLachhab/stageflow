/**
 * French-locale formatting helpers.
 *
 * All timestamps are stored in UTC in the database; formatting is locale-aware
 * and uses the Africa/Casablanca timezone by default so a decision taken at
 * 23:30 UTC is displayed as the next calendar day, matching Moroccan users'
 * expectations.
 */

const DEFAULT_TZ = 'Africa/Casablanca'

export function formatDateLong(value: Date | string | null | undefined): string {
  if (!value) return '—'
  const d = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: DEFAULT_TZ,
  }).format(d)
}

export function formatDateShort(value: Date | string | null | undefined): string {
  if (!value) return '—'
  const d = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: DEFAULT_TZ,
  }).format(d)
}

export function formatDateTime(value: Date | string | null | undefined): string {
  if (!value) return '—'
  const d = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: DEFAULT_TZ,
  }).format(d)
}

/** "il y a 3 jours" style relative label, used by the activity feed. */
export function formatRelative(value: Date | string | null | undefined): string {
  if (!value) return '—'
  const d = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(d.getTime())) return '—'

  const diffMs = d.getTime() - Date.now()
  const rtf = new Intl.RelativeTimeFormat('fr-FR', { numeric: 'auto' })
  const absMs = Math.abs(diffMs)
  const minute = 60_000
  const hour = 60 * minute
  const day = 24 * hour

  if (absMs < hour) return rtf.format(Math.round(diffMs / minute), 'minute')
  if (absMs < day) return rtf.format(Math.round(diffMs / hour), 'hour')
  if (absMs < 30 * day) return rtf.format(Math.round(diffMs / day), 'day')
  return formatDateShort(d)
}

/** ISO date (YYYY-MM-DD) for <input type="date"> values. */
export function toInputDate(value: Date | string | null | undefined): string {
  if (!value) return ''
  const d = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(d.getTime())) return ''
  return d.toISOString().slice(0, 10)
}

/**
 * Human-readable duration in months between two dates, e.g. "3 mois".
 * Returns null when the range is invalid so callers can surface a validation
 * error instead of a misleading number.
 */
export function computeDurationLabel(
  start: string | null | undefined,
  end: string | null | undefined,
): string | null {
  if (!start || !end) return null
  const s = new Date(start)
  const e = new Date(end)
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return null
  if (e < s) return null

  const months =
    (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth())
  const dayDelta = e.getDate() - s.getDate()
  const roundedMonths = dayDelta > 15 ? months + 1 : months

  if (roundedMonths >= 12) {
    const years = Math.floor(roundedMonths / 12)
    const rest = roundedMonths % 12
    return rest === 0
      ? `${years} an${years > 1 ? 's' : ''}`
      : `${years} an${years > 1 ? 's' : ''} ${rest} mois`
  }
  if (roundedMonths < 1) {
    const days = Math.max(1, Math.round((e.getTime() - s.getTime()) / 86_400_000))
    return `${days} jour${days > 1 ? 's' : ''}`
  }
  return `${roundedMonths} mois`
}

export function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null || Number.isNaN(bytes)) return '—'
  if (bytes < 1024) return `${bytes} o`
  const kb = bytes / 1024
  if (kb < 1024) return `${Math.round(kb)} Ko`
  return `${(kb / 1024).toFixed(1).replace('.', ',')} Mo`
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('fr-FR').format(value)
}

/** Initials used by Avatar components, e.g. "Sara Ahmed" -> "SA". */
export function initials(firstName?: string | null, lastName?: string | null): string {
  const a = (firstName ?? '').trim().charAt(0)
  const b = (lastName ?? '').trim().charAt(0)
  const combined = `${a}${b}`.toUpperCase()
  return combined || '??'
}

export function fullName(
  firstName?: string | null,
  lastName?: string | null,
): string {
  return [firstName, lastName].filter(Boolean).join(' ').trim() || 'Utilisateur'
}
