'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { KeyRound, RefreshCw, ShieldCheck } from 'lucide-react'
import { verifyMfa } from '@/lib/auth/actions'
import { Alert, FieldError } from '@/components/ui/alert'
import { Spinner } from '@/components/ui/skeleton'

/**
 * The six-digit step of TOTP authentication.
 *
 * Reused by three screens, which is why the challenge (factorId + challengeId)
 * always arrives from the SERVER:
 *   - the sign-in form (challenge issued inside the `signIn` action),
 *   - /connexion/verification (a session that was interrupted before the code),
 *   - /securite (the re-verification wall protecting MFA management).
 *
 * `stayAfterVerify` changes what happens on success:
 *   - false (default): the caller is navigated to its destination (sign-in);
 *   - true: the view simply refreshes so the server re-renders with the
 *     upgraded aal2 session (the /securite wall unlocks in place).
 */
export function MfaVerificationForm({
  factorId,
  challengeId,
  email,
  next,
  stayAfterVerify = false,
}: {
  factorId: string
  challengeId: string
  email?: string
  next?: string
  stayAfterVerify?: boolean
}) {
  const router = useRouter()
  const [code, setCode] = useState('')
  const [serverError, setServerError] = useState<string | null>(null)
  const [fieldError, setFieldError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setServerError(null)
    setFieldError(null)

    const normalised = code.replace(/[\s-]+/g, '')
    if (!/^\d{6}$/.test(normalised)) {
      setFieldError('Le code doit contenir exactement 6 chiffres.')
      return
    }

    setSubmitting(true)

    const start = async () => {
      const result = await verifyMfa(
        { factorId, challengeId, code: normalised },
        { next },
      )
      setSubmitting(false)

      if (!result.ok) {
        setServerError(result.error)
        return
      }

      if (stayAfterVerify) {
        // Refresh so the server re-evaluates the (now aal2) session.
        router.refresh()
        return
      }

      // The redirect target was validated server-side again.
      router.replace(result.data.redirectTo)
      router.refresh()
    }

    void start()
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      {serverError && <Alert variant="error">{serverError}</Alert>}

      <div className="flex items-start gap-3 rounded-control border border-border bg-canvas px-3.5 py-3">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary-600" aria-hidden="true" />
        <p className="text-xs leading-relaxed text-ink-muted">
          {email ? (
            <>
              Pour sécuriser le compte <span className="font-semibold text-ink">{email}</span>, saisissez le
              code à 6 chiffres affiché dans votre application d’authentification (Google
              Authenticator, Authy, 1Password…). Le code change toutes les 30&nbsp;secondes.
            </>
          ) : (
            'Saisissez le code à 6 chiffres affiché dans votre application d’authentification.'
          )}
        </p>
      </div>

      <div className="min-w-0">
        <label htmlFor="otp-code" className="sf-label">
          Code à 6 chiffres
          <span className="ml-1 text-danger" aria-hidden="true">
            *
          </span>
          <span className="sf-sr-only">(obligatoire)</span>
        </label>
        <input
          id="otp-code"
          name="code"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          type="text"
          inputMode="numeric"
          pattern="\d{6}"
          autoComplete="one-time-code"
          maxLength={7}
          required
          aria-required
          aria-invalid={fieldError ? true : undefined}
          aria-describedby={fieldError ? 'otp-code-error' : undefined}
          placeholder="000000"
          className="sf-input text-center text-lg font-semibold tracking-[0.4em]"
          disabled={submitting}
        />
        {fieldError && <FieldError id="otp-code-error">{fieldError}</FieldError>}
      </div>

      <button type="submit" disabled={submitting} className="sf-btn-primary w-full">
        {submitting ? <Spinner /> : <KeyRound className="h-4 w-4" aria-hidden="true" />}
        {submitting ? 'Vérification…' : 'Vérifier et continuer'}
      </button>

      <button
        type="button"
        onClick={() => {
          setServerError(null)
          // Re-render the server component: a NEW challenge is issued before
          // the form is drawn, which also recovers from a lapsed challenge.
          router.refresh()
        }}
        className="flex w-full items-center justify-center gap-1.5 text-sm font-medium text-ink-muted hover:text-ink"
      >
        <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
        Générer un nouveau code
      </button>
    </form>
  )
}
