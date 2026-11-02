import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

/**
 * Edge middleware.
 *
 * Responsibilities, in order:
 *  1. Refresh the Supabase session cookie on every navigation.
 *  2. Security headers on every response.
 *  3. A *first-pass* role gate. This is a UX optimisation, not the security
 *     boundary: the page layer and every Server Action re-check the session and
 *     the role against the database. Middleware alone is never sufficient,
 *     because Server Actions can be invoked directly by URL.
 */

const PUBLIC_PATHS = [
  '/',
  '/connexion',
  '/inscription',
  '/mot-de-passe-oublie',
  '/reinitialiser-mot-de-passe',
  '/verification-email',
  '/confidentialite',
  '/conditions-utilisation',
  '/contact',
  '/acces-refuse',
  '/faq',
  '/a-propos',
  // Operator-only diagnostics. Public so that it stays reachable precisely when
  // authentication is broken — which is the situation it exists to diagnose.
  '/etat-installation',
]

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.includes(pathname)) return true
  return false
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // --- 1. Session refresh + verified user ---------------------------------
  let user: Awaited<ReturnType<typeof updateSession>>['user'] = null
  let response = NextResponse.next({ request })

  try {
    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      const result = await updateSession(request)
      response = result.response
      user = result.user
    }
  } catch (error) {
    // Never let an auth outage take the whole site down; protected pages will
    // still redirect because they re-check the session server-side.
    console.error('[stageflow] middleware session refresh failed', error)
  }

  // --- 2. Role gate (fast redirect only) ----------------------------------
  const isAdminArea = pathname.startsWith('/admin')
  const isStagiaireArea = pathname.startsWith('/stagiaire')

  if ((isAdminArea || isStagiaireArea) && !user) {
    const loginUrl = new URL('/connexion', request.url)
    // `next` is validated again on the way back in (see safeRedirectPath).
    loginUrl.searchParams.set('next', pathname)
    const redirect = NextResponse.redirect(loginUrl)
    applySecurityHeaders(redirect)
    return redirect
  }

  // Signed-in users should not land on login/signup again.
  if (user && (pathname === '/connexion' || pathname === '/inscription')) {
    const url = new URL('/redirection', request.url)
    const redirect = NextResponse.redirect(url)
    applySecurityHeaders(redirect)
    return redirect
  }

  // Note: we intentionally do NOT read the role here. Middleware runs on the
  // edge without a guaranteed database round trip, and the role must come from
  // user_roles. The role-specific redirect happens in `app/redirection` and in
  // each protected layout, both of which query the database.

  // --- 3. Security headers -------------------------------------------------
  applySecurityHeaders(response)
  return response
}

function applySecurityHeaders(response: NextResponse) {
  const isDev = process.env.NODE_ENV !== 'production'

  // CSP compatible with Next.js (inline styles for styled-jsx/Tailwind runtime
  // class injection) and Supabase (REST + Realtime websockets).
  const supabaseHost = safeHost(process.env.NEXT_PUBLIC_SUPABASE_URL)
  const connectSrc = [
    "'self'",
    supabaseHost ? `https://${supabaseHost}` : '',
    supabaseHost ? `wss://${supabaseHost}` : '',
    isDev ? 'ws://localhost:*' : '',
    isDev ? 'http://localhost:*' : '',
  ]
    .filter(Boolean)
    .join(' ')

  const imgSrc = [
    "'self'",
    'data:',
    'blob:',
    supabaseHost ? `https://${supabaseHost}` : '',
  ]
    .filter(Boolean)
    .join(' ')

  const csp = [
    "default-src 'self'",
    // 'unsafe-inline' is required by Next.js' streaming bootstrap script.
    // Tightening this requires nonce plumbing through the app router.
    isDev
      ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
      : "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    `img-src ${imgSrc}`,
    "font-src 'self' data:",
    `connect-src ${connectSrc}`,
    "form-action 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "object-src 'none'",
    'upgrade-insecure-requests',
  ].join('; ')

  response.headers.set('Content-Security-Policy', csp)
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  )
  response.headers.set('Cross-Origin-Opener-Policy', 'same-origin')

  // HSTS only on real HTTPS deployments.
  if (!isDev) {
    response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload')
  }

  return response
}

function safeHost(url: string | undefined): string | null {
  if (!url) return null
  try {
    return new URL(url).host
  } catch {
    return null
  }
}

export const config = {
  /**
   * Run on everything except static assets and image optimisation, so the
   * session cookie is refreshed for real navigations without wasting an edge
   * invocation on every font file.
   */
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|otf)$).*)',
  ],
}

export { isPublicPath }
