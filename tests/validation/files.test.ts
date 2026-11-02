import { describe, expect, it } from 'vitest'
import {
  buildStorageKey,
  buildSafeContentDisposition,
  extractExtension,
  sanitizeDisplayName,
  sniffMagicBytes,
  validateUpload,
} from '@/lib/validation/files'
import { UPLOAD_RULES } from '@/lib/constants'

/**
 * File-upload security tests.
 *
 * These cover the controls that stand between a candidate and an attacker-
 * controlled object in a shared, private bucket. They are the highest-value
 * unit tests in the suite because every one of them maps to a documented threat
 * in docs/SECURITY.md.
 */

const PDF_BYTES = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]) // %PDF-1.7
const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const JPG_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10])

/** A file that claims to be a PDF but is actually HTML (a classic polyglot). */
const FAKE_PDF_BYTES = new Uint8Array([
  0x3c, 0x68, 0x74, 0x6d, 0x6c, 0x3e, 0x3c, 0x73, 0x63, 0x72, 0x69, 0x70, 0x74, 0x3e,
]) // <html><script>

/* -------------------------------------------------------------------------- */
/* Extension parsing                                                           */
/* -------------------------------------------------------------------------- */

describe('extractExtension', () => {
  /** Returns a lowercased alphanumeric extension, or '' when there is none. */

  it('returns the lowercase extension', () => {
    expect(extractExtension('CV.PDF')).toBe('pdf')
    expect(extractExtension('photo.JPeG')).toBe('jpeg')
  })

  it('returns an empty string when there is no dot', () => {
    expect(extractExtension('cv')).toBe('')
  })

  it('returns an empty string for a trailing dot', () => {
    expect(extractExtension('archive.')).toBe('')
  })

  it('reads a leading-dot filename as the extension', () => {
    // `.gitignore` → `gitignore`. Harmless: `gitignore` is not in the
    // allowlist, so the upload is refused by validateUpload regardless.
    expect(extractExtension('.gitignore')).toBe('gitignore')
    expect(validateUpload({ filename: '.gitignore', size: 10 }).ok).toBe(false)
  })

  it('reads only the final extension of a multi-dot name', () => {
    expect(extractExtension('rapport.final.v2.pdf')).toBe('pdf')
  })

  it('reports the LAST extension of a double extension', () => {
    // `cv.pdf.exe` → `exe`, which is on the blocked list.
    expect(extractExtension('cv.pdf.exe')).toBe('exe')
  })

  it('strips characters that are not alphanumeric', () => {
    expect(extractExtension('cv.p d"f')).toBe('pdf')
  })
})

/* -------------------------------------------------------------------------- */
/* Display-name sanitisation                                                   */
/* -------------------------------------------------------------------------- */

describe('sanitizeDisplayName', () => {
  it('strips directory components from a traversal attempt', () => {
    const result = sanitizeDisplayName('../../etc/passwd.pdf')
    expect(result).not.toContain('..')
    expect(result).not.toContain('/')
  })

  it('handles Windows-style separators', () => {
    const result = sanitizeDisplayName('..\\..\\windows\\system32\\evil.pdf')
    expect(result).not.toContain('\\')
    expect(result).not.toContain('..')
  })

  it('removes control characters', () => {
    const result = sanitizeDisplayName('cv\u0000\u001b[31m.pdf')
    expect(result).not.toContain('\u0000')
    expect(result).not.toContain('\u001b')
  })

  it('collapses whitespace and trims', () => {
    expect(sanitizeDisplayName('  mon   cv  .pdf')).toBe('mon cv .pdf')
  })

  it('preserves accented French characters', () => {
    const result = sanitizeDisplayName('Attestation de scolarité.pdf')
    expect(result).toContain('scolarité')
  })

  it('falls back to a placeholder for an empty result', () => {
    expect(sanitizeDisplayName('...')).toBeTruthy()
  })
})

/* -------------------------------------------------------------------------- */
/* Magic bytes — the decisive control                                          */
/* -------------------------------------------------------------------------- */

describe('sniffMagicBytes', () => {
  /**
   * Signature: `sniffMagicBytes(head, extension) => boolean`.
   * The caller supplies the claimed extension; this function answers the only
   * question that matters — "do the real bytes actually match that claim?"
   */

  it('accepts a real PDF claiming to be a PDF', () => {
    expect(sniffMagicBytes(PDF_BYTES, 'pdf')).toBe(true)
  })

  it('accepts a real PNG claiming to be a PNG', () => {
    expect(sniffMagicBytes(PNG_BYTES, 'png')).toBe(true)
  })

  it('accepts a real JPEG claiming to be a JPG', () => {
    expect(sniffMagicBytes(JPG_BYTES, 'jpg')).toBe(true)
  })

  it('rejects HTML masquerading as a PDF', () => {
    // The whole point: the extension says pdf, the bytes say html.
    expect(sniffMagicBytes(FAKE_PDF_BYTES, 'pdf')).toBe(false)
  })

  it('rejects an empty buffer', () => {
    expect(sniffMagicBytes(new Uint8Array(), 'pdf')).toBe(false)
  })

  it('rejects SVG bytes even if someone claims pdf', () => {
    const svg = new Uint8Array([0x3c, 0x73, 0x76, 0x67]) // <svg
    expect(sniffMagicBytes(svg, 'pdf')).toBe(false)
  })

  it('rejects ZIP bytes claiming to be a PNG', () => {
    // A ZIP can contain a nested executable; it must never pass as an image.
    const zip = new Uint8Array([0x50, 0x4b, 0x03, 0x04])
    expect(sniffMagicBytes(zip, 'png')).toBe(false)
  })

  it('rejects any extension that has no signature (fail closed)', () => {
    // An unrecognised extension cannot be verified, so it must not be trusted.
    expect(sniffMagicBytes(PDF_BYTES, 'svg')).toBe(false)
    expect(sniffMagicBytes(PDF_BYTES, 'exe')).toBe(false)
  })

  it('rejects PNG bytes claiming to be a PDF', () => {
    expect(sniffMagicBytes(PNG_BYTES, 'pdf')).toBe(false)
  })
})

/* -------------------------------------------------------------------------- */
/* validateUpload — the combined gate                                          */
/* -------------------------------------------------------------------------- */

describe('validateUpload', () => {
  it('accepts a well-formed PDF', () => {
    const result = validateUpload({
      filename: 'cv.pdf',
      size: 1024,
      declaredMimeType: 'application/pdf',
    })
    expect(result.ok).toBe(true)
  })

  it('rejects an executable extension', () => {
    const result = validateUpload({ filename: 'virus.exe', size: 1024 })
    expect(result.ok).toBe(false)
  })

  it('rejects the svg extension explicitly', () => {
    const result = validateUpload({ filename: 'logo.svg', size: 1024 })
    expect(result.ok).toBe(false)
  })

  it('rejects a file above the size limit', () => {
    const result = validateUpload({
      filename: 'cv.pdf',
      size: UPLOAD_RULES.maxBytes + 1,
      declaredMimeType: 'application/pdf',
    })
    expect(result.ok).toBe(false)
  })

  it('accepts a file exactly at the size limit', () => {
    const result = validateUpload({
      filename: 'cv.pdf',
      size: UPLOAD_RULES.maxBytes,
      declaredMimeType: 'application/pdf',
    })
    expect(result.ok).toBe(true)
  })

  it('rejects a zero-byte file', () => {
    const result = validateUpload({ filename: 'cv.pdf', size: 0 })
    expect(result.ok).toBe(false)
  })

  it('rejects an empty filename', () => {
    const result = validateUpload({ filename: '', size: 1024 })
    expect(result.ok).toBe(false)
  })

  it('rejects a mismatched declared MIME type', () => {
    const result = validateUpload({
      filename: 'cv.pdf',
      size: 1024,
      declaredMimeType: 'text/html',
    })
    expect(result.ok).toBe(false)
  })
})

/* -------------------------------------------------------------------------- */
/* Server-generated storage keys                                               */
/* -------------------------------------------------------------------------- */

describe('buildStorageKey', () => {
  const userId = '11111111-1111-4111-8111-111111111111'
  const appId = '22222222-2222-4222-8222-222222222222'

  it('produces the documented <user>/<application>/<TYPE>-<hex>.<ext> shape', () => {
    const key = buildStorageKey(userId, appId, 'CV', 'pdf')
    // `randomHex(16)` yields 32 hex characters (two per byte).
    expect(key).toMatch(
      /^11111111-1111-4111-8111-111111111111\/22222222-2222-4222-8222-222222222222\/CV-[0-9a-f]{32}\.pdf$/,
    )
  })

  it('strips path characters out of the document type', () => {
    // The type is a DB enum in practice, but the helper must not be the weak
    // link if a caller ever passes something unexpected.
    const key = buildStorageKey(userId, appId, '../../CV', 'pdf')
    expect(key).not.toContain('..')
    expect(key.split('/').length).toBe(3)
  })

  it('strips path characters out of the extension', () => {
    const key = buildStorageKey(userId, appId, 'CV', 'p/d"f')
    expect(key).not.toContain('"')
    expect(key.endsWith('.pdf')).toBe(true)
  })

  it('never lets a client-supplied filename reach the key', () => {
    // There is no filename parameter at all — which is the design.
    const key = buildStorageKey(userId, appId, 'CV', 'pdf')
    expect(key).not.toContain('..')
    expect(key).not.toContain('passwd')
  })

  it('generates a different key on every call', () => {
    const a = buildStorageKey(userId, appId, 'CV', 'pdf')
    const b = buildStorageKey(userId, appId, 'CV', 'pdf')
    expect(a).not.toBe(b)
  })

  it('scopes every key to the owning user and application', () => {
    const key = buildStorageKey(userId, appId, 'MOTIVATION_LETTER', 'png')
    expect(key.startsWith(`${userId}/${appId}/`)).toBe(true)
  })
})

/* -------------------------------------------------------------------------- */
/* Content-Disposition — header-injection defence                              */
/* -------------------------------------------------------------------------- */

describe('buildSafeContentDisposition', () => {
  it('produces an attachment disposition', () => {
    expect(buildSafeContentDisposition('cv.pdf')).toMatch(/^attachment;/)
  })

  it('never allows inline rendering', () => {
    // `inline` would let a stored HTML/SVG file run in our origin.
    const header = buildSafeContentDisposition('cv.pdf')
    expect(header).not.toContain('inline')
  })

  it('does not break on a quote in the filename', () => {
    const header = buildSafeContentDisposition('cv"evil.pdf')
    expect(header).not.toMatch(/filename="[^"]*"[^;]/)
  })

  it('does not break on a newline in the filename', () => {
    const header = buildSafeContentDisposition('cv\r\nX-Injected: 1.pdf')
    expect(header).not.toContain('\r')
    expect(header).not.toContain('\n')
  })

  it('handles accented characters via RFC 5987 encoding', () => {
    const header = buildSafeContentDisposition('Attestation de scolarité.pdf')
    expect(header).toContain("filename*=UTF-8''")
  })
})
