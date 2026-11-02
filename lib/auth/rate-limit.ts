import type { AppRole } from '@/lib/auth/types'
import type { SessionUser } from '@/lib/auth/session'
import { GENERIC_ERROR } from '@/lib/auth/types'
import type { ActionResult } from '@/lib/auth/types'

/**
 * Server-side rate limiting.
 *
 * IMPORTANT LIMITATION — read before trusting it:
 * the store below is a per-process in-memory counter. On a single long-running
 * Node server it is effective. On a serverless platform (Vercel) each instance
 * has its own memory, so the effective limit becomes (limit × instances).
 *
 * It is therefore a *best-effort* secondary layer. The primary layers are:
 *   1. Supabase Auth's own built-in abuse throttling on /auth/v1/token
 *   2. the platform's edge/WAF/DDoS protection
 *   3. database constraints (e.g. one active application per applicant)
 *
 * For a hard guarantee, back this with Upstash Redis / Vercel KV. The interface
 * is already async, so swapping the store needs no call-site changes.
 */

type Bucket = { count: number; resetAt: number }

const buckets = new Map<string, Bucket>()
const MAX_TRACKED_KEYS = 10_000

export type RateLimitPolicy = {
  windowMs: number
  limit: number
}

export const RATE_LIMITS = {
  signIn: { windowMs: 10 * 60_000, limit: 8 },
  signUp: { windowMs: 60 * 60_000, limit: 5 },
  passwordReset: { windowMs: 60 * 60_000, limit: 4 },
  resendVerification: { windowMs: 15 * 60_000, limit: 3 },
  verifySignupOtp: { windowMs: 10 * 60_000, limit: 6 },
  profileUpdate: { windowMs: 60_000, limit: 20 },
  draftSave: { windowMs: 60_000, limit: 40 },
  documentUpload: { windowMs: 60_000, limit: 12 },
  submitApplication: { windowMs: 60_000, limit: 5 },
  adminSearch: { windowMs: 60_000, limit: 90 },
  adminDecision: { windowMs: 60_000, limit: 20 },
  /** Second-factor codes: few attempts, short window — six digits guessable. */
  mfaVerify: { windowMs: 10 * 60_000, limit: 6 },
  /** Enrolment starts + confirmations share one bucket: infrequent actions. */
  mfaEnroll: { windowMs: 15 * 60_000, limit: 8 },
  mfaUnenroll: { windowMs: 15 * 60_000, limit: 5 },
} as const satisfies Record<string, RateLimitPolicy>

export type RateLimitResult = {
  allowed: boolean
  remaining: number
  retryAfterSeconds: number
}

export function checkRateLimit(key: string, policy: RateLimitPolicy): RateLimitResult {
  const now = Date.now()
  const bucket = buckets.get(key)

  if (!bucket || bucket.resetAt <= now) {
    if (buckets.size >= MAX_TRACKED_KEYS) sweepExpired(now)
    buckets.set(key, { count: 1, resetAt: now + policy.windowMs })
    return { allowed: true, remaining: policy.limit - 1, retryAfterSeconds: 0 }
  }

  if (bucket.count >= policy.limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    }
  }

  bucket.count += 1
  return { allowed: true, remaining: policy.limit - bucket.count, retryAfterSeconds: 0 }
}

function sweepExpired(now: number) {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key)
  }
}

/** Test helper: clear all counters between test cases. */
export function resetRateLimits() {
  buckets.clear()
}

/* -------------------------------------------------------------------------- */
/* Request identity helpers                                                    */
/* -------------------------------------------------------------------------- */

/** Best-effort client IP. Trusts platform headers, which the platform sets. */
export async function getClientIp(): Promise<string> {
  try {
    const { headers } = await import('next/headers')
    const h = await headers()
    const forwarded = h.get('x-forwarded-for')
    if (forwarded) return forwarded.split(',')[0]?.trim() ?? 'unknown'
    return h.get('x-real-ip') ?? h.get('cf-connecting-ip') ?? 'unknown'
  } catch {
    return 'unknown'
  }
}

/**
 * Guard a mutation. Returns a discriminated result so callers can simply
 * `if (!gate.allowed) return gate.result`.
 */
export async function enforceRateLimit(
  scope: keyof typeof RATE_LIMITS,
  identifier: string,
): Promise<{ allowed: true } | { allowed: false; result: ActionResult<never> }> {
  const policy = RATE_LIMITS[scope]
  const { allowed, retryAfterSeconds } = checkRateLimit(`${scope}:${identifier}`, policy)

  if (!allowed) {
    const minutes = Math.ceil(retryAfterSeconds / 60)
    return {
      allowed: false,
      result: {
        ok: false,
        error: `Trop de tentatives. Veuillez réessayer dans ${minutes} minute${minutes > 1 ? 's' : ''}.`,
      },
    }
  }

  return { allowed: true }
}

/* -------------------------------------------------------------------------- */
/* ActionResult helpers                                                        */
/* -------------------------------------------------------------------------- */

export function ok<T>(data: T, message?: string): ActionResult<T> {
  return { ok: true, data, message }
}

export function fail(error: string, fieldErrors?: Record<string, string[]>): ActionResult<never> {
  return { ok: false, error, fieldErrors }
}

/**
 * Turn an unexpected throw into a safe, non-disclosing result.
 * Raw Postgres/SDK messages leak schema and constraint names, so they are
 * logged server-side and never returned to the client.
 */
/**
 * Detect "the request never reached the auth provider".
 *
 * Supabase reports this in two shapes depending on the call site:
 *   - a thrown/returned `AuthRetryableFetchError` with `status: 0`
 *   - a plain `fetch failed` whose `cause` is ENOTFOUND / ECONNREFUSED
 *
 * This is deliberately separate from a credentials or database error: telling a
 * user to "try again in a moment" when the host does not resolve is a lie, and
 * it sends whoever maintains the deployment looking in the wrong place.
 */
function isProviderUnreachable(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false

  const candidate = error as {
    name?: string
    status?: number
    message?: string
    cause?: { code?: string }
  }

  if (candidate.status === 0) return true
  if (candidate.name === 'AuthRetryableFetchError') return true

  const message = (candidate.message ?? '').toLowerCase()
  if (
    message.includes('fetch failed') ||
    message.includes('enotfound') ||
    message.includes('econnrefused') ||
    message.includes('etimedout')
  ) {
    return true
  }

  const code = candidate.cause?.code
  return code === 'ENOTFOUND' || code === 'ECONNREFUSED' || code === 'ETIMEDOUT'
}

export function failSafe(error: unknown, fallback = GENERIC_ERROR): ActionResult<never> {
  if (process.env.NODE_ENV !== 'production') {
    console.error('[stageflow] action failed:', error)
  } else {
    const pgCode =
      typeof error === 'object' && error !== null && 'code' in error
        ? String((error as { code: unknown }).code)
        : undefined
    console.error('[stageflow] action failed', { pgCode })
  }

  // The auth provider could not be reached at all. Retrying cannot help, so do
  // not say "réessayez". In development, name the file to fix; in production,
  // stay accurate without disclosing infrastructure details.
  if (isProviderUnreachable(error)) {
    return {
      ok: false,
      error:
        process.env.NODE_ENV === 'production'
          ? 'Le service d’authentification est momentanément indisponible. Veuillez contacter l’administrateur du site.'
          : 'Le service d’authentification est injoignable. Vérifiez que NEXT_PUBLIC_SUPABASE_URL pointe vers un projet Supabase existant et actif, puis redémarrez le serveur.',
    }
  }

  // A missing Supabase configuration is an OPERATOR problem, not a user error.
  // Returning the generic "try again in a moment" message here would be a lie:
  // retrying can never succeed until .env.local is filled in. Say so, and say
  // exactly which file to fix, so the failure is diagnosable in one step.
  //
  // This reveals no secret: the variable name is already in .env.example and
  // in the deployment docs. It is suppressed in production so that a
  // misconfigured deployment is not advertising its internals to visitors.
  if (
    process.env.NODE_ENV !== 'production' &&
    error instanceof Error &&
    error.message.includes('Missing required environment variable')
  ) {
    return {
      ok: false,
      error:
        'Aucune base de données n’est configurée. Créez le fichier .env.local à partir de .env.example ' +
        '(variables NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY), puis redémarrez le serveur.',
    }
  }

  return { ok: false, error: fallback }
}

/** Require a session, returning a typed failure when absent. */
export async function requireSession(): Promise<
  { ok: true; user: SessionUser } | { ok: false; result: ActionResult<never> }
> {
  const { getSessionUser } = await import('@/lib/auth/session')
  const user = await getSessionUser()
  if (!user) {
    return {
      ok: false,
      result: { ok: false, error: 'Votre session a expiré. Veuillez vous reconnecter.' },
    }
  }
  return { ok: true, user }
}

/** Require a specific role, returning a typed failure otherwise. */
export async function requireRole(
  role: AppRole,
): Promise<{ ok: true; user: SessionUser } | { ok: false; result: ActionResult<never> }> {
  const session = await requireSession()
  if (!session.ok) return session
  if (session.user.role !== role) {
    return { ok: false, result: { ok: false, error: 'Accès refusé.' } }
  }
  return session
}

/** Map a Postgres RAISE message to a safe, user-facing French message. */
export function mapPgErrorToFrench(message: string | undefined): string {
  if (!message) return GENERIC_ERROR
  if (message.includes('CONFLICT')) {
    return 'Cette action entre en conflit avec l’état actuel de la demande. Actualisez la page et réessayez.'
  }
  if (message.includes('FORBIDDEN')) return 'Accès refusé.'
  if (message.includes('NOT_FOUND')) return 'Élément introuvable.'
  if (message.includes('VALIDATION')) {
    const detail = message.split('VALIDATION:')[1]?.trim()
    return detail ? `Données invalides : ${detail}` : 'Données invalides.'
  }
  if (message.includes('ACTIVE_APPLICATION_EXISTS')) {
    return 'Vous avez déjà une demande en cours. Vous ne pouvez pas en créer une deuxième.'
  }
  return GENERIC_ERROR
}
