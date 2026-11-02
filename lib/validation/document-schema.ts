import { z } from 'zod'
import { DOCUMENT_TYPES } from '@/lib/constants'

/**
 * Document-specific schemas.
 *
 * `documentType` is validated against the SAME list the UI renders, so an
 * attacker cannot introduce an unknown enum member (which would otherwise cause
 * a Postgres cast error and leak the enum name in the response).
 */

export const documentTypeSchema = z.enum(
  DOCUMENT_TYPES.map((d) => d.value) as [string, ...string[]],
)

export const documentIdSchema = z.string().uuid('Identifiant de document invalide.')

export const applicationIdSchema = z.string().uuid('Identifiant de demande invalide.')
