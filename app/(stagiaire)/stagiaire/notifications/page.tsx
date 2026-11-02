import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/ui/page-header'
import { NotificationCenter } from '@/components/notifications/notification-center'
import { getSessionUser } from '@/lib/auth/session'
import { getNotifications } from '@/lib/db/stagiaire'

export const metadata: Metadata = { title: 'Notifications' }

/**
 * SCREEN — stagiaire notification centre.
 *
 * The bell in the top bar links here. Before this page existed the link landed
 * on a 404 while the badge showed a real unread count, so the count was visible
 * but the list was unreachable.
 */
export default async function StagiaireNotificationsPage() {
  const user = await getSessionUser()
  if (!user) redirect('/connexion')

  const notifications = await getNotifications(user.id)

  return (
    <>
      <PageHeader
        eyebrow="Espace stagiaire"
        title="Notifications"
        description="Suivez les événements liés à votre demande de stage : accusé de réception, décisions et demandes de pièces."
      />
      <NotificationCenter
        notifications={notifications}
        emptyAction={
          <Link href="/stagiaire/suivi" className="sf-btn sf-btn-secondary">
            Voir le suivi de ma demande
          </Link>
        }
      />
    </>
  )
}
