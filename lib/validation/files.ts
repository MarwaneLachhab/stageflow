import { UPLOAD_RULES } from '@/lib/constants'

/**
 * Upload safety helpers.
 *
 * Defence-in-depth for document uploads. Nothing here replaces server-side
 * authorization — it hardens the content pipeline against the classic file
 * upload attacks listed in the master prompt:
 *   - path traversal / filename spoofing
 *   - MIME type spoofing (declared type vs real magic bytes)
 *   - SVG / HTML / script uploads that would execute in the browser
 *   - oversized payloads
 */

export type UploadValidationResult =
  | { ok: true; extension: string; safeName: string; mimeType: string }
  | { ok: false; error: string }

/** Extensions we refuse outright, regardless of declared MIME type. */
const BLOCKED_EXTENSIONS = new Set([
  'svg', 'html', 'htm', 'xhtml', 'xml', 'js', 'mjs', 'cjs', 'jsx', 'ts', 'tsx',
  'php', 'phtml', 'asp', 'aspx', 'jsp', 'exe', 'dll', 'bat', 'cmd', 'com',
  'scr', 'msi', 'jar', 'sh', 'bash', 'ps1', 'vbs', 'wsf', 'hta', 'py', 'rb',
  'zip', 'rar', '7z', 'gz', 'tar', 'iso', 'dmg',
])

/** Magic-byte signatures for the allowed types. */
const MAGIC_BYTES: Record<string, number[][]> = {
  pdf: [[0x25, 0x50, 0x44, 0x46]], // %PDF
  png: [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
  jpg: [
    [0xff, 0xd8, 0xff, 0xe0],
    [0xff, 0xd8, 0xff, 0xe1],
    [0xff, 0xd8, 0xff, 0xe8],
    [0xff, 0xd8, 0xff, 0xdb],
    [0xff, 0xd8, 0xff, 0xee],
  ],
}

const EXTENSION_MIME: Record<string, string> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
}

/**
 * Extract a lower-case extension without trusting the raw filename.
 * Handles "cv.pdf", "cv.PDF", "cv.pdf.exe", "....pdf".
 */
export function extractExtension(filename: string): string {
  const cleaned = filename.trim().toLowerCase()
  const lastDot = cleaned.lastIndexOf('.')
  if (lastDot === -1 || lastDot === cleaned.length - 1) return ''
  return cleaned.slice(lastDot + 1).replace(/[^a-z0-9]/g, '')
}

/**
 * Produce a storage-safe display name.
 * Strips directory separators, control characters and leading dots so the value
 * can never be interpreted as a path or a hidden file when displayed.
 */
export function sanitizeDisplayName(filename: string, maxLength = 120): string {
  const base = filename.split(/[/\\]/).pop() ?? 'document'
  const withoutControl = Array.from(base)
    .filter((ch) => {
      const code = ch.codePointAt(0) ?? 0
      return code >= 32 && code !== 127
    })
    .join('')
  const collapsed = withoutControl
    .replace(/[<>:"|?*]/g, '_')
    .replace(/^\.+/, '')
    .replace(/\s+/g, ' ')
    .trim()
  const safe = collapsed || 'document'
  return safe.length > maxLength ? safe.slice(0, maxLength - 1) + '…' : safe
}

/**
 * Randomised storage key. The client-supplied filename never influences the
 * storage path, which removes path traversal and overwrite risks entirely.
 */
export function buildStorageKey(
  userId: string,
  applicationId: string,
  documentType: string,
  extension: string,
): string {
  const random = randomHex(16)
  const safeType = documentType.replace(/[^A-Za-z0-9_]/g, '') || 'DOC'
  const safeExt = extension.replace(/[^a-z0-9]/g, '') || 'bin'
  // Layout: <user>/<application>/<type>-<random>.<ext>
  // Both user and application ids come from the authenticated server context.
  return `${userId}/${applicationId}/${safeType}-${random}.${safeExt}`
}

function randomHex(bytes: number): string {
  const arr = new Uint8Array(bytes)
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    globalThis.crypto.getRandomValues(arr)
  } else {
    for (let i = 0; i < bytes; i++) arr[i] = Math.floor(Math.random() * 256)
  }
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/** Verify leading bytes against the expected signature for the extension. */
export function sniffMagicBytes(head: Uint8Array, extension: string): boolean {
  const signatures = MAGIC_BYTES[extension]
  if (!signatures) return false
  return signatures.some((sig) => sig.every((byte, i) => head[i] === byte))
}

/**
 * Full client/server-shared validation. The server repeats this with the real
 * file bytes; the client uses it for instant feedback.
 */
export function validateUpload(input: {
  filename: string
  size: number
  declaredMimeType?: string
}): UploadValidationResult {
  const extension = extractExtension(input.filename)

  if (!extension) {
    return { ok: false, error: 'Le fichier doit avoir une extension (PDF, PNG ou JPG).' }
  }
  if (BLOCKED_EXTENSIONS.has(extension)) {
    return { ok: false, error: `Le format « .${extension} » n’est pas autorisé.` }
  }
  if (!(UPLOAD_RULES.allowedExtensions as readonly string[]).includes(extension)) {
    return {
      ok: false,
      error: 'Format non autorisé. Formats acceptés : PDF, PNG, JPG.',
    }
  }
  if (!Number.isFinite(input.size) || input.size <= 0) {
    return { ok: false, error: 'Le fichier est vide ou illisible.' }
  }
  if (input.size > UPLOAD_RULES.maxBytes) {
    const maxMb = UPLOAD_RULES.maxBytes / (1024 * 1024)
    return { ok: false, error: `Le fichier dépasse la taille maximale de ${maxMb} Mo.` }
  }
  if (
    input.declaredMimeType &&
    !(UPLOAD_RULES.allowedMimeTypes as readonly string[]).includes(input.declaredMimeType)
  ) {
    return { ok: false, error: 'Type de contenu non autorisé.' }
  }

  return {
    ok: true,
    extension,
    safeName: sanitizeDisplayName(input.filename),
    mimeType: EXTENSION_MIME[extension] ?? 'application/octet-stream',
  }
}

/**
 * Content-Disposition value that forces a download and neutralises header
 * injection through the filename. RFC 5987 encoding keeps accented French
 * filenames readable.
 */
export function buildSafeContentDisposition(filename: string): string {
  const safe = sanitizeDisplayName(filename).replace(/["\\\r\n]/g, '_')
  const asciiFallback = safe.replace(/[^\x20-\x7E]/g, '_')
  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(safe)}`
}

/** Safe inline disposition for previewing the allowlisted PDF/image formats. */
export function buildSafeInlineContentDisposition(filename: string): string {
  const safe = sanitizeDisplayName(filename).replace(/["\\\r\n]/g, '_')
  const asciiFallback = safe.replace(/[^\x20-\x7E]/g, '_')
  return `inline; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(safe)}`
}
