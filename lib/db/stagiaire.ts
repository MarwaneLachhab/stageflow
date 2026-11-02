import { createClient } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/env'
import type { ApplicationStatus, DocumentType } from '@/lib/constants'

/**
 * Data-access layer for the stagiaire workspace.
 *
 * Every function here reads through the *user-scoped* Supabase client, so Row
 * Level Security applies with the caller's real identity. A missing filter is
 * therefore not a data leak: the database refuses to return other users' rows.
 *
 * When Supabase is not configured at all, read helpers that feed a *layout*
 * return an empty/null value rather than throwing. Rendering an unconfigured
 * deployment as "no data" is honest — there is no data — and it keeps the
 * navigation shell visible so the missing configuration is obvious instead of
 * presenting as an opaque crash.
 */

export type ProfileRow = {
  id: string
  first_name: string
  last_name: string
  phone: string | null
  address: string | null
  city: string | null
  birth_date: string | null
  school: string | null
  program: string | null
  study_level: string | null
  specialty: string | null
  created_at: string
  updated_at: string
}

export type ApplicationRow = {
  id: string
  applicant_id: string
  stage_type: string
  domain: string
  start_date: string | null
  end_date: string | null
  mode: string | null
  motivation: string
  school: string | null
  program: string | null
  study_level: string | null
  specialty: string | null
  status: ApplicationStatus
  submitted_at: string | null
  reviewed_at: string | null
  decided_at: string | null
  public_rejection_reason: string | null
  created_at: string
  updated_at: string
}

export type DocumentRow = {
  id: string
  application_id: string
  document_type: DocumentType
  original_name: string
  mime_type: string
  bytes: number
  created_at: string
}

export type HistoryRow = {
  id: string
  from_status: ApplicationStatus | null
  to_status: ApplicationStatus
  actor_role: 'stagiaire' | 'admin' | null
  public_note: string | null
  created_at: string
}

/* -------------------------------------------------------------------------- */
/* Profile                                                                     */
/* -------------------------------------------------------------------------- */

export async function getOwnProfile(userId: string): Promise<ProfileRow | null> {
  if (!isSupabaseConfigured()) return null
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('profiles')
    .select(
      'id, first_name, last_name, phone, address, city, birth_date, school, program, study_level, specialty, created_at, updated_at',
    )
    .eq('id', userId)
    .maybeSingle()

  if (error) {
    console.error('[stageflow] getOwnProfile failed', { code: error.code })
    return null
  }
  return data
}

/* -------------------------------------------------------------------------- */
/* Application                                                                 */
/* -------------------------------------------------------------------------- */

const APPLICATION_COLUMNS =
  'id, applicant_id, stage_type, domain, start_date, end_date, mode, motivation, school, program, study_level, specialty, status, submitted_at, reviewed_at, decided_at, public_rejection_reason, created_at, updated_at'

/**
 * Returns the caller's current (non-terminal) application, or their most recent
 * one if every request has been decided. This is what the dashboard, wizard,
 * documents and tracking screens all render from, so they can never disagree.
 */
export async function getCurrentApplication(userId: string): Promise<ApplicationRow | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('internship_applications')
    .select(APPLICATION_COLUMNS)
    .eq('applicant_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('[stageflow] getCurrentApplication failed', { code: error.code })
    return null
  }
  return data
}

export async function getApplicationById(
  applicationId: string,
  userId: string,
): Promise<ApplicationRow | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('internship_applications')
    .select(APPLICATION_COLUMNS)
    .eq('id', applicationId)
    .eq('applicant_id', userId)
    .maybeSingle()

  if (error) {
    console.error('[stageflow] getApplicationById failed', { code: error.code })
    return null
  }
  return data
}

/* -------------------------------------------------------------------------- */
/* Documents                                                                   */
/* -------------------------------------------------------------------------- */

export async function getApplicationDocuments(applicationId: string): Promise<DocumentRow[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('application_documents')
    .select('id, application_id, document_type, original_name, mime_type, bytes, created_at')
    .eq('application_id', applicationId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('[stageflow] getApplicationDocuments failed', { code: error.code })
    return []
  }
  return data ?? []
}

/* -------------------------------------------------------------------------- */
/* History                                                                     */
/* -------------------------------------------------------------------------- */

export async function getApplicationHistory(applicationId: string): Promise<HistoryRow[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('application_status_history')
    .select('id, from_status, to_status, actor_role, public_note, created_at')
    .eq('application_id', applicationId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('[stageflow] getApplicationHistory failed', { code: error.code })
    return []
  }
  return data ?? []
}

/* -------------------------------------------------------------------------- */
/* Notifications                                                               */
/* -------------------------------------------------------------------------- */

export type NotificationRow = {
  id: string
  type: string
  title: string
  body: string | null
  read_at: string | null
  created_at: string
}

export async function getUnreadNotificationCount(userId: string): Promise<number> {
  if (!isSupabaseConfigured()) return 0
  const supabase = await createClient()
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('recipient_id', userId)
    .is('read_at', null)

  if (error) return 0
  return count ?? 0
}

export async function getNotifications(userId: string, limit = 50): Promise<NotificationRow[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('notifications')
    .select('id, type, title, body, read_at, created_at')
    .eq('recipient_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) return []
  return data ?? []
}

/**
 * Marks one notification as read.
 *
 * `recipient_id` is filtered in the query as well as by RLS, so a forged id
 * belonging to another user updates zero rows instead of leaking a count.
 * Only `read_at` is written — the column-level GRANT (migration 0004) refuses
 * anything else at the database level.
 */
export async function markNotificationRead(id: string, userId: string): Promise<boolean> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', id)
    .eq('recipient_id', userId)
    .is('read_at', null)

  return !error
}

/** Marks every unread notification of the caller as read. */
export async function markAllNotificationsRead(userId: string): Promise<boolean> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('recipient_id', userId)
    .is('read_at', null)

  return !error
}
