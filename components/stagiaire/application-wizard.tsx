'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  FileText,
  Info,
  Loader2,
  Save,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Alert, ErrorSummary } from '@/components/ui/alert'
import { TextField, TextareaField, SelectField } from '@/components/ui/form-field'
import { Spinner } from '@/components/ui/skeleton'
import { useToast } from '@/components/ui/toast'
import { cn } from '@/lib/utils/cn'
import { computeDurationLabel } from '@/lib/utils/format'
import {
  DOMAINS,
  STAGE_MODES,
  STAGE_TYPES,
  STATUS_META,
  STUDY_LEVELS,
} from '@/lib/constants'
import { applicationDraftSchema, type ApplicationDraftInput } from '@/lib/validation/schemas'
import { saveDraft, ensureDraft } from '@/lib/actions/application'
import type { ApplicationRow, ProfileRow } from '@/lib/db/stagiaire'

/**
 * SCREEN 6 — Application wizard.
 *
 * Four steps in the mockup: Informations du stage → Informations académiques →
 * Documents → Confirmation. Step 3 (documents) lives on its own screen
 * (/stagiaire/documents) because uploading files needs a real uploader with
 * progress state — so the wizard here covers steps 1, 2 and renders a
 * completion summary for steps 3 and 4.
 *
 * Key behaviours the master prompt requires:
 *  - the draft is persisted server-side, so navigating away and returning, or
 *    refreshing, restores what was typed;
 *  - creating/saving is explicitly NOT submitting;
 *  - a submitted application is read-only (the server refuses writes too).
 */

const STEPS = [
  { id: 1, label: 'Informations du stage', hint: 'Informations générales' },
  { id: 2, label: 'Formation', hint: 'Parcours académique' },
  { id: 3, label: 'Documents', hint: 'Pièces justificatives' },
  { id: 4, label: 'Validation', hint: 'Envoyer la demande' },
] as const

export function ApplicationWizard({
  application,
  profile,
  documentsComplete = false,
  missingDocuments = [],
}: {
  application: ApplicationRow | null
  profile: ProfileRow | null
  documentsComplete?: boolean
  missingDocuments?: string[]
}) {
  const router = useRouter()
  const toast = useToast()
  const [step, setStep] = useState(1)
  const [serverError, setServerError] = useState<string | null>(null)
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null)
  const [otherDomain, setOtherDomain] = useState(() => {
    const value = application?.domain ?? ''
    return value && !(DOMAINS as readonly string[]).includes(value) ? value : ''
  })
  const [saving, startSaving] = useTransition()
  const [creating, startCreating] = useTransition()

  const isReadOnly = application !== null && application.status !== 'DRAFT'

  const defaults = useMemo<ApplicationDraftInput>(
    () => ({
      stageType: application?.stage_type || STAGE_TYPES[0],
      domain:
        application?.domain && (DOMAINS as readonly string[]).includes(application.domain)
          ? application.domain
          : application?.domain
            ? 'Autre'
            : '',
      startDate: application?.start_date ?? '',
      endDate: application?.end_date ?? '',
      mode: application?.mode ?? 'Présentiel',
      motivation: application?.motivation ?? '',
      school: application?.school ?? profile?.school ?? '',
      program: application?.program ?? profile?.program ?? '',
      studyLevel: application?.study_level ?? profile?.study_level ?? '',
      specialty: application?.specialty ?? profile?.specialty ?? '',
    }),
    [application, profile],
  )

  const {
    register,
    handleSubmit,
    watch,
    trigger,
    getValues,
    setError,
    formState: { errors, isDirty },
  } = useForm<ApplicationDraftInput>({
    resolver: zodResolver(applicationDraftSchema),
    defaultValues: defaults,
    mode: 'onBlur',
  })

  const startDate = watch('startDate')
  const endDate = watch('endDate')
  const motivation = watch('motivation') ?? ''
  const selectedDomain = watch('domain') ?? ''
  const duration = computeDurationLabel(startDate, endDate)

  /* ---------------- Draft creation ---------------- */

  const handleCreateDraft = () => {
    setServerError(null)
    startCreating(async () => {
      const result = await ensureDraft()
      if (!result.ok) {
        setServerError(result.error)
        return
      }
      toast.success('Brouillon créé', 'Complétez les informations puis enregistrez.')
      router.refresh()
    })
  }

  /* ---------------- Save draft ---------------- */

  /**
   * Saving sends ONLY the draft-content fields. It never sends `status`, so this
   * path can never accidentally submit the application.
   */
  const persistDraft = async (silent = false) => {
    const values = getValues()
    const draftValues = {
      ...values,
      domain: values.domain === 'Autre' ? otherDomain.trim() : values.domain,
    }
    const result = await saveDraft(draftValues)

    if (!result.ok) {
      if (!silent) setServerError(result.error)
      return false
    }

    setLastSavedAt(result.data.savedAt)
    if (!silent) toast.success('Brouillon enregistré', 'Vous pouvez reprendre plus tard.')
    return true
  }

  const handleSave = () => {
    setServerError(null)
    startSaving(async () => {
      await persistDraft(false)
    })
  }

  /* ---------------- Step navigation ---------------- */

  const STEP_FIELDS: Record<number, (keyof ApplicationDraftInput)[]> = {
    1: ['stageType', 'domain', 'startDate', 'endDate', 'motivation'],
    2: ['school', 'program', 'studyLevel', 'specialty'],
  }

  const goNext = async () => {
    setServerError(null)
    const fields = STEP_FIELDS[step]
    if (fields) {
      const valid = await trigger(fields)
      if (!valid) return
    }

    if (step === 1 && selectedDomain === 'Autre' && otherDomain.trim().length < 2) {
      setError('domain', { type: 'manual', message: 'Précisez le domaine recherché.' })
      return
    }

    // Persist progress so a refresh or navigation does not lose the work.
    if (fields && application) {
      await persistDraft(true)
    }

    if (step === 2) {
      router.push('/stagiaire/documents')
      return
    }
    setStep((s) => Math.min(4, s + 1))
  }

  const goPrevious = () => {
    setServerError(null)
    setStep((s) => Math.max(1, s - 1))
  }

  /* ---------------- No application yet ---------------- */

  if (!application) {
    return (
      <Card className="mx-auto max-w-xl p-6 text-center sm:p-8">
        <span
          aria-hidden="true"
          className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-50 text-primary-600"
        >
          <FileText className="h-6 w-6" />
        </span>
        <h1 className="mt-4 text-xl font-bold text-navy">Nouvelle demande de stage</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-muted">
          Créez votre brouillon pour commencer. Vous pourrez renseigner les informations du stage,
          votre parcours académique et vos documents, puis envoyer votre demande quand tout sera
          complet.
        </p>

        {serverError && (
          <Alert variant="error" className="mt-5 text-left">
            {serverError}
          </Alert>
        )}

        <button
          type="button"
          onClick={handleCreateDraft}
          disabled={creating}
          className="sf-btn-primary mt-6 w-full"
        >
          {creating ? <Spinner /> : <ArrowRight className="h-4 w-4" aria-hidden="true" />}
          {creating ? 'Création…' : 'Commencer ma demande'}
        </button>
      </Card>
    )
  }

  const errorList = Object.entries(errors).map(([field, error]) => ({
    fieldId: field,
    message: (error as { message?: string })?.message ?? 'Champ invalide',
  }))

  const progressPercent = step === 3 ? 75 : step === 4 ? 100 : (step / 4) * 100

  return (
    <>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary-600">
            Votre espace
          </p>
          <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-navy sm:text-[28px]">
            {isReadOnly ? 'Ma demande de stage' : 'Nouvelle demande de stage'}
          </h1>
          <p className="mt-2 text-sm text-ink-muted">
            {isReadOnly
              ? 'Votre demande a été envoyée et n’est plus modifiable.'
              : 'Remplissez les informations nécessaires, puis enregistrez ou soumettez votre dossier.'}
          </p>
        </div>
        <span className="shrink-0">
          <span
            className={cn(
              'sf-badge',
              application.status === 'DRAFT' && 'border-warning-border bg-warning-bg text-warning',
              application.status === 'SUBMITTED' && 'border-warning-border bg-warning-bg text-warning',
              application.status === 'UNDER_REVIEW' && 'border-info-border bg-info-bg text-info',
              application.status === 'ACCEPTED' && 'border-success-border bg-success-bg text-success',
              application.status === 'REJECTED' && 'border-danger-border bg-danger-bg text-danger',
            )}
          >
            {STATUS_META[application.status].label}
          </span>
        </span>
      </div>

      {/* ---------------- Stepper ---------------- */}
      <Card className="mb-6 p-4 sm:p-5">
        <ol className="flex flex-col gap-3 sm:flex-row sm:items-center">
          {STEPS.map((item, index) => {
            const done = step > item.id
            const active = step === item.id
            const isDocuments = item.id === 3

            const content = (
              <>
                <span
                  className={cn(
                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                    done && 'bg-primary-600 text-white',
                    active && 'bg-primary-600 text-white ring-4 ring-primary-100',
                    !done && !active && 'bg-slate-100 text-slate-400',
                  )}
                >
                  {done ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : item.id}
                </span>
                <span className="min-w-0">
                  <span
                    className={cn(
                      'block truncate text-[13px] font-semibold',
                      active ? 'text-ink' : done ? 'text-ink' : 'text-ink-subtle',
                    )}
                  >
                    {item.label}
                  </span>
                  <span className="block truncate text-2xs text-ink-subtle">{item.hint}</span>
                </span>
              </>
            )

            return (
              <li key={item.id} className="flex flex-1 items-center gap-2.5">
                {isDocuments ? (
                  <Link
                    href="/stagiaire/documents"
                    className="flex min-w-0 flex-1 items-center gap-2.5 rounded-control px-1 py-1 hover:bg-canvas"
                  >
                    {content}
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={() => setStep(item.id)}
                    disabled={item.id === 4 && !documentsComplete}
                    className="flex min-w-0 flex-1 items-center gap-2.5 rounded-control px-1 py-1 text-left hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {content}
                  </button>
                )}
                {index < STEPS.length - 1 && (
                  <span
                    aria-hidden="true"
                    className={cn(
                      'hidden h-px flex-1 sm:block',
                      done ? 'bg-primary-600' : 'bg-border',
                    )}
                  />
                )}
              </li>
            )
          })}
        </ol>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        {/* ---------------- Form card ---------------- */}
        <Card className="p-5 sm:p-6">
          <div className="mb-5 flex items-start gap-3 border-b border-border pb-5">
            <span
              aria-hidden="true"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600"
            >
              {step === 1 ? (
                <FileText className="h-4 w-4" />
              ) : (
                <BookOpen className="h-4 w-4" />
              )}
            </span>
            <div>
              <h2 className="text-base font-semibold text-ink">
                {step === 1 ? 'Informations du stage' : 'Informations académiques'}
              </h2>
              <p className="mt-0.5 text-[13px] text-ink-muted">
                {step === 1
                  ? 'Précisez votre recherche de stage.'
                  : 'Ces informations apparaîtront dans votre dossier.'}
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit(goNext)} noValidate>
            {errorList.length > 1 && <ErrorSummary errors={errorList} className="mb-5" />}
            {serverError && (
              <Alert variant="error" className="mb-5">
                {serverError}
              </Alert>
            )}
            {isReadOnly && (
              <Alert variant="info" className="mb-5" title="Dossier envoyé">
                Votre demande a été transmise à l’administration. Les informations ci-dessous sont
                en lecture seule.
              </Alert>
            )}

            {step === 1 && (
              <div className="grid gap-5 sm:grid-cols-2">
                <SelectField
                  label="Type de stage"
                  id="stageType"
                  required
                  disabled={isReadOnly}
                  options={STAGE_TYPES.map((t) => ({ value: t, label: t }))}
                  error={errors.stageType?.message}
                  {...register('stageType')}
                />
                <SelectField
                  label="Domaine"
                  id="domain"
                  required
                  disabled={isReadOnly}
                  options={[
                    { value: '', label: 'Sélectionnez un domaine' },
                    ...DOMAINS.map((d) => ({ value: d, label: d })),
                  ]}
                  error={errors.domain?.message}
                  {...register('domain')}
                />
                {selectedDomain === 'Autre' && (
                  <TextField
                    label="Votre domaine"
                    name="otherDomain"
                    id="otherDomain"
                    required
                    disabled={isReadOnly}
                    value={otherDomain}
                    onChange={(event) => setOtherDomain(event.target.value)}
                    placeholder="Ex. Robotique, audit énergétique…"
                    hint="Le domaine sera enregistré avec votre demande."
                    containerClassName="sm:col-span-2"
                    error={selectedDomain === 'Autre' && otherDomain.trim().length < 2 ? errors.domain?.message : undefined}
                  />
                )}

                <TextField
                  label="Date de début"
                  id="startDate"
                  type="date"
                  required
                  disabled={isReadOnly}
                  error={errors.startDate?.message}
                  {...register('startDate')}
                />
                <TextField
                  label="Date de fin"
                  id="endDate"
                  type="date"
                  required
                  disabled={isReadOnly}
                  error={errors.endDate?.message}
                  {...register('endDate')}
                />

                <TextField
                  label="Durée"
                  id="duration"
                  name="duration"
                  readOnly
                  tabIndex={-1}
                  value={duration ?? ''}
                  placeholder="Calculée automatiquement"
                  hint="Calculée à partir des dates saisies."
                  containerClassName="sm:col-span-1"
                  className="bg-canvas"
                />
                <SelectField
                  label="Mode de stage"
                  id="mode"
                  disabled={isReadOnly}
                  options={STAGE_MODES.map((m) => ({ value: m, label: m }))}
                  error={errors.mode?.message}
                  {...register('mode')}
                />

                <TextareaField
                  label="Description / motivation"
                  id="motivation"
                  required
                  disabled={isReadOnly}
                  rows={6}
                  maxLength={2000}
                  showCount
                  value={motivation}
                  containerClassName="sm:col-span-2"
                  placeholder="Expliquez brièvement votre projet, vos objectifs et les compétences que vous souhaitez développer durant ce stage…"
                  hint="Minimum 50 caractères. Ce texte sera lu par l’administration."
                  error={errors.motivation?.message}
                  {...register('motivation')}
                />
              </div>
            )}

            {step === 2 && (
              <div className="grid gap-5 sm:grid-cols-2">
                <TextField
                  label="Établissement"
                  id="school"
                  disabled={isReadOnly}
                  placeholder="Ex. ENSET Rabat"
                  error={errors.school?.message}
                  {...register('school')}
                />
                <TextField
                  label="Formation"
                  id="program"
                  disabled={isReadOnly}
                  placeholder="Ex. Génie informatique"
                  error={errors.program?.message}
                  {...register('program')}
                />
                <SelectField
                  label="Niveau d’études"
                  id="studyLevel"
                  disabled={isReadOnly}
                  options={[
                    { value: '', label: 'Sélectionnez un niveau' },
                    ...STUDY_LEVELS.map((l) => ({ value: l, label: l })),
                  ]}
                  error={errors.studyLevel?.message}
                  {...register('studyLevel')}
                />
                <TextField
                  label="Spécialité"
                  id="specialty"
                  disabled={isReadOnly}
                  placeholder="Ex. Développement Web"
                  error={errors.specialty?.message}
                  {...register('specialty')}
                />

                <Alert variant="info" className="sm:col-span-2">
                  Ces informations sont préremplies depuis votre profil, et restent modifiables ici.
                  Elles sont figées au moment de l’envoi : votre dossier conservera la version
                  envoyée même si vous modifiez votre profil plus tard.
                </Alert>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-5">
                <Alert
                  variant={documentsComplete ? 'success' : 'warning'}
                  title={documentsComplete ? 'Dossier complet' : 'Documents manquants'}
                >
                  {documentsComplete
                    ? 'Toutes les pièces obligatoires sont présentes. Vous pouvez envoyer votre demande depuis la page Mes documents.'
                    : `Pièces manquantes : ${missingDocuments.join(', ')}.`}
                </Alert>

                <dl className="divide-y divide-border">
                  {[
                    ['Type de stage', getValues('stageType') || '—'],
                    ['Domaine', getValues('domain') || '—'],
                    ['Période', `${getValues('startDate') || '—'} → ${getValues('endDate') || '—'}`],
                    ['Durée', duration ?? '—'],
                    ['Mode', getValues('mode') || '—'],
                    ['Établissement', getValues('school') || '—'],
                    ['Formation', getValues('program') || '—'],
                    ['Niveau', getValues('studyLevel') || '—'],
                  ].map(([label, value]) => (
                    <div key={label} className="flex justify-between gap-4 py-3">
                      <dt className="text-[13px] text-ink-muted">{label}</dt>
                      <dd className="text-right text-[13px] font-semibold text-ink">{value}</dd>
                    </div>
                  ))}
                </dl>

                <Link href="/stagiaire/documents" className="sf-btn-primary w-full">
                  Aller à l’envoi de la demande
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </div>
            )}

            {/* ---------------- Footer actions ---------------- */}
            {!isReadOnly && step < 4 && (
              <div className="mt-6 flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
                <p className="flex items-center gap-1.5 text-xs text-ink-muted">
                  {saving ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                      Enregistrement…
                    </>
                  ) : lastSavedAt ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-success" aria-hidden="true" />
                      Enregistré
                    </>
                  ) : (
                    <>
                      <Info className="h-3.5 w-3.5" aria-hidden="true" />
                      Votre progression est enregistrable en brouillon.
                    </>
                  )}
                </p>

                <div className="flex flex-col gap-2.5 sm:flex-row">
                  {step > 1 && (
                    <button type="button" onClick={goPrevious} className="sf-btn-secondary">
                      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                      Précédent
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving || !isDirty}
                    className="sf-btn-secondary"
                  >
                    {saving ? <Spinner /> : <Save className="h-4 w-4" aria-hidden="true" />}
                    Enregistrer le brouillon
                  </button>
                  <button type="submit" className="sf-btn-primary">
                    {step === 2 ? 'Suivant : documents' : 'Suivant'}
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
            )}
          </form>
        </Card>

        {/* ---------------- Progress sidebar ---------------- */}
        <aside className="space-y-5">
          <Card className="p-5">
            <p className="text-sm font-semibold text-ink">Votre progression</p>
            <p className="mt-1 text-2xl font-bold text-navy">Étape {step} / 4</p>

            <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-primary-600 transition-[width] duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <div className="mt-2 flex justify-between text-xs text-ink-muted">
              <span>
                {documentsComplete ? 'Documents complets' : `${missingDocuments.length} à ajouter`}
              </span>
              <span className="tabular-nums">{Math.round(progressPercent)} %</span>
            </div>

            <p className="mt-4 text-xs leading-relaxed text-ink-muted">
              Vous pouvez modifier vos données avant l’envoi final.
            </p>
          </Card>

          <div className="rounded-card border border-info-border bg-info-bg p-4">
            <p className="flex items-start gap-2 text-xs leading-relaxed text-info">
              <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>
                Remplir ce formulaire ne signifie pas que votre demande a été envoyée. L’envoi a lieu
                à l’étape de validation.
              </span>
            </p>
          </div>
        </aside>
      </div>
    </>
  )
}
