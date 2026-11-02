import { AuthLayout } from '@/components/public/auth-layout'
import { ResetPasswordForm } from '@/components/public/reset-password-form'
import { Alert } from '@/components/ui/alert'
import { getSessionUser } from '@/lib/auth/session'

export const metadata = {
  title: 'Réinitialiser le mot de passe',
  robots: { index: false, follow: false },
}

/**
 * `/reinitialiser-mot-de-passe`
 *
 * Reached only after the recovery link has been exchanged for a session in
 * `/auth/callback`. Without a session there is nothing to update, so we explain
 * that clearly instead of showing a form that would always fail.
 */
export default async function ReinitialiserMotDePassePage() {
  const user = await getSessionUser()

  return (
    <AuthLayout
      eyebrow="Sécurité du compte"
      title="Nouveau mot de passe"
      subtitle="Choisissez un mot de passe robuste. Vous serez déconnecté de vos autres sessions."
      asideTitle={
        <>
          Protégez <span className="text-primary-600">votre compte.</span>
        </>
      }
      asideSubtitle="Utilisez un mot de passe unique, que vous n’employez nulle part ailleurs. Nous ne pouvons jamais le lire."
    >
      {user ? (
        <ResetPasswordForm />
      ) : (
        <Alert variant="warning" title="Lien invalide ou expiré">
          Ce lien de réinitialisation n’est plus valable. Demandez un nouveau lien depuis la page{' '}
          <a href="/mot-de-passe-oublie" className="font-semibold underline underline-offset-2">
            Mot de passe oublié
          </a>
          .
        </Alert>
      )}
    </AuthLayout>
  )
}
