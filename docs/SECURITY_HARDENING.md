# Security hardening review

**Status: APPLIED AND VERIFIED — 20 October 2026, project `khrdcrpdiqmlcecbybfo`.**

Patches A (log_audit), B (anon EXECUTE on 9 RPCs) and C (storage policy) were
approved and applied. Migration history repair was **not** executed.

Source: `npx supabase db advisors --linked` → **0 ERROR, 33 WARN** before,
**0 ERROR, 23 WARN** after.

| Measure | Before | After |
| --- | --- | --- |
| Advisor findings | 33 | **23** |
| `anon_security_definer_function_executable` | 14 | **4** (all justified) |
| `authenticated_security_definer_function_executable` | 14 | **13** |
| `log_audit` executable by `anon` | **true** | **false** |
| `log_audit` executable by `authenticated` | **true** | **false** |
| `log_audit` executable by `service_role` | **true** | **false** |
| App RPCs executable by `anon` | true (9) | **false (9)** |
| App RPCs executable by `authenticated` | true | **true** (unchanged) |
| Storage INSERT policies | 2 | **1** |
| Storage policies total | 5 | **4** |

Verified by `npm run check:hardening` — all seven columns `true`.

---

## Correction to the original Part A proposal

The first version of `proposed_0006` revoked `anon` and then **granted EXECUTE to
`authenticated`**, with only an `auth.uid()` guard. That was insufficient: a
signed-in stagiaire could still call `POST /rest/v1/rpc/log_audit` and forge an
audit event attributed to themselves.

The applied version revokes EXECUTE from `public, anon, authenticated,
service_role` and **grants to nobody**, so `log_audit` is reachable only from
SECURITY DEFINER routines running as the owner. The `AUTH_REQUIRED` guard is
retained as defence in depth.

Measured facts that shaped the fix:

- `pg_proc.proacl` was `postgres=X | anon=X | authenticated=X | service_role=X`
  (PUBLIC had no EXECUTE).
- `pg_auth_members` shows `anon` is **not** a member of `authenticated` and vice
  versa, so neither revocation implies the other.

---

## Post-application verification

| Check | Evidence |
| --- | --- |
| `log_audit` denied to anonymous | `POST /rest/v1/rpc/log_audit` → **401** `permission denied for function log_audit` |
| 9 RPCs denied to anonymous | all nine → **401** `permission denied for function …` |
| 9 RPCs still callable by signed-in users | `has_function_privilege('authenticated', …)` → **true** for all |
| Signup trigger unchanged | `on_auth_user_created` enabled; still inserts profile + role + notification; **does not call `log_audit`**; only role literal is `'stagiaire'` |
| Storage least privilege | 4 policies remain: `storage_own_upload` (INSERT), `storage_own_read`, `storage_own_delete`, `storage_admin_read` |
| No data destroyed | row counts unchanged; `audit_events` still 0 — the forged request was denied before writing |

---

## 1. Confirmed vulnerabilities

### V1 — `log_audit` executable by anonymous users, with no caller check

| | |
| --- | --- |
| Object | `public.log_audit(p_action text, p_entity_type text, p_entity_id uuid, p_metadata jsonb)` |
| Property | `SECURITY DEFINER`, returns `void` |
| Grant | `anon` → EXECUTE **true** |
| Guard | **none** — body inserts immediately |

An anonymous request to `POST /rest/v1/rpc/log_audit` can insert rows into
`public.audit_events` with `actor_id = NULL`.

**What it is not:** no read access, no impersonation (`actor_id` comes from
`auth.uid()`, never a parameter), no privilege escalation, no change to any
application, role or document.

**What it is:** the audit trail can be polluted with arbitrary `action`,
`entity_type` and `metadata` strings — an integrity and denial-of-audit issue.

Severity: **Medium** (integrity), not Critical.

### V2 — Over-broad storage INSERT policy

| | |
| --- | --- |
| Policy | `storage_no_admin_write` on `storage.objects` |
| Declared intent | "Admins never upload or overwrite candidate files" |
| Actual effect | `with check (bucket_id <> 'application-documents')` — grants **every authenticated user** INSERT into any *other* bucket |

No effect today (one bucket exists). It becomes a real hole the day a second
bucket is created.

Severity: **Low now, Medium if a bucket is added**.

### V3 — Table-level write grants on `user_roles` (informational)

`authenticated` holds `INSERT`/`UPDATE`/`DELETE` grants, inherited from
Supabase's default privileges. **No RLS write policy exists on that table**, so
every write is denied in practice. Defense-in-depth only.

---

## 2. Advisor warnings — classification

| Rule | Before | After | Verdict |
| --- | --- | --- | --- |
| `anon_security_definer_function_executable` | 14 | **4** | Remaining four are justified: `handle_new_user` and `prevent_role_self_assignment` return `trigger` (not RPC-callable), `is_admin()` is a harmless boolean used by RLS, `rls_auto_enable` is a Supabase platform function |
| `authenticated_security_definer_function_executable` | 14 | **13** | **By design** — the app's own RPCs must be callable by signed-in users. `log_audit` dropped out |
| `multiple_permissive_policies` | 4 | **4** | Performance only — `own` + `admin` SELECT both evaluated |
| `extension_in_public` | 1 | **1** | `pg_trgm` — accepted (see below) |
| `auth_leaked_password_protection` | 0 | **1** | **NEW — actionable before production.** Supabase Auth's HaveIBeenPwned check is disabled. Fix is a dashboard toggle, not SQL: Authentication → Providers → Email → *Prevent use of leaked passwords*. Must be handled in the Authentication phase |

### Post-application breakdown of the 4 remaining `anon` entries

| Function | Verdict | Reason |
| --- | --- | --- |
| `handle_new_user` | Ignore | Returns `trigger`; not reachable through `/rest/v1/rpc` |
| `prevent_role_self_assignment` | Ignore | Returns `trigger`; not reachable |
| `is_admin` | Ignore | Returns a boolean; intentionally granted, RLS policies call it |
| `rls_auto_enable` | Ignore | Supabase platform function, not part of StageFlow |

### Original breakdown of the 14 (for the record)

| Function | Verdict | Reason |
| --- | --- | --- |
| `log_audit` | **FIXED** | Had no caller check (V1) — EXECUTE now revoked from all client roles |
| `create_draft_application`, `submit_application`, `start_review`, `decide_application`, `register_document`, `remove_document`, `get_admin_stats`, `get_application_history`, `search_admin_applications` | **FIXED** | Already raised `AUTH_REQUIRED`/`FORBIDDEN`; `anon` EXECUTE now revoked so the surface is gone |
| `handle_new_user`, `prevent_role_self_assignment` | Ignore | Return `trigger`; **not reachable** through `/rest/v1/rpc` |
| `is_admin` | Ignore | Returns a boolean, intentionally granted; RLS policies call it |
| `rls_auto_enable` | Ignore | Supabase platform function, not part of StageFlow |

### On `extension_in_public`

Moving `pg_trgm` to a dedicated schema is the textbook fix, but it is **not free
here**: `search_admin_applications` runs with `set search_path = ''`, so its
trigram operators would need explicit schema qualification. Changing that risks
breaking admin search for a warning that does not expose data. Recommendation:
**accept for now**, revisit only if the project moves to a multi-tenant schema.

---

## 3. Proposed changes

| File | Changes | Status |
| --- | --- | --- |
| `supabase/applied/0006_harden_function_grants.sql` | Part A: revoke EXECUTE on `log_audit` from `public, anon, authenticated, service_role` + `AUTH_REQUIRED` guard. Part B: revoke `anon` on the 9 RPCs | **APPLIED** |
| `supabase/applied/0007_least_privilege_storage.sql` | Drop `storage_no_admin_write`, no replacement | **APPLIED** |
| `docs/MIGRATION_HISTORY_RECONCILIATION.md` | Plan only | **NOT APPLIED** |

The reviewed originals remain in `docs/proposed_*.sql`; the exact forward
statements executed are preserved in `supabase/applied/`. Both directories sit
outside `supabase/migrations/`, so `db push` cannot apply them.

---

## 4. Impact analysis — verified by reading call sites

| Flow | Client | Affected by patches? |
| --- | --- | --- |
| Upload | `createAdminClient()` — service role, bypasses RLS | **No** |
| Replace / delete object | same service role | **No** |
| Download / preview | user-scoped client → `storage_own_read`, `storage_admin_read` | **No** (untouched) |
| Signup | `on_auth_user_created` → `handle_new_user` | **No** (`handle_new_user` never calls `log_audit`) |
| Application RPCs | user-scoped client (`authenticated`) | **No** (revokes target `anon` only) |
| Internal audit writes | `perform public.log_audit(...)` inside SECURITY DEFINER RPCs | **No** (run as owner) |

---

## 5. Approval checklist

Each line is an independent decision.

- [x] **A** — Apply Part A of `proposed_0006` (fix `log_audit`) — **DONE**
- [x] **B** — Apply Part B of `proposed_0006` (revoke `anon` on 9 RPCs) — **DONE**
- [x] **C** — Apply `proposed_0007` (drop `storage_no_admin_write`) — **DONE**
- [ ] **D** — Run `migration repair --status applied 0001 0002 0003 0004 0005` — **still pending approval**
- [ ] **E** — Move `9999_dev_seed.sql` out of `supabase/migrations/` — **still pending approval**
- [ ] **F** — Enable leaked-password protection in Supabase Auth (dashboard, not SQL) — **for the Authentication phase**

After applying any of A–C, verify with:

```bash
npm run check:hardening
```

Expected **before**: all four columns `false`. Expected **after A + B + C**: all
four `true`.
