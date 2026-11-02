import type { Metadata } from 'next'
import Link from 'next/link'
import { BRAND } from '@/lib/constants'

export const metadata: Metadata = {
  title: 'Politique de confidentialité',
  robots: { index: false, follow: false },
}

/**
 * ⚠️ DRAFT CONTENT — REQUIRES OWNER AND LEGAL REVIEW.
 *
 * Written as an honest template that describes what the application ACTUALLY
 * does with personal data (verified against the schema and storage policies),
 * and flags every point that needs an organisational decision. It does not
 * claim compliance with any regulation.
 */
export default function ConfidentialitePage() {
  return (
    <div className="min-h-screen bg-canvas">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex h-16 max-w-[860px] items-center justify-between px-5 sm:px-8">
          <Link href="/" className="text-sm font-semibold text-ink">
            ← Retour à l’accueil
          </Link>
          <span className="text-xs text-ink-subtle">Version préliminaire</span>
        </div>
      </header>

      <main className="mx-auto max-w-[860px] px-5 py-10 sm:px-8 sm:py-14">
        <h1 className="text-3xl font-bold tracking-tight text-navy sm:text-4xl">
          Politique de confidentialité
        </h1>

        <div className="mt-6 rounded-card border border-warning-border bg-warning-bg p-5">
          <p className="text-sm font-semibold text-warning">
            Document préliminaire — validation juridique requise
          </p>
          <p className="mt-2 text-[13px] leading-relaxed text-warning">
            Cette page décrit le fonctionnement réel de l’application, mais elle n’a pas été validée
            par un conseil juridique et ne certifie aucune conformité. Les durées de conservation et
            les coordonnées du responsable de traitement doivent être arrêtées par l’organisation
            avant mise en production.
          </p>
        </div>

        <div className="mt-8 space-y-3 rounded-card border border-border bg-surface p-5 text-sm leading-relaxed text-ink-muted">
          <p>
            <strong className="font-semibold text-ink">Cadre applicable.</strong> Le traitement de
            données à caractère personnel relève au Maroc de la loi n° 09-08 relative à la protection
            des personnes physiques à l’égard du traitement des données à caractère personnel, placée
            sous le contrôle de la CNDP. Le RGPD peut également s’appliquer si des personnes
            concernées résident dans l’Union européenne.
          </p>
          <p>
            <strong className="font-semibold text-ink">Responsable du traitement.</strong> À
            compléter par l’organisation : dénomination, adresse, coordonnées du délégué à la
            protection des données.
          </p>
        </div>

        <div className="mt-10 space-y-8">
          <Block title="1. Données collectées">
            <p>Les données suivantes sont enregistrées par la plateforme :</p>
            <ul className="ml-4 list-inside list-disc space-y-1.5">
              <li>
                <strong className="font-semibold text-ink">Identité et contact</strong> : nom,
                prénom, adresse e-mail, numéro de téléphone.
              </li>
              <li>
                <strong className="font-semibold text-ink">Informations facultatives</strong> :
                adresse postale, ville, date de naissance, établissement, formation, niveau d’étude,
                spécialité.
              </li>
              <li>
                <strong className="font-semibold text-ink">Données de candidature</strong> : type de
                stage, domaine, dates, mode, motivation.
              </li>
              <li>
                <strong className="font-semibold text-ink">Pièces justificatives</strong> : CV,
                lettre de motivation, attestation de scolarité, et, lorsque le service le demande,
                convention de stage ou CIN.
              </li>
              <li>
                <strong className="font-semibold text-ink">Journaux techniques</strong> : horodatage
                des actions significatives (création, envoi, changement de statut, décision) sans
                contenu des fichiers.
              </li>
            </ul>
            <p>
              Les champs facultatifs peuvent rester vides sans empêcher le dépôt d’une candidature.
              La CIN n’est pas demandée par défaut : elle n’est collectée que si le service en a un
              besoin justifié.
            </p>
          </Block>

          <Block title="2. Finalités">
            <ul className="ml-4 list-inside list-disc space-y-1.5">
              <li>Créer et sécuriser le compte de l’utilisateur.</li>
              <li>Constituer, transmettre et étudier une demande de stage.</li>
              <li>Informer l’utilisateur de l’avancement et de la décision.</li>
              <li>Assurer la traçabilité des décisions et la sécurité du service.</li>
            </ul>
          </Block>

          <Block title="3. Base légale et consentement">
            <p>
              À compléter par l’organisation. Les données sont nécessaires à l’instruction d’une
              demande de stage ; certaines informations facultatives reposent sur le consentement de
              la personne concernée et peuvent être supprimées sur demande.
            </p>
          </Block>

          <Block title="4. Accès aux données">
            <p>L’accès est restreint par des règles appliquées au niveau de la base de données :</p>
            <ul className="ml-4 list-inside list-disc space-y-1.5">
              <li>
                Un candidat accède uniquement à son propre profil, à sa propre demande et à ses
                propres documents.
              </li>
              <li>
                Les administrateurs habilités accèdent aux dossiers nécessaires à leur mission.
              </li>
              <li>
                Les fichiers déposés sont stockés dans un espace privé. Ils ne sont jamais exposés
                par une adresse publique : chaque téléchargement passe par une vérification des
                droits côté serveur.
              </li>
            </ul>
            <p>
              Aucun transfert à des tiers à des fins commerciales n’est effectué par la plateforme.
              Si un prestataire d’hébergement est utilisé, il agit comme sous-traitant et doit être
              encadré par un contrat.
            </p>
          </Block>

          <Block title="5. Durées de conservation">
            <p>
              À arrêter par l’organisation. Une politique raisonnable consiste à conserver les
              dossiers de candidature le temps nécessaire à l’instruction, puis un délai limité
              destiné à la gestion d’un éventuel contentieux, avant suppression définitive. Les
              journaux de sécurité peuvent être conservés plus longtemps pour des raisons
              d’auditabilité.
            </p>
          </Block>

          <Block title="6. Sécurité">
            <ul className="ml-4 list-inside list-disc space-y-1.5">
              <li>Mots de passe gérés par un service d’authentification spécialisé, jamais stockés en clair.</li>
              <li>Contrôle des droits vérifié côté serveur à chaque lecture, écriture et téléchargement.</li>
              <li>Validation systématique des données saisies et des fichiers déposés.</li>
              <li>Limitation du volume et des types de fichiers acceptés.</li>
              <li>Journalisation des décisions et des changements de statut.</li>
            </ul>
          </Block>

          <Block title="7. Vos droits">
            <p>
              Vous pouvez demander l’accès à vos données, leur rectification, leur effacement ou la
              limitation de leur traitement. Une partie de ces informations est modifiable
              directement depuis votre profil. Pour les autres demandes, écrivez à{' '}
              <a href={`mailto:${BRAND.supportEmail}`} className="font-medium text-primary-600 hover:underline">
                {BRAND.supportEmail}
              </a>
              .
            </p>
          </Block>

          <Block title="8. Cookies">
            <p>
              La plateforme utilise uniquement des cookies techniques nécessaires au maintien de la
              session d’authentification et à la sécurité. Aucun cookie publicitaire ou de suivi
              tiers n’est déposé.
            </p>
          </Block>
        </div>

        <div className="mt-12 rounded-card border border-border bg-surface p-5">
          <p className="text-sm leading-relaxed text-ink-muted">
            Voir également les{' '}
            <a href="/conditions-utilisation" className="font-medium text-primary-600 hover:underline">
              conditions d’utilisation
            </a>
            .
          </p>
        </div>
      </main>
    </div>
  )
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-lg font-bold tracking-tight text-navy">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-ink-muted">{children}</div>
    </section>
  )
}
