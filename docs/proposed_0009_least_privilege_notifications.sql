-- =============================================================================
-- PROPOSED 0009 — least privilege on public.notifications
-- =============================================================================
-- STATUS: NOT APPLIED. Stored in docs/ so that no db push can pick it up.
--
-- THE DEFECT
-- ----------
-- `authenticated` holds a TABLE-LEVEL UPDATE grant on public.notifications:
--
--   pg_class.relacl = postgres=arwdDxtm | anon=arwdDxtm | authenticated=rwDxtm
--                                                                  ^ w = UPDATE
--
-- A table-level grant covers every column, so the intended guarantee — "a user
-- may only mark their own notification as read" — is not enforced. Any signed-in
-- user can rewrite the title, body, type, recipient_id or application_id of a
-- notification they own. Verified: the RLS test
-- "a stagiaire cannot rewrite the body of a notification" currently records the
-- weakness rather than a protection.
--
-- WHAT IS ALREADY CORRECT (and is preserved)
-- ------------------------------------------
--   * RLS policy `notifications_update_own` restricts rows to
--     `recipient_id = auth.uid()`. This patch does not touch policies.
--   * `authenticated` has NO INSERT privilege (already revoked): a client cannot
--     fabricate notifications.
--   * All legitimate writes are INSERTs inside SECURITY DEFINER functions
--     (handle_new_user, submit_application, start_review, decide_application),
--     which execute as the owner and are unaffected by grants to `authenticated`.
--   * The application only SELECTs notifications today
--     (lib/db/stagiaire.ts: getNotifications / getUnreadNotificationCount).
--
-- THE FIX
-- -------
-- Drop the table-level UPDATE grant, then re-grant UPDATE on `read_at` alone.
-- Column-level privileges only take effect once no table-level grant remains, so
-- both statements are required and must run in this order.
--
-- =============================================================================

begin;

-- Part A — the core fix.
revoke update on table public.notifications from authenticated;
grant  update (read_at) on table public.notifications to authenticated;

-- Part B — OPTIONAL defence in depth. `anon` currently holds ALL on this table
-- (arwdDxtm). RLS has no policy for anon, so every operation is already denied in
-- practice; removing the grants means a future policy mistake cannot expose it.
-- No function writes as `anon`, so nothing legitimate depends on these.
revoke insert, update, delete, truncate on table public.notifications from anon;

commit;

-- =============================================================================
-- VERIFICATION AFTER APPLYING
-- =============================================================================
--   -- must be false: the user can no longer write the body
--   select has_column_privilege('authenticated','public.notifications','body','update');
--
--   -- must be true: read_at stays writable
--   select has_column_privilege('authenticated','public.notifications','read_at','update');
--
--   -- must be false for every one of these
--   select
--     has_column_privilege('authenticated','public.notifications','title','update')          as title,
--     has_column_privilege('authenticated','public.notifications','body','update')           as body,
--     has_column_privilege('authenticated','public.notifications','type','update')           as type,
--     has_column_privilege('authenticated','public.notifications','recipient_id','update')   as recipient,
--     has_column_privilege('authenticated','public.notifications','application_id','update') as application;
--
--   -- must be false: no table-level UPDATE remains
--   select has_table_privilege('authenticated','public.notifications','update');
--
--   -- RLS policies must be unchanged (2 rows: select_own, update_own)
--   select policyname, cmd from pg_policies
--    where schemaname='public' and tablename='notifications' order by policyname;
--
--   -- service_role keeps full access
--   select has_table_privilege('service_role','public.notifications','update');

-- =============================================================================
-- ROLLBACK
-- =============================================================================
--   grant update on table public.notifications to authenticated;
--   grant insert, update, delete, truncate on table public.notifications to anon;
--
-- No data is touched; rollback is purely a grant reset.
