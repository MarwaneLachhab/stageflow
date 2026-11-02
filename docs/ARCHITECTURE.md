# Architecture

## 1. Vue d'ensemble

StageFlow est une application web de gestion des demandes de stage, en français,
à deux rôles : **Stagiaire** et **Administrateur**.

```
┌─────────────────────────────────────────────────────────────┐
│                    Navigateur (React 19)                    │
│   Server Components par défaut · Client Components ciblés   │
└───────────────────────────┬─────────────────────────────────┘
                            │ HTTPS · cookies de session
┌───────────────────────────▼─────────────────────────────────┐
│                    Next.js 15 (App Router)                  │
│  ┌──────────────┬───────────────┬────────────────────────┐  │
│  │  middleware  │  Server       │  Route Handlers        │  │
│  │  (session +  │  Actions      │  /api/documents/[id]   │  │
│  │  en-têtes)   │  (mutations)  │  /api/auth/signout     │  │
│  └──────────────┴───────────────┴────────────────────────┘  │
└───────────────────────────┬─────────────────────────────────┘
                            │ @supabase/ssr (cookies)
┌───────────────────────────▼─────────────────────────────────┐
│                        Supabase                             │
│  ┌────────────┐  ┌──────────────┐  ┌─────────────────────┐  │
│  │  Postgres  │  │     Auth     │  │  Storage (privé)    │  │
│  │  + RLS     │  │  JWT vérifié │  │  application-       │  │
│  │  + RPC     │  │              │  │  documents          │  │
│  └────────────┘  └──────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## 2. Principes directeurs

### La sécurité est appliquée par la base de données, pas par l'interface

Chaque table porte une politique de sécurité au niveau ligne (RLS) activée. Une
requête qui contourne l'application — un appel REST direct avec le jeton de
l'utilisateur — se heurte aux mêmes règles. L'interface n'est jamais le point
d'application de la sécurité.

**Corollaire** : chaque fonction d'accès aux données utilise le client lié à la
session de l'utilisateur. Si un filtre venait à manquer dans une requête, ce
serait un défaut de présentation, pas une fuite : la base refuserait de renvoyer
les lignes d'autrui.

### Le rôle ne provient jamais de la requête

Le rôle est lu dans la table `user_roles`, elle-même **dépourvue de toute
politique d'écriture**. Un client ne peut pas s'attribuer un rôle : il n'existe
aucun chemin d'écriture. Trois verrous complémentaires :

1. aucune politique `INSERT`/`UPDATE` sur `user_roles` ;
2. un déclencheur `prevent_role_self_assignment()` qui rejette les sessions
   `authenticated` et `anon` ;
3. `promote_to_admin()` révoquée de `public`, `anon` et `authenticated`.

Un jeton forgé contenant `role: "admin"` n'a aucun effet : le rôle est relu en
base à chaque requête, et le repli est **restrictif** (rôle inconnu → `stagiaire`).

### La clé de service ne quitte jamais le serveur

`createAdminClient()` refuse de s'exécuter si `window` est défini, et retourne
`null` lorsque la clé est absente. Il n'est utilisé que pour deux opérations,
**après** qu'une vérification d'autorisation a déjà eu lieu :

- téléverser ou supprimer un objet de stockage privé ;
- résoudre l'adresse e-mail d'un candidat (déjà administrateur prouvé).

Il n'est **jamais** utilisé pour lire des données au nom d'un utilisateur : cela
contournerait la RLS et ferait porter l'autorisation à l'application seule.

## 3. Organisation des fichiers

```
app/
  (public)/              Pages accessibles sans session
    page.tsx             Écran 01 — accueil
    inscription/         Écran 02
    connexion/           Écran 03
    mot-de-passe-oublie/
    reinitialiser-mot-de-passe/
    verification-email/
    conditions-utilisation/
    confidentialite/
  (stagiaire)/stagiaire/ Espace stagiaire (protégé)
    layout.tsx           Contrôle d'accès réel
    tableau-de-bord/     Écran 04
    profil/              Écran 05
    demande/             Écran 06
    documents/           Écran 07
    suivi/               Écran 08
  (admin)/admin/         Espace administration (protégé)
    layout.tsx           Contrôle d'accès réel
    tableau-de-bord/     Écran 09
    demandes/            Écran 10
    demandes/[id]/       Écran 11
    statistiques/
  api/
    auth/signout/        Déconnexion (POST uniquement)
    documents/[id]/      Proxy de téléchargement contrôlé
  auth/callback/         Échange PKCE / vérification OTP

components/
  ui/                    Primitives sans logique métier
  public/                Formulaires publics
  stagiaire/             Composants de l'espace stagiaire
  admin/                 Composants de l'espace administration
  app-shell.tsx          Coque applicative (barre latérale, en-tête)

lib/
  constants.ts           États, libellés, règles d'upload
  env.ts                 Accès aux variables d'environnement
  auth/                  Session, actions, limitation de débit
  permissions/           Machine à états, règles de routes
  validation/            Schémas Zod, inspection des fichiers
  db/                    Accès aux données
  actions/               Server Actions (mutations)
  supabase/              Clients navigateur/serveur/middleware

supabase/migrations/     Schéma, index, RPC, RLS, amorçage admin
docs/                    Cette documentation
```

## 4. Cycle de vie d'une demande

Cinq états, pas six.

```
   ┌─────────┐  soumettre   ┌───────────┐  prendre en charge  ┌──────────────┐
   │ DRAFT   │─────────────▶│ SUBMITTED │────────────────────▶│ UNDER_REVIEW │
   │Brouillon│              │  Envoyée  │                     │  En examen   │
   └─────────┘              └───────────┘                     └──────┬───────┘
        │                        │                                 │
        │                        │        décider                  │ décider
        │                        ▼                                 ▼
        │                  ┌──────────────┐   ┌──────────────┐
        │                  │  ACCEPTED    │   │  REJECTED    │
        │                  │  Acceptée    │   │  Refusée     │
        │                  └──────────────┘   └──────────────┘
        │                     (terminal)        (terminal)
        └── un brouillon peut aussi être décidé directement (dossier incomplet)
```

### Transitions autorisées

| Action | Depuis | Vers | Acteur |
| --- | --- | --- | --- |
| `SUBMIT` | `DRAFT` | `SUBMITTED` | stagiaire (propriétaire) |
| `START_REVIEW` | `SUBMITTED` | `UNDER_REVIEW` | admin |
| `ACCEPT` | `SUBMITTED`, `UNDER_REVIEW` | `ACCEPTED` | admin |
| `REJECT` | `SUBMITTED`, `UNDER_REVIEW`, `DRAFT` | `REJECTED` | admin |

Toute autre transition est refusée. La table `TRANSITIONS`
(`lib/permissions/index.ts`) est vérifiée côté application, et **de nouveau**
dans chaque fonction PostgreSQL.

### Une seule demande active par candidat

Un index unique partiel garantit qu'un candidat ne peut avoir qu'une demande
dans un état non terminal :

```sql
CREATE UNIQUE INDEX applications_one_active_per_applicant
  ON internship_applications (applicant_id)
  WHERE status IN ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW');
```

C'est la base de données qui empêche les doublons, pas l'interface.

### Concurrence optimiste

Chaque mutation porte le statut observé :

```ts
decideApplication({ applicationId, decision, publicReason, expectedStatus })
```

La fonction SQL verrouille la ligne (`SELECT … FOR UPDATE`), compare
`expected_status` au statut réel, et rejette l'appel en cas de divergence. Deux
administrateurs qui ouvrent le même dossier et décident simultanément : le second
reçoit un message lui demandant d'actualiser, plutôt que d'écraser silencieusement
la décision du premier.

## 5. Choix techniques

### Server Components par défaut, Client Components ciblés

Presque toutes les pages sont des Server Components : elles lisent la base
directement, sans API intermédiaire, et n'envoient au navigateur que le HTML
nécessaire. Les Client Components sont réservés à ce qui exige réellement de
l'interactivité :

| Composant | Raison |
| --- | --- |
| formulaires publics | état de saisie, retour d'erreur |
| `application-wizard` | assistant multi-étapes, sauvegarde du brouillon |
| `documents-manager` | envoi de fichiers, progression |
| `profile-form` | état modifié, indicateur de complétude |
| `admin-filters` | filtres réactifs, anti-rebond |
| `decision-panel` | dialogue de confirmation, saisie du motif |
| `dashboard-charts` | Recharts mesure le DOM |
| `app-shell` | tiroir mobile, menus |

### Validation à trois niveaux

1. **Navigateur** — Zod + React Hook Form : retour immédiat, confort.
2. **Serveur** — les mêmes schémas rejoués dans la Server Action : jamais faire
   confiance au client.
3. **Base de données** — contraintes `CHECK` et déclencheurs : dernier rempart.

Le contrôle côté navigateur est **un confort d'usage, pas une sécurité**. Le
retirer ne changerait rien à la robustesse du système.

### Inspection du contenu réel des fichiers

L'extension et le type MIME déclaré par le navigateur sont trivialement
falsifiables. Le serveur lit donc les **premiers octets** du fichier :

```ts
const MAGIC_BYTES = {
  pdf: [0x25, 0x50, 0x44, 0x46],        // %PDF
  png: [0x89, 0x50, 0x4e, 0x47],        // ‰PNG
  jpg: [0xff, 0xd8, 0xff],              // JPEG
}
```

Un fichier `.pdf` dont les octets ne commencent pas par `%PDF` est rejeté.

### Le stockage reste privé

Le bucket `application-documents` a `public = false`. Les téléchargements passent
par `/api/documents/[id]`, qui :

1. vérifie la session ;
2. valide le format de l'identifiant avant de toucher la base ;
3. lit la ligne via le client de l'utilisateur (donc RLS : propriétaire ou
   administrateur) ;
4. télécharge le binaire côté serveur ;
5. le transmet avec `Content-Disposition: attachment`,
   `X-Content-Type-Options: nosniff` et
   `Content-Security-Policy: default-src 'none'; sandbox`.

**Pourquoi pas des URL signées ?** Une URL signée devient, une fois émise, un
laissez-passer valable pour quiconque la possède : elle vit dans l'historique du
navigateur, les journaux des proxies, les en-têtes `Referer`. Le proxy, lui,
revalide l'autorisation à chaque requête.

### Clés de stockage générées par le serveur

Le client ne choisit jamais le chemin de destination. Le serveur compose :

```
<id_utilisateur>/<id_demande>/<TYPE>-<16_hex_aléatoires>.<extension>
```

Conséquences :

- un nom de fichier hostile (`../../autre.pdf`) ne peut pas provoquer de
  traversée de chemin ;
- deux fichiers du même nom ne s'écrasent jamais ;
- la fonction `register_document()` vérifie que la clé commence bien par
  `<uid>/<appid>/` avant d'enregistrer la ligne.

### Limitation de débit honnêtement documentée

`lib/auth/rate-limit.ts` implémente un compteur **en mémoire, par processus**.
C'est une mesure de confort, pas une garantie. En déploiement serverless, chaque
instance possède son propre compteur : la limite effective est multipliée par le
nombre d'instances.

Le fichier énonce explicitement cette limite et liste les défenses qui, elles,
tiennent :

- mots de passe hachés par Supabase Auth (bcrypt) ;
- délai progressif côté fournisseur d'authentification ;
- messages d'erreur génériques (pas d'énumération de comptes) ;
- journal d'audit des décisions administratives.

Un déploiement à grande échelle devrait remplacer ce module par un compteur
partagé (Redis, Upstash) derrière la même interface.

## 6. Limites connues

Documentées ici parce qu'un système dont on ignore les limites est un système
qu'on ne peut pas exploiter sereinement.

| Limite | Impact | Atténuation / suite |
| --- | --- | --- |
| Pas d'analyse antivirus | Un PDF malveillant pourrait être stocké | Types restreints, disposition `attachment`, `nosniff`, CSP `sandbox` ; analyse antivirus à ajouter |
| CSP avec `'unsafe-inline'` | Protection XSS réduite | Exigence du streaming Next.js ; un nonce lèvera la contrainte |
| Limitation de débit par processus | Contournable en serverless | Remplacer par un compteur partagé |
| Aucune référence maquette en mobile | Le responsive relève de la conception, pas de la reproduction | Points de rupture testés un par un |
| Docker indisponible sur cette machine | Pas de CLI Supabase local, donc pas de suite RLS automatisée exécutée | Blocage explicite ; nécessite un projet Supabase distant |
| Pages légales en brouillon | Non conformes en l'état | Marquées « version préliminaire », citent la loi 09-08 sans prétendre à la conformité |
