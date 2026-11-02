/**
 * Redirect-target validation.
 *
 * Lives in its own module (rather than in `lib/supabase/middleware.ts`) so it can
 * be unit-tested and reused by Server Actions without pulling `next/server` into
 * the import graph.
 *
 * The rule: only a same-origin *relative path* is ever honoured. Everything else
 * falls back. This is the single defence against an open redirect through the
 * `next` query parameter, which is attacker-controllable on `/connexion`.
 */

const FALLBACK_ORIGIN = 'http://localhost'

/**
 * Return `candidate` when it is a safe same-origin path, otherwise `fallback`.
 *
 * Rejected shapes:
 *   - absolute URLs          `https://evil.com`
 *   - protocol-relative      `//evil.com`
 *   - backslash tricks       `/\evil.com`, `/\\evil.com`, any `\`
 *   - scheme payloads        `javascript:alert(1)`
 *   - anything not starting with `/`
 */
export function safeRedirectPath(
  candidate: string | null | undefined,
  fallback: string,
): string {
  if (!candidate) return fallback

  const trimmed = candidate.trim()
  if (!trimmed.startsWith('/')) return fallback
  if (trimmed.startsWith('//') || trimmed.startsWith('/\\')) return fallback
  if (trimmed.includes('\\')) return fallback

  // Reject protocol-relative or scheme-injected payloads that slip past the above.
  try {
    const url = new URL(trimmed, FALLBACK_ORIGIN)
    if (url.origin !== FALLBACK_ORIGIN) return fallback
  } catch {
    return fallback
  }

  return trimmed
}
