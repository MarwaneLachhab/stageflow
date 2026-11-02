-- =============================================================================
-- APPLIED: StageFlow 0006 — harden SECURITY DEFINER function grants
-- =============================================================================
-- Executed against project khrdcrpdiqmlcecbybfo on 2026-10-20.
-- Source of truth for review: docs/proposed_0006_harden_function_grants.sql
--
-- This file contains FORWARD STATEMENTS ONLY. The rollback lives in the docs
-- file, commented out, and is deliberately not reproduced here.
--
-- Wrapped in a single transaction: if any statement fails, nothing is applied.
-- =============================================================================

begin;

-- ---------------------------------------------------------------------------
-- PART A — log_audit: remove EXECUTE from every client-facing role.
-- No re-grant. Internal callers are SECURITY DEFINER routines running as the
-- owner (postgres), which retains EXECUTE.
-- ---------------------------------------------------------------------------
revoke all on function public.log_audit(text, text, uuid, jsonb)
  from public, anon, authenticated, service_role;

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
  v_uid  uuid := (select auth.uid());
  v_role public.app_role;
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  select role into v_role from public.user_roles where user_id = v_uid;

  insert into public.audit_events (actor_id, actor_role, action, entity_type, entity_id, metadata)
  values (v_uid, v_role, p_action, p_entity_type, p_entity_id, coalesce(p_metadata, '{}'::jsonb));
end;
$$;

-- CREATE OR REPLACE preserves existing privileges, so re-assert the removal.
revoke all on function public.log_audit(text, text, uuid, jsonb)
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- PART B — the nine application RPCs: revoke anonymous EXECUTE only.
-- `authenticated` keeps its grant; the app calls them with the user session.
-- ---------------------------------------------------------------------------
revoke execute on function public.create_draft_application() from anon;
revoke execute on function public.submit_application(uuid) from anon;
revoke execute on function public.start_review(uuid) from anon;
revoke execute on function public.decide_application(uuid, public.application_status, text, public.application_status) from anon;
revoke execute on function public.register_document(uuid, public.document_type, text, text, text, bigint) from anon;
revoke execute on function public.remove_document(uuid) from anon;
revoke execute on function public.get_admin_stats() from anon;
revoke execute on function public.get_application_history(uuid) from anon;
revoke execute on function public.search_admin_applications(text, public.application_status, text, text, date, date, text, text, integer, integer) from anon;

commit;
