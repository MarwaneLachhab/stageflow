'use client'

import { useId } from 'react'
import { AlertCircle, CheckCircle2, Info, TriangleAlert } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

/**
 * Inline alert.
 *
 * Announced with the correct ARIA role so screen readers surface validation and
 * permission problems immediately: `alert` interrupts, `status` waits politely.
 */

const VARIANTS = {
  error: {
    wrapper: 'border-danger-border bg-danger-bg text-danger',
    Icon: AlertCircle,
    role: 'alert' as const,
  },
  success: {
    wrapper: 'border-success-border bg-success-bg text-success',
    Icon: CheckCircle2,
    role: 'status' as const,
  },
  info: {
    wrapper: 'border-info-border bg-info-bg text-info',
    Icon: Info,
    role: 'status' as const,
  },
  warning: {
    wrapper: 'border-warning-border bg-warning-bg text-warning',
    Icon: TriangleAlert,
    role: 'alert' as const,
  },
} as const

export type AlertVariant = keyof typeof VARIANTS

export function Alert({
  variant = 'info',
  title,
  children,
  className,
  /** Renders a compact single-line variant. */
  dense = false,
}: {
  variant?: AlertVariant
  title?: React.ReactNode
  children?: React.ReactNode
  className?: string
  dense?: boolean
}) {
  const { wrapper, Icon, role } = VARIANTS[variant]

  return (
    <div
      role={role}
      className={cn(
        'flex items-start gap-2.5 rounded-control border px-3.5 py-3 text-sm',
        wrapper,
        className,
      )}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div className={cn('min-w-0', dense && 'leading-tight')}>
        {title && <p className="font-semibold">{title}</p>}
        {children && (
          <div className={cn('text-[13px] leading-relaxed', title && 'mt-0.5 opacity-90')}>
            {children}
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Field-level error text tied to an input via aria-describedby.
 * `id` is optional; when omitted the parent must supply it.
 */
export function FieldError({
  id,
  children,
  className,
}: {
  id?: string
  children?: React.ReactNode
  className?: string
}) {
  if (!children) return null
  return (
    <p id={id} className={cn('sf-error', className)}>
      <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </p>
  )
}

/**
 * Error summary shown at the top of a long form (accessibility requirement).
 * Focus is moved here on submit failure so keyboard users are not stranded.
 */
export function ErrorSummary({
  errors,
  className,
  title = 'Veuillez corriger les erreurs suivantes :',
}: {
  errors: { fieldId?: string; message: string }[]
  className?: string
  title?: string
}) {
  const headingId = useId()
  if (errors.length === 0) return null

  return (
    <div
      role="alert"
      aria-labelledby={headingId}
      className={cn(
        'rounded-control border border-danger-border bg-danger-bg p-4 text-sm text-danger',
        className,
      )}
    >
      <p id={headingId} className="font-semibold">
        {title}
      </p>
      <ul className="mt-2 list-inside list-disc space-y-1 text-[13px]">
        {errors.map((error, index) => (
          <li key={`${error.message}-${index}`}>
            {error.fieldId ? (
              <a href={`#${error.fieldId}`} className="underline underline-offset-2">
                {error.message}
              </a>
            ) : (
              error.message
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
