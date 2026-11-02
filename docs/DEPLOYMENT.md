# Deployment

## 1. Prerequisites

| Requirement | Version / note |
| --- | --- |
| Node.js | 20 LTS or 22 LTS |
| npm | 10+ |
| A Supabase project | Free tier is sufficient to start |
| A hosting platform | Vercel is the path of least resistance for Next.js 15 |

## 2. Environment variables

Copy `.env.example` to `.env.local` and fill it in.

| Variable | Required | Exposed to the browser | Purpose |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | **Yes** | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | **Yes** | Publishable key, protected by RLS |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | **No** | Elevated operations only |
| `NEXT_PUBLIC_SITE_URL` | Yes | **Yes** | Used for auth e-mail redirects |
| `NODE_ENV` | Auto | No | Set by the platform |

### The two rules that matter

1. **`SUPABASE_SERVICE_ROLE_KEY` must never be prefixed with `NEXT_PUBLIC_`.**
   Next.js inlines every `NEXT_PUBLIC_*` variable into the client bundle. A
   prefixed service key would be published to every visitor and would dismantle
   every security control at once.

   `lib/env.ts` guards this: the key is read through `serverEnv`, which throws if
   evaluated in a browser context.

2. **`.env.local` must never be committed.** It is already listed in
   `.gitignore`. Verify before the first push.

## 3. Database setup

Apply the migrations in order. They are numbered so that lexical order is
correct.

```bash
# Option A — Supabase CLI (requires Docker for the local stack)
supabase link --project-ref <your-project-ref>
supabase db push

# Option B — no local stack: paste each file into the SQL editor,
# in order, and run it.
#   0001_init_schema.sql
#   0002_indexes_and_views.sql
#   0003_workflow_functions.sql
#   0004_rls_policies.sql
#   0005_admin_bootstrap.sql
```

### Verify the schema applied correctly

```sql
-- Expect 8 tables
SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;

-- Expect rowsecurity = true for EVERY row
SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';

-- Expect 0 rows (a rejected application must always carry a reason)
SELECT id FROM internship_applications
WHERE status = 'REJECTED'
  AND (public_rejection_reason IS NULL OR length(trim(public_rejection_reason)) < 10);
```

**Do not skip that second check.** If any table reports `rowsecurity = false`,
stop: that table is unprotected.

### Verify the storage bucket

```sql
SELECT id, public, file_size_limit, allowed_mime_types
FROM storage.buckets WHERE id = 'application-documents';
```

`public` **must** be `false`.

### Verify the RLS policies with the automated suite

Once `.env.local` holds real credentials, run the security suite **without typing
any secret on a command line**:

```bash
npm run test:rls:env
```

That script is `node --env-file=.env.local … vitest run tests/rls`, so the
credentials come from the file you already filled in.

Expected result with a correctly migrated database: **26 passed**. If it reports
`25 skipped`, the credentials were not picked up — the suite prints the reason.
Treat a skip as a failure: this is the only suite that proves one trainee cannot
read another trainee's data.

### If the migrations were applied through the SQL Editor

The SQL Editor does **not** write to `supabase_migrations.schema_migrations`.
The database is fully migrated, but the CLI still believes nothing was applied,
so a later `supabase db push` would try to re-run 0001–0005.

Record them as applied **without executing them again**:

```bash
npx supabase login                      # browser, one time
npx supabase link --project-ref <ref>   # prompts for the DB password
npx supabase migration repair --status applied 0001 0002 0003 0004 0005 --linked
```

Then `npx supabase migration list --linked` should show all five under both
`Local` and `Remote`.

The migrations are idempotent (`create table if not exists`, guarded `create
type`, `drop policy if exists`, `create or replace function`, bucket upsert), so
a re-run would not corrupt anything — but repairing the history is cleaner and
avoids pointless churn.

## 4. Create the first administrator

There is deliberately no way to become an administrator through the application.
This is the control that prevents privilege escalation, so bootstrapping is an
operator action performed outside the client path:

```sql
-- Run in the Supabase SQL editor as the project owner.
SELECT promote_to_admin('admin@your-domain.ma');
```

The function is revoked from `public`, `anon` and `authenticated`, so it cannot
be reached with an application key.

**Then confirm it worked:**

```sql
SELECT u.email, r.role FROM auth.users u
JOIN user_roles r ON r.user_id = u.id
WHERE r.role = 'admin';
```

The target user must sign out and back in for the new role to take effect, since
the role is resolved from the database on each request rather than baked into the
token.

## 5. Configure authentication

In the Supabase dashboard → Authentication → URL Configuration:

- **Site URL**: `https://your-domain.ma`
- **Redirect URLs**: add both
  - `https://your-domain.ma/auth/callback`
  - `http://localhost:3000/auth/callback` (development)

Without these, e-mail confirmation and password-recovery links will fail.

### Optional settings

| Setting | Recommendation |
| --- | --- |
| Confirm e-mail | Enable in production |
| Minimum password length | 10 (matches the application schema) |
| Leaked password protection | Enable if available on your plan |

## 6. Build and deploy

### Vercel

1. Import the repository.
2. Add the environment variables (Production, Preview, Development).
3. Deploy. The build command and output are detected automatically.

### Any Node host

```bash
npm ci
npm run build
npm start          # serves on PORT, default 3000
```

The application needs a Node runtime. It is **not** a static export: server
components read cookies and query the database on every request.

## 7. Post-deployment verification

Work through this list once against the deployed instance. Each item maps to a
guarantee that cannot be confirmed from unit tests alone.

### Public

- [ ] `/` loads and the CTAs adapt to the signed-in state.
- [ ] `/inscription` creates an account and sends the confirmation e-mail.
- [ ] `/connexion` rejects a wrong password with a generic message.
- [ ] No page displays a stack trace or a raw database message.

### Stagiaire

- [ ] Sign in and land on `/stagiaire/tableau-de-bord`.
- [ ] `/stagiaire/profil` saves and the completeness indicator updates.
- [ ] `/stagiaire/demande` saves a draft and restores it after a reload.
- [ ] `/stagiaire/documents` refuses an `.exe` and a file over 5 MiB.
- [ ] A file renamed `cv.pdf` but containing HTML is **refused**.
- [ ] The send button is disabled until all required documents are present.
- [ ] `/stagiaire/suivi` shows the request as sent, not as accepted.

### Isolation — the critical checks

- [ ] A second stagiaire account **cannot** see the first one's application.
- [ ] Pasting the first account's document URL while signed in as the second
      returns **404**, not the file.
- [ ] `/admin/tableau-de-bord` while signed in as a stagiaire redirects away.

### Administrateur

- [ ] `/admin/tableau-de-bord` shows real counts (0 on an empty database — never
      fabricated figures).
- [ ] `/admin/demandes` searches, filters and paginates.
- [ ] `/admin/demandes/[id]` opens a full file.
- [ ] **Accept/Refuse is disabled until a reason of 10+ characters is entered.**
- [ ] A private note is saved and never appears on the candidate's screens.
- [ ] Sign in as the candidate and confirm they see the decision **and the
      reason** — but no private note.

### Browser

- [ ] No console errors.
- [ ] The response headers include `X-Content-Type-Options: nosniff` and
      `Content-Security-Policy`.

## 8. Operational tasks

### Rotating the service-role key

1. Generate a new key in the Supabase dashboard.
2. Update the environment variable on the host.
3. Redeploy so the new value is picked up.
4. Revoke the old key.

### Backups

Configure scheduled backups in the Supabase dashboard. **They are not automatic
on the free tier** and the application does not create them.

### Monitoring

Watch the Supabase logs for:

- repeated `permission denied` — either a misconfiguration or someone probing;
- unusual `decide_application` volumes;
- storage growth.

The `audit_events` table records administrative decisions and can be reviewed
directly:

```sql
SELECT created_at, action, actor_id, application_id, metadata
FROM audit_events ORDER BY created_at DESC LIMIT 50;
```

## 9. Known limitations at deployment time

Carried over from `docs/SECURITY.md` because they affect what an operator must
accept.

| Limitation | Operational consequence |
| --- | --- |
| No malware scanning | A malicious PDF could be stored and re-downloaded. Types are restricted and downloads are sandboxed, but no scanner inspects content. |
| Rate limiting is per-process | Behind multiple serverless instances, the effective limit is multiplied by the instance count. |
| CSP allows `'unsafe-inline'` for scripts | A nonce would be required to tighten it. |
| Legal pages are drafts | **Do not publish as legally compliant.** They require review, and any claim of conformity with Moroccan law 09-08 must be validated by counsel. |
| No automated backups | Must be configured manually. |
| RLS suite never executed here | Run it against the deployed database before trusting the isolation guarantees. |

## 10. Troubleshooting

### "Invalid login credentials" for a known-good account

Check that the user's e-mail is confirmed. With confirmation enabled, an
unconfirmed account cannot sign in.

### Photos or documents fail to upload

Confirm the storage bucket exists and matches the migration exactly:

```sql
SELECT id, public, file_size_limit FROM storage.buckets
WHERE id = 'application-documents';
```

If `public` is `true`, the bucket was created manually and is **insecure**.
Delete it and re-run `0004_rls_policies.sql`.

### An administrator sees an empty dashboard

This is correct behaviour on an empty database. The figures come from a real
aggregation; the numbers in the mockups are illustrative and are never
hard-coded.

### Redirect loop on sign-in

Confirm `NEXT_PUBLIC_SITE_URL` matches the deployed origin exactly, including
the scheme and with no trailing slash.

### `permission denied for function promote_to_admin`

Expected. The function is operator-only by design. Run it from the SQL editor,
not through the API.
