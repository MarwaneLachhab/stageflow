import { describe, it, expect } from 'vitest'
import { signUpSchema, passwordStrength, passwordSchema, phoneSchema } from '@/lib/validation/schemas'

/**
 * Registration validation contract.
 *
 * These tests exist because the signup form is the only public write path in the
 * application. Every rule asserted here is enforced twice: once in the browser
 * by React Hook Form, and again on the server inside the `signUpStagiaire`
 * Server Action. The server call is authoritative — these tests pin the rules so
 * the two copies cannot drift apart silently.
 */

const valid = {
  lastName: 'Benali',
  firstName: 'Yasmine',
  email: 'yasmine.benali@example.com',
  phone: '+212 6 12 34 56 78',
  password: 'MotDePasse1',
  confirmPassword: 'MotDePasse1',
  acceptTerms: true,
}

/** Collect the set of field names that failed validation. */
function failingFields(input: unknown): string[] {
  const result = signUpSchema.safeParse(input)
  if (result.success) return []
  return [...new Set(result.error.issues.map((issue) => String(issue.path[0])))]
}

describe('signUpSchema — accepted input', () => {
  it('accepts a complete, valid registration', () => {
    const result = signUpSchema.safeParse(valid)
    expect(result.success).toBe(true)
  })

  it('normalises the e-mail to lower case and trims it', () => {
    const result = signUpSchema.safeParse({
      ...valid,
      email: '  Yasmine.Benali@Example.COM  ',
    })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.email).toBe('yasmine.benali@example.com')
  })

  it('trims surrounding whitespace from names', () => {
    const result = signUpSchema.safeParse({ ...valid, lastName: '  Benali  ' })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.lastName).toBe('Benali')
  })

  it('accepts accented and hyphenated names', () => {
    for (const lastName of ['El Amrani', 'Ben-Ali', "O'Connor", 'Müller', 'Çelik']) {
      expect(signUpSchema.safeParse({ ...valid, lastName }).success).toBe(true)
    }
  })

  it('accepts several phone formats', () => {
    for (const phone of ['+212612345678', '0612345678', '+33 6 12 34 56 78', '(212) 6-12-34-56']) {
      expect(signUpSchema.safeParse({ ...valid, phone }).success).toBe(true)
    }
  })
})

describe('signUpSchema — rejected input', () => {
  it('rejects an invalid e-mail address', () => {
    for (const email of ['not-an-email', 'a@b', 'missing@domain', '@example.com', '']) {
      expect(failingFields({ ...valid, email })).toContain('email')
    }
  })

  it('rejects a password shorter than 10 characters', () => {
    const short = 'Mot1'
    expect(failingFields({ ...valid, password: short, confirmPassword: short })).toContain(
      'password',
    )
  })

  it('rejects a password without an upper-case letter', () => {
    const password = 'motdepasse1'
    expect(failingFields({ ...valid, password, confirmPassword: password })).toContain('password')
  })

  it('rejects a password without a lower-case letter', () => {
    const password = 'MOTDEPASSE1'
    expect(failingFields({ ...valid, password, confirmPassword: password })).toContain('password')
  })

  it('rejects a password without a digit', () => {
    const password = 'MotDePasseSansChiffre'
    expect(failingFields({ ...valid, password, confirmPassword: password })).toContain('password')
  })

  it('rejects a password longer than 72 characters', () => {
    const password = `Aa1${'x'.repeat(70)}`
    expect(failingFields({ ...valid, password, confirmPassword: password })).toContain('password')
  })

  it('rejects a confirmation that does not match', () => {
    const fields = failingFields({ ...valid, confirmPassword: 'MotDePasse2' })
    expect(fields).toContain('confirmPassword')
  })

  it('rejects missing required fields', () => {
    const fields = failingFields({})
    expect(fields).toEqual(
      expect.arrayContaining(['lastName', 'firstName', 'email', 'phone', 'password']),
    )
  })

  it('rejects an empty name', () => {
    expect(failingFields({ ...valid, lastName: '' })).toContain('lastName')
    expect(failingFields({ ...valid, firstName: '   ' })).toContain('firstName')
  })

  it('rejects names containing digits or symbols', () => {
    for (const lastName of ['Benali123', '<script>', 'Ben@li', 'Benali_']) {
      expect(failingFields({ ...valid, lastName })).toContain('lastName')
    }
  })

  it('rejects an invalid phone number', () => {
    for (const phone of ['abc', '12', '+'.repeat(30), '1234567890123456789012345678']) {
      expect(failingFields({ ...valid, phone })).toContain('phone')
    }
  })

  it('requires the terms to be accepted', () => {
    expect(failingFields({ ...valid, acceptTerms: false })).toContain('acceptTerms')
  })

  it('rejects a non-boolean acceptTerms value', () => {
    // A crafted request sending a truthy string must not satisfy the checkbox.
    expect(signUpSchema.safeParse({ ...valid, acceptTerms: 'true' }).success).toBe(false)
  })
})

describe('signUpSchema — privilege escalation surface', () => {
  /**
   * The public signup form must never be able to influence the role. These
   * assertions lock that in: the schema does not declare `role` or `is_admin`,
   * and Zod strips unknown keys, so a crafted payload cannot smuggle one
   * through to the Server Action.
   *
   * This is the first of three independent defences. The other two are:
   *   - `signUpStagiaire` sends no role in `options.data`
   *   - the `handle_new_user()` trigger hard-codes 'stagiaire'
   */
  it('strips any injected role field', () => {
    const result = signUpSchema.safeParse({ ...valid, role: 'admin' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).not.toHaveProperty('role')
    }
  })

  it('strips an injected is_admin flag', () => {
    const result = signUpSchema.safeParse({ ...valid, is_admin: true })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).not.toHaveProperty('is_admin')
    }
  })

  it('does not declare a role field at all', () => {
    const shape = signUpSchema._def.schema.shape
    expect(Object.keys(shape)).not.toContain('role')
    expect(Object.keys(shape)).not.toContain('is_admin')
  })
})

describe('passwordStrength — UI meter', () => {
  it('scores an empty password at zero', () => {
    expect(passwordStrength('').score).toBe(0)
  })

  it('scores a short, simple password low', () => {
    expect(passwordStrength('abc').score).toBeLessThanOrEqual(1)
  })

  it('scores a long mixed password high', () => {
    expect(passwordStrength('MotDePasse1!').score).toBe(4)
  })

  it('never exceeds the four display segments', () => {
    expect(passwordStrength('aVeryLongMixedPassword123!@#').score).toBeLessThanOrEqual(4)
  })

  it('always returns a label matching the score', () => {
    const labels = ['Très faible', 'Faible', 'Moyen', 'Bon', 'Excellent']
    for (const password of ['', 'abc', 'Abc1234567', 'Abc12345678901234', 'Abc1234567!']) {
      const { score, label } = passwordStrength(password)
      expect(labels).toContain(label)
      expect(score).toBeGreaterThanOrEqual(0)
      expect(score).toBeLessThanOrEqual(4)
    }
  })

  it('reports a minimum-length password as weak even when mixed', () => {
    // Exactly 10 chars: meets the policy but is not "excellent".
    expect(passwordStrength('MotDePasse1').score).toBeLessThan(4)
  })
})

describe('passwordSchema — policy shared with the UI hint', () => {
  it('matches the hint shown under the field (10 chars, upper, lower, digit)', () => {
    expect(passwordSchema.safeParse('MotDePasse1').success).toBe(true)
    expect(passwordSchema.safeParse('motdepasse1').success).toBe(false)
    expect(passwordSchema.safeParse('MOTDEPASSE1').success).toBe(false)
    expect(passwordSchema.safeParse('MotDePasses').success).toBe(false)
    expect(passwordSchema.safeParse('MotDePas1').success).toBe(false)
  })
})

describe('phoneSchema', () => {
  it('accepts a Moroccan mobile number with spaces', () => {
    expect(phoneSchema.safeParse('+212 6 12 34 56 78').success).toBe(true)
  })

  it('rejects letters', () => {
    expect(phoneSchema.safeParse('06 12 34 56 AB').success).toBe(false)
  })

  it('rejects a number that is too short', () => {
    expect(phoneSchema.safeParse('12345').success).toBe(false)
  })
})
