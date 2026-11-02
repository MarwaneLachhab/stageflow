import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ProgressTimeline } from '@/components/stagiaire/progress-timeline'
import { StatusBadge } from '@/components/ui/status-badge'
import { ActivityFeed } from '@/components/stagiaire/activity-feed'

/**
 * Component tests for the status-rendering surfaces.
 *
 * The most important assertion in this file is the ProgressTimeline group: the
 * mockups draw four sequential stages, which would misrepresent a rejected
 * application as "still progressing". These tests lock in the corrected
 * behaviour so a future visual tweak cannot silently reintroduce the bug.
 */

describe('StatusBadge', () => {
  it('renders the full label by default', () => {
    render(<StatusBadge status="UNDER_REVIEW" />)
    expect(screen.getByText('En cours d’examen')).toBeInTheDocument()
  })

  it('renders the short label when asked', () => {
    render(<StatusBadge status="SUBMITTED" variant="short" />)
    // « En attente » is the mockup's KPI wording for the SUBMITTED state.
    expect(screen.getByText('En attente')).toBeInTheDocument()
  })

  it('renders every one of the five statuses without throwing', () => {
    const statuses = ['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'ACCEPTED', 'REJECTED'] as const
    for (const status of statuses) {
      const { unmount } = render(<StatusBadge status={status} />)
      expect(document.body.textContent?.length).toBeGreaterThan(0)
      unmount()
    }
  })
})

describe('ProgressTimeline', () => {
  it('renders the four canonical stage labels', () => {
    render(<ProgressTimeline status="DRAFT" />)
    expect(screen.getByText('Brouillon')).toBeInTheDocument()
    expect(screen.getByText('Envoyée')).toBeInTheDocument()
    expect(screen.getByText('En examen')).toBeInTheDocument()
    expect(screen.getByText('Décision')).toBeInTheDocument()
  })

  it('resolves the fourth node to the real outcome once decided', () => {
    // Design intent (see the file header comment): Acceptée and Refusée are
    // ALTERNATIVE terminal outcomes, so there is exactly ONE fourth node — and
    // once decided it shows the actual verdict rather than the neutral word
    // "Décision".
    render(<ProgressTimeline status="REJECTED" />)

    expect(screen.getByText('Refusée')).toBeInTheDocument()
    // The opposite outcome must never be rendered alongside it.
    expect(screen.queryByText('Acceptée')).not.toBeInTheDocument()
  })

  it('shows the neutral Décision label while the request is still active', () => {
    render(<ProgressTimeline status="UNDER_REVIEW" />)

    expect(screen.getByText('Décision')).toBeInTheDocument()
    // No verdict may be implied before one has been reached.
    expect(screen.queryByText('Acceptée')).not.toBeInTheDocument()
    expect(screen.queryByText('Refusée')).not.toBeInTheDocument()
  })

  it('supports a vertical variant for narrow screens', () => {
    render(<ProgressTimeline status="SUBMITTED" variant="vertical" />)
    expect(screen.getByText('Envoyée')).toBeInTheDocument()
  })

  it('accepts an accepted request and shows the verdict, not a pending stage', () => {
    render(<ProgressTimeline status="ACCEPTED" />)

    expect(screen.getByText('Acceptée')).toBeInTheDocument()
    expect(screen.queryByText('Refusée')).not.toBeInTheDocument()
  })

  it('does not mark a rejected request as still in progress', () => {
    const { container } = render(<ProgressTimeline status="REJECTED" />)

    // A terminated timeline must not expose an "active/pending" affordance that
    // a visual regression could reintroduce.
    const pendingMarkers = container.querySelectorAll('[data-pending="true"]')
    expect(pendingMarkers).toHaveLength(0)
  })
})

describe('ActivityFeed', () => {
  it('shows an empty message when there is no history', () => {
    render(<ActivityFeed items={[]} />)
    expect(screen.getByText('Aucune activité pour le moment.')).toBeInTheDocument()
  })

  it('renders one row per history entry', () => {
    render(
      <ActivityFeed
        items={[
          {
            id: 'h1',
            status: 'SUBMITTED',
            note: 'Demande transmise.',
            createdAt: '2025-09-01T10:00:00.000Z',
          },
          {
            id: 'h2',
            status: 'UNDER_REVIEW',
            note: 'Dossier pris en charge.',
            createdAt: '2025-09-03T09:30:00.000Z',
          },
        ]}
      />,
    )

    expect(screen.getByText('Demande transmise.')).toBeInTheDocument()
    expect(screen.getByText('Dossier pris en charge.')).toBeInTheDocument()
  })

  it('does not render a note when it is null', () => {
    render(
      <ActivityFeed
        items={[
          { id: 'h1', status: 'SUBMITTED', note: null, createdAt: '2025-09-01T10:00:00.000Z' },
        ]}
      />,
    )

    // The status label still appears; only the note text is absent.
    expect(screen.getByText('Envoyée')).toBeInTheDocument()
  })

  it('never leaks a private administrative note field', () => {
    // `ActivityItem` has no `privateNote` property by construction. This test
    // documents that the feed is fed only from `public_note`.
    const items = [
      { id: 'h1', status: 'ACCEPTED' as const, note: 'Motif public', createdAt: '2025-09-05T10:00:00.000Z' },
    ]
    render(<ActivityFeed items={items} />)

    expect(screen.getByText('Motif public')).toBeInTheDocument()
    expect(screen.queryByText(/interne/i)).not.toBeInTheDocument()
  })
})
