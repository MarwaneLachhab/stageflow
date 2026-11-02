-- =============================================================================
-- StageFlow — 0003 : transactional workflows (RPCs)
-- =============================================================================
-- Every privileged mutation lives here rather than in the application layer.
-- Two reasons:
--   1. Atomicity — a status change, its history entry and its notification must
--      all succeed or all fail.
--   2. Column-level safety — RLS row policies alone cannot stop a stagiaire from
--      sending {"status":"ACCEPTED"} in a PATCH body. These functions are the
--      only write path for workflow columns, and RLS denies direct writes.
--
-- All functions are SECURITY DEFINER with an empty search_path and fully
-- qualified identifiers, and each one re-checks auth.uid() and authorization
-- before doing any work.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Helper: write an audit row
-- ---------------------------------------------------------------------------
create or replace function public.log_audit(
  p_action      text,
  p_entity_type text,
  p_entity_id   uuid,
  p_metadata    jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role public.app_role;
begin
  select role into v_role from public.user_roles where user_id = (select auth.uid());
  insert into public.audit_events (actor_id, actor_role, action, entity_type, entity_id, metadata)
  values ((select auth.uid()), v_role, p_action, p_entity_type, p_entity_id, coalesce(p_metadata, '{}'::jsonb));
end;
$$;

revoke all on function public.log_audit(text, text, uuid, jsonb) from public;
grant execute on function public.log_audit(text, text, uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- create_draft_application
-- ---------------------------------------------------------------------------
-- Creates the single allowed draft. The applicant id comes from auth.uid(),
-- never from an argument, so a stagiaire cannot create a request on behalf of
-- somebody else.
create or replace function public.create_draft_application()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid   uuid := (select auth.uid());
  v_id    uuid;
  v_count integer;
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  -- Admins are not applicants; they have no stagiaire workspace.
  if public.is_admin() then
    raise exception 'NOT_AN_APPLICANT' using errcode = '42501';
  end if;

  select count(*) into v_count
  from public.internship_applications
  where applicant_id = v_uid and status in ('DRAFT','SUBMITTED','UNDER_REVIEW');

  if v_count > 0 then
    raise exception 'ACTIVE_APPLICATION_EXISTS' using errcode = '23505';
  end if;

  insert into public.internship_applications (applicant_id, status)
  values (v_uid, 'DRAFT')
  returning id into v_id;

  insert into public.application_status_history (application_id, from_status, to_status, actor_id, actor_role, public_note)
  values (v_id, null, 'DRAFT', v_uid, 'stagiaire', 'Brouillon créé');

  perform public.log_audit('application.draft_created', 'internship_application', v_id);

  return v_id;
end;
$$;

revoke all on function public.create_draft_application() from public;
grant execute on function public.create_draft_application() to authenticated;

-- ---------------------------------------------------------------------------
-- submit_application
-- ---------------------------------------------------------------------------
-- DRAFT -> SUBMITTED. Validates the whole file server-side (dates, motivation,
-- mandatory academic snapshot, mandatory documents) and flips the state exactly
-- once. Double-clicking cannot create two submissions: the status guard plus the
-- row lock make the second call fail with CONFLICT.
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
    raise exception 'CONFLICT: application is already %', v_app.status using errcode = '40001';
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

revoke all on function public.submit_application(uuid) from public;
grant execute on function public.submit_application(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- start_review — SUBMITTED -> UNDER_REVIEW (admin only)
-- ---------------------------------------------------------------------------
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
    raise exception 'CONFLICT: cannot start review from status %', v_app.status using errcode = '40001';
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

revoke all on function public.start_review(uuid) from public;
grant execute on function public.start_review(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- decide_application — UNDER_REVIEW -> ACCEPTED | REJECTED (admin only)
-- ---------------------------------------------------------------------------
-- A refusal reason is MANDATORY (proposed UX/quality improvement over the
-- initial cahier des charges). The reason is public-safe: it is the only text a
-- stagiaire ever sees about the decision. Internal notes stay in
-- admin_private_notes and are RLS-isolated from trainees.
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
    raise exception 'CONFLICT: this application has already been decided (%)', v_app.status using errcode = '40001';
  end if;

  -- Optimistic concurrency: the caller must state the status it observed.
  if v_app.status <> p_expected_status then
    raise exception 'CONFLICT: status changed to % while you were reviewing', v_app.status using errcode = '40001';
  end if;

  if v_app.status not in ('SUBMITTED','UNDER_REVIEW') then
    raise exception 'CONFLICT: cannot decide an application in status %', v_app.status using errcode = '40001';
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

revoke all on function public.decide_application(uuid, public.application_status, text, public.application_status) from public;
grant execute on function public.decide_application(uuid, public.application_status, text, public.application_status) to authenticated;

-- ---------------------------------------------------------------------------
-- register_document / remove_document
-- ---------------------------------------------------------------------------
-- The storage object is uploaded first by the server action (which holds the
-- service credentials), then the metadata row is registered here so the
-- ownership and status checks are atomic and cannot be bypassed.
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
    raise exception 'CONFLICT: documents can only be modified while the application is a draft' using errcode = '40001';
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

revoke all on function public.register_document(uuid, public.document_type, text, text, text, bigint) from public;
grant execute on function public.register_document(uuid, public.document_type, text, text, text, bigint) to authenticated;

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
    raise exception 'CONFLICT: documents are locked after submission' using errcode = '40001';
  end if;

  delete from public.application_documents where id = p_document_id;

  perform public.log_audit('document.removed', 'application_document', p_document_id,
    jsonb_build_object('document_type', v_doc.document_type));

  -- Return the storage key so the caller can delete the private object too.
  return v_doc.storage_key;
end;
$$;

revoke all on function public.remove_document(uuid) from public;
grant execute on function public.remove_document(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Admin dashboard statistics — aggregated in the database, admin only
-- ---------------------------------------------------------------------------
create or replace function public.get_admin_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if (select auth.uid()) is null or not public.is_admin() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'totalApplications', count(*),
    'submitted',         count(*) filter (where status = 'SUBMITTED'),
    'underReview',       count(*) filter (where status = 'UNDER_REVIEW'),
    'accepted',          count(*) filter (where status = 'ACCEPTED'),
    'rejected',          count(*) filter (where status = 'REJECTED'),
    'drafts',            count(*) filter (where status = 'DRAFT'),
    'totalApplicants',   count(distinct applicant_id),
    'recent',            coalesce((
        select jsonb_agg(r) from (
          select jsonb_build_object(
            'id', a.id,
            'firstName', p.first_name,
            'lastName', p.last_name,
            'program', a.program,
            'stageType', a.stage_type,
            'status', a.status,
            'createdAt', a.created_at
          ) as r
          from public.internship_applications a
          left join public.profiles p on p.id = a.applicant_id
          where a.status <> 'DRAFT'
          order by coalesce(a.submitted_at, a.created_at) desc
          limit 6
        ) sub
      ), '[]'::jsonb),
    'monthly',           coalesce((
        select jsonb_agg(m) from (
          select jsonb_build_object(
            'month', to_char(d.month, 'YYYY-MM'),
            'label', to_char(d.month, 'TMMon'),
            'count', coalesce(cnt.c, 0)
          ) as m
          from generate_series(
                 date_trunc('month', timezone('utc', now())) - interval '5 months',
                 date_trunc('month', timezone('utc', now())),
                 interval '1 month'
               ) as d(month)
          left join lateral (
            select count(*) as c
            from public.internship_applications a
            where a.status <> 'DRAFT'
              and date_trunc('month', coalesce(a.submitted_at, a.created_at)) = d.month
          ) cnt on true
          order by d.month
        ) sub2
      ), '[]'::jsonb)
  )
  into v_result
  from public.internship_applications;

  return v_result;
end;
$$;

revoke all on function public.get_admin_stats() from public;
grant execute on function public.get_admin_stats() to authenticated;
