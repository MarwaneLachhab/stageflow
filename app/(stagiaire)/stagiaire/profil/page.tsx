import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { Alert } from '@/components/ui/alert'
import { ProfileForm } from '@/components/stagiaire/profile-form'
import { getSessionUser } from '@/lib/auth/session'
import { getOwnProfile } from '@/lib/db/stagiaire'

export const metadata: Metadata = { title: 'Mon profil' }

/** SCREEN 5 — profile editor shell (server data, client form). */
export default async function ProfilPage() {
  const user = await getSessionUser()
  if (!user) redirect('/connexion')

  const profile = await getOwnProfile(user.id)

  // The signup trigger provisions the profile, so a missing row means the
  // account predates it or the trigger failed. Report honestly rather than
  // rendering a form that would silently fail to save.
  if (!profile) {
    return (
      <Alert variant="warning" title="Profil indisponible">
        Votre profil n’a pas pu être chargé. Déconnectez-vous puis reconnectez-vous pour le
        réinitialiser. Si le problème persiste, contactez l’administration.
      </Alert>
    )
  }

  return <ProfileForm profile={profile} email={user.email ?? ''} />
}
