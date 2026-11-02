import { describe, expect, it } from 'vitest'
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Regression tests for the two hardening patches (now canonical migrations).
 *
 * These are static tests: they read the SQL files and assert the properties that
 * make the patches safe. They deliberately do NOT touch the database.
 *
 * History: the patches were first kept OUT of supabase/migrations/ awaiting
 * owner approval. They have since graduated to 0006/0007 after review, and are
 * applied by `supabase db reset` / `supabase db push`. The docs/proposed_*
 * originals stay so the review trail never disappears.
 *
 * What they protect against:
 *   - the merged migrations going missing (a rebase or "cleanup" dropping them);
 *   - the log_audit fix silently losing its REVOKE or its AUTH_REQUIRED guard;
 *   - a future edit reintroducing the over-broad storage INSERT policy;
 *   - destructive statements slipping into a file described as safe.
 */

const ROOT = resolve(__dirname, '../..')
const PATCH_0006 = resolve(ROOT, 'docs/proposed_0006_harden_function_grants.sql')
const PATCH_0007 = resolve(ROOT, 'docs/proposed_0007_least_privilege_storage.sql')
const CHECK_SQL = resolve(ROOT, 'supabase/check_hardening.sql')
const MIGRATIONS_DIR = resolve(ROOT, 'supabase/migrations')

/** Strip `--` line comments so assertions ignore prose. */
function executableSql(raw: string): string {
  return raw
    .split('\n')
    .map((line) => line.replace(/--.*$/, ''))
    .join('\n')
}

const DESTRUCTIVE = /\b(drop\s+table|truncate|drop\s+schema|drop\s+database|delete\s+from)\b/i

describe('patch placement', () => {
  it('ships both hardening patches as canonical migrations 0006/0007', () => {
    const migrations = readdirSync(MIGRATIONS_DIR)
    expect(migrations.some((f) => f.includes('0006_harden_function_grants'))).toBe(true)
    expect(migrations.some((f) => f.includes('0007_least_privilege_storage'))).toBe(true)
  })

  it('stores the patch sources in docs/ so the review trail survives', () => {
    expect(existsSync(PATCH_0006)).toBe(true)
    expect(existsSync(PATCH_0007)).toBe(true)
    expect(PATCH_0006).toContain('docs')
    expect(PATCH_0007).toContain('docs')
  })

  it('does not contain destructive statements', () => {
    for (const file of [PATCH_0006, PATCH_0007]) {
      const sql = executableSql(readFileSync(file, 'utf8'))
      expect(sql).not.toMatch(DESTRUCTIVE)
    }
  })
})

describe('proposed_0006 — log_audit hardening', () => {
  const raw = readFileSync(PATCH_0006, 'utf8')
  const sql = executableSql(raw)

  it('revokes EXECUTE from every client-facing role', () => {
    // A signed-in stagiaire must not be able to forge audit events either, so
    // revoking only from `anon` would be insufficient.
    expect(sql).toMatch(
      /revoke\s+all\s+on\s+function\s+public\.log_audit\s*\(\s*text\s*,\s*text\s*,\s*uuid\s*,\s*jsonb\s*\)\s*from\s+public\s*,\s*anon\s*,\s*authenticated\s*,\s*service_role/i,
    )
  })

  it('adds an AUTH_REQUIRED guard to the function body', () => {
    expect(sql).toMatch(/raise\s+exception\s+'AUTH_REQUIRED'/i)
    expect(sql).toMatch(/if\s+v_uid\s+is\s+null\s+then/i)
  })

  it('keeps the function SECURITY DEFINER with an empty search_path', () => {
    expect(sql).toMatch(/security\s+definer/i)
    expect(sql).toMatch(/set\s+search_path\s*=\s*''/i)
  })

  it('does NOT grant EXECUTE on log_audit to any client role', () => {
    // Any `grant execute ... log_audit ... to <client role>` would reopen the
    // forgery path. The only legitimate caller is a SECURITY DEFINER routine
    // running as the owner.
    expect(sql).not.toMatch(/grant\s+execute\s+on\s+function\s+public\.log_audit/i)
    expect(sql).not.toMatch(/grant\s+all\s+on\s+function\s+public\.log_audit/i)
  })

  it('covers all nine application RPCs in the optional Part B', () => {
    const rpcs = [
      'create_draft_application',
      'submit_application',
      'start_review',
      'decide_application',
      'register_document',
      'remove_document',
      'get_admin_stats',
      'get_application_history',
      'search_admin_applications',
    ]
    for (const rpc of rpcs) {
      expect(sql, `missing revoke for ${rpc}`).toMatch(
        new RegExp(`revoke\\s+execute\\s+on\\s+function\\s+public\\.${rpc}\\b`, 'i'),
      )
    }
  })

  it('leaves is_admin granted to anon (RLS policies rely on it)', () => {
    expect(sql).not.toMatch(/revoke[^;]*is_admin[^;]*from[^;]*anon/i)
  })

  it('ships rollback instructions', () => {
    expect(raw).toMatch(/ROLLBACK/i)
    expect(raw).toMatch(/grant\s+execute\s+on\s+function\s+public\.log_audit[\s\S]{0,80}to\s+anon/i)
  })
})

describe('proposed_0007 — storage least privilege', () => {
  const raw = readFileSync(PATCH_0007, 'utf8')
  const sql = executableSql(raw)

  it('drops the over-broad storage_no_admin_write policy', () => {
    expect(sql).toMatch(/drop\s+policy\s+if\s+exists\s+storage_no_admin_write\s+on\s+storage\.objects/i)
  })

  it('does not create any replacement INSERT policy', () => {
    // A restrictive replacement would break legitimate uploads, so the patch
    // must remove the rule rather than rewrite it.
    expect(sql).not.toMatch(/create\s+policy/i)
  })

  it('does not touch the policies the app depends on', () => {
    for (const policy of [
      'storage_own_upload',
      'storage_own_read',
      'storage_own_delete',
      'storage_admin_read',
    ]) {
      expect(sql).not.toMatch(new RegExp(`drop\\s+policy[^;]*${policy}`, 'i'))
    }
  })

  it('ships rollback instructions that recreate the policy', () => {
    expect(raw).toMatch(/ROLLBACK/i)
    expect(raw).toMatch(/create\s+policy\s+storage_no_admin_write/i)
  })
})

describe('supabase/check_hardening.sql', () => {
  const raw = readFileSync(CHECK_SQL, 'utf8')
  const sql = executableSql(raw)

  it('is a single read-only statement', () => {
    const statements = sql
      .split(';')
      .map((s) => s.trim())
      .filter(Boolean)
    expect(statements).toHaveLength(1)
    expect(statements[0]).toMatch(/^select\b/i)
  })

  it('asserts the post-patch expectations', () => {
    expect(sql).toMatch(/log_audit_blocks_anon/)
    expect(sql).toMatch(/log_audit_blocks_authenticated/)
    expect(sql).toMatch(/log_audit_blocks_service_role/)
    expect(sql).toMatch(/rpc_blocks_anon/)
    expect(sql).toMatch(/rpc_allows_authenticated/)
    expect(sql).toMatch(/single_storage_insert_policy/)
    expect(sql).toMatch(/storage_policy_count_is_4/)
  })
})

describe('migration history reconciliation plan', () => {
  const doc = readFileSync(resolve(ROOT, 'docs/MIGRATION_HISTORY_RECONCILIATION.md'), 'utf8')

  it('documents the exact version identifiers', () => {
    for (const version of ['0001', '0002', '0003', '0004', '0005', '9999']) {
      expect(doc).toContain(version)
    }
  })

  it('states that repair has not been executed', () => {
    expect(doc).toMatch(/PLAN ONLY/i)
  })

  it('includes a rollback section', () => {
    expect(doc).toMatch(/## 6\. Rollback/i)
  })
})
