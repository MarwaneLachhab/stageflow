/** The two and only two roles defined by the cahier des charges. */
export type AppRole = 'stagiaire' | 'admin'

export type SessionUser = {
  id: string
  email: string | null
  role: AppRole
  emailConfirmed: boolean
}

/** Shape returned by every Server Action so the UI can react consistently. */
export type ActionResult<T = undefined> =
  | { ok: true; data: T; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> }

export const GENERIC_ERROR =
  'Une erreur est survenue. Veuillez réessayer dans quelques instants.'

export const FORBIDDEN_ERROR =
  'Accès refusé. Vous n’avez pas les droits nécessaires pour cette action.'
