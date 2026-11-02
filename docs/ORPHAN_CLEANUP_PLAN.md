# Orphan `user_roles` rows — cleanup plan

**Status: PLAN ONLY. Nothing has been deleted.**

22 rows in `public.user_roles` reference `auth.users` rows that no longer exist.
They are debris from Phase 3 test fixtures, created between 19:10 and 22:18 UTC
on 2026-10-20 (before the trigger fix in 0010 made cascade work).

Measured (read-only):

| Check | Value |
| --- | --- |
| Orphans in `user_roles` | **22** |
| Orphans in `profiles` | 0 |
| Orphans in `notifications` | 0 |
| Orphans with role `admin` | **0** (all `stagiaire`) |
| Tables referencing `user_roles` | none |
| Valid rows currently in `user_roles` | 4–6 depending on test accounts |

---

## Why the previous proposal was wrong

The earlier draft suggested `create table public._orphan_roles_backup as …`.
That is a bad idea for two reasons:

1. **It creates a table in the `public` schema**, which PostgREST exposes. A
   backup table would immediately become a REST endpoint — a new, unprotected
   surface created purely to support a delete.
2. **It implies a rollback that does not exist.** See below.

## Foreign-key implications of rollback

`user_roles.user_id` → `auth.users(id) ON DELETE CASCADE`. The users these rows
point at are gone. Therefore:

> Restoring the backup would **fail the foreign key**. The rows can only be
> re-inserted if the exact same UUIDs are recreated in `auth.users`, which is not
> practically possible.

So the deletion is **irreversible in practice**. The backup is forensic evidence
(what was deleted, when), not a restore path. Anyone approving the cleanup should
approve it on that basis.

## Recommended procedure (no database backup object)

**Step 1 — export to a local file, not a table**

```bash
npx supabase db query --linked --output json \
  "select r.* from public.user_roles r
    where not exists (select 1 from auth.users u where u.id = r.user_id)" \
  > docs/orphans-2026-10-20.json
```

This writes to disk only. No schema change, no exposed endpoint, no new grants.

**Step 2 — confirm the set before deleting**

```sql
select count(*) as n,
       string_agg(distinct role::text, ',') as roles,
       count(*) filter (where role = 'admin') as admins
  from public.user_roles r
 where not exists (select 1 from auth.users u where u.id = r.user_id);
-- expected: 22 | stagiaire | 0
```

Abort if `admins > 0`, if the count is not 22, or if any role is not `stagiaire`.

**Step 3 — delete inside a transaction, checking the row count**

```sql
begin;
delete from public.user_roles r
 where not exists (select 1 from auth.users u where u.id = r.user_id);
-- must report exactly 22 rows deleted
select count(*) as remaining,
       (select count(*) from public.user_roles r2
         where not exists (select 1 from auth.users u where u.id = r2.user_id)) as orphans_left
  from public.user_roles;
-- expected: remaining = valid count (currently 6), orphans_left = 0
commit;
```

If the count is not 22, `rollback;` instead of `commit;` — nothing is lost.

**Step 4 — post-check**

```sql
select count(*) from public.user_roles r
 where not exists (select 1 from auth.users u where u.id = r.user_id);   -- 0
select count(*) from auth.users;                                        -- unchanged
```

## Effect

- 22 rows removed from `user_roles`; nothing else changes.
- No FK cascade is triggered (no table references `user_roles`).
- No application data is affected: these rows belong to no live account and
  cannot be read by any session.
- `profiles` and `notifications` already have no orphans, so nothing to clean
  there.

## Recovery

Only the local JSON export. Re-insertion would fail the FK unless the deleted
`auth.users` rows were recreated with identical UUIDs. Treat the cleanup as
one-way.

## Alternative: do nothing

The rows are inert — no session can ever carry those UUIDs, so they grant no
access and expose nothing. If irreversibility is unacceptable, leaving them is a
defensible choice; the only cost is 22 stale rows.

**Recommendation:** export to `docs/orphans-2026-10-20.json`, then delete. The
rows are demonstrably test debris and will otherwise accumulate again from any
future fixture run (though the 0010 fix prevents new ones).
