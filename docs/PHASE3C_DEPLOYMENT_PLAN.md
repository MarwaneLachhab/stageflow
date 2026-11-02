# Phase 3C — deployment plan for the two auth fixes

**Status: prepared and reviewed, NOT applied. Awaiting explicit approval.**

Target project: **stageflow-dev** — ref `khrdcrpdiqmlcecbybfo`
(verified via `supabase/.temp/project-ref` and `projects list`: LINKED ●,
"ismailelboutayeby's Project", Central EU Frankfurt).

---

## Patch 1 — `docs/proposed_0008_fix_retryable_conflict_errcode.sql`

### Objects affected

| Function | Conflict branches changed |
| --- | --- |
| `public.submit_application(uuid)` | 1 |
| `public.start_review(uuid)` | 1 |
| `public.decide_application(uuid, application_status, text, application_status)` | 3 |
| `public.register_document(uuid, document_type, text, text, text, bigint)` | 1 |
| `public.remove_document(uuid)` | 1 |
| **Total** | **7 occurrences, 5 functions** |

Only `using errcode = '40001'` → `using errcode = 'P0001'` changes. Everything
else is byte-identical.

### Why this is safe (verified, not assumed)

1. **No genuine serialization failures exist here.** No migration sets an
   isolation level; every function runs at the default `READ COMMITTED`.
   `SERIALIZABLE` is required for a real `40001`. The seven raises are all
   deliberate business conflicts.
2. **Body equivalence proven mechanically.** Each function was extracted from
   both `0003_workflow_functions.sql` and the patch; normalising `P0001` back to
   `40001` makes all five blocks **string-identical** (5/5 identical, 0 differing).
3. **A precedent already returns fast.** `create_draft_application` raises
   `ACTIVE_APPLICATION_EXISTS` with `23505` and responds in ~145 ms — proof that a
   non-retryable code terminates immediately.
4. **Concurrency unchanged.** The `SELECT … FOR UPDATE` row lock and all status
   preconditions are untouched; only the error class changes.
5. **Application mapping unaffected.** No client code branches on the SQLSTATE —
   `failSafe()` only logs `error.code`, and no `message.includes('CONFLICT')`
   mapping exists. The message text keeps its `CONFLICT:` prefix.

### Expected HTTP behaviour

| | Before | After |
| --- | --- | --- |
| `submit_application` on SUBMITTED | **no response** (>8 s measured) | `400` with `CONFLICT: application is already SUBMITTED` |
| `register_document` on SUBMITTED | **no response** (>6 s measured) | `400` with `CONFLICT: …` |

`P0001` maps to HTTP 400. A 409 would be more semantically precise, but `23505`
(unique_violation) would misreport the cause in logs, so `P0001` is preferred.

---

## Patch 2 — `docs/proposed_0009_least_privilege_notifications.sql`

### Objects affected

- Grants on `public.notifications` (table + column level).
- **No** policy, function, trigger or data change.

### Before → after

| Grant | Before | After |
| --- | --- | --- |
| `authenticated` table UPDATE | **true** | **false** |
| `authenticated` UPDATE on `read_at` | true | **true** (kept, column-level) |
| `authenticated` UPDATE on `body` | true | **false** |
| `authenticated` UPDATE on `title` / `type` / `recipient_id` / `application_id` | true | **false** |
| `authenticated` INSERT | false | false (unchanged) |
| `anon` INSERT/UPDATE/DELETE/TRUNCATE | true | **false** (Part B, optional) |
| `service_role` | full | full (unchanged) |

Measured `relacl` before:
`postgres=arwdDxtm | anon=arwdDxtm | authenticated=rwDxtm | service_role=arwdDxtm`

### Why a table-level revoke is required first

A table-level UPDATE grant covers every column, so column-level restrictions are
inert until it is removed. The patch therefore does, in this order:

```sql
revoke update on table public.notifications from authenticated;
grant  update (read_at) on table public.notifications to authenticated;
```

### What stays working

- **RLS untouched.** `notifications_select_own` and `notifications_update_own`
  still restrict rows to `recipient_id = auth.uid()`.
- **Notification creation** happens in SECURITY DEFINER functions
  (`handle_new_user`, `submit_application`, `start_review`, `decide_application`)
  which run as the owner — unaffected by grants to `authenticated`.
- **The app only reads** notifications today (`lib/db/stagiaire.ts`); a future
  "mark as read" still works because `read_at` remains writable.

---

## Application method (transaction-safe, forward-only)

Neither patch is in `supabase/migrations/`, so `db push` cannot pick them up.
Apply each in its own transaction via the linked CLI:

```bash
npm run db:query -- --file docs/proposed_0008_fix_retryable_conflict_errcode.sql
npm run db:query -- --file docs/proposed_0009_least_privilege_notifications.sql
```

Both files already begin with `begin;` and end with `commit;` — a failure anywhere
rolls the whole patch back. They are independent and can be applied in either
order; applying them together is safe because they touch disjoint objects
(function bodies vs. grants on `notifications`).

After applying, create the test marker so the gated suites run:

```bash
# content is informational only
echo "applied 2026-10-20" > .auth-fixes-applied
```

---

## Verification queries

```sql
-- Patch 1: the functions must still exist with the same signatures
select p.proname, pg_get_function_identity_arguments(p.oid) as args
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname='public'
   and p.proname in ('submit_application','start_review','decide_application',
                     'register_document','remove_document')
 order by 1;
-- expected: 5 rows, arguments unchanged

-- Patch 1: no retryable conflict code may remain in those bodies
select proname, position('40001' in prosrc) > 0 as still_uses_40001
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname='public'
   and p.proname in ('submit_application','start_review','decide_application',
                     'register_document','remove_document');
-- expected: still_uses_40001 = false for all five

-- Patch 2: least privilege on notifications
select has_table_privilege('authenticated','public.notifications','update')            as table_update,   -- false
       has_column_privilege('authenticated','public.notifications','read_at','update')  as can_read_at,    -- true
       has_column_privilege('authenticated','public.notifications','body','update')     as can_body,       -- false
       has_column_privilege('authenticated','public.notifications','title','update')    as can_title,      -- false
       has_column_privilege('authenticated','public.notifications','type','update')     as can_type,       -- false
       has_column_privilege('authenticated','public.notifications','recipient_id','update') as can_recipient, -- false
       has_table_privilege('service_role','public.notifications','update')              as service_update; -- true

-- Patch 2: RLS policies untouched (2 rows)
select policyname, cmd from pg_policies
 where schemaname='public' and tablename='notifications' order by policyname;
```

---

## Rollback

| Patch | Rollback |
| --- | --- |
| 0008 | Re-run the five definitions from `supabase/migrations/0003_workflow_functions.sql` |
| 0009 | `grant update on table public.notifications to authenticated;`<br>`grant insert, update, delete, truncate on table public.notifications to anon;` |

Neither patch touches data, so rollback is purely definitions and grants.

---

## Risk assessment

| Risk | Level | Mitigation |
| --- | --- | --- |
| A conflict now surfaces as 400 instead of hanging | **Intended** | Regression test asserts `< 5 s` and `status = 400` |
| Some client depended on the 40001 code | **None found** | No code branches on SQLSTATE (verified by grep) |
| `read_at` update breaks | Low | Explicitly re-granted; test asserts it still works |
| Notification creation breaks | Low | SECURITY DEFINER runs as owner; test asserts 2 WELCOME rows |
| RLS weakened | None | Policies untouched; test asserts cross-user write still blocked |
| Partial application | None | Single transaction per patch |

---

## Test plan

| Stage | Command | Expected |
| --- | --- | --- |
| Before | `npm test` | 208 passed, 37 skipped, 10 files |
| Before | `npm run test:rls:env` | 20 passed, 7 skipped |
| Apply | both `db:query --file` runs | no output, exit 0 |
| Verify | queries above | values as annotated |
| After | `npm run test:auth-fixes` | **11 passed** (was 11 skipped) |
| After | `npm run test:rls:env` | **21 passed, 6 skipped** (double-submit re-enabled) |
| After | `npm test` | 219 passed, 26 skipped |

---

## Not part of this change

- No `db push`, no `db reset`, no migration repair, no migration files touched.
- No data is created, modified or deleted.
