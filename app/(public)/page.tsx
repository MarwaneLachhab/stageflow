import Link from 'next/link'
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Clock,
  FileText,
  FolderOpen,
  GraduationCap,
  LayoutDashboard,
  Mail,
  MapPin,
  ShieldCheck,
  Sparkles,
  UserPlus,
} from 'lucide-react'
import { Logo } from '@/components/ui/logo'
import { BRAND } from '@/lib/constants'
import { getSessionUser, homeRouteForRole } from '@/lib/auth/session'

/**
 * SCREEN 1 — Public landing page (`/`).
 *
 * Structure follows `stageflow_11_mockups/01_accueil.png`:
 *   airy header · split hero with a live-looking product card on the right ·
 *   four benefit tiles · how-it-works · FAQ accordion · footer.
 *
 * No invented business statistics: the hero shows a real product preview built
 * from DOM, and the steps describe the actual workflow.
 */

export const metadata = {
  title: 'Trouvez votre opportunité de stage en entreprise',
  description:
    'Déposez votre candidature en quelques minutes, centralisez vos documents et suivez votre demande à chaque étape.',
}

const BENEFITS = [
  {
    icon: UserPlus,
    title: 'Inscription facile',
    description: 'Créez votre espace en quelques instants.',
  },
  {
    icon: ClipboardList,
    title: 'Demande simplifiée',
    description: 'Renseignez votre stage à votre rythme.',
  },
  {
    icon: FolderOpen,
    title: 'Documents centralisés',
    description: 'Tous vos justificatifs au même endroit.',
  },
  {
    icon: Clock,
    title: 'Suivi transparent',
    description: 'Visualisez l’évolution de votre demande.',
  },
] as const

const STEPS = [
  {
    icon: UserPlus,
    title: 'Créez votre compte',
    description:
      'Nom, prénom, e-mail et téléphone suffisent. Votre espace personnel est prêt immédiatement.',
  },
  {
    icon: ClipboardList,
    title: 'Complétez votre demande',
    description:
      'Renseignez les informations du stage et vos informations académiques étape par étape, puis enregistrez votre brouillon.',
  },
  {
    icon: FileText,
    title: 'Joignez vos documents',
    description:
      'CV, lettre de motivation et attestation de scolarité sont déposés dans votre espace privé.',
  },
  {
    icon: LayoutDashboard,
    title: 'Suivez la décision',
    description:
      'Vous êtes informé dès que le dossier est en cours d’examen, puis de la décision prise.',
  },
] as const

const FAQ = [
  {
    question: 'Qui peut déposer une demande de stage ?',
    answer:
      'Toute personne inscrite dans un établissement d’enseignement et recherchant un stage peut créer un compte. La plateforme est réservée aux candidatures de stage ; elle ne publie pas d’offres d’emploi.',
  },
  {
    question: 'Quels documents dois-je fournir ?',
    answer:
      'Un CV, une lettre de motivation et une attestation de scolarité sont obligatoires. La convention de stage peut être ajoutée lorsqu’elle est disponible, et la CIN n’est demandée que si le service en fait la demande.',
  },
  {
    question: 'Ma demande est-elle envoyée automatiquement ?',
    answer:
      'Non. Tant que vous n’avez pas cliqué sur « Envoyer la demande », votre dossier reste au statut Brouillon et reste modifiable. C’est la soumission explicite qui transmet votre candidature à l’administration.',
  },
  {
    question: 'Puis-je suivre l’avancement de mon dossier ?',
    answer:
      'Oui. La page « Suivi de ma demande » affiche en temps réel le statut, les dates importantes et l’historique de votre candidature : Envoyée, En cours d’examen, puis Acceptée ou Refusée.',
  },
  {
    question: 'Mes documents sont-ils confidentiels ?',
    answer:
      'Vos fichiers sont stockés dans un espace privé. Ils ne sont accessibles qu’à vous et aux personnes chargées de l’étude de votre dossier, via des liens temporaires soumis à vérification des droits.',
  },
  {
    question: 'Que se passe-t-il si ma demande est refusée ?',
    answer:
      'Le motif du refus est affiché dans votre espace. Vous pouvez alors corriger votre dossier et déposer une nouvelle demande pour une autre période.',
  },
] as const

export default async function LandingPage() {
  const user = await getSessionUser()

  return (
    <div className="min-h-screen bg-surface">
      {/* ================= Header ================= */}
      <header className="sticky top-0 z-40 border-b border-border bg-surface/90 backdrop-blur">
        <div className="mx-auto flex h-[72px] max-w-[1200px] items-center gap-8 px-5 sm:px-8">
          <Logo />

          <nav aria-label="Navigation du site" className="hidden items-center gap-7 lg:flex">
            <a href="#accueil" className="text-sm font-medium text-ink hover:text-primary-600">
              Accueil
            </a>
            <a href="#parcours" className="text-sm font-medium text-ink hover:text-primary-600">
              Comment ça marche
            </a>
            <a href="#etapes" className="text-sm font-medium text-ink hover:text-primary-600">
              À propos
            </a>
            <a href="#contact" className="text-sm font-medium text-ink hover:text-primary-600">
              Contact
            </a>
          </nav>

          <div className="ml-auto flex items-center gap-2.5">
            {user ? (
              <Link href={homeRouteForRole(user.role)} className="sf-btn-primary">
                Accéder à mon espace
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            ) : (
              <>
                <Link
                  href="/connexion"
                  className="sf-btn-secondary hidden sm:inline-flex"
                >
                  Se connecter
                </Link>
                <Link href="/inscription" className="sf-btn-primary">
                  Créer un compte
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Mobile anchor strip — keeps every section reachable without JS. */}
        <nav
          aria-label="Navigation mobile"
          className="sf-scrollbar-thin flex gap-1 overflow-x-auto border-t border-border px-4 py-2 lg:hidden"
        >
          {[
            ['#accueil', 'Accueil'],
            ['#avantages', 'Avantages'],
            ['#parcours', 'Comment ça marche'],
            ['#faq', 'FAQ'],
            ['#contact', 'Contact'],
          ].map(([href, label]) => (
            <a
              key={href}
              href={href}
              className="whitespace-nowrap rounded-full px-3.5 py-1.5 text-[13px] font-medium text-ink-muted hover:bg-canvas hover:text-ink"
            >
              {label}
            </a>
          ))}
        </nav>
      </header>

      <main id="accueil">
        {/* ================= Hero ================= */}
        <section className="relative overflow-hidden border-b border-border bg-canvas">
          <div
            aria-hidden="true"
            className="sf-blob left-[35%] top-[-10%] h-[520px] w-[520px]"
          />

          <div className="relative mx-auto grid max-w-[1200px] items-center gap-12 px-5 py-14 sm:px-8 lg:grid-cols-[1.05fr_1fr] lg:gap-10 lg:py-20">
            {/* Left column */}
            <div>
              <span className="inline-flex items-center gap-2 rounded-full bg-primary-50 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wide text-primary-700">
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                La plateforme de vos stages
              </span>

              <h1 className="mt-5 text-[2.5rem] font-bold leading-[1.08] tracking-tight text-navy sm:text-[3.25rem] lg:text-[3.5rem]">
                Votre prochain stage
                <br />
                <span className="text-primary-600">commence ici.</span>
              </h1>

              <p className="mt-5 max-w-xl text-base leading-relaxed text-ink-muted sm:text-lg">
                Déposez votre candidature en quelques minutes, centralisez vos documents et suivez
                votre demande à chaque étape, en toute simplicité.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link href="/inscription" className="sf-btn-primary sf-btn-lg">
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  Commencer ma demande
                </Link>
                <a href="#parcours" className="sf-btn-secondary sf-btn-lg">
                  Découvrir la plateforme
                </a>
              </div>

              <div className="mt-8 flex items-center gap-3">
                <div className="flex -space-x-2.5" aria-hidden="true">
                  {[
                    ['#93B4FD', 'ÉL'],
                    ['#FCD9A8', 'FA'],
                    ['#A7F3D0', 'YO'],
                  ].map(([bg, label]) => (
                    <span
                      key={label}
                      className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-canvas text-[10px] font-bold text-white"
                      style={{ backgroundColor: bg }}
                    >
                      {label}
                    </span>
                  ))}
                </div>
                <p className="text-sm text-ink-muted">Un parcours clair, du dépôt à la décision.</p>
              </div>
            </div>

            {/* Right column — real DOM product preview, not a screenshot */}
            <HeroPreview />
          </div>
        </section>

        {/* ================= Benefits ================= */}
        <section id="avantages" className="border-b border-border bg-surface">
          <div className="mx-auto max-w-[1200px] px-5 py-12 sm:px-8 sm:py-14">
            <p className="text-center text-xs font-semibold uppercase tracking-[0.14em] text-ink-subtle">
              Un parcours pensé pour vous
            </p>

            <ul className="mt-9 grid gap-x-8 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
              {BENEFITS.map((benefit) => {
                const Icon = benefit.icon
                return (
                  <li key={benefit.title} className="flex items-start gap-3.5">
                    <span
                      aria-hidden="true"
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-600"
                    >
                      <Icon className="h-5 w-5" />
                    </span>
                    <div>
                      <h2 className="text-sm font-semibold text-ink">{benefit.title}</h2>
                      <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">
                        {benefit.description}
                      </p>
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>
        </section>

        {/* ================= How it works ================= */}
        <section id="parcours" className="border-b border-border bg-canvas">
          <div className="mx-auto max-w-[1200px] px-5 py-14 sm:px-8 sm:py-20">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary-600">
                Comment ça marche
              </p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-navy sm:text-4xl">
                Quatre étapes, de la candidature à la décision
              </h2>
              <p className="mt-4 text-base leading-relaxed text-ink-muted">
                La plateforme applique le même circuit que votre établissement attend : dépôt,
                vérification, examen par l’administration, puis décision.
              </p>
            </div>

            <ol id="etapes" className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((step, index) => {
                const Icon = step.icon
                return (
                  <li key={step.title} className="sf-card-padded relative">
                    <div className="flex items-center justify-between">
                      <span
                        aria-hidden="true"
                        className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-50 text-primary-600"
                      >
                        <Icon className="h-5 w-5" />
                      </span>
                      <span className="text-2xl font-bold text-slate-200">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                    </div>
                    <h3 className="mt-4 text-base font-semibold text-ink">{step.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-ink-muted">
                      {step.description}
                    </p>
                  </li>
                )
              })}
            </ol>
          </div>
        </section>

        {/* ================= Trust / workflow ================= */}
        <section className="border-b border-border bg-surface">
          <div className="mx-auto grid max-w-[1200px] items-center gap-12 px-5 py-14 sm:px-8 sm:py-20 lg:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary-600">
                Transparence
              </p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-navy sm:text-4xl">
                Un statut clair, à chaque instant
              </h2>
              <p className="mt-4 text-base leading-relaxed text-ink-muted">
                Votre dossier progresse selon cinq statuts. Vous voyez toujours où vous en êtes, et
                vous recevez le motif de la décision lorsqu’elle est prise.
              </p>

              <ul className="mt-7 space-y-3">
                {[
                  'Brouillon — vous préparez votre dossier, rien n’est envoyé.',
                  'Envoyée — votre candidature est transmise à l’administration.',
                  'En cours d’examen — votre dossier est étudié.',
                  'Acceptée ou Refusée — la décision est motivée et définitive.',
                ].map((line) => (
                  <li key={line} className="flex items-start gap-3">
                    <CheckCircle2
                      className="mt-0.5 h-4.5 w-4.5 shrink-0 text-success"
                      aria-hidden="true"
                    />
                    <span className="text-sm leading-relaxed text-ink">{line}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-8 flex items-start gap-3 rounded-card border border-border bg-canvas p-4">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary-600" aria-hidden="true" />
                <p className="text-[13px] leading-relaxed text-ink-muted">
                  Vos données et vos pièces jointes restent privées. Chaque accès est vérifié côté
                  serveur et chaque décision est enregistrée.
                </p>
              </div>
            </div>

            <StatusPreview />
          </div>
        </section>

        {/* ================= FAQ ================= */}
        <section id="faq" className="border-b border-border bg-canvas">
          <div className="mx-auto max-w-[860px] px-5 py-14 sm:px-8 sm:py-20">
            <div className="text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary-600">
                FAQ
              </p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-navy sm:text-4xl">
                Questions fréquentes
              </h2>
            </div>

            <div className="mt-10 space-y-3">
              {FAQ.map((item) => (
                <details
                  key={item.question}
                  className="group sf-card overflow-hidden [&_summary::-webkit-details-marker]:hidden"
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-left">
                    <span className="text-sm font-semibold text-ink">{item.question}</span>
                    <ChevronDown
                      className="h-4.5 w-4.5 shrink-0 text-ink-muted transition-transform group-open:rotate-180"
                      aria-hidden="true"
                    />
                  </summary>
                  <div className="border-t border-border px-5 py-4">
                    <p className="text-sm leading-relaxed text-ink-muted">{item.answer}</p>
                  </div>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ================= CTA ================= */}
        <section className="bg-surface">
          <div className="mx-auto max-w-[1200px] px-5 py-14 sm:px-8 sm:py-16">
            <div className="relative overflow-hidden rounded-card bg-navy px-6 py-12 text-center sm:px-12">
              <div
                aria-hidden="true"
                className="sf-blob left-[-10%] top-[-40%] h-[380px] w-[380px] opacity-40"
              />
              <div className="relative mx-auto max-w-xl">
                <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                  Prêt à déposer votre candidature ?
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-slate-300 sm:text-base">
                  Créez votre compte, complétez votre dossier et suivez chaque étape depuis votre
                  espace personnel.
                </p>
                <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
                  <Link href="/inscription" className="sf-btn-primary sf-btn-lg">
                    Créer un compte
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                  <Link
                    href="/connexion"
                    className="sf-btn sf-btn-lg border border-white/20 bg-transparent text-white hover:bg-white/10"
                  >
                    J’ai déjà un compte
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ================= Footer ================= */}
      <footer id="contact" className="border-t border-border bg-surface">
        <div className="mx-auto max-w-[1200px] px-5 py-12 sm:px-8">
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            <div className="lg:col-span-2">
              <Logo href={null} />
              <p className="mt-4 max-w-sm text-sm leading-relaxed text-ink-muted">
                {BRAND.tagline}. Un espace unique pour déposer, suivre et finaliser votre
                candidature de stage.
              </p>
              <ul className="mt-5 space-y-2 text-sm text-ink-muted">
                <li className="flex items-center gap-2.5">
                  <Mail className="h-4 w-4 shrink-0 text-ink-subtle" aria-hidden="true" />
                  <a href={`mailto:${BRAND.supportEmail}`} className="hover:text-primary-600">
                    {BRAND.supportEmail}
                  </a>
                </li>
                <li className="flex items-center gap-2.5">
                  <MapPin className="h-4 w-4 shrink-0 text-ink-subtle" aria-hidden="true" />
                  <span>Rabat, Maroc</span>
                </li>
              </ul>
            </div>

            <div>
              <h2 className="text-sm font-semibold text-ink">Plateforme</h2>
              <ul className="mt-4 space-y-2.5 text-sm text-ink-muted">
                <li>
                  <Link href="/inscription" className="hover:text-primary-600">
                    Créer un compte
                  </Link>
                </li>
                <li>
                  <Link href="/connexion" className="hover:text-primary-600">
                    Se connecter
                  </Link>
                </li>
                <li>
                  <a href="#parcours" className="hover:text-primary-600">
                    Comment ça marche
                  </a>
                </li>
                <li>
                  <a href="#faq" className="hover:text-primary-600">
                    FAQ
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h2 className="text-sm font-semibold text-ink">Informations légales</h2>
              <ul className="mt-4 space-y-2.5 text-sm text-ink-muted">
                <li>
                  <Link href="/conditions-utilisation" className="hover:text-primary-600">
                    Conditions d’utilisation
                  </Link>
                </li>
                <li>
                  <Link href="/confidentialite" className="hover:text-primary-600">
                    Confidentialité
                  </Link>
                </li>
                <li>
                  <a href={`mailto:${BRAND.supportEmail}`} className="hover:text-primary-600">
                    Contact
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-border pt-6 sm:flex-row">
            <p className="text-xs text-ink-subtle">
              © {new Date().getFullYear()} {BRAND.name}. Tous droits réservés.
            </p>
            <p className="text-xs text-ink-subtle">
              Projet de gestion des demandes de stage.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Hero product preview — built from real DOM, matching the mockup            */
/* -------------------------------------------------------------------------- */

function HeroPreview() {
  return (
    <div className="relative" aria-hidden="true">
      {/* Floating status chip */}
      <div className="absolute -right-1 top-2 z-20 hidden w-[220px] rounded-card border border-border bg-surface p-3.5 shadow-raised sm:block">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-success-bg text-success">
            <CheckCircle2 className="h-4 w-4" />
          </span>
          <div>
            <p className="text-[13px] font-semibold text-ink">Dossier complet</p>
            <p className="text-2xs text-ink-muted">Tous les fichiers sont ajoutés</p>
          </div>
        </div>
      </div>

      {/* Main product card */}
      <div className="relative z-10 ml-auto w-full max-w-[470px] rounded-card border border-border bg-surface p-5 shadow-raised sm:mt-10">
        <div className="flex items-center gap-1.5 pb-4">
          <span className="h-2.5 w-2.5 rounded-full bg-slate-200" />
          <span className="h-2.5 w-2.5 rounded-full bg-slate-200" />
          <span className="h-2.5 w-2.5 rounded-full bg-slate-200" />
        </div>

        <div className="flex items-start justify-between gap-3 border-t border-border pt-4">
          <div>
            <p className="text-[13px] text-ink-muted">Bonjour, Sara 👋</p>
            <p className="mt-0.5 text-lg font-bold text-ink">Votre demande de stage</p>
          </div>
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
            <ClipboardList className="h-4 w-4" />
          </span>
        </div>

        <div className="mt-4 rounded-control border border-border bg-canvas p-3.5">
          <p className="text-2xs font-semibold uppercase tracking-wide text-ink-subtle">
            Statut actuel
          </p>
          <div className="mt-1.5 flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-ink">En cours d’examen</p>
            <span className="sf-badge border-info-border bg-info-bg text-info">En examen</span>
          </div>
        </div>

        {/* Progress bars, mirroring the mockup's stacked indicator */}
        <div className="mt-4 space-y-2">
          {[100, 100, 68, 22].map((width, index) => (
            <span
              key={index}
              className="block h-1.5 overflow-hidden rounded-full bg-slate-100"
            >
              <span
                className="block h-full rounded-full bg-primary-600"
                style={{ width: `${width}%` }}
              />
            </span>
          ))}
        </div>

        <p className="mt-4 text-xs leading-relaxed text-ink-muted">
          Votre dossier progresse. Vous serez informé dès qu’une décision sera prise.
        </p>
      </div>

      {/* Floating notification chip */}
      <div className="absolute -left-2 bottom-4 z-20 hidden w-[214px] rounded-card border border-border bg-surface p-3.5 shadow-raised sm:block">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
            <Clock className="h-4 w-4" />
          </span>
          <div>
            <p className="text-[13px] font-semibold text-ink">Suivi en temps réel</p>
            <p className="text-2xs text-ink-muted">Renseigné à chaque étape</p>
          </div>
        </div>
      </div>
    </div>
  )
}

/** Status timeline illustration for the transparency section. */
function StatusPreview() {
  const stages = [
    { label: 'Brouillon', done: true },
    { label: 'Envoyée', done: true },
    { label: 'En examen', done: true },
    { label: 'Décision', done: false },
  ]

  return (
    <div className="sf-card-padded" aria-hidden="true">
      <p className="text-sm font-semibold text-ink">Demande #STG-2026-0142</p>
      <p className="mt-1 text-xs text-ink-muted">Déposée le 12 octobre 2026 · Stage de fin d’études</p>

      <ol className="mt-7 flex items-start">
        {stages.map((stage, index) => (
          <li key={stage.label} className="relative flex flex-1 flex-col items-center">
            {index > 0 && (
              <span
                className="absolute right-1/2 top-4 h-0.5 w-full"
                style={{
                  backgroundColor: stage.done || stages[index - 1]?.done ? '#2563EB' : '#E9EEF6',
                }}
              />
            )}
            <span
              className="relative z-10 flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold"
              style={{
                backgroundColor: stage.done ? '#2563EB' : '#F1F5F9',
                color: stage.done ? '#FFFFFF' : '#94A3B8',
              }}
            >
              {stage.done ? <CheckCircle2 className="h-4 w-4" /> : index + 1}
            </span>
            <span className="mt-2.5 text-center text-[11px] font-semibold text-ink">
              {stage.label}
            </span>
          </li>
        ))}
      </ol>

      <div className="mt-7 space-y-3 border-t border-border pt-5">
        {[
          ['12 oct. 2026 · 09:12', 'Brouillon créé'],
          ['12 oct. 2026 · 14:30', 'Demande envoyée'],
          ['14 oct. 2026 · 10:30', 'Dossier en cours d’examen'],
        ].map(([date, label]) => (
          <div key={label} className="flex items-start gap-3">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary-600" />
            <div>
              <p className="text-[13px] font-medium text-ink">{label}</p>
              <p className="text-2xs text-ink-subtle">{date}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 flex items-center gap-2 rounded-control bg-canvas px-3.5 py-3">
        <GraduationCap className="h-4 w-4 shrink-0 text-ink-subtle" />
        <p className="text-xs text-ink-muted">
          Vous recevez une notification dès qu’une décision est enregistrée.
        </p>
      </div>
    </div>
  )
}
