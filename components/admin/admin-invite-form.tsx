'use client'

import { useState, useTransition } from 'react'
import { ShieldPlus } from 'lucide-react'
import { TextField } from '@/components/ui/form-field'
import { Alert } from '@/components/ui/alert'
import { Spinner } from '@/components/ui/skeleton'
import { inviteAdmin } from '@/lib/actions/admin-users'

export function AdminInviteForm() {
  const [pending, startTransition] = useTransition()
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    setFeedback(null)
    startTransition(async () => {
      const result = await inviteAdmin({ firstName, lastName, email })
      if (!result.ok) {
        setFeedback({ type: 'error', text: result.error })
        return
      }
      setFeedback({ type: 'success', text: result.message ?? 'Invitation envoyée.' })
      setFirstName(''); setLastName(''); setEmail('')
    })
  }
  return <form onSubmit={submit} className="space-y-4 rounded-card border border-border bg-surface p-5 sm:p-6"><div><p className="flex items-center gap-2 text-base font-semibold text-ink"><ShieldPlus className="h-4 w-4 text-primary-600" /> Inviter un administrateur</p><p className="mt-1 text-sm text-ink-muted">La personne reçoit un e-mail sécurisé pour définir son accès.</p></div>{feedback && <Alert variant={feedback.type === 'success' ? 'success' : 'error'}>{feedback.text}</Alert>}<div className="grid gap-4 sm:grid-cols-2"><TextField label="Prénom" name="firstName" required value={firstName} onChange={(e) => setFirstName(e.target.value)} /><TextField label="Nom" name="lastName" required value={lastName} onChange={(e) => setLastName(e.target.value)} /></div><TextField label="Adresse e-mail" name="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@organisation.org" /><button type="submit" disabled={pending} className="sf-btn-primary w-full sm:w-auto">{pending ? <Spinner /> : <ShieldPlus className="h-4 w-4" />}{pending ? 'Invitation…' : 'Envoyer l’invitation'}</button></form>
}
