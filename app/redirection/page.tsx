import { redirect } from 'next/navigation'
import { getSessionUser, homeRouteForRole } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'

/**
 * `/redirection` — resolves the caller's role from the database and sends them
 * to the correct workspace.
 *
 * This exists so that no client-controlled value ever decides which area a user
 * lands in after signing in.
 */
export default async function RedirectionPage() {
  const user = await getSessionUser()

  if (!user) redirect('/connexion')

  // Honour email-confirmation configuration without blocking the workspace:
  // the stagiaire dashboard shows a non-blocking notice when unconfirmed.
  const supabase = await createClient()
  await supabase.auth.getUser()

  redirect(homeRouteForRole(user.role))
}
