# Base de données

## Vue d'ensemble

Huit tables, quatre types énumérés, une vue, onze fonctions.

```
auth.users (géré par Supabase)
    │
    │ 1–1 (déclencheur handle_new_user)
    ▼
profiles ──────────────────────────┐
    │                              │
    │ 1–N                          │ 1–1
    ▼                              ▼
internship_applications ────► user_roles
    │        │        │
    │        │        └──────────────► notifications
    │        │
    │        ├───────────────────────► admin_private_notes
    │        │
    │        └───────────────────────► application_status_history
    │
    └────────────────────────────────► application_documents
                                              │
                                              └──► storage.objects
                                                   (bucket privé)
                                    audit_events (transversal)
```

## Types énumérés

```sql
CREATE TYPE app_role          AS ENUM ('stagiaire', 'admin');
CREATE TYPE application_status AS ENUM ('DRAFT','SUBMITTED','UNDER_REVIEW','ACCEPTED','REJECTED');
CREATE TYPE document_type     AS ENUM ('CV','MOTIVATION_LETTER','ENROLLMENT_CERTIFICATE',
                                       'INTERNSHIP_AGREEMENT','CIN');
CREATE TYPE notification_type AS ENUM ('STATUS_CHANGE','DOCUMENT_REQUEST','WELCOME','SYSTEM');
```

**Cinq valeurs de statut, pas six.** Le libellé « En attente » visible dans les
maquettes est une présentation de `SUBMITTED`, gérée dans `STATUS_META`.

## Tables

### `user_roles`

| Colonne | Type | Note |
| --- | --- | --- |
| `user_id` | `uuid` PK | Référence `auth.users` |
| `role` | `app_role` | Défaut `stagiaire` |
| `created_at` | `timestamptz` | |

**Aucune politique d'écriture n'existe sur cette table.** C'est le fondement de
l'impossibilité de s'auto-attribuer un rôle.

### `profiles`

| Colonne | Type | Contrainte |
| --- | --- | --- |
| `id` | `uuid` PK | Référence `auth.users` |
| `first_name`, `last_name` | `text` | Longueur 1–80 |
| `phone` | `text` | Longueur ≤ 32 |
| `address` | `text` | Longueur ≤ 200 |
| `city` | `text` | Longueur ≤ 80 |
| `birth_date` | `date` | Doit être dans le passé |
| `school`, `program`, `specialty` | `text` | Longueur ≤ 160 |
| `study_level` | `text` | Longueur ≤ 60 |
| `created_at`, `updated_at` | `timestamptz` | `updated_at` par déclencheur |

L'adresse e-mail **n'est pas** stockée ici : elle vit dans `auth.users` et n'est
résolue que pour un administrateur prouvé.

### `internship_applications`

Table centrale. Points d'attention :

| Contrainte | Rôle |
| --- | --- |
| `applications_rejected_requires_reason` | Un refus exige un motif ≥ 10 caractères |
| `applications_decided_consistency` | Statut terminal ⟺ `decided_at` renseigné |
| `applications_submitted_consistency` | Statut ≠ `DRAFT` ⟹ `submitted_at` renseigné |
| `applications_one_active_per_applicant` | Index unique partiel : une seule demande active |

La colonne `version` sert à la concurrence optimiste et à l'affichage (v1, v2…).

Les colonnes académiques (`school`, `program`, `study_level`, `specialty`) sont
**recopiées au moment de l'envoi**. L'écran 11 affiche en priorité cette copie
plutôt que le profil courant : ce qui a été examiné doit rester ce qui a été
examiné, même si le candidat modifie son profil ensuite.

### `application_documents`

| Contrainte | Rôle |
| --- | --- |
| `documents_unique_slot` | Un seul fichier par `(application_id, document_type)` |
| `documents_bytes_positive` | `bytes > 0` |
| `documents_mime_allowed` | MIME dans la liste blanche |

### `application_status_history`

Historique **en ajout seul**. Aucune politique `UPDATE` ou `DELETE` n'existe.
Seules les fonctions `SECURITY DEFINER` y insèrent.

Sa colonne `public_note` est la seule que le stagiaire lit. Les notes privées
vivent dans une table distincte.

### `admin_private_notes`

Politique `FOR ALL` réservée aux administrateurs, dans les deux sens. Un
stagiaire obtient zéro ligne, même en connaissant l'identifiant.

### `notifications`

Destinataire uniquement. La seule colonne modifiable par le client est `read_at` :

```sql
GRANT UPDATE (read_at) ON notifications TO authenticated;
```

Un client ne peut donc pas réécrire le texte d'une notification pour se faire
croire une décision favorable.

### `audit_events`

**Lecture seule pour les administrateurs.** Aucune politique d'écriture. Un
administrateur ne peut ni modifier ni effacer la trace de ses propres décisions.

## Index

| Index | Colonnes | Usage |
| --- | --- | --- |
| `applications_one_active_per_applicant` | `applicant_id` (partiel) | Unicité de la demande active |
| `applications_status_idx` | `status` | Filtres du tableau de bord |
| `applications_submitted_idx` | `submitted_at DESC` | Tri par défaut |
| `applications_name_trgm_idx` | `(first_name \|\| ' ' \|\| last_name)` GIN | Recherche par nom |
| `applications_program_trgm_idx` | `program` GIN | Recherche par formation |
| `documents_application_idx` | `application_id` | Chargement des pièces |
| `history_application_idx` | `application_id, created_at` | Chronologie |
| `notifications_recipient_idx` | `recipient_id, read_at` | Compteur de non-lues |

Les index trigrammes (`pg_trgm`) rendent la recherche `ILIKE '%terme%'`
utilisable sans parcours séquentiel.

## Fonctions

Toutes sont `SECURITY DEFINER` avec `SET search_path = ''`. Le chemin de
recherche vide est essentiel : sans lui, un appelant pourrait créer un schéma
prioritaire contenant une fausse table `profiles` et détourner la fonction.

| Fonction | Rôle | Contrôle d'accès |
| --- | --- | --- |
| `is_admin()` | Teste le rôle | — (utilitaire) |
| `handle_new_user()` | Provisionne profil, rôle, notification | Déclencheur |
| `create_draft_application()` | Crée un brouillon vide | Propriétaire |
| `submit_application()` | Brouillon → envoyée | Propriétaire + validation complète |
| `start_review()` | Envoyée → en examen | `is_admin()`, idempotent |
| `decide_application()` | → acceptée / refusée | `is_admin()` + motif + concurrence |
| `register_document()` | Enregistre une pièce déposée | Propriétaire + préfixe de clé vérifié |
| `remove_document()` | Supprime une pièce de brouillon | Propriétaire + brouillon uniquement |
| `get_admin_stats()` | Agrégats du tableau de bord | `is_admin()` |
| `search_admin_applications()` | Recherche paginée | `is_admin()` |
| `get_application_history()` | Historique | Propriétaire ou admin |
| `promote_to_admin()` / `demote_admin()` | Amorçage | **Révoquées** de `anon` et `authenticated` |

### `submit_application()` — la fonction la plus critique

```
1. Verrouille la ligne (SELECT … FOR UPDATE)     → deux envois simultanés : un seul passe
2. Vérifie la propriété                          → pas d'envoi de la demande d'autrui
3. Exige status = 'DRAFT'                        → pas de renvoi d'une demande examinée
4. Valide les dates (début ≤ fin, non passées)
5. Valide la motivation (longueur minimale)
6. Valide les informations académiques
7. Vérifie que les PIÈCES OBLIGATOIRES existent  → la vérification serveur, pas l'interface
8. Passe le statut UNE SEULE FOIS
9. Écrit une ligne d'historique
10. Crée une notification
```

L'étape 7 est la raison pour laquelle un client modifié ne peut pas envoyer un
dossier incomplet : « le bouton était actif » n'a aucune valeur ici.

### `decide_application()` — l'autre fonction critique

```
1. is_admin()                                    → refus sinon
2. Verrouille la ligne (FOR UPDATE)
3. Vérifie expected_status                       → concurrence : le second admin est refusé
4. Refuse si le statut est déjà terminal          → décision non réversible
5. Exige une décision valide ('ACCEPTED'|'REJECTED')
6. Exige un motif ≥ 10 caractères                → également garanti par contrainte CHECK
7. Écrit le statut, la date de décision et le motif
8. Ajoute une ligne d'historique PUBLIQUE
9. Crée une notification pour le candidat
10. Journalise dans audit_events
```

L'étape 3 mérite d'être soulignée : deux administrateurs qui ouvrent le même
dossier et cliquent presque simultanément — le second reçoit un message lui
demandant d'actualiser, au lieu d'écraser silencieusement la décision du premier.

## Politiques RLS

RLS est **activée sur les huit tables**. Voici les règles, en résumé.

| Table | SELECT | INSERT | UPDATE | DELETE |
| --- | --- | --- | --- | --- |
| `user_roles` | propre ligne ou admin | ✗ | ✗ | ✗ |
| `profiles` | propre ligne ou admin | ✗ | propre ligne (colonnes restreintes) | ✗ |
| `internship_applications` | propre ou admin | ✗ | propre brouillon (colonnes restreintes) | ✗ |
| `application_documents` | propre ou admin | ✗ | ✗ | ✗ |
| `application_status_history` | propre ou admin | ✗ | ✗ | ✗ |
| `admin_private_notes` | admin | admin | admin | admin |
| `notifications` | destinataire | ✗ | destinataire (`read_at` seul) | ✗ |
| `audit_events` | admin | ✗ | ✗ | ✗ |

Presque toutes les écritures passent par des fonctions `SECURITY DEFINER` :
`INSERT` et `DELETE` sont refusés aux clients presque partout.

### GRANT au niveau colonne — le détail qui compte

Voir `docs/SECURITY.md` §3 pour l'explication complète. En résumé :

```sql
-- Seules ces colonnes sont modifiables par le candidat sur son brouillon.
GRANT UPDATE (
  stage_type, domain, start_date, end_date, mode, motivation,
  school, program, study_level, specialty, updated_at
) ON internship_applications TO authenticated;
```

`status` **n'y figure pas**. Un candidat qui tenterait de s'auto-accepter reçoit
une erreur de privilège PostgreSQL, avant même que la RLS n'intervienne.

## Amorçage du premier administrateur

Il ne peut pas exister de politique RLS permettant de devenir administrateur —
ce serait exactement la faille à éviter. L'amorçage est donc **opérationnel** :

```sql
-- À exécuter une fois, depuis l'éditeur SQL de la console Supabase
-- (connexion en tant que propriétaire, pas via l'API REST).
SELECT promote_to_admin('admin@exemple.ma');
```

La fonction est révoquée de `public`, `anon` et `authenticated`. Elle n'est
appelable que par le propriétaire de la base, c'est-à-dire par un opérateur
disposant déjà d'un accès total.

## Migration et semis

```
supabase/migrations/
  0001_init_schema.sql        Types, tables, contraintes, déclencheurs
  0002_indexes_and_views.sql  Index trigrammes, vue, recherche, historique
  0003_workflow_functions.sql Fonctions de workflow
  0004_rls_policies.sql       RLS, politiques, GRANT colonne, stockage
  0005_admin_bootstrap.sql    Promotion d'administrateur
  9999_dev_seed.sql           Données de démonstration (désactivées par défaut)
```

Les migrations s'appliquent dans l'ordre lexicographique. `9999` est en dernier
pour une raison : les données de démonstration ne doivent jamais être appliquées
avant que le schéma et les politiques n'existent.

### Le semis est désactivé par défaut

```sql
IF current_setting('stageflow.seed_demo', true) IS DISTINCT FROM 'on' THEN
  RAISE NOTICE 'Semis ignoré';
  RETURN;
END IF;
```

Les sept candidats de démonstration ne sont créés que si l'opérateur l'a
explicitement demandé :

```sql
SET stageflow.seed_demo = 'on';
```

Le semis **ne crée jamais d'administrateur**. Un administrateur de démonstration
avec un mot de passe connu serait une porte dérobée.

## Requêtes d'exploitation utiles

```sql
-- Combien de demandes par statut ?
SELECT status, count(*) FROM internship_applications GROUP BY status ORDER BY status;

-- Y a-t-il des refus sans motif ? (doit toujours renvoyer 0 ligne)
SELECT id FROM internship_applications
WHERE status = 'REJECTED'
  AND (public_rejection_reason IS NULL OR length(trim(public_rejection_reason)) < 10);

-- Y a-t-il des lignes d'historique orphelines ? (doit renvoyer 0)
SELECT h.id FROM application_status_history h
LEFT JOIN internship_applications a ON a.id = h.application_id
WHERE a.id IS NULL;

-- Y a-t-il des pièces dont le fichier a disparu du stockage ? (doit renvoyer 0)
SELECT d.id, d.original_name FROM application_documents d
LEFT JOIN storage.objects o ON o.name = d.storage_key
WHERE o.id IS NULL;
```

La deuxième requête est un contrôle d'intégrité réel : si elle renvoie une ligne,
la contrainte `applications_rejected_requires_reason` a été contournée.
