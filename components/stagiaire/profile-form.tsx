'use client'

import { useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { BookOpen, Check, Info, Lock, RotateCcw, Save, ShieldCheck, User } from 'lucide-react'
import { Card, CardSectionTitle } from '@/components/ui/card'
import { Alert, ErrorSummary } from '@/components/ui/alert'
import { SelectField, TextField } from '@/components/ui/form-field'
import { Avatar } from '@/components/ui/avatar'
import { Spinner } from '@/components/ui/skeleton'
import { ToneBadge } from '@/components/ui/status-badge'
import { useToast } from '@/components/ui/toast'
import { profileSchema, type ProfileInput } from '@/lib/validation/schemas'
import { updateOwnProfile } from '@/lib/actions/profile'
import { STUDY_LEVELS } from '@/lib/constants'
import { initials, toInputDate } from '@/lib/utils/format'
import type { ProfileRow } from '@/lib/db/stagiaire'

/**
 * SCREEN 5 — Stagiaire profile editor.
 *
 * Field groups, the completeness panel and the "Votre compte" panel follow
 * mockup 05. The e-mail is shown read-only on purpose: changing the login
 * identity must go through the e-mail verification flow, never a silent save,
 * otherwise a typo (or an attacker) could lock the account.
 */
export function ProfileForm({
  profile,
  email,
}: {
  profile: ProfileRow
  email: string
}) {
  const toast = useToast()
  const [serverError, setServerError] = useState<string | null>(null)
  const [saving, startSaving] = useTransition()

  const defaultValues: ProfileInput = {
    lastName: profile.last_name ?? '',
    firstName: profile.first_name ?? '',
    phone: profile.phone ?? '',
    address: profile.address ?? '',
    city: profile.city ?? '',
    birthDate: toInputDate(profile.birth_date),
    school: profile.school ?? '',
    program: profile.program ?? '',
    studyLevel: profile.study_level ?? '',
    specialty: profile.specialty ?? '',
  }

  const {
    register,
    handleSubmit,
    watch,
    reset,
    setError,
    formState: { errors, isDirty },
  } = useForm<ProfileInput>({
    resolver: zodResolver(profileSchema),
    defaultValues,
    mode: 'onBlur',
  })

  const values = watch()
  const completeness = computeCompleteness(values)
  const displayName = `${values.firstName || profile.first_name} ${values.lastName || profile.last_name}`.trim()

  const onSubmit = (data: ProfileInput) => {
    setServerError(null)
    startSaving(async () => {
      const result = await updateOwnProfile(data)
      if (!result.ok) {
        setServerError(result.error)
        if (result.fieldErrors) {
          for (const [field, messages] of Object.entries(result.fieldErrors)) {
            if (messages?.[0]) {
              setError(field as keyof ProfileInput, { type: 'server', message: messages[0] })
            }
          }
        }
        return
      }
      toast.success('Profil enregistré', result.message)
      // Reset the baseline so `isDirty` reflects the new saved state.
      reset(data)
    })
  }

  const errorList = Object.entries(errors).map(([field, error]) => ({
    fieldId: field,
    message: (error as { message?: string })?.message ?? 'Champ invalide',
  }))

  return (
    <>
      {/* ---------------- Header ---------------- */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary-600">
            Votre espace
          </p>
          <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-navy sm:text-[28px]">
            Mon profil
          </h1>
          <p className="mt-2 text-sm text-ink-muted">
            Mettez à jour vos informations personnelles et académiques.
          </p>
        </div>

        <div className="flex gap-2.5">
          {isDirty && (
            <button
              type="button"
              onClick={() => {
                reset(defaultValues)
                setServerError(null)
              }}
              className="sf-btn-secondary"
              disabled={saving}
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              Annuler
            </button>
          )}
          <button
            type="submit"
            form="profile-form"
            disabled={saving}
            className="sf-btn-primary"
          >
            {saving ? <Spinner /> : <Save className="h-4 w-4" aria-hidden="true" />}
            Enregistrer les modifications
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* ---------------- Form ---------------- */}
        <div className="space-y-6">
          {/* Identity card */}
          <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div className="flex min-w-0 items-center gap-4">
              <Avatar
                initials={initials(values.firstName, values.lastName)}
                size="lg"
                tone="primary"
                label={`Avatar de ${displayName || 'l’utilisateur'}`}
              />
              <div className="min-w-0">
                <p className="truncate text-lg font-bold text-ink">{displayName || '—'}</p>
                <p className="truncate text-[13px] text-ink-muted">
                  {[values.program, values.school].filter(Boolean).join(' · ') ||
                    'Complétez votre parcours académique'}
                </p>
                <ToneBadge tone="success" size="sm" className="mt-2">
                  Profil actif
                </ToneBadge>
              </div>
            </div>

            <div className="shrink-0 text-right">
              <p className="text-2xs text-ink-subtle">Adresse de connexion</p>
              <p className="mt-0.5 truncate text-[13px] font-medium text-ink">{email}</p>
              <p className="mt-1 flex items-center justify-end gap-1 text-2xs text-ink-subtle">
                <Lock className="h-3 w-3" aria-hidden="true" />
                Modifiable via vérification
              </p>
            </div>
          </Card>

          <form id="profile-form" onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-6">
            {errorList.length > 1 && <ErrorSummary errors={errorList} />}
            {serverError && <Alert variant="error">{serverError}</Alert>}

            {/* Informations personnelles */}
            <Card className="p-5 sm:p-6">
              <CardSectionTitle>Informations personnelles</CardSectionTitle>
              <div className="mt-5 grid gap-5 sm:grid-cols-2">
                <TextField
                  label="Nom"
                  id="lastName"
                  required
                  autoComplete="family-name"
                  error={errors.lastName?.message}
                  {...register('lastName')}
                />
                <TextField
                  label="Prénom"
                  id="firstName"
                  required
                  autoComplete="given-name"
                  error={errors.firstName?.message}
                  {...register('firstName')}
                />
                <TextField
                  label="Téléphone"
                  id="phone"
                  type="tel"
                  required
                  autoComplete="tel"
                  placeholder="+212 6 00 00 00 00"
                  error={errors.phone?.message}
                  {...register('phone')}
                />
                <TextField
                  label="Date de naissance"
                  id="birthDate"
                  type="date"
                  autoComplete="bday"
                  hint="Facultatif."
                  error={errors.birthDate?.message}
                  {...register('birthDate')}
                />
                <TextField
                  label="Ville"
                  id="city"
                  placeholder="Ex. Rabat"
                  hint="Facultatif."
                  error={errors.city?.message}
                  {...register('city')}
                />
                <TextField
                  label="Adresse"
                  id="address"
                  placeholder="Ex. 12 rue des Écoles"
                  hint="Facultatif."
                  error={errors.address?.message}
                  {...register('address')}
                />
              </div>
            </Card>

            {/* Informations académiques */}
            <Card className="p-5 sm:p-6">
              <CardSectionTitle>Informations académiques</CardSectionTitle>
              <div className="mt-5 grid gap-5 sm:grid-cols-2">
                <TextField
                  label="Établissement"
                  id="school"
                  placeholder="Ex. ENSET Rabat"
                  error={errors.school?.message}
                  {...register('school')}
                />
                <SelectField
                  label="Niveau d’études"
                  id="studyLevel"
                  options={[
                    { value: '', label: 'Sélectionnez un niveau' },
                    ...STUDY_LEVELS.map((level) => ({ value: level, label: level })),
                  ]}
                  error={errors.studyLevel?.message}
                  {...register('studyLevel')}
                />
                <TextField
                  label="Formation"
                  id="program"
                  placeholder="Ex. Génie informatique"
                  error={errors.program?.message}
                  {...register('program')}
                />
                <TextField
                  label="Spécialité"
                  id="specialty"
                  placeholder="Ex. Développement Web"
                  error={errors.specialty?.message}
                  {...register('specialty')}
                />
              </div>
            </Card>

            {/* Mobile save bar */}
            <div className="flex justify-end lg:hidden">
              <button type="submit" disabled={saving} className="sf-btn-primary w-full">
                {saving ? <Spinner /> : <Save className="h-4 w-4" aria-hidden="true" />}
                Enregistrer les modifications
              </button>
            </div>
          </form>
        </div>

        {/* ---------------- Sidebar ---------------- */}
        <aside className="space-y-5">
          <Card className="p-5">
            <p className="text-sm font-semibold text-ink">Complétude du profil</p>
            <p className="mt-1 text-xs leading-relaxed text-ink-muted">
              Un profil complet facilite l’examen de votre dossier.
            </p>

            <p className="mt-4 text-3xl font-bold text-navy">{completeness.percent} %</p>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-primary-600 transition-[width] duration-500"
                style={{ width: `${completeness.percent}%` }}
              />
            </div>

            {completeness.missing.length > 0 ? (
              <p className="mt-3 text-xs text-ink-muted">
                Complétez : {completeness.missing.join(', ')}.
              </p>
            ) : (
              <p className="mt-3 flex items-center gap-1.5 text-xs font-medium text-success">
                <Check className="h-3.5 w-3.5" aria-hidden="true" />
                Votre profil est complet.
              </p>
            )}

            {completeness.percent >= 80 && (
              <ToneBadge tone="info" size="sm" className="mt-3">
                Presque terminé
              </ToneBadge>
            )}
          </Card>

          <Card className="p-5">
            <p className="text-sm font-semibold text-ink">Votre compte</p>

            <ul className="mt-4 space-y-4">
              {[
                {
                  icon: ShieldCheck,
                  title: 'Sécurité du compte',
                  subtitle: 'Mot de passe et connexion',
                },
                { icon: User, title: 'Confidentialité', subtitle: 'Vos données personnelles' },
                { icon: BookOpen, title: 'Notifications', subtitle: 'Suivi de votre candidature' },
              ].map((row) => {
                const Icon = row.icon
                return (
                  <li key={row.title} className="flex items-start gap-3">
                    <span
                      aria-hidden="true"
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600"
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <span>
                      <span className="block text-[13px] font-semibold text-ink">{row.title}</span>
                      <span className="block text-2xs text-ink-muted">{row.subtitle}</span>
                    </span>
                  </li>
                )
              })}
            </ul>

            <p className="mt-5 flex items-start gap-2 border-t border-border pt-4 text-xs leading-relaxed text-ink-muted">
              <Info className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              Pour modifier votre adresse e-mail de connexion, une vérification par e-mail est
              requise afin de protéger votre compte.
            </p>
          </Card>
        </aside>
      </div>
    </>
  )
}

/* -------------------------------------------------------------------------- */
/* Completeness calculation                                                    */
/* -------------------------------------------------------------------------- */

function computeCompleteness(values: ProfileInput): { percent: number; missing: string[] } {
  const checks: [string, boolean][] = [
    ['le nom', Boolean(values.lastName?.trim())],
    ['le prénom', Boolean(values.firstName?.trim())],
    ['le téléphone', Boolean(values.phone?.trim())],
    ['la ville', Boolean(values.city?.trim())],
    ['l’établissement', Boolean(values.school?.trim())],
    ['la formation', Boolean(values.program?.trim())],
    ['le niveau d’études', Boolean(values.studyLevel?.trim())],
    ['la spécialité', Boolean(values.specialty?.trim())],
  ]

  const missing = checks.filter(([, ok]) => !ok).map(([label]) => label)
  const percent = Math.round(((checks.length - missing.length) / checks.length) * 100)
  return { percent, missing }
}
