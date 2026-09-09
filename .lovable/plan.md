## Objectif

Refonte cohérente des Tableaux de Bord (École Primaire/CEG/Lycée, ZAP, CISCO, DREN) pour : indicateurs de disparité genre, identité visuelle DPE, mise en page PDF optimisée, bloc Efficience enrichi, et séparation Localisation / ORS.

## 1. Indicateurs de disparité genre (tous TDB)

Ajouter un nouveau bloc **"Disparité Filles / Garçons"** dans chaque TDB, contenant :

- Taux de rétention par genre (F / G + écart)
- Nombre et taux de redoublants par genre
- % admis BEPC par genre (CEG/Collège) — % CEPE pour Primaire, % BACC pour Lycée
- Visualisation : barres comparatives horizontales F vs G + badge d'écart (couleur selon défaveur)

Fichiers : `src/pages/TDBEcole.tsx`, `TDBZap.tsx`, `TDBCisco.tsx`, `TDBDren.tsx` + nouveau composant `src/components/tdb/DisparityGenderBlock.tsx`.

## 2. Identité visuelle DPE

- Logo DPE déjà présent dans `AnimatedLogo` (cross-fade MEN/DPE). Ajouter dans `TDBShell` un logo DPE **statique** en haut-droite (visible PDF + responsive).
- Vérifier rendu dans `utils/htmlToPdf.ts` et `utils/printTdb.ts`.

## 3. Réorganisation mise en page PDF

Nouvel ordre dans l'onglet principal :
```
[Efficience (pleine largeur)]
[Diagnostic & Interprétation (pleine largeur)]
```
Au lieu de la grille actuelle. Réduire `gap`, `py`, `space-y`.

## 4. Bloc Efficience enrichi

- Pictogrammes Lucide par indicateur (TrendingUp, GraduationCap, etc.)
- Illustration établissement (icône School stylisée)
- Visuel moyenne ZAP (icône Network)
- Tableau comparatif 3 colonnes : **Établissement | Moyenne ZAP | Moyenne CISCO**
- Indicateurs visuels (flèches ↑↓ couleurs sémantiques)

Nouveau composant : `src/components/tdb/EfficienceBlock.tsx`.

## 5. Optimisation PDF

- Dans `utils/htmlToPdf.ts` / `printTdb.ts` : forcer `@page` margin réduit, `page-break-inside: avoid` sur les cartes, layout flex-grow pour remplir la page.
- Supprimer espaces blancs (`mt-*` excessifs).

## 6. Séparation Localisation / ORS

Actuellement onglet `localisation` contient les deux. Refactor :

- Onglet **Localisation** : carte établissement + village + bouton "Mettre à jour coordonnées".
- Nouvel onglet **ORS** : analyse ORS (distance, isochrones, accessibilité) — déplacer le contenu ORS existant.

Mise à jour de `tabs` array dans `TDBEcole.tsx` (+ équivalents si présents dans ZAP/CISCO).

## 7. Cohérence

Appliquer 1–5 aux 4 fichiers TDB. Le point 6 concerne principalement `TDBEcole.tsx`.

## Détails techniques

- **Nouveaux composants** : `DisparityGenderBlock.tsx`, `EfficienceBlock.tsx`, `LocalisationTab.tsx`, `ORSTab.tsx`.
- **TDBShell** : prop `headerLogo` (logo DPE statique top-right, classe `print:block`).
- **PDF** : ajouter classes `print:break-inside-avoid`, `print:py-2` ; tester via `utils/htmlToPdf.ts`.
- **Données disparité** : utiliser `nbr_g` / `nbr_f` déjà disponibles via edge function `db-query`. Pour rétention, calculer `(inscrits_n - abandons) / inscrits_n` par genre si colonnes présentes — sinon afficher "Données non disponibles".
- **Comparaison ZAP/CISCO dans Efficience** : étendre `db-query` pour retourner moyennes agrégées ZAP et CISCO de l'établissement (nouvelle action `getEfficienceContext`).

## Hors scope

- Pas de modification du modèle d'import CSV.
- Pas de changement des permissions/auth.
- Pas de refonte de la carte thématique DataViz.
