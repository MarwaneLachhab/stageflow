'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Lock, MessageSquarePlus, ShieldAlert } from 'lucide-react'
import { Card, CardSectionTitle } from '@/components/ui/card'
import { TextareaField } from '@/components/ui/form-field'
import { useToast } from '@/components/ui/toast'
import { EmptyState } from '@/components/ui/empty-state'
import { addPrivateNote } from '@/lib/actions/admin'
import { formatDateTime } from '@/lib/utils/format'

/**
 * SCREEN 11 — internal notes.
 *
 * These notes are stored in `admin_private_notes`, which is protected by an
 * admin-only RLS policy in BOTH directions. A stagiaire — even one who guesses
 * the row id, or who issues a raw REST query against the table — receives zero
 * rows. Nothing written here can ever reach the candidate's screens, which is
 * exactly why the panel says so out loud.
 */

export type PrivateNote = {
  id: string
  body: string
  createdAt: string
}

export function PrivateNotesPanel({
  applicationId,
  notes,
}: {
  applicationId: string
  notes: PrivateNote[]
}) {
  const router = useRouter()
  const toast = useToast()
  const [body, setBody] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const trimmed = body.trim()

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (trimmed.length === 0) {
      setError('La note ne peut pas être vide.')
      return
    }

    setError(null)
    startTransition(async () => {
      const result = await addPrivateNote({ applicationId, body: trimmed })
      if (!result.ok) {
        setError(result.error)
        toast.error('Enregistrement impossible', result.error)
        return
      }
      setBody('')
      toast.success('Note enregistrée', 'Cette note reste interne à l’administration.')
      router.refresh()
    })
  }

  return (
    <Card className="p-5 sm:p-6">
      <CardSectionTitle className="mb-4 flex items-center gap-2">
        <Lock className="h-4 w-4 text-ink-muted" aria-hidden="true" />
        Notes internes
      </CardSectionTitle>

      <p className="mb-4 flex items-start gap-2 rounded-control border border-warning-border bg-warning-bg px-3.5 py-2.5 text-2xs leading-relaxed text-warning">
        <ShieldAlert className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>
          Ces notes sont strictement confidentielles. Elles ne sont jamais visibles par le candidat,
          quel que soit son statut de connexion.
        </span>
      </p>

      {/* ---------------- Existing notes ---------------- */}
      {notes.length === 0 ? (
        <EmptyState
          icon={<MessageSquarePlus className="h-6 w-6" />}
          title="Aucune note interne"
          description="Ajoutez une note pour partager une observation avec les autres administrateurs."
          tone="neutral"
          className="py-6"
        />
      ) : (
        <ul className="mb-5 max-h-[320px] space-y-3 overflow-y-auto sf-scrollbar-thin">
          {notes.map((note) => (
            <li key={note.id} className="rounded-control border border-border bg-canvas p-3.5">
              <p className="whitespace-pre-line text-[13px] leading-relaxed text-ink">
                {note.body}
              </p>
              <p className="mt-2 text-2xs text-ink-subtle">{formatDateTime(note.createdAt)}</p>
            </li>
          ))}
        </ul>
      )}

      {/* ---------------- New note ---------------- */}
      <form onSubmit={handleSubmit} noValidate>
        <TextareaField
          name="privateNote"
          label="Nouvelle note"
          rows={3}
          value={body}
          onChange={(event) => {
            setBody(event.target.value)
            if (error) setError(null)
          }}
          placeholder="Observation, point de vigilance, échange téléphonique…"
          error={error ?? undefined}
          maxLength={2000}
          showCount
          disabled={isPending}
        />

        <button
          type="submit"
          disabled={isPending || trimmed.length === 0}
          className="sf-btn sf-btn-secondary sf-btn-sm mt-3"
        >
          {isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <MessageSquarePlus className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          Ajouter la note
        </button>
      </form>
    </Card>
  )
}
