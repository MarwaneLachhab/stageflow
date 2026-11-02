'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import {
  Bell,
  ChevronDown,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Search,
  ShieldCheck,
  Clock,
  User,
  Users,
  X,
  LifeBuoy,
  BriefcaseBusiness,
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { Logo } from '@/components/ui/logo'
import { Avatar } from '@/components/ui/avatar'
import { initials } from '@/lib/utils/format'

/**
 * AppShell — the navy sidebar + light topbar frame shared by both roles.
 *
 * The navigation is data-driven by `role`, so a stagiaire can never render an
 * admin menu item even if the component were reused by mistake. Admin-only
 * routes are additionally blocked by middleware and by the page layer.
 *
 * Responsive behaviour (mockup requirement):
 *   ≥1024px  fixed 248px rail
 *   <1024px  off-canvas drawer with a scrim, closed on navigation
 */

export type NavItem = {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  /** Exact match only — used for the role home route. */
  exact?: boolean
}

export const STAGIAIRE_NAV: NavItem[] = [
  { href: '/stagiaire/tableau-de-bord', label: 'Tableau de bord', icon: LayoutDashboard },
  { href: '/stagiaire/profil', label: 'Mon profil', icon: User },
  { href: '/stagiaire/demande', label: 'Ma demande', icon: FileText },
  { href: '/stagiaire/documents', label: 'Mes documents', icon: FileText },
  { href: '/stagiaire/suivi', label: 'Suivi de ma demande', icon: Clock },
  { href: '/stagiaire/support', label: 'Support technique', icon: LifeBuoy },
]

export const ADMIN_NAV: NavItem[] = [
  { href: '/admin/tableau-de-bord', label: 'Tableau de bord', icon: LayoutDashboard },
  { href: '/admin/demandes', label: 'Toutes les demandes', icon: Users },
  { href: '/admin/statistiques', label: 'Statistiques', icon: Clock },
  { href: '/admin/support', label: 'Support technique', icon: LifeBuoy },
  { href: '/admin/utilisateurs', label: 'Utilisateurs', icon: User },
  { href: '/admin/offres', label: 'Offres et établissements', icon: BriefcaseBusiness },
]

type ShellUser = {
  firstName: string
  lastName: string
  email: string
  roleLabel: string
}

export function AppShell({
  role,
  user,
  breadcrumb,
  unreadCount = 0,
  children,
}: {
  role: 'stagiaire' | 'admin'
  user: ShellUser
  /** e.g. ['Espace stagiaire', 'Tableau de bord'] */
  breadcrumb: string[]
  unreadCount?: number
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  const nav = role === 'admin' ? ADMIN_NAV : STAGIAIRE_NAV
  const spaceLabel = role === 'admin' ? 'Espace Administration' : 'Espace Stagiaire'
  const spaceHint = 'Portail de gestion'
  const searchPlaceholder = role === 'admin' ? 'Rechercher…' : 'Rechercher…'

  /**
   * Breadcrumb tail.
   *
   * The layouts can only pass a static value, so every screen used to display
   * "Tableau de bord" in the top bar — including notifications and the
   * application detail. The label is now derived from the current path, with the
   * passed value kept as a fallback for routes not listed here.
   */
  const ROUTE_LABELS: Record<string, string> = {
    '/stagiaire/tableau-de-bord': 'Tableau de bord',
    '/stagiaire/profil': 'Mon profil',
    '/stagiaire/demande': 'Ma demande',
    '/stagiaire/documents': 'Mes documents',
    '/stagiaire/suivi': 'Suivi de ma demande',
    '/stagiaire/notifications': 'Notifications',
    '/stagiaire/support': 'Support technique',
    '/admin/tableau-de-bord': 'Tableau de bord',
    '/admin/demandes': 'Demandes de stage',
    '/admin/statistiques': 'Statistiques',
    '/admin/notifications': 'Notifications',
    '/admin/support': 'Support technique',
    '/admin/utilisateurs': 'Utilisateurs',
    '/admin/offres': 'Offres et établissements',
    '/securite': 'Sécurité',
  }
  const currentCrumb =
    ROUTE_LABELS[pathname] ??
    (pathname.startsWith('/admin/demandes/')
      ? 'Détail de la demande'
      : breadcrumb[breadcrumb.length - 1])
  const crumbs = [...breadcrumb.slice(0, -1), currentCrumb]

  const isActive = (item: NavItem) =>
    item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`)

  const sidebarContent = (
    <>
      <div className="flex h-16 shrink-0 items-center px-5">
        <Logo variant="inverse" />
      </div>

      <div className="px-4 pb-2">
        <div className="flex items-center gap-2.5 rounded-control bg-white/[0.06] px-3 py-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10">
            <LayoutDashboard className="h-4 w-4 text-white/80" aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[13px] font-semibold text-white">
              {spaceLabel}
            </span>
            <span className="block truncate text-2xs text-slate-400">{spaceHint}</span>
          </span>
        </div>
      </div>

      <nav aria-label="Navigation principale" className="flex-1 overflow-y-auto sf-scrollbar-thin px-3 pb-4">
        <p className="sf-sidebar-label">Menu principal</p>
        <ul className="space-y-1">
          {nav.map((item) => {
            const Icon = item.icon
            const active = isActive(item)
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  aria-current={active ? 'page' : undefined}
                  className={cn('sf-sidebar-link', active && 'sf-sidebar-link-active')}
                >
                  <Icon className="h-4.5 w-4.5 shrink-0" aria-hidden="true" />
                  <span className="truncate">{item.label}</span>
                </Link>
              </li>
            )
          })}
        </ul>

        <p className="sf-sidebar-label">Système</p>
        <ul className="space-y-1">
          {/*
            The former "Paramètres" entry pointed at /stagiaire/parametres and
            /admin/parametres, neither of which exists — it landed on the 404
            screen. Settings are not implemented, so per the build spec the
            entry is replaced by /securite, which does exist (password, 2FA).
          */}
          <li>
            <Link
              href="/securite"
              onClick={() => setMobileOpen(false)}
              className={cn(
                'sf-sidebar-link',
                isActive({ href: '/securite', label: '', icon: ShieldCheck }) &&
                  'sf-sidebar-link-active',
              )}
            >
              <ShieldCheck className="h-4.5 w-4.5 shrink-0" aria-hidden="true" />
              <span>Sécurité</span>
            </Link>
          </li>
          <li>
            <form action="/api/auth/signout" method="post">
              <button type="submit" className="sf-sidebar-link w-full">
                <LogOut className="h-4.5 w-4.5 shrink-0" aria-hidden="true" />
                <span>Déconnexion</span>
              </button>
            </form>
          </li>
        </ul>
      </nav>

      <div className="shrink-0 border-t border-white/[0.08] p-3">
        <div className="flex items-center gap-3 rounded-control px-2 py-2">
          <Avatar
            initials={initials(user.firstName, user.lastName)}
            tone="sand"
            size="sm"
          />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-semibold text-white">
              {user.firstName} {user.lastName}
            </span>
            <span className="block truncate text-2xs text-slate-400">{user.roleLabel}</span>
          </span>
        </div>
      </div>
    </>
  )

  return (
    <div className="min-h-screen bg-canvas">
      {/* Skip link — first focusable element on the page. */}
      <a
        href="#contenu-principal"
        className="sf-sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[70] focus:rounded-control focus:bg-primary-600 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
      >
        Aller au contenu principal
      </a>

      {/* Desktop rail */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[248px] flex-col bg-navy lg:flex">
        {sidebarContent}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Fermer le menu"
            onClick={() => setMobileOpen(false)}
            className="absolute inset-0 cursor-default bg-ink/50"
          />
          <aside className="relative flex h-full w-[268px] flex-col bg-navy animate-fade-in">
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              aria-label="Fermer le menu"
              className="absolute right-3 top-4 flex h-9 w-9 items-center justify-center rounded-control text-slate-300 hover:bg-white/10 hover:text-white"
            >
              <X className="h-4.5 w-4.5" aria-hidden="true" />
            </button>
            {sidebarContent}
          </aside>
        </div>
      )}

      <div className="lg:pl-[248px]">
        {/* Topbar */}
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-surface/95 px-4 backdrop-blur sm:px-6">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Ouvrir le menu de navigation"
            aria-expanded={mobileOpen}
            className="sf-icon-btn -ml-1 lg:hidden"
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </button>

          {/* Breadcrumb */}
          <nav aria-label="Fil d’Ariane" className="hidden min-w-0 sm:block">
            <ol className="flex items-center gap-2 text-sm">
              {crumbs.map((crumb, index) => (
                <li key={`${crumb}-${index}`} className="flex items-center gap-2">
                  {index > 0 && (
                    <span className="text-ink-faint" aria-hidden="true">
                      /
                    </span>
                  )}
                  <span
                    className={cn(
                      'truncate',
                      index === crumbs.length - 1
                        ? 'font-semibold text-ink'
                        : 'text-ink-muted',
                    )}
                    aria-current={index === crumbs.length - 1 ? 'page' : undefined}
                  >
                    {crumb}
                  </span>
                </li>
              ))}
            </ol>
          </nav>

          <div className="ml-auto flex items-center gap-2">
            {/*
              Global search. It was previously an <input> with no form, no
              handler and no effect — a dead control. It is now a real GET form
              that drives the server-side filter on /admin/demandes (the only
              screen with a searchable list). Stagiaires have no searchable
              dataset, so the field is hidden for them rather than shown inert.
            */}
            {role === 'admin' && (
              <form action="/admin/demandes" method="get" className="relative hidden md:block">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  name="q"
                  placeholder={searchPlaceholder}
                  aria-label="Rechercher une demande"
                  className="h-10 w-52 rounded-control border border-border bg-canvas pl-9 pr-3 text-sm placeholder:text-ink-subtle focus:border-primary-600 focus:bg-surface focus:outline-none focus:ring-2 focus:ring-primary-600/15 lg:w-64"
                />
              </form>
            )}

            {/* Notification bell — count comes from the database, never faked. */}
            <Link
              href={role === 'admin' ? '/admin/notifications' : '/stagiaire/notifications'}
              aria-label={
                unreadCount > 0
                  ? `Notifications, ${unreadCount} non lue${unreadCount > 1 ? 's' : ''}`
                  : 'Notifications'
              }
              className="sf-icon-btn relative"
            >
              <Bell className="h-4.5 w-4.5" aria-hidden="true" />
              {unreadCount > 0 && (
                <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Link>

            {/* Account menu */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                className="flex items-center gap-2 rounded-control p-1 pr-2 transition-colors hover:bg-canvas"
              >
                <Avatar
                  initials={initials(user.firstName, user.lastName)}
                  size="sm"
                  tone="sand"
                />
                <ChevronDown className="hidden h-3.5 w-3.5 text-ink-muted sm:block" aria-hidden="true" />
                <span className="sf-sr-only">Menu du compte</span>
              </button>

              {menuOpen && (
                <>
                  <button
                    type="button"
                    tabIndex={-1}
                    aria-label="Fermer le menu"
                    onClick={() => setMenuOpen(false)}
                    className="fixed inset-0 z-10 cursor-default"
                  />
                  <div
                    role="menu"
                    className="absolute right-0 top-full z-20 mt-2 w-60 overflow-hidden rounded-card border border-border bg-surface shadow-overlay animate-fade-in"
                  >
                    <div className="border-b border-border px-4 py-3">
                      <p className="truncate text-sm font-semibold text-ink">
                        {user.firstName} {user.lastName}
                      </p>
                      <p className="truncate text-xs text-ink-muted">{user.email}</p>
                      <p className="mt-1 text-2xs font-semibold uppercase tracking-wide text-primary-600">
                        {user.roleLabel}
                      </p>
                    </div>
                    <div className="p-1.5">
                      {/*
                        Administrators have no profile screen of their own, so
                        the menu entry points at their dashboard instead of the
                        old /admin/parametres 404.
                      */}
                      <Link
                        href={role === 'admin' ? '/admin/tableau-de-bord' : '/stagiaire/profil'}
                        role="menuitem"
                        onClick={() => setMenuOpen(false)}
                        className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-ink hover:bg-canvas"
                      >
                        <User className="h-4 w-4 text-ink-muted" aria-hidden="true" />
                        {role === 'admin' ? 'Tableau de bord' : 'Mon profil'}
                      </Link>
                      <Link
                        href="/securite"
                        role="menuitem"
                        onClick={() => setMenuOpen(false)}
                        className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-ink hover:bg-canvas"
                      >
                        <ShieldCheck className="h-4 w-4 text-ink-muted" aria-hidden="true" />
                        Sécurité
                      </Link>
                      <form action="/api/auth/signout" method="post">
                        <button
                          type="submit"
                          role="menuitem"
                          className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm text-danger hover:bg-danger-bg"
                        >
                          <LogOut className="h-4 w-4" aria-hidden="true" />
                          Se déconnecter
                        </button>
                      </form>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        <main id="contenu-principal" className="px-4 py-6 sm:px-6 sm:py-8">
          <div className="mx-auto max-w-[1180px]">{children}</div>
        </main>
      </div>
    </div>
  )
}
