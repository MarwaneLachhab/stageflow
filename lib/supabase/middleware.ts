import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { CookieOptions } from '@supabase/ssr'

type CookieToSet = { name: string; value: string; options: CookieOptions }

/**
 * Refreshes the Supabase session on every navigation and returns both the
 * response that carries the updated cookies and the resolved user.
 *
 * Two defences are implemented here:
 *  1. Session refresh with the *verified* server identity — we call
 *     `auth.getUser()` (which validates the JWT with the Auth server) rather
 *     than trusting `getSession()` (which merely reads the cookie).
 *  2. Open-redirect protection — the `next` query parameter is only honoured
 *     when it is a same-origin relative path.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: CookieToSet[]) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value)
          }
          response = NextResponse.next({ request })
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options)
          }
        },
      },
    },
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  return { response, user, supabase }
}

/**
 * Re-exported for backwards compatibility. The implementation moved to
 * `lib/auth/redirect.ts` so it can be unit-tested and reused by Server Actions.
 */
export { safeRedirectPath } from '@/lib/auth/redirect'
