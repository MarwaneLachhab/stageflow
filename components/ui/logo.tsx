import { cn } from '@/lib/utils/cn'
import { BRAND } from '@/lib/constants'

/**
 * StageFlow wordmark: graduation-cap glyph in a rounded blue tile plus the
 * brand text. Brand strings come from `BRAND` so renaming is a one-liner.
 */
export function Logo({
  variant = 'default',
  href = '/',
  size = 'md',
  className,
  showText = true,
}: {
  /** `inverse` is for the navy sidebar, where the tile is translucent white. */
  variant?: 'default' | 'inverse'
  href?: string | null
  size?: 'sm' | 'md' | 'lg'
  className?: string
  showText?: boolean
}) {
  const tileSize = size === 'lg' ? 'h-11 w-11' : size === 'sm' ? 'h-7 w-7' : 'h-9 w-9'
  const glyphSize = size === 'lg' ? 'h-6 w-6' : size === 'sm' ? 'h-4 w-4' : 'h-5 w-5'
  const textSize = size === 'lg' ? 'text-xl' : size === 'sm' ? 'text-sm' : 'text-lg'

  const content = (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <span
        aria-hidden="true"
        className={cn(
          'flex items-center justify-center rounded-[10px]',
          tileSize,
          variant === 'inverse' ? 'bg-white/95' : 'bg-primary-600',
        )}
      >
        <GraduationCap
          className={cn(
            glyphSize,
            variant === 'inverse' ? 'text-primary-700' : 'text-white',
          )}
        />
      </span>
      {showText && (
        <span
          className={cn(
            'font-bold tracking-tight',
            textSize,
            variant === 'inverse' ? 'text-white' : 'text-ink',
          )}
        >
          {BRAND.name}
        </span>
      )}
    </span>
  )

  if (href === null) return content

  return (
    <a
      href={href}
      className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600/40"
      aria-label={`${BRAND.name} — accueil`}
    >
      {content}
    </a>
  )
}

/**
 * Graduation cap drawn as inline SVG.

 * `lucide-react`'s GraduationCap is used elsewhere; this local copy keeps the
 * logo independent from the icon set so the brand mark is stable.
 */
export function GraduationCap({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z" />
      <path d="M22 10v6" />
      <path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5" />
    </svg>
  )
}
