'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { enforceRateLimit, fail, failSafe, mapPgErrorToFrench, ok, requireRole } from '@/lib/auth/rate-limit'
import { decisionSchema, startReviewSchema, privateNoteSchema } from '@/lib/validation/schemas'
import { canTransition } from '@/lib/permissions'
import type { ApplicationStatus } from '@/lib/constants'
import type { ActionResult } from '@/lib/auth/types'

/**
 * Admin decision actions — the most security-sensitive mutations in the app.
 *
 * Four independent layers protect every transition:
 *  1. `requireRole('admin')` resolves the role from `user_roles` via a verified
 *     session. A forged `role=admin` in a request body has no effect.
 *  2. `canTransition()` applies the canonical state machine, so the UI cannot be
 *     tricked into offering an illegal move.
 *  3. The database function re-checks `is_admin()`, locks the row
 *     (`SELECT … FOR UPDATE`), verifies the observed status (optimistic
 *     concurrency) and refuses terminal-state rewrites.
 *  4. RLS denies direct writes to the workflow columns entirely, so bypassing
 *     these actions with a raw PATCH is impossible.
 */

function revalidateDecisionSurfaces(applicationId: string) {
  revalidatePath('/admin/tableau-de-bord')
  revalidatePath('/admin/demandes')
  revalidatePath(`/admin/demandes/${applicationId}`)
  // The trainee must see the outcome on their next request.
  revalidatePath('/stagiaire/tableau-de-bord')
  revalidatePath('/stagiaire/suivi')
  revalidatePath('/stagiaire/documents')
}

/* -------------------------------------------------------------------------- */
/* SUBMITTED → UNDER_REVIEW                                                    */
/* -------------------------------------------------------------------------- */

export async function startReview(input: unknown): Promise<ActionResult<{ status: string }>> {
  const session = await requireRole('admin')
  if (!session.ok) return session.result

  const gate = await enforceRateLimit('adminDecision', session.user.id)
  if (!gate.allowed) return gate.result

  const parsed = startReviewSchema.safeParse(input)
  if (!parsed.success) return fail('Requête invalide.')

  if (!canTransition('START_REVIEW', parsed.data.expectedStatus, 'admin')) {
    return fail(
      'Cette demande ne peut pas être mise en examen : elle doit d’abord avoir été envoyée par le stagiaire.',
    )
  }

  try {
    const supabase = await createClient()
    const { error } = await supabase.rpc('start_review', {
      p_application_id: parsed.data.applicationId,
    })

    if (error) return fail(mapPgErrorToFrench(error.message))

    revalidateDecisionSurfaces(parsed.data.applicationId)
    return ok({ status: 'UNDER_REVIEW' }, 'Le dossier est maintenant en cours d’examen.')
  } catch (error) {
    return failSafe(error)
  }
}

/* -------------------------------------------------------------------------- */
/* → ACCEPTED / REJECTED                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Final decision.
 *
 * A refusal reason is MANDATORY — a deliberate improvement over the initial
 * cahier des charges, where it was optional. The reason is the only text the
 * candidate will ever read about the decision, so it is validated for length
 * here, in the schema, and again (length >= 10) inside the database function.
 */
export async function decideApplication(
  input: unknown,
): Promise<ActionResult<{ status: ApplicationStatus }>> {
  const session = await requireRole('admin')
  if (!session.ok) return session.result

  const gate = await enforceRateLimit('adminDecision', session.user.id)
  if (!gate.allowed) return gate.result

  const parsed = decisionSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error: 'Veuillez corriger les champs signalés.',
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }

  const { applicationId, decision, publicReason, expectedStatus } = parsed.data

  if (!canTransition(decision === 'ACCEPTED' ? 'ACCEPT' : 'REJECT', expectedStatus, 'admin')) {
    return fail(
      'Décision impossible : cette demande est déjà clôturée ou n’est pas au bon statut. Actualisez la page.',
    )
  }

  try {
    const supabase = await createClient()

    const { error } = await supabase.rpc('decide_application', {
      p_application_id: applicationId,
      p_decision: decision,
      p_public_reason: publicReason.trim(),
      p_expected_status: expectedStatus,
    })

    if (error) {
      // A concurrent decision by another administrator lands here.
      return fail(mapPgErrorToFrench(error.message))
    }

    revalidateDecisionSurfaces(applicationId)

    return ok(
      { status: decision },
      decision === 'ACCEPTED'
        ? 'La demande a été acceptée. Le stagiaire peut désormais consulter la décision.'
        : 'La demande a été refusée. Le motif est visible par le stagiaire.',
    )
  } catch (error) {
    return failSafe(error)
  }
}

/* -------------------------------------------------------------------------- */
/* Private admin note                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Internal note. Stored in `admin_private_notes`, whose RLS policy is admin-only
 * in both directions, so a stagiaire can never read it — not even by guessing
 * the id or querying the table directly.
 */
export async function addPrivateNote(input: unknown): Promise<ActionResult<null>> {
  const session = await requireRole('admin')
  if (!session.ok) return session.result

  const parsed = privateNoteSchema.safeParse(input)
  if (!parsed.success) return fail('La note ne peut pas être vide.')

  try {
    const supabase = await createClient()

    const { error } = await supabase.from('admin_private_notes').insert({
      application_id: parsed.data.applicationId,
      author_id: session.user.id,
      body: parsed.data.body,
    })

    if (error) return failSafe(error, 'La note n’a pas pu être enregistrée.')

    revalidatePath(`/admin/demandes/${parsed.data.applicationId}`)
    return ok(null, 'Note interne enregistrée.')
  } catch (error) {
    return failSafe(error)
  }
}
