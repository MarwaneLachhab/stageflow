import { createClient } from '@/lib/supabase/server'

export async function getPublicOffers() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('internship_offers')
    .select('*, organizations(id,name,kind,logo_url,city,website)')
    .eq('published', true)
    .order('created_at', { ascending: false })
  if (error) {
    console.error('[stageflow] public offers lookup failed', error.message)
    return []
  }
  return data ?? []
}

export async function getAdminOffers() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('internship_offers')
    .select('*, organizations(id,name,kind,city)')
    .order('created_at', { ascending: false })
  if (error) return []
  return data ?? []
}

export async function getOrganizations() {
  const supabase = await createClient()
  const { data, error } = await supabase.from('organizations').select('id,name,kind,city').eq('is_active', true).order('name')
  if (error) return []
  return data ?? []
}
