'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireRole, fail, failSafe, ok } from '@/lib/auth/rate-limit'
import { offerSchema, organizationSchema } from '@/lib/validation/offers'
import type { ActionResult } from '@/lib/auth/types'

export async function createOrganization(input: unknown): Promise<ActionResult<{ id: string }>> {
  const session = await requireRole('admin')
  if (!session.ok) return session.result
  const parsed = organizationSchema.safeParse(input)
  if (!parsed.success) return fail('Informations d’établissement invalides.')
  const supabase = await createClient()
  const { data, error } = await supabase.from('organizations').insert({
    name: parsed.data.name,
    kind: parsed.data.kind,
    description: parsed.data.description,
    website: parsed.data.website || null,
    email: parsed.data.email || null,
    phone: parsed.data.phone || null,
    address: parsed.data.address || null,
    city: parsed.data.city || null,
    logo_url: parsed.data.logoUrl || null,
    created_by: session.user.id,
  }).select('id').single()
  if (error || !data) return failSafe(error, 'L’établissement n’a pas pu être créé.')
  revalidatePath('/admin/offres')
  return ok({ id: data.id }, 'Établissement créé.')
}

export async function createOffer(input: unknown): Promise<ActionResult<null>> {
  const session = await requireRole('admin')
  if (!session.ok) return session.result
  const parsed = offerSchema.safeParse(input)
  if (!parsed.success) return fail('Veuillez corriger les informations de l’offre.')
  const data = parsed.data
  const supabase = await createClient()
  const { error } = await supabase.from('internship_offers').insert({
    organization_id: data.organizationId,
    title: data.title,
    description: data.description,
    domain: data.domain,
    stage_type: data.stageType,
    mode: data.mode,
    city: data.city || null,
    starts_on: data.startsOn || null,
    ends_on: data.endsOn || null,
    deadline: data.deadline || null,
    capacity: data.capacity,
    published: data.published,
    created_by: session.user.id,
  })
  if (error) return failSafe(error, 'L’offre n’a pas pu être publiée.')
  revalidatePath('/offres')
  revalidatePath('/admin/offres')
  return ok(null, data.published ? 'Offre publiée.' : 'Offre enregistrée en brouillon.')
}
