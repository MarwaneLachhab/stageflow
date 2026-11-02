'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { ArrowLeft, MailCheck } from 'lucide-react'
import { TextField } from '@/components/ui/form-field'
import { Alert } from '@/components/ui/alert'
import { Spinner } from '@/components/ui/skeleton'
import { requestPasswordReset, resendVerificationEmail } from '@/lib/auth/actions'

/**
 * Shared client form for the two "we'll e-mail you a link" screens
 * (/mot-de-passe-oublie and /verification-email).
 *
 * Both use an identical response regardless of whether the address exists, so
 * neither screen can be used to enumerate accounts.
 */
export function EmailLinkForm({
  mode,
  submitLabel,
  successTitle,
  successBody,
  emailPlaceholder = 'nom@exemple.com',
}: {
  mode: 'reset' | 'resend'
  submitLabel: string
  successTitle: string
  successBody: string
  emailPlaceholder?: string
}) {
  const [email, setEmail] = useState('')
  const [fieldError, setFieldError] = useState<string | undefined>()
  const [serverError, setServerError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [pending, startTransition] = useTransition()

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    setServerError(null)
    setFieldError(undefined)

    if (!email.trim()) {
      setFieldError('L’adresse e-mail est requise.')
      return
    }

    startTransition(async () => {
      const result =
        mode === 'reset'
          ? await requestPasswordReset({ email })
          : await resendVerificationEmail(email)

      if (!result.ok) {
        setServerError(result.error)
        return
      }
      setDone(true)
    })
  }

  if (done) {
    return (
      <div className="rounded-card border border-border bg-canvas p-6 text-center">
        <span
          aria-hidden="true"
          className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-success-bg text-success"
        >
          <MailCheck className="h-6 w-6" />
        </span>
        <h2 className="text-base font-semibold text-ink">{successTitle}</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-muted">{successBody}</p>
        <p className="mt-3 text-xs text-ink-subtle">
          Si vous ne recevez rien dans quelques minutes, vérifiez votre dossier de courrier
          indésirable.
        </p>
        <div className="mt-6 flex flex-col gap-2.5">
          <Link href="/connexion" className="sf-btn-primary w-full">
            Retour à la connexion
          </Link>
          <button type="button" onClick={() => setDone(false)} className="sf-btn-ghost w-full">
            Utiliser une autre adresse
          </button>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      {serverError && <Alert variant="error">{serverError}</Alert>}

      <TextField
        label="Adresse e-mail"
        id="email"
        name="email"
        type="email"
        required
        inputMode="email"
        autoComplete="email"
        placeholder={emailPlaceholder}
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        error={fieldError}
        hint="Utilisez l’adresse associée à votre compte."
      />

      <button type="submit" disabled={pending} className="sf-btn-primary w-full">
        {pending ? <Spinner /> : <MailCheck className="h-4 w-4" aria-hidden="true" />}
        {pending ? 'Envoi en cours…' : submitLabel}
      </button>

      <Link href="/connexion" className="sf-btn-ghost w-full">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Retour à la connexion
      </Link>
    </form>
  )
}
