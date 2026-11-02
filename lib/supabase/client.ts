import { createBrowserClient } from '@supabase/ssr'
import { publicEnv } from '@/lib/env'

/**
 * Browser Supabase client.
 *
 * Uses the publishable (anon) key only. Every query it makes is still subject to
 * Row Level Security, so a compromised browser bundle yields no additional
 * privilege.
 */
export function createClient() {
  return createBrowserClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey)
}
