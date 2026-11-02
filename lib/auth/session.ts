import { createClient } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/env'
import type { AppRole } from '@/lib/auth/types'

export type SessionUser = {
  id: string
  email: string | null
  role: AppRole
  emailConfirmed: boolean
}

/**
 * Resolve the current session using the *verified* identity.
 *
 * `auth.getUser()` asks the Auth server to validate the JWT. We never trust
 * `getSession()` here, and we never read a role from a cookie, header, query
 * parameter or request body — the role comes from the `user_roles` table, which
 * is not client-writable.
 *
 * If the deployment has no Supabase credentials at all, this returns `null`
 * (a guest) instead of throwing. Every caller already treats `null` as
 * "not signed in", so the public pages render and explain the missing setup,
 * rather than the whole application collapsing into an unhandled 500. This
 * fails *closed*: an unconfigured deployment is treated as having no users.
 * It never falls back to a default identity.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  if (!isSupabaseConfigured()) return null

  const supabase = await createClient()

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) return null

  const { data: roleRow } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle()

  return {
    id: user.id,
    email: user.email ?? null,
    // Fail closed: an unknown role is treated as the least-privileged role.
    role: (roleRow?.role as AppRole | undefined) ?? 'stagiaire',
    emailConfirmed: Boolean(user.email_confirmed_at ?? user.confirmed_at),
  }
}

/** Where a signed-in user belongs. */
export function homeRouteForRole(role: AppRole): string {
  return role === 'admin' ? '/admin/tableau-de-bord' : '/stagiaire/tableau-de-bord'
}

/** Where a signed-out visitor is sent when hitting a protected route. */
export const LOGIN_ROUTE = '/connexion'

/** Where a signed-in-but-not-yet-2FA visitor completes the code step. */
export const MFA_VERIFICATION_ROUTE = '/connexion/verification'

/**
 * Second-factor state of the current session.
 *
 * The facts this relies on were verified against GoTrue (see
 * `scripts/probe-mfa.mjs`): a password grant hands out an aal1 session even
 * when a verified TOTP factor exists (`nextLevel: 'aal2'`). Enforcing the
 * second factor is therefore the application's job — this helper is that
 * enforcement, called from every protected layout and every security action.
 */
export type MfaState = {
  /** True when a verified factor exists but the code step has not been done. */
  enforced: boolean
  /** True once the code step succeeded in this session (currentLevel aal2). */
  aal2: boolean
}

export async function getMfaState(): Promise<MfaState> {
  if (!isSupabaseConfigured()) return { enforced: false, aal2: false }

  const supabase = await createClient()
  const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()

  if (!data) return { enforced: false, aal2: false }

  return {
    enforced: data.nextLevel === 'aal2' && data.currentLevel !== 'aal2',
    aal2: data.currentLevel === 'aal2',
  }
}

/**
 * Require the stagiaire workspace. Returns null when the caller is not signed in
 * OR is an admin — callers must redirect, so the two cases are handled by
 * `resolveWorkspaceAccess` below.
 */
export async function requireStagiaire(): Promise<SessionUser | null> {
  const user = await getSessionUser()
  if (!user || user.role !== 'stagiaire') return null
  return user
}

/** Require the administration workspace. */
export async function requireAdmin(): Promise<SessionUser | null> {
  const user = await getSessionUser()
  if (!user || user.role !== 'admin') return null
  return user
}

/**
 * Distinguish "not signed in" from "signed in with the wrong role" so a
 * protected layout can send a guest to the login page and a misplaced
 * administrator to their own area.
 *
 * A fourth case exists: a signed-in user whose account carries a verified TOTP
 * factor but whose session is still aal1 (password only). They are bounced to
 * the verification step before ANY protected content is resolved — including
 * the profile and notification queries the layouts perform.
 */
export async function resolveWorkspaceAccess(
  expected: AppRole,
): Promise<
  | { kind: 'ok'; user: SessionUser }
  | { kind: 'guest' }
  | { kind: 'wrong-role'; redirectTo: string }
  | { kind: 'mfa-required' }
> {
  const user = await getSessionUser()
  if (!user) return { kind: 'guest' }
  if (user.role !== expected) {
    return { kind: 'wrong-role', redirectTo: homeRouteForRole(user.role) }
  }

  const mfa = await getMfaState()
  if (mfa.enforced) return { kind: 'mfa-required' }

  return { kind: 'ok', user }
}
