'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { KeyRound } from 'lucide-react'
import { TextField } from '@/components/ui/form-field'
import { Alert } from '@/components/ui/alert'
import { Spinner } from '@/components/ui/skeleton'
import { verifySignupOtp } from '@/lib/auth/actions'

export function EmailOtpForm({ initialEmail = '' }: { initialEmail?: string }) {
  const router = useRouter()
  const [email, setEmail] = useState(initialEmail)
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    startTransition(async () => {
      const result = await verifySignupOtp({ email, code })
      if (!result.ok) {
        setError(result.error)
        return
      }
      router.replace(result.data.redirectTo)
      router.refresh()
    })
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4 rounded-card border border-primary-100 bg-primary-50/40 p-5">
      <div>
        <p className="flex items-center gap-2 text-sm font-semibold text-ink">
          <KeyRound className="h-4 w-4 text-primary-600" aria-hidden="true" />
          Confirmer avec un code
        </p>
        <p className="mt-1 text-xs leading-relaxed text-ink-muted">
          Le code à 6 chiffres expire après une durée limitée et ne peut être utilisé qu’une seule fois.
        </p>
      </div>
      {error && <Alert variant="error">{error}</Alert>}
      <TextField
        label="Adresse e-mail"
        name="email"
        id="signup-otp-email"
        type="email"
        required
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="nom@exemple.com"
      />
      <TextField
        label="Code à 6 chiffres"
        name="code"
        id="signup-otp-code"
        required
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={7}
        value={code}
        onChange={(event) => setCode(event.target.value.replace(/[^0-9\s-]/g, '').slice(0, 7))}
        placeholder="000000"
      />
      <button type="submit" disabled={pending} className="sf-btn-primary w-full">
        {pending ? <Spinner /> : <KeyRound className="h-4 w-4" aria-hidden="true" />}
        {pending ? 'Vérification…' : 'Vérifier le code'}
      </button>
    </form>
  )
}
