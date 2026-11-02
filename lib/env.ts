/**
 * Environment configuration with fail-fast validation.
 *
 * Security rules enforced here:
 *  - Only the publishable/anon key may ever be exposed to the browser.
 *  - The service-role key is server-only and its absence degrades features
 *    gracefully instead of silently falling back to something insecure.
 */

function required(name: string): string {
  const value = process.env[name]
  if (!value || value.trim() === '') {
    throw new Error(
      `Missing required environment variable ${name}. Copy .env.example to .env.local and fill it in.`,
    )
  }
  return value
}

/** Public configuration — safe to send to the browser. */
export const publicEnv = {
  get supabaseUrl(): string {
    return required('NEXT_PUBLIC_SUPABASE_URL')
  },
  get supabaseAnonKey(): string {
    return required('NEXT_PUBLIC_SUPABASE_ANON_KEY')
  },
  get siteUrl(): string {
    return process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
  },
} as const

/** True when Supabase is configured with REAL values; lets pages render an actionable setup notice. */
export function isSupabaseConfigured(): boolean {
  return getSupabaseConfigIssue() === null
}

/**
 * Markers that only ever appear in `.env.example`. If one of them is present in
 * a live variable, the file was copied but never filled in.
 *
 * This matters: `https://your-project-ref.supabase.co` is a syntactically valid
 * URL, so without this check the application believes it is configured, sends
 * the signup request to a host that does not exist, and surfaces a misleading
 * "try again" error. Detecting the placeholder turns an opaque network failure
 * into a precise instruction.
 */
const PLACEHOLDER_MARKERS = [
  'your-project-ref',
  'your-anon-key',
  'your-service-role-key',
  'your-project',
  'example.com',
] as const

/** True when `value` still contains one of the `.env.example` placeholders. */
export function isPlaceholderValue(value: string | undefined | null): boolean {
  if (!value) return false
  const lowered = value.toLowerCase()
  return PLACEHOLDER_MARKERS.some((marker) => lowered.includes(marker))
}

/**
 * Describe what is wrong with the Supabase configuration, or `null` when it is
 * usable. The returned sentence is safe to show to a user: it names the file and
 * the variables, never a value.
 */
export function getSupabaseConfigIssue(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || url.trim() === '' || !anonKey || anonKey.trim() === '') {
    return 'Aucune base de données n’est configurée. Renseignez NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY dans le fichier .env.local, puis redémarrez le serveur.'
  }

  if (isPlaceholderValue(url) || isPlaceholderValue(anonKey)) {
    return 'Le fichier .env.local contient encore les valeurs d’exemple (.env.example). Remplacez-les par l’URL du projet et la clé anon de votre projet Supabase, puis redémarrez le serveur.'
  }

  // A hosted Supabase project URL is always https://<ref>.supabase.co with no
  // path. The one exception is the CLI's local stack (`supabase start`), which
  // serves plain HTTP on the loopback interface only — explicitly accepted for
  // local development so the hosted rules stay unchanged for real projects.
  const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]', '::1'])
  try {
    const parsed = new URL(url)
    if (parsed.protocol === 'http:' && LOCAL_HOSTNAMES.has(parsed.hostname)) {
      return null
    }
    if (parsed.protocol !== 'https:') {
      return 'NEXT_PUBLIC_SUPABASE_URL doit utiliser https://.'
    }
    if (!parsed.hostname.endsWith('.supabase.co') && !parsed.hostname.endsWith('.supabase.in')) {
      return 'NEXT_PUBLIC_SUPABASE_URL ne ressemble pas à une URL de projet Supabase (attendu : https://<référence>.supabase.co).'
    }
  } catch {
    return 'NEXT_PUBLIC_SUPABASE_URL n’est pas une URL valide.'
  }

  return null
}

/**
 * Server-only secrets. Importing this object from a Client Component would leak
 * the value into the bundle, so every accessor asserts it is running on the
 * server. `serviceRoleKey` is used for exactly two things:
 *   1. validated document upload/delete after authorization has been checked
 *   2. appending audit rows
 * It is never used to bypass RLS for reads.
 */
export const serverEnv = {
  get serviceRoleKey(): string | null {
    if (typeof window !== 'undefined') {
      throw new Error('serverEnv must never be accessed from the browser.')
    }
    return process.env.SUPABASE_SERVICE_ROLE_KEY ?? null
  },
  get hasServiceRole(): boolean {
    if (typeof window !== 'undefined') return false
    return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)
  },
  get enableEmailNotifications(): boolean {
    return process.env.ENABLE_EMAIL_NOTIFICATIONS === 'true'
  },
} as const
