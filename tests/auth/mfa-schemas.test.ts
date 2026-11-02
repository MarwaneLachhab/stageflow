import { describe, expect, it } from 'vitest'
import {
  mfaEnrollConfirmSchema,
  mfaUnenrollSchema,
  mfaVerifySchema,
} from '@/lib/validation/schemas'

/**
 * The second-factor step is the most brute-forceable surface of the app (six
 * digits), so the payload contract must be airtight before anything reaches
 * GoTrue: exactly six digits, UUID-shaped identifiers, and nothing else.
 */
describe('mfaVerifySchema', () => {
  const VALID_FACTOR = '89ce1870-f257-4855-ae05-3565deb24ca7'

  it('accepts a six-digit code with plain identifiers', () => {
    const parsed = mfaVerifySchema.safeParse({
      factorId: VALID_FACTOR,
      challengeId: '613873f6-afa3-4907-a97d-a0b5945d862d',
      code: '123456',
    })
    expect(parsed.success).toBe(true)
  })

  it('normalises grouped entry such as "123 456"', () => {
    const parsed = mfaVerifySchema.safeParse({
      factorId: VALID_FACTOR,
      challengeId: '613873f6-afa3-4907-a97d-a0b5945d862d',
      code: '123 456 ',
    })
    expect(parsed.success).toBe(true)
    if (parsed.success) expect(parsed.data.code).toBe('123456')
  })

  it('accepts dash-grouped entry such as "123-456-"', () => {
    const parsed = mfaVerifySchema.safeParse({
      factorId: VALID_FACTOR,
      challengeId: VALID_FACTOR,
      code: '123-456-',
    })
    expect(parsed.success).toBe(true)
    if (parsed.success) expect(parsed.data.code).toBe('123456')
  })

  it('rejects codes that are too short, too long or non-numeric', () => {
    const base = { factorId: VALID_FACTOR, challengeId: VALID_FACTOR }
    for (const code of ['12345', '1234567', 'abc123', '12 45', 'abcdef']) {
      const parsed = mfaVerifySchema.safeParse({ ...base, code })
      expect(parsed.success, `code ${code} must be rejected`).toBe(false)
    }
  })

  it('rejects malformed factor or challenge identifiers', () => {
    const parsed = mfaVerifySchema.safeParse({
      factorId: '../another-user',
      challengeId: VALID_FACTOR,
      code: '123456',
    })
    expect(parsed.success).toBe(false)
  })
})

describe('mfaEnrollConfirmSchema', () => {
  it('accepts factorId + six digits', () => {
    const parsed = mfaEnrollConfirmSchema.safeParse({
      factorId: '2a15b8b8-45f1-401a-a373-7c25a102bd05',
      code: '000123',
    })
    expect(parsed.success).toBe(true)
  })

  it('rejects favourite codes and obviously wrong shapes', () => {
    for (const code of ['111111', '1234567890', '', '12a456']) {
      expect(
        mfaEnrollConfirmSchema.safeParse({
          factorId: '2a15b8b8-45f1-401a-a373-7c25a102bd05',
          code,
        }).success,
      ).toBe(code === '111111')
    }
  })
})

describe('mfaUnenrollSchema', () => {
  it('accepts only a UUID', () => {
    expect(
      mfaUnenrollSchema.safeParse({ factorId: '81eb89b3-50e0-4dff-87b2-c68ab1cee6c8' }).success,
    ).toBe(true)
    expect(mfaUnenrollSchema.safeParse({ factorId: 'not-a-uuid' }).success).toBe(false)
    expect(mfaUnenrollSchema.safeParse({ missing: true }).success).toBe(false)
  })
})
