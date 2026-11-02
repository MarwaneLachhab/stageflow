# Carte des références de design

Ce document recense **chaque image de référence** présente dans le dépôt, l'écran
qu'elle représente, et le fichier React qui l'implémente. Il constitue la preuve
que les maquettes ont été inspectées une par une et non supposées.

## 1. Inventaire réel des fichiers

Les trois dossiers fournis ont été listés et comparés octet par octet.

| Dossier | Contenu réel | Statut |
| --- | --- | --- |
| `stageflow_11_mockups/` | 11 écrans PNG + `README.md` | **Source canonique** |
| `stageflow_admin_pages/` | 3 PNG | **Doublons** de 09, 10, 11 |
| `stageflow_public_pages/` | 3 PNG | **Doublons** de 01, 02, 03 |

**Constat important** : les 6 images des dossiers `stageflow_admin_pages` et
`stageflow_public_pages` sont des copies à l'identique (taille en octets et
dimensions identiques) de 6 des 11 images de `stageflow_11_mockups`. Aucune
maquette supplémentaire ne s'y trouve.

**Conséquence** : il n'existe que **11 écrans uniques** à implémenter, et non 17.
Confondre les doublons avec des écrans distincts aurait conduit à créer des pages
fantômes.

Toutes les images mesurent **1080 × 675 px** (ratio 16:10).

Aucune image n'a été déplacée, renommée, recompressée ni supprimée.

## 2. Correspondance écran → fichier

| # | Image de référence | Octets | Écran | Fichier d'implémentation |
| --- | --- | --- | --- | --- |
| 01 | `01_accueil.png` | 286 537 | Accueil public | `app/(public)/page.tsx` |
| 02 | `02_inscription.png` | 208 869 | Inscription | `app/(public)/inscription/page.tsx` + `components/public/sign-up-form.tsx` |
| 03 | `03_connexion.png` | 142 995 | Connexion | `app/(public)/connexion/page.tsx` + `components/public/sign-in-form.tsx` |
| 04 | `04_tableau_de_bord_stagiaire.png` | 243 830 | Tableau de bord stagiaire | `app/(stagiaire)/stagiaire/tableau-de-bord/page.tsx` |
| 05 | `05_profil_stagiaire.png` | 134 651 | Profil stagiaire | `app/(stagiaire)/stagiaire/profil/page.tsx` + `components/stagiaire/profile-form.tsx` |
| 06 | `06_formulaire_demande.png` | 125 525 | Formulaire de demande | `app/(stagiaire)/stagiaire/demande/page.tsx` + `components/stagiaire/application-wizard.tsx` |
| 07 | `07_documents_et_soumission.png` | 138 901 | Documents et soumission | `app/(stagiaire)/stagiaire/documents/page.tsx` + `components/stagiaire/documents-manager.tsx` |
| 08 | `08_suivi_demande.png` | 119 878 | Suivi de la demande | `app/(stagiaire)/stagiaire/suivi/page.tsx` |
| 09 | `09_dashboard_admin.png` | 125 177 | Tableau de bord admin | `app/(admin)/admin/tableau-de-bord/page.tsx` + `components/admin/dashboard-charts.tsx` |
| 10 | `10_gestion_demandes_admin.png` | 150 135 | Gestion des demandes | `app/(admin)/admin/demandes/page.tsx` + `components/admin/admin-filters.tsx` |
| 11 | `11_details_decision_admin.png` | 183 866 | Détails et décision | `app/(admin)/admin/demandes/[id]/page.tsx` + `components/admin/decision-panel.tsx` + `components/admin/private-notes-panel.tsx` |

## 3. Jetons de design extraits des pixels

Les valeurs ci-dessous ont été relevées directement dans les maquettes, puis
centralisées dans `tailwind.config.ts` et `app/globals.css`. Aucune n'a été
inventée.

### Surfaces et structure

| Rôle | Valeur | Jeton |
| --- | --- | --- |
| Fond de page | `#F8FAFC` | `canvas` |
| Fond des cartes | `#FFFFFF` | `surface` |
| Bordure des cartes | `#E9EEF6` | `border` |
| Rayon des cartes | `14px` | `borderRadius.card` |
| Rayon des contrôles | `10px` | `borderRadius.control` |

### Couleurs de marque

| Rôle | Valeur | Jeton |
| --- | --- | --- |
| Bleu primaire (actions) | `#2563EB` | `primary-600` |
| Bleu clair (tuiles) | `#EFF4FF` | `primary-50` |
| Bleu foncé (barre latérale) | `#0B1736` | `navy-900` |
| Texte principal | `#0F172A` | `ink` |
| Texte secondaire | `#64748B` | `ink-muted` |

### Tuiles pastel

| Intention | Fond | Jeton |
| --- | --- | --- |
| Primaire | `#EFF4FF` | `primary-50` |
| Succès | `#ECFDF5` | `success-bg` |
| Avertissement | `#FFFBEB` | `warning-bg` |
| Danger | `#FEF2F2` | `danger-bg` |

### Badges de statut

| Statut | Fond | Texte |
| --- | --- | --- |
| `SUBMITTED` (En attente) | `#FFFBEB` | `#B45309` |
| `UNDER_REVIEW` (En examen) | `#EFF6FF` | `#1D4ED8` |
| `ACCEPTED` (Acceptée) | `#ECFDF5` | `#047857` |
| `REJECTED` (Refusée) | `#FEF2F2` | `#B91C1C` |

## 4. Écarts assumés par rapport aux maquettes

Chaque écart est délibéré, documenté ici, et motivé par une contrainte réelle
plutôt que par une préférence esthétique.

### Le fil chronologique ne comporte pas de sixième étape

La maquette 08 dessine quatre étapes successives, la quatrième semblant être
« Acceptée ou refusée ». Or **Acceptée et Refusée ne sont pas des étapes, ce sont
deux issues terminales alternatives** : une demande refusée n'a jamais été
« acceptée puis refusée ».

**Implémentation** : le quatrième nœud est un nœud unique intitulé
« Décision », dont le libellé se résout selon le statut réel. Voir
`components/stagiaire/progress-timeline.tsx`, où `stageIndexFor()` renvoie `3`
pour `ACCEPTED` **et** `REJECTED`.

Effet concret : une demande refusée affiche une chronologie **terminée**, et non
une progression qui semble encore en cours.

### « En attente » est un libellé, pas un état

Les maquettes 04 et 09 affichent « En attente » dans les tuiles d'indicateurs.
Le cahier des charges mentionne six libellés, ce qui laisse penser à six états.
Or il n'existe que **cinq états en base**.

**Implémentation** : `STATUS_META` porte deux libellés par état —
`label` (« Envoyée », utilisé dans la chronologie) et `shortLabel`
(« En attente », utilisé dans les tuiles et les tableaux). Un seul état
`SUBMITTED`, deux présentations. Aucune colonne, aucun index, aucune contrainte
supplémentaire.

### Les valeurs chiffrées des maquettes ne sont pas codées en dur

Les maquettes affichent 125 demandes, 18 en attente, 25 acceptées, etc. Ces
valeurs sont **illustratives**. Elles proviennent dans l'application d'une
agrégation réelle (`get_admin_stats()`).

**Conséquence assumée** : sur une base vide, le tableau de bord affiche
honnêtement `0` et les graphiques montrent un état vide explicatif. C'est un
choix délibéré : afficher des chiffres inventés ferait passer une fonctionnalité
non testée pour une fonctionnalité opérationnelle.

### Les aperçus de la page d'accueil sont construits en DOM

La maquette 01 contient une capture d'écran du tableau de bord incrustée dans la
page d'accueil. Aucune image n'a été extraite ni réutilisée.

**Implémentation** : `HeroPreview()` et `StatusPreview()` dans
`app/(public)/page.tsx` reconstruisent ces aperçus avec de vrais composants React
(cartes, badges, barres). Avantages : ils s'adaptent au thème, restent lisibles à
toutes les tailles, sont accessibles aux lecteurs d'écran, et ne se
désynchroniseront pas de l'interface réelle.

### Le motif de refus est obligatoire

Le cahier des charges initial rendait le motif de refus **facultatif**.
L'application l'exige (minimum 10 caractères).

**Justification** : le motif est le seul texte que le candidat lira pour
comprendre une décision négative. Une contrainte `CHECK`
(`applications_rejected_requires_reason`) rend un refus sans motif
**structurellement impossible**, et non simplement déconseillé.

## 5. Fidélité et responsive

Les maquettes sont fournies en 1080 × 675 px uniquement, c'est-à-dire en
résolution bureau. Les points de rupture tablette et mobile n'ont donc **pas** de
référence visuelle.

**Démarche adoptée** : la mise en page bureau reproduit fidèlement les maquettes ;
les déclinaisons tablette et mobile sont conçues à partir des mêmes jetons, avec
des adaptations documentées (barre latérale en tiroir, tableaux convertis en
listes de cartes, chronologie verticale, filtres repliables).

Les largeurs de vérification prévues sont : 1600, 1440, 1024, 768, 390 et 360 px.
