'use client'

import { useRef, useState, useTransition } from 'react'
import { AlertCircle, CheckCircle2, FileText, Loader2, Trash2, Upload, UploadCloud } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { formatBytes } from '@/lib/utils/format'
import { UPLOAD_RULES } from '@/lib/constants'
import { validateUpload } from '@/lib/validation/files'

/**
 * FileUploader — drag-and-drop dropzone matching mockup 07.
 *
 * Security notes:
 *  - extension/MIME/size are checked here for instant feedback, then checked
 *    AGAIN on the server with the real bytes (see lib/validation/files.ts and
 *    the uploadDocument server action). The client check is UX, not security.
 *  - the file is never rendered inline; downloads always go through an
 *    authorization-checked server route with `Content-Disposition: attachment`.
 */

const ACCEPT = '.pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg'

export function FileUploader({
  onUpload,
  disabled = false,
  disabledReason,
  label = 'Glissez-déposez vos documents ici',
  hint,
}: {
  /** Performs the real upload. Throwing surfaces the error in the dropzone. */
  onUpload: (file: File) => Promise<void>
  disabled?: boolean
  disabledReason?: string
  label?: string
  hint?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const [uploadingName, setUploadingName] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const busy = uploadingName !== null || isPending

  const handleFiles = (files: FileList | null) => {
    setLocalError(null)
    const file = files?.[0]
    if (!file) return

    const check = validateUpload({
      filename: file.name,
      size: file.size,
      declaredMimeType: file.type || undefined,
    })

    if (!check.ok) {
      setLocalError(check.error)
      if (inputRef.current) inputRef.current.value = ''
      return
    }

    setUploadingName(file.name)
    startTransition(async () => {
      try {
        await onUpload(file)
      } catch (error) {
        setLocalError(
          error instanceof Error && error.message
            ? error.message
            : 'Le téléversement a échoué. Veuillez réessayer.',
        )
      } finally {
        setUploadingName(null)
        if (inputRef.current) inputRef.current.value = ''
      }
    })
  }

  const maxMb = UPLOAD_RULES.maxBytes / (1024 * 1024)

  return (
    <div>
      <div
        onDragOver={(event) => {
          if (disabled || busy) return
          event.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault()
          setDragging(false)
          if (disabled || busy) return
          handleFiles(event.dataTransfer.files)
        }}
        className={cn(
          'relative flex flex-col items-center justify-center rounded-card border-2 border-dashed px-6 py-10 text-center transition-colors',
          dragging ? 'border-primary-500 bg-primary-50' : 'border-border-strong bg-canvas/60',
          (disabled || busy) && 'opacity-70',
        )}
      >
        <span
          aria-hidden="true"
          className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-primary-50 text-primary-600"
        >
          {busy ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <UploadCloud className="h-5 w-5" />
          )}
        </span>

        <p className="text-sm font-semibold text-ink">
          {busy ? `Téléversement de ${uploadingName}…` : label}
        </p>
        <p className="mt-1 text-xs text-ink-muted">
          {hint ?? `ou sélectionnez les fichiers depuis votre appareil`}
        </p>

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={disabled || busy}
          className="sf-btn-secondary mt-4"
        >
          <Upload className="h-4 w-4" aria-hidden="true" />
          Parcourir mes fichiers
        </button>

        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="sf-sr-only"
          onChange={(event) => handleFiles(event.target.files)}
          disabled={disabled || busy}
          aria-label="Sélectionner un fichier à téléverser"
        />

        <p className="mt-3 text-2xs text-ink-subtle">
          Formats acceptés : PDF, PNG, JPG · Taille maximale : {maxMb} Mo
        </p>
      </div>

      {disabled && disabledReason && (
        <p className="mt-2.5 flex items-start gap-1.5 text-xs text-ink-muted">
          <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {disabledReason}
        </p>
      )}

      {localError && (
        <p role="alert" className="sf-error mt-2.5">
          <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {localError}
        </p>
      )}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Document row                                                                */
/* -------------------------------------------------------------------------- */

export type DocumentRowItem = {
  id: string
  documentType: string
  label: string
  originalName: string | null
  bytes: number | null
  uploadedAt: string | null
  /** Public URL to the authorization-checked download route. */
  downloadHref: string | null
}

export function DocumentRow({
  item,
  onDelete,
  canDelete,
  busy,
}: {
  item: DocumentRowItem
  onDelete?: () => void
  canDelete: boolean
  busy?: boolean
}) {
  const uploaded = Boolean(item.originalName)

  return (
    <li className="flex flex-col gap-3 border-t border-border px-1 py-3.5 first:border-t-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <span
          aria-hidden="true"
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
            uploaded ? 'bg-primary-50 text-primary-600' : 'bg-warning-bg text-warning',
          )}
        >
          <FileText className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-ink">
            {item.originalName ?? item.label}
          </p>
          <p className="mt-0.5 truncate text-xs text-ink-muted">
            {uploaded ? (
              <>
                {item.label}
                {item.bytes != null && <> · PDF {formatBytes(item.bytes)}</>}
              </>
            ) : (
              'Document à joindre si disponible'
            )}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2 pl-12 sm:pl-0">
        {uploaded ? (
          <>
            <span className="sf-badge border-success-border bg-success-bg text-success">
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
              Ajouté
            </span>
            {item.downloadHref && (
              <>
                <a
                  href={`${item.downloadHref}?preview=1`}
                  target="_blank"
                  rel="noreferrer"
                  className="sf-btn sf-btn-sm border border-border-strong bg-surface text-ink hover:bg-canvas"
                >
                  Aperçu
                </a>
                <a
                  href={item.downloadHref}
                  className="sf-icon-btn"
                  aria-label={`Télécharger ${item.originalName ?? item.label}`}
                  download
                >
                  <Upload className="h-4 w-4 rotate-180" aria-hidden="true" />
                </a>
              </>
            )}
          </>
        ) : (
          <span className="sf-badge border-warning-border bg-warning-bg text-warning">À ajouter</span>
        )}

        {uploaded && canDelete && onDelete && (
          <button
            type="button"
            onClick={onDelete}
            disabled={busy}
            aria-label={`Supprimer ${item.originalName ?? item.label}`}
            className="sf-icon-btn text-danger hover:bg-danger-bg disabled:opacity-40"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>
    </li>
  )
}

/* -------------------------------------------------------------------------- */
/* Upload progress list (used while several files are in flight)               */
/* -------------------------------------------------------------------------- */

export function UploadProgress({ name, percent }: { name: string; percent: number }) {
  return (
    <div className="flex items-center gap-3 rounded-control border border-border bg-surface px-3.5 py-2.5">
      <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary-600" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-ink">{name}</p>
        <div
          className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100"
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Progression du téléversement de ${name}`}
        >
          <div
            className="h-full rounded-full bg-primary-600 transition-[width] duration-300"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>
      <span className="shrink-0 text-xs tabular-nums text-ink-muted">{percent}%</span>
    </div>
  )
}
