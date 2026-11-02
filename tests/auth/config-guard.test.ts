import { afterEach, describe, expect, it, vi } from 'vitest'
import { getSupabaseConfigIssue, isPlaceholderValue, isSupabaseConfigured } from '@/lib/env'
import { failSafe, ok, fail, mapPgErrorToFrench } from '@/lib/auth/rate-limit'
import { GENERIC_ERROR } from '@/lib/auth/types'

/**
 * Configuration detection and error classification.
 *
 * These tests cover the defect that produced the misleading registration error:
 * `.env.local` was copied from `.env.example` verbatim, so the URL pointed at a
 * host that does not exist (`your-project-ref.supabase.co` → ENOTFOUND). The
 * application treated that as "configured" and surfaced a generic failure.
 */

const REAL_URL = 'https://abcdefghijklmnop.supabase.co'
const REAL_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.realistic-anon-key-value'

function setEnv(url: string | undefined, key: string | undefined) {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', url ?? '')
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', key ?? '')
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('isPlaceholderValue', () => {
  it('detects the URL placeholder shipped in .env.example', () => {
    expect(isPlaceholderValue('https://your-project-ref.supabase.co')).toBe(true)
  })

  it('detects the anon-key placeholder', () => {
    expect(isPlaceholderValue('your-anon-key')).toBe(true)
  })

  it('detects the service-role placeholder', () => {
    expect(isPlaceholderValue('your-service-role-key')).toBe(true)
  })

  it('is case-insensitive', () => {
    expect(isPlaceholderValue('https://YOUR-PROJECT-REF.supabase.co')).toBe(true)
  })

  it('does not flag a real-looking project URL', () => {
    expect(isPlaceholderValue(REAL_URL)).toBe(false)
  })

  it('does not flag a real-looking key', () => {
    expect(isPlaceholderValue(REAL_KEY)).toBe(false)
  })

  it('treats empty and undefined as "not a placeholder"', () => {
    expect(isPlaceholderValue('')).toBe(false)
    expect(isPlaceholderValue(undefined)).toBe(false)
    expect(isPlaceholderValue(null)).toBe(false)
  })
})

describe('getSupabaseConfigIssue', () => {
  it('reports missing variables', () => {
    setEnv(undefined, undefined)
    expect(getSupabaseConfigIssue()).toMatch(/Aucune base de données n’est configurée/)
  })

  it('reports a URL without a key', () => {
    setEnv(REAL_URL, undefined)
    expect(getSupabaseConfigIssue()).toMatch(/Aucune base de données/)
  })

  it('reports the .env.example placeholders explicitly', () => {
    setEnv('https://your-project-ref.supabase.co', 'your-anon-key')
    const issue = getSupabaseConfigIssue()
    expect(issue).toMatch(/valeurs d’exemple/)
    expect(issue).toMatch(/\.env\.local/)
  })

  it('reports a placeholder key even when the URL is real', () => {
    setEnv(REAL_URL, 'your-anon-key')
    expect(getSupabaseConfigIssue()).toMatch(/valeurs d’exemple/)
  })

  it('rejects a non-https URL', () => {
    setEnv('http://abcdefgh.supabase.co', REAL_KEY)
    expect(getSupabaseConfigIssue()).toMatch(/https/)
  })

  it('rejects a host that is not a Supabase project', () => {
    setEnv('https://example.org', REAL_KEY)
    expect(getSupabaseConfigIssue()).toMatch(/URL de projet Supabase/)
  })

  it('rejects a malformed URL', () => {
    setEnv('not-a-url', REAL_KEY)
    expect(getSupabaseConfigIssue()).toMatch(/URL valide/)
  })

  it('returns null for a plausible configuration', () => {
    setEnv(REAL_URL, REAL_KEY)
    expect(getSupabaseConfigIssue()).toBeNull()
  })

  it('accepts a .supabase.in host', () => {
    setEnv('https://abcdefghijklmnop.supabase.in', REAL_KEY)
    expect(getSupabaseConfigIssue()).toBeNull()
  })

  it('accepts the local Supabase CLI stack on loopback', () => {
    setEnv('http://127.0.0.1:54321', REAL_KEY)
    expect(getSupabaseConfigIssue()).toBeNull()
  })

  it('accepts http://localhost:54321 for local development', () => {
    setEnv('http://localhost:54321', REAL_KEY)
    expect(getSupabaseConfigIssue()).toBeNull()
  })

  it('still rejects an http hosted URL — the loopback exception is the only one', () => {
    setEnv('http://abcdefgh.supabase.co', REAL_KEY)
    expect(getSupabaseConfigIssue()).toMatch(/https/)
  })
})

describe('isSupabaseConfigured', () => {
  it('is false when the file still contains placeholders', () => {
    // This is the regression guard: the old implementation only checked for
    // non-empty strings, so placeholders counted as "configured".
    setEnv('https://your-project-ref.supabase.co', 'your-anon-key')
    expect(isSupabaseConfigured()).toBe(false)
  })

  it('is false when the variables are absent', () => {
    setEnv(undefined, undefined)
    expect(isSupabaseConfigured()).toBe(false)
  })

  it('is true for a plausible configuration', () => {
    setEnv(REAL_URL, REAL_KEY)
    expect(isSupabaseConfigured()).toBe(true)
  })
})

describe('failSafe — provider unreachable', () => {
  it('does not tell the user to retry when the host does not resolve', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})

    // The exact shape Supabase produced in the server log.
    const error = Object.assign(new Error('fetch failed'), {
      name: 'AuthRetryableFetchError',
      status: 0,
      __isAuthError: true,
      cause: { code: 'ENOTFOUND' },
    })

    const result = failSafe(error, 'La création du compte a échoué. Veuillez réessayer.')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).not.toBe(GENERIC_ERROR)
      expect(result.error).not.toContain('La création du compte a échoué')
      expect(result.error).toMatch(/injoignable|indisponible/)
    }
  })

  it('detects status 0 even without a name', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const result = failSafe({ status: 0, message: 'something' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/injoignable|indisponible/)
  })

  it('detects a nested ENOTFOUND cause', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const result = failSafe({ message: 'boom', cause: { code: 'ENOTFOUND' } })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/injoignable|indisponible/)
  })

  it('detects ECONNREFUSED', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const result = failSafe({ message: 'connect ECONNREFUSED 127.0.0.1:5432' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/injoignable|indisponible/)
  })

  it('keeps the caller fallback for unrelated errors', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const result = failSafe(new Error('some database constraint'), 'Message de repli.')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBe('Message de repli.')
  })

  it('never leaks the raw error message to the caller', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const result = failSafe(new Error('relation "profiles" does not exist'))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).not.toContain('profiles')
  })
})

describe('result helpers', () => {
  it('ok carries data and an optional message', () => {
    const result = ok({ id: 1 }, 'Fait.')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data).toEqual({ id: 1 })
      expect(result.message).toBe('Fait.')
    }
  })

  it('fail carries an error and optional field errors', () => {
    const result = fail('Invalide.', { email: ['Format invalide.'] })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toBe('Invalide.')
      expect(result.fieldErrors?.email?.[0]).toBe('Format invalide.')
    }
  })
})

describe('mapPgErrorToFrench', () => {
  it('maps the active-application constraint to a readable sentence', () => {
    expect(mapPgErrorToFrench('ACTIVE_APPLICATION_EXISTS')).toMatch(/déjà une demande en cours/)
  })

  it('maps CONFLICT to a refresh instruction', () => {
    expect(mapPgErrorToFrench('CONFLICT: stale status')).toMatch(/Actualisez la page/)
  })

  it('maps FORBIDDEN to a refusal', () => {
    expect(mapPgErrorToFrench('FORBIDDEN')).toBe('Accès refusé.')
  })

  it('falls back to the generic message', () => {
    expect(mapPgErrorToFrench(undefined)).toBe(GENERIC_ERROR)
    expect(mapPgErrorToFrench('weird internal detail')).toBe(GENERIC_ERROR)
  })
})
