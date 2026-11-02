import 'server-only'

import { isPlaceholderValue } from '@/lib/env'

/**
 * Live deployment self-diagnosis.
 *
 * Every check below performs a REAL probe and reports what actually happened.
 * Nothing is assumed or hard-coded to "ok": when a probe cannot run because an
 * earlier prerequisite is missing, it is reported as `blocked`, never as a
 * pass. A setup page that claims success it never verified would be worse than
 * no setup page at all.
 */

export type CheckState = 'ok' | 'missing' | 'blocked' | 'warning'

export type SetupCheck = {
  id: string
  label: string
  state: CheckState
  detail: string
  /** What the operator must do, when action is required. */
  remedy?: string
}

export type SetupReport = {
  checks: SetupCheck[]
  ready: boolean
  readyForAuth: boolean
  readyForData: boolean
}

/** Extract the project ref from a Supabase URL, or null when unparseable. */
function projectRef(url: string | undefined): string | null {
  if (!url) return null
  try {
    const host = new URL(url).host
    const match = /^([a-z0-9-]+)\.supabase\.(co|in)$/.exec(host)
    return match?.[1] ?? null
  } catch {
    return null
  }
}

/**
 * Probe whether PostgREST answers for this project with the anon key.
 *
 * We call a table that migration 0001 definitely creates. Three outcomes are
 * distinguished, because they mean very different things:
 *   - HTTP 200 or 206 → schema reachable
 *   - HTTP 404 with a PostgREST "relation does not exist" body → the API is up
 *     but the migrations were never applied
 *   - network/other error → credentials are wrong or the project is paused
 *
 * A 401 is also possible and means the anon key does not belong to this project.
 */
async function probeDatabase(): Promise<{ state: CheckState; detail: string; remedy?: string }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) {
    return {
      state: 'blocked',
      detail: 'Not probed: Supabase credentials are missing.',
    }
  }

  const endpoint = `${url.replace(/\/$/, '')}/rest/v1/profiles?select=id&limit=1`

  try {
    const response = await fetch(endpoint, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      // Never cache a diagnostic.
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    })

    if (response.ok) {
      return {
        state: 'ok',
        detail: `PostgREST answered HTTP ${response.status} — the schema is reachable.`,
      }
    }

    if (response.status === 401 || response.status === 403) {
      return {
        state: 'warning',
        detail: `PostgREST answered HTTP ${response.status}. The anon key is rejected — it likely belongs to a different project.`,
        remedy: 'Copy the anon key from the SAME project as the URL (Project Settings → API).',
      }
    }

    if (response.status === 404) {
      const body = await response.text()
      // PostgREST reports a missing table as 404 with code PGRST205/PGRST204.
      if (body.includes('PGRST205') || body.includes('does not exist')) {
        return {
          state: 'missing',
          detail:
            'The API is reachable but the "profiles" table does not exist — the SQL migrations have never been applied.',
          remedy:
            'Open the Supabase SQL editor and run the five files in supabase/migrations/ in order: 0001, 0002, 0003, 0004, 0005.',
        }
      }
      return {
        state: 'warning',
        detail: `PostgREST answered HTTP 404: ${body.slice(0, 160)}`,
      }
    }

    return {
      state: 'warning',
      detail: `PostgREST answered HTTP ${response.status}.`,
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'unknown error'
    return {
      state: 'warning',
      detail: `Could not reach the Supabase project: ${reason}`,
      remedy:
        'Check the URL for typos, and confirm the project is not paused (free projects pause after inactivity).',
    }
  }
}

/**
 * Determine whether an administrator has been provisioned.
 *
 * This is deliberately NOT a count of rows: `user_roles` is protected by RLS
 * and the anon key cannot read it, so a "0 admins" reading would be
 * indistinguishable from "permission denied" — i.e. it would be a guess, not a
 * measurement. We report honestly that this cannot be verified from the app.
 */
async function checkAdminProvisioning(): Promise<SetupCheck> {
  return {
    id: 'admin',
    label: 'Administrator account',
    state: 'blocked',
    detail:
      'Cannot be verified from the application: user_roles is protected by Row Level Security, so an anonymous probe cannot distinguish “no admin” from “denied”.',
    remedy:
      "In the Supabase SQL editor run: select promote_to_admin('your-admin@example.com'); — the account must already exist in Authentication → Users.",
  }
}

/** Run every prerequisite check and return an honest, itemised report. */
export async function getSetupReport(): Promise<SetupReport> {
  const checks: SetupCheck[] = []

  // --- 1. Public credentials -------------------------------------------------
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const ref = projectRef(url)
  const urlIsPlaceholder = isPlaceholderValue(url)

  checks.push({
    id: 'url',
    label: 'NEXT_PUBLIC_SUPABASE_URL',
    state: !url ? 'missing' : urlIsPlaceholder ? 'missing' : ref ? 'ok' : 'warning',
    detail: !url
      ? 'Not set.'
      : urlIsPlaceholder
        ? `Still the .env.example placeholder (“${url}”). This host does not exist, so every auth call fails with ENOTFOUND.`
        : ref
          ? `Set to project “${ref}”.`
          : `Set, but "${url}" is not a recognisable Supabase project URL.`,
    remedy: !url || urlIsPlaceholder
      ? 'Copy .env.example to .env.local and replace the placeholder with your Project URL (Project Settings → API), then restart the server.'
      : ref
        ? undefined
        : 'Expected the form https://<project-ref>.supabase.co (no trailing slash, no /rest/v1).',
  })

  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const anonIsPlaceholder = isPlaceholderValue(anon)

  checks.push({
    id: 'anon',
    label: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    state: !anon ? 'missing' : anonIsPlaceholder ? 'missing' : 'ok',
    detail: !anon
      ? 'Not set. Every page that reads data will fail.'
      : anonIsPlaceholder
        ? `Still the .env.example placeholder (“${anon}”). Supabase will reject it.`
        : `Set (${anon.length} characters).`,
    remedy:
      !anon || anonIsPlaceholder
        ? 'Set this to the anon/publishable key from the SAME project. It is safe in the browser: RLS still applies.'
        : undefined,
  })

  // --- 2. Server secret ------------------------------------------------------
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY
  const serviceRoleIsPlaceholder = isPlaceholderValue(serviceRole)
  const hasServiceRole = Boolean(serviceRole) && !serviceRoleIsPlaceholder

  checks.push({
    id: 'serviceRole',
    label: 'SUPABASE_SERVICE_ROLE_KEY',
    state: hasServiceRole ? 'ok' : serviceRoleIsPlaceholder ? 'missing' : 'warning',
    detail: hasServiceRole
      ? 'Set. Server-only secret; used only for audited storage writes.'
      : serviceRoleIsPlaceholder
        ? 'Still the .env.example placeholder. Treat it as absent: uploads and audit logging would fail.'
        : 'Not set. Sign-in, browsing and the full workflow still work.',
    remedy: hasServiceRole
      ? undefined
      : 'Optional. Without it, document upload and audit logging are unavailable. Add it ONLY if you need those; never expose it to the browser.',
  })

  // --- 3. Live database probe ------------------------------------------------
  const db = await probeDatabase()
  checks.push({ id: 'database', label: 'Database schema (live probe)', ...db })

  // --- 4. First admin --------------------------------------------------------
  checks.push(await checkAdminProvisioning())

  const readyForAuth = Boolean(ref && anon && !urlIsPlaceholder && !anonIsPlaceholder)
  const readyForData = db.state === 'ok'
  const ready = readyForAuth && readyForData

  return { checks, ready, readyForAuth, readyForData }
}
