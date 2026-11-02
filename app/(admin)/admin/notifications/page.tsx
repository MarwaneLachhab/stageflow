import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/ui/page-header'
import { NotificationCenter } from '@/components/notifications/notification-center'
import { getSessionUser } from '@/lib/auth/session'
import { getNotifications } from '@/lib/db/stagiaire'

export const metadata: Metadata = { title: 'Notifications' }

/**
 * SCREEN — administration notification centre.
 *
 * Same component as the stagiaire side; RLS scopes the rows to the signed-in
 * administrator, so an admin never sees another recipient's notifications.
 */
export default async function AdminNotificationsPage() {
  const user = await getSessionUser()
  if (!user) redirect('/connexion')

  const notifications = await getNotifications(user.id)

  return (
    <>
      <PageHeader
        eyebrow="Espace administration"
        title="Notifications"
        description="Événements de la plateforme : nouvelles demandes déposées et mises à jour de dossiers."
      />
      <NotificationCenter
        notifications={notifications}
        emptyAction={
          <Link href="/admin/demandes" className="sf-btn sf-btn-secondary">
            Voir les demandes
          </Link>
        }
      />
    </>
  )
}
