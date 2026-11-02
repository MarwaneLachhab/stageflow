'use server'

import { revalidatePath } from 'next/cache'
import { fail, ok, requireSession } from '@/lib/auth/rate-limit'
import { markAllNotificationsRead, markNotificationRead } from '@/lib/db/stagiaire'
import type { ActionResult } from '@/lib/auth/types'

/**
 * Notification actions.
 *
 * Both roles share the same centre, so the only guard needed is a valid
 * session. Ownership is enforced twice: `recipient_id` in the query and the
 * `notifications_update_own` RLS policy. A stagiaire therefore cannot mark an
 * administrator's notification as read, even by guessing its id.
 */

function revalidateNotificationSurfaces() {
  revalidatePath('/stagiaire/notifications')
  revalidatePath('/admin/notifications')
  revalidatePath('/stagiaire/tableau-de-bord')
  revalidatePath('/admin/tableau-de-bord')
}

export async function markAsRead(id: string): Promise<ActionResult<null>> {
  const session = await requireSession()
  if (!session.ok) return session.result

  if (typeof id !== 'string' || id.length === 0 || id.length > 64) {
    return fail('Notification introuvable.')
  }

  const updated = await markNotificationRead(id, session.user.id)
  if (!updated) return fail('La notification n’a pas pu être mise à jour.')

  revalidateNotificationSurfaces()
  return ok(null)
}

export async function markAllAsRead(): Promise<ActionResult<null>> {
  const session = await requireSession()
  if (!session.ok) return session.result

  const updated = await markAllNotificationsRead(session.user.id)
  if (!updated) return fail('Les notifications n’ont pas pu être mises à jour.')

  revalidateNotificationSurfaces()
  return ok(null, 'Toutes les notifications sont marquées comme lues.')
}
