import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { safeRedirectPath } from '@/lib/auth/redirect'

/**
 * Supabase Auth callback. Handles two flows:
 *   - `?code=`  PKCE code exchange after clicking an e-mail link (signup
 *               confirmation, password recovery).
 *   - `?token_hash=&type=` the e-mail OTP flow, verified server-side.
 *
 * The `next` target is validated so this can never be used as an open redirect.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type')
  const rawNext = searchParams.get('next')

  const next = safeNext(rawNext)

  const supabase = await createClient()

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(new URL(next, origin))
    }
    console.error('[stageflow] auth callback code exchange failed', error.message)
    return NextResponse.redirect(new URL('/connexion?erreur=lien-invalide', origin))
  }

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as 'signup' | 'recovery' | 'email_change' | 'email' | 'invite' | 'magiclink',
    })
    if (!error) {
      // A recovery link must land on the password form, not the dashboard.
      const destination = type === 'recovery' ? '/reinitialiser-mot-de-passe' : next
      return NextResponse.redirect(new URL(destination, origin))
    }
    console.error('[stageflow] auth callback otp verification failed', error.message)
    return NextResponse.redirect(new URL('/connexion?erreur=lien-invalide', origin))
  }

  return NextResponse.redirect(new URL('/connexion?erreur=lien-invalide', origin))
}

/**
 * Same-origin relative path only, via the shared helper. Previously this was a
 * second, slightly different implementation of the same rule — two places to get
 * wrong. One helper, one behaviour.
 */
function safeNext(candidate: string | null): string {
  return safeRedirectPath(candidate, '/redirection')
}
