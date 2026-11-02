'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { KeyRound } from 'lucide-react'
import { passwordUpdateSchema } from '@/lib/validation/schemas'
import { updatePassword } from '@/lib/auth/actions'
import { PasswordField } from '@/components/ui/form-field'
import { Alert, ErrorSummary } from '@/components/ui/alert'
import { Spinner } from '@/components/ui/skeleton'
import { useToast } from '@/components/ui/toast'

type Values = { password: string; confirmPassword: string }

/** Password update form used after the recovery link established a session. */
export function ResetPasswordForm() {
  const router = useRouter()
  const toast = useToast()
  const [serverError, setServerError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [pending, startTransition] = useTransition()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(passwordUpdateSchema),
    defaultValues: { password: '', confirmPassword: '' },
  })

  const onSubmit = (values: Values) => {
    setServerError(null)
    startTransition(async () => {
      const result = await updatePassword(values)
      if (!result.ok) {
        setServerError(result.error)
        return
      }
      setDone(true)
      toast.success('Mot de passe mis à jour', result.message)
      window.setTimeout(() => router.replace('/redirection'), 1200)
    })
  }

  if (done) {
    return (
      <Alert variant="success" title="Mot de passe mis à jour">
        Votre nouveau mot de passe est actif. Redirection vers votre espace…
      </Alert>
    )
  }

  const errorList = Object.entries(errors).map(([field, error]) => ({
    fieldId: field,
    message: (error as { message?: string })?.message ?? 'Champ invalide',
  }))

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
      <ErrorSummary errors={errorList} />
      {serverError && <Alert variant="error">{serverError}</Alert>}

      <PasswordField
        label="Nouveau mot de passe"
        id="password"
        required
        autoComplete="new-password"
        placeholder="••••••••••"
        error={errors.password?.message}
        hint="Au moins 10 caractères, avec majuscule, minuscule et chiffre."
        {...register('password')}
      />

      <PasswordField
        label="Confirmer le mot de passe"
        id="confirmPassword"
        required
        autoComplete="new-password"
        placeholder="••••••••••"
        error={errors.confirmPassword?.message}
        {...register('confirmPassword')}
      />

      <button type="submit" disabled={pending} className="sf-btn-primary w-full">
        {pending ? <Spinner /> : <KeyRound className="h-4 w-4" aria-hidden="true" />}
        {pending ? 'Mise à jour…' : 'Mettre à jour le mot de passe'}
      </button>

      <Link href="/connexion" className="sf-btn-ghost w-full">
        Annuler et revenir à la connexion
      </Link>
    </form>
  )
}
