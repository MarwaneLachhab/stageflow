'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Check,
  Copy,
  Loader2,
  QrCode,
  ShieldCheck,
  ShieldOff,
  Smartphone,
  Trash2,
} from 'lucide-react'
import QRCode from 'qrcode'
import { confirmTotpEnroll, startTotpEnroll, unenrollTotp } from '@/lib/auth/actions'
import { Alert } from '@/components/ui/alert'
import { Spinner } from '@/components/ui/skeleton'

export type SafetyFactorView = {
  id: string
  status: string
  friendlyName: string | null
  createdAt: string | null
}

type EnrollState = {
  factorId: string
  secret: string
  email: string | null
} | null

/**
 * MFA management panel shown when the session is NOT blocked behind its code
 * step (/securite renders the wall itself in the other case).
 *
 * Two states only, mirroring GoTrue's factor statuses:
 *   - at least one VERIFIED factor → show it with a removal control;
 *   - none → the enrolment flow (server action → QR → code → verified).
 *
 * The QR image is generated client-side ("qrcode" package) from the secret the
 * enrolment action returns: GoTrue's own SVG weighs ~360 KB, far too heavy for
 * a Server Action payload round trip.
 */
export function SecurityPanel({
  factors,
}: {
  factors: SafetyFactorView[]
}) {
  const router = useRouter()

  const verified = factors.filter((f) => f.status === 'verified')
  const hasVerified = verified.length > 0

  /* ------------------------------ enrolment ------------------------------- */

  const [enrollingState, setEnrollingState] = useState<'idle' | 'loading' | 'ready'>('idle')
  const [enroll, setEnroll] = useState<EnrollState>(null)
  const [enrollError, setEnrollError] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const handleStart = async () => {
    setEnrollError(null)
    setSuccess(null)
    setEnrollingState('loading')

    const result = await startTotpEnroll()
    setEnrollingState('idle')

    if (!result.ok) {
      setEnrollError(result.error)
      return
    }

    setEnroll(result.data)
    setCode('')
  }

  // The otpauth URI matches what an authenticator app expects, with the same
  // parameters GoTrue configures (SHA-1, 6 digits, 30 s period).
  useEffect(() => {
    if (!enroll?.secret || !enroll.email) return

    const uri =
      `otpauth://totp/StageFlow:${encodeURIComponent(enroll.email)}` +
      `?secret=${enroll.secret}&issuer=${encodeURIComponent('StageFlow')}` +
      '&algorithm=SHA1&digits=6&period=30'

    let cancelled = false
    QRCode.toDataURL(uri, { width: 208, margin: 1, errorCorrectionLevel: 'M' })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url)
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl(null)
      })

    return () => {
      cancelled = true
    }
  }, [enroll?.secret, enroll?.email])

  const handleConfirm = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!enroll) return

    setEnrollError(null)
    const normalised = code.replace(/[\s-]+/g, '')
    if (!/^\d{6}$/.test(normalised)) {
      setEnrollError('Le code doit contenir exactement 6 chiffres.')
      return
    }

    setConfirming(true)

    const result = await confirmTotpEnroll({ factorId: enroll.factorId, code: normalised })
    setConfirming(false)

    if (!result.ok) {
      setEnrollError(result.error)
      return
    }

    // Success: the factor is verified and the session upgraded. Refresh so the
    // server shows the final state (verified card) from real data.
    setEnroll(null)
    setEnrollingState('idle')
    setCode('')
    setQrDataUrl(null)
    setSuccess(result.message ?? 'La double authentification est désormais active.')
    router.refresh()
  }

  /* ------------------------------- removal -------------------------------- */

  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [unenrollError, setUnenrollError] = useState<string | null>(null)

  const handleUnenroll = async (factorId: string) => {
    setUnenrollError(null)
    setDeleting(true)

    const result = await unenrollTotp({ factorId })
    setDeleting(false)
    setPendingDeleteId(null)

    if (!result.ok) {
      setUnenrollError(result.error)
      return
    }

    setSuccess(result.message ?? 'La double authentification a été désactivée.')
    router.refresh()
  }

  return (
    <div className="space-y-5">
      {success && <Alert variant="success">{success}</Alert>}

      {hasVerified && (
        /* --------------------------- verified card -------------------------- */
        <section className="rounded-card border border-border bg-surface p-5 shadow-raised sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <span
                aria-hidden="true"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-success-bg text-success"
              >
                <ShieldCheck className="h-5 w-5" />
              </span>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-semibold text-ink">Double authentification active</h2>
                  <span className="sf-badge border-success-border bg-success-bg text-success">Activée</span>
                </div>
                <p className="mt-1 text-sm text-ink-muted">
                  Une connexion à ce compte exige un mot de passe ET un code généré sur
                  votre appareil.
                </p>
              </div>
            </div>
          </div>

          <ul className="mt-4 space-y-2.5">
            {verified.map((factor) => {
              const created = factor.createdAt
                ? new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long' }).format(
                    new Date(factor.createdAt),
                  )
                : null

              return (
                <li
                  key={factor.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-control border border-border bg-canvas px-3.5 py-3"
                >
                  <div className="flex items-center gap-3">
                    <span
                      aria-hidden="true"
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600"
                    >
                      <Smartphone className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="text-[13px] font-semibold text-ink">
                        {factor.friendlyName ?? 'Application d’authentification'}
                      </p>
                      <p className="text-2xs text-ink-muted">
                        {created ? `Ajoutée le ${created.toLowerCase()}` : 'Code à usage unique (TOTP)'}
                      </p>
                    </div>
                  </div>

                  {pendingDeleteId === factor.id ? (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setPendingDeleteId(null)}
                        disabled={deleting}
                        className="text-xs font-medium text-ink-muted hover:underline"
                      >
                        Annuler
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleUnenroll(factor.id)}
                        disabled={deleting}
                        className="flex items-center gap-1.5 rounded-control bg-danger px-3 py-1.5 text-xs font-semibold text-white hover:bg-danger/90 disabled:opacity-60"
                      >
                        {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                        {deleting ? 'Désactivation…' : 'Confirmer'}
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setPendingDeleteId(factor.id)
                        setSuccess(null)
                        setUnenrollError(null)
                      }}
                      className="flex items-center gap-1.5 rounded-control border border-border px-3 py-1.5 text-xs font-semibold text-danger hover:border-danger/40 hover:bg-danger-bg"
                    >
                      <ShieldOff className="h-3.5 w-3.5" aria-hidden="true" />
                      Désactiver
                    </button>
                  )}
                </li>
              )
            })}
          </ul>

          {unenrollError && <Alert variant="error">{unenrollError}</Alert>}

          <p className="mt-4 text-xs text-ink-muted">
            Vous pouvez ajouter un second appareil à tout moment — l’ancien reste actif jusqu’à sa
            désactivation.
          </p>
        </section>
      )}

      {/* ------------------------ enrolment flow ---------------------------- */}

      {!hasVerified && enrollingState === 'idle' && !enroll && (
        <section className="rounded-card border border-border bg-surface p-5 shadow-raised sm:p-6">
          <div className="flex items-start gap-3">
            <span
              aria-hidden="true"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-canvas text-ink-muted"
            >
              <ShieldOff className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-base font-semibold text-ink">
                La double authentification est désactivée
              </h2>
              <p className="mt-1 text-sm text-ink-muted">
                Votre mot de passe est votre unique protection. Activez la double
                authentification pour exiger, en plus, un code d’usage unique généré par votre
                téléphone.
              </p>
            </div>
          </div>
          <button type="button" onClick={() => void handleStart()} className="sf-btn-primary mt-4">
            Activer la double authentification
          </button>
        </section>
      )}

      {enrollingState === 'loading' && (
        <section className="rounded-card border border-border bg-surface p-8 text-center shadow-raised">
          <Spinner />
          <p className="mt-3 text-sm text-ink-muted">Préparation d’un nouveau facteur…</p>
        </section>
      )}

      {enroll && (
        <section className="rounded-card border border-border bg-surface p-5 shadow-raised sm:p-6">
          <h2 className="text-base font-semibold text-ink">Configurez votre application d’authentification</h2>
          <ol className="mt-3 space-y-1.5 text-sm text-ink-muted">
            <li>1. Scannez le QR code ci-dessous avec votre application (Google Authenticator, Authy, 1Password…).</li>
            <li>2. Saisissez le code à 6 chiffres qu’elle affiche pour confirmer.</li>
          </ol>

          <div className="mt-5 flex flex-col items-center gap-4 sm:flex-row sm:items-start">
            <div className="flex h-[240px] w-[240px] shrink-0 items-center justify-center rounded-control border border-border bg-white">
              {qrDataUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={qrDataUrl} alt="QR code à scanner avec votre application d’authentification" className="h-[208px] w-[208px]" />
              ) : (
                <QrCode className="h-8 w-8 text-ink-subtle" aria-label="Génération du QR code en cours" />
              )}
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
                Ou saisissez cette clé manuellement
              </p>
              <div className="mt-2 flex items-center gap-2 rounded-control border border-border bg-canvas px-3 py-2">
                <code className="min-w-0 flex-1 break-all text-[13px] tracking-wider text-ink">
                  {groupSecret(enroll.secret)}
                </code>
                <CopySecretButton secret={enroll.secret} />
              </div>
              <p className="mt-2 text-2xs text-ink-subtle">
                Type : TOTP (usage unique) · Algorithme : SHA-1 · 6 chiffres · période de 30 s
              </p>
            </div>
          </div>

          {enrollError && <Alert variant="error">{enrollError}</Alert>}

          <form onSubmit={handleConfirm} noValidate className="mt-5 max-w-sm space-y-3">
            <div className="min-w-0">
              <label htmlFor="enroll-code" className="sf-label">
                Code affiché par l’application
                <span className="ml-1 text-danger" aria-hidden="true">*</span>
                <span className="sf-sr-only">(obligatoire)</span>
              </label>
              <input
                id="enroll-code"
                name="code"
                type="text"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={7}
                required
                aria-required
                placeholder="000000"
                className="sf-input text-center text-lg font-semibold tracking-[0.4em]"
                disabled={confirming}
              />
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={confirming} className="sf-btn-primary flex-1">
                {confirming ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                {confirming ? 'Vérification…' : 'Confirmer l’activation'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setEnroll(null)
                  setEnrollError(null)
                  setCode('')
                }}
                disabled={confirming}
                className="rounded-control border border-border px-3.5 py-2 text-sm font-medium text-ink-muted hover:text-ink"
              >
                Annuler
              </button>
            </div>
          </form>
        </section>
      )}
    </div>
  )
}

/** "ABCD2345EFGH6789" → "ABCD 2345 EFGH 6789" — the way authenticator apps show it. */
function groupSecret(secret: string): string {
  return secret.replace(/(.{4})/g, '$1 ').trim()
}

/** Copy-to-clipboard button with instant visible feedback. */
function CopySecretButton({ secret }: { secret: string }) {
  const [copied, setCopied] = useState(false)

  const copy = useCallback(() => {
    navigator.clipboard?.writeText(secret).then(
      () => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      },
      () => setCopied(false),
    )
  }, [secret])

  return (
    <button
      type="button"
      onClick={copy}
      aria-label="Copier la clé de configuration"
      className="sf-icon-btn shrink-0"
    >
      {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
    </button>
  )
}
