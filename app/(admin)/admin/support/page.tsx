import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/ui/page-header'
import { getSessionUser } from '@/lib/auth/session'
import { getSupportTickets } from '@/lib/db/support'
import { SupportStatusControl } from '@/components/support/support-status-control'

export const metadata: Metadata = { title: 'Support' }

export default async function AdminSupportPage() {
  const user = await getSessionUser()
  if (!user || user.role !== 'admin') redirect('/connexion')
  const tickets = await getSupportTickets(user.id, true)
  return (
    <>
      <PageHeader eyebrow="Espace administration" title="Support technique" description="Traitez les demandes des stagiaires et suivez leur résolution." />
      <div className="space-y-3">
        {tickets.length === 0 && <div className="rounded-card border border-border bg-surface p-6 text-sm text-ink-muted">Aucun ticket ouvert.</div>}
        {tickets.map((ticket) => <article key={ticket.id} className="rounded-card border border-border bg-surface p-5"><div className="flex flex-col justify-between gap-3 sm:flex-row"><div><h2 className="font-semibold text-ink">{ticket.subject}</h2><p className="mt-1 text-xs text-ink-muted">{ticket.category} · {ticket.priority} · {ticket.requester_id}</p></div><SupportStatusControl ticketId={ticket.id} status={ticket.status} /></div><p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-ink-muted">{ticket.description}</p></article>)}
      </div>
    </>
  )
}
