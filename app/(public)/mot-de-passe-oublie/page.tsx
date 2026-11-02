import { AuthLayout } from '@/components/public/auth-layout'
import { EmailLinkForm } from '@/components/public/email-link-form'

export const metadata = {
  title: 'Mot de passe oublié',
  robots: { index: false, follow: false },
}

export default function MotDePasseOubliePage() {
  return (
    <AuthLayout
      eyebrow="Récupération de compte"
      title="Mot de passe oublié ?"
      subtitle="Indiquez votre adresse e-mail : nous vous enverrons un lien sécurisé pour définir un nouveau mot de passe."
      asideTitle={
        <>
          Retrouvez l’accès à <span className="text-primary-600">votre espace.</span>
        </>
      }
      asideSubtitle="Le lien de réinitialisation est à usage unique et expire automatiquement. Votre mot de passe actuel reste valable jusqu’à son remplacement."
    >
      <EmailLinkForm
        mode="reset"
        submitLabel="Envoyer le lien de réinitialisation"
        successTitle="Demande envoyée"
        successBody="Si un compte est associé à cette adresse, vous recevrez un lien de réinitialisation dans quelques instants."
      />
    </AuthLayout>
  )
}
