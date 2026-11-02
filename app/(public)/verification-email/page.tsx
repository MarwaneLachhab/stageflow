import { AuthLayout } from '@/components/public/auth-layout'
import { EmailLinkForm } from '@/components/public/email-link-form'
import { EmailOtpForm } from '@/components/public/email-otp-form'

export const metadata = {
  title: 'Vérification de l’adresse e-mail',
  robots: { index: false, follow: false },
}

export default async function VerificationEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>
}) {
  const params = await searchParams
  const initialEmail = params.email ?? ''
  return (
    <AuthLayout
      eyebrow="Confirmation du compte"
      title="Vérifiez votre adresse e-mail"
      subtitle="Si la confirmation par e-mail est activée sur cette instance, un lien d’activation vous a été envoyé lors de votre inscription."
      asideTitle={
        <>
          Une dernière étape <span className="text-primary-600">avant de commencer.</span>
        </>
      }
      asideSubtitle="La confirmation de votre adresse protège votre compte : sans elle, quelqu’un pourrait s’inscrire avec votre adresse par erreur."
    >
      <div className="space-y-5">
        <EmailOtpForm initialEmail={initialEmail} />

        <div className="flex items-center gap-3 text-xs text-ink-subtle">
          <span className="h-px flex-1 bg-border" />
          <span>ou demander un lien</span>
          <span className="h-px flex-1 bg-border" />
        </div>

        <div className="rounded-control border border-border bg-canvas p-4 text-sm leading-relaxed text-ink-muted">
          <p className="font-semibold text-ink">Vous n’avez pas reçu l’e-mail ?</p>
          <ul className="mt-2 list-inside list-disc space-y-1 text-[13px]">
            <li>Vérifiez votre dossier « Courrier indésirable » ou « Spam ».</li>
            <li>Assurez-vous que l’adresse saisie est exacte.</li>
            <li>Patientez une minute avant de demander un nouvel envoi.</li>
          </ul>
        </div>

        <EmailLinkForm
          mode="resend"
          submitLabel="Renvoyer l’e-mail de confirmation"
          successTitle="Envoi demandé"
          successBody="Si un compte attend une confirmation pour cette adresse, un nouvel e-mail vient d’être envoyé."
        />
      </div>
    </AuthLayout>
  )
}
