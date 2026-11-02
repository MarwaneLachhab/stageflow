import { describe, expect, it } from 'vitest'
import {
  canTransition,
  isTerminal,
  isEditable,
  canAccessApplication,
  matchRouteRule,
  type WorkflowAction,
} from '@/lib/permissions'
import type { ApplicationStatus } from '@/lib/constants'

/**
 * Workflow state-machine tests.
 *
 * The canonical workflow has FIVE states. These tests exist mainly to pin down
 * the transitions that must NEVER be possible, because a hole here would be a
 * privilege-escalation bug rather than a cosmetic one.
 */

describe('canTransition — transitions that MUST be allowed', () => {
  it('lets a stagiaire submit their own draft', () => {
    expect(canTransition('SUBMIT', 'DRAFT', 'stagiaire')).toBe(true)
  })

  it('lets an admin move a submitted request into review', () => {
    expect(canTransition('START_REVIEW', 'SUBMITTED', 'admin')).toBe(true)
  })

  it('lets an admin accept a submitted request', () => {
    expect(canTransition('ACCEPT', 'SUBMITTED', 'admin')).toBe(true)
  })

  it('lets an admin accept a request under review', () => {
    expect(canTransition('ACCEPT', 'UNDER_REVIEW', 'admin')).toBe(true)
  })

  it('lets an admin reject a submitted or under-review request', () => {
    expect(canTransition('REJECT', 'SUBMITTED', 'admin')).toBe(true)
    expect(canTransition('REJECT', 'UNDER_REVIEW', 'admin')).toBe(true)
  })

  it('does NOT let an admin reject a draft', () => {
    // A draft was never sent, so "rejecting" it would be meaningless to the
    // candidate. The record is simply abandoned, not decided.
    expect(canTransition('REJECT', 'DRAFT', 'admin')).toBe(false)
  })
})

describe('canTransition — transitions that MUST be refused', () => {
  it('refuses a stagiaire accepting their own request', () => {
    expect(canTransition('ACCEPT', 'SUBMITTED', 'stagiaire')).toBe(false)
    expect(canTransition('ACCEPT', 'UNDER_REVIEW', 'stagiaire')).toBe(false)
    expect(canTransition('ACCEPT', 'DRAFT', 'stagiaire')).toBe(false)
  })

  it('refuses a stagiaire rejecting their own request', () => {
    expect(canTransition('REJECT', 'SUBMITTED', 'stagiaire')).toBe(false)
  })

  it('refuses a stagiaire starting review on their own request', () => {
    expect(canTransition('START_REVIEW', 'SUBMITTED', 'stagiaire')).toBe(false)
  })

  it('refuses an admin submitting on behalf of a stagiaire', () => {
    expect(canTransition('SUBMIT', 'DRAFT', 'admin')).toBe(false)
  })

  it('refuses every transition out of a terminal state', () => {
    const terminal: ApplicationStatus[] = ['ACCEPTED', 'REJECTED']
    const actions: WorkflowAction[] = ['SUBMIT', 'START_REVIEW', 'ACCEPT', 'REJECT', 'EDIT']

    for (const status of terminal) {
      for (const action of actions) {
        expect(
          canTransition(action, status, 'admin'),
          `${action} must not be possible from ${status} (admin)`,
        ).toBe(false)

        expect(
          canTransition(action, status, 'stagiaire'),
          `${action} must not be possible from ${status} (stagiaire)`,
        ).toBe(false)
      }
    }
  })

  it('refuses re-submitting an already submitted request', () => {
    expect(canTransition('SUBMIT', 'SUBMITTED', 'stagiaire')).toBe(false)
    expect(canTransition('SUBMIT', 'UNDER_REVIEW', 'stagiaire')).toBe(false)
  })

  it('refuses accepting a draft directly', () => {
    // A draft is incomplete by definition; it must be rejected, not accepted.
    expect(canTransition('ACCEPT', 'DRAFT', 'admin')).toBe(false)
  })
})

describe('isTerminal', () => {
  it('treats acceptée and refusée as terminal', () => {
    expect(isTerminal('ACCEPTED')).toBe(true)
    expect(isTerminal('REJECTED')).toBe(true)
  })

  it('treats the three active states as non-terminal', () => {
    expect(isTerminal('DRAFT')).toBe(false)
    expect(isTerminal('SUBMITTED')).toBe(false)
    expect(isTerminal('UNDER_REVIEW')).toBe(false)
  })
})

describe('isEditable', () => {
  it('allows edits only on a draft', () => {
    expect(isEditable('DRAFT')).toBe(true)
  })

  it('locks the record as soon as it is submitted', () => {
    expect(isEditable('SUBMITTED')).toBe(false)
    expect(isEditable('UNDER_REVIEW')).toBe(false)
    expect(isEditable('ACCEPTED')).toBe(false)
    expect(isEditable('REJECTED')).toBe(false)
  })
})

/* -------------------------------------------------------------------------- */
/* Record-level access                                                         */
/* -------------------------------------------------------------------------- */

describe('canAccessApplication', () => {
  const OWNER = 'user-1'
  const OTHER = 'user-2'

  /**
   * Signature: `canAccessApplication(viewer, application)` where `viewer` is
   * `{ id, role }` and `application` is `{ applicant_id }`. The property name
   * `applicant_id` is deliberate: it mirrors the database column, so the check
   * reads as "does this row belong to this viewer?".
   */

  it('lets the owner read their own record', () => {
    expect(
      canAccessApplication({ id: OWNER, role: 'stagiaire' }, { applicant_id: OWNER }),
    ).toBe(true)
  })

  it('stops a stagiaire reading somebody else’s record', () => {
    expect(
      canAccessApplication({ id: OTHER, role: 'stagiaire' }, { applicant_id: OWNER }),
    ).toBe(false)
  })

  it('lets an administrator read any record', () => {
    expect(canAccessApplication({ id: OTHER, role: 'admin' }, { applicant_id: OWNER })).toBe(true)
    expect(canAccessApplication({ id: OTHER, role: 'admin' }, { applicant_id: OTHER })).toBe(true)
  })

  it('does not grant access on a id-prefix collision', () => {
    expect(
      canAccessApplication({ id: 'user-1', role: 'stagiaire' }, { applicant_id: 'user-10' }),
    ).toBe(false)
  })
})

/* -------------------------------------------------------------------------- */
/* Route rules                                                                 */
/* -------------------------------------------------------------------------- */

describe('matchRouteRule', () => {
  /**
   * `matchRouteRule` returns `{ roles: AppRole[] | null, public: boolean }`.
   * `roles: null` means "any authenticated role"; `public: true` means guests
   * are allowed through.
   */

  it('classifies the stagiaire workspace as stagiaire-only', () => {
    const rule = matchRouteRule('/stagiaire/tableau-de-bord')
    expect(rule.roles).toEqual(['stagiaire'])
    expect(rule.public).toBe(false)
  })

  it('classifies the admin workspace as admin-only', () => {
    const rule = matchRouteRule('/admin/tableau-de-bord')
    expect(rule.roles).toEqual(['admin'])
    expect(rule.public).toBe(false)
  })

  it('matches nested admin and stagiaire paths', () => {
    expect(matchRouteRule('/admin/demandes/abc-123').roles).toEqual(['admin'])
    expect(matchRouteRule('/stagiaire/documents').roles).toEqual(['stagiaire'])
  })

  it('matches the bare workspace prefix itself', () => {
    expect(matchRouteRule('/admin').roles).toEqual(['admin'])
    expect(matchRouteRule('/stagiaire').roles).toEqual(['stagiaire'])
  })

  it('classifies unknown/public routes as open', () => {
    expect(matchRouteRule('/').public).toBe(true)
    expect(matchRouteRule('/connexion').public).toBe(true)
    expect(matchRouteRule('/inscription').public).toBe(true)
    expect(matchRouteRule('/conditions-utilisation').public).toBe(true)
  })

  it('does not treat a lookalike prefix as the admin area', () => {
    // `/administrateur` must NOT match the `/admin` rule.
    const rule = matchRouteRule('/administrateur')
    expect(rule.roles).not.toEqual(['admin'])
  })

  it('does not treat a lookalike prefix as the stagiaire area', () => {
    const rule = matchRouteRule('/stagiaires-annuaire')
    expect(rule.roles).not.toEqual(['stagiaire'])
  })
})
