-- =============================================================================
-- StageFlow — 0006: harden SECURITY DEFINER function grants
-- =============================================================================
-- STATUS: prepared for approval. Stored in `docs/` on purpose: anything inside
-- `supabase/migrations/` is picked up automatically by `supabase db push`.
--
-- =============================================================================
-- PART A — log_audit must be callable ONLY by trusted database routines
-- =============================================================================
-- Measured state before the patch (pg_proc.proacl):
--
--   postgres=X/postgres | anon=X/postgres | authenticated=X/postgres
--                       | service_role=X/postgres
--
-- Note: PUBLIC has no EXECUTE (there is no `=X/postgres` entry). The grants are
-- explicit per role, inherited from Supabase's default privileges.
--
-- Measured role membership (pg_auth_members): `anon` is NOT a member of
-- `authenticated` and vice versa, so neither revocation implies the other.
--
-- THREAT THAT A MERE auth.uid() CHECK WOULD NOT CLOSE
-- ---------------------------------------------------
-- Adding only an `auth.uid() is not null` guard would stop anonymous callers but
-- would still let ANY signed-in stagiaire call
--
--     POST /rest/v1/rpc/log_audit  { p_action: 'application.accepted', ... }
--
-- and forge an audit entry attributed to themselves. A signed-in user must never
-- be able to author arbitrary audit records. The real control is therefore to
-- remove EXECUTE from every client-facing role, leaving the function reachable
-- only through SECURITY DEFINER routines that run as its owner (postgres).
--
-- WHY INTERNAL CALLS KEEP WORKING
-- -------------------------------
-- The six legitimate call sites (0003 lines 84, 181, 243, 334, 405, 447) are all
-- `perform public.log_audit(...)` inside SECURITY DEFINER functions owned by
-- postgres. When such a function executes, the effective user is the owner, and
-- the owner always retains EXECUTE. Revoking from client roles does not touch
-- that path. `handle_new_user` never calls log_audit, so signup is unaffected.
--
-- The AUTH_REQUIRED guard below is defence in depth: it makes the function
-- refuse to write without an authenticated context even if a future GRANT
-- re-opens the door. All six current call sites satisfy it because every calling
-- RPC already requires a session.

-- 1. Remove EXECUTE from every client-facing role. Deliberately no re-grant.
revoke all on function public.log_audit(text, text, uuid, jsonb)
  from public, anon, authenticated, service_role;

-- 2. Defence in depth: refuse the call when there is no authenticated caller.
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

-- 3. State the grant surface explicitly: CREATE OR REPLACE preserves existing
--    privileges, so re-assert the removal rather than relying on that.
revoke all on function public.log_audit(text, text, uuid, jsonb)
  from public, anon, authenticated, service_role;

-- =============================================================================
-- PART B — revoke anonymous EXECUTE on the nine application RPCs
-- =============================================================================
-- These nine already raise AUTH_REQUIRED / FORBIDDEN for anonymous callers
-- (proven empirically). Revoking EXECUTE removes the surface instead of trusting
-- each function to remember its guard. `authenticated` KEEPS its grant: the app
-- calls them through the user-scoped client.
--
-- Deliberately NOT revoked:
--   * is_admin()                     — harmless boolean, RLS policies call it
--   * handle_new_user()              — returns `trigger`, not RPC-callable
--   * prevent_role_self_assignment() — returns `trigger`, not RPC-callable
--   * rls_auto_enable()              — Supabase platform function, not ours

revoke execute on function public.create_draft_application() from anon;
revoke execute on function public.submit_application(uuid) from anon;
revoke execute on function public.start_review(uuid) from anon;
revoke execute on function public.decide_application(uuid, public.application_status, text, public.application_status) from anon;
revoke execute on function public.register_document(uuid, public.document_type, text, text, text, bigint) from anon;
revoke execute on function public.remove_document(uuid) from anon;
revoke execute on function public.get_admin_stats() from anon;
revoke execute on function public.get_application_history(uuid) from anon;
revoke execute on function public.search_admin_applications(text, public.application_status, text, text, date, date, text, text, integer, integer) from anon;

-- =============================================================================
-- VERIFICATION AFTER APPLYING
-- =============================================================================
--   select has_function_privilege('anon',          'public.log_audit(text,text,uuid,jsonb)','execute') as anon,
--          has_function_privilege('authenticated', 'public.log_audit(text,text,uuid,jsonb)','execute') as authenticated,
--          has_function_privilege('service_role',  'public.log_audit(text,text,uuid,jsonb)','execute') as service_role;
--   -- expected: false | false | false
--
--   npm run check:hardening
--   -- expected: all columns true

-- =============================================================================
-- ROLLBACK (commented — never executed with the forward patch)
-- =============================================================================
--   grant execute on function public.log_audit(text, text, uuid, jsonb)
--     to anon, authenticated, service_role;
--   -- and restore the original body from 0003_workflow_functions.sql:20-41
--   grant execute on function public.create_draft_application() to anon;
--   grant execute on function public.submit_application(uuid) to anon;
--   grant execute on function public.start_review(uuid) to anon;
--   grant execute on function public.decide_application(uuid, public.application_status, text, public.application_status) to anon;
--   grant execute on function public.register_document(uuid, public.document_type, text, text, text, bigint) to anon;
--   grant execute on function public.remove_document(uuid) to anon;
--   grant execute on function public.get_admin_stats() to anon;
--   grant execute on function public.get_application_history(uuid) to anon;
--   grant execute on function public.search_admin_applications(text, public.application_status, text, text, date, date, text, text, integer, integer) to anon;
