/**
 * Application-wide constants and brand tokens.
 *
 * Brand text is centralised here so renaming StageFlow is a one-line change.
 */

export const BRAND = {
  name: 'StageFlow',
  /** Used by the wordmark component; the logo itself is a graduation-cap SVG. */
  tagline: 'Plateforme de gestion des demandes de stage',
  supportEmail: 'support@stageflow.ma',
} as const

/** Canonical application status. Exactly five states — see docs/ARCHITECTURE.md. */
export const APPLICATION_STATUSES = [
  'DRAFT',
  'SUBMITTED',
  'UNDER_REVIEW',
  'ACCEPTED',
  'REJECTED',
] as const

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number]

/**
 * Single source of truth for how a database status is rendered in the UI.
 *
 * Note: `SUBMITTED` is displayed as « En attente » in KPI tiles (matching the
 * mockups) and « Envoyée » in the timeline. It is ONE database state, never two.
 */
export const STATUS_META: Record<
  ApplicationStatus,
  {
    /** Timeline / primary label. */
    label: string
    /** KPI / table label where the mockups use a different word. */
    shortLabel: string
    tone: 'neutral' | 'info' | 'warning' | 'success' | 'danger'
    /** Emoji used by the stagiaire dashboard status panel. */
    dot: string
  }
> = {
  DRAFT: { label: 'Brouillon', shortLabel: 'Brouillon', tone: 'neutral', dot: '⚪' },
  SUBMITTED: { label: 'Envoyée', shortLabel: 'En attente', tone: 'warning', dot: '🟡' },
  UNDER_REVIEW: { label: 'En cours d’examen', shortLabel: 'En examen', tone: 'info', dot: '🔵' },
  ACCEPTED: { label: 'Acceptée', shortLabel: 'Acceptée', tone: 'success', dot: '🟢' },
  REJECTED: { label: 'Refusée', shortLabel: 'Refusée', tone: 'danger', dot: '🔴' },
}

/** Ordered stages rendered by the stagiaire tracker. */
export const TRACKER_STAGES = ['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'DECISION'] as const
export type TrackerStage = (typeof TRACKER_STAGES)[number]

export const TRACKER_STAGE_LABELS: Record<TrackerStage, { label: string; hint: string }> = {
  DRAFT: { label: 'Brouillon', hint: 'Préparation' },
  SUBMITTED: { label: 'Envoyée', hint: 'Transmise à l’administration' },
  UNDER_REVIEW: { label: 'En examen', hint: 'Dossier en cours d’étude' },
  DECISION: { label: 'Décision', hint: 'Acceptée ou refusée' },
}

/** Internship request types offered in the wizard (SCREEN 6). */
export const STAGE_TYPES = [
  'Stage de fin d’études',
  'Stage d’initiation',
  'Stage d’application',
  'Stage professionnel',
  'Stage de perfectionnement',
] as const

/** Domain options offered in the wizard (SCREEN 6). */
export const DOMAINS = [
  'Développement informatique',
  'Développement Web',
  'Génie informatique',
  'Réseaux & télécom',
  'Cybersécurité',
  'Data & IA',
  'Design graphique',
  'Marketing digital',
  'Gestion & finance',
  'Ressources humaines',
  'Génie civil',
  'Autre',
] as const

/** Work mode options. */
export const STAGE_MODES = ['Présentiel', 'Hybride', 'À distance'] as const

export const STUDY_LEVELS = [
  '1ère année',
  '2ème année',
  '3ème année',
  '4ème année',
  '5ème année',
  'Master 1',
  'Master 2',
  'Licence',
  'Doctorat',
  'Autre',
] as const

/**
 * Required and optional documents.
 *
 * NOTE (documented privacy decision): CIN is modelled as an OPTIONAL document.
 * Collecting a national identity card number is personal data under Moroccan law
 * 09-08 (CNDP); it is only requested where a documented business need exists.
 */
export const DOCUMENT_TYPES = [
  { value: 'CV', label: 'CV', required: true, hint: 'Curriculum vitæ à jour' },
  {
    value: 'MOTIVATION_LETTER',
    label: 'Lettre de motivation',
    required: true,
    hint: 'Courrier adressé à l’entreprise',
  },
  {
    value: 'ENROLLMENT_CERTIFICATE',
    label: 'Attestation de scolarité',
    required: true,
    hint: 'Preuve d’inscription en cours',
  },
  {
    value: 'INTERNSHIP_AGREEMENT',
    label: 'Convention de stage',
    required: false,
    hint: 'À joindre si disponible',
  },
  {
    value: 'CIN',
    label: 'CIN',
    required: false,
    hint: 'Uniquement si demandé par le service',
  },
] as const

export type DocumentType = (typeof DOCUMENT_TYPES)[number]['value']

export const REQUIRED_DOCUMENT_TYPES: DocumentType[] = DOCUMENT_TYPES.filter(
  (d) => d.required,
).map((d) => d.value)

/** Upload constraints — enforced client-side AND re-validated on the server. */
export const UPLOAD_RULES = {
  maxBytes: 5 * 1024 * 1024,
  /** Allowlist of extensions. Executable/script/SVG types are never accepted. */
  allowedExtensions: ['pdf', 'png', 'jpg', 'jpeg'] as const,
  allowedMimeTypes: [
    'application/pdf',
    'image/png',
    'image/jpeg',
  ] as const,
} as const

/** Pagination bounds. */
export const PAGE_SIZE_DEFAULT = 10
export const PAGE_SIZE_MAX = 25

/** Storage bucket for private application documents. */
export const DOCUMENTS_BUCKET = 'application-documents'

/** French date/number formatting helpers are in lib/utils/format.ts. */
