import Link from 'next/link'
import { ArrowLeft, FileText } from 'lucide-react'
import { Logo } from '@/components/ui/logo'
import { BRAND } from '@/lib/constants'

/**
 * ⚠️ DRAFT CONTENT — REQUIRES OWNER AND LEGAL REVIEW.
 *
 * This page is deliberately written as a clearly-labelled draft template. It
 * does not claim compliance with any specific regulation and must be reviewed
 * by the organisation (and its legal adviser) before going live. Moroccan law
 * 09-08 on the protection of personal data and, where applicable, the GDPR are
 * the relevant frameworks to assess.
 */
export default function ConditionsUtilisationPage() {
  return (
    <LegalPage
      title="Conditions d’utilisation"
      updatedAt="Version préliminaire — à valider"
      intro={`Ces conditions encadrent l’utilisation de la plateforme ${BRAND.name}, destinée à la gestion des demandes de stage.`}
    >
      <DraftNotice />

      <Section title="1. Objet de la plateforme">
        <p>
          {BRAND.name} est un outil interne de gestion des candidatures de stage. Il permet à un
          candidat de créer un compte, de constituer un dossier de demande de stage, de joindre des
          pièces justificatives et de suivre l’avancement de sa candidature.
        </p>
        <p>
          La plateforme ne publie pas d’offres d’emploi et ne met pas en relation candidats et
          recruteurs tiers. Elle ne constitue ni une offre de stage, ni un engagement d’acceptation.
        </p>
      </Section>

      <Section title="2. Compte utilisateur">
        <p>
          L’accès à l’espace personnel nécessite la création d’un compte avec une adresse e-mail
          valide. L’utilisateur s’engage à fournir des informations exactes et à les maintenir à
          jour.
        </p>
        <p>
          Le mot de passe est personnel et confidentiel. L’utilisateur est responsable de la
          confidentialité de ses identifiants et doit signaler toute utilisation non autorisée de
          son compte.
        </p>
      </Section>

      <Section title="3. Types de comptes et droits d’accès">
        <p>La plateforme distingue deux profils :</p>
        <ul>
          <li>
            <strong>Stagiaire</strong> : accès à son propre profil, à sa propre demande et à ses
            propres documents. Aucun accès aux dossiers d’autres candidats ni aux fonctions
            d’administration.
          </li>
          <li>
            <strong>Administrateur</strong> : accès à l’ensemble des demandes, aux pièces
            justificatives nécessaires à l’étude du dossier et aux fonctions de décision.
          </li>
        </ul>
        <p>
          Les droits d’administration sont attribués exclusivement par un opérateur habilité. Ils ne
          peuvent pas être obtenus par une inscription publique.
        </p>
      </Section>

      <Section title="4. Contenu déposé">
        <p>
          L’utilisateur garantit détenir les droits nécessaires sur les documents qu’il dépose et
          s’engage à ne transmettre aucun contenu illicite, trompeur ou portant atteinte aux droits
          de tiers.
        </p>
        <p>
          Le dépôt de documents malveillants, l’introduction de code ou toute tentative de
          contournement des mesures de sécurité est interdit.
        </p>
      </Section>

      <Section title="5. Usage acceptable">
        <ul>
          <li>Ne pas tenter d’accéder aux données d’un autre utilisateur.</li>
          <li>Ne pas usurper l’identité d’un tiers ni créer de faux dossiers.</li>
          <li>Ne pas perturber le fonctionnement du service ni automatiser des requêtes massives.</li>
          <li>Ne pas extraire, copier ou rediffuser les données de la plateforme.</li>
        </ul>
      </Section>

      <Section title="6. Suspension et suppression">
        <p>
          Un compte peut être suspendu ou supprimé en cas de manquement à ces conditions, d’usage
          frauduleux ou sur demande de l’autorité compétente. La suppression d’un compte entraîne la
          suppression des données associées, sous réserve des obligations de conservation
          applicables.
        </p>
      </Section>

      <Section title="7. Disponibilité">
        <p>
          La plateforme est fournie « en l’état ». Des interruptions pour maintenance ou pour des
          raisons techniques peuvent survenir. Aucune garantie de disponibilité continue n’est
          accordée dans cette version.
        </p>
      </Section>

      <Section title="8. Modification des conditions">
        <p>
          Ces conditions peuvent être modifiées. La version applicable est celle publiée sur cette
          page à la date de consultation.
        </p>
      </Section>

      <Section title="9. Contact">
        <p>
          Pour toute question relative à ces conditions :{' '}
          <a href={`mailto:${BRAND.supportEmail}`} className="text-primary-600 hover:underline">
            {BRAND.supportEmail}
          </a>
          .
        </p>
      </Section>
    </LegalPage>
  )
}

/* -------------------------------------------------------------------------- */
/* Presentational helpers                                                      */
/* -------------------------------------------------------------------------- */
/*
 * These are intentionally NOT exported. A Next.js `page.tsx` may only export
 * route fields (`default`, `metadata`, `dynamic`, …); any other named export
 * makes `next build` fail with
 *   "Property 'LegalPage' is incompatible with index signature".
 * `/confidentialite` keeps its own inline markup, so nothing imports these.
 */

function LegalPage({
  title,
  updatedAt,
  intro,
  children,
}: {
  title: string
  updatedAt: string
  intro: string
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-canvas">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex h-16 max-w-[860px] items-center justify-between px-5 sm:px-8">
          <Logo />
          <Link href="/" className="sf-btn-ghost sf-btn-sm">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Accueil
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-[860px] px-5 py-10 sm:px-8 sm:py-14">
        <span className="inline-flex items-center gap-2 rounded-full bg-primary-50 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wide text-primary-700">
          <FileText className="h-3.5 w-3.5" aria-hidden="true" />
          Document juridique
        </span>

        <h1 className="mt-4 text-3xl font-bold tracking-tight text-navy sm:text-4xl">{title}</h1>
        <p className="mt-2 text-sm text-ink-subtle">{updatedAt}</p>
        <p className="mt-6 text-base leading-relaxed text-ink-muted">{intro}</p>

        <div className="mt-8 space-y-8">{children}</div>

        <div className="mt-12 rounded-card border border-border bg-surface p-5">
          <p className="text-sm leading-relaxed text-ink-muted">
            Cette page décrit également l’usage des données personnelles. Voir aussi la{' '}
            <Link href="/confidentialite" className="font-medium text-primary-600 hover:underline">
              politique de confidentialité
            </Link>{' '}
            et les{' '}
            <Link href="/conditions-utilisation" className="font-medium text-primary-600 hover:underline">
              conditions d’utilisation
            </Link>
            .
          </p>
        </div>
      </main>
    </div>
  )
}

function DraftNotice() {
  return (
    <div className="rounded-card border border-warning-border bg-warning-bg p-5">
      <p className="text-sm font-semibold text-warning">
        Document préliminaire — validation juridique requise
      </p>
      <p className="mt-2 text-[13px] leading-relaxed text-warning">
        Ce texte est un modèle de travail. Il ne constitue pas un avis juridique et ne certifie
        aucune conformité réglementaire. Il doit être relu et approuvé par le responsable du
        traitement et par un conseil juridique avant toute mise en production.
      </p>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-lg font-bold tracking-tight text-navy">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-ink-muted [&_a]:font-medium [&_li]:ml-4 [&_li]:list-disc [&_strong]:font-semibold [&_strong]:text-ink [&_ul]:space-y-1.5">
        {children}
      </div>
    </section>
  )
}
