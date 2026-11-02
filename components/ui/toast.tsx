'use client'

import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

/**
 * Toast notifications.
 *
 * Deliberately small and dependency-free. Toasts are announced through an
 * `aria-live` region so a screen-reader user hears "Profil enregistré" without
 * having to hunt for it.
 */

export type ToastTone = 'success' | 'error' | 'info'

export type Toast = {
  id: string
  tone: ToastTone
  title: string
  description?: string
}

type ToastContextValue = {
  toast: (input: Omit<Toast, 'id'>) => void
  success: (title: string, description?: string) => void
  error: (title: string, description?: string) => void
  info: (title: string, description?: string) => void
  dismiss: (id: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((t) => t.id !== id))
  }, [])

  const toast = useCallback(
    (input: Omit<Toast, 'id'>) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      setToasts((current) => [...current.slice(-3), { ...input, id }])
      // Errors stay longer: the user needs time to read them.
      const ttl = input.tone === 'error' ? 7000 : 4500
      window.setTimeout(() => dismiss(id), ttl)
    },
    [dismiss],
  )

  const value = useMemo<ToastContextValue>(
    () => ({
      toast,
      dismiss,
      success: (title, description) => toast({ tone: 'success', title, description }),
      error: (title, description) => toast({ tone: 'error', title, description }),
      info: (title, description) => toast({ tone: 'info', title, description }),
    }),
    [toast, dismiss],
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        role="region"
        aria-label="Notifications"
        className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-2.5"
      >
        <div aria-live="polite" aria-atomic="false" className="flex flex-col gap-2.5">
          {toasts.map((t) => (
            <ToastItem key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
          ))}
        </div>
      </div>
    </ToastContext.Provider>
  )
}

const TONE_STYLES: Record<ToastTone, { wrapper: string; Icon: typeof CheckCircle2 }> = {
  success: { wrapper: 'border-success-border bg-success-bg text-success', Icon: CheckCircle2 },
  error: { wrapper: 'border-danger-border bg-danger-bg text-danger', Icon: AlertCircle },
  info: { wrapper: 'border-info-border bg-info-bg text-info', Icon: Info },
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const { wrapper, Icon } = TONE_STYLES[toast.tone]

  return (
    <div
      className={cn(
        'pointer-events-auto flex items-start gap-3 rounded-card border p-3.5 shadow-raised animate-slide-in-right',
        wrapper,
      )}
    >
      <Icon className="mt-0.5 h-4.5 w-4.5 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{toast.title}</p>
        {toast.description && (
          <p className="mt-0.5 text-[13px] leading-relaxed opacity-90">{toast.description}</p>
        )}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Fermer la notification"
        className="-mr-1 -mt-0.5 rounded-md p-1 transition-colors hover:bg-black/5"
      >
        <X className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </div>
  )
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used inside <ToastProvider>.')
  }
  return context
}
