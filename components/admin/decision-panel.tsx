'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Eye, Loader2, Lock, XCircle } from 'lucide-react'
import { Card, CardSectionTitle } from '@/components/ui/card'
import { Alert } from '@/components/ui/alert'
import { Modal } from '@/components/ui/modal'
import { Spinner } from '@/components/ui/skeleton'
import { TextareaField } from '@/components/ui/form-field'
import { useToast } from '@/components/ui/toast'
import { cn } from '@/lib/utils/cn'
import { startReview, decideApplication } from '@/lib/actions/admin'
import type { ApplicationStatus } from '@/lib/constants'

/**
 * SCREEN 11 — decision panel.
 *
 * Design decisions worth stating explicitly:
 *
 *  - A refusal reason is MANDATORY. The `Décision` button stays disabled until a
 *    reason of at least 10 characters is typed, and the same rule is enforced by
 *    Zod on the server and by a CHECK constraint in Postgres. The reason is the
 *    only thing the candidate reads about the outcome.
 *
 *  - `expectedStatus` is sent with every mutation. If another administrator
 *    decided the same file in the meantime the database rejects the call, and we
 *    surface "actualisez la page" instead of silently overwriting their work.
 *
 *  - The confirmation dialog restates the outcome and the reason, so an
 *    irreversible, candidate-visible action is never one stray click away.
 */

type Props = {
  applicationId: string
  status: ApplicationStatus
  publicReason: string | null
}

const MIN_REASON = 10

export function DecisionPanel({ applicationId, status, publicReason }: Props) {
  const router = useRouter()
  const toast = useToast()

  const [reason, setReason] = useState(publicReason ?? '')
  const [reasonError, setReasonError] = useState<string | null>(null)
  const [pendingDecision, setPendingDecision] = useState<'ACCEPTED' | 'REJECTED' | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [startingReview, startStartReview] = useTransition()
  const [deciding, startDeciding] = useTransition()

  const isTerminal = status === 'ACCEPTED' || status === 'REJECTED'
  const canStartReview = status === 'SUBMITTED'
  const canDecide = status === 'SUBMITTED' || status === 'UNDER_REVIEW'
  const busy = startingReview || deciding

  const trimmedReason = reason.trim()
  const reasonValid = trimmedReason.length >= MIN_REASON

  const openConfirmation = (decision: 'ACCEPTED' | 'REJECTED') => {
    setActionError(null)

    if (!reasonValid) {
      setReasonError(
        `Le motif doit contenir au moins ${MIN_REASON} caractères. Il sera communiqué au candidat.`,
      )
      return
    }

    setReasonError(null)
    setPendingDecision(decision)
  }

  const handleStartReview = () => {
    setActionError(null)
    startStartReview(async () => {
      const result = await startReview({ applicationId, expectedStatus: status })
      if (!result.ok) {
        setActionError(result.error)
        toast.error('Action impossible', result.error)
        return
      }
      toast.success('Statut mis à jour', result.message ?? 'Le dossier est en examen.')
      router.refresh()
    })
  }

  const handleConfirmDecision = () => {
    if (!pendingDecision) return
    const decision = pendingDecision

    startDeciding(async () => {
      const result = await decideApplication({
        applicationId,
        decision,
        publicReason: trimmedReason,
        expectedStatus: status,
      })

      if (!result.ok) {
        setActionError(result.error)
        setPendingDecision(null)
        toast.error('Décision refusée', result.error)
        router.refresh()
        return
      }

      setPendingDecision(null)
      toast.success(
        decision === 'ACCEPTED' ? 'Demande acceptée' : 'Demande refusée',
        result.message ?? 'La décision a été enregistrée.',
      )
      router.refresh()
    })
  }

  /* ------------------------------------------------------------------ */
  /* Already decided: read-only summary                                  */
  /* ------------------------------------------------------------------ */
  if (isTerminal) {
    const accepted = status === 'ACCEPTED'

    return (
      <Card className="p-5 sm:p-6">
        <CardSectionTitle className="mb-4 flex items-center gap-2">
          <Lock className="h-4 w-4 text-ink-muted" aria-hidden="true" />
          Décision rendue
        </CardSectionTitle>

        <div
          className={cn(
            'rounded-control border p-4',
            accepted
              ? 'border-success-border bg-success-bg'
              : 'border-danger-border bg-danger-bg',
          )}
        >
          <p
            className={cn(
              'flex items-center gap-2 text-sm font-bold',
              accepted ? 'text-success' : 'text-danger',
            )}
          >
            {accepted ? (
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            ) : (
              <XCircle className="h-4 w-4" aria-hidden="true" />
            )}
            {accepted ? 'Demande acceptée' : 'Demande refusée'}
          </p>

          {publicReason && (
            <>
              <p className="mt-3 text-2xs font-semibold uppercase tracking-[0.1em] text-ink-subtle">
                Motif communiqué au candidat
              </p>
              <p className="mt-1 whitespace-pre-line text-[13px] leading-relaxed text-ink-muted">
                {publicReason}
              </p>
            </>
          )}
        </div>

        <p className="mt-4 text-2xs leading-relaxed text-ink-subtle">
          Cette demande est clôturée : une décision définitive ne peut pas être modifiée depuis cette
          interface.
        </p>
      </Card>
    )
  }

  /* ------------------------------------------------------------------ */
  /* Decidable: actions + reason + confirmation                          */
  /* ------------------------------------------------------------------ */
  return (
    <>
      <Card className="p-5 sm:p-6">
        <CardSectionTitle className="mb-4">Traitement de la demande</CardSectionTitle>

        {actionError && (
          <Alert variant="error" className="mb-4" title="Action impossible">
            {actionError}
          </Alert>
        )}

        {/* Step 1 — claim the file so the candidate sees it is being handled. */}
        {canStartReview && (
          <div className="mb-5 rounded-control border border-info-border bg-info-bg p-4">
            <p className="text-sm font-semibold text-info">Étape 1 — Prendre en charge</p>
            <p className="mt-1 text-[13px] leading-relaxed text-info/90">
              Marquez la demande comme « en cours d’examen » pour indiquer au candidat que son
              dossier est en traitement.
            </p>
            <button
              type="button"
              onClick={handleStartReview}
              disabled={busy}
              className="sf-btn sf-btn-secondary mt-3"
            >
              {startingReview ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Eye className="h-4 w-4" aria-hidden="true" />
              )}
              Passer en cours d’examen
            </button>
          </div>
        )}

        {/* Step 2 — the decision, with its mandatory justification. */}
        <div className="rounded-control border border-border p-4">
          <p className="text-sm font-semibold text-ink">
            {canStartReview ? 'Étape 2 — Rendre la décision' : 'Rendre la décision'}
          </p>
          <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">
            La décision est <strong className="font-semibold text-ink">définitive</strong> et
            immédiatement visible par le candidat. Le motif saisi lui sera communiqué.
          </p>

          <div className="mt-4">
            <TextareaField
              name="publicReason"
              label="Motif de la décision"
              required
              rows={5}
              value={reason}
              onChange={(event) => {
                const next = event.target.value
                setReason(next)
                if (reasonError && next.trim().length >= MIN_REASON) setReasonError(null)
              }}
              placeholder={
                canDecide
                  ? 'Expliquez la décision en des termes clairs et respectueux. Ce texte sera lu par le candidat.'
                  : ''
              }
              hint="Au moins 10 caractères. Restez factuel et courtois."
              error={reasonError ?? undefined}
              maxLength={1000}
              showCount
              disabled={!canDecide || busy}
            />
          </div>

          <div className="mt-5 flex flex-col gap-2.5 sm:flex-row">
            <button
              type="button"
              onClick={() => openConfirmation('ACCEPTED')}
              disabled={!canDecide || busy || !reasonValid}
              className="sf-btn sf-btn-success flex-1"
            >
              {deciding && pendingDecision === 'ACCEPTED' ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              )}
              Accepter la demande
            </button>

            <button
              type="button"
              onClick={() => openConfirmation('REJECTED')}
              disabled={!canDecide || busy || !reasonValid}
              className="sf-btn sf-btn-danger flex-1"
            >
              {deciding && pendingDecision === 'REJECTED' ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <XCircle className="h-4 w-4" aria-hidden="true" />
              )}
              Refuser la demande
            </button>
          </div>

          {!reasonValid && (
            <p className="mt-3 flex items-start gap-1.5 text-2xs leading-relaxed text-ink-subtle">
              <Lock className="mt-px h-3 w-3 shrink-0" aria-hidden="true" />
              Les deux boutons se déverrouillent dès qu’un motif d’au moins {MIN_REASON} caractères
              est saisi.
            </p>
          )}
        </div>
      </Card>

      {/* ---------------- Confirmation dialog ---------------- */}
      <Modal
        open={pendingDecision !== null}
        onClose={() => (deciding ? undefined : setPendingDecision(null))}
        title={
          pendingDecision === 'ACCEPTED'
            ? 'Confirmer l’acceptation'
            : 'Confirmer le refus de la demande'
        }
        description="Cette action est définitive et sera immédiatement visible par le candidat."
        busy={deciding}
        footer={
          <>
            <button
              type="button"
              onClick={() => setPendingDecision(null)}
              disabled={deciding}
              className="sf-btn sf-btn-secondary"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={handleConfirmDecision}
              disabled={deciding}
              className={cn(
                'sf-btn',
                pendingDecision === 'ACCEPTED' ? 'sf-btn-success' : 'sf-btn-danger',
              )}
            >
              {deciding ? (
                <Spinner className="h-4 w-4" />
              ) : pendingDecision === 'ACCEPTED' ? (
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              ) : (
                <XCircle className="h-4 w-4" aria-hidden="true" />
              )}
              {pendingDecision === 'ACCEPTED' ? 'Accepter définitivement' : 'Refuser définitivement'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div
            className={cn(
              'rounded-control border p-3.5',
              pendingDecision === 'ACCEPTED'
                ? 'border-success-border bg-success-bg'
                : 'border-danger-border bg-danger-bg',
            )}
          >
            <p className="text-[13px] font-semibold text-ink">
              {pendingDecision === 'ACCEPTED'
                ? 'Le candidat verra : « Votre demande de stage a été acceptée ».'
                : 'Le candidat verra : « Votre demande n’a pas été retenue », accompagné du motif ci-dessous.'}
            </p>
          </div>

          <div>
            <p className="text-2xs font-semibold uppercase tracking-[0.1em] text-ink-subtle">
              Motif communiqué
            </p>
            <p className="mt-1.5 whitespace-pre-line rounded-control border border-border bg-canvas p-3 text-[13px] leading-relaxed text-ink">
              {trimmedReason}
            </p>
          </div>

          <p className="text-2xs leading-relaxed text-ink-subtle">
            Une fois confirmée, la décision ne peut plus être modifiée depuis cette interface.
          </p>
        </div>
      </Modal>
    </>
  )
}
