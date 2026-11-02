'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireSession, requireRole, fail, failSafe, ok } from '@/lib/auth/rate-limit'
import { supportMessageSchema, supportTicketSchema } from '@/lib/validation/support'
import type { ActionResult } from '@/lib/auth/types'

export async function createSupportTicket(input: unknown): Promise<ActionResult<{ id: string }>> {
  const session = await requireSession()
  if (!session.ok) return session.result
  const parsed = supportTicketSchema.safeParse(input)
  if (!parsed.success) return fail('Veuillez corriger les champs du ticket.')

  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('support_tickets')
      .insert({ ...parsed.data, requester_id: session.user.id })
      .select('id')
      .single()
    if (error || !data) return failSafe(error, 'Le ticket n’a pas pu être créé.')
    revalidatePath('/stagiaire/support')
    revalidatePath('/admin/support')
    return ok({ id: data.id }, 'Votre demande a été envoyée au support.')
  } catch (error) {
    return failSafe(error, 'Le ticket n’a pas pu être créé.')
  }
}

export async function addSupportMessage(input: unknown): Promise<ActionResult<null>> {
  const session = await requireSession()
  if (!session.ok) return session.result
  const parsed = supportMessageSchema.safeParse(input)
  if (!parsed.success) return fail('Message invalide.')
  try {
    const supabase = await createClient()
    const { error } = await supabase.from('support_messages').insert({
      ticket_id: parsed.data.ticketId,
      author_id: session.user.id,
      body: parsed.data.body,
    })
    if (error) return failSafe(error, 'Le message n’a pas pu être envoyé.')
    revalidatePath('/stagiaire/support')
    revalidatePath('/admin/support')
    return ok(null, 'Message envoyé.')
  } catch (error) {
    return failSafe(error, 'Le message n’a pas pu être envoyé.')
  }
}

export async function updateSupportTicketStatus(input: { ticketId: string; status: string }): Promise<ActionResult<null>> {
  const session = await requireRole('admin')
  if (!session.ok) return session.result
  if (!/^[0-9a-f-]{36}$/i.test(input.ticketId) || !['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'].includes(input.status)) {
    return fail('Statut invalide.')
  }
  const supabase = await createClient()
  const { error } = await supabase.from('support_tickets').update({ status: input.status }).eq('id', input.ticketId)
  if (error) return failSafe(error, 'Le statut n’a pas pu être mis à jour.')
  revalidatePath('/admin/support')
  revalidatePath('/stagiaire/support')
  return ok(null, 'Statut mis à jour.')
}
