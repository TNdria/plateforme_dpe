import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const VERSION = "v60-20260812-plan-officiel-docx";

const systemPrompt = `Tu es un expert en planification de l'éducation à Madagascar (Direction de la Planification de l'Éducation, MEN).
Tu rédiges le "DOCUMENT DE DIAGNOSTIC DU SYSTÈME ÉDUCATIF" d'une CISCO ou d'une DREN, en respectant STRICTEMENT
le plan officiel et les FORMULES OFFICIELLES ci-dessous. Tu n'inventes AUCUN chiffre : tu n'utilises que les
données et indicateurs fournis dans le bloc DONNÉES. Si une donnée manque, écris "Donnée non disponible".

## PLAN OFFICIEL À RESPECTER À LA LETTRE (titres et numérotation identiques)

# INTRODUCTION
- Contexte national
- Contexte au niveau CISCO/DREN
- Objectif du document

# MONOGRAPHIE
- Localisation géographique de la CISCO/DREN
- Population (utiliser la population totale et la population scolarisable fournies)
- Situation socio-économique et culturelle
- Division administrative
- Organisation sommaire administrative dans la CISCO/DREN
- Tableau de synthèse OBLIGATOIRE : lignes = Nombre d'établissements, Nombre de salles de classe,
  Effectif élèves, Nombre d'enseignants ; colonnes = Préscolaire, Primaire, Collège, Lycée.

# DIAGNOSTIC DU SYSTÈME ÉDUCATIF

## I. COUVERTURE
### 1. COUVERTURE DU PRÉSCOLAIRE
a. Évolution des taux de préscolarisation par genre — Taux = Effectif maternelle / enfants 3-5 ans × 100
b. Évolution des taux de préscolarisation par CISCO / par ZAP
c. Évolution des effectifs par secteur (Public / Privé)
d. Évolution du nombre de CAP par secteur
e. Pourcentage d'EPP pourvu de CAP = Nombre total de CAP / Nombre total d'EPP × 100

### 2. COUVERTURE DU PRIMAIRE
a. Capacité d'accueil : Nombre de salles pour 1000 enfants scolarisables = salles utilisables / enfants 6-10 ans × 1000 ;
   Ratio classe pédagogique/salle = nombre de classes pédagogiques / nombre de salles définitives
b. Évolution des effectifs par secteur
c. Évolution des effectifs par genre
d. Évolution du TBS par genre — TBS = effectif primaire / enfants 6-10 ans × 100
e. Évolution du TBS par commune / par CISCO
f. Évolution du TBA — TBA = (effectif 11ème − redoublants 11ème) / enfants de 6 ans × 100
g. Évolution du TBA par commune / par CISCO

### 3. COUVERTURE DU COLLÈGE
a. Capacité d'accueil : % d'élèves parcourant plus de 5 km ; taux d'utilisation des salles du collège
b. Évolution des effectifs par secteur
c. Évolution des effectifs par genre
d. TBS par genre — effectif collège / enfants 11-14 ans × 100
e. TBS par commune / par CISCO
f. TBA — (effectif 6ème − redoublants 6ème) / enfants de 11 ans × 100
g. TBA par commune / par CISCO
h. Taux de transition 7ème → 6ème

### 4. COUVERTURE DU LYCÉE
a. Capacité d'accueil : taux d'utilisation des salles du lycée
b. Évolution des effectifs par secteur
c. Évolution des effectifs par genre
d. TBS par genre — effectif lycée / enfants 15-17 ans × 100
e. TBS par commune / par CISCO
f. TBA — (effectif 2nde − redoublants 2nde) / enfants de 15 ans × 100
g. TBA par commune / par CISCO
h. Taux de transition 3ème → 2nde

## II. EFFICACITÉ INTERNE
### 1. PRIMAIRE
a. Taux de promotion = (effectif classe supérieure année N − redoublants classe supérieure année N) / effectif classe année N-1 × 100
b. Taux de redoublement = redoublants de la classe année N / effectif de la classe année N-1 × 100
c. Taux d'abandon = 100 % − (taux de promotion + taux de redoublement)
d. Profil de rétention (cohorte T1 → T5) ; Taux apparent de rétention = E(N, T5) / E(N-4, T1) × 100
### 2. COLLÈGE  (mêmes formules : 6ème→5ème, etc., profil de rétention T6 → T9)
### 3. LYCÉE   (mêmes formules : 2nde→1ère, etc., profil de rétention 2nde → Terminale)

## III. QUALITÉ ET ENVIRONNEMENT D'APPRENTISSAGE
### 1. INTRANTS PÉDAGOGIQUES
a. Préscolaire : % d'éducateurs formés ; ratio élève/éducateur par secteur ; ratio élève/place assise ; % de CAP dotés de kits didactiques
b. Primaire : % d'enseignants qualifiés ; % d'enseignants non fonctionnaires (FRAM) ; ratio élève/enseignant par secteur ;
   ratio élève/place assise ; ratio élève/manuel (Malagasy, Mathématiques, Français)
c. Collège : % d'enseignants qualifiés par discipline (scientifique, littéraire, EPS) ; % non fonctionnaires ;
   ratio élève/enseignant par discipline et par secteur ; taux d'utilisation des enseignants par discipline
   (= nombre de sections × horaire maximal hebdomadaire / (nombre d'enseignants × horaire enseignant hebdomadaire) × 100)
d. Lycée : % d'enseignants qualifiés par matière ; % non fonctionnaires ; ratio élève/enseignant par matière ; taux d'utilisation des enseignants par matière
### 2. RÉSULTATS AUX EXAMENS
a. Primaire : taux de réussite au CEPE = admis / inscrits en 7ème × 100 ; scores moyens dans les matières de base
b. Collège : taux de réussite au BEPC = admis / inscrits en 3ème × 100 ; scores moyens dans les matières de base
c. Lycée : taux de réussite au BACC par série

## IV. ANALYSE DES GOULOTS D'ÉTRANGLEMENT ET SYNTHÈSE
Analyse offre / demande / qualité / gouvernance, appuyée sur les tableaux de bord CISCO-DREN.

# ESTIMATION DES BESOINS
- Projection des populations par âge
- Projection des effectifs (primaire, collège, lycée)
- Estimation des besoins en enseignants
- Estimation des besoins en salles de classe
- Estimation des besoins en kits scolaires

# PLAN DE PERFORMANCE
I. PLAN D'ACTION (fiches-action : constat chiffré, cause probable, objectif SMART, activités, acteurs, ressources, indicateurs de suivi, échéance — au moins 4 fiches)
II. ÉLABORATION DU BUDGET PROGRAMME

# CONCLUSION
- Forces
- Faiblesses
- Recommandations
- Axes prioritaires d'intervention

## RÈGLES DE RÉDACTION ET DE FORMATAGE
1. Tous les indicateurs d'évolution portent sur 3 à 5 années scolaires (utilise toutes les années fournies).
2. Rappelle la FORMULE utilisée avant chaque indicateur clé (en italique), puis le chiffre calculé, puis l'interprétation.
3. Un TABLEAU MARKDOWN par sous-section chiffrée (années en colonnes lorsqu'il s'agit d'une évolution).
4. Pour chaque évolution, ajoute un bloc graphique :
\`\`\`chart
{"type":"line","title":"Titre","data":[{"name":"2022","valeur":10}],"dataKeys":["valeur"],"colors":["#1d4ed8"],"labels":["Légende"]}
\`\`\`
Types autorisés : "bar", "line", "pie" (pie : {"type":"pie","title":"...","data":[{"name":"X","value":10}]}).
5. Normes de référence MEN : REM primaire 40-52 ; ratio élève/place assise ≤ 1 ; TBS cible 100 % ;
   redoublement < 10 % ; abandon < 5 % ; enseignants qualifiés > 80 % ; salles en mauvais état < 10 % ;
   distance max primaire 2 km, collège 5 km.
6. Style académique, phrases courtes, analyse causale systématique. Aucune donnée inventée.`;

function fmt(v: unknown): string {
  if (v === null || v === undefined || v === "") return "n.d.";
  return String(v);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    if (url.searchParams.get("action") === "health") {
      return new Response(JSON.stringify({ ok: true, function: "ai-diagnostic", version: VERSION }), {
        headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-cache" },
      });
    }

    const { dataset, drenName, ciscoName, annee } = await req.json();
    if (!dataset || typeof dataset !== "object") {
      return new Response(JSON.stringify({ error: "Dataset manquant : impossible de générer un diagnostic sans données réelles." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const years: number[] = Array.isArray(dataset.years) ? dataset.years : [];
    const pop = dataset.population || {};
    const last = annee && dataset.annees?.[String(annee)] ? Number(annee) : years[years.length - 1];

    const monographie = (() => {
      const d = dataset.annees?.[String(last)];
      if (!d) return "Données non disponibles";
      const line = (label: string, get: (lv: string) => unknown) =>
        `| ${label} | ${fmt(get("presco"))} | ${fmt(get("primaire"))} | ${fmt(get("college"))} | ${fmt(get("lycee"))} |`;
      return [
        "| Rubrique | Préscolaire | Primaire | Collège | Lycée |",
        "|---|---|---|---|---|",
        line("Nombre d'établissements", (lv) => d.etablissements[lv]?.total),
        line("Nombre de salles de classe", (lv) => d.salles[lv]?.total),
        line("Effectif élèves", (lv) => d.eleves[lv]?.total),
        line("Nombre d'enseignants", (lv) => d.enseignants[lv]?.total),
      ].join("\n");
    })();

    const userPrompt = `Rédige le DOCUMENT DE DIAGNOSTIC DU SYSTÈME ÉDUCATIF pour :
${ciscoName ? `**CISCO :** ${ciscoName}` : drenName ? `**DREN :** ${drenName}` : "**Niveau national : Madagascar**"}
${ciscoName && drenName ? `**DREN de rattachement :** ${drenName}` : ""}
**Année scolaire de référence :** ${last}
**Années couvertes par l'analyse d'évolution :** ${years.join(", ")}

## DONNÉES (source : base de données DPE — enquêtes FPE, examens officiels, projections démographiques)

### Population scolarisable (${fmt(pop.source)})
- Population totale : ${fmt(pop.total)}
- Enfants 3-5 ans (préscolaire) : ${fmt(pop.p3_5)}
- Enfants 6-10 ans (primaire) : ${fmt(pop.p6_10)} — dont 6 ans : ${fmt(pop.p6)}
- Enfants 11-14 ans (collège) : ${fmt(pop.p11_14)} — dont 11 ans : ${fmt(pop.p11)}
- Enfants 15-17 ans (lycée) : ${fmt(pop.p15_17)} — dont 15 ans : ${fmt(pop.p15)}

### Tableau monographique (année ${last})
${monographie}

### Données brutes par année scolaire (effectifs par genre et secteur, effectifs et redoublants par classe,
### établissements, salles de classe, sections pédagogiques, places assises, manuels, enseignants, examens)
\`\`\`json
${JSON.stringify(dataset.annees, null, 1)}
\`\`\`

### Indicateurs déjà calculés selon les formules officielles (par année)
\`\`\`json
${JSON.stringify(dataset.indicateurs, null, 1)}
\`\`\`

### Profils de rétention (cohortes apparentes)
\`\`\`json
${JSON.stringify(dataset.retention, null, 1)}
\`\`\`

---
CONSIGNES FINALES :
- Suis EXACTEMENT le plan officiel (INTRODUCTION, MONOGRAPHIE, I. COUVERTURE, II. EFFICACITÉ INTERNE,
  III. QUALITÉ ET ENVIRONNEMENT D'APPRENTISSAGE, IV. GOULOTS D'ÉTRANGLEMENT, ESTIMATION DES BESOINS,
  PLAN DE PERFORMANCE, CONCLUSION), avec la même numérotation.
- Utilise EXCLUSIVEMENT les chiffres ci-dessus ; indique "Donnée non disponible" pour ce qui manque
  (ex. distance parcourue par les élèves, kits didactiques, résultats du BACC si absents).
- Chaque indicateur : formule en italique, valeur, comparaison à la norme, interprétation.
- Tableaux markdown + blocs \`\`\`chart pour toutes les évolutions pluriannuelles.`;

    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableApiKey) throw new Error("LOVABLE_API_KEY not configured");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${lovableApiKey}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 32000,
        temperature: 0.4,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI API error:", response.status, errorText);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requêtes atteinte. Veuillez réessayer dans quelques instants." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Crédit insuffisant. Veuillez recharger votre compte." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI API error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const diagnosticText = aiResponse.choices?.[0]?.message?.content || "Erreur lors de la génération du diagnostic";

    return new Response(
      JSON.stringify({
        diagnostic: diagnosticText,
        drenName: drenName || "",
        ciscoName: ciscoName || "",
        niveau: ciscoName ? "cisco" : drenName ? "dren" : "national",
        annee: String(last),
        generatedAt: new Date().toISOString(),
        version: VERSION,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    console.error("Error in ai-diagnostic:", error);
    return new Response(JSON.stringify({ error: error?.message || "Erreur inconnue" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
