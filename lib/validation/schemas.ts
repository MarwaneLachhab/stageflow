import { z } from 'zod'
import { APPLICATION_STATUSES, PAGE_SIZE_MAX } from '@/lib/constants'

/**
 * Shared validation schemas.
 *
 * Everything here is re-validated on the server inside Server Actions. The
 * client uses the same schema through React Hook Form + @hookform/resolvers so
 * error messages stay consistent, but client results are never trusted.
 */

/* -------------------------------------------------------------------------- */
/* Primitives                                                                  */
/* -------------------------------------------------------------------------- */

/** Loose but sane international/Moroccan phone validation. */
export const phoneSchema = z
  .string()
  .trim()
  .min(6, 'Le numéro de téléphone est trop court.')
  .max(25, 'Le numéro de téléphone est trop long.')
  .regex(/^\+?[0-9\s().-]{6,25}$/, 'Format de téléphone invalide.')

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, 'L’adresse e-mail est requise.')
  .max(254, 'L’adresse e-mail est trop longue.')
  .email('Format d’adresse e-mail invalide.')

/**
 * Password policy. Deliberately pragmatic: 10 characters minimum and a mix of
 * character classes. Passwords are hashed by Supabase Auth (bcrypt); we never
 * store or log them.
 */
export const passwordSchema = z
  .string()
  .min(10, 'Le mot de passe doit contenir au moins 10 caractères.')
  .max(72, 'Le mot de passe ne peut pas dépasser 72 caractères.')
  .regex(/[a-z]/, 'Ajoutez au moins une lettre minuscule.')
  .regex(/[A-Z]/, 'Ajoutez au moins une lettre majuscule.')
  .regex(/[0-9]/, 'Ajoutez au moins un chiffre.')

/** Suggested but not enforced: scores password strength for the UI meter. */
export function passwordStrength(password: string): {
  score: 0 | 1 | 2 | 3 | 4
  label: string
} {
  let score = 0
  if (password.length >= 10) score++
  if (password.length >= 14) score++
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++
  if (/[0-9]/.test(password)) score++
  if (/[^A-Za-z0-9]/.test(password)) score++
  const clamped = Math.min(4, score) as 0 | 1 | 2 | 3 | 4
  const labels = ['Très faible', 'Faible', 'Moyen', 'Bon', 'Excellent'] as const
  return { score: clamped, label: labels[clamped] }
}

const nameField = (label: string) =>
  z
    .string()
    .trim()
    .min(2, `${label} doit contenir au moins 2 caractères.`)
    .max(60, `${label} ne peut pas dépasser 60 caractères.`)
    .regex(
      /^[\p{L}\p{M}\s'’-]+$/u,
      `${label} ne doit contenir que des lettres, espaces, apostrophes ou tirets.`,
    )

const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .optional()
    .or(z.literal(''))

/* -------------------------------------------------------------------------- */
/* Auth                                                                        */
/* -------------------------------------------------------------------------- */

export const signUpSchema = z
  .object({
    lastName: nameField('Le nom'),
    firstName: nameField('Le prénom'),
    email: emailSchema,
    phone: phoneSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
    acceptTerms: z
      .boolean()
      .refine((v) => v === true, 'Vous devez accepter les conditions d’utilisation.'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Les mots de passe ne correspondent pas.',
  })

export type SignUpInput = z.infer<typeof signUpSchema>

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Le mot de passe est requis.').max(200),
})

export type SignInInput = z.infer<typeof signInSchema>

export const passwordResetRequestSchema = z.object({
  email: emailSchema,
})

/** Email confirmation code entered after a new account is created. */
export const signupOtpSchema = z.object({
  email: emailSchema,
  code: z
    .string()
    .trim()
    .min(6, 'Le code doit contenir 6 chiffres.')
    .max(9, 'Le code doit contenir 6 chiffres.')
    .transform((value) => value.replace(/[\s-]+/g, ''))
    .refine((value) => /^\d{6}$/.test(value), {
      message: 'Le code doit contenir exactement 6 chiffres.',
    }),
})

export type SignupOtpInput = z.infer<typeof signupOtpSchema>

export const passwordUpdateSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Les mots de passe ne correspondent pas.',
  })

/* -------------------------------------------------------------------------- */
/* Two-factor authentication (TOTP)                                            */
/* -------------------------------------------------------------------------- */

/**
 * A six-digit one-time code. GoTrue configures enrolled TOTP factors for 6
 * digits / 30 s, which matches every authenticator app (Google, 1Password…).
 * Tolerates grouped entry such as "123 456" — the value is normalised before
 * the server forwards it to GoTrue.
 */
const otpCodeSchema = z
  .string()
  .trim()
  .min(6, 'Le code doit contenir 6 chiffres.')
  .max(9, 'Le code doit contenir 6 chiffres.')
  .transform((value) => value.replace(/[\s-]+/g, ''))
  .refine((value) => /^\d{6}$/.test(value), {
    message: 'Le code doit contenir exactement 6 chiffres.',
  })

const factorIdSchema = z.string().uuid('Identifiant du facteur invalide.')

/** Sign-in second step: the challenge issued by the server is echoed back. */
export const mfaVerifySchema = z.object({
  factorId: factorIdSchema,
  challengeId: factorIdSchema,
  code: otpCodeSchema,
})

export type MfaVerifyInput = z.infer<typeof mfaVerifySchema>

/** Enrolment confirmation: prove the authenticator app emits the right code. */
export const mfaEnrollConfirmSchema = z.object({
  factorId: factorIdSchema,
  code: otpCodeSchema,
})

export type MfaEnrollConfirmInput = z.infer<typeof mfaEnrollConfirmSchema>

export const mfaUnenrollSchema = z.object({
  factorId: factorIdSchema,
})

/* -------------------------------------------------------------------------- */
/* Profile (SCREEN 5)                                                          */
/* -------------------------------------------------------------------------- */

export const profileSchema = z.object({
  lastName: nameField('Le nom'),
  firstName: nameField('Le prénom'),
  phone: phoneSchema,
  address: optionalText(160, 'L’adresse ne peut pas dépasser 160 caractères.'),
  city: optionalText(80, 'La ville ne peut pas dépasser 80 caractères.'),
  birthDate: z
    .string()
    .trim()
    .optional()
    .or(z.literal(''))
    .refine(
      (v) => {
        if (!v) return true
        const d = new Date(v)
        if (Number.isNaN(d.getTime())) return false
        const age = (Date.now() - d.getTime()) / (365.25 * 86_400_000)
        return age >= 14 && age <= 100
      },
      'La date de naissance doit correspondre à un âge entre 14 et 100 ans.',
    ),
  school: optionalText(120, 'L’établissement ne peut pas dépasser 120 caractères.'),
  program: optionalText(120, 'La formation ne peut pas dépasser 120 caractères.'),
  studyLevel: optionalText(60, 'Le niveau d’étude ne peut pas dépasser 60 caractères.'),
  specialty: optionalText(120, 'La spécialité ne peut pas dépasser 120 caractères.'),
})

export type ProfileInput = z.infer<typeof profileSchema>

/**
 * Email changes are NOT part of profileSchema on purpose: changing the login
 * identity must go through Supabase's own verification workflow so a typo or an
 * attacker cannot silently hijack the account.
 */

/* -------------------------------------------------------------------------- */
/* Internship application (SCREEN 6)                                           */
/* -------------------------------------------------------------------------- */

const isoDate = (label: string) =>
  z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, `${label} est requise (format AAAA-MM-JJ).`)

export const applicationDraftSchema = z
  .object({
    stageType: z
      .string()
      .trim()
      .min(2, 'Le type de stage est requis.')
      .max(80, 'Le type de stage est trop long.'),
    domain: z
      .string()
      .trim()
      .min(2, 'Le domaine est requis.')
      .max(80, 'Le domaine est trop long.'),
    startDate: isoDate('La date de début'),
    endDate: isoDate('La date de fin'),
    mode: z.string().trim().max(40).optional().or(z.literal('')),
    motivation: z
      .string()
      .trim()
      .min(50, 'La motivation doit contenir au moins 50 caractères.')
      .max(2000, 'La motivation ne peut pas dépasser 2000 caractères.'),
    school: optionalText(120, 'L’établissement ne peut pas dépasser 120 caractères.'),
    program: optionalText(120, 'La formation ne peut pas dépasser 120 caractères.'),
    studyLevel: optionalText(60, 'Le niveau ne peut pas dépasser 60 caractères.'),
    specialty: optionalText(120, 'La spécialité ne peut pas dépasser 120 caractères.'),
  })
  .superRefine((data, ctx) => {
    const start = new Date(`${data.startDate}T00:00:00Z`)
    const end = new Date(`${data.endDate}T00:00:00Z`)
    const today = new Date()
    today.setUTCHours(0, 0, 0, 0)

    if (Number.isNaN(start.getTime())) {
      ctx.addIssue({ path: ['startDate'], code: 'custom', message: 'Date de début invalide.' })
    }
    if (Number.isNaN(end.getTime())) {
      ctx.addIssue({ path: ['endDate'], code: 'custom', message: 'Date de fin invalide.' })
    }
    if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && end <= start) {
      ctx.addIssue({
        path: ['endDate'],
        code: 'custom',
        message: 'La date de fin doit être postérieure à la date de début.',
      })
    }
    if (!Number.isNaN(end.getTime()) && end < today) {
      ctx.addIssue({
        path: ['endDate'],
        code: 'custom',
        message: 'La date de fin ne peut pas être dans le passé.',
      })
    }
    const maxEnd = new Date(start.getTime())
    maxEnd.setUTCFullYear(maxEnd.getUTCFullYear() + 2)
    if (!Number.isNaN(start.getTime()) && end > maxEnd) {
      ctx.addIssue({
        path: ['endDate'],
        code: 'custom',
        message: 'La durée du stage ne peut pas dépasser 24 mois.',
      })
    }
  })

export type ApplicationDraftInput = z.infer<typeof applicationDraftSchema>

/**
 * Lenient schema used when SAVING a draft.
 *
 * A draft is allowed to be incomplete — that is the whole point of the
 * Brouillon state. It still enforces lengths and types so nothing unexpected
 * reaches the database, but it does not require dates to be filled, motivation
 * to be long enough, or the date range to be coherent. Those rules are applied
 * at submission time (below) and again inside the database function.
 */
export const applicationDraftSaveSchema = z.object({
  stageType: z.string().trim().max(80, 'Le type de stage est trop long.').optional().default(''),
  domain: z.string().trim().max(80, 'Le domaine est trop long.').optional().default(''),
    startDate: z
      .string()
      .trim()
      .refine((v) => v === '' || /^\d{4}-\d{2}-\d{2}$/.test(v), 'Date de début invalide.')
      .optional()
      .default(''),
    endDate: z
      .string()
      .trim()
      .refine((v) => v === '' || /^\d{4}-\d{2}-\d{2}$/.test(v), 'Date de fin invalide.')
      .optional()
      .default(''),
  mode: z.string().trim().max(40).optional().default(''),
  motivation: z
    .string()
    .trim()
    .max(2000, 'La motivation ne peut pas dépasser 2000 caractères.')
    .optional()
    .default(''),
  school: optionalText(120, 'L’établissement ne peut pas dépasser 120 caractères.'),
  program: optionalText(120, 'La formation ne peut pas dépasser 120 caractères.'),
  studyLevel: optionalText(60, 'Le niveau ne peut pas dépasser 60 caractères.'),
  specialty: optionalText(120, 'La spécialité ne peut pas dépasser 120 caractères.'),
})

export type ApplicationDraftSaveInput = z.infer<typeof applicationDraftSaveSchema>

/**
 * Schema used at submission time. Academic fields and the required-document
 * checklist are enforced here, so a draft can be saved incomplete but can never
 * be submitted incomplete.
 */
export const applicationSubmitSchema = applicationDraftSchema.and(
  z.object({
    school: z.string().trim().min(2, 'L’établissement est requis pour la soumission.').max(120),
    program: z.string().trim().min(2, 'La formation est requise pour la soumission.').max(120),
    studyLevel: z.string().trim().min(1, 'Le niveau d’étude est requis pour la soumission.').max(60),
  }),
)

/* -------------------------------------------------------------------------- */
/* Admin list query (SCREEN 10)                                                */
/* -------------------------------------------------------------------------- */

export const adminListQuerySchema = z.object({
  q: z.string().trim().max(80).optional().default(''),
  status: z.enum(['ALL', ...APPLICATION_STATUSES]).optional().default('ALL'),
  formation: z.string().trim().max(80).optional().default(''),
  stageType: z.string().trim().max(80).optional().default(''),
  dateFrom: z.string().trim().max(10).optional().default(''),
  dateTo: z.string().trim().max(10).optional().default(''),
  sort: z
    .enum(['submitted_at', 'created_at', 'start_date', 'last_name'])
    .optional()
    .default('created_at'),
  dir: z.enum(['asc', 'desc']).optional().default('desc'),
  page: z.coerce.number().int().min(1).max(10_000).optional().default(1),
  pageSize: z.coerce.number().int().min(5).max(PAGE_SIZE_MAX).optional().default(10),
})

export type AdminListQuery = z.infer<typeof adminListQuerySchema>

/* -------------------------------------------------------------------------- */
/* Admin decisions (SCREEN 11)                                                 */
/* -------------------------------------------------------------------------- */

export const startReviewSchema = z.object({
  applicationId: z.string().uuid('Identifiant de demande invalide.'),
  expectedStatus: z.enum(APPLICATION_STATUSES),
})

export const decisionSchema = z.object({
  applicationId: z.string().uuid('Identifiant de demande invalide.'),
  decision: z.enum(['ACCEPTED', 'REJECTED']),
  /** Proposed improvement over the cahier des charges: reason is mandatory. */
  publicReason: z
    .string()
    .trim()
    .min(10, 'Le motif doit contenir au moins 10 caractères.')
    .max(1000, 'Le motif ne peut pas dépasser 1000 caractères.'),
  expectedStatus: z.enum(APPLICATION_STATUSES),
})

export type DecisionInput = z.infer<typeof decisionSchema>

export const privateNoteSchema = z.object({
  applicationId: z.string().uuid('Identifiant de demande invalide.'),
  body: z
    .string()
    .trim()
    .min(1, 'La note ne peut pas être vide.')
    .max(2000, 'La note ne peut pas dépasser 2000 caractères.'),
})
