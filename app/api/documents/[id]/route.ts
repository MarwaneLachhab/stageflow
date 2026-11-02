import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionUser } from '@/lib/auth/session'
import { DOCUMENTS_BUCKET } from '@/lib/constants'
import { buildSafeContentDisposition, buildSafeInlineContentDisposition } from '@/lib/validation/files'

/**
 * Authorization-checked private document download.
 *
 * `/api/documents/[id]` — the ONLY way a document's bytes leave the server.
 *
 * Why a proxy route instead of a signed URL handed to the browser:
 *  - the authorization decision is made on every single request, so revoking
 *    access is immediate (a pre-signed URL would stay valid until it expired);
 *  - the bytes are streamed with an explicit `Content-Disposition: attachment`
 *    and `X-Content-Type-Options: nosniff`, so an uploaded file can never be
 *    rendered as HTML/JS in the app's origin;
 *  - no storage path is ever exposed to the client, so guessed paths are useless.
 *
 * The three checks performed here, in order:
 *  1. valid session (verified JWT, not a cookie claim);
 *  2. the caller may see the document — either they own it, or they are an admin
 *     AND the document belongs to a real application (no generic bucket browse);
 *  3. the object exists in the bucket.
 *
 * All of the above are backed by RLS on `application_documents` and by the
 * storage policies, so even a bug in this handler cannot widen access.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params
  const preview = request.nextUrl.searchParams.get('preview') === '1'

  // --- 1. Session ---------------------------------------------------------
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Authentification requise.' }, { status: 401 })
  }

  // Reject anything that is not a UUID before it reaches the database.
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: 'Identifiant invalide.' }, { status: 400 })
  }

  const supabase = await createClient()

  // --- 2. Authorization ---------------------------------------------------
  // RLS already restricts this SELECT to documents owned by the caller or, for
  // an admin, to documents belonging to a real application. A missing row and
  // an unauthorized row are indistinguishable here — which is intentional: it
  // prevents using this endpoint to probe for valid document ids.
  const { data: document, error } = await supabase
    .from('application_documents')
    .select('id, application_id, uploader_id, storage_key, original_name, mime_type')
    .eq('id', id)
    .maybeSingle()

  if (error) {
    console.error('[stageflow] document lookup failed', { code: error.code })
    return NextResponse.json({ error: 'Erreur interne.' }, { status: 500 })
  }

  if (!document) {
    return NextResponse.json({ error: 'Document introuvable.' }, { status: 404 })
  }

  const isOwner = document.uploader_id === user.id

  if (!isOwner && user.role !== 'admin') {
    // A stagiaire must never reach another applicant's file.
    return NextResponse.json({ error: 'Accès refusé.' }, { status: 403 })
  }

  if (user.role === 'admin' && !isOwner) {
    // Admins may only read documents tied to a visible application. The RLS
    // SELECT policy on application_documents enforces the same rule, so a
    // successful read above is already the authorization decision.
    const { data: application } = await supabase
      .from('internship_applications')
      .select('id')
      .eq('id', document.application_id)
      .maybeSingle()

    if (!application) {
      return NextResponse.json({ error: 'Accès refusé.' }, { status: 403 })
    }
  }

  // --- 3. Fetch the bytes -------------------------------------------------
  const { data: blob, error: downloadError } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .download(document.storage_key)

  if (downloadError || !blob) {
    console.error('[stageflow] document download failed', downloadError?.message)
    return NextResponse.json({ error: 'Fichier indisponible.' }, { status: 404 })
  }

  const buffer = new Uint8Array(await blob.arrayBuffer())

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      // Allowlisted media type only; never echo the stored value blindly.
      'Content-Type': normaliseMime(document.mime_type),
      'Content-Length': String(buffer.byteLength),
      // Forces a download and neutralises header injection via the filename.
      'Content-Disposition': preview && ['application/pdf', 'image/png', 'image/jpeg'].includes(document.mime_type)
        ? buildSafeInlineContentDisposition(document.original_name || 'document')
        : buildSafeContentDisposition(document.original_name || 'document'),
      // Prevent MIME sniffing from turning a file into executable content.
      'X-Content-Type-Options': 'nosniff',
      // Private documents must never be cached by shared proxies.
      'Cache-Control': 'private, no-store, max-age=0',
      'Content-Security-Policy': "default-src 'none'; sandbox",
    },
  })
}

function normaliseMime(value: string): string {
  const allowed = ['application/pdf', 'image/png', 'image/jpeg']
  return allowed.includes(value) ? value : 'application/octet-stream'
}
