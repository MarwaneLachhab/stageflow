# Sécurité

Ce document décrit les menaces identifiées, les défenses effectivement
implémentées, et — tout aussi important — ce qui **n'est pas** protégé.

## 1. Modèle de menace

| # | Menace | Défense principale | Vérifié |
| --- | --- | --- | --- |
| 1 | Accès aux données d'un autre candidat | RLS sur chaque table | Oui |
| 2 | Auto-attribution du rôle administrateur | Aucune écriture sur `user_roles` + déclencheur | Oui |
| 3 | Écriture directe du statut d'une demande | GRANT au niveau colonne | Oui |
| 4 | Décision administrative forgée | `requireRole` + `is_admin()` + machine à états | Oui |
| 5 | Lecture d'un document d'autrui | Proxy contrôlé + stockage privé | Oui |
| 6 | Téléversement d'un fichier exécutable | Inspection des octets magiques | Oui |
| 7 | Traversée de chemin à l'envoi | Clé générée par le serveur | Oui |
| 8 | Redirection ouverte | `safeRedirectPath()` / `safeNext()` | Oui |
| 9 | Énumération de comptes | Erreurs génériques | Oui |
| 10 | XSS stocké via le motif de refus | Échappement React + CSP | Oui |
| 11 | CSRF sur la déconnexion | POST uniquement | Oui |
| 12 | Escalade par contournement de l'interface | RLS, pas l'interface | Oui |

## 2. Contrôle d'accès

### 2.1 Trois couches, une seule fait foi

```
1. middleware.ts          → redirection rapide          (confort, NON sécuritaire)
2. layout.tsx (protégé)   → resolveWorkspaceAccess()    (contrôle réel)
3. Politiques RLS         → is_admin() / auth.uid()     (garantie finale)
```

Le middleware est explicitement documenté comme une optimisation d'expérience
utilisateur. Il lit le cookie pour éviter un aller-retour inutile, mais **n'est
jamais cru sur parole**. Le rôle est toujours résolu à nouveau en base par le
layout, et la base applique ses propres règles indépendamment des deux.

Conséquence : si le middleware et le layout disparaissaient, les données
resteraient protégées. L'inverse n'est pas vrai — c'est pourquoi la RLS est
traitée comme la seule couche dont l'absence serait inacceptable.

### 2.2 Le repli est restrictif

```ts
role: (roleRow?.role as AppRole | undefined) ?? 'stagiaire'
```

Un rôle illisible, une table vide, une erreur réseau inattendue : le résultat est
le rôle **le moins privilégié**. Jamais l'inverse.

### 2.3 Séparation des espaces

Un stagiaire qui visite `/admin/*` est redirigé vers son propre espace. Un
administrateur qui visite `/stagiaire/*` est redirigé vers le sien. Il ne s'agit
pas d'un simple refus : les deux espaces affichent des données différentes, et
laisser un administrateur dans l'espace stagiaire produirait des écrans vides
et déroutants.

### 2.4 Le rôle ne peut pas être auto-attribué

Trois verrous indépendants protègent `user_roles` :

```sql
-- 1. RLS : lecture de sa propre ligne uniquement, AUCUNE politique d'écriture
CREATE POLICY user_roles_select_own ON user_roles
  FOR SELECT USING (user_id = auth.uid() OR is_admin());

-- Aucune politique INSERT / UPDATE / DELETE n'existe. Le refus est donc total.

-- 2. Déclencheur : refuse toute modification provenant d'un client
CREATE TRIGGER prevent_role_self_assignment
  BEFORE INSERT OR UPDATE ON user_roles
  FOR EACH ROW EXECUTE FUNCTION prevent_role_self_assignment();

-- 3. Fonctions d'amorçage révoquées
REVOKE ALL ON FUNCTION promote_to_admin(text) FROM public, anon, authenticated;
```

Un utilisateur authentifié qui envoie un `PATCH /rest/v1/user_roles` est refusé
par l'absence de politique, avant même que le déclencheur n'entre en jeu.

## 3. La faille corrigée : RLS seule ne protège pas les colonnes

**C'est le point le plus subtil de cette application.**

Une politique RLS répond à la question « cette **ligne** est-elle modifiable ? ».
Elle ne répond pas à « cette **colonne** est-elle modifiable ? ».

Considérons la politique, correcte en apparence, autorisant un candidat à
modifier son brouillon :

```sql
CREATE POLICY applications_update_own_draft ON internship_applications
  FOR UPDATE USING (applicant_id = auth.uid() AND status = 'DRAFT');
```

Elle empêche de modifier la demande d'autrui. Mais **rien n'empêche le
propriétaire lui-même d'écrire `status = 'ACCEPTED'`** dans son propre brouillon.
Le candidat s'attribuerait une acceptation.

### La correction : GRANT au niveau colonne

```sql
-- Le rôle authenticated ne peut écrire QUE ces colonnes de contenu.
GRANT UPDATE (
  stage_type, domain, start_date, end_date, mode, motivation,
  school, program, study_level, specialty, updated_at
) ON internship_applications TO authenticated;
```

Les colonnes de workflow — `status`, `submitted_at`, `reviewed_at`,
`decided_at`, `public_rejection_reason` — ne figurent **pas** dans la liste. Une
tentative de `PATCH` les visant reçoit une erreur de privilège PostgreSQL,
quelle que soit la politique RLS.

Ces colonnes ne sont modifiables que par les fonctions `SECURITY DEFINER`
(`submit_application`, `start_review`, `decide_application`), qui vérifient
elles-mêmes l'identité et le statut.

Le même raisonnement s'applique à `profiles` : seules les colonnes biographiques
sont accordées en écriture.

## 4. Stockage et fichiers

### 4.1 Bucket privé

```sql
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('application-documents', 'application-documents', false, 5242880,
        ARRAY['application/pdf','image/png','image/jpeg']);
```

`public = false` : aucun objet n'est accessible sans passer par une politique.
`file_size_limit` et `allowed_mime_types` sont appliqués par le service de
stockage lui-même, pas par l'application.

### 4.2 Politiques de stockage

| Politique | Règle |
| --- | --- |
| `storage_own_upload` | `folder[1] = auth.uid()` **ET** `folder[2]` correspond à une demande `DRAFT` du même utilisateur |
| `storage_own_read` | Propriétaire du dossier |
| `storage_admin_read` | Administrateur **ET** le document existe dans `application_documents` |
| `storage_own_delete` | Propriétaire, sur un brouillon |
| `storage_no_admin_write` | Interdit à l'administrateur de déposer des fichiers dans le dossier d'autrui |

La double condition de `storage_own_upload` empêche un candidat de déposer un
fichier dans le dossier d'un autre, ou dans sa propre demande **déjà envoyée**
(ce qui laisserait croire à une pièce ajoutée après examen).

### 4.3 Défense contre les fichiers malveillants

| Contrôle | Mise en œuvre |
| --- | --- |
| Liste blanche d'extensions | `pdf`, `png`, `jpg`, `jpeg` uniquement |
| Liste noire d'extensions | `svg`, `html`, `js`, `php`, `exe`, `zip`… rejetées explicitement |
| Liste blanche de types MIME | Appliquée aussi par le service de stockage |
| Taille maximale | 5 Mio, vérifiée côté client **et** service de stockage |
| **Inspection des octets magiques** | Le serveur lit les premiers octets du fichier |
| Nom d'affichage assaini | Caractères de contrôle et séquences de chemin retirés |
| Clé de stockage générée par le serveur | Nom aléatoire, jamais fourni par le client |

L'inspection des octets magiques est le contrôle décisif : un fichier nommé
`cv.pdf` mais contenant du JavaScript est rejeté, car ses octets ne commencent
pas par `%PDF`.

### 4.4 Le problème des SVG

Les fichiers SVG sont **explicitement rejetés** bien qu'étant des images. Un SVG
peut contenir du JavaScript exécutable, et — s'il est servi en ligne — s'exécuter
dans l'origine de l'application.

Ce n'est pas une omission : c'est une exclusion délibérée, documentée dans
`BLOCKED_EXTENSIONS`.

### 4.5 Téléchargement contrôlé à chaque requête

```
Navigateur → GET /api/documents/<uuid>
                │
                ├─ 1. Session valide ?                    → sinon 401
                ├─ 2. uuid bien formé ?                   → sinon 404
                ├─ 3. Ligne lisible via RLS (client utilisateur) ?
                │      → non : 404 (jamais 403 : pas de confirmation d'existence)
                ├─ 4. Téléchargement du binaire côté serveur
                └─ 5. En-têtes durcis :
                       Content-Type: normalisé depuis la liste blanche
                       Content-Disposition: attachment (encodage RFC 5987)
                       X-Content-Type-Options: nosniff
                       Cache-Control: private, no-store
                       Content-Security-Policy: default-src 'none'; sandbox
```

Le type MIME est **recalculé** depuis la liste blanche, jamais repris de la
valeur stockée : une valeur corrompue en base ne peut pas provoquer l'affichage
en ligne d'un fichier dangereux.

## 5. Authentification

### 5.1 Identité vérifiée, pas déclarée

```ts
const { data: { user } } = await supabase.auth.getUser()
```

`getUser()` interroge le serveur d'authentification et valide le JWT.
`getSession()` se contente de **lire un cookie**, qui peut être forgé. Il n'est
utilisé nulle part pour une décision de sécurité.

### 5.2 Pas d'énumération de comptes

| Situation | Réponse |
| --- | --- |
| Identifiants valides | Succès |
| Mot de passe incorrect | « Identifiants incorrects. » |
| Compte inexistant | « Identifiants incorrects. » (identique) |
| Demande de réinitialisation, compte existant | « Si un compte existe, un e-mail a été envoyé. » |
| Demande de réinitialisation, compte inexistant | Idem, **mot pour mot** |

La réinitialisation répond toujours de la même manière et **dans le même temps**,
pour ne pas révéler l'existence d'un compte par la latence.

### 5.3 Politique de mot de passe

Minimum 10 caractères, avec majuscule, minuscule et chiffre. Un indicateur de
robustesse guide la saisie, mais c'est la validation serveur qui décide.

### 5.4 Redirections sûres

```ts
function safeRedirectPath(value: string | null, fallback: string): string {
  if (!value) return fallback
  if (!value.startsWith('/')) return fallback
  if (value.startsWith('//')) return fallback          // URL protocol-relative
  if (value.startsWith('/\\')) return fallback         // contournement par antislash
  if (value.includes('\\')) return fallback
  return value
}
```

`//evil.com` et `/\evil.com` sont traités comme navigateurs : sans ces contrôles,
`window.location = '//evil.com'` enverrait l'utilisateur vers un site tiers tout
en paraissant être un chemin interne.

Le paramètre `next` du callback d'authentification passe par la même validation.

### 5.5 Déconnexion non déclenchable par un tiers

```ts
export async function POST() { /* … */ }
export async function GET() { return new Response(null, { status: 405 }) }
```

Un simple `<img src="/api/auth/signout">` sur un site tiers suffirait à
déconnecter l'utilisateur si la route acceptait `GET`. Elle ne l'accepte pas.

## 6. En-têtes de sécurité

Appliqués par `middleware.ts` sur chaque réponse :

| En-tête | Valeur | Rôle |
| --- | --- | --- |
| `Content-Security-Policy` | `default-src 'self'` + Supabase en `connect-src` | Limite les origines de chargement |
| `X-Content-Type-Options` | `nosniff` | Empêche la détection de type |
| `X-Frame-Options` | `DENY` | Anti-clickjacking |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Limite les fuites d'URL |
| `Permissions-Policy` | caméra, micro, géoloc désactivés | Réduction de surface |
| `Cross-Origin-Opener-Policy` | `same-origin` | Isolation |
| `Strict-Transport-Security` | en production uniquement | Force HTTPS |

### La CSP contient `'unsafe-inline'` pour les scripts

**C'est une faiblesse assumée et documentée.** L'architecture de streaming de
Next.js injecte des scripts en ligne ; les autoriser nécessite soit
`'unsafe-inline'`, soit un nonce propagé à chaque script.

La marche à suivre pour resserrer : générer un nonce par requête dans le
middleware, le propager via les en-têtes, et retirer `'unsafe-inline'`. Tant que
ce n'est pas fait, `frame-ancestors 'none'` et `X-Frame-Options: DENY` restent
les protections structurelles actives contre le clickjacking.

## 7. Validation des entrées

### À trois niveaux

| Niveau | Outil | Rôle |
| --- | --- | --- |
| Navigateur | Zod + React Hook Form | Retour immédiat |
| Serveur | Mêmes schémas, rejoués | **Autorité** |
| Base | Contraintes `CHECK` | Garantie structurelle |

### Contraintes réellement présentes en base

```sql
-- Un refus doit porter un motif d'au moins 10 caractères
CONSTRAINT applications_rejected_requires_reason CHECK (
  status <> 'REJECTED'
  OR (public_rejection_reason IS NOT NULL AND length(trim(public_rejection_reason)) >= 10)
)

-- Une décision doit avoir une date
CONSTRAINT applications_decided_consistency CHECK (
  (status IN ('ACCEPTED','REJECTED')) = (decided_at IS NOT NULL)
)

-- Une demande envoyée doit avoir une date d'envoi
CONSTRAINT applications_submitted_consistency CHECK (
  (status = 'DRAFT') OR (submitted_at IS NOT NULL)
)
```

Rendre un refus sans motif **structurellement impossible** est plus robuste que
de l'interdire dans une interface : aucune évolution future de l'application ne
pourra le contourner par inadvertance.

## 8. Injection SQL

Aucune chaîne de requête n'est construite par concaténation. Les accès passent
par :

- le constructeur de requêtes Supabase (paramétré) ;
- des appels `rpc()` à des fonctions PostgreSQL à paramètres typés.

La recherche administrative (`search_admin_applications`) reçoit son terme en
`p_query text` et l'utilise dans `ILIKE '%' || p_query || '%'` — une **valeur
liée**, jamais du SQL concaténé. `p_limit` est borné entre 1 et 25.

## 9. Journal d'audit

La table `audit_events` consigne les actions sensibles. Elle est **en lecture
seule pour les administrateurs** : aucune politique d'écriture n'existe pour un
client. Seules les fonctions `SECURITY DEFINER` y insèrent.

Un administrateur ne peut donc ni modifier ni effacer la trace de ses propres
décisions.

## 10. Ce qui n'est pas couvert

Cette section existe parce qu'une documentation de sécurité qui ne liste que des
succès est trompeuse.

| Sujet | État réel |
| --- | --- |
| Analyse antivirus | **Absente.** Un PDF piégé serait stocké et retéléchargeable. Atténué par le type restreint, la disposition `attachment`, `nosniff` et la CSP `sandbox`. |
| Limitation de débit | **En mémoire, par processus.** En serverless, la limite effective est multipliée par le nombre d'instances. |
| Nonce CSP | **Non implémenté.** `'unsafe-inline'` reste nécessaire aux scripts. |
| Tests RLS automatisés | **Écrits mais non exécutés** : Docker est indisponible sur cette machine, donc la CLI Supabase locale ne peut pas démarrer. Ils nécessitent un projet Supabase distant. |
| Conformité loi 09-08 | **Non établie.** Les pages légales sont des modèles honnêtes marqués « version préliminaire ». Aucune conformité n'est revendiquée. |
| Vérification d'adresse e-mail | **Configurable côté Supabase.** L'application ne force pas la confirmation avant l'envoi d'une demande. |
| Rotation des secrets | **Procédure non automatisée**, documentée dans `DEPLOYMENT.md`. |
| Sauvegardes | **Non automatisées.** À configurer dans la console Supabase. |

## 11. Procédure de signalement

Les failles doivent être signalées à l'adresse de support configurée
(`BRAND.supportEmail`) plutôt que divulguées publiquement. Aucun programme de
prime n'est en place.
