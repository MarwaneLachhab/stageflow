import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/ui/page-header'
import { SupportTicketForm } from '@/components/support/support-ticket-form'
import { getSessionUser } from '@/lib/auth/session'
import { getSupportTickets } from '@/lib/db/support'

export const metadata: Metadata = { title: 'Support' }

export default async function StagiaireSupportPage() {
  const user = await getSessionUser()
  if (!user) redirect('/connexion')
  const tickets = await getSupportTickets(user.id)
  return (
    <>
      <PageHeader eyebrow="Espace stagiaire" title="Support technique" description="Demandez de l’aide et suivez les réponses de l’équipe." />
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <SupportTicketForm />
        <section className="rounded-card border border-border bg-surface p-5">
          <h2 className="text-base font-semibold text-ink">Mes demandes</h2>
          <ul className="mt-4 space-y-3">
            {tickets.length === 0 && <li className="text-sm text-ink-muted">Aucun ticket pour le moment.</li>}
            {tickets.map((ticket) => <li key={ticket.id} className="rounded-control border border-border bg-canvas p-3"><p className="font-medium text-ink">{ticket.subject}</p><p className="mt-1 text-xs text-ink-muted">{ticket.status} · {ticket.priority}</p></li>)}
          </ul>
        </section>
      </div>
    </>
  )
}
