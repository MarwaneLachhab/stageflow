-- =============================================================================
-- 0010 — fix prevent_role_self_assignment(): DELETE must return OLD
-- =============================================================================
-- Applied to stageflow-dev (khrdcrpdiqmlcecbybfo) on 2026-10-20.
--
-- THE DEFECT
-- ----------
-- The trigger is BEFORE INSERT OR DELETE OR UPDATE ... FOR EACH ROW, and the
-- function ended with `return new;`.
--
-- In a BEFORE DELETE trigger NEW is NULL, so the function returned NULL, and a
-- BEFORE trigger returning NULL **cancels the row operation**. The delete is
-- skipped silently — no error, no warning.
--
-- Consequences measured on the live database:
--   * deleting a user removed the profile (cascade fired) but left the
--     user_roles row behind → orphan rows;
--   * any direct DELETE on public.user_roles was a no-op, so those orphans
--     could not even be cleaned up.
--
-- PROOF (run inside a rolled-back transaction, no application data touched):
--   temp table + BEFORE DELETE trigger returning NEW, then DELETE one row
--   → rows_remaining = 2, the "deleted" row still present.
--
-- THE FIX
-- -------
-- Return OLD for DELETE, NEW otherwise. Nothing else changes: same signature,
-- SECURITY DEFINER, owner, search_path, and the same authorization raise.
--
-- NOTE ON THE GUARD (unchanged, deliberately)
-- -------------------------------------------
-- The check is `if current_user in ('authenticated','anon')`. Inside a SECURITY
-- DEFINER function `current_user` is the function owner (postgres), so this
-- branch does not fire for client sessions. Client writes are in fact blocked by
-- RLS: `user_roles` has a SELECT policy only, so INSERT/UPDATE/DELETE affect
-- zero rows before any trigger runs. That was verified empirically in Phase 3B.
--
-- This patch does NOT touch the guard. Changing it would strengthen a redundant
-- layer and is outside the approved scope.
-- =============================================================================

begin;

create or replace function public.prevent_role_self_assignment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if current_user in ('authenticated', 'anon') then
    raise exception 'FORBIDDEN: user_roles is not writable from a client session' using errcode = '42501';
  end if;

  -- BEFORE DELETE: NEW is NULL. Returning NULL would silently cancel the
  -- delete, which is what previously left orphan rows behind on cascade.
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

commit;

-- =============================================================================
-- VERIFICATION
-- =============================================================================
--   select prosrc from pg_proc p join pg_namespace n on n.oid=p.pronamespace
--    where n.nspname='public' and p.proname='prevent_role_self_assignment';
--   -- expected: contains "case when tg_op = 'DELETE' then old else new end"
--
--   -- deleting a user must now remove the role row too
--   -- (verified in the regression tests, not by hand)
--
-- =============================================================================
-- ROLLBACK
-- =============================================================================
--   create or replace function public.prevent_role_self_assignment()
--   returns trigger language plpgsql security definer set search_path = ''
--   as $$ begin
--     if current_user in ('authenticated','anon') then
--       raise exception 'FORBIDDEN: user_roles is not writable from a client session' using errcode = '42501';
--     end if;
--     return new;
--   end; $$;
--
-- Rollback restores the orphan-producing behaviour; it does not recreate data.
