-- =============================================================================
-- PROPOSED 0008 — fix non-returning RPCs (SQLSTATE 40001 triggers PostgREST retry)
-- =============================================================================
-- STATUS: NOT APPLIED. Stored in docs/ so that no db push can pick it up.
--
-- THE DEFECT
-- ----------
-- Five SECURITY DEFINER functions raise business conflicts with:
--     using errcode = '40001'
--
-- 40001 is serialization_failure. PostgREST treats it as retryable and re-runs
-- the transaction. Because the condition is deterministic, it retries forever and
-- the HTTP request never returns.
--
-- Measured against the live project, 20 October 2026:
--   submit_application  on an already-SUBMITTED application -> no response (>8 s)
--   register_document   on a SUBMITTED application          -> no response (>6 s)
--
-- Impact: an authenticated user can wedge a request and hold a connection
-- indefinitely by triggering any of these branches. The correct behaviour is an
-- immediate, readable error.
--
-- THE FIX
-- -------
-- Use P0001 (raise_exception) instead. It is not in the retry class, so the error
-- surfaces immediately. The message text is unchanged (still prefixed CONFLICT:),
-- and the application does not branch on the SQLSTATE — it only logs it — so no
-- client change is required.
--
-- Functions redefined below, bodies copied verbatim from 0003 with only the
-- errcode changed:
--   submit_application, start_review, decide_application,
--   register_document, remove_document
--
-- ROLLBACK: re-run the five definitions from 0003_workflow_functions.sql.
-- =============================================================================

begin;

-- submit_application: 1 occurrence(s)
create or replace function public.submit_application(p_application_id uuid)
returns public.application_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid        uuid := (select auth.uid());
  v_app        public.internship_applications;
  v_missing    text[];
  v_required   text[] := array['CV','MOTIVATION_LETTER','ENROLLMENT_CERTIFICATE'];
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  -- Lock the row so two concurrent submissions cannot both pass the check.
  select * into v_app
  from public.internship_applications
  where id = p_application_id
  for update;

  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_app.applicant_id <> v_uid then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  if v_app.status <> 'DRAFT' then
    raise exception 'CONFLICT: application is already %', v_app.status using errcode = 'P0001';
  end if;

  if v_app.start_date is null or v_app.end_date is null then
    raise exception 'VALIDATION: internship dates are required' using errcode = '22007';
  end if;
  if v_app.end_date <= v_app.start_date then
    raise exception 'VALIDATION: end date must be after start date' using errcode = '22007';
  end if;
  if char_length(trim(v_app.motivation)) < 50 then
    raise exception 'VALIDATION: motivation must contain at least 50 characters' using errcode = '22007';
  end if;
  if coalesce(trim(v_app.school), '') = ''
     or coalesce(trim(v_app.program), '') = ''
     or coalesce(trim(v_app.study_level), '') = '' then
    raise exception 'VALIDATION: academic information is required' using errcode = '22007';
  end if;

  select array_agg(req.t)
  into v_missing
  from unnest(v_required) as req(t)
  where not exists (
    select 1 from public.application_documents d
    where d.application_id = v_app.id
      and d.document_type::text = req.t
  );

  if v_missing is not null and array_length(v_missing, 1) > 0 then
    raise exception 'VALIDATION: missing required documents: %', array_to_string(v_missing, ', ')
      using errcode = '22007';
  end if;

  update public.internship_applications
  set status       = 'SUBMITTED',
      submitted_at = timezone('utc', now()),
      version      = version + 1
  where id = v_app.id;

  insert into public.application_status_history (application_id, from_status, to_status, actor_id, actor_role, public_note)
  values (v_app.id, 'DRAFT', 'SUBMITTED', v_uid, 'stagiaire', 'Votre demande a été envoyée à l’administration.');

  insert into public.notifications (recipient_id, type, application_id, title, body)
  values (
    v_uid,
    'APPLICATION_SUBMITTED',
    v_app.id,
    'Votre demande a bien été envoyée',
    'Votre candidature est maintenant entre les mains de l’administration.'
  );

  perform public.log_audit('application.submitted', 'internship_application', v_app.id);

  return 'SUBMITTED';
end;
$$;

-- start_review: 1 occurrence(s)
create or replace function public.start_review(p_application_id uuid)
returns public.application_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_app public.internship_applications;
begin
  if v_uid is null or not public.is_admin() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  select * into v_app
  from public.internship_applications
  where id = p_application_id
  for update;

  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_app.status = 'UNDER_REVIEW' then
    -- Idempotent: a second admin clicking the same button gets a success.
    return v_app.status;
  end if;

  if v_app.status <> 'SUBMITTED' then
    raise exception 'CONFLICT: cannot start review from status %', v_app.status using errcode = 'P0001';
  end if;

  update public.internship_applications
  set status      = 'UNDER_REVIEW',
      reviewed_at = timezone('utc', now()),
      version     = version + 1
  where id = v_app.id;

  insert into public.application_status_history (application_id, from_status, to_status, actor_id, actor_role, public_note)
  values (v_app.id, 'SUBMITTED', 'UNDER_REVIEW', v_uid, 'admin', 'Votre dossier est en cours d’examen par l’administration.');

  insert into public.notifications (recipient_id, type, application_id, title, body)
  values (
    v_app.applicant_id,
    'APPLICATION_UNDER_REVIEW',
    v_app.id,
    'Votre dossier est en cours d’examen',
    'L’administration a commencé l’étude de votre candidature.'
  );

  perform public.log_audit('application.review_started', 'internship_application', v_app.id);

  return 'UNDER_REVIEW';
end;
$$;

-- decide_application: 3 occurrence(s)
create or replace function public.decide_application(
  p_application_id uuid,
  p_decision       public.application_status,
  p_public_reason  text,
  p_expected_status public.application_status default 'UNDER_REVIEW'
)
returns public.application_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := (select auth.uid());
  v_app    public.internship_applications;
  v_reason text := nullif(trim(coalesce(p_public_reason, '')), '');
begin
  if v_uid is null or not public.is_admin() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  if p_decision not in ('ACCEPTED','REJECTED') then
    raise exception 'VALIDATION: decision must be ACCEPTED or REJECTED' using errcode = '22023';
  end if;

  if v_reason is null or char_length(v_reason) < 10 then
    raise exception 'VALIDATION: a decision reason of at least 10 characters is required' using errcode = '22007';
  end if;

  select * into v_app
  from public.internship_applications
  where id = p_application_id
  for update;

  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;

  -- Terminal states are immutable in the MVP: reopening requires a separate,
  -- audited feature. This also rejects a concurrent duplicate decision.
  if v_app.status in ('ACCEPTED','REJECTED') then
    raise exception 'CONFLICT: this application has already been decided (%)', v_app.status using errcode = 'P0001';
  end if;

  -- Optimistic concurrency: the caller must state the status it observed.
  if v_app.status <> p_expected_status then
    raise exception 'CONFLICT: status changed to % while you were reviewing', v_app.status using errcode = 'P0001';
  end if;

  if v_app.status not in ('SUBMITTED','UNDER_REVIEW') then
    raise exception 'CONFLICT: cannot decide an application in status %', v_app.status using errcode = 'P0001';
  end if;

  update public.internship_applications
  set status                  = p_decision,
      decided_at              = timezone('utc', now()),
      decided_by              = v_uid,
      reviewed_at             = coalesce(reviewed_at, timezone('utc', now())),
      public_rejection_reason = v_reason,
      version                 = version + 1
  where id = v_app.id;

  insert into public.application_status_history (application_id, from_status, to_status, actor_id, actor_role, public_note)
  values (v_app.id, v_app.status, p_decision, v_uid, 'admin', v_reason);

  insert into public.notifications (recipient_id, type, application_id, title, body)
  values (
    v_app.applicant_id,
    case when p_decision = 'ACCEPTED' then 'APPLICATION_ACCEPTED'::public.notification_type
         else 'APPLICATION_REJECTED'::public.notification_type end,
    v_app.id,
    case when p_decision = 'ACCEPTED' then 'Votre demande de stage a été acceptée'
         else 'Votre demande de stage a été refusée' end,
    v_reason
  );

  perform public.log_audit(
    case when p_decision = 'ACCEPTED' then 'application.accepted' else 'application.rejected' end,
    'internship_application',
    v_app.id,
    jsonb_build_object('previous_status', v_app.status)
  );

  return p_decision;
end;
$$;

-- register_document: 1 occurrence(s)
create or replace function public.register_document(
  p_application_id uuid,
  p_document_type  public.document_type,
  p_storage_key    text,
  p_original_name  text,
  p_mime_type      text,
  p_bytes          bigint
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_app public.internship_applications;
  v_id  uuid;
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  select * into v_app from public.internship_applications where id = p_application_id for update;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_app.applicant_id <> v_uid then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  if v_app.status <> 'DRAFT' then
    raise exception 'CONFLICT: documents can only be modified while the application is a draft' using errcode = 'P0001';
  end if;

  if p_storage_key not like v_uid::text || '/' || p_application_id::text || '/%' then
    raise exception 'VALIDATION: storage key does not belong to this applicant' using errcode = '22023';
  end if;

  insert into public.application_documents (
    application_id, uploader_id, document_type, storage_key, original_name, mime_type, bytes
  )
  values (p_application_id, v_uid, p_document_type, p_storage_key, p_original_name, p_mime_type, p_bytes)
  on conflict (application_id, document_type) do update
    set storage_key   = excluded.storage_key,
        original_name = excluded.original_name,
        mime_type     = excluded.mime_type,
        bytes         = excluded.bytes,
        created_at    = timezone('utc', now())
  returning id into v_id;

  perform public.log_audit('document.registered', 'application_document', v_id,
    jsonb_build_object('document_type', p_document_type));

  return v_id;
end;
$$;

-- remove_document: 1 occurrence(s)
create or replace function public.remove_document(p_document_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_doc public.application_documents;
  v_app public.internship_applications;
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  select * into v_doc from public.application_documents where id = p_document_id for update;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;

  select * into v_app from public.internship_applications where id = v_doc.application_id;

  if v_doc.uploader_id <> v_uid then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  if v_app.status <> 'DRAFT' then
    raise exception 'CONFLICT: documents are locked after submission' using errcode = 'P0001';
  end if;

  delete from public.application_documents where id = p_document_id;

  perform public.log_audit('document.removed', 'application_document', p_document_id,
    jsonb_build_object('document_type', v_doc.document_type));

  -- Return the storage key so the caller can delete the private object too.
  return v_doc.storage_key;
end;
$$;

commit;
