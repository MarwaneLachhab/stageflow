-- =============================================================================
-- PROPOSED 0011 — least privilege on public.user_roles
-- =============================================================================
-- STATUS: NOT APPLIED. Stored in docs/ so that no db push can pick it up.
--
-- THE FINDING
-- -----------
-- Measured ACL on the live database:
--
--   postgres=arwdDxtm | anon=arwdDxtm | authenticated=arwdDxtm | service_role=arwdDxtm
--
-- `arwdDxtm` is the full set: INSERT, SELECT, UPDATE, DELETE, TRUNCATE,
-- REFERENCES, TRIGGER. `authenticated` therefore holds write privileges on the
-- table that decides who is an administrator.
--
-- Today the writes are refused by RLS: `user_roles` has exactly one policy,
-- `user_roles_select_own` (SELECT). Verified empirically — an authenticated
-- UPDATE/DELETE/INSERT affects zero rows.
--
-- But that leaves role protection resting on a SINGLE layer:
--
--   * the trigger guard is inert — inside a SECURITY DEFINER function
--     `current_user` is the owner (postgres), so
--     `if current_user in ('authenticated','anon')` never fires;
--   * the GRANT layer actively permits the writes;
--   * only the absence of a permissive policy stops it.
--
-- One future `create policy ... for update to authenticated` — added for an
-- unrelated feature — would silently turn user_roles into a self-service role
-- table. This patch removes that possibility.
--
-- NOTE ON TRUNCATE
-- ----------------
-- TRUNCATE is **not** subject to row level security. A client holding TRUNCATE
-- cannot reach it through PostgREST (there is no such endpoint), but the grant
-- has no business existing on a security-critical table.
--
-- WHAT THIS PATCH DOES NOT TOUCH
-- ------------------------------
--   * RLS policies — unchanged, still the row-level control;
--   * `promote_to_admin()` / `demote_admin()` — SECURITY DEFINER, run as owner;
--   * `handle_new_user()` — inserts the role row as owner during signup;
--   * `is_admin()` — SECURITY DEFINER, reads the table as owner;
--   * `service_role` — keeps full access for trusted server operations;
--   * `authenticated` SELECT — kept, required by `user_roles_select_own` so the
--     app can read its own role.
-- =============================================================================

begin;

-- A signed-in user may read their own role, never write it.
revoke insert, update, delete, truncate on table public.user_roles from authenticated;

-- Anonymous visitors have no policy on this table at all; remove the grants so
-- a future policy mistake cannot expose it.
revoke insert, update, delete, truncate, select on table public.user_roles from anon;

commit;

-- =============================================================================
-- VERIFICATION AFTER APPLYING
-- =============================================================================
--   select has_table_privilege('authenticated','public.user_roles','insert')   as ins,   -- false
--          has_table_privilege('authenticated','public.user_roles','update')   as upd,   -- false
--          has_table_privilege('authenticated','public.user_roles','delete')   as del,   -- false
--          has_table_privilege('authenticated','public.user_roles','truncate') as trunc, -- false
--          has_table_privilege('authenticated','public.user_roles','select')   as sel,   -- true
--          has_table_privilege('service_role','public.user_roles','update')    as svc;   -- true
--
--   -- RLS policies must be unchanged (1 row)
--   select policyname, cmd from pg_policies
--    where schemaname='public' and tablename='user_roles';
--
-- Behavioural checks after applying (the existing suites already cover them):
--   npm run test:auth:phase3      -- signup still provisions a stagiaire role
--   npm run test:role-guard       -- cascade + no self-promotion
--   npm run test:rls:env          -- full RLS matrix
--   PHASE3_TEST_ADMIN=1 npm run test:rls:env   -- admin operations unaffected
--
-- =============================================================================
-- ROLLBACK
-- =============================================================================
--   grant insert, update, delete, truncate on table public.user_roles to authenticated;
--   grant insert, update, delete, truncate, select on table public.user_roles to anon;
--
-- No data is touched; rollback is purely a grant reset.
