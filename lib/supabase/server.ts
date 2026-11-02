import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { publicEnv, serverEnv } from '@/lib/env'

type CookieToSet = { name: string; value: string; options?: CookieOptions }

/**
 * Server Supabase client bound to the request cookies.
 *
 * This client carries the *user's* session, so Row Level Security applies with
 * the real user identity. It is NOT an elevated client.
 *
 * Cookie contract for `@supabase/ssr` v0.5+:
 *   - `getAll()`  returns every cookie so the SDK can find its auth cookies
 *   - `setAll()`  is only callable from a Server Action or Route Handler
 * When it is called from a Server Component (read-only render) the write throws,
 * which is expected and safely ignored — the middleware refreshes the session.
 */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet: CookieToSet[]) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options)
          }
        } catch {
          // Called during a Server Component render. Handled by middleware.
        }
      },
    },
  })
}

/**
 * Elevated client for privileged, already-authorized operations only:
 *   - uploading/deleting a private storage object after ownership was verified
 *   - appending audit rows
 *
 * Never use it to read data on behalf of a user: that would bypass RLS and make
 * authorization the application's responsibility alone. Returns null when the
 * key is not configured so callers can degrade explicitly.
 *
 * The service-role key must never be reachable from the browser bundle, so this
 * function refuses to run in a client runtime and asserts that with a browser
 * guard (see `lib/env.ts`) before it reads the secret.
 */
export function createAdminClient() {
  if (typeof window !== 'undefined') return null

  const key = serverEnv.serviceRoleKey
  if (!key) return null

  return createSupabaseClient(publicEnv.supabaseUrl, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
