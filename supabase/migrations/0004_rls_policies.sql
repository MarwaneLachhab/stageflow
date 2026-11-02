-- =============================================================================
-- StageFlow — 0004 : Row Level Security + private storage policies
-- =============================================================================
-- RLS is enabled on EVERY table in the public schema, including tables that
-- currently have no policy at all: with RLS on and no policy, access is denied
-- by default, which is exactly what we want for `user_roles`.
-- =============================================================================

alter table public.user_roles                   enable row level security;
alter table public.profiles                     enable row level security;
alter table public.internship_applications      enable row level security;
alter table public.application_documents        enable row level security;
alter table public.application_status_history   enable row level security;
alter table public.admin_private_notes          enable row level security;
alter table public.notifications                enable row level security;
alter table public.audit_events                 enable row level security;

-- ===========================================================================
-- user_roles
-- ===========================================================================
-- Read your own row only (the UI needs to know its role). There is deliberately
-- NO insert/update/delete policy: privilege escalation via a crafted PostgREST
-- request is impossible. Admin rows are created by migration 0005.

drop policy if exists user_roles_select_own on public.user_roles;
create policy user_roles_select_own
  on public.user_roles
  for select
  to authenticated
  using (user_id = (select auth.uid()));

-- ===========================================================================
-- profiles
-- ===========================================================================
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own
  on public.profiles
  for select
  to authenticated
  using (id = (select auth.uid()));

-- Admins need applicant contact details to review a file.
drop policy if exists profiles_select_admin on public.profiles;
create policy profiles_select_admin
  on public.profiles
  for select
  to authenticated
  using (public.is_admin());

-- Column safety: a stagiaire may update their own row, but the UPDATE policy
-- cannot stop extra JSON keys — the column-level guard below does.
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own
  on public.profiles
  for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Insert is handled by the auth trigger (SECURITY DEFINER). Clients cannot
-- create arbitrary profile rows.
drop policy if exists profiles_no_client_insert on public.profiles;
create policy profiles_no_client_insert
  on public.profiles
  for insert
  to authenticated
  with check (false);

-- Privileged columns are not writable by `authenticated`. The trigger and the
-- admin bootstrap connect as a role that owns the table and is unaffected.
revoke insert, update, delete on public.profiles from authenticated;
grant select on public.profiles to authenticated;
grant update (first_name, last_name, phone, address, city, birth_date,
              school, program, study_level, specialty, updated_at)
  on public.profiles to authenticated;

-- ===========================================================================
-- internship_applications
-- ===========================================================================
-- A stagiaire sees only their own requests, and only once submitted are they
-- frozen: the UPDATE policy requires status = 'DRAFT'. Admins see everything.
drop policy if exists applications_select_own on public.internship_applications;
create policy applications_select_own
  on public.internship_applications
  for select
  to authenticated
  using (applicant_id = (select auth.uid()));

drop policy if exists applications_select_admin on public.internship_applications;
create policy applications_select_admin
  on public.internship_applications
  for select
  to authenticated
  using (public.is_admin());

-- No direct INSERT: drafts are created by create_draft_application().
drop policy if exists applications_no_client_insert on public.internship_applications;
create policy applications_no_client_insert
  on public.internship_applications
  for insert
  to authenticated
  with check (false);

drop policy if exists applications_update_own_draft on public.internship_applications;
create policy applications_update_own_draft
  on public.internship_applications
  for update
  to authenticated
  using (applicant_id = (select auth.uid()) and status = 'DRAFT')
  with check (applicant_id = (select auth.uid()) and status = 'DRAFT');

-- No DELETE policy anywhere: an application's history must never vanish. The
-- FK from auth.users is ON DELETE CASCADE for account erasure, which is a
-- deliberate, auditable operator action rather than a client capability.

revoke insert, update, delete on public.internship_applications from authenticated;
grant select on public.internship_applications to authenticated;
-- Draft content only. Workflow columns (status, submitted_at, reviewed_at,
-- decided_at, decided_by, public_rejection_reason, version, applicant_id) are
-- NOT granted: only the SECURITY DEFINER RPCs in 0003 can write them.
grant update (stage_type, domain, start_date, end_date, mode, motivation,
              school, program, study_level, specialty, updated_at)
  on public.internship_applications to authenticated;

-- ===========================================================================
-- application_documents
-- ===========================================================================
drop policy if exists documents_select_own on public.application_documents;
create policy documents_select_own
  on public.application_documents
  for select
  to authenticated
  using (uploader_id = (select auth.uid()));

drop policy if exists documents_select_admin on public.application_documents;
create policy documents_select_admin
  on public.application_documents
  for select
  to authenticated
  using (public.is_admin());

-- Metadata rows are registered/removed by RPCs so the status guard is atomic.
drop policy if exists documents_no_client_insert on public.application_documents;
create policy documents_no_client_insert
  on public.application_documents
  for insert
  to authenticated
  with check (false);

drop policy if exists documents_no_client_update on public.application_documents;
create policy documents_no_client_update
  on public.application_documents
  for update
  to authenticated
  using (false);

drop policy if exists documents_no_client_delete on public.application_documents;
create policy documents_no_client_delete
  on public.application_documents
  for delete
  to authenticated
  using (false);

revoke insert, update, delete on public.application_documents from authenticated;
grant select on public.application_documents to authenticated;

-- ===========================================================================
-- application_status_history — append-only
-- ===========================================================================
drop policy if exists history_select_own on public.application_status_history;
create policy history_select_own
  on public.application_status_history
  for select
  to authenticated
  using (
    exists (
      select 1 from public.internship_applications a
      where a.id = application_status_history.application_id
        and a.applicant_id = (select auth.uid())
    )
  );

drop policy if exists history_select_admin on public.application_status_history;
create policy history_select_admin
  on public.application_status_history
  for select
  to authenticated
  using (public.is_admin());

-- Events are written only by the workflow RPCs. No client INSERT/UPDATE/DELETE.
revoke insert, update, delete on public.application_status_history from authenticated;
grant select on public.application_status_history to authenticated;

-- ===========================================================================
-- admin_private_notes — admin only, invisible to stagiaires
-- ===========================================================================
drop policy if exists notes_admin_all on public.admin_private_notes;
create policy notes_admin_all
  on public.admin_private_notes
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin() and author_id = (select auth.uid()));

-- ===========================================================================
-- notifications — recipient only
-- ===========================================================================
drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own
  on public.notifications
  for select
  to authenticated
  using (recipient_id = (select auth.uid()));

drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own
  on public.notifications
  for update
  to authenticated
  using (recipient_id = (select auth.uid()))
  with check (recipient_id = (select auth.uid()));

revoke insert, delete on public.notifications from authenticated;
grant select on public.notifications to authenticated;
-- Only the read_at flag may be flipped from the client.
grant update (read_at) on public.notifications to authenticated;

-- ===========================================================================
-- audit_events — write-only from the server, readable by admins
-- ===========================================================================
drop policy if exists audit_select_admin on public.audit_events;
create policy audit_select_admin
  on public.audit_events
  for select
  to authenticated
  using (public.is_admin());

revoke insert, update, delete on public.audit_events from authenticated;
grant select on public.audit_events to authenticated;

-- ===========================================================================
-- PRIVATE STORAGE BUCKET
-- ===========================================================================
-- `public = false` is the crucial setting: objects are unreachable without an
-- authorization-checked signed URL. There is no policy that allows listing, and
-- no anonymous access of any kind.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'application-documents',
  'application-documents',
  false,
  5242880, -- 5 MiB, mirrors UPLOAD_RULES.maxBytes
  array['application/pdf','image/png','image/jpeg']
)
on conflict (id) do update
  set public             = false,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- A stagiaire may write only inside their own top-level folder, and only when
-- they have an editable draft. The storage key layout produced by the server is
-- <user_id>/<application_id>/<type>-<random>.<ext>.
drop policy if exists storage_own_upload on storage.objects;
create policy storage_own_upload
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'application-documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (
      select 1 from public.internship_applications a
      where a.id::text = (storage.foldername(name))[2]
        and a.applicant_id = (select auth.uid())
        and a.status = 'DRAFT'
    )
  );

drop policy if exists storage_own_read on storage.objects;
create policy storage_own_read
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'application-documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- Admins may read any review document, but only documents that belong to an
-- application (so the bucket can never be browsed generically).
drop policy if exists storage_admin_read on storage.objects;
create policy storage_admin_read
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'application-documents'
    and public.is_admin()
    and exists (
      select 1
      from public.application_documents d
      join public.internship_applications a on a.id = d.application_id
      where d.storage_key = storage.objects.name
    )
  );

-- A stagiaire may delete their own object while the draft is still editable.
drop policy if exists storage_own_delete on storage.objects;
create policy storage_own_delete
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'application-documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (
      select 1 from public.internship_applications a
      where a.id::text = (storage.foldername(name))[2]
        and a.applicant_id = (select auth.uid())
        and a.status = 'DRAFT'
    )
  );

-- Admins never upload or overwrite candidate files.
drop policy if exists storage_no_admin_write on storage.objects;
create policy storage_no_admin_write
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id <> 'application-documents');
