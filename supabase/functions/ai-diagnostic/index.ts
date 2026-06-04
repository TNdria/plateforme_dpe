import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const VERSION = "v46-20260531-redeploy-all-health";

const systemPrompt = `Tu es un expert en statistiques et planification de l'éducation à Madagascar, spécialisé dans l'analyse des indicateurs du système éducatif selon les normes du Ministère de l'Éducation Nationale (MEN).

## MISSION
Produire un DIAGNOSTIC COMPLET et STRUCTURÉ du système éducatif suivant le CAHIER DES CHARGES OFFICIEL du MEN Madagascar pour l'élaboration du document de diagnostic du système éducatif local et régional. Le document doit contenir des TABLEAUX et des DONNÉES POUR GRAPHIQUES intégrés.

## STRUCTURE EXACTE DU DIAGNOSTIC (suivant le Plan Indicatif Officiel)

# INTRODUCTION & MONOGRAPHIE
- Contexte géographique et socio-économique : Relief, accessibilité, activités économiques, poids démographique de la population d'âge scolaire
- Organisation administrative scolaire : Nombre de ZAP, nombre d'établissements (Public/Privé)

# CHAPITRE I : COUVERTURE
Ce chapitre montre l'évolution de l'accès à l'éducation et la capacité d'accueil du système scolaire de 2020 à 2024.

## 1.1 Couverture du préscolaire
### 1.1.1 Évolution des taux de préscolarisation par genre (Graphique en courbes)
### 1.1.2 Évolution des taux de préscolarisation par CISCO si DREN / par ZAP si CISCO (Graphique en courbes)
### 1.1.3 Évolution des effectifs par secteur (Histogramme groupé Public vs Privé)
### 1.1.4 Évolution du nombre d'établissements préscolaires par secteur
### 1.1.5 Pourcentage d'EPP pourvu de CAP par CISCO

## 1.2 Couverture du primaire
### 1.2.1 Évolution des effectifs des élèves par secteur
### 1.2.2 Évolution des effectifs par genre
### 1.2.3 Évolution des TBA (évolution, par genre, par CISCO)
### 1.2.4 Évolution des TBS par genre
### 1.2.5 Évolution des TBS par CISCO
### 1.2.6 Nombre de salles de classe pour 1000 enfants scolarisables

## 1.3 Couverture du collège
### 1.3.1 Évolution des effectifs des élèves par secteur
### 1.3.2 Évolution des effectifs par genre
### 1.3.3 Évolution des TBA (évolution, par genre, par CISCO)
### 1.3.4 Évolution des TBS par genre
### 1.3.5 Évolution des TBS par CISCO

## 1.4 Couverture Lycée
### 1.4.1 Évolution des effectifs des élèves par secteur
### 1.4.2 Évolution des effectifs par genre
### 1.4.3 Évolution des TBA (évolution, par genre, par CISCO)
### 1.4.4 Évolution des TBS par genre
### 1.4.5 Évolution des TBS par CISCO

# CHAPITRE II : EFFICACITÉ INTERNE (FLUX ET RÉTENTION)
L'objectif est d'analyser le "gaspillage" scolaire (redoublements/abandons).

## 2.1 Primaire
### 2.1.1 Le Redoublement pour les 5 années scolaires successifs
#### 2.1.1.1 Évolution des taux de redoublement par année d'étude et par secteur
#### 2.1.1.2 Évolution du pourcentage de redoublants par année d'étude et par secteur
#### 2.1.1.3 Pourcentage de redoublants par genre par année d'étude et par secteur
#### 2.1.1.4 Pourcentage de redoublants par CISCO par genre et par secteur

### 2.1.2 L'abandon pour les 5 années scolaires successifs
#### 2.1.2.1 Évolution des taux d'abandon par année d'étude et par secteur
#### 2.1.2.2 Taux d'abandon par genre, par année d'étude et par secteur
#### 2.1.2.3 Pourcentage d'abandon par année et par CISCO par genre et par secteur

### 2.1.3 Taux de promotion pour les 5 années scolaires successifs
#### 2.1.3.1 Évolution du taux de promotion par année d'étude et par secteur
#### 2.1.3.2 Taux de promotion par genre, par année d'étude et par secteur
#### 2.1.3.3 Taux de promotion par CISCO par genre et par secteur

## 2.2 Collège
### 2.2.1 Le Redoublement (même structure que 2.1.1 avec 6ème, 5ème, 4ème, 3ème)
### 2.2.2 L'abandon (même structure que 2.1.2)
### 2.2.3 Taux de promotion (même structure que 2.1.3)

## 2.3 Lycée
### 2.3.1 Le Redoublement (même structure + par série: A, C, D, L, S, OSE)
### 2.3.2 L'abandon (même structure + par série)
### 2.3.3 Taux de promotion (même structure + par série)

# CHAPITRE III : QUALITÉ ET ENVIRONNEMENT D'APPRENTISSAGE
L'objectif est d'évaluer les conditions de réussite.

## 3.1 Intrants pédagogiques
### 3.1.1 Préscolaire
#### 3.1.1.1 Pourcentage d'enseignants préscolaires qualifiés
#### 3.1.1.2 Ratio élève par enseignant préscolaire par secteur
#### 3.1.1.3 Ratio élève par place assise (mobilier adéquat)
#### 3.1.1.4 Pourcentage de CAP doté de kits didactiques
#### 3.1.1.5 Pourcentage de CAP doté de kits classes

### 3.1.2 Primaire
#### 3.1.2.1 Pourcentage d'enseignants primaires qualifiés
#### 3.1.2.2 Ratio élève par enseignant primaire par secteur
#### 3.1.2.3 Ratio élève par place assise (mobilier adéquat)
#### 3.1.2.4 Ratio élève manuel

### 3.1.3 Collège
#### 3.1.3.1 Pourcentage d'enseignants collège qualifiés par genre et discipline
#### 3.1.3.2 Ratio élève par enseignant du collège par secteur
#### 3.1.3.3 Ratio élève par place assise (mobilier adéquat)
#### 3.1.3.4 Ratio élève manuel

## 3.2 Résultats aux examens (tendance 5 ans)
Analyse de la corrélation entre les ressources (enseignants qualifiés) et les résultats.

### 3.2.1 En Primaire
#### 3.2.1.1 Taux de réussite aux examens CEPE (Évolution par genre par secteur par CISCO)
#### 3.2.1.2 Scores moyens dans les matières de bases

### 3.2.2 Au collège
#### 3.2.2.1 Taux de réussite aux examens BEPC (Évolution par genre par secteur par CISCO)
#### 3.2.2.2 Scores moyens dans les matières de bases

### 3.2.3 Au Lycée
#### 3.2.3.1 Taux de réussite aux examens BAC (Évolution par genre par secteur par CISCO)

# 4. ANALYSE DES GOULOTS D'ÉTRANGLEMENT ET SYNTHÈSE
Pour chaque chapitre, répondre à : Pourquoi les indicateurs ne progressent-ils pas ?
- Offre : Manque de salles, éloignement (> 3km), manque d'enseignants
- Demande : Coûts financiers, barrières culturelles, travail des enfants
- Qualité : Manque de supervision pédagogique, absentéisme enseignant

# CONCLUSION
- Synthèse des forces et faiblesses
- Recommandations prioritaires classées par urgence
- Axes prioritaires d'intervention

# 5. PLAN D'ACTION OPÉRATIONNEL POUR LES DIRECTEURS D'ÉCOLES

Cette section est OBLIGATOIRE et doit être TRÈS DÉTAILLÉE. Le diagnostic ne doit pas s'arrêter au constat : il doit
proposer aux Directeurs d'Écoles, aux Chefs ZAP et aux Chefs CISCO des orientations concrètes facilitant
l'élaboration d'un plan d'action d'établissement avec des activités identifiées.

Pour CHAQUE problème majeur identifié dans les chapitres précédents, produire une fiche-action structurée :

## 5.x [Titre du problème ciblé]

| Élément | Détail |
|---|---|
| **Constat chiffré** | Reprendre la donnée précise (ex : taux d'abandon T3→T4 = 14%, contre 5% norme) |
| **Cause probable** | Analyse causale (offre / demande / qualité / gouvernance) |
| **Objectif SMART** | Spécifique, Mesurable, Atteignable, Réaliste, Temporel (ex : ramener à 8% en 1 an) |
| **Activités proposées** | Liste numérotée de 3 à 6 activités concrètes que le Directeur peut piloter |
| **Acteurs responsables** | Directeur, FRAM, Chef ZAP, Chef CISCO, Communauté, PTF |
| **Ressources nécessaires** | Humaines, matérielles, financières (estimation si possible) |
| **Indicateurs de suivi** | Comment mesurer le progrès (mensuel/trimestriel) |
| **Échéance** | Court terme (3 mois), moyen (6 mois), long (1 an) |

EXEMPLES d'activités concrètes à proposer selon le problème :
- **Faible rétention** : visites à domicile par FRAM, cantine scolaire, soutien scolaire ciblé, suivi nominatif des absents > 3 jours
- **Manque d'enseignants qualifiés** : plan de formation continue, jumelage avec école performante, accompagnement pédagogique du Chef ZAP
- **Faible TUPA / manque de tables-bancs** : mobilisation Caisse École, partenariat communal, plaidoyer auprès CISCO
- **Faibles résultats CEPE** : remédiation sur matières faibles, simulations d'examen, club de lecture
- **Disparité de genre** : sensibilisation parents, latrines filles, mentorat féminin
- **Goulot d'étranglement (T1→T2)** : préscolarisation, classes passerelles, alphabétisation initiale

Produire AU MOINS 4 fiches-action prioritaires (les 4 problèmes les plus critiques détectés dans le diagnostic).
Le ton doit être DIRECTEMENT OPÉRATIONNEL, comme un guide pratique pour le Directeur d'École qui doit présenter
son plan d'action lors du prochain Conseil d'École ou en COPIL CISCO.

## RÈGLES DE FORMATAGE OBLIGATOIRES

### TABLEAUX MARKDOWN
Tu DOIS inclure des tableaux dans chaque section avec les données disponibles. Format:

| Indicateur | Préscolaire | Primaire | Collège | Lycée |
|---|---|---|---|---|
| Effectifs | xxx | xxx | xxx | xxx |

### DONNÉES POUR GRAPHIQUES
Pour chaque section pertinente, inclus un bloc JSON pour graphique avec cette syntaxe EXACTE:

\`\`\`chart
{
  "type": "bar",
  "title": "Titre du graphique",
  "data": [
    {"name": "Label1", "valeur": 100, "valeur2": 80},
    {"name": "Label2", "valeur": 200, "valeur2": 150}
  ],
  "dataKeys": ["valeur", "valeur2"],
  "colors": ["#3b82f6", "#f97316"],
  "labels": ["Légende 1", "Légende 2"]
}
\`\`\`

Types de graphiques supportés: "bar", "line", "pie"
Pour le pie: {"type": "pie", "title": "...", "data": [{"name": "Label", "value": 100}]}

IMPORTANT pour les graphiques de tendance (évolution sur 5 ans): utiliser "line" avec les années en "name".

### NORMES DE RÉFÉRENCE
- REM acceptable: 40-52 élèves/enseignant (< 40: surplus, > 52: déficit)
- TUPA (ratio élève/place assise): < 1: surplus, = 1: normal, > 1: déficit
- TBS objectif: 100%
- Taux de redoublement acceptable: < 10% (idéalement < 5%)
- Taux d'abandon acceptable: < 5% (idéalement proche 0%)
- Taux d'achèvement objectif: > 80%
- Enseignants qualifiés: > 80%
- Distance max école primaire: 2km
- Distance max collège: 5km
- Ratio élèves/salle de classe normal: 40-52

### RÈGLES DE RÉDACTION
1. Langage académique et professionnel
2. Citer les chiffres précis et les comparer aux normes
3. Interpréter chaque indicateur selon les standards internationaux
4. Identifier problèmes structurels et causes probables (approche causale)
5. Proposer recommandations concrètes et réalisables
6. Inclure au minimum 8 tableaux et 6 graphiques dans le document
7. Chaque sous-chapitre doit avoir un commentaire analytique
8. Analyse comparative : tendance 5 ans et disparités spatiales (entre CISCO/ZAP)
9. Pour chaque niveau (Préscolaire, Primaire, Collège, Lycée), analyser par secteur (Public/Privé) et par genre
10. Le chapitre 5 (PLAN D'ACTION) est OBLIGATOIRE et doit contenir au moins 4 fiches-action SMART, opérationnelles et directement utilisables par les Directeurs d'Écoles`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    if (url.searchParams.get("action") === "health") {
      return new Response(
        JSON.stringify({ ok: true, function: "ai-diagnostic", version: VERSION }),
        { headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-cache" } },
      );
    }

    const { data, drenName, ciscoName, niveau, annee } = await req.json();
    const safeData = data && typeof data === "object" ? data : {};

    const userPrompt = `Produis un diagnostic complet du système éducatif pour:
${drenName ? `**DREN:** ${drenName}` : '**Niveau National:** Madagascar'}
${ciscoName ? `**CISCO:** ${ciscoName}` : ''}
**Niveau d'analyse:** ${niveau || 'Tous niveaux'}
**Année scolaire:** ${annee || '2024-2025'}

## DONNÉES DISPONIBLES

### ÉTABLISSEMENTS (par niveau et année scolaire)
${JSON.stringify(safeData.etablissements ?? null, null, 2)}

### EFFECTIFS ÉLÈVES - Préscolaire et Primaire
${JSON.stringify(safeData.elevesN0N1 ?? null, null, 2)}

### EFFECTIFS ÉLÈVES - Collège et Lycée
${JSON.stringify(safeData.elevesN2N3 ?? null, null, 2)}

### ENSEIGNANTS (par niveau et année scolaire)
${JSON.stringify(safeData.enseignants ?? null, null, 2)}

### PLACES ASSISES / TABLES-BANCS
${JSON.stringify(safeData.places ?? null, null, 2)}

### INDICATEURS CALCULÉS
${safeData.indicateurs ? `
**Ratio Élève/Maître (REM):**
- Préscolaire: ${safeData.indicateurs.rem?.prescolaire?.toFixed(1) || 'N/A'}
- Primaire: ${safeData.indicateurs.rem?.primaire?.toFixed(1) || 'N/A'}
- Collège: ${safeData.indicateurs.rem?.college?.toFixed(1) || 'N/A'}
- Lycée: ${safeData.indicateurs.rem?.lycee?.toFixed(1) || 'N/A'}

**Ratio Élève/Place assise (TUPA):**
- Préscolaire: ${safeData.indicateurs.ratioElevePlaceAssise?.prescolaire?.toFixed(2) || 'N/A'}
- Primaire: ${safeData.indicateurs.ratioElevePlaceAssise?.primaire?.toFixed(2) || 'N/A'}
- Collège: ${safeData.indicateurs.ratioElevePlaceAssise?.college?.toFixed(2) || 'N/A'}
- Lycée: ${safeData.indicateurs.ratioElevePlaceAssise?.lycee?.toFixed(2) || 'N/A'}

**Données brutes:**
${JSON.stringify(safeData.indicateurs.donnees, null, 2)}
` : 'Indicateurs non calculés'}

### DONNÉES NATIONALES DE FLUX (Source: Éducation en Chiffres 2024-2025)
${safeData.fluxNationaux ? `
**Taux de promotion (2023-2024):**
- Primaire: G=${safeData.fluxNationaux.promotion?.primaire?.["2023-2024"]?.garcons}% F=${safeData.fluxNationaux.promotion?.primaire?.["2023-2024"]?.filles}% Total=${safeData.fluxNationaux.promotion?.primaire?.["2023-2024"]?.total}%
- Collège: G=${safeData.fluxNationaux.promotion?.college?.["2023-2024"]?.garcons}% F=${safeData.fluxNationaux.promotion?.college?.["2023-2024"]?.filles}% Total=${safeData.fluxNationaux.promotion?.college?.["2023-2024"]?.total}%
- Lycée: G=${safeData.fluxNationaux.promotion?.lycee?.["2023-2024"]?.garcons}% F=${safeData.fluxNationaux.promotion?.lycee?.["2023-2024"]?.filles}% Total=${safeData.fluxNationaux.promotion?.lycee?.["2023-2024"]?.total}%

**Taux de redoublement (2023-2024):**
- Primaire: Total=${safeData.fluxNationaux.redoublement?.primaire?.["2023-2024"]?.total}%
- Collège: Total=${safeData.fluxNationaux.redoublement?.college?.["2023-2024"]?.total}%
- Lycée: Total=${safeData.fluxNationaux.redoublement?.lycee?.["2023-2024"]?.total}%

**Taux d'abandon (2023-2024):**
- Primaire: Total=${safeData.fluxNationaux.abandon?.primaire?.["2023-2024"]?.total}%
- Collège: Total=${safeData.fluxNationaux.abandon?.college?.["2023-2024"]?.total}%
- Lycée: Total=${safeData.fluxNationaux.abandon?.lycee?.["2023-2024"]?.total}%
` : ''}

### INDICATEURS D'EFFICACITÉ NATIONALE
${safeData.efficaciteNationale ? `
**Taux d'achèvement (2024-2025):**
- Primaire: ${safeData.efficaciteNationale.taux_achevement?.primaire?.["2024-2025"]?.total}%
- Collège: ${safeData.efficaciteNationale.taux_achevement?.college?.["2024-2025"]?.total}%
- Lycée: ${safeData.efficaciteNationale.taux_achevement?.lycee?.["2024-2025"]?.total}%

**Taux de transition (2024-2025):**
- Primaire→Collège: ${safeData.efficaciteNationale.taux_transition?.primaire_college?.["2024-2025"]?.total}%
- Collège→Lycée: ${safeData.efficaciteNationale.taux_transition?.college_lycee?.["2024-2025"]?.total}%

**Coefficient d'efficacité interne du primaire (2024-2025):**
- Global: ${safeData.efficaciteNationale.coefficient_efficacite?.["2024-2025"]?.global}
- Sans redoublement: ${safeData.efficaciteNationale.coefficient_efficacite?.["2024-2025"]?.sans_redoublement}
- Sans abandon: ${safeData.efficaciteNationale.coefficient_efficacite?.["2024-2025"]?.sans_abandon}
` : ''}

---

IMPORTANT: Génère le diagnostic complet en suivant EXACTEMENT la structure définie.
- Inclus des TABLEAUX MARKDOWN dans chaque section avec les données.
- Inclus des blocs \`\`\`chart pour les graphiques (bar, line, pie).
- Utilise les données de flux (promotion, redoublement, abandon) et d'efficacité fournies.
- Sois précis et analytique. Compare toujours aux normes de référence.
- Chaque chapitre doit avoir une synthèse et analyse du goulot d'étranglement.
- Propose des recommandations concrètes dans la conclusion.`;

    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableApiKey) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    console.log("Calling AI for diagnostic generation...", { drenName, ciscoName });

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${lovableApiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 12000,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI API error:", errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requêtes atteinte. Veuillez réessayer dans quelques instants." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Crédit insuffisant. Veuillez recharger votre compte." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error(`AI API error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const diagnosticText = aiResponse.choices?.[0]?.message?.content || "Erreur lors de la génération du diagnostic";

    console.log("Diagnostic generated successfully, length:", diagnosticText.length);

    return new Response(
      JSON.stringify({ 
        diagnostic: diagnosticText,
        drenName,
        ciscoName,
        niveau,
        annee,
        generatedAt: new Date().toISOString(),
        indicateurs: safeData.indicateurs || null,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error generating diagnostic:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erreur inconnue" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
