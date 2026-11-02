/**
 * Probes the EXACT supabase-js MFA API surface against the local stack.
 * Output documents the true response shapes so the application code can be
 * written against facts, not guesses.
 *
 * Uses a throw-away account (mfa.probe@stageflow.local) — safe: local only.
 */
import { createClient } from '@supabase/supabase-js'
import crypto from 'node:crypto'

const URL = 'http://127.0.0.1:54321'
const KEY = 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH'

const EMAIL = `mfa.probe+${Date.now()}@stageflow.local`
const PASSWORD = 'ProbeStage2026!'

// base32 decode (RFC 4648, no padding) for TTOT computation
function base32Decode(input) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  let bits = ''
  for (const c of input.replace(/=+$/, '').toUpperCase()) {
    const idx = alphabet.indexOf(c)
    if (idx === -1) continue
    bits += idx.toString(2).padStart(5, '0')
  }
  const bytes = []
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2))
  return Buffer.from(bytes)
}

function totp(secretBase32, atMs = Date.now()) {
  const counter = Math.floor(atMs / 30_000)
  const buf = Buffer.alloc(8)
  buf.writeUInt32BE(Math.floor(counter / 2 ** 32), 0)
  buf.writeUInt32BE(counter % 2 ** 32, 4)
  const hmac = crypto.createHmac('sha1', base32Decode(secretBase32)).update(buf).digest()
  const offset = hmac[hmac.length - 1] & 0xf
  const bin =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff)
  return String(bin % 1_000_000).padStart(6, '0')
}

const p = (label, obj) => console.log(`\n=== ${label} ===\n` + JSON.stringify(obj, null, 2).slice(0, 900))

const supabase = createClient(URL, KEY)

// 1) signUp → immediate session (confirmations disabled locally)
const { data: signup, error: signupErr } = await supabase.auth.signUp({ email: EMAIL, password: PASSWORD })
p('signUp', { error: signupErr?.message ?? null, hasSession: Boolean(signup?.session), userId: signup?.user?.id })

// 2) enroll a TOTP factor with the established session
const { data: enrolled, error: enrollErr } = await supabase.auth.mfa.enroll({
  factorType: 'totp',
  friendlyName: 'StageFlow probe',
})
const secret = enrolled?.totp?.secret ?? null
p('mfa.enroll', {
  error: enrollErr?.message ?? null,
  factorId: enrolled?.id,
  status: enrolled?.status,
  qrCharCount: enrolled?.totp?.qr_code?.length,
  secret: secret ? `${secret.slice(0, 4)}…(${secret.length} chars)` : null,
})

// 3) challenge + verify to activate the factor (enrolled → verified)
if (enrolled) {
  const { data, error } = await supabase.auth.mfa.challenge({ factorId: enrolled.id })
  p('mfa.challenge (with session)', { error: error?.message ?? null, challengeId: data?.id })
  const code = totp(secret)
  const { data: verified, error: verifyErr } = await supabase.auth.mfa.verify({
    factorId: enrolled.id,
    challengeId: data.id,
    code,
  })
  p('mfa.verify', {
    error: verifyErr?.message ?? null,
    hasChallengeError: Boolean(verifyErr?.challenge_error),
    ok: Boolean(verified),
  })
}

// 4) sign out, then sign in again — the MFA-required branch
await supabase.auth.signOut()
async function signInStep() {
  return supabase.auth.signInWithPassword({ email: EMAIL, password: PASSWORD })
}
const attempt = await signInStep()
p('signInWithPassword (mfa required?)', {
  error: attempt.error
    ? { message: attempt.error.message, code: attempt.error.code, status: attempt.error.status }
    : null,
  dataKeys: attempt.data ? Object.keys(attempt.data) : null,
  factors: attempt.data?.factors ?? null,
  hasUser: Boolean(attempt.data?.user),
  hasSession: Boolean(attempt.data?.session),
})

// 5) complete the sign-in through challenge + verify (no session state)
const factor = attempt.data?.factors?.find((f) => f.factor_type === 'totp') ?? attempt.data?.factors?.[0]
if (factor) {
  let ch1
  const step1 = await supabase.auth.mfa.challenge({ factorId: factor.id })
  ch1 = { err: step1.error?.message, data: step1.data, statusCode: step1.error?.status }
  p('mfa.challenge (no session)', ch1)
  if (step1.data?.id) {
    const code = totp(factor.totp?.secret ?? secret)
    const step2 = await supabase.auth.mfa.verify({
      factorId: factor.id,
      challengeId: step1.data.id,
      code,
    })
    p('mfa.verify (no session → sign-in)', {
      error: step2.error
        ? { message: step2.error.message, code: step2.error.code, status: step2.error.status }
        : null,
      sessionTokens: Boolean(step2.data?.access_token),
      aal: step2.data ? 'session-established' : null,
    })
    if (step2.data?.access_token) {
      const { data: aalInfo } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
      p('getAuthenticatorAssuranceLevel', { current: aalInfo?.currentLevel, next: aalInfo?.nextLevel })
    }
  }
}

// Diagnostic: what does AAL look like right after a password grant on a user
// with a VERIFIED totp factor, and what does the DB store?
{
  const probe2 = await supabase.auth.signInWithPassword({ email: EMAIL, password: PASSWORD })
  if (probe2.data?.session) {
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    p('AAL right after password grant', aal)
    const { data: factorsNow, error: lfErr } = await supabase.auth.mfa.listFactors()
    p('mfa.listFactors', {
      error: lfErr?.message ?? null,
      factors: factorsNow?.totp?.map((f) => ({ id: f.id, status: f.status })),
    })
  }
}
console.log('\nPROBE-DONE')
