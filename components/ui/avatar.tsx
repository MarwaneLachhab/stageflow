import { cn } from '@/lib/utils/cn'

/**
 * Avatar with initials.
 *
 * In the mockups the avatar is a soft blue-tinted circle with the user's
 * initials, used identically in the sidebar, the topbar and the applicant table.
 */

const SIZES = {
  xs: 'h-7 w-7 text-2xs',
  sm: 'h-9 w-9 text-xs',
  md: 'h-11 w-11 text-sm',
  lg: 'h-16 w-16 text-lg',
  xl: 'h-20 w-20 text-2xl',
} as const

const TONES = {
  primary: 'bg-primary-100 text-primary-700',
  success: 'bg-success-bg text-success',
  danger: 'bg-danger-bg text-danger',
  neutral: 'bg-slate-100 text-slate-600',
  /** Used by the sidebar footer against the navy rail. */
  onDark: 'bg-white/12 text-white',
  /** Warm sand tone used by the mockups for the topbar account chip. */
  sand: 'bg-[#FBE7D0] text-[#B45309]',
} as const

export type AvatarTone = keyof typeof TONES

export function Avatar({
  initials,
  size = 'md',
  tone = 'primary',
  className,
  /** When provided the avatar is announced as an image with this label. */
  label,
}: {
  initials: string
  size?: keyof typeof SIZES
  tone?: AvatarTone
  className?: string
  label?: string
}) {
  return (
    <span
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn(
        'inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold uppercase',
        SIZES[size],
        TONES[tone],
        className,
      )}
    >
      {initials}
    </span>
  )
}
