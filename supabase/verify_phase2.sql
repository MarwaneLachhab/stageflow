-- =============================================================================
-- StageFlow — Phase 2 verification (READ-ONLY)
-- =============================================================================
-- Run this in the Supabase SQL Editor AFTER applying 0001 → 0005.
-- It contains ONLY `select` statements. It cannot modify, delete or create
-- anything, so it is safe to run repeatedly.
--
-- Expected results are stated above each query.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. The 8 application tables, with RLS state and policy count
--    Expected: 8 rows, rls_enabled = true on every row, policies > 0
-- -----------------------------------------------------------------------------
select c.relname                              as table_name,
       c.relrowsecurity                       as rls_enabled,
       (select count(*)
          from pg_policies p
         where p.schemaname = 'public'
           and p.tablename  = c.relname)      as policy_count
  from pg_class     c
  join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public'
   and c.relkind = 'r'
 order by c.relname;


-- -----------------------------------------------------------------------------
-- 2. Every policy on the public tables, by table
--    Expected: 20 rows
--      user_roles 1 · profiles 4 · internship_applications 4 ·
--      application_documents 5 · application_status_history 2 ·
--      admin_private_notes 1 · notifications 2 · audit_events 1
--    (the 5 storage policies are checked separately in section 8)
-- -----------------------------------------------------------------------------
select tablename, policyname, cmd
  from pg_policies
 where schemaname = 'public'
 order by tablename, policyname;


-- -----------------------------------------------------------------------------
-- 3. RPC functions
--    Expected: the 9 application functions are present
--    (create_draft_application, submit_application, start_review,
--     decide_application, register_document, remove_document,
--     get_admin_stats, search_admin_applications, get_application_history)
--    plus is_admin, handle_new_user, log_audit, promote_to_admin,
--    demote_admin, prevent_role_self_assignment, set_updated_at
-- -----------------------------------------------------------------------------
select p.proname                                as function_name,
       pg_get_function_identity_arguments(p.oid) as arguments
  from pg_proc      p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
 order by p.proname;


-- -----------------------------------------------------------------------------
-- 4. The signup trigger on auth.users
--    Expected: 1 row, tgenabled = 'O' (origin/enabled)
-- -----------------------------------------------------------------------------
select tgname                        as trigger_name,
       tgrelid::regclass             as on_table,
       tgenabled                     as enabled
  from pg_trigger
 where tgname = 'on_auth_user_created';


-- -----------------------------------------------------------------------------
-- 5. Privilege check: can a client promote itself to admin?
--    Expected: anon_can_execute = false, authenticated_can_execute = false
-- -----------------------------------------------------------------------------
select has_function_privilege('anon',          'public.promote_to_admin(text)', 'execute') as anon_can_execute,
       has_function_privilege('authenticated', 'public.promote_to_admin(text)', 'execute') as authenticated_can_execute,
       has_function_privilege('anon',          'public.demote_admin(text)',      'execute') as anon_can_demote,
       has_function_privilege('authenticated', 'public.demote_admin(text)',      'execute') as authenticated_can_demote;


-- -----------------------------------------------------------------------------
-- 6. Privilege check: can a client write to user_roles directly?
--    Expected: can_insert = false, can_update = false, can_delete = false
-- -----------------------------------------------------------------------------
select has_table_privilege('authenticated', 'public.user_roles', 'insert') as can_insert,
       has_table_privilege('authenticated', 'public.user_roles', 'update') as can_update,
       has_table_privilege('authenticated', 'public.user_roles', 'delete') as can_delete;


-- -----------------------------------------------------------------------------
-- 7. Private storage bucket
--    Expected: 1 row, public = false, file_size_limit = 5242880,
--              allowed_mime_types = {application/pdf,image/png,image/jpeg}
-- -----------------------------------------------------------------------------
select id, name, public, file_size_limit, allowed_mime_types
  from storage.buckets
 where id = 'application-documents';


-- -----------------------------------------------------------------------------
-- 8. Storage policies on storage.objects
--    Expected: 5 policies (storage_own_upload, storage_own_read,
--              storage_admin_read, storage_own_delete, storage_no_admin_write)
-- -----------------------------------------------------------------------------
select policyname, cmd, roles::text as roles
  from pg_policies
 where schemaname = 'storage'
   and tablename  = 'objects'
 order by policyname;


-- -----------------------------------------------------------------------------
-- 9. Proof that no application data was created or overwritten
--    Expected: every count = 0 (the migrations create structure only)
-- -----------------------------------------------------------------------------
select 'profiles'                  as table_name, count(*) from public.profiles
union all
select 'user_roles',                 count(*) from public.user_roles
union all
select 'internship_applications',    count(*) from public.internship_applications
union all
select 'application_documents',      count(*) from public.application_documents
union all
select 'application_status_history', count(*) from public.application_status_history
union all
select 'admin_private_notes',        count(*) from public.admin_private_notes
union all
select 'notifications',              count(*) from public.notifications
union all
select 'audit_events',               count(*) from public.audit_events
order by table_name;
