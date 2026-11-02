'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { SelectField } from '@/components/ui/form-field'
import { updateSupportTicketStatus } from '@/lib/actions/support'

export function SupportStatusControl({ ticketId, status }: { ticketId: string; status: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  return <SelectField label="Statut" name={`ticket-${ticketId}`} value={status} disabled={pending} onChange={(e) => startTransition(async () => { await updateSupportTicketStatus({ ticketId, status: e.target.value }); router.refresh() })} options={[{ value: 'OPEN', label: 'Ouvert' }, { value: 'IN_PROGRESS', label: 'En cours' }, { value: 'RESOLVED', label: 'Résolu' }, { value: 'CLOSED', label: 'Fermé' }]} />
}
