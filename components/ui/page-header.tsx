/** Page title block used by every screen: eyebrow, heading, description, actions. */
export function PageHeader({
  eyebrow,
  title,
  description,
  action,
  className,
}: {
  eyebrow?: string
  title: React.ReactNode
  description?: React.ReactNode
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={`mb-6 flex flex-col gap-4 sm:mb-7 sm:flex-row sm:items-start sm:justify-between ${className ?? ''}`}
    >
      <div className="min-w-0">
        {eyebrow && (
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary-600">
            {eyebrow}
          </p>
        )}
        <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-navy sm:text-[28px]">
          {title}
        </h1>
        {description && (
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-muted">{description}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}
