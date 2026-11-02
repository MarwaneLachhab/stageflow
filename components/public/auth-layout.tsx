import { GraduationCap } from 'lucide-react'
import { Logo } from '@/components/ui/logo'
import { cn } from '@/lib/utils/cn'

/**
 * Split-pane auth layout shared by /inscription, /connexion and the password
 * screens, matching mockups 02 and 03:
 *   left  — pale blue brand panel with the wordmark and a decorative card cluster
 *   right — clean white form panel, vertically centred, max ~440px wide
 *
 * On mobile the brand panel collapses to a compact header strip so the form is
 * immediately visible without scrolling.
 */
export function AuthLayout({
  eyebrow,
  title,
  subtitle,
  asideTitle,
  asideSubtitle,
  asideSlot,
  children,
  footer,
  topRight,
}: {
  eyebrow: string
  title: React.ReactNode
  subtitle?: string
  asideTitle?: React.ReactNode
  asideSubtitle?: string
  asideSlot?: React.ReactNode
  children: React.ReactNode
  footer?: React.ReactNode
  topRight?: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-surface lg:grid lg:grid-cols-2">
      {/* ---------------- Brand panel ---------------- */}
      <aside className="relative hidden overflow-hidden bg-[#EDF2FE] lg:flex lg:flex-col">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-[-12%] top-[18%] h-[560px] w-[560px] rounded-full bg-[#C7D9FB] opacity-70"
        />

        <div className="relative z-10 flex h-full flex-col p-12">
          <Logo />

          <div className="mt-auto mb-auto max-w-lg pt-16">
            <h2 className="text-4xl font-bold leading-[1.15] tracking-tight text-navy">
              {asideTitle ?? (
                <>
                  Le début d’une <span className="text-primary-600">belle expérience.</span>
                </>
              )}
            </h2>
            <p className="mt-5 max-w-md text-base leading-relaxed text-slate-600">
              {asideSubtitle ??
                'Un seul espace pour déposer votre candidature, gérer vos documents et suivre chaque étape de votre demande.'}
            </p>
          </div>

          <div className="relative mt-10">{asideSlot ?? <DefaultAsideCard />}</div>
        </div>
      </aside>

      {/* ---------------- Form panel ---------------- */}
      <main className="flex min-h-screen flex-col">
        {/* Compact brand header for mobile / tablet */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4 lg:hidden">
          <Logo size="sm" />
          {topRight}
        </div>

        <div className="flex flex-1 items-start justify-center px-5 py-10 sm:px-8 lg:items-center lg:py-12">
          <div className="w-full max-w-[440px]">
            <div className="hidden justify-end lg:flex">{topRight}</div>

            <p className="mt-4 text-xs font-semibold uppercase tracking-[0.14em] text-primary-600 lg:mt-0">
              {eyebrow}
            </p>
            <h1 className="mt-2.5 text-[2rem] font-bold leading-tight tracking-tight text-navy sm:text-4xl">
              {title}
            </h1>
            {subtitle && (
              <p className="mt-3 text-sm leading-relaxed text-ink-muted">{subtitle}</p>
            )}

            <div className="mt-8">{children}</div>

            {footer && <div className="mt-7">{footer}</div>}
          </div>
        </div>
      </main>
    </div>
  )
}

/** The three-step card shown in mockups 02 and 03. */
function DefaultAsideCard() {
  const steps = [
    {
      icon: GraduationCap,
      title: 'Créer mon espace',
      subtitle: 'Vos informations, en sécurité',
    },
    { icon: GraduationCap, title: 'Compléter ma demande', subtitle: 'Stage, formation et documents' },
    { icon: GraduationCap, title: 'Suivre ma candidature', subtitle: 'Une réponse en toute transparence' },
  ]

  return (
    <div className="rounded-card border border-white/70 bg-surface p-5 shadow-raised">
      <div className="flex items-center justify-between gap-3 pb-4">
        <p className="text-sm font-bold text-ink">Votre parcours en 3 étapes</p>
        <span className="sf-badge border-success-border bg-success-bg text-success">Simple & rapide</span>
      </div>

      <ul className="space-y-2.5">
        {steps.map((step, index) => {
          const Icon = step.icon
          return (
            <li
              key={step.title}
              className="flex items-center gap-3 rounded-control border border-border bg-canvas px-3.5 py-3"
            >
              <span
                aria-hidden="true"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600"
              >
                <Icon className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold text-ink">{step.title}</p>
                <p className="truncate text-2xs text-ink-muted">{step.subtitle}</p>
              </div>
              <span
                aria-hidden="true"
                className={cn(
                  'flex h-5 w-5 shrink-0 items-center justify-center rounded-full',
                  index < 3 ? 'bg-success-bg text-success' : 'bg-slate-100 text-slate-400',
                )}
              >
                <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="3">
                  <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
