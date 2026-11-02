-- =============================================================================
-- StageFlow — hardening status check (READ-ONLY)
-- =============================================================================
-- Run with:  npm run check:hardening
--
-- Deliberately a SINGLE select statement: `supabase db query --file` prints only
-- the last result set of a multi-statement file, so one row of booleans is the
-- only shape that reports reliably.
--
-- EXPECTED BEFORE the patches: every column false.
-- EXPECTED AFTER 0006 + 0007:  every column true.
-- =============================================================================

select
  -- 0006 Part A: log_audit must be unreachable for every client-facing role.
  -- A mere auth.uid() guard would still let a signed-in stagiaire forge audit
  -- events, so all three roles must be denied.
  not has_function_privilege('anon', 'public.log_audit(text,text,uuid,jsonb)', 'execute')
    as log_audit_blocks_anon,
  not has_function_privilege('authenticated', 'public.log_audit(text,text,uuid,jsonb)', 'execute')
    as log_audit_blocks_authenticated,
  not has_function_privilege('service_role', 'public.log_audit(text,text,uuid,jsonb)', 'execute')
    as log_audit_blocks_service_role,

  -- 0006 Part B: the application RPCs stay callable by `authenticated` but not
  -- by `anon`.
  not has_function_privilege('anon', 'public.create_draft_application()', 'execute')
    as rpc_blocks_anon,
  has_function_privilege('authenticated', 'public.create_draft_application()', 'execute')
    as rpc_allows_authenticated,

  -- 0007: exactly one INSERT policy should remain on storage.objects
  -- (storage_own_upload, scoped to the app bucket). More than one means an
  -- over-broad policy such as storage_no_admin_write is still present.
  (select count(*)
     from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and cmd = 'INSERT') = 1
    as single_storage_insert_policy,

  -- 0007 removes one of the five storage policies.
  (select count(*)
     from pg_policies
    where schemaname = 'storage' and tablename = 'objects') = 4
    as storage_policy_count_is_4;
