'use client'

import { useEffect, useRef, useCallback } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { Spinner } from '@/components/ui/skeleton'

/**
 * Accessible modal dialog.
 *
 * Implements the behaviours the QA checklist tests for:
 *  - role="dialog" + aria-modal + a labelled title
 *  - Escape closes (unless the action is busy)
 *  - focus is moved into the dialog and returned to the trigger on close
 *  - Tab is trapped inside the dialog
 *  - background scroll is locked
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  /** Blocks Escape/backdrop dismissal while a submission is in flight. */
  busy = false,
}: {
  open: boolean
  onClose: () => void
  title: string
  description?: React.ReactNode
  children?: React.ReactNode
  footer?: React.ReactNode
  size?: 'sm' | 'md' | 'lg'
  busy?: boolean
}) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const previouslyFocused = useRef<HTMLElement | null>(null)

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key !== 'Tab' || !dialogRef.current) return

      const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )
      if (focusables.length === 0) return

      const first = focusables[0]!
      const last = focusables[focusables.length - 1]!

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    },
    [busy, onClose],
  )

  useEffect(() => {
    if (!open) return

    previouslyFocused.current = document.activeElement as HTMLElement | null

    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    document.addEventListener('keydown', handleKeyDown)

    // Move focus to the first interactive element, or the panel itself.
    const timer = window.setTimeout(() => {
      const target =
        dialogRef.current?.querySelector<HTMLElement>(
          'input:not([type="hidden"]), textarea, select, button:not([disabled])',
        ) ?? dialogRef.current
      target?.focus()
    }, 30)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = originalOverflow
      window.clearTimeout(timer)
      previouslyFocused.current?.focus?.()
    }
  }, [open, handleKeyDown])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button
        type="button"
        aria-label="Fermer la fenêtre"
        tabIndex={-1}
        onClick={() => !busy && onClose()}
        className="absolute inset-0 cursor-default bg-ink/45 backdrop-blur-[2px]"
      />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sf-modal-title"
        aria-describedby={description ? 'sf-modal-description' : undefined}
        tabIndex={-1}
        className={cn(
          'relative z-10 flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl bg-surface shadow-overlay animate-fade-in sm:rounded-card',
          size === 'sm' && 'sm:max-w-md',
          size === 'md' && 'sm:max-w-lg',
          size === 'lg' && 'sm:max-w-2xl',
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <h2 id="sf-modal-title" className="text-base font-semibold text-ink">
              {title}
            </h2>
            {description && (
              <p id="sf-modal-description" className="mt-1 text-sm leading-relaxed text-ink-muted">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Fermer"
            className="sf-icon-btn -mr-1 shrink-0 disabled:opacity-40"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        <div className="sf-scrollbar-thin flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>

        {footer && (
          <div className="flex flex-col-reverse gap-2.5 border-t border-border bg-canvas px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Confirmation dialog used before irreversible actions.
 * `tone="danger"` colours the confirm button red.
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Annuler',
  tone = 'primary',
  busy = false,
  children,
}: {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  description?: React.ReactNode
  confirmLabel: string
  cancelLabel?: string
  tone?: 'primary' | 'danger' | 'success'
  busy?: boolean
  children?: React.ReactNode
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      busy={busy}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={busy} className="sf-btn-secondary">
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={cn(
              tone === 'danger' && 'sf-btn-danger',
              tone === 'success' && 'sf-btn-success',
              tone === 'primary' && 'sf-btn-primary',
            )}
          >
            {busy && <Spinner />}
            {confirmLabel}
          </button>
        </>
      }
    >
      {children}
    </Modal>
  )
}
