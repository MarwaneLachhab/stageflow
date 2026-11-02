import { createClient } from '@/lib/supabase/server'

export async function getSupportTickets(userId: string, admin = false) {
  const supabase = await createClient()
  let query = supabase.from('support_tickets').select('*').order('updated_at', { ascending: false })
  if (!admin) query = query.eq('requester_id', userId)
  const { data, error } = await query
  if (error) {
    console.error('[stageflow] support ticket lookup failed', error.message)
    return []
  }
  return data ?? []
}

export async function getSupportMessages(ticketId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('support_messages')
    .select('*')
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: true })
  if (error) return []
  return data ?? []
}
