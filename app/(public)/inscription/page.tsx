import Link from 'next/link'
import { redirect } from 'next/navigation'
import { AuthLayout } from '@/components/public/auth-layout'
import { SignUpForm } from '@/components/public/sign-up-form'
import { getSessionUser, homeRouteForRole } from '@/lib/auth/session'

export const metadata = {
  title: 'Créer un compte',
  description: 'Créez votre espace stagiaire StageFlow en quelques instants.',
}

export default async function InscriptionPage() {
  // Already signed in? Go straight to the right workspace.
  const user = await getSessionUser()
  if (user) redirect(homeRouteForRole(user.role))

  return (
    <AuthLayout
      eyebrow="Bienvenue sur StageFlow"
      title="Créer un compte"
      subtitle="Rejoignez la plateforme et lancez votre demande de stage."
      topRight={
        <p className="text-sm text-ink-muted">
          Vous avez déjà un compte ?{' '}
          <Link href="/connexion" className="font-semibold text-primary-600 hover:underline">
            Se connecter
          </Link>
        </p>
      }
      footer={
        <p className="text-center text-xs leading-relaxed text-ink-subtle">
          En créant votre compte, vous acceptez les{' '}
          <Link href="/conditions-utilisation" className="text-primary-600 hover:underline">
            conditions d’utilisation
          </Link>{' '}
          et la{' '}
          <Link href="/confidentialite" className="text-primary-600 hover:underline">
            politique de confidentialité
          </Link>
          .
        </p>
      }
    >
      <SignUpForm />
    </AuthLayout>
  )
}
