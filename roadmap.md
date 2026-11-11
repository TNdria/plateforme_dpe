# Roadmap

## Corrections TDB DREN — 11 novembre 2026
- [x] Retirer l’accès générationnel et les deux lignes de matières CEPE demandées.
- [x] Calculer les admissions CEPE nationales et par sexe depuis les candidats, sans dépendre des effectifs CM2 ; MADA ATSINANANA 2026 : 79,0 %, garçons 78,1 %, filles 79,8 %.
- [x] Exprimer les rapports des goulots sur une base 100 avec des libellés et fiches cohérents ; 79 tests réussis et affichage réel ATSINANANA vérifié, efficience inchangée.

## Cahier des charges DREN primaire — 9 novembre 2026
- [x] Auditer les requêtes, formules et tableaux existants sans régresser les autres TDB.
- [x] Corriger les données générales, la couverture scolaire et le profil de rétention cumulatif T1–T5 sur N/N−1.
- [x] Corriger les enseignants qualifiés, le personnel administratif et l’indicateur de répartition par R² avec les quatre statuts.
- [x] Corriger les manuels L1, les ratios publics par matière/groupe et leur répartition par R².
- [x] Vérifier les tableaux alignés par établissement, les filtres, les valeurs manquantes et les tests réels : 101 tests réussis, rapports ATSINANANA 2025 et ATSIMO-ATSINANANA 2026 contrôlés.

- [x] Corriger le lien entre les imports Population/Caisse et leurs lignes : date PostgreSQL partagée, récupération des anciens lots uniquement sur correspondance exacte ; 14 tests réussis et service redéployé.
- [ ] Vérifier « Voir » sur un import Population/Caisse réel ; en attente d’une session administrateur Django disponible, distincte de la connexion Cloud.

- [x] Ajuster les libellés de contexte du TdB établissement et afficher OUI/NON pour l’école ; conserver les pourcentages ZAP/CISCO.
- [ ] Alimenter le nombre d’enfants déscolarisés et non scolarisés du TdB établissement ; aucun champ correspondant disponible dans la réponse actuelle.

- [x] Corriger « Autres matières » avec RAKIBOLANA/HISTOIRE/GEOGRAPHIE/SVT par groupe, sans fusion des cellules ; Ensemble reste grisé dans Autres ressources sauf les trois indicateurs demandés.

- [x] Corriger uniquement la présentation du tableau des manuels DREN : sept colonnes, en-têtes fusionnés et bordures, sans modifier les données ; affichage réel ATSINANANA 2025 vérifié et 44 tests réussis.

- [x] Restreindre le téléchargement et l’impression TDB : invité interdit, compte limité à son affectation, administrateurs autorisés partout ; validation serveur déployée, 15 tests réussis et invité vérifié sur ATSINANANA 2025.
- [ ] Vérifier le téléchargement avec un compte CISCO/DREN et administrateur connecté dans l’interface ; en attente d’une session utilisateur disponible (connexion Django distincte du Cloud).

- [x] Redéployer le service db-query à la demande de l’utilisateur et vérifier sa réponse.

- [x] Corriger les zéros injustifiés dans les TDB DREN : lectures CEPE et pourcentages corrigés, valeurs absentes distinguées des zéros ; 53 tests réussis, quatre réponses réelles vérifiées et affichage primaire confirmé après Appliquer.

- [x] Corriger les coupures réseau des imports Caisse école et Population, préserver le remplacement atomique et vérifier les tests.

- [ ] Refaire l’accueil : supprimer les trois badges, rendre la photo et le texte lisibles, harmoniser MEN/DPE et conserver la navigation visible au défilement.

- [x] Compacter les quatre TDB DREN : lecture continue, tableaux plus lisibles, suppression des espaces de hauteur fixe et pagination PDF naturelle ; quatre niveaux vérifiés sur ATSINANANA et PDF primaire A4 de deux pages.

- [x] Aligner la forme et les couleurs de l’efficience DREN sur le TDB école, sans modifier les calculs ; vérification sur ATSINANANA et tests existants réussis.

- [ ] Appliquer le cahier des charges DREN aux quatre niveaux : fiches administratives, tableaux, statuts, formules, métadonnées et export A4, sans recopier les valeurs historiques.
- [x] Corriger les calculs DREN primaire disponibles selon le classeur ; vérifier les données réelles 2025, les valeurs manquantes et les comparaisons nationales.
- [x] Alimenter le TDB DREN préscolaire/collège/lycée avec les colonnes déjà présentes dans la base : TNS et taux de transition (élèves par âge), disciplines enseignées, diplômes académiques, volume horaire, équipements (laboratoire, salle TIC, bibliothèque, accès handicap) et élèves réinsérés (CRAN), calculés côté client depuis les sommes par secteur ; vérifié sur ANALAMANGA 2025 (3 lignes sans source pour collège et lycée, 6 pour le préscolaire).

- [ ] Compléter les indicateurs DREN encore sans source : UEAS et données genrées de rétention. Réconcilier les comptes CEPE et CM2 nationaux incohérents avant publication de leur proportion.

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

- [x] Cartes Données : une carte par onglet (Établissements / Élèves / Personnels),Public / Privé / Total, et détail Personnels avec Fonctionnaires, ENF, Subventionnés et Non subventionnés ; colonne FRAM vide affichée « — » ; 6 tests réussis et ANALAMANGA 2025 vérifié.

- [x] Vérifier la capture PNG de la carte thématique : export aligné sur l'affichage (écart moyen 4/255), tuiles complètes, aucun libellé dupliqué ; conversion des transformations refaite pour rester testable, 168 tests réussis.
