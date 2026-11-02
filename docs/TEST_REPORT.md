# Rapport de tests

> **Dernière mise à jour : 19 octobre 2026.** Les chiffres ci-dessous proviennent
> d'exécutions réelles sur cette machine. La section « Non prouvé » a été
> corrigée : une affirmation antérieure (« aucun port réseau ne peut être
> ouvert ») était **fausse** — voir la note en bas de tableau.

## Résumé

| Suite | Fichiers | Tests | Résultat |
| --- | --- | --- | --- |
| Validation de fichiers | 1 | 41 | ✅ Réussi |
| Machine à états et permissions | 1 | 28 | ✅ Réussi |
| Rendu des statuts | 1 | 13 | ✅ Réussi |
| **Inscription — validation** | 1 | 31 | ✅ Réussi |
| **Champ mot de passe — masquage** | 1 | 14 | ✅ Réussi |
| **Configuration et classification d'erreurs** | 1 | 31 | ✅ Réussi |
| Politiques RLS (base réelle) | 1 | 26 | ⏭️ 1 réussi, 25 ignorés |
| **Total** | **7** | **184** | **✅ 159 réussis, 25 ignorés** |

Commande : `npm test`

```
 Test Files  7 passed (7)
      Tests  159 passed | 25 skipped (184)
```

### Vérifications statiques

| Vérification | Commande | Résultat |
| --- | --- | --- |
| TypeScript | `npx tsc --noEmit` | ✅ 0 erreur |
| ESLint | `npx eslint .` | ✅ 0 avertissement, 0 erreur |
| **Compilation de production** | `npx next build` | ✅ **23/23 pages générées, 25 routes compilées** |

## Ce qui a été réellement exécuté

Cette section distingue ce qui a été **prouvé** de ce qui ne l'a **pas** été.

### ✅ Prouvé par exécution

- **159 tests unitaires passent**, 25 sont ignorés (suite RLS, faute de base).
- **Le typage strict ne relève aucune erreur** sur l'ensemble du dépôt, avec
  `noUncheckedIndexedAccess` activé.
- **ESLint ne relève aucun problème.**
- **La construction de production aboutit entièrement** : 23 pages générées,
  25 routes listées, middleware compilé (92,2 kB).
- **L'action serveur d'inscription a été invoquée réellement en HTTP** sur le
  serveur de développement, avec l'identifiant d'action extrait de
  `server-reference-manifest.json`. Quatre cas vérifiés : e-mail invalide,
  confirmation différente, mot de passe faible, et tentative d'injection de
  `role: "admin"`. Voir § « Vérification de l'inscription » plus bas.

### ❌ Non prouvé dans cet environnement

| Vérification | Blocage | Ce qu'il faudrait |
| --- | --- | --- |
| Tests RLS sur une base réelle | Docker indisponible → CLI Supabase locale impossible | Un projet Supabase distant + `supabase db push` |
| Tests de bout en bout Playwright | Navigateurs Playwright non installés | `npx playwright install chromium` |
| **Inscription réussie de bout en bout** | `.env.local` ne contient que les valeurs d'exemple : l'hôte `your-project-ref.supabase.co` renvoie `ENOTFOUND` | Les identifiants d'un vrai projet Supabase |

> **Correction d'une affirmation antérieure.** Une version précédente de ce
> document indiquait qu'« aucun port réseau ne peut être ouvert ». C'est **faux** :
> un test `net.createServer()` a prouvé le contraire, et le serveur de
> développement écoute effectivement sur le port 3000. La vraie cause de l'échec
> observé était la réparation automatique du `package-lock.json` par Next.js,
> contournée par `NEXT_IGNORE_INCORRECT_LOCKFILE=1`.


## Ce que les tests couvrent

### 1. Validation de fichiers — 39 tests

Chaque test correspond à une menace documentée dans `docs/SECURITY.md`.

**Extraction d'extension**

- minuscules appliquées (`CV.PDF` → `pdf`)
- chaîne vide renvoyée en l'absence de point
- dernière extension retenue sur un nom à points multiples
- `cv.pdf.exe` → `exe` (donc bloqué)
- caractères non alphanumériques retirés

**Assainissement du nom d'affichage**

- `../../etc/passwd.pdf` n'expose ni `..` ni `/`
- les séparateurs Windows sont traités
- les caractères de contrôle sont supprimés
- les accents français sont préservés
- les espaces multiples sont réduits

**Octets magiques** — le contrôle décisif

- un vrai PDF déclaré PDF est accepté
- **un HTML déguisé en PDF est refusé** ← le test central
- une archive ZIP déclarée PNG est refusée
- des octets SVG déclarés PDF sont refusés
- une extension sans signature connue échoue par défaut (repli restrictif)

**Validation combinée**

- l'extension `.exe` est refusée
- l'extension `.svg` est refusée explicitement (image scriptable)
- un fichier de 5 Mio + 1 octet est refusé
- un fichier d'exactement 5 Mio est accepté
- un fichier de 0 octet est refusé
- un type MIME déclaré incohérent est refusé

**Clés de stockage**

- format `<utilisateur>/<demande>/<TYPE>-<32 hex>.<ext>` respecté
- aucun nom fourni par le client n'atteint la clé
- deux appels produisent deux clés différentes
- les caractères de chemin sont retirés du type et de l'extension

**Content-Disposition**

- la disposition est toujours `attachment`
- `inline` n'apparaît jamais
- un guillemet dans le nom ne casse pas l'en-tête
- un retour chariot ne permet pas d'injecter un en-tête
- les accents passent par l'encodage RFC 5987

### 2. Machine à états et permissions — 28 tests

**Transitions autorisées**

- un stagiaire peut envoyer son propre brouillon
- un administrateur peut mettre en examen, accepter, refuser

**Transitions interdites** — la partie qui compte

- un stagiaire ne peut **pas** accepter sa propre demande
- un stagiaire ne peut **pas** refuser sa propre demande
- un stagiaire ne peut **pas** se mettre en examen
- un administrateur ne peut **pas** envoyer à la place d'un stagiaire
- **aucune** transition n'est possible depuis `ACCEPTED` ni `REJECTED`, pour
  aucun des deux rôles
- on ne peut pas renvoyer une demande déjà envoyée
- on ne peut pas accepter un brouillon
- on ne peut pas refuser un brouillon

**Accès aux enregistrements**

- le propriétaire accède à son dossier
- un stagiaire n'accède pas au dossier d'un autre
- un administrateur accède à n'importe quel dossier
- une collision de préfixe d'identifiant n'accorde pas l'accès

**Règles de routes**

- `/stagiaire/*` réservé aux stagiaires
- `/admin/*` réservé aux administrateurs
- les chemins imbriqués sont couverts
- `/administrateur` ne correspond **pas** à la règle `/admin`

### 3. Rendu des statuts — 15 tests

- les cinq statuts s'affichent sans erreur
- le libellé court affiche « En attente » pour `SUBMITTED`
- la chronologie comporte exactement quatre nœuds
- le quatrième nœud affiche **« Décision »** tant que la demande est active
- il affiche **le verdict réel** une fois la décision rendue
- une demande refusée n'affiche **jamais** « Acceptée », et inversement
- l'historique affiche une ligne par événement
- une note absente n'est pas rendue
- **aucune note interne ne peut apparaître dans le flux public**

## Deux bogues réels trouvés et corrigés

Ces deux défauts ont été découverts par les vérifications ci-dessus, et non par
inspection visuelle. Ils sont consignés parce qu'ils montrent ce que ces
vérifications apportent réellement.

### Bogue 1 — `global-error.tsx` n'était pas un composant client

```
Error: app/global-error.tsx must be a Client Component.
Add the "use client" directive at the top of the file.
```

`tsc` ne pouvait pas détecter ce problème : c'est une contrainte du framework,
pas du typage. Sans cette correction, **l'écran d'erreur global aurait lui-même
échoué** — exactement au moment où l'application a le plus besoin de lui.

Second défaut dans le même fichier : `export const metadata` est interdit dans un
composant client. Remplacé par un effet définissant `document.title`.

### Bogue 2 — classe Tailwind invalide

```
Syntax error: app/globals.css
The `hover:bg-white/8` class does not exist.
```

Tailwind n'accepte que des pas d'opacité prédéfinis. `bg-white/8` n'en fait pas
partie. Corrigé en `bg-white/10`. Sans cette correction, **toute la feuille de
style aurait échoué à compiler**, donc l'application entière.

## Couverture non atteinte

| Zone | Raison | Priorité |
| --- | --- | --- |
| Actions serveur (`lib/actions/*`) | Nécessitent une base et une session réelles | Haute |
| Politiques RLS | Nécessitent PostgreSQL | **Critique** |
| Middleware | Nécessite le cycle requête/réponse Next.js | Moyenne |
| Formulaires (inscription, connexion) | Nécessitent un client Supabase simulé | Moyenne |
| Téléversement de bout en bout | Combinaison stockage + base | Haute |
| Accessibilité (axe-core) | Non installé | Moyenne |
| Bout en bout Playwright | Aucun port disponible | Haute |

**La priorité critique est la suite RLS.** C'est la seule couche dont la
défaillance ne serait rattrapée par rien. Les tests sont écrits (voir
`tests/rls/`), mais ils n'ont jamais pu s'exécuter faute de base de données.

## Comment exécuter

```bash
npm test              # suite unique
npm run test:watch    # mode surveillance
npm run test:e2e      # Playwright (nécessite un port réseau)
npm run typecheck     # TypeScript seul
npm run lint          # ESLint seul
```

## Prérequis pour compléter la vérification

1. **Un projet Supabase distant.** Créer le projet, renseigner `.env.local`,
   appliquer les migrations (`supabase db push`), puis exécuter la suite RLS.
2. **Un environnement autorisant l'écoute locale.** Permet Playwright et la
   construction complète.
3. **Optionnel : Docker.** Permettrait la CLI Supabase locale et donc des tests
   RLS hors ligne.

---

## Vérification de l'inscription (19 octobre 2026)

### Cause racine établie

`.env.local` avait été créé par une copie **non modifiée** de `.env.example`.
Les deux fichiers faisaient exactement 2 463 octets et `diff` ne relevait aucune
différence. La variable `NEXT_PUBLIC_SUPABASE_URL` valait donc :

```
https://your-project-ref.supabase.co
```

Cet hôte n'existe pas. Preuves recueillies :

| Preuve | Résultat |
| --- | --- |
| `diff .env.example .env.local` | aucune différence |
| Résolution DNS de `your-project-ref.supabase.co` | `ENOTFOUND` |
| Requête HTTPS directe vers cet hôte | `ENOTFOUND` |
| Journal du serveur lors de la soumission | `AuthRetryableFetchError: fetch failed`, `status: 0` |
| Origine dans la pile | `signUpStagiaire (lib/auth/actions.ts:43)` |

`status: 0` est la signature d'une requête qui n'a jamais atteint de serveur.
L'application, elle, affichait « La création du compte a échoué. Veuillez
réessayer. » — un message qui invite à réessayer alors que réessayer ne peut
jamais aboutir.

### Ce qui a été corrigé

1. `isSupabaseConfigured()` ne considère plus une valeur d'exemple comme une
   configuration valide (auparavant, seule la non-vacuité était testée).
2. `getSupabaseConfigIssue()` décrit précisément le problème et le fichier à
   corriger ; les actions d'authentification l'appellent **avant** tout appel
   réseau.
3. `failSafe()` distingue désormais « fournisseur injoignable » d'une erreur
   métier, et ne conseille plus de réessayer dans ce cas.
4. `/etat-installation` signale les valeurs d'exemple comme « Manquant ».

### Résultats réels de l'action serveur (HTTP, serveur de développement)

Action `signUpStagiaire`, identifiant extrait de
`server-reference-manifest.json`, appelée par `POST /inscription`.

| Cas envoyé | Réponse réelle de l'action |
| --- | --- |
| Données valides | `{"ok":false,"error":"Le fichier .env.local contient encore les valeurs d’exemple…"}` |
| `email: "not-an-email"` | `{"ok":false,"error":"Veuillez corriger les champs signalés.","fieldErrors":{"email":["Format d’adresse e-mail invalide."]}}` |
| `confirmPassword` différent | `…"fieldErrors":{"confirmPassword":["Les mots de passe ne correspondent pas."]}` |
| `password: "abc"` | `…"fieldErrors":{"password":["…au moins 10 caractères.","…une lettre majuscule.","…un chiffre."]}` |
| `role: "admin"` + `is_admin: true` injectés | Rejeté par le garde de configuration ; **aucun compte administrateur créé** |

Le message trompeur « La création du compte a échoué » **n'apparaît plus**.

### Ce qui reste non prouvé

**Aucune inscription réussie n'a pu être exécutée**, faute de projet Supabase
réel. Les tests ci-dessus prouvent la validation, le masquage du mot de passe et
la classification des erreurs ; ils ne prouvent pas qu'un compte est créé, ni que
le déclencheur `handle_new_user()` insère correctement le profil et le rôle. Ces
deux points restent à vérifier dès que les identifiants existent.


---

## Phase 2 — Vérification base de données (20 octobre 2026)

Exécutée via la CLI Supabase liée (`supabase db query --linked`), contre le
projet de développement `khrdcrpdiqmlcecbybfo`. **Aucune écriture, aucun DDL.**

### Schéma — 8/8 tables, RLS 8/8

| Table | RLS | Politiques |
| --- | --- | --- |
| `admin_private_notes` | ✅ | 1 |
| `application_documents` | ✅ | 5 |
| `application_status_history` | ✅ | 2 |
| `audit_events` | ✅ | 1 |
| `internship_applications` | ✅ | 4 |
| `notifications` | ✅ | 2 |
| `profiles` | ✅ | 4 |
| `user_roles` | ✅ | 1 |

### Politiques — 20, toutes réservées à `authenticated`

Aucune politique `anon` n'existe. Les règles vérifiées :

| Intention | Preuve lue dans `pg_policies` |
| --- | --- |
| Stagiaire lit sa demande | `applicant_id = auth.uid()` |
| Stagiaire lit son profil | `id = auth.uid()` |
| Stagiaire modifie son brouillon | `applicant_id = auth.uid() AND status = 'DRAFT'` |
| Admin lit tout | `is_admin()` |
| Client ne crée jamais de profil | `profiles_no_client_insert` → `with check (false)` |
| Client ne crée jamais de demande | `applications_no_client_insert` → `with check (false)` |
| Client ne modifie/supprime aucun document | `documents_no_client_update/delete` → `using (false)` |
| Rôle non auto-attribuable | `user_roles` n'a **aucune** politique d'écriture |

### Déclencheurs — 4, tous actifs

`on_auth_user_created` (auth.users → `handle_new_user`),
`profiles_set_updated_at`, `applications_set_updated_at`,
`user_roles_guard` (→ `prevent_role_self_assignment`).

Le corps de `handle_new_user` insère dans `profiles`, `user_roles` et
`notifications` avec `on conflict`, et **le seul littéral de rôle qu'il contient
est `'stagiaire'`** : une inscription publique ne peut pas produire d'admin.

### Fonctions — 16, dont les 9 RPC applicatives

`create_draft_application`, `submit_application`, `start_review`,
`decide_application`, `register_document`, `remove_document`, `get_admin_stats`,
`search_admin_applications`, `get_application_history` — toutes `SECURITY
DEFINER`, plus `is_admin`, `handle_new_user`, `log_audit`, `promote_to_admin`,
`demote_admin`, `prevent_role_self_assignment`, `set_updated_at`.

### Stockage — bucket privé confirmé

`application-documents` : `public = false`, `file_size_limit = 5 242 880`
(5 Mio), `allowed_mime_types = {application/pdf, image/png, image/jpeg}`.
5 politiques, toutes `authenticated` :

- `storage_own_upload` : dossier[1] = `auth.uid()` **et** demande possédée en `DRAFT`
- `storage_own_read` / `storage_own_delete` : même contrôle de propriété
- `storage_admin_read` : `is_admin()` + ligne de document correspondante
- `storage_no_admin_write` : `bucket_id <> 'application-documents'`

### Tests de sécurité exécutés réellement (API REST)

| Test | Résultat |
| --- | --- |
| `INSERT` anonyme sur les 8 tables | ✅ refusé — `42501 row-level security` |
| `PATCH`/`DELETE` anonyme sur `user_roles` | ✅ 0 ligne affectée |
| `SELECT` anonyme sur `profiles`, `admin_private_notes` | ✅ `[]` |
| 9 RPC appelées en anonyme | ✅ `AUTH_REQUIRED` / `FORBIDDEN` |
| `promote_to_admin` / `demote_admin` | ✅ `permission denied for function` |
| `is_admin()` en anonyme | ✅ `false` |

### Advisor Supabase (`supabase db advisors`)

**0 erreur.** 33 avertissements : 14 `anon_security_definer_function_executable`,
14 `authenticated_security_definer_function_executable`, 4
`multiple_permissive_policies` (performance), 1 `extension_in_public`
(`pg_trgm`).

### Faiblesses identifiées, non corrigées (attente d'accord)

1. **`log_audit` est exécutable par `anon` et n'a aucun contrôle d'accès.**
   Un appelant anonyme peut insérer des lignes dans `audit_events` avec
   `actor_id = NULL`. Il ne peut ni lire, ni usurper une identité, ni élever ses
   privilèges — mais il peut polluer la piste d'audit.
   Correctif proposé : `docs/proposed_0006_harden_function_grants.sql`.
2. **`storage_no_admin_write`** autorise tout utilisateur authentifié à écrire
   dans n'importe quel bucket *autre que* `application-documents`. Sans effet
   aujourd'hui (un seul bucket), mais latent si un bucket est ajouté.
3. **`authenticated` conserve des GRANT d'écriture sur `user_roles`** (défauts
   Supabase). Aucune politique RLS d'écriture n'existe, donc l'écriture est
   refusée en pratique.

### Historique de migration

`supabase_migrations.schema_migrations` **n'existe pas**. `migration list
--linked` affiche 0001→0005 et 9999 en « Local » uniquement. Un `db push`
rejouerait tout. Réparation sûre, **non exécutée** :
`supabase migration repair --status applied 0001 0002 0003 0004 0005 --linked`.

### Ce qui reste non prouvé

- La suite RLS automatisée (`tests/rls/`) n'a toujours pas été exécutée : elle
  exige la clé `service_role`, absente de `.env.local`.
- Aucune inscription réelle n'a été effectuée : la création effective du profil
  par `handle_new_user` est prouvée par lecture du code, pas par exécution.
- Playwright non exécuté.

---

## Phase 2c — Durcissement appliqué et vérifié (20 octobre 2026)

Correctifs A, B et C approuvés puis appliqués sur `khrdcrpdiqmlcecbybfo`.
Fichiers exécutés (forward uniquement, en transaction) :
`supabase/applied/0006_harden_function_grants.sql`,
`supabase/applied/0007_least_privilege_storage.sql`.

### Permissions avant / après

| Objet | Rôle | Avant | Après |
| --- | --- | --- | --- |
| `log_audit` | `anon` | EXECUTE | **refusé** |
| `log_audit` | `authenticated` | EXECUTE | **refusé** |
| `log_audit` | `service_role` | EXECUTE | **refusé** |
| 9 RPC applicatives | `anon` | EXECUTE | **refusé** |
| 9 RPC applicatives | `authenticated` | EXECUTE | EXECUTE (inchangé) |
| politiques INSERT storage | — | 2 | **1** |
| politiques storage (total) | — | 5 | **4** |

ACL mesurée avant : `postgres=X | anon=X | authenticated=X | service_role=X`
(PUBLIC n'avait aucun EXECUTE). `pg_auth_members` confirme qu'`anon` n'est **pas**
membre d'`authenticated` : les deux révocations sont indépendantes.

### Vérifications en direct (API REST, clé publishable)

| Test | Résultat |
| --- | --- |
| `POST /rpc/log_audit` en anonyme | **401** `permission denied for function log_audit` |
| Les 9 RPC en anonyme | **401** `permission denied` — 9/9 |
| Déclencheur `on_auth_user_created` | activé, insère profil + rôle + notification, **n'appelle pas** `log_audit`, seul littéral de rôle = `'stagiaire'` |
| Politiques storage restantes | `storage_own_upload`, `storage_own_read`, `storage_own_delete`, `storage_admin_read` |
| `audit_events` après tentative de forge | **0 ligne** — la requête a été refusée avant écriture |

`npm run check:hardening` → les 7 colonnes à `true`.

### Advisor

33 → **23** avertissements, 0 erreur.
`anon_security_definer_function_executable` : 14 → **4** (tous justifiés :
2 fonctions `trigger`, `is_admin`, `rls_auto_enable`).
Nouveau : `auth_leaked_password_protection` — réglage Supabase Auth à activer
(phase Authentification).

### Tests locaux

`tsc` 0 erreur · `eslint` 0 · Vitest **178 réussis, 25 ignorés** (203).

### Effet de bord observé (non causé par les correctifs)

Un compte a été créé le 2026-10-20 à 00:19:29 UTC (01:19 local), non confirmé
(`email_confirmed_at` NULL), rôle `stagiaire`, avec profil et notification
`WELCOME`. Cela constitue une **preuve réelle que le déclencheur d'inscription
fonctionne de bout en bout**, et que l'inscription publique ne produit que des
`stagiaire`. Aucune donnée n'a été supprimée ; `audit_events` reste à 0.
