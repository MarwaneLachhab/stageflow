import { cn } from '@/lib/utils/cn'

/** Rounded white card with the light border and subtle shadow from the mockups. */
export function Card({
  className,
  children,
  as: Tag = 'div',
  ...rest
}: React.ComponentPropsWithoutRef<'div'> & { as?: React.ElementType }) {
  return (
    <Tag className={cn('sf-card', className)} {...rest}>
      {children}
    </Tag>
  )
}

export function CardHeader({
  title,
  description,
  action,
  icon,
  className,
}: {
  title: React.ReactNode
  description?: React.ReactNode
  action?: React.ReactNode
  icon?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6',
        className,
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        {icon && (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
            {icon}
          </span>
        )}
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-ink">{title}</h2>
          {description && (
            <p className="mt-1 text-sm leading-relaxed text-ink-muted">{description}</p>
          )}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

export function CardBody({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return <div className={cn('px-5 pb-5 sm:px-6 sm:pb-6', className)}>{children}</div>
}

/** Section title used inside cards, matching the mockups' inner headings. */
export function CardSectionTitle({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <h3
      className={cn(
        'border-b border-border pb-3 text-sm font-semibold text-ink',
        className,
      )}
    >
      {children}
    </h3>
  )
}
