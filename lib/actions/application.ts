'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { enforceRateLimit, fail, failSafe, ok, requireRole } from '@/lib/auth/rate-limit'
import { mapPgErrorToFrench } from '@/lib/auth/rate-limit'
import { applicationDraftSaveSchema } from '@/lib/validation/schemas'
import { getCurrentApplication, getApplicationDocuments } from '@/lib/db/stagiaire'
import { REQUIRED_DOCUMENT_TYPES, type DocumentType } from '@/lib/constants'
import type { ActionResult } from '@/lib/auth/types'

/**
 * Application server actions: draft creation, draft saving and submission.
 *
 * The workflow columns (status, submitted_at, …) are written ONLY by the
 * SECURITY DEFINER functions in migration 0003. The client cannot reach them,
 * which is why this module never sends a `status` value.
 */

/* -------------------------------------------------------------------------- */
/* Ensure a draft exists                                                       */
/* -------------------------------------------------------------------------- */

export async function ensureDraft(): Promise<ActionResult<{ applicationId: string }>> {
  const session = await requireRole('stagiaire')
  if (!session.ok) return session.result

  try {
    const existing = await getCurrentApplication(session.user.id)
    if (existing) return ok({ applicationId: existing.id })

    const supabase = await createClient()
    const { data, error } = await supabase.rpc('create_draft_application')

    if (error) {
      return fail(mapPgErrorToFrench(error.message))
    }

    revalidatePath('/stagiaire/demande')
    revalidatePath('/stagiaire/documents')
    revalidatePath('/stagiaire/tableau-de-bord')
    revalidatePath('/stagiaire/suivi')

    return ok({ applicationId: data as string }, 'Brouillon créé.')
  } catch (error) {
    return failSafe(error)
  }
}

/* -------------------------------------------------------------------------- */
/* Save draft                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Persist the wizard content. Only the draft-content columns are written and
 * the query is scoped to the caller. The database additionally enforces
 * `status = 'DRAFT'` through the RLS UPDATE policy, so a submitted application
 * cannot be edited even if this action were bypassed.
 */
export async function saveDraft(input: unknown): Promise<ActionResult<{ savedAt: string }>> {
  const session = await requireRole('stagiaire')
  if (!session.ok) return session.result

  const gate = await enforceRateLimit('draftSave', session.user.id)
  if (!gate.allowed) return gate.result

  const parsed = applicationDraftSaveSchema.safeParse(input)
  if (!parsed.success) {
    const flat = parsed.error.flatten()
    return {
      ok: false,
      error: 'Veuillez corriger les champs signalés.',
      fieldErrors: flat.fieldErrors as Record<string, string[]>,
    }
  }

  const data = parsed.data
  const application = await getCurrentApplication(session.user.id)

  if (!application) {
    return fail('Aucune demande en cours. Commencez par créer une demande.')
  }
  if (application.status !== 'DRAFT') {
    return fail(
      'Votre demande a déjà été envoyée et ne peut plus être modifiée. Contactez l’administration pour toute correction.',
    )
  }

  try {
    const supabase = await createClient()

    const { error } = await supabase
      .from('internship_applications')
      .update({
        stage_type: data.stageType ?? '',
        domain: data.domain ?? '',
        start_date: data.startDate || null,
        end_date: data.endDate || null,
        mode: data.mode || null,
        motivation: data.motivation ?? '',
        school: data.school || null,
        program: data.program || null,
        study_level: data.studyLevel || null,
        specialty: data.specialty || null,
      })
      .eq('id', application.id)
      .eq('applicant_id', session.user.id)
      .eq('status', 'DRAFT')

    if (error) {
      return failSafe(error, 'L’enregistrement du brouillon a échoué.')
    }

    revalidatePath('/stagiaire/demande')
    revalidatePath('/stagiaire/documents')
    revalidatePath('/stagiaire/suivi')

    return ok({ savedAt: new Date().toISOString() }, 'Brouillon enregistré.')
  } catch (error) {
    return failSafe(error)
  }
}

/* -------------------------------------------------------------------------- */
/* Submit                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * `submitApplication` — the single, explicit transition DRAFT → SUBMITTED.
 *
 * All validation is repeated inside the database function under a row lock, so
 *   - a double-click cannot create two submissions (the second call sees a
 *     non-DRAFT status and returns a conflict), and
 *   - required documents cannot be skipped by calling the API directly.
 */
export async function submitApplication(): Promise<
  ActionResult<{ status: 'SUBMITTED'; firstMissing?: DocumentType }>
> {
  const session = await requireRole('stagiaire')
  if (!session.ok) return session.result

  const gate = await enforceRateLimit('submitApplication', session.user.id)
  if (!gate.allowed) return gate.result

  try {
    const application = await getCurrentApplication(session.user.id)
    if (!application) {
      return fail('Aucune demande à envoyer. Créez d’abord votre demande.')
    }

    if (application.status !== 'DRAFT') {
      return fail('Votre demande a déjà été envoyée.')
    }

    // Pre-flight check so the user gets a precise, actionable message instead
    // of a generic database error. The database still enforces this.
    const documents = await getApplicationDocuments(application.id)
    const present = new Set(documents.map((d) => d.document_type))
    const missing = REQUIRED_DOCUMENT_TYPES.filter((type) => !present.has(type))

    if (missing.length > 0) {
      return fail(
        `Documents obligatoires manquants : ${missing
          .map((m) => DOCUMENT_LABELS[m])
          .join(', ')}. Ajoutez-les avant d’envoyer votre demande.`,
      )
    }

    const supabase = await createClient()
    const { error } = await supabase.rpc('submit_application', {
      p_application_id: application.id,
    })

    if (error) {
      return fail(mapPgErrorToFrench(error.message))
    }

    revalidatePath('/stagiaire/tableau-de-bord')
    revalidatePath('/stagiaire/suivi')
    revalidatePath('/stagiaire/documents')
    revalidatePath('/stagiaire/demande')
    revalidatePath('/admin/tableau-de-bord')
    revalidatePath('/admin/demandes')

    return ok({ status: 'SUBMITTED' }, 'Votre demande a été envoyée à l’administration.')
  } catch (error) {
    return failSafe(error)
  }
}

const DOCUMENT_LABELS: Record<DocumentType, string> = {
  CV: 'CV',
  MOTIVATION_LETTER: 'Lettre de motivation',
  ENROLLMENT_CERTIFICATE: 'Attestation de scolarité',
  INTERNSHIP_AGREEMENT: 'Convention de stage',
  CIN: 'CIN',
}
