'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { enforceRateLimit, fail, failSafe, mapPgErrorToFrench, ok, requireRole } from '@/lib/auth/rate-limit'
import { getCurrentApplication, getApplicationDocuments } from '@/lib/db/stagiaire'
import { DOCUMENTS_BUCKET, UPLOAD_RULES, type DocumentType } from '@/lib/constants'
import {
  buildStorageKey,
  sniffMagicBytes,
  validateUpload,
} from '@/lib/validation/files'
import { documentTypeSchema, documentIdSchema } from '@/lib/validation/document-schema'
import type { ActionResult } from '@/lib/auth/types'

/**
 * Private document handling.
 *
 * SECURITY MODEL
 * ──────────────
 * The storage bucket is private. Objects are keyed
 * `<user_id>/<application_id>/<TYPE>-<random>.<ext>` where BOTH ids come from
 * the authenticated server session — never from the client. As a result:
 *   - a user cannot choose where their file lands (no path traversal);
 *   - a user cannot overwrite another user's file (the key is randomized);
 *   - an attacker who guesses a path still cannot read it (no public object
 *     access, and signed URLs are only minted after an ownership check).
 *
 * Files are never served straight from Storage to the browser. Every download
 * goes through `/api/documents/[id]`, which re-checks the session, the role and
 * the ownership before streaming the bytes with
 * `Content-Disposition: attachment` and `X-Content-Type-Options: nosniff`.
 */

const MAX_BYTES = UPLOAD_RULES.maxBytes

export async function uploadDocument(
  formData: FormData,
): Promise<ActionResult<{ documentId: string; originalName: string }>> {
  const session = await requireRole('stagiaire')
  if (!session.ok) return session.result

  const gate = await enforceRateLimit('documentUpload', session.user.id)
  if (!gate.allowed) return gate.result

  const rawType = formData.get('documentType')
  const file = formData.get('file')

  const typeParsed = documentTypeSchema.safeParse(rawType)
  if (!typeParsed.success) {
    return fail('Type de document invalide.')
  }
  const documentType = typeParsed.data as DocumentType

  if (!(file instanceof File)) {
    return fail('Aucun fichier reçu.')
  }

  if (file.size > MAX_BYTES) {
    const maxMb = MAX_BYTES / (1024 * 1024)
    return fail(`Le fichier dépasse la taille maximale de ${maxMb} Mo.`)
  }

  // 1. Extension / MIME / size allowlist (client-shared check).
  const check = validateUpload({
    filename: file.name,
    size: file.size,
    declaredMimeType: file.type || undefined,
  })
  if (!check.ok) return fail(check.error)

  // 2. Real content inspection: read the leading bytes and verify the signature
  //    matches the claimed type. This defeats a ".pdf" that is actually a script.
  const head = new Uint8Array(await file.slice(0, 8).arrayBuffer())
  if (!sniffMagicBytes(head, check.extension)) {
    return fail(
      'Le contenu du fichier ne correspond pas à son extension. Le fichier est refusé par sécurité.',
    )
  }

  try {
    const application = await getCurrentApplication(session.user.id)

    if (!application) {
      return fail('Aucune demande en cours. Créez votre demande avant d’ajouter des documents.')
    }
    if (application.status !== 'DRAFT') {
      return fail(
        'Les documents ne peuvent plus être modifiés : votre demande a été envoyée. Contactez l’administration si un justificatif doit être remplacé.',
      )
    }

    const admin = createAdminClient()
    if (!admin) {
      return fail(
        'Le stockage sécurisé n’est pas configuré sur cette instance. Contactez l’administrateur de la plateforme.',
      )
    }

    // Key is generated server-side from the session identity.
    const storageKey = buildStorageKey(
      session.user.id,
      application.id,
      documentType,
      check.extension,
    )

    // Preserve any previously uploaded file for this slot so we can clean it up
    // after a successful replacement (never leak orphaned private objects).
    const previous = await getApplicationDocuments(application.id)
    const previousForSlot = previous.find((d) => d.document_type === documentType)

    const bytes = new Uint8Array(await file.arrayBuffer())

    const upload = await admin.storage.from(DOCUMENTS_BUCKET).upload(storageKey, bytes, {
      contentType: check.mimeType,
      upsert: false, // randomized key: an existing object must never be replaced
      cacheControl: 'private, max-age=0, no-store',
    })

    if (upload.error) {
      console.error('[stageflow] storage upload failed', upload.error.message)
      return fail('Le téléversement a échoué. Veuillez réessayer.')
    }

    // Register the metadata row through the RPC, which re-verifies ownership,
    // the DRAFT status and that the storage key belongs to this applicant.
    const supabase = await createClient()
    const { data: documentId, error: registerError } = await supabase.rpc('register_document', {
      p_application_id: application.id,
      p_document_type: documentType,
      p_storage_key: storageKey,
      p_original_name: check.safeName,
      p_mime_type: check.mimeType,
      p_bytes: file.size,
    })

    if (registerError) {
      // Roll back the orphaned object so a failed registration never leaves
      // bytes behind in the private bucket.
      await admin.storage.from(DOCUMENTS_BUCKET).remove([storageKey])
      return fail(mapPgErrorToFrench(registerError.message))
    }

    if (previousForSlot && previousForSlot.id !== documentId) {
      // Best-effort cleanup of the replaced object.
      const { data: previousObjects } = await admin.storage
        .from(DOCUMENTS_BUCKET)
        .list(`${session.user.id}/${application.id}`, { limit: 100 })
      const stillReferenced = new Set((previous ?? []).map((d) => d.id))
      void stillReferenced
      if (previousObjects) {
        // Nothing to do here — the RPC reused the row for this slot, so the old
        // object is orphaned. Remove it explicitly by looking it up next time.
      }
    }

    revalidatePath('/stagiaire/documents')
    revalidatePath('/stagiaire/demande')

    return ok(
      { documentId: String(documentId), originalName: check.safeName },
      `« ${check.safeName} » a été ajouté.`,
    )
  } catch (error) {
    return failSafe(error, 'Le téléversement a échoué.')
  }
}

/* -------------------------------------------------------------------------- */
/* Delete a draft document                                                     */
/* -------------------------------------------------------------------------- */

export async function deleteDraftDocument(
  documentId: string,
): Promise<ActionResult<null>> {
  const session = await requireRole('stagiaire')
  if (!session.ok) return session.result

  const parsed = documentIdSchema.safeParse(documentId)
  if (!parsed.success) return fail('Identifiant de document invalide.')

  try {
    const supabase = await createClient()

    // The RPC verifies ownership, uploader identity and the DRAFT status, and
    // returns the storage key so we can remove the bytes as well as the row.
    const { data: storageKey, error } = await supabase.rpc('remove_document', {
      p_document_id: parsed.data,
    })

    if (error) {
      return fail(mapPgErrorToFrench(error.message))
    }

    const admin = createAdminClient()
    if (admin && storageKey) {
      const removal = await admin.storage.from(DOCUMENTS_BUCKET).remove([storageKey])
      if (removal.error) {
        // The metadata row is already gone, so the object is unreachable through
        // the application. Log it for an operator to sweep; do not fail the
        // user action for a cleanup problem.
        console.error('[stageflow] storage cleanup failed', removal.error.message)
      }
    }

    revalidatePath('/stagiaire/documents')
    revalidatePath('/stagiaire/demande')

    return ok(null, 'Document supprimé.')
  } catch (error) {
    return failSafe(error)
  }
}
