# MASTER IMPLEMENTATION PROMPT — STAGEFLOW / PLATEFORME DE GESTION DES DEMANDES DE STAGE

## YOUR ROLE AND NON-NEGOTIABLE MISSION

You are my **principal full-stack software engineer, senior UI/UX engineer, database architect, application-security engineer, QA engineer and technical mentor**. Build a **real, functional, maintainable, responsive, secure French-language internship application management platform** based on the requirements below and, above all, the actual files in my Windows project folder. This is a production-minded implementation project, not a slideshow, static HTML demonstration, or code-generation exercise that ends with a to-do list.

**My local project root (EXACT PATH):**
`C:\Users\S P A R O\Desktop\stage project`

This folder currently contains three extracted visual-reference folders:
- `stageflow_11_mockups`
- `stageflow_admin_pages`
- `stageflow_public_pages`

Some reference screens may be duplicated across folders. The 11-screen folder is intended to cover public, stagiaire and administration screens. **Discover the real files and their contents instead of assuming exact PNG filenames or that the three folders contain different screens.** Keep these original references intact. Work inside the project root, keeping source code separate from original mockup directories.

**Original source of truth:** the document *Cahier des charges — Plateforme de gestion des demandes de stage* (provided in our ChatGPT conversation). If you cannot access that document from your working environment, use the fully specified functional requirements in this prompt; ask me for the source file only if you find a material conflict or missing requirement. The source defines **exactly two roles: Stagiaire and Administrateur/Responsable**, a request lifecycle, account registration/login, trainee profiles, applications, uploaded documents, admin review, and statistics.

**Design source of truth:** all supplied mockup images. The objective is to **rebuild the visible layouts as actual semantic React/HTML/CSS components**, not paste screenshots into a page, not replace layouts with generic templates, and not redesign the product into something unrelated. Match structure, proportions, navigation, typography hierarchy, colors, card layout, tables, fields, charts, whitespace and interaction states as closely as practical. Use correct and natural French text if any generated mockup contains spelling errors. Where two mockups conflict, follow the more detailed applicable role-specific screen and note the resolution.

The mockups have used the name **StagePro** in an initial overview and **StageFlow** for the distributed file collection. Use **StageFlow** consistently as a temporary brand name (logo can be a simple graduation-cap SVG/icon and a wordmark), with brand text centralized so renaming is trivial.

## HOW YOU MUST OPERATE — NOT JUST PLAN

1. **Inspect before editing:** confirm the Windows path is accessible; list its contents recursively; identify the actual images; generate a reference inventory with filename, size, image dimensions, which of the 11 screens it maps to, and duplicates. If you have image-viewing capabilities, actually inspect each unique mockup visually. If your environment cannot access this path, stop and request the correct folder access instead of fabricating an inspection.
2. **Audit existing source:** if application source already exists, inspect git status, dependencies, routes, migrations, secrets handling, and tests. Preserve existing valuable work; do not destructively reinitialize. If only reference folders exist, create a new app safely in this root without overwriting assets.
3. **Explain the implementation architecture and page inventory briefly, then implement.** Do not spend hours on documentation without functional results. Produce small milestones, test each, and report actual evidence rather than invented completion percentages.
4. **Keep a live checklist** in `docs/IMPLEMENTATION_PLAN.md`, with `TODO / IN PROGRESS / DONE / BLOCKED` and acceptance criteria. Mark DONE only after the behavior is implemented and verified.
5. **Never silently skip functionality** or replace secure backend features with `localStorage`, fake admin endpoints, public file URLs or hardcoded passwords. A clearly marked temporary UI fixture is acceptable during initial visual development, but must not masquerade as production functionality.
6. **Ask for external secrets only when truly needed** (Supabase project URL/public key, database credentials if applicable, email provider). Never ask me to paste secrets into code or commit them. Use `.env.example` placeholders and document where to configure each secret. If external services are not connected yet, build and test what is possible locally, then clearly mark integration blockers.
7. **No destructive or production-impacting commands without my approval:** no deleting project folders, resetting production databases, overwriting uploaded images, removing remote resources, force pushes or bulk data changes. Use migrations and development/test environments.
8. **Deliver actual working source code** and runnable commands at every milestone. If tool execution is available, run build, lint/typecheck and tests, fix failures, then show exactly what passed or failed.
9. **Maintain readable, beginner-explainable code** without sacrificing security. Document key concepts because I am learning HTML, CSS, JavaScript and React. Write a short `docs/LEARNING_GUIDE.md` to explain how components, routing, state, forms, APIs, auth and DB calls connect in this real project.

## RECOMMENDED IMPLEMENTATION STACK

Default to this coherent stack unless a pre-existing codebase makes another stack demonstrably safer:

- **Frontend/full-stack:** Next.js App Router + React + TypeScript using a current stable, compatible release. Use Server Components by default, small Client Components for interactivity, and Server Actions or route handlers for authenticated mutations.
- **Styling:** Tailwind CSS, CSS variables/design tokens, accessible headless component primitives as needed (shadcn/ui or equivalent), Lucide icons. Do not add huge design libraries that prevent pixel-accurate matching.
- **Forms:** React Hook Form + Zod or equivalent; always revalidate in server-side actions.
- **Backend/data:** Supabase Postgres + Supabase Auth + private Supabase Storage, with versioned SQL migrations and **Row Level Security**. Keep keys and queries clearly segregated by trust boundary. The app must work with *server-side authorization* and DB-enforced tenant/role restrictions.
- **Analytics:** lightweight Recharts or equivalent for real data graphs, not placeholder images.
- **Testing:** Vitest or Jest for units, React Testing Library as helpful, Playwright for end-to-end role workflows, plus SQL/database RLS tests.
- **Deploy:** Vercel + Supabase or equivalent secure hosting; configuration is documented and not assumed to be live.
- **Quality:** ESLint, TypeScript strict mode, Prettier, format/typecheck/lint/test/build scripts.

Avoid outdated libraries. Pin compatible versions in lockfile. Do not put an elevated Supabase service-role/secret key in `NEXT_PUBLIC_*` env variables, browser bundles, client-side network calls, or tracked files. Use a least-privileged approach and RLS where practical.

## DESIGN SYSTEM: VISUAL ACCURACY IS A REQUIREMENT

Analyze the mockups and extract a reusable design system **from the images**:

- Professional modern university/corporate SaaS look; off-white/very light gray canvas; blue primary action and accent; navy sidebar; rounded white cards; light borders and subtle shadows; compact modern line icons; readable sans-serif font.
- Public site: airy wide header, recognizable brand, modern hero with graduating student/academic visual, prominent call-to-action, benefits/features, trust-oriented explanatory sections, responsive footer.
- Auth screens: split-pane desktop composition where shown, branded illustration or visual, centered white form panel, well-spaced input fields, clear error and focus states.
- Stagiaire app: navy vertical sidebar on desktop with icon + labels, light main workspace, simple topbar (breadcrumb/notifications/avatar), personal greeting, large status panel, smaller feature cards, application wizard and progress tracker.
- Admin app: same visual identity but **role-correct** navigation, KPI cards, color-coded status counts, real charts, searchable/filterable applications table, applicant detail cards, attached-file list and decision dialog.
- Suggested tokens to calibrate to screenshots (not arbitrary immutable values): `primary blue`, `navy 900`, muted slate text, borders in cool gray, green success, amber pending, red rejection, blue under-review. Measure actual screenshot colors and spacings if possible.
- Standardize typography scales; 8px-based spacing where useful, card radii and elevation, 40–48px minimum clickable targets where possible, consistent icon sizing, focus outlines and form messages.
- At desktop 1440–1600px, pages should look recognizably like the corresponding reference. At tablet/mobile, reflow logically without horizontal scrolling: collapsible/off-canvas sidebar, stacked cards, readable tables (responsive cards or intentional horizontal table scroll), full-width form buttons and mobile-friendly dialogs.
- Each interface needs actual states: initial, loading/skeleton, success, empty, validation errors, permission denied, offline/network errors where applicable, and submission-in-progress disabled controls. Provide dark mode **only if the supplied design or remaining schedule supports it**; matching the light screenshots is the priority.
- Do **not** use mockup screenshots as background images for whole pages. Build real DOM, selectable text, accessible form elements and interactive buttons. If the hero photograph/illustration is unavailable as a separate asset, choose a properly licensed replacement with similar composition, or create a simple original CSS/SVG illustration; never crop whole screenshots into functional page content.
- Build shared primitives: `AppShell`, `PublicHeader`, `PublicFooter`, `Sidebar`, `Topbar`, `PageHeader`, `Card`, `StatusBadge`, `StatCard`, `DataTable`, `SearchFilters`, `FormField`, `FileUploader`, `Stepper`, `Timeline`, `ConfirmDialog`, `EmptyState`, `Toast`, `Skeleton`, `Pagination`, `AvatarMenu`.

## COMPLETE ROLE AND ROUTE MAP

Implement at least these **11 primary visual screens** plus system pages. Routes may be refined but must stay intuitive:

**Public screens (3):**
1. `/` — Landing page.
2. `/inscription` — Stagiaire registration.
3. `/connexion` — Unified login, then role-aware redirect.

**Stagiaire screens (5):**
4. `/stagiaire/tableau-de-bord` — Personal dashboard.
5. `/stagiaire/profil` — Personal + academic profile editor.
6. `/stagiaire/demande` — Internship request creation/editing, step-based wizard.
7. `/stagiaire/documents` — Document upload/management, final review and submission CTA.
8. `/stagiaire/suivi` — Application status/progress, dates, documents, public decision/rejection explanation.

**Administrator screens (3):**
9. `/admin/tableau-de-bord` — Admin KPIs and statistics.
10. `/admin/demandes` — All requests, search, filters, sorting, pagination.
11. `/admin/demandes/[id]` — Candidate/request full detail; accept/reject actions via accessible confirmation dialog or drawer consistent with mockups.

**System/completeness screens (required supporting routes or views):**
- `/mot-de-passe-oublie` and `/reinitialiser-mot-de-passe` — secure reset request and callback UI.
- `/verification-email` — confirmation information and resend with throttling if email confirmation is configured.
- `/acces-refuse` — 403 informative view with a safe return link.
- Not found (404) and friendly error pages/500-equivalent, with no sensitive stack traces.
- `/confidentialite` and `/conditions-utilisation` — clearly identified draft legal/privacy pages whose content requires owner/legal review; do not fabricate regulatory certification.
- Contact/help section on landing page or `/contact` if needed, with realistic functional interaction (mailto is acceptable for MVP if no messaging backend is configured, but label it honestly).
- Optional, only after core 11 screens work: `/admin/statistiques` for advanced analytics, `/admin/stagiaires` for directory, `/admin/parametres`, notifications center, admin internal notes. If a sidebar label exists, its click MUST work; hide unimplemented sections instead of showing broken menu entries.

**Navigation/permission matrix:**
- Guest: landing, inscription, connexion, password-reset, legal/contact; cannot fetch private application, profile, dashboard or documents.
- Stagiaire: only **own** profile, requests and private documents; cannot see other applicants, admin stats, or perform decisions, even by typing a URL or calling API endpoints directly.
- Admin: admin-only routes and authorized review of applications, private documents and statistics; account access is granted **out of band** by trusted operator procedure, never by public signup or client-modifiable `role` fields.
- Both logged-in roles: logout, account menu, appropriate role-based redirects, no cross-role navigation leaks. Treat unauthorized page requests with redirects or 403 and unauthorized data mutations with a real forbidden result.

## SCREEN 1 — PUBLIC HOME `/`

Design: copy the public homepage mockup. Crisp white topbar containing StageFlow cap icon/wordmark at left, links such as `Accueil`, `À propos`, `FAQ`, `Contact`, then `Se connecter` (outline) and `Créer un compte` (solid blue) on the right. Hero is a spacious split composition: left large bold French headline similar to **« Trouvez votre opportunité de stage en entreprise »**, supporting paragraph, a clear primary `Créer un compte` button and secondary `En savoir plus` button. Right hero contains the student/academic artwork and pastel blue decorative forms. Under hero, four compact benefit tiles with icons, e.g., `Inscription facile`, `Dépôt de dossier`, `Suivi en temps réel`, `Réponse rapide`. Continue down page with how-it-works steps, accessible FAQ accordion and footer; avoid invented business statistics/testimonials.

Behavior: all links work; smooth anchors for page sections; CTA starts registration, login starts session flow; mobile menu opens/closes accessibly. Logged-in users may see `Accéder à mon espace` routed by role. Add metadata, meaningful alt text and page responsiveness.

## SCREEN 2 — REGISTRATION `/inscription`

Design: follow split-page signup mockup, illustrated/brand side and high-contrast clean signup card. Intro `Rejoignez notre plateforme` or equivalent. Fields **Nom, Prénom, Email, Téléphone, Mot de passe, Confirmer le mot de passe**. Clear main button `Créer un compte`, link `Se connecter`. Password visibility toggle, clear field-level error labels, legal/privacy acknowledgment if needed, submit/loading states.

Behavior: validate required text and sane bounds; normalize/validate email and phone as appropriate without silently rejecting Moroccan or international formats; robust passwords and confirmation; protect duplicate signup and throttling. Supabase Auth signup; all public registrants become **Stagiaire only** through trusted backend/DB logic; never accept or trust a client-sent administrator role. Respect email verification configuration; explain whether confirmation was sent without leaking unnecessarily whether a targeted email exists. Redirect to verification state or stagiaire dashboard only after authenticated as appropriate.

## SCREEN 3 — LOGIN `/connexion`

Design: branded illustration/content panel + clean card as reference. Email and password inputs, show/hide password, `Mot de passe oublié ?`, `Se connecter`, signup link, clear messages, keyboard accessibility.

Behavior: valid sessions redirect to correct dashboard based on trustworthy server-side roles; blocked or disabled users cannot continue. Invalid credentials show generic error, implement rate limiting and no account enumeration. Handle password reset, expired sessions, replay-resistant auth flows, secure logout of all relevant cookies/session artifacts using SDK-provided methods. Do not implement custom plain-text password storage or roll your own crypto.

## SCREEN 4 — STAGIAIRE DASHBOARD `/stagiaire/tableau-de-bord`

Design: screenshot-matched left navy sidebar and topbar with bell/avatar; `Bonjour [Prénom] 👋`; intro copy; large `Statut de ma demande` card with prominent color-coded badge and link `Voir les détails`. Below: 4 small actionable cards: `Informations personnelles`, `Ma demande`, `Mes documents`, `Suivi de ma demande`. Sidebar labels visually consistent with reference: Tableau de bord, Mon profil, Ma demande, Mes documents, Suivi de ma demande, Déconnexion.

Behavior: data is fetched for authenticated current user; new user without a request sees `Vous n'avez pas encore créé de demande` and `Créer une demande`; in-progress draft shows `Reprendre mon brouillon`; submitted application shows the real status and timeline. Notification badge shows actual unseen count only once notifications are implemented, otherwise hide. Card actions navigate to correct screens. Never expose another user's data through cached SSR or API routes.

## SCREEN 5 — STAGIAIRE PROFILE `/stagiaire/profil`

Design: form divided into clear cards/groups `Informations personnelles` and `Informations académiques`; use consistent input height/spacing, avatar initials, update button, account overview. Required/profile fields from requirements: Nom, Prénom, Email, Téléphone, Adresse, Date de naissance, Formation, Établissement, Niveau d'étude; add Spécialité where relevant. Use useful select controls and placeholder copy. Show success toast on save and `Annuler`/reset affordance when dirty.

Behavior: load/edit/save own profile only. Server revalidates lengths, dates, email formats and ownership. Sensitive authentication-email change should follow Supabase's secure verification workflow, not silently modify user identity; explain pending email verification. Display account email separately if needed. Avoid collecting dates of birth and addresses unless necessary, and make optional where product/legal requirements allow. Never allow an attacker to send `role: admin`, `user_id` or `is_verified` to escalate privileges.

## SCREEN 6 — APPLICATION WIZARD `/stagiaire/demande`

Design: close to the screenshot: title `Nouvelle demande de stage`, clean horizontal stepper across main card: `Informations du stage`, `Informations académiques`, `Documents`, `Confirmation`. Distinct active/completed circles/connector lines. First step has `Type de stage`, `Domaine`, `Date de début`, `Date de fin`, `Durée`, textarea `Description / motivation`. Second step has `Établissement`, `Formation`, `Niveau`, `Spécialité`; make a coherent UX if profile fields prefill values.

Behavior: clear `Précédent`, `Suivant`, `Enregistrer le brouillon`, eventually `Envoyer la demande`. Support resuming draft after navigation/refresh through backend persistence. Validate each step and server-side complete request before submission. Dates must be valid and end >= start. Calculate/display duration from dates or validate explicitly; store normalized units and avoid inconsistent derived data. Motivation has maximum length and a character count. Auto-save is optional; if implemented debounce and show reliable saving states. Make explicit: **creating a form is not submitting it**. User sees a confirmation/review step before final submit. Submitted applications become read-only to stagiaire unless future authorized reopen feature is explicitly added. Use a clear policy: MVP permits one active/current request per stagiaire, with historical read-only requests if supporting resubmission; document assumptions, enforce with safe database rules, and do not destroy history.

## SCREEN 7 — DOCUMENTS + SUBMISSION `/stagiaire/documents`

Design: neat upload cards or drag-and-drop zones mirroring screenshot design, blue-accent dashed border, upload progress/feedback, file list rows with icon/filename/size/date and `Voir`, `Télécharger`, `Supprimer` while draft. Required specification examples include **CV, Lettre de motivation, Convention de stage, CIN, Attestation de scolarité**; show which are required vs optional, explain policy, and do not collect a CIN by default unless there is a documented legitimate business need. Show a final `Récapitulatif` with validation summary and prominent `Envoyer la demande` with confirmation modal.

Behavior: drag/drop and picker, upload progress (if supported), validation against configured max size, allowlist of file types, true MIME/content inspection where feasible, randomized storage object keys, ownership attached to application, storage limits and safe download. Use **private** storage bucket(s); no public bucket, permanent public download links or storing client-supplied paths as trusted authority. Perform auth/authorization check before issuing short-lived signed download URLs or serving private files. Protect against traversal, overwritten filenames, SVG/HTML script uploads, zip bombs and malicious documents. If full malware scanning isn't available on free infrastructure, restrict types, use safe download disposition, avoid executing/rendering untrusted files, document the residual risk and never claim scanning exists. Provide file deletion/update only while user may edit the draft. On submission, atomically validate all mandatory fields/docs and change state exactly once. Double-click submission must not create two applications.

## SCREEN 8 — APPLICATION TRACKING `/stagiaire/suivi`

Design: title `Suivi de ma demande`, large horizontal desktop timeline with stages `Brouillon` → `Envoyée` → `En cours d'examen` → `Acceptée` or `Refusée`. (The screenshot may visually position Acceptée and Refusée in sequence; logically they are **alternative terminal outcomes**, not consecutive stages.) Show a prominent status message, last-updated time, `Détails de la demande` card with stage type, domain, start/end/duration, and `Documents` list of safely accessible file attachments. Adapt tracker vertically for mobile.

Behavior: represent only persisted real state, with event history timestamps. If accepted, friendly green confirmation `Votre demande de stage a été acceptée`; if rejected, accessible red result and **public-safe refusal reason** if one was provided. Internal administrator-only notes must never appear here. Draft shows a `Finaliser et envoyer` CTA. Submitted/under-review shows truthful pending message, not fabricated review estimates. Update after page refresh and optionally refetch, with accessible screen reader status. Preserve time zone and French date formatting.

## SCREEN 9 — ADMIN DASHBOARD `/admin/tableau-de-bord`

Design: navy sidebar with `Tableau de bord`, `Toutes les demandes`, `Statistiques` if implemented, `Utilisateurs` only if implemented, `Paramètres` only if implemented, `Déconnexion`; white workspace and topbar. KPI cards consistent with sample: `Total des demandes`, `En attente` (sent but not yet reviewed), `En examen`, `Acceptées`, `Refusées`. Illustration numbers 125 / 18 / 25 / 60 / 22 are **mock values only**; never hardcode them as production data. Main grid includes `Évolution des demandes` line/area chart and `Répartition des statuts` doughnut/pie chart with clear labels and empty states. Add recent request table/quick links if space consistent with reference.

Behavior: all figures computed from authorized DB queries with no client-side security assumptions. Use a consistent mapping: database `SUBMITTED` = interface `Envoyée` or `En attente`, not a new unrelated status. Filters/date range optional if real and useful. Refresh state on updates, show `0` and meaningful empty charts for a new installation. Handle large datasets by aggregated server queries, not fetching every document or all applicants into the browser.

## SCREEN 10 — ADMIN APPLICATION LIST `/admin/demandes`

Design: match screenshot `Toutes les demandes`, search bar `Rechercher un stagiaire...`, aligned dropdowns for `Statut`, `Type de stage`, `Date` and explicit `Filtrer`/`Réinitialiser`. Table columns e.g. `Stagiaire`, `Formation`, `Type`, `Date de début`, `Statut`, `Actions`; avatar/initials where appropriate; tasteful colored badges; rows with `Voir` icon/button. Pagination at bottom with total results text and selected page.

Behavior: authenticated admin only; genuine database-backed search by nom, prénom, email, formation; filters for statut, formation, type de stage and date; server-side sorting and pagination (e.g., 10–25/page), safe bounds, parameterized queries, normalized search, clear empty/no-result state. Click opens correct detailed application. Avoid SQL interpolation, leaking file URLs in list responses, and showing data only according to policy. Provide safe CSV export only if deliberately added and authorized; beware spreadsheet formula injection.

## SCREEN 11 — ADMIN APPLICANT DETAIL + DECISION `/admin/demandes/[id]`

Design: reference shows title `Détails du stagiaire`, `Retour`, two-column layout: personal contact card/avatar plus academic information on one side, request details + documents on other. Show `Informations personnelles` (nom, prénom, email, téléphone, adresse), `Informations académiques` (établissement, formation, niveau, spécialité), `Demande de stage` (type, domaine, dates, durée, motivation, status), private `Documents` attachments. Add human-readable application ID and created/submitted dates if practical.

Top-level admin actions: `Commencer l'examen` (available from submitted state), `Accepter la demande` (green), `Refuser la demande` (red). Screenshot final decision is a separate compact modal with candidate/context, decision buttons and `Raison du refus` textarea. Implement matching modal or drawer with explicit confirm and cancel, disabled/busy state, validation and feedback. **Make refusal reason mandatory as a proposed UX improvement**; expose only the intended public explanation to the stagiaire, and keep any extra private internal note separate. Allow reviewing attached files through authorization-checked, short-lived links. Never expose raw database/Storage administrative keys.

Behavior: implement exact authorized state transitions and idempotent, atomic updates, ideally transaction/RPC or other properly synchronized server-side operation. Require application currently at `SUBMITTED` to mark `UNDER_REVIEW`; allow `UNDER_REVIEW` → `ACCEPTED` or `REJECTED` (optionally `SUBMITTED` → final only if product owner approves a direct-decision rule). No invalid backward transitions or toggling final statuses without a separate secure audited reopening feature. Show friendly conflict response if another admin acted first. Record actor, timestamp, previous/new state and reason in audit history. Decision should immediately reflect in admin KPI/list and stagiaire tracking. Optional email/in-app notification is additive, never a substitute for persisted state.

## CANONICAL WORKFLOW — ENFORCE ON CLIENT, SERVER AND DATABASE

Use a single canonical enum and mapping, for example:

| Internal status | French display | Who may trigger |
|---|---|---|
| `DRAFT` | Brouillon | Stagiaire creates/edits own |
| `SUBMITTED` | Envoyée / En attente | Stagiaire explicitly submits validated draft |
| `UNDER_REVIEW` | En cours d'examen | Admin starts review |
| `ACCEPTED` | Acceptée | Admin makes final decision |
| `REJECTED` | Refusée | Admin makes final decision |

Transitions:
- `DRAFT → SUBMITTED` only by submitting stagiaire after server validations.
- `SUBMITTED → UNDER_REVIEW` only by admin.
- `UNDER_REVIEW → ACCEPTED` or `UNDER_REVIEW → REJECTED` only by admin.
- `ACCEPTED` / `REJECTED` are terminal in MVP. Admin may not rewrite audit history.

This is deliberately **five states**, not six: `En attente` is a visual label for `SUBMITTED`, not a separate DB state. Buttons must appear and be enabled only for legal transitions, and server/DB must reject forged transition requests even when UI controls are hidden. Do not reset a candidate's timeline when editing a draft.

## DATABASE & AUTHORIZATION DESIGN

Design SQL migrations with explicit types, keys, checks, timestamps and indexes. Reasonable starting entities:

- `profiles`: auth user id (FK to auth.users), first_name, last_name, phone, optional address, optional birth_date, school, program/formation, study_level, specialty, created_at, updated_at. Self-editable fields explicit.
- `user_roles` (or similarly protected role table): user_id and role `stagiaire|admin`; **never client-writable**; authenticated claims alone aren't sufficient unless verified. Default signup receives stagiaire with tamper-resistant DB/server logic. Manually bootstrap first admin with a documented, audited operator-only process, not a public endpoint.
- `internship_applications`: id UUID, applicant_id, type, domain, start_date, end_date, duration if needed, motivation, submitted academic snapshot fields, canonical status, submitted_at, reviewed_at, decided_at, decided_by, public_rejection_reason, created_at, updated_at, optional `version` for concurrency.
- `application_documents`: id UUID, application_id, uploader_id, document_type, storage_key, original_name (for safe display only), MIME/content type, bytes, created_at; storage permissions distinct from DB metadata.
- `application_status_history`: immutable append-only event id, application id, from_status, to_status, actor id, timestamp, public note when appropriate; never let users rewrite events.
- Optional `notifications` (recipient_id, type, application_id, read_at, created_at) and `admin_private_notes`, isolated under admin RLS.
- Optional `audit_events` for security-significant mutations without including raw uploaded document content, session tokens or passwords.

Add indexes on applicant id/status/submitted date, list search keys and document application id; add foreign key cascades carefully (never silently delete application history). Use UTC timestamps in storage and locale-aware formatting in UI. Set an explicit data-retention policy and document it.

**RLS and policies are critical.** Enable RLS for every custom table. Self access must use `auth.uid()` and protected columns. Admin access must check a **trusted** server/DB role lookup; avoid recursive RLS policies and insecure `SECURITY DEFINER` functions. For any security-definer RPC, set a safe `search_path`, explicitly check `auth.uid()`/authorization and validate arguments. Revoke public execution where not intended. Do not allow a normal stagiaire to update `status`, `applicant_id`, `decided_by`, `public_rejection_reason`, `role`, or other privileged fields merely by sending extra JSON keys. Use server-owned mutation APIs and/or column-level privileges/RPCs so RLS row ownership checks do not become column write vulnerabilities. Test anonymous, owner, different-user and admin policies. **Test the real Storage policies too**: private bucket, per-owner upload while draft, admin review read, no public list/read, and safe signed download issuance.

Whenever a Server Action or route handler reads/mutates resources, recheck session **and** role **and** specific resource ownership. Never assume that a hidden link, middleware check alone, or client supplied UUID is sufficient. Validate Zod inputs on the server and wrap decisions in DB transactions/atomic RPCs as required.

## SECURITY THREAT MODEL AND IMPLEMENTATION RULES

**Identity and sessions**
- Use Supabase Auth's supported server-side session architecture with secure cookie handling, validated identity and verification flow. Do not hand-roll password hashes or access token logic. Protect against fixation/session confusion; redirect securely, never to arbitrary untrusted URLs.
- Role and ownership authorization must be enforced on reads, writes, previews, downloads and file deletions. No admin privilege through query parameters, headers or registration form.
- Throttle logins, signups, password resets, document uploads and expensive search/decision endpoints using a deployment-compatible solution, not a process-local counter that fails across serverless instances. Use provider-level edge/WAF/DDoS defenses where available; **do not claim code alone guarantees DDoS protection**.

**Input, output and browser security**
- Strict server-side validation, size caps, maximum list page size, schema allowlisting, correct escaping by React, no unsanitized `dangerouslySetInnerHTML`, and parameterized SQL. Avoid exposing PII in error output, structured logs, analytics or public metadata.
- Configure tested security headers: appropriate Content Security Policy compatible with Next.js/Supabase, `X-Content-Type-Options: nosniff`, Referrer-Policy, Permissions-Policy and clickjacking protection via CSP `frame-ancestors`. HSTS on HTTPS production only. Use CORS narrowly and only where required.
- All state-changing server endpoints need session checks plus appropriate CSRF/origin defense when cookie-authenticated; rely on supported framework safeguards and verify their deployment assumptions. Never bypass secure checks merely to make a test pass.
- No hardcoded secrets, demo admin passwords, publicly accessible `.env` files, plaintext credentials, unreviewed dependency install scripts, or sensitive key values in generated screenshots/test fixtures.

**Sensitive files and privacy**
- Always private by default. Validate actual file content where feasible; guard MIME spoofing and extensions; set storage size limits and rate limits. Download by authenticated proxy or short-lived URL authorized on each request; safe `Content-Disposition`, sanitize display filename, no path concatenation using untrusted filenames.
- Identity cards (CIN), birth dates, phone numbers and addresses are personal data. Minimize collection, gate visibility by least privilege, define retention/deletion/export handling, and add privacy notice. Do not claim legal compliance without review (consider Moroccan law 09-08/CNDP and GDPR when applicable).
- Distinguish **public candidate-visible rejection reasons** from private admin-only notes, and never leak other applicants' information to trainees.

**Operations**
- Use separate dev/staging/prod environments, migrations checked into git, Supabase backups/restore plan, basic audit logging, dependency scanning and secrets scanning. Ensure build/test scripts never print credentials. Prepare safe `.env.example`, `.gitignore`, and documented admin bootstrap. Prevent unauthorized production migrations/deletions. Review error handling for information disclosure.

## NOTIFICATIONS, QUALITY-OF-LIFE IMPROVEMENTS AND SCOPE PRIORITY

After the eleven essential screens function securely, add these enhancements in priority order if feasible. Mark them clearly as **proposed improvements beyond the initial cahier des charges**, not original requirements:

1. **Mandatory reason for rejection** (public-safe), confirmation dialog, prevention of accidental double decisions, full decision history.
2. **Server-persisted draft** with progress indicator, resume behavior and `last saved` timestamp.
3. **Real-time-feeling feedback** using refetch/revalidation, toasts, accessible progress and status messages; avoid fragile websocket complexity unless necessary.
4. **In-app notifications** and optional email when request is submitted, reviewed, accepted or rejected. Email integration can be added behind configuration with verified domain and robust retry/outbox; never display `email sent` if it was only queued or disabled. Do not make stage decisions depend on successful email delivery.
5. **Better admin efficiency:** debounced query search, clear filters, pagination, saved review notes, simple metrics, document preview/download authorization, updated-at labels.
6. **Accessibility & localization:** semantic landmarks, labels, error summaries, keyboard dialog, screen reader status, reduced motion, French dates and accessible contrast.
7. **Privacy/account controls:** data retention documentation, optional self-export, request deletion process and admin accountability.

Avoid feature bloat: no company marketplace, payment/billing, public recruiter signups, AI scoring of applicants, live chat, extra roles, invented approval hierarchies or integrations unless explicitly requested. This is a company-internal internship application workflow, not a job board.

## API / SERVER ACTIONS — FUNCTIONAL CONTRACT

Define a small, documented contract. You may use Next Server Actions/RPCs rather than REST; the security guarantees must remain identical:

- `signUpStagiaire` — validates fields and creates a regular role only.
- `signIn` / `signOut` / `requestPasswordReset` — auth workflows.
- `getOwnProfile`, `updateOwnProfile` — owner-only editable fields.
- `getCurrentApplication`, `createDraft`, `updateDraft`, `submitApplication` — candidate-only, only legal statuses, transactional validation.
- `uploadApplicationDocument`, `deleteDraftDocument`, `getAuthorizedDocumentDownload` — user/role/ownership and file constraints.
- `getOwnApplicationHistory` — candidate-only accurate timeline/status.
- `getAdminDashboardStats` — aggregated admin-only.
- `listAdminApplications` — admin-only paginated filtered search.
- `getAdminApplicationDetails` — admin-only applicant/full request/documents.
- `startReview`, `acceptApplication`, `rejectApplication` — transactional admin-only legal transitions, status history and conflict responses.
- `listNotifications`, `markNotificationRead` only if notification functionality exists.

Return shaped DTOs that exclude internal notes, role control data, secrets and unrelated users. Never return an entire row/object by default when a curated response is safer. Support consistent typed result/error patterns and optimistic concurrency for critical transitions.

## QUALITY GATES, TEST MATRIX AND ACCEPTANCE CRITERIA

Implement tests with **real assertions** rather than smoke tests that only verify a page renders:

**Public/auth:** guest routes render; validation errors; successful stagiaire signup + login; duplicate/weak password behavior; role redirect; logout; bad credentials; password reset flow or a clearly documented provider dependency.

**Stagiaire:** user edits own profile, starts a request, saves/resumes draft, step validations, uploads allowed documents, rejects blocked file extension/oversized upload, deletes own draft attachment, reviews summary, submits once, sees updated status, cannot modify post-submission content, sees accepted/rejected outcome and public-safe reason.

**Admin:** admin dashboard counts match fixture DB; search by name/formation; filters/status/pagination work; read applicant and authorized documents; mark submitted as in review; approve/reject with modal; refusal reason enforced; status counts update; second overlapping decision fails safely; audit history correctly records actor and transition.

**Attack-focused negative cases:** guest direct navigation to `/admin/*` and API access; stagiaire `/admin` access; stagiaire requesting another person's profile/application/file by changing an id; forged `role=admin` on registration/profile save; forged status update; candidate editing after submission; guest or candidate guessing a Storage path; role bypass via direct route-handler action; invalid redirect URLs; malicious file types and huge payloads; repeated submission; expired session; invalid filter query and pagination. Run **database RLS tests** under anonymous, trainee A, trainee B and admin identities, plus storage access tests.

**UI/accessibility:** desktop and mobile screenshots for all 11 essential pages; navigation buttons work; no broken links; keyboard navigation and focus trap in modal; associated form labels; screen-reader-friendly errors and badges; empty/loading/error states; no runtime console errors; chart no-data handling; real French labels.

**Build:** `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`, and Playwright E2E where supported. Diagnose real failures, do not mark passed unless command succeeded. If tests need Supabase credentials or a live test instance, isolate safely and record the blocker rather than simulate success.

**Visual comparison:** capture browser screenshots around **1600×1000** matching source ratio, compare each page to its supplied image side by side, refine spacing/colors/proportions/typography. Then test approximately 1440px, 1024px, 768px, 390px and 360px widths. Do not rely solely on screenshot resemblance: test real click paths. Maintain a `docs/DESIGN_REFERENCE_MAP.md` recording which real file corresponds to which screen and notable intentional deviations.

## REQUIRED PROJECT STRUCTURE (ADAPT IF EXISTING CODE ALREADY WORKS)

A reasonable directory tree:

```text
stage project/
├── stageflow_11_mockups/         # original reference images, DO NOT modify
├── stageflow_admin_pages/        # original reference images, DO NOT modify
├── stageflow_public_pages/       # original reference images, DO NOT modify
├── app/
│   ├── (public)/                 # homepage, login, signup, recovery, legal
│   ├── (stagiaire)/stagiaire/    # protected trainee dashboard/profile/request/docs/tracking
│   ├── (admin)/admin/            # protected admin dashboard/list/detail
│   ├── api/                      # only necessary secure handlers
│   ├── layout.tsx
│   ├── globals.css
│   ├── not-found.tsx
│   └── error.tsx
├── components/
│   ├── ui/                       # design primitives
│   ├── public/
│   ├── stagiaire/
│   └── admin/
├── lib/
│   ├── auth/
│   ├── db/
│   ├── supabase/
│   ├── validation/
│   ├── permissions/
│   └── utils/
├── supabase/migrations/          # versioned, reversible-aware SQL migrations
├── tests/                        # unit + integration + RLS
├── e2e/                          # Playwright
├── docs/
│   ├── REQUIREMENTS_TRACEABILITY.md
│   ├── IMPLEMENTATION_PLAN.md
│   ├── ARCHITECTURE.md
│   ├── DESIGN_REFERENCE_MAP.md
│   ├── SECURITY.md
│   ├── DATABASE.md
│   ├── LEARNING_GUIDE.md
│   ├── TEST_REPORT.md
│   └── DEPLOYMENT.md
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

Do not copy duplicate reference files into the production `public/` folder if they're not actual in-app media. Keep `public/` only for legitimate icons/artwork. Ensure route groups do not accidentally create duplicate path collisions.

## IMPLEMENTATION ORDER — WORK MILESTONE BY MILESTONE

**Milestone 0 — inventory and decisions:** verify exact Windows root; inventory 11 images; find authoritative cahier; detect existing git/source; map 11 screens and workflow; record tradeoffs; produce concise plan. Show me the page reference map and current project state before major refactor.

**Milestone 1 — foundation and visual system:** initialize/repair app, strict TypeScript, Tailwind/tokens, shared layouts/components, header/sidebar/topbar, navigation, responsiveness. Implement homepage + login/signup visuals with non-destructive placeholder content where necessary. Ensure screenshots are recognizable; run basic build checks.

**Milestone 2 — database/auth/RLS:** create dev Supabase setup instructions, migrations, RLS policies, secure admin bootstrap, auth callbacks/middleware or proxy as appropriate to current Next version, protected layouts, no role escalation. Add RLS/role tests before building privileged admin mutations.

**Milestone 3 — trainee experience:** real profile CRUD, request wizard with server-persisted draft, required validations, private document uploads, submission workflow, tracking page. Every button must be connected, and mock data removed from live views.

**Milestone 4 — admin experience:** real KPI queries, search/filter/pagination, candidate detail, secure document access, transactional review/accept/reject with reason/history. Verify status cross-updates between roles and reject concurrent duplicate decisions.

**Milestone 5 — hardening and completeness:** responsive polish against every screenshot; error/empty/loading states; password reset; security headers; rate limits; privacy/legal placeholders; notification enhancement if feasible; tests and accessibility checks.

**Milestone 6 — release preparation:** run scripts and E2E tests, document environment variables and production-safe migration steps, publish architecture/security/deploy docs, produce final honest pass/fail checklist and remaining blockers. Do not claim 'production-ready' with missing auth, RLS, file authorization or unchecked migrations.

At the end of **each** milestone send me a compact report: (a) what changed, with paths; (b) which pages work with real data versus placeholders; (c) commands/tests run and actual results; (d) visible screenshots if you can generate them; (e) remaining risks/blockers; and (f) the next milestone. Continue implementation after reporting unless waiting on truly essential credentials or a decision. Aim for the completed application, not only milestone 0 documentation.

## FINAL DEFINITION OF DONE

You are finished only when:

- The **11 primary screens** are implemented as real responsive pages closely following their specific mockups, plus secure supporting screens.
- Public → signup → authentication → trainee dashboard → profile → draft request → upload documents → explicit submission → tracking works with durable database state.
- Admin login → real analytics → searchable paginated applications → full candidate detail → protected documents → under review → accept/reject with reason works and the trainee sees the correct outcome.
- No trainee can read/change another trainee's data or any admin-only resource, even through forged HTTP requests or direct database/storage access. Admin creation is trusted only. Private document access is authenticated and authorized.
- Database migrations, authorization policies, complete sample fixtures (dev/test only), logs and a reliable safe setup process are in place.
- Responsive UI, meaningful French text, keyboard/accessibility, error/loading/empty states, no dead links, and consistent design tokens are verified.
- Typechecking/lint/tests/build results are reported truthfully; unresolved integration blockers are explicit.
- The original mockup folders remain unchanged.
- `README.md` clearly explains local setup, Supabase configuration, scripts, first admin creation, tests, env vars, deployment and the application workflow.

**START NOW:** First inspect `C:\Users\S P A R O\Desktop\stage project`, enumerate the 3 reference directories, identify all 11 distinct designs, and state what actual files you found. Then create/update the implementation plan and begin building the website page-by-page, starting with shared design components and the homepage. Do not stop after producing only a plan or ask me to re-explain pages already described above.
