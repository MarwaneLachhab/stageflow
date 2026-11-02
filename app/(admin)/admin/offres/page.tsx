import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/ui/page-header'
import { OfferForm } from '@/components/admin/offer-form'
import { getSessionUser } from '@/lib/auth/session'
import { getAdminOffers, getOrganizations } from '@/lib/db/offers'

export const metadata: Metadata = { title: 'Offres et établissements' }

export default async function AdminOffersPage() {
  const user = await getSessionUser()
  if (!user || user.role !== 'admin') redirect('/connexion')
  const [offers, organizations] = await Promise.all([getAdminOffers(), getOrganizations()])
  return <><PageHeader eyebrow="Espace administration" title="Offres et établissements" description="Préparez les organisations partenaires et publiez des offres visibles par les visiteurs." /><div className="grid gap-6 lg:grid-cols-[1fr_460px]"><section className="space-y-3">{offers.length === 0 && <div className="rounded-card border border-border bg-surface p-6 text-sm text-ink-muted">Aucune offre créée.</div>}{offers.map((offer) => <article key={offer.id} className="rounded-card border border-border bg-surface p-5"><div className="flex items-start justify-between gap-3"><div><h2 className="font-semibold text-ink">{offer.title}</h2><p className="mt-1 text-xs text-ink-muted">{offer.organizations?.name ?? 'Établissement'} · {offer.domain}</p></div><span className="sf-badge border-primary-200 bg-primary-50 text-primary-700">{offer.published ? 'Publiée' : 'Brouillon'}</span></div><p className="mt-3 line-clamp-2 text-sm text-ink-muted">{offer.description}</p></article>)}</section><OfferForm organizations={organizations} /></div></>
}
