# Migration history reconciliation

**Status: PLAN ONLY — nothing in this document has been executed.**
Awaiting owner approval. See `docs/TEST_REPORT.md` § « Phase 2 » for the
verification evidence.

---

## 1. Observed state (measured, 20 October 2026)

| Check | Command | Result |
| --- | --- | --- |
| Schema `supabase_migrations` exists | `select exists(... from pg_namespace ...)` | **false** |
| Table `supabase_migrations.schema_migrations` exists | `select to_regclass(...)` | **NULL** |
| Local versions parsed by CLI | `supabase migration list --linked` | `0001` … `0005`, `9999` |
| Remote versions | same | *(all empty)* |

The five migrations were applied through the SQL Editor, which executes SQL but
does **not** write to the CLI's history table. The database is fully migrated;
the CLI simply has no record of it.

Version identifiers are exactly the file prefixes and the CLI already parses
them correctly:

```
0001_init_schema.sql            → version 0001
0002_indexes_and_views.sql      → version 0002
0003_workflow_functions.sql     → version 0003
0004_rls_policies.sql           → version 0004
0005_admin_bootstrap.sql        → version 0005
9999_dev_seed.sql               → version 9999
```

No timestamp-style versions (`20261020010101_...`) are used, and none are
required — the CLI sorts whatever prefix is present.

## 2. Why it matters

`supabase db push` applies every local migration that has no matching remote
record. With an empty history, that means it would attempt **all six files**,
including `9999_dev_seed.sql`.

Two mitigating facts, both verified:

- The five schema migrations are idempotent: `create table if not exists`,
  guarded `create type`, `drop policy if exists` before every `create policy`,
  `create or replace function`, and `insert … on conflict do update` for the
  bucket.
- `9999_dev_seed.sql` is gated by `current_setting('stageflow.seed_demo')` and
  is a no-op unless that setting is `'on'`. It is **not** set.

So a replay would probably succeed and change nothing. "Probably" is not a
guarantee, and re-running DDL against a database that already contains it is
unnecessary risk. The history should be reconciled instead.

## 3. Options

### Option A — Repair the history (recommended)

Record the five versions as applied **without executing any SQL**:

```bash
npx supabase migration repair --status applied 0001 0002 0003 0004 0005 --linked
```

- Creates the `supabase_migrations` schema and history table.
- Inserts five rows marking those versions applied.
- Executes **no** migration body.
- Reversible (see §6).

Risk: **low**. The only write is to the CLI's own bookkeeping table.

### Option B — Leave it alone

Do nothing and simply never run `db push`. Acceptable if the project keeps using
the SQL Editor.

Risk: **low today**, but the trap stays armed for whoever runs `db push` next —
including a future you.

### Option C — `db push` and let it replay

Not recommended. It would re-run 0001–0005 and touch `9999` for no benefit.

## 4. The `9999_dev_seed.sql` question

After Option A, `9999` remains **local-only**, so any future `db push` would try
to run it. It is a no-op by default, but it does not belong in the deploy path.

Three choices — this needs a decision, so nothing was changed:

1. **Leave it pending.** Harmless (guarded), but noisy in `migration list`.
2. **Move it out of the migrations directory**, e.g. to
   `supabase/seed/dev_seed.sql`. Cleanest: `db push` can then never touch it.
   It is a local file move, fully reversible.
3. **Mark it applied too** (`… repair --status applied 9999`). Accurate only if
   the seed was actually run — it was not, so this would record something untrue.

Recommendation: **option 2** (move), combined with Option A for 0001–0005.

## 5. Verification after repair

```bash
npx supabase migration list --linked
```

Expected — every version present in both columns:

```
   Local  | Remote | Time (UTC)
  --------|--------|------------
   `0001` | `0001` | `0001`
   `0002` | `0002` | `0002`
   `0003` | `0003` | `0003`
   `0004` | `0004` | `0004`
   `0005` | `0005` | `0005`
   `9999` | ` `    | `9999`      ← expected to stay local-only
```

Cross-check in SQL (read-only):

```sql
select version, name from supabase_migrations.schema_migrations order by version;
-- expected: five rows, 0001 … 0005
```

Then confirm nothing was executed:

```sql
select count(*) from public.profiles;   -- still 0
select count(*) from public.audit_events; -- still 0
```

## 6. Rollback

The repair only writes bookkeeping rows. To undo:

```sql
delete from supabase_migrations.schema_migrations where version in ('0001','0002','0003','0004','0005');
```

If the schema itself should go:

```sql
drop schema supabase_migrations cascade;
```

Neither affects application data, because the repair never touched it.

## 7. What is NOT part of this plan

- No `db push`, no `db reset`, no migration body re-execution.
- No change to the five existing migration files.
- No data seeding.
