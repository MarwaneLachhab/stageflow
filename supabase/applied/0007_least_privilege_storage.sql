-- =============================================================================
-- APPLIED: StageFlow 0007 — least-privilege storage INSERT policy
-- =============================================================================
-- Executed against project khrdcrpdiqmlcecbybfo on 2026-10-20.
-- Source of truth for review: docs/proposed_0007_least_privilege_storage.sql
--
-- FORWARD STATEMENT ONLY. The rollback (policy recreation) lives in the docs
-- file and is deliberately not reproduced here.
--
-- Rationale: `storage_no_admin_write` was an INSERT policy whose check was
-- `bucket_id <> 'application-documents'`. Because INSERT policies are permissive
-- and OR-ed, that granted every authenticated user the right to write into ANY
-- other bucket. No replacement policy is created: with no permissive INSERT
-- policy for those buckets, writes are denied by default, which is the
-- least-privilege outcome and holds for buckets that do not exist yet.
--
-- Writes to `application-documents` remain governed by `storage_own_upload`.
-- =============================================================================

begin;

drop policy if exists storage_no_admin_write on storage.objects;

commit;
