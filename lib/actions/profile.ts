'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { enforceRateLimit, fail, failSafe, ok, requireRole } from '@/lib/auth/rate-limit'
import { profileSchema } from '@/lib/validation/schemas'
import { getOwnProfile } from '@/lib/db/stagiaire'
import type { ActionResult } from '@/lib/auth/types'

/**
 * `updateOwnProfile` — stagiaire only, own row only.
 *
 * Defence in depth:
 *  1. Server Action → session + role checked against the database.
 *  2. Zod → strict schema; unknown keys are stripped, so a payload containing
 *     `role`, `id` or `is_verified` simply has no effect.
 *  3. `.eq('id', user.id)` → ownership enforced in the query.
 *  4. Column-level GRANTs (migration 0004) → even a direct PostgREST PATCH
 *     cannot write a column outside the allowlist.
 */
export async function updateOwnProfile(input: unknown): Promise<ActionResult<null>> {
  const session = await requireRole('stagiaire')
  if (!session.ok) return session.result

  const gate = await enforceRateLimit('profileUpdate', session.user.id)
  if (!gate.allowed) return gate.result

  const parsed = profileSchema.safeParse(input)
  if (!parsed.success) {
    const flat = parsed.error.flatten()
    return {
      ok: false,
      error: 'Veuillez corriger les champs signalés.',
      fieldErrors: flat.fieldErrors as Record<string, string[]>,
    }
  }

  const data = parsed.data

  try {
    const supabase = await createClient()

    // Only the explicitly listed columns are sent. Anything a client might have
    // injected into the payload has already been stripped by Zod.
    const { error } = await supabase
      .from('profiles')
      .update({
        first_name: data.firstName,
        last_name: data.lastName,
        phone: data.phone,
        address: data.address || null,
        city: data.city || null,
        birth_date: data.birthDate || null,
        school: data.school || null,
        program: data.program || null,
        study_level: data.studyLevel || null,
        specialty: data.specialty || null,
      })
      .eq('id', session.user.id)

    if (error) {
      // A missing row means the profile was never provisioned (should not
      // happen, since the signup trigger creates it). Report honestly.
      if (error.code === 'PGRST116') {
        return fail('Votre profil n’a pas pu être trouvé. Reconnectez-vous puis réessayez.')
      }
      return failSafe(error, 'L’enregistrement du profil a échoué.')
    }

    revalidatePath('/stagiaire/profil')
    revalidatePath('/stagiaire/tableau-de-bord')

    return ok(null, 'Votre profil a été mis à jour.')
  } catch (error) {
    return failSafe(error)
  }
}

/**
 * `getOwnProfile` exposed to the client for optimistic refreshes.
 * Returns null rather than throwing so the UI can render an empty state.
 */
export async function loadOwnProfile() {
  const session = await requireRole('stagiaire')
  if (!session.ok) return null
  return getOwnProfile(session.user.id)
}
