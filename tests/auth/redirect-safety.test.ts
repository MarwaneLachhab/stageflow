import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { safeRedirectPath } from '@/lib/auth/redirect'

/**
 * Open-redirect protection.
 *
 * `/connexion?next=…` is attacker-controllable: a link can be crafted so that a
 * user signs in successfully and is then bounced to an external site that mimics
 * StageFlow. `safeRedirectPath` is the single choke point for that parameter.
 *
 * The invariant asserted below is stronger than a list of blocked strings: for
 * ANY accepted value, resolving it against a fixed origin must stay on that
 * origin. If that holds, no accepted value can leave the site.
 */

const FALLBACK = '/redirection'
const ORIGIN = 'http://localhost'

describe('safeRedirectPath — rejects external targets', () => {
  const rejected: Array<[string, string | null | undefined]> = [
    ['absolute https URL', 'https://evil.example/login'],
    ['absolute http URL', 'http://evil.example'],
    ['protocol-relative', '//evil.example'],
    ['protocol-relative with path', '//evil.example/connexion'],
    ['backslash after slash', '/\\evil.example'],
    ['double backslash', '/\\\\evil.example'],
    ['leading backslash', '\\evil.example'],
    ['embedded backslash', '/admin\\..\\evil.example'],
    ['javascript scheme', 'javascript:alert(document.cookie)'],
    ['data scheme', 'data:text/html,<script>alert(1)</script>'],
    ['vbscript scheme', 'vbscript:msgbox(1)'],
    ['no leading slash', 'admin/demandes'],
    ['encoded protocol-relative', '%2F%2Fevil.example'],
    ['empty string', ''],
    ['null', null],
    ['undefined', undefined],
  ]

  for (const [label, candidate] of rejected) {
    it(`falls back for ${label}`, () => {
      expect(safeRedirectPath(candidate, FALLBACK)).toBe(FALLBACK)
    })
  }
})

describe('safeRedirectPath — accepts same-origin paths', () => {
  const accepted = [
    '/admin/demandes',
    '/stagiaire/tableau-de-bord',
    '/stagiaire/profil',
    '/redirection',
    '/admin/demandes/00000000-0000-4000-8000-000000000000',
    '/stagiaire/documents?tab=cv',
    '/stagiaire/suivi#historique',
  ]

  for (const candidate of accepted) {
    it(`keeps ${candidate}`, () => {
      expect(safeRedirectPath(candidate, FALLBACK)).toBe(candidate)
    })
  }

  it('trims surrounding whitespace', () => {
    expect(safeRedirectPath('  /admin/demandes  ', FALLBACK)).toBe('/admin/demandes')
  })

  it('keeps an encoded path that is still same-origin', () => {
    // %2F is not decoded into a path separator by the URL parser, so this stays
    // a relative path on our own origin.
    const result = safeRedirectPath('/%2F%2Fevil.example', FALLBACK)
    expect(result).toBe('/%2F%2Fevil.example')
    expect(new URL(result, ORIGIN).origin).toBe(ORIGIN)
  })
})

describe('safeRedirectPath — invariant', () => {
  it('never returns a value that resolves off-origin', () => {
    const candidates = [
      'https://evil.example',
      '//evil.example',
      '/\\evil.example',
      'javascript:alert(1)',
      '/admin',
      '/stagiaire/suivi',
      '   ',
      '',
      '///evil.example',
      '/./../..//evil.example',
    ]

    for (const candidate of candidates) {
      const result = safeRedirectPath(candidate, FALLBACK)
      const resolved = new URL(result, ORIGIN)
      expect(resolved.origin, `candidate: ${candidate}`).toBe(ORIGIN)
    }
  })

  it('always returns a path starting with a single slash', () => {
    for (const candidate of ['https://evil.example', '', null, '/ok', '//bad', '/\\bad']) {
      const result = safeRedirectPath(candidate, FALLBACK)
      expect(result.startsWith('/'), `candidate: ${candidate}`).toBe(true)
      expect(result.startsWith('//'), `candidate: ${candidate}`).toBe(false)
    }
  })
})

describe('signIn uses the shared helper', () => {
  /**
   * Structural regression guard. `signIn` previously carried its own inline
   * check (`startsWith('/') && !startsWith('//')`), which let `/\\evil.example`
   * through. If someone reintroduces an ad-hoc check, this fails.
   */
  const actions = readFileSync(resolve(__dirname, '../../lib/auth/actions.ts'), 'utf8')

  it('imports safeRedirectPath', () => {
    expect(actions).toMatch(/import\s*\{\s*safeRedirectPath\s*\}\s*from\s*'@\/lib\/auth\/redirect'/)
  })

  it('routes the next parameter through it', () => {
    expect(actions).toMatch(/safeRedirectPath\(\s*options\?\.next/)
  })

  it('no longer validates next inline', () => {
    expect(actions).not.toMatch(/options\.next\.startsWith\('\/'\)/)
  })
})
