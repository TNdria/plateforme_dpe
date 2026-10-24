# Roadmap

- [x] Redéployer le service db-query à la demande de l’utilisateur et vérifier sa réponse.

- [x] Corriger les zéros injustifiés dans les TDB DREN : lectures CEPE et pourcentages corrigés, valeurs absentes distinguées des zéros ; 53 tests réussis, quatre réponses réelles vérifiées et affichage primaire confirmé après Appliquer.

- [x] Corriger les coupures réseau des imports Caisse école et Population, préserver le remplacement atomique et vérifier les tests.

- [ ] Refaire l’accueil : supprimer les trois badges, rendre la photo et le texte lisibles, harmoniser MEN/DPE et conserver la navigation visible au défilement.

- [x] Compacter les quatre TDB DREN : lecture continue, tableaux plus lisibles, suppression des espaces de hauteur fixe et pagination PDF naturelle ; quatre niveaux vérifiés sur ATSINANANA et PDF primaire A4 de deux pages.

- [x] Aligner la forme et les couleurs de l’efficience DREN sur le TDB école, sans modifier les calculs ; vérification sur ATSINANANA et tests existants réussis.

- [ ] Appliquer le cahier des charges DREN aux quatre niveaux : fiches administratives, tableaux, statuts, formules, métadonnées et export A4, sans recopier les valeurs historiques.
- [x] Corriger les calculs DREN primaire disponibles selon le classeur ; vérifier les données réelles 2025, les valeurs manquantes et les comparaisons nationales.
- [x] Alimenter le TDB DREN préscolaire/collège/lycée avec les colonnes déjà présentes dans la base : TNS et taux de transition (élèves par âge), disciplines enseignées, diplômes académiques, volume horaire, équipements (laboratoire, salle TIC, bibliothèque, accès handicap) et élèves réinsérés (CRAN), calculés côté client depuis les sommes par secteur ; vérifié sur ANALAMANGA 2025 (3 lignes sans source pour collège et lycée, 6 pour le préscolaire).

- [ ] Compléter les indicateurs DREN encore sans source : UEAS, salles définitives, données genrées de rétention, TNS/TNA du primaire, personnel administratif, enseignants « mal répartis » et établissements fermés. Réconcilier les comptes CEPE et CM2 nationaux incohérents avant publication de leur proportion.

- [x] Harmoniser le design de l’accueil et de l’administration sans ajouter de contenu ni modifier les fonctionnalités.

- [x] TDB : retirer les goulots École/ZAP, corriger les neuf indicateurs CISCO et les axes/calculs d'efficience selon les spécifications fournies ; données de rétention/promotion et composantes manquantes signalées sans scores inventés.

- [x] Diagnostic : état de chargement + erreur claire + relance
- [ ] Informations de paiement (en attente de précisions utilisateur)
- [x] Période de téléchargement sélectionnable dans l'export Données
- [x] Suppression du score en tête des TdB (CISCO, DREN)
- [x] Fusion du bloc Efficience (pictogrammes + points de comparaison)
- [x] Export PDF : remplissage d'une page A4
- [x] Libellé « Organisation du réseau scolaire »
- [x] Pictogramme unique bâtiment + couleur par niveau ; villages en points
- [x] Corriger toutes les erreurs de typecheck du build (y compris préexistantes)
