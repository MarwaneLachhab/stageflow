import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Sign-out endpoint.
 *
 * Implemented as a POST-only route handler so a logout cannot be triggered by a
 * cross-site GET (e.g. an <img src="/api/auth/signout"> in a third-party page).
 * `supabase.auth.signOut()` clears all auth cookies through the SDK — we never
 * manipulate session tokens by hand.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  await supabase.auth.signOut({ scope: 'global' })

  const url = new URL('/connexion', request.url)
  url.searchParams.set('deconnexion', '1')
  const response = NextResponse.redirect(url, { status: 303 })

  // Belt and braces: expire any residual Supabase cookie for this origin.
  if (user) {
    for (const name of ['sb-access-token', 'sb-refresh-token']) {
      response.cookies.set(name, '', { path: '/', maxAge: 0 })
    }
  }

  return response
}

/** Explicitly reject GET so logout is never a link-followable action. */
export async function GET() {
  return new NextResponse('Method Not Allowed', {
    status: 405,
    headers: { Allow: 'POST' },
  })
}
