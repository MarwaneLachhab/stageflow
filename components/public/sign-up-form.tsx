'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowRight, MailCheck, ShieldCheck } from 'lucide-react'
import { signUpSchema, passwordStrength, type SignUpInput } from '@/lib/validation/schemas'
import { signUpStagiaire } from '@/lib/auth/actions'
import { PasswordField, TextField, CheckboxField } from '@/components/ui/form-field'
import { Alert, ErrorSummary } from '@/components/ui/alert'
import { Spinner } from '@/components/ui/skeleton'
import { useToast } from '@/components/ui/toast'
import { cn } from '@/lib/utils/cn'

/** SCREEN 2 — Stagiaire registration form. */
export function SignUpForm() {
  const router = useRouter()
  const toast = useToast()
  const [serverError, setServerError] = useState<string | null>(null)
  const [confirmationSent, setConfirmationSent] = useState(false)
  const [confirmationEmail, setConfirmationEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [, startTransition] = useTransition()

  const {
    register,
    handleSubmit,
    watch,
    setError,
    formState: { errors },
  } = useForm<SignUpInput>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      lastName: '',
      firstName: '',
      email: '',
      phone: '',
      password: '',
      confirmPassword: '',
      acceptTerms: false,
    },
    mode: 'onBlur',
  })

  const passwordValue = watch('password') ?? ''
  const strength = passwordStrength(passwordValue)

  const onSubmit = (values: SignUpInput) => {
    setServerError(null)
    setSubmitting(true)

    startTransition(async () => {
      const result = await signUpStagiaire(values)
      setSubmitting(false)

      if (!result.ok) {
        setServerError(result.error)
        // Map server-side field errors back onto the inputs.
        if (result.fieldErrors) {
          for (const [field, messages] of Object.entries(result.fieldErrors)) {
            if (messages?.[0]) {
              setError(field as keyof SignUpInput, { type: 'server', message: messages[0] })
            }
          }
        }
        return
      }

      toast.success('Compte créé', result.message)

      if (result.data.needsEmailConfirmation) {
        setConfirmationEmail(result.data.email)
        setConfirmationSent(true)
        return
      }

      // A session exists, so go straight to the workspace.
      router.replace('/redirection')
    })
  }

  if (confirmationSent) {
    return (
      <div className="rounded-card border border-border bg-canvas p-6 text-center">
        <span
          aria-hidden="true"
          className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-success-bg text-success"
        >
          <MailCheck className="h-6 w-6" />
        </span>
        <h2 className="text-base font-semibold text-ink">Vérifiez votre boîte e-mail</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-muted">
          Nous avons envoyé un code à 6 chiffres et un lien de confirmation à l’adresse indiquée.
          Saisissez le code pour activer votre compte, ou utilisez le lien reçu.
        </p>
        <div className="mt-6 flex flex-col gap-2.5">
          <Link href="/connexion" className="sf-btn-primary w-full">
            Aller à la connexion
          </Link>
          <Link
            href={`/verification-email?email=${encodeURIComponent(confirmationEmail)}`}
            className="sf-btn-ghost w-full"
          >
            Saisir le code reçu
          </Link>
        </div>
      </div>
    )
  }

  const errorList = Object.entries(errors).map(([field, error]) => ({
    fieldId: field,
    message: (error as { message?: string })?.message ?? 'Champ invalide',
  }))

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
      <ErrorSummary errors={errorList.length > 1 ? errorList : []} />

      {serverError && <Alert variant="error">{serverError}</Alert>}

      <div className="grid gap-5 sm:grid-cols-2">
        <TextField
          label="Nom"
          id="lastName"
          required
          autoComplete="family-name"
          placeholder="Votre nom"
          error={errors.lastName?.message}
          {...register('lastName')}
        />
        <TextField
          label="Prénom"
          id="firstName"
          required
          autoComplete="given-name"
          placeholder="Votre prénom"
          error={errors.firstName?.message}
          {...register('firstName')}
        />
      </div>

      <TextField
        label="Adresse e-mail"
        id="email"
        type="email"
        required
        inputMode="email"
        autoComplete="email"
        placeholder="nom@exemple.com"
        hint="Cette adresse servira d’identifiant de connexion."
        error={errors.email?.message}
        {...register('email')}
      />

      <TextField
        label="Téléphone"
        id="phone"
        type="tel"
        required
        inputMode="tel"
        autoComplete="tel"
        placeholder="+212 6 00 00 00 00"
        error={errors.phone?.message}
        {...register('phone')}
      />

      <div>
        <PasswordField
          label="Mot de passe"
          id="password"
          required
          autoComplete="new-password"
          placeholder="••••••••••"
          error={errors.password?.message}
          {...register('password')}
        />

        {passwordValue.length > 0 && (
          <div className="mt-2.5 flex items-center gap-2.5">
            <div className="flex flex-1 gap-1" aria-hidden="true">
              {[0, 1, 2, 3].map((index) => (
                <span
                  key={index}
                  className={cn(
                    'h-1 flex-1 rounded-full transition-colors',
                    index < strength.score
                      ? strength.score <= 1
                        ? 'bg-danger'
                        : strength.score === 2
                          ? 'bg-warning'
                          : 'bg-success'
                      : 'bg-slate-100',
                  )}
                />
              ))}
            </div>
            <span className="w-20 shrink-0 text-right text-2xs font-medium text-ink-muted">
              {strength.label}
            </span>
          </div>
        )}

        <p className="sf-hint">
          Au moins 10 caractères, avec une majuscule, une minuscule et un chiffre.
        </p>
      </div>

      <PasswordField
        label="Confirmer le mot de passe"
        id="confirmPassword"
        required
        autoComplete="new-password"
        placeholder="••••••••••"
        error={errors.confirmPassword?.message}
        {...register('confirmPassword')}
      />

      <CheckboxField
        id="acceptTerms"
        error={errors.acceptTerms?.message}
        {...register('acceptTerms')}
        label={
          <>
            J’accepte les{' '}
            <Link
              href="/conditions-utilisation"
              className="font-medium text-primary-600 hover:underline"
            >
              conditions d’utilisation
            </Link>{' '}
            et la{' '}
            <Link href="/confidentialite" className="font-medium text-primary-600 hover:underline">
              politique de confidentialité
            </Link>
            .
          </>
        }
      />

      <div className="flex items-center gap-2 rounded-control bg-canvas px-3.5 py-3">
        <ShieldCheck className="h-4 w-4 shrink-0 text-ink-subtle" aria-hidden="true" />
        <p className="text-xs leading-relaxed text-ink-muted">
          Vos informations personnelles sont protégées.
        </p>
      </div>

      <button type="submit" disabled={submitting} className="sf-btn-primary w-full">
        {submitting ? <Spinner /> : <ArrowRight className="h-4 w-4" aria-hidden="true" />}
        {submitting ? 'Création en cours…' : 'Créer mon compte'}
      </button>
    </form>
  )
}
