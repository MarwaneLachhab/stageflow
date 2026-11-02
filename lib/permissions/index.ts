import type { AppRole } from '@/lib/auth/types'
import type { ApplicationStatus } from '@/lib/constants'

export type { AppRole }

/* -------------------------------------------------------------------------- */
/* Route-level authorization                                                   */
/* -------------------------------------------------------------------------- */

export type RouteRule = {
  /** `null` means "any authenticated role". */
  roles: AppRole[] | null
  /** When true, guests are allowed through (public pages). */
  public: boolean
}

/**
 * Single source of truth for which role may reach which route prefix.
 *
 * Both middleware (fast redirect, good UX) and the page/action layer (real
 * enforcement) consult this map. Middleware alone is never sufficient: a direct
 * Server Action call or a route handler must re-check.
 */
export const ROUTE_RULES: { prefix: string; rule: RouteRule }[] = [
  { prefix: '/admin', rule: { roles: ['admin'], public: false } },
  { prefix: '/stagiaire', rule: { roles: ['stagiaire'], public: false } },
  { prefix: '/mon-compte', rule: { roles: null, public: false } },
  { prefix: '/', rule: { roles: null, public: true } },
]

export function matchRouteRule(pathname: string): RouteRule {
  for (const { prefix, rule } of ROUTE_RULES) {
    if (prefix === '/') continue
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) return rule
  }
  return { roles: null, public: true }
}

/** Routes that a signed-in user should be bounced away from. */
export const AUTH_ONLY_GUEST_ROUTES = ['/connexion', '/inscription']

/* -------------------------------------------------------------------------- */
/* Workflow state machine                                                      */
/* -------------------------------------------------------------------------- */

export type WorkflowAction = 'SUBMIT' | 'START_REVIEW' | 'ACCEPT' | 'REJECT' | 'EDIT'

/**
 * The canonical transition table from the master prompt.
 *
 *   DRAFT        → SUBMITTED            (stagiaire)
 *   SUBMITTED    → UNDER_REVIEW         (admin)
 *   UNDER_REVIEW → ACCEPTED | REJECTED  (admin)
 *   ACCEPTED / REJECTED are terminal in the MVP.
 *
 * `SUBMITTED` maps to the visible label « En attente »; it is ONE state, not two.
 */
const TRANSITIONS: Record<WorkflowAction, { from: ApplicationStatus[]; roles: AppRole[] }> = {
  EDIT: { from: ['DRAFT'], roles: ['stagiaire'] },
  SUBMIT: { from: ['DRAFT'], roles: ['stagiaire'] },
  START_REVIEW: { from: ['SUBMITTED'], roles: ['admin'] },
  ACCEPT: { from: ['SUBMITTED', 'UNDER_REVIEW'], roles: ['admin'] },
  REJECT: { from: ['SUBMITTED', 'UNDER_REVIEW'], roles: ['admin'] },
}

export function canTransition(
  action: WorkflowAction,
  from: ApplicationStatus,
  role: AppRole,
): boolean {
  const rule = TRANSITIONS[action]
  if (!rule) return false
  if (!rule.roles.includes(role)) return false
  return rule.from.includes(from)
}

/** Terminal statuses can never be changed without an audited reopening feature. */
export function isTerminal(status: ApplicationStatus): boolean {
  return status === 'ACCEPTED' || status === 'REJECTED'
}

/** A trainee may edit content only while the request is still a draft. */
export function isEditable(status: ApplicationStatus): boolean {
  return status === 'DRAFT'
}

/** Human-readable reason shown when a transition is refused. */
export function transitionRefusalMessage(
  action: WorkflowAction,
  from: ApplicationStatus,
  role: AppRole,
): string {
  const rule = TRANSITIONS[action]
  if (!rule || !rule.roles.includes(role)) return 'Accès refusé pour votre rôle.'
  if (isTerminal(from)) {
    return 'Cette demande a déjà reçu une décision définitive et ne peut plus être modifiée.'
  }
  return `Action impossible depuis le statut actuel (${from}).`
}

/* -------------------------------------------------------------------------- */
/* Ownership                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Resource-level check used by every server action that touches a specific
 * application. Admins may act on any application; a stagiaire only on their own.
 */
export function canAccessApplication(
  viewer: { id: string; role: AppRole },
  application: { applicant_id: string },
): boolean {
  if (viewer.role === 'admin') return true
  return application.applicant_id === viewer.id
}
