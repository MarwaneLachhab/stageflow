'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowRight, Lock, ShieldCheck } from 'lucide-react'
import { signInSchema, type SignInInput } from '@/lib/validation/schemas'
import { signIn } from '@/lib/auth/actions'
import { MfaVerificationForm } from '@/components/security/mfa-verification-form'
import { PasswordField, TextField } from '@/components/ui/form-field'
import { Alert, ErrorSummary } from '@/components/ui/alert'
import { Spinner } from '@/components/ui/skeleton'

/** SCREEN 3 — Unified login form with role-aware redirect and a 2FA step. */
export function SignInForm({
  next,
  initialError,
}: {
  next?: string
  initialError?: string
}) {
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(
    initialError === 'lien-invalide'
      ? 'Ce lien est invalide ou a expiré. Veuillez réessayer.'
      : null,
  )
  const [submitting, setSubmitting] = useState(false)
  const [, startTransition] = useTransition()

  /*
   * When the account owns a verified TOTP factor, `signIn` answers with a
   * challenge instead of a redirect: the form switches to the code step in
   * place, on the same page, exactly like the major authentications providers.
   */
  const [mfaStep, setMfaStep] = useState<{ factorId: string; challengeId: string } | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignInInput>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: '', password: '' },
  })

  const onSubmit = (values: SignInInput) => {
    setServerError(null)
    setSubmitting(true)

    startTransition(async () => {
      const result = await signIn(values, { next })
      setSubmitting(false)

      if (!result.ok) {
        // Generic message only: never disclose whether the account exists.
        setServerError(result.error)
        return
      }

      if (result.data.requiresMfa) {
        setMfaStep({ factorId: result.data.factorId, challengeId: result.data.challengeId })
        return
      }

      // The role comes from the database, so this redirect cannot be forged.
      router.replace(result.data.redirectTo)
      router.refresh()
    })
  }

  const errorList = Object.entries(errors).map(([field, error]) => ({
    fieldId: field,
    message: (error as { message?: string })?.message ?? 'Champ invalide',
  }))

  if (mfaStep) {
    return (
      <div className="space-y-5">
        <Alert variant="success" title="Étape 2 sur 2">
          Mot de passe accepté — il reste à confirmer votre code d’authentification.
        </Alert>
        <MfaVerificationForm
          factorId={mfaStep.factorId}
          challengeId={mfaStep.challengeId}
          next={next}
        />
        <div className="flex items-center gap-4 py-1">
          <span className="h-px flex-1 bg-border" />
          <span className="text-xs font-medium text-ink-subtle">Accès sécurisé</span>
          <span className="h-px flex-1 bg-border" />
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
      <ErrorSummary errors={errorList} />

      {serverError && <Alert variant="error">{serverError}</Alert>}

      <TextField
        label="Adresse e-mail"
        id="email"
        type="email"
        required
        inputMode="email"
        autoComplete="email"
        placeholder="nom@exemple.com"
        error={errors.email?.message}
        {...register('email')}
      />

      <PasswordField
        label="Mot de passe"
        id="password"
        required
        autoComplete="current-password"
        placeholder="••••••••••"
        error={errors.password?.message}
        {...register('password')}
      />

      <div className="flex items-center justify-end">
        <Link
          href="/mot-de-passe-oublie"
          className="shrink-0 text-sm font-medium text-primary-600 hover:underline"
        >
          Mot de passe oublié ?
        </Link>
      </div>

      <button type="submit" disabled={submitting} className="sf-btn-primary w-full">
        {submitting ? <Spinner /> : <ArrowRight className="h-4 w-4" aria-hidden="true" />}
        {submitting ? 'Connexion…' : 'Se connecter'}
      </button>

      <div className="flex items-center gap-4 py-1">
        <span className="h-px flex-1 bg-border" />
        <span className="text-xs font-medium text-ink-subtle">Accès sécurisé</span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <div className="space-y-2.5 rounded-control bg-canvas px-3.5 py-3.5">
        <div className="flex items-start gap-2">
          <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-subtle" aria-hidden="true" />
          <p className="text-xs leading-relaxed text-ink-muted">
            Les informations de connexion et les données de candidature sont protégées.
          </p>
        </div>
        <div className="flex items-start gap-2">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-subtle" aria-hidden="true" />
          <p className="text-xs leading-relaxed text-ink-muted">
            Vous serez redirigé automatiquement vers votre espace selon votre rôle.
          </p>
        </div>
      </div>
    </form>
  )
}
