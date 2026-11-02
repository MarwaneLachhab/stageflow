import { createClient, createAdminClient } from '@/lib/supabase/server'
import { PAGE_SIZE_DEFAULT } from '@/lib/constants'
import type { ApplicationStatus } from '@/lib/constants'
import type { AdminListQuery } from '@/lib/validation/schemas'

/**
 * Data-access layer for the administration workspace.
 *
 * Aggregation and filtering happen in the DATABASE (see the
 * `get_admin_stats` and `search_admin_applications` functions in migration
 * 0002/0003) so that:
 *   - the browser never receives the full applicant table;
 *   - pagination is stable and bounded (max 25 rows per page);
 *   - the same role check protects every path, because both functions call
 *     `is_admin()` internally and refuse to run otherwise.
 */

export type AdminListRow = {
  id: string
  firstName: string | null
  lastName: string | null
  program: string | null
  school: string | null
  studyLevel: string | null
  stageType: string
  domain: string
  startDate: string | null
  endDate: string | null
  submittedAt: string | null
  createdAt: string
  status: ApplicationStatus
  documentCount: number
}

export type AdminStats = {
  totalApplications: number
  submitted: number
  underReview: number
  accepted: number
  rejected: number
  drafts: number
  totalApplicants: number
  recent: {
    id: string
    firstName: string | null
    lastName: string | null
    program: string | null
    stageType: string
    status: ApplicationStatus
    createdAt: string
  }[]
  monthly: { month: string; label: string; count: number }[]
}

export type AdminListResult = {
  rows: AdminListRow[]
  total: number
  page: number
  pageSize: number
}

const EMPTY_STATS: AdminStats = {
  totalApplications: 0,
  submitted: 0,
  underReview: 0,
  accepted: 0,
  rejected: 0,
  drafts: 0,
  totalApplicants: 0,
  recent: [],
  monthly: [],
}

/**
 * Dashboard KPIs. The numbers come from a single aggregated query — the
 * illustration figures in the mockups (125 / 18 / 25 / 60 / 22) are never
 * hard-coded. A fresh installation honestly shows zeros.
 */
export async function getAdminStats(): Promise<AdminStats> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('get_admin_stats')

  if (error) {
    console.error('[stageflow] getAdminStats failed', { code: error.code })
    return EMPTY_STATS
  }

  // Defensive shaping: a partial payload must not crash a page render.
  const raw = (data ?? {}) as Partial<AdminStats>
  return { ...EMPTY_STATS, ...raw }
}

/** Search / filter / sort / paginate. Server-side only. */
export async function listAdminApplications(query: AdminListQuery): Promise<AdminListResult> {
  const supabase = await createClient()

  const { data, error } = await supabase.rpc('search_admin_applications', {
    p_query: query.q ?? '',
    p_status: query.status === 'ALL' ? null : (query.status ?? null),
    p_formation: query.formation ?? '',
    p_stage_type: query.stageType ?? '',
    p_date_from: query.dateFrom || null,
    p_date_to: query.dateTo || null,
    p_sort: query.sort ?? 'created_at',
    p_direction: query.dir ?? 'desc',
    p_limit: query.pageSize ?? PAGE_SIZE_DEFAULT,
    p_offset: ((query.page ?? 1) - 1) * (query.pageSize ?? PAGE_SIZE_DEFAULT),
  })

  if (error) {
    console.error('[stageflow] listAdminApplications failed', { code: error.code })
    return { rows: [], total: 0, page: 1, pageSize: query.pageSize ?? PAGE_SIZE_DEFAULT }
  }

  const payload = (data ?? {}) as Partial<AdminListResult>
  return {
    rows: payload.rows ?? [],
    total: payload.total ?? 0,
    page: payload.page ?? 1,
    pageSize: payload.pageSize ?? (query.pageSize ?? PAGE_SIZE_DEFAULT),
  }
}

/* -------------------------------------------------------------------------- */
/* Applicant detail                                                            */
/* -------------------------------------------------------------------------- */

export type AdminApplicationDetail = {
  id: string
  applicantId: string
  stageType: string
  domain: string
  startDate: string | null
  endDate: string | null
  mode: string | null
  motivation: string
  status: ApplicationStatus
  submittedAt: string | null
  reviewedAt: string | null
  decidedAt: string | null
  publicRejectionReason: string | null
  version: number
  createdAt: string
  applicant: {
    firstName: string
    lastName: string
    email: string | null
    phone: string | null
    address: string | null
    city: string | null
    birthDate: string | null
  }
  academics: {
    school: string | null
    program: string | null
    studyLevel: string | null
    specialty: string | null
  }
  documents: {
    id: string
    documentType: string
    originalName: string
    mimeType: string
    bytes: number
    createdAt: string
    ownerId: string
  }[]
  privateNotes: {
    id: string
    body: string
    createdAt: string
  }[]
}

/**
 * Full applicant file for screen 11.
 *
 * `applicant.email` is read from the admin-only branch of the profiles RLS
 * policy. A stagiaire calling this function would receive no applicant row and
 * therefore no contact details.
 */
export async function getAdminApplicationDetail(
  applicationId: string,
): Promise<AdminApplicationDetail | null> {
  const supabase = await createClient()

  const { data: application, error } = await supabase
    .from('internship_applications')
    .select(
      'id, applicant_id, stage_type, domain, start_date, end_date, mode, motivation, school, program, study_level, specialty, status, submitted_at, reviewed_at, decided_at, public_rejection_reason, version, created_at',
    )
    .eq('id', applicationId)
    .maybeSingle()

  if (error || !application) {
    if (error) console.error('[stageflow] getAdminApplicationDetail failed', { code: error.code })
    return null
  }

  const [profileResult, documentsResult, notesResult] = await Promise.all([
    supabase
      .from('profiles')
      .select('first_name, last_name, phone, address, city, birth_date, school, program, study_level, specialty, id')
      .eq('id', application.applicant_id)
      .maybeSingle(),
    supabase
      .from('application_documents')
      .select('id, document_type, original_name, mime_type, bytes, created_at, uploader_id')
      .eq('application_id', applicationId)
      .order('created_at', { ascending: true }),
    supabase
      .from('admin_private_notes')
      .select('id, body, created_at')
      .eq('application_id', applicationId)
      .order('created_at', { ascending: false }),
  ])

  const profile = profileResult.data
  const email = await fetchApplicantEmail(supabase, application.applicant_id)

  return {
    id: application.id,
    applicantId: application.applicant_id,
    stageType: application.stage_type,
    domain: application.domain,
    startDate: application.start_date,
    endDate: application.end_date,
    mode: application.mode,
    motivation: application.motivation,
    status: application.status as ApplicationStatus,
    submittedAt: application.submitted_at,
    reviewedAt: application.reviewed_at,
    decidedAt: application.decided_at,
    publicRejectionReason: application.public_rejection_reason,
    version: application.version,
    createdAt: application.created_at,
    applicant: {
      firstName: profile?.first_name ?? '',
      lastName: profile?.last_name ?? '',
      email,
      phone: profile?.phone ?? null,
      address: profile?.address ?? null,
      city: profile?.city ?? null,
      birthDate: profile?.birth_date ?? null,
    },
    academics: {
      // The submitted snapshot wins over the live profile: the reviewed file
      // must reflect what the candidate actually sent.
      school: application.school ?? profile?.school ?? null,
      program: application.program ?? profile?.program ?? null,
      studyLevel: application.study_level ?? profile?.study_level ?? null,
      specialty: application.specialty ?? profile?.specialty ?? null,
    },
    documents: (documentsResult.data ?? []).map((doc) => ({
      id: doc.id,
      documentType: doc.document_type,
      originalName: doc.original_name,
      mimeType: doc.mime_type,
      bytes: doc.bytes,
      createdAt: doc.created_at,
      ownerId: doc.uploader_id,
    })),
    privateNotes: (notesResult.data ?? []).map((note) => ({
      id: note.id,
      body: note.body,
      createdAt: note.created_at,
    })),
  }
}

/**
 * Read the applicant's e-mail address.
 *
 * The `profiles` table does not store the e-mail (it lives in `auth.users`,
 * which is not exposed through PostgREST). Admins need it to contact the
 * candidate, so the address is resolved through the elevated client — but only
 * AFTER the caller has been proven to be an admin by the RLS-protected read of
 * the application above. If a non-admin reached this point the application read
 * would already have returned nothing.
 */
async function fetchApplicantEmail(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<string | null> {
  const { data: roleRow } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', (await supabase.auth.getUser()).data.user?.id ?? '')
    .maybeSingle()

  if (roleRow?.role !== 'admin') return null

  const admin = createAdminClient()
  if (!admin) return null

  const { data, error } = await admin.auth.admin.getUserById(userId)
  if (error) return null
  return data.user?.email ?? null
}

/** Documents are fetched separately so a list page never loads file metadata. */
export async function getAdminApplicationHistory(applicationId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('get_application_history', {
    p_application_id: applicationId,
  })

  if (error) return []
  return (data ?? []) as {
    id: string
    fromStatus: ApplicationStatus | null
    toStatus: ApplicationStatus
    actorRole: string | null
    note: string | null
    createdAt: string
  }[]
}

/** Distinct formation values, used to populate the filter dropdown. */
export async function getDistinctFormations(): Promise<string[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('internship_applications')
    .select('program')
    .not('program', 'is', null)

  if (error || !data) return []

  const unique = new Set<string>()
  for (const row of data) {
    const value = (row.program ?? '').trim()
    if (value) unique.add(value)
  }
  return Array.from(unique).sort((a, b) => a.localeCompare(b, 'fr'))
}

/** Distinct stage types, used to populate the filter dropdown. */
export async function getDistinctStageTypes(): Promise<string[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('internship_applications')
    .select('stage_type')
    .neq('stage_type', '')

  if (error || !data) return []

  const unique = new Set<string>()
  for (const row of data) {
    const value = (row.stage_type ?? '').trim()
    if (value) unique.add(value)
  }
  return Array.from(unique).sort((a, b) => a.localeCompare(b, 'fr'))
}
