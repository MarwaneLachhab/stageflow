import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

/**
 * TileCard — the "Accès rapide" card from the stagiaire dashboard (mockup 04):
 * pastel icon tile, title, one-line description, and a subtle arrow affordance.
 */

const TONES = {
  primary: 'bg-primary-50 text-primary-600',
  warning: 'bg-warning-bg text-warning',
  success: 'bg-success-bg text-success',
  info: 'bg-info-bg text-info',
} as const

export function TileCard({
  href,
  icon,
  title,
  description,
  tone = 'primary',
  badge,
  className,
}: {
  href: string
  icon: React.ReactNode
  title: string
  description: string
  tone?: keyof typeof TONES
  badge?: React.ReactNode
  className?: string
}) {
  return (
    <Link
      href={href}
      className={cn(
        'sf-card group flex items-start gap-4 p-5 transition-all hover:border-primary-200 hover:shadow-raised focus-visible:ring-2 focus-visible:ring-primary-600/40',
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', TONES[tone])}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="text-sm font-semibold text-ink">{title}</span>
          {badge}
        </span>
        <span className="mt-1 block text-[13px] leading-relaxed text-ink-muted">{description}</span>
      </span>
      <ArrowRight
        aria-hidden="true"
        className="mt-1 h-4 w-4 shrink-0 text-ink-faint transition-transform group-hover:translate-x-0.5 group-hover:text-primary-600"
      />
    </Link>
  )
}
