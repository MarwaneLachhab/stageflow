'use client'

import { useState, useTransition } from 'react'
import { LifeBuoy } from 'lucide-react'
import { TextField, TextareaField, SelectField } from '@/components/ui/form-field'
import { Alert } from '@/components/ui/alert'
import { Spinner } from '@/components/ui/skeleton'
import { createSupportTicket } from '@/lib/actions/support'

export function SupportTicketForm() {
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [subject, setSubject] = useState('')
  const [category, setCategory] = useState('TECHNICAL')
  const [priority, setPriority] = useState('NORMAL')
  const [description, setDescription] = useState('')

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    startTransition(async () => {
      const result = await createSupportTicket({ subject, category, priority, description })
      if (!result.ok) {
        setError(result.error)
        return
      }
      setMessage(result.message ?? 'Ticket créé.')
      setSubject('')
      setDescription('')
    })
  }

  return (
    <form onSubmit={submit} className="space-y-5 rounded-card border border-border bg-surface p-5 sm:p-6">
      <div>
        <p className="flex items-center gap-2 text-base font-semibold text-ink"><LifeBuoy className="h-4 w-4 text-primary-600" /> Contacter le support</p>
        <p className="mt-1 text-sm text-ink-muted">Décrivez votre problème. L’équipe pourra répondre depuis le même ticket.</p>
      </div>
      {error && <Alert variant="error">{error}</Alert>}
      {message && <Alert variant="success">{message}</Alert>}
      <TextField label="Sujet" name="subject" required value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Ex. Je ne peux pas envoyer mon CV" />
      <div className="grid gap-5 sm:grid-cols-2">
        <SelectField label="Catégorie" name="category" value={category} onChange={(e) => setCategory(e.target.value)} options={[{ value: 'TECHNICAL', label: 'Problème technique' }, { value: 'ACCOUNT', label: 'Compte et connexion' }, { value: 'APPLICATION', label: 'Demande de stage' }, { value: 'OTHER', label: 'Autre' }]} />
        <SelectField label="Priorité" name="priority" value={priority} onChange={(e) => setPriority(e.target.value)} options={[{ value: 'LOW', label: 'Basse' }, { value: 'NORMAL', label: 'Normale' }, { value: 'HIGH', label: 'Haute' }, { value: 'URGENT', label: 'Urgente' }]} />
      </div>
      <TextareaField label="Description" name="description" required rows={6} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Expliquez ce qui se passe et les étapes déjà essayées…" />
      <button type="submit" disabled={pending} className="sf-btn-primary w-full sm:w-auto">{pending ? <Spinner /> : <LifeBuoy className="h-4 w-4" />}{pending ? 'Envoi…' : 'Envoyer au support'}</button>
    </form>
  )
}
