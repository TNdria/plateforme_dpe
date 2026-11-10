// @ts-nocheck
import {
  toNumber, toNum, premierNonVide, fmtFr, esc, fmtMilliers, fmtDistanceFiche,
  dateLongueFr, anneeScolaireCourante, anneeScolaireDepuisDate, normaliserAnneeLabel,
  extraireSerieEffectifs, niveauToKey, getLocalisationValue, getLatitude, getLongitude,
  getDemandeur, getCodeProvisoireMen, calculerDernierEffectifConnu,
  normaliserEvolutionPourAffichage, getAireRecrutementAnalyse,
  getEtablissementsProchesPourNiveau, getPiecesAnalyse, getPersonnelDetailAnalyse,
  getNomAireItem, getCodeAireItem, estPayeParEtat, estDiplomeSuperieur, valeurOuiNon,
  texteObstacle, getDistancePlusProche,
  // ✅ Nouveaux helpers nouvelle création
  getVillageNonEligible, getZoneProposee,
} from "@/utils/demandeHelpers";

import {
  SEUIL_EFFECTIF_MIN, SURFACE_NORME_M2, RAYON_TABLEAU_PROCHES_KM,
  FICHE_NIVEAU, NIVEAU_COLONNES_EFFECTIF,
} from "@/components/demandes/ConstantesColonnes";

export const genererFicheTechnique = (demande, carteBase64 = null, analyseValidee = null) => {
  if (!demande) return "";

  const typeDemandeNormalise = String(demande?.type_demande || "")
    .trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  const estRegularisation = typeDemandeNormalise.includes("regularisation");

  const niveauKey = niveauToKey(demande?.niveau_etab || demande?.niveau);
  const cfg = FICHE_NIVEAU[niveauKey] || FICHE_NIVEAU.primaire;
  const estEcole = niveauKey === "college" || niveauKey === "lycee";

  // ✅ Nouvelle création : points particuliers
  const villageNonEligible = getVillageNonEligible(demande);
  const zoneProposee = getZoneProposee(demande);
  const remplaceVillage = Boolean(zoneProposee?.aUnNom);

  const nomEtab = fmtFr(
    zoneProposee && zoneProposee.aUnNom ? zoneProposee.nom : demande?.nom_etab
  );
  const commune = getLocalisationValue(demande, "commune");
  const cisco = getLocalisationValue(demande, "cisco");
  const dren = getLocalisationValue(demande, "dren");
  const fokontany = getLocalisationValue(demande, "fokontany");
  const village = getLocalisationValue(demande, "village");
  const zap = getLocalisationValue(demande, "zap");

  const codeProvisoire = getCodeProvisoireMen(demande) || "NÉANT";
  const nomDemandeur = getDemandeur(demande);
  const motifDemande = premierNonVide(demande?.motif, demande?.motifs, demande?.objet_demande);
  const dateDepotBrute = demande?.date_depot ?? demande?.date_creation;

  const ressources = demande?.ressources || {};
  const regularisation = demande?.regularisation || {};
  const nouvelleCreation = demande?.nouvelle_creation || {};
  const sourceInfra = estRegularisation ? regularisation : nouvelleCreation;

  const surfaceTerrain = premierNonVide(
    nouvelleCreation?.surface_terrain_prevu,
    nouvelleCreation?.surface_terrain,
    nouvelleCreation?.superficie_terrain,
    nouvelleCreation?.superficie,
    nouvelleCreation?.surface,
    nouvelleCreation?.superficie_terrain_prevu,
    regularisation?.surface_terrain,
    regularisation?.superficie_terrain,
    regularisation?.superficie,
    regularisation?.surface,
    ressources?.surface_terrain,
    ressources?.superficie_terrain,
    ressources?.superficie,
    ressources?.surface,
    demande?.surface_terrain,
    demande?.superficie_terrain,
    demande?.superficie,
    demande?.surface,
    demande?.info_complementaire?.surface_terrain,
    demande?.info_complementaire?.superficie_terrain,
  );

  const aire = getAireRecrutementAnalyse(demande);
  const proches = getEtablissementsProchesPourNiveau(demande);
  const pieces = getPiecesAnalyse(demande);
  const evolutionNorm = normaliserEvolutionPourAffichage(demande);

  const evolutionTriee = [...evolutionNorm].sort((a, b) =>
    normaliserAnneeLabel(a?.annee ?? a?.annee_scolaire).localeCompare(
      normaliserAnneeLabel(b?.annee ?? b?.annee_scolaire)
    )
  );
  const dernieresAnnees = evolutionTriee.slice(-3);
  const anneeDerniereConnue =
    normaliserAnneeLabel(
      evolutionTriee[evolutionTriee.length - 1]?.annee ??
        evolutionTriee[evolutionTriee.length - 1]?.annee_scolaire
    ) || anneeScolaireCourante();
  const effectifDerniere = calculerDernierEffectifConnu(demande);

  const anneeEnquete = anneeDerniereConnue;
  const anneeEnqueteCourte = anneeEnquete.replace(/(\d{2})(\d{2})-(\d{2})(\d{2})/, "$2-$4");

  const th = (txt, attrs = "") => `<th ${attrs}>${esc(txt)}</th>`;
  const td = (txt, attrs = "") => `<td ${attrs}>${esc(txt)}</td>`;
  const tbl = (thead, tbody, cls = "", largeurs = []) => {
    const colgroup = largeurs.length
      ? `<colgroup>${largeurs.map((w) => `<col style="width:${w}%" width="${w}%" />`).join("")}</colgroup>`
      : "";
    // Ligne de total : simplement en gras, sans aucune couleur de fond
    const corps = tbody.replace(/<tr class="total">[\s\S]*?<\/tr>/g, (m) =>
      m.replace(/<td /g, '<td style="font-weight:bold;" ')
    );
    return `<table class="${cls}" width="100%" border="1" cellspacing="0" cellpadding="4">${colgroup}<thead>${thead}</thead><tbody>${corps}</tbody></table>`;
  };
  const source = (txt) => `<p class="source"><u>Source</u> : ${esc(txt)}</p>`;
  const tiret = (html) => `<p class="tiret">–&nbsp;&nbsp;${html}</p>`;
  const puce = (html) => `<p class="puce-titre">•&nbsp;&nbsp;${html}</p>`;
  const vide = `<p class="vide">NÉANT</p>`;
  // Titre de section : numéro en gras, intitulé souligné (comme la fiche de référence)
  const section = (num, titre) =>
    `<h2><span class="num">${num} -</span>&nbsp;&nbsp;&nbsp;<u>${esc(titre)}</u> :</h2>`;
  const sousTitre = (num, titre) => `<h3>${num ? `${num} - ` : ""}${esc(titre)}</h3>`;
  const ligneLoc = (label, valeur) =>
    `<p class="loc">${esc(label).padEnd(10, " ").replace(/ /g, "&nbsp;")}<span class="deux-points">:</span> <strong>${esc(valeur)}</strong></p>`;

  // ✅ Mention nouvelle création dans l'objet
  const suffixeVillage = (() => {
    if (zoneProposee && zoneProposee.aUnNom) {
      return ` <em>(zone éligible : ${esc(zoneProposee.nom)})</em>`;
    }
    if (villageNonEligible?.nom) {
      return ` <em>(village initial : ${esc(villageNonEligible.nom)}, non éligible)</em>`;
    }
    return "";
  })();

  const objetHtml = `<p class="texte">Demande d'ouverture officielle ${esc(cfg.de)}<strong>${esc(cfg.long)} ${esc(nomEtab)}</strong>, CISCO <strong>${esc(cisco)}</strong>, DREN <strong>${esc(dren)}</strong>${suffixeVillage}.</p>`;

  const contexteHtml = `<p class="texte">Par sa lettre${dateDepotBrute ? ` en date du <strong>${esc(dateLongueFr(dateDepotBrute))}</strong>` : ""}, ${nomDemandeur !== "—" ? `<strong>${esc(nomDemandeur)}</strong>, ` : ""}commune de <strong>${esc(commune)}</strong>, CISCO de <strong>${esc(cisco)}</strong>, DREN de <strong>${esc(dren)}</strong>, sollicite la délivrance de l'autorisation d'ouverture officielle ${esc(cfg.de)}<strong>${esc(cfg.long)} ${esc(nomEtab)}</strong>.</p>${motifDemande ? `<p class="texte"><em>Motif invoqué :</em> ${esc(motifDemande)}</p>` : ""}`;

  const piecesHtml = Array.isArray(pieces) && pieces.length
    ? pieces.map((p, i) => {
        const nom = p?.nom_piece || p?.nom || p?.libelle || "—";
        const fourni = p?.fourni === undefined ? true : Boolean(p?.fourni);
        const fin = i === pieces.length - 1 ? "" : " ;";
        return tiret(`${esc(nom)}${fourni ? "" : " <em>(non fournie)</em>"}${fin}`);
      }).join("")
    : vide;

  const anneeOuvertureProv = regularisation?.date_ouverture
    ? anneeScolaireDepuisDate(regularisation.date_ouverture) : null;

  const lieuImplantation =
    [village !== "—" ? village : "", fokontany !== "—" ? `fokontany ${fokontany}` : ""]
      .filter(Boolean).join(", ") || "NÉANT";

  // ✅ Bloc localisation enrichi avec les infos nouvelle création
  const nouvelleCreationLocalisationHtml = (() => {
    if (!villageNonEligible && !zoneProposee) return "";

    let html = "";

    if (zoneProposee && zoneProposee.aUnNom) {
      html += tiret(
        `Zone éligible retenue : <strong>${esc(zoneProposee.nom)}</strong>`
        + (zoneProposee.fokontany ? ` (fokontany ${esc(zoneProposee.fokontany)})` : "")
        + (zoneProposee.commune ? `, commune ${esc(zoneProposee.commune)}` : "")
      );
      if (villageNonEligible?.nom) {
        html += tiret(
          `Village initialement sélectionné : <strong>${esc(villageNonEligible.nom)}</strong> `
          + `<em>(non éligible pour une nouvelle création — remplacé par la zone éligible)</em>`
        );
      }
    } else if (zoneProposee && !zoneProposee.aUnNom) {
      html += tiret(
        `Zone éligible proposée : <strong>sans nom</strong>`
        + (zoneProposee.fokontany ? ` (fokontany ${esc(zoneProposee.fokontany)})` : "")
        + (zoneProposee.commune ? `, commune ${esc(zoneProposee.commune)}` : "")
        + ` — affichée sur la carte à côté du village non éligible`
      );
      if (villageNonEligible?.nom) {
        html += tiret(
          `Village initialement sélectionné : <strong>${esc(villageNonEligible.nom)}</strong> `
          + `<em>(non éligible pour une nouvelle création)</em>`
        );
      }
    } else if (villageNonEligible?.nom) {
      html += tiret(
        `Village initialement sélectionné : <strong>${esc(villageNonEligible.nom)}</strong> `
        + `<em>(non éligible pour une nouvelle création)</em>`
      );
    }

    return html;
  })();

  const localisationHtml = `
    ${tiret(`Lieu d'implantation : <strong>${esc(lieuImplantation)}</strong>`)}
    <div class="bloc-loc">
      ${ligneLoc("Code", codeProvisoire)}
      ${ligneLoc("COMMUNE", zoneProposee?.commune || commune)}
      ${zap !== "—" ? ligneLoc("ZAP", zap) : ""}
      ${ligneLoc("CISCO", cisco)}
      ${ligneLoc("DREN", dren)}
    </div>
    ${tiret(`Superficie du domaine : <strong>${surfaceTerrain !== null ? `${esc(fmtMilliers(surfaceTerrain))} m²` : "NÉANT"}</strong>`)}
    ${anneeOuvertureProv ? tiret(`Année d'ouverture provisoire : <strong>${esc(anneeOuvertureProv)}</strong>`) : ""}
    ${nouvelleCreationLocalisationHtml}
  `;

  const lat = getLatitude(demande);
  const lng = getLongitude(demande);

  const carteHtml = carteBase64
    ? `<div class="carte"><img src="${carteBase64}" alt="Analyse spatiale" class="carte-image" width="680" /><p class="carte-source">${lat !== null && lng !== null ? `Coordonnées : ${lat.toFixed(5)}, ${lng.toFixed(5)} — ` : ""}SOURCE MEN / DPE ${new Date().getFullYear()}</p></div>`
    : lat !== null && lng !== null
    ? `<p class="vide">Carte en cours de génération… (coordonnées : ${lat.toFixed(5)}, ${lng.toFixed(5)})</p>`
    : `<p class="vide">Coordonnées GPS non disponibles pour la carte.</p>`;

  let aireTableHtml = vide;
  let totauxAnnuelsAire = [];

  if (aire.length && estEcole) {
    const LABEL_DERNIERE = "Dernière année connue";
    const valeurUnique = (item) =>
      toNumber(niveauKey === "lycee" ? item?.effectif_t9 ?? item?.effectif : item?.effectif_t5 ?? item?.effectif);

    const series = aire.map((item) => {
      const s = extraireSerieEffectifs(item);
      if (Object.keys(s).length) return s;
      const u = valeurUnique(item);
      return u !== null ? { [LABEL_DERNIERE]: u } : {};
    });

    const annees = Array.from(new Set(series.flatMap((s) => Object.keys(s)))).sort((a, b) => {
      if (a === LABEL_DERNIERE) return 1;
      if (b === LABEL_DERNIERE) return -1;
      return a.localeCompare(b);
    });
    const colonnes = annees.length ? annees : [LABEL_DERNIERE];
    const totaux = colonnes.map((c) => series.reduce((acc, s) => acc + (s[c] ?? 0), 0));
    totauxAnnuelsAire = totaux;

    const head = `<tr>${th("CODE ETAB", 'rowspan="2"')}${th(cfg.aireNomCol, 'rowspan="2"')}${th(`Distance par rapport ${cfg.auNouveau} à vol d'oiseau`, 'rowspan="2"')}${th(cfg.aireEffLabel, `colspan="${colonnes.length}"`)}</tr><tr>${colonnes.map((c) => th(c)).join("")}</tr>`;

    const body = aire.map((item, i) => {
      const s = series[i];
      const nom = item?.nom_inferieur ?? item?.nom_ecole ?? getNomAireItem(item);
      return `<tr>${td(getCodeAireItem(item), 'class="c"')}${td(nom)}${td(fmtDistanceFiche(item?.distance_future ?? item?.distance_km ?? item?.distance), 'class="c"')}${colonnes.map((c) => td(s[c] !== undefined ? s[c] : "—", 'class="c"')).join("")}</tr>`;
    }).join("") + `<tr class="total">${td("Total", 'colspan="3"')}${totaux.map((t) => td(t, 'class="c"')).join("")}</tr>`;

    aireTableHtml = tbl(head, body, "aire");
  } else if (aire.length) {
    const popTotal = aire.reduce((acc, item) =>
      acc + toNum(item?.population ?? item?.population_scolarisable), 0);
    totauxAnnuelsAire = [popTotal];

    const head = `<tr>${th("N°")}${th("Fokontany")}${th("Nom du village")}${th(`Distance par rapport ${cfg.auNouveau} à vol d'oiseau`)}${th("Population")}</tr>`;

    const body = aire.map((item, i) =>
      `<tr>${td(i + 1, 'class="c"')}${td(item?.fokontany ?? fokontany ?? "—")}${td(item?.nom_village ?? item?.village_nom ?? item?.nom ?? getNomAireItem(item))}${td(fmtDistanceFiche(item?.distance_future ?? item?.distance_km ?? item?.distance), 'class="c"')}${td(item?.population ?? item?.population_scolarisable ?? "—", 'class="c"')}</tr>`
    ).join("") + `<tr class="total">${td("Total", 'colspan="4"')}${td(popTotal, 'class="c"')}</tr>`;

    aireTableHtml = tbl(head, body, "aire");
  }

  const nbAirePad = String(aire.length).padStart(2, "0");
  const introEvaluation = aire.length
    ? `D'après la demande d'ouverture ${esc(cfg.de)}${esc(cfg.court)} ${esc(nomEtab)}, la zone de recrutement est formée par les <strong>${nbAirePad}</strong> ${esc(cfg.aireNom)} dont les renseignements sont cités ci-après :`
    : `Aucune donnée d'aire de recrutement n'a été renseignée dans la demande d'ouverture ${esc(cfg.de)}${esc(cfg.court)} ${esc(nomEtab)}.`;

  const prochesTries = [...proches].sort((a, b) => {
    const da = toNumber(a?.distance_km ?? a?.distance);
    const db = toNumber(b?.distance_km ?? b?.distance);
    return (da ?? Infinity) - (db ?? Infinity);
  });

  const rayonProches = RAYON_TABLEAU_PROCHES_KM[niveauKey] ?? 5;
  const effectifTotalProches = prochesTries.reduce((acc, p) =>
    acc + toNum(p?.effectif ?? p?.effectif_total), 0);

  const prochesTableHtml = prochesTries.length
    ? tbl(
        `<tr>${th(`Liste des ${cfg.pluriel} existants dans la CISCO de rattachement ainsi que les ${cfg.pluriel} environnants (moins de ${rayonProches} km)`)}${th("Distance à vol d'oiseau avec " + cfg.leNouveau + " (km)")}${th("Obstacle par rapport " + cfg.auNouveau)}${th("Effectif total des élèves")}${th("Nombre de salles de classe utilisées")}</tr>`,
        prochesTries.map((p) =>
          `<tr>${td(String(p?.nom || p?.nom_etab || p?.nom_etablissement || "—").toUpperCase())}${td(fmtDistanceFiche(p?.distance_km ?? p?.distance), 'class="c"')}${td(texteObstacle(p), 'class="c"')}${td(p?.effectif ?? p?.effectif_total ?? "—", 'class="c"')}${td(p?.salle ?? p?.nombre_salle ?? p?.nombre_salle_classe ?? "—", 'class="c"')}</tr>`
        ).join("") + `<tr class="total">${td("TOTAL")}${td("")}${td("")}${td(effectifTotalProches, 'class="c"')}${td("")}</tr>`,
        "proches"
      )
    : vide;

  const colsClasses = NIVEAU_COLONNES_EFFECTIF[niveauKey] || [];

  let effectifsHtml = "";
  if (estRegularisation) {
    if (dernieresAnnees.length && colsClasses.length) {
      const k = colsClasses.length;
      const head = `<tr>${th("")}${dernieresAnnees.map((e) => th(normaliserAnneeLabel(e?.annee ?? e?.annee_scolaire) || "—", `colspan="${k}"`)).join("")}</tr><tr>${th("CLASSE", 'class="l"')}${dernieresAnnees.map(() => colsClasses.map((c) => th(c.label)).join("")).join("")}</tr>`;

      const body = `<tr>${td("EFFECTIFS", 'class="l b"')}${dernieresAnnees.map((e) => colsClasses.map((c) => td(toNumber(e?.[c.key]) ?? "—", 'class="c"')).join("")).join("")}</tr><tr class="total">${td("Total", 'class="l"')}${dernieresAnnees.map((e) => td(toNum(e?.effectif_total), `colspan="${k}" class="c"`)).join("")}</tr>`;

      effectifsHtml = puce(`<strong>Effectif des élèves des trois dernières années scolaires</strong>`) +
        tbl(head, body, "effectifs dense", [13, ...dernieresAnnees.flatMap(() => colsClasses.map(() => 87 / (3 * k)))].slice(0, 1 + dernieresAnnees.length * k)) +
        source(`Dossier d'ouverture ${nomEtab}`);
    } else {
      effectifsHtml = puce(`<strong>Effectif des élèves des trois dernières années scolaires</strong>`) + vide;
    }
  }

  const nbBatiments = premierNonVide(sourceInfra?.nbr_batiment, sourceInfra?.nombre_batiment, sourceInfra?.nombre_batiment_prevu);
  const nbSalles = premierNonVide(sourceInfra?.nbr_salle, sourceInfra?.nombre_salle, sourceInfra?.nombre_salle_prevu);
  const nbBureaux = premierNonVide(sourceInfra?.nombre_bureau, sourceInfra?.nbr_bureau, sourceInfra?.bureau, ressources?.nombre_bureau, ressources?.nbr_bureau, ressources?.bureau);
  const nbLatrines = premierNonVide(sourceInfra?.latrine_total, ressources?.latrine_total);
  const nbPointsEau = premierNonVide(sourceInfra?.nombre_point_eau, sourceInfra?.nbr_point_eau, sourceInfra?.point_eau, ressources?.nombre_point_eau, ressources?.nbr_point_eau, ressources?.point_eau);
  const terrainSport = (() => {
    const candidats = [
      sourceInfra?.terrain_sport,
      sourceInfra?.terrain_de_sport,
      ressources?.terrain_sport,
      ressources?.terrain_de_sport,
      demande?.terrain_sport,
      demande?.terrain_de_sport,
    ];
    for (const v of candidats) {
      if (v === true || v === false) return v;
      if (v === 0 || v === 1) return Boolean(v);
      if (typeof v === "string" && v.trim() !== "") {
        const s = v.trim().toLowerCase();
        if (["true", "1", "oui", "yes", "bon", "x"].includes(s)) return true;
        if (["false", "0", "non", "no", "aucun"].includes(s)) return false;
      }
    }
    return false;
  })();

  const infraHtml = puce(`<strong>${estRegularisation ? `Infrastructure ${esc(cfg.duNouveau)}` : "Infrastructure prévue pour la nouvelle création"}</strong>`) +
    tbl(
      `<tr>${th("Nombre de bâtiments")}${th("Salles de classe")}${th("Bureau")}${th("Latrines")}${th("Point d'eau")}${th("Terrain de sport (Oui ou Non)")}</tr>`,
      `<tr>${td(nbBatiments ?? "—", 'class="c"')}${td(nbSalles ?? "—", 'class="c"')}${td(nbBureaux ?? "—", 'class="c"')}${td(nbLatrines ?? "—", 'class="c"')}${td(nbPointsEau ?? "—", 'class="c"')}${td(valeurOuiNon(terrainSport), 'class="c"')}</tr>`,
      "infra"
    );

  const personnelDetail = getPersonnelDetailAnalyse(demande);
  let personnelTableHtml = vide;
  let modePersonnel = "aucun";
  let nbEnseignants = 0;
  let nbDiplomes = 0;
  let nbPayesEtat = 0;

  if (Array.isArray(personnelDetail) && personnelDetail.length > 0) {
    const premier = personnelDetail[0] || {};
    const estFicheEnseignant =
      "nom_enseignant" in premier || "nom_prenoms" in premier ||
      "date_entreeAdmin" in premier || "date_entree" in premier ||
      "diplome_academique" in premier || "diplome_pedagogique" in premier ||
      "profil" in premier || "fonction" in premier || "statut" in premier;

    if (estFicheEnseignant) {
      modePersonnel = "detail";
      nbEnseignants = personnelDetail.length;

      const lignes = personnelDetail.map((p, i) => {
        const nom = p?.nom_enseignant || p?.nom_prenoms || p?.nomPrenoms ||
          [p?.nom, p?.prenoms].filter(Boolean).join(" ") || "—";
        const dateEntree = p?.agent_etat_entree_administration || p?.date_entree_admin ||
          p?.date_entree || p?.date_entree_administration ||
          p?.date_entree_dans_administration || "—";
        const statut = p?.statut ?? p?.statut2 ?? "—";

        const matieres = [p?.matiere_enseignee_1, p?.matiere_enseignee_2, p?.matiere_enseignee_3]
          .filter((m) => m !== null && m !== undefined && String(m).trim() !== "");
        const matiere = matieres.length ? matieres.join(", ")
          : Array.isArray(p?.matieres) ? p.matieres.join(", ")
          : p?.matiere_enseignee ?? p?.matiere ?? p?.matieres ?? "—";

        if (estDiplomeSuperieur(p?.diplome_academique)) nbDiplomes++;
        if (estPayeParEtat(statut)) nbPayesEtat++;

        return `<tr>${td(`${i + 1}. ${String(nom).toUpperCase()}`)}${td(p?.fonction || p?.poste || "—", 'class="c"')}${td(statut, 'class="c"')}${td(dateEntree || "—", 'class="c"')}${td(p?.diplome_academique || "—", 'class="c"')}${td(p?.diplome_pedagogique || "—", 'class="c"')}${td(matiere, 'class="c"')}</tr>`;
      });

      personnelTableHtml = tbl(
        `<tr>${th("NOM ET PRÉNOMS")}${th("FONCTION")}${th("STATUT")}${th("DATE D'ENTRÉE DANS L'ADMINISTRATION")}${th("DIPLÔME ACADÉMIQUE")}${th("DIPLÔME PÉDAGOGIQUE")}${th("MATIÈRE ENSEIGNÉE")}</tr>`,
        lignes.join(""), "personnel dense", [23, 10, 14, 12, 13, 12, 16]
      );
    } else {
      modePersonnel = "agrege";
      const tri = [...personnelDetail].sort((a, b) =>
        String(a?.annee_scolaire ?? a?.annee ?? "").localeCompare(String(b?.annee_scolaire ?? b?.annee ?? ""))
      );
      const derniere = tri[tri.length - 1] || {};
      nbEnseignants = toNum(derniere?.nombre_enseignants ?? derniere?.nombre_enseignant);
      nbPayesEtat = toNum(derniere?.nombre_enseignant_fonctionnaire ?? derniere?.nombre_fonctionnaire) +
        toNum(derniere?.nombre_enseignant_subventionne ?? derniere?.nombre_subventionne);

      personnelTableHtml = tbl(
        `<tr>${th("ANNÉE SCOLAIRE")}${th("ENSEIGNANTS")}${th("FONCTIONNAIRES")}${th("NON SALARIÉS")}${th("SUBVENTIONNÉS")}</tr>`,
        tri.map((p) =>
          `<tr>${td(p?.annee_scolaire || p?.annee || "—", 'class="c"')}${td(p?.nombre_enseignants ?? p?.nombre_enseignant ?? "—", 'class="c"')}${td(p?.nombre_enseignant_fonctionnaire ?? p?.nombre_fonctionnaire ?? "—", 'class="c"')}${td(p?.nombre_enseignant_non_salarie ?? p?.nombre_non_salarie ?? "—", 'class="c"')}${td(p?.nombre_enseignant_subventionne ?? p?.nombre_subventionne ?? "—", 'class="c"')}</tr>`
        ).join(""), "personnel"
      );
    }
  }

  const personnelHtml = puce(`<strong>${estRegularisation ? "Renseignement du personnel" : "Enseignants pour la nouvelle création"}</strong>`) + personnelTableHtml;

  const plusProche = prochesTries.find((p) => toNumber(p?.distance_km ?? p?.distance) !== null);
  const c1 = plusProche
    ? `${esc(cfg.article)} ${esc(cfg.court)} <strong>${esc(String(plusProche?.nom || plusProche?.nom_etab || plusProche?.nom_etablissement || "—").toUpperCase())}</strong> le plus proche se situe à <strong>${esc(fmtDistanceFiche(plusProche?.distance_km ?? plusProche?.distance))}</strong> à vol d'oiseau.`
    : getDistancePlusProche(demande) !== null
    ? `L'établissement existant le plus proche se situe à <strong>${esc(fmtDistanceFiche(getDistancePlusProche(demande)))}</strong> à vol d'oiseau.`
    : `Aucun établissement existant de même niveau n'est recensé à proximité dans le dossier.`;

  const totauxValides = totauxAnnuelsAire.filter((n) => Number.isFinite(n));
  const minAire = totauxValides.length ? Math.min(...totauxValides) : null;
  const maxAire = totauxValides.length ? Math.max(...totauxValides) : null;
  const dernierTotalAire = totauxValides.length ? totauxValides[totauxValides.length - 1] : null;

  const sujetAire = estEcole ? "L'effectif des élèves susceptibles de fréquenter" : "La population scolarisable susceptible de fréquenter";
  const c2 = maxAire === null || maxAire === 0
    ? `Les données d'effectif de l'aire de recrutement ne sont pas disponibles dans le détail de la demande.`
    : minAire === maxAire
    ? `${sujetAire} ${esc(cfg.leNouveau)} <strong>${esc(nomEtab)}</strong> dans sa zone de recrutement est de <strong>${esc(maxAire)}</strong>.`
    : `${sujetAire} ${esc(cfg.leNouveau)} <strong>${esc(nomEtab)}</strong> dans sa zone de recrutement varie de <strong>${esc(minAire)}</strong> à <strong>${esc(maxAire)}</strong>.`;

  const seuil = SEUIL_EFFECTIF_MIN[niveauKey] ?? null;
  const comparerSeuil = (n) => {
    if (seuil === null) return "";
    if (n >= seuil) return `, soit conforme au seuil minimum requis par la carte scolaire (<strong>${esc(seuil)}</strong> élèves)`;
    if (n < seuil / 2) return `, soit <strong>très en dessous</strong> du seuil minimum requis par la carte scolaire (<strong>${esc(seuil)}</strong> élèves)`;
    return `, soit <strong>en dessous</strong> du seuil minimum requis par la carte scolaire (<strong>${esc(seuil)}</strong> élèves)`;
  };

  let c3;
  if (estRegularisation) {
    c3 = evolutionTriee.length > 0
      ? `Pour l'année scolaire <strong>${esc(anneeDerniereConnue)}</strong>, <strong>${esc(effectifDerniere)}</strong> élève(s) sont inscrits${comparerSeuil(effectifDerniere)}.`
      : `Aucun effectif d'élèves n'est renseigné pour les dernières années scolaires.`;
  } else {
    c3 = dernierTotalAire !== null && dernierTotalAire > 0
      ? `L'établissement n'ayant pas encore d'élèves inscrits, l'effectif potentiel retenu dans l'aire de recrutement est de <strong>${esc(dernierTotalAire)}</strong> élève(s)${comparerSeuil(dernierTotalAire)}.`
      : `L'établissement n'ayant pas encore d'élèves inscrits, aucun effectif potentiel n'est disponible pour l'aire de recrutement.`;
  }

  let c4;
  if (nbEnseignants === 0) {
    c4 = `Aucune information sur le personnel enseignant n'est renseignée dans la demande.`;
  } else {
    let diplomeTxt = "";
    if (modePersonnel === "detail") {
      if (nbDiplomes === 0) diplomeTxt = `, dont aucun n'est diplômé de licence ou plus`;
      else if (nbDiplomes / nbEnseignants >= 0.5) diplomeTxt = `, majoritairement diplômés de licence ou plus`;
      else diplomeTxt = `, dont <strong>${nbDiplomes}</strong> diplômé(s) de licence ou plus`;
    }
    const etatTxt = nbPayesEtat === 0
      ? `, mais <strong>aucun enseignant n'est payé par l'État</strong>`
      : `, et <strong>${nbPayesEtat}</strong> sont payé(s) par l'État`;
    c4 = `Le personnel enseignant ${estRegularisation ? "est" : "prévu est"} composé de <strong>${nbEnseignants}</strong> agent(s)` + diplomeTxt + etatTxt + `.`;
  }

  const surfaceNum = toNumber(surfaceTerrain);
  const normeSurface = SURFACE_NORME_M2[niveauKey] ?? 2000;
  let c5;
  if (surfaceNum === null || surfaceNum === 0) {
    c5 = `La surface du terrain disponible pour la construction des infrastructures scolaires n'est pas renseignée.`;
  } else if (surfaceNum >= normeSurface * 1.5) {
    c5 = `La surface du terrain disponible pour la construction des infrastructures scolaires est de <strong>${esc(fmtMilliers(surfaceNum))} m²</strong>, respectant <strong>largement</strong> la norme requise de ${esc(fmtMilliers(normeSurface))} m².`;
  } else if (surfaceNum >= normeSurface) {
    c5 = `La surface du terrain disponible pour la construction des infrastructures scolaires est de <strong>${esc(fmtMilliers(surfaceNum))} m²</strong>, respectant la norme requise de ${esc(fmtMilliers(normeSurface))} m².`;
  } else {
    c5 = `La surface du terrain disponible pour la construction des infrastructures scolaires est de <strong>${esc(fmtMilliers(surfaceNum))} m²</strong>, <strong>inférieure</strong> à la norme requise de ${esc(fmtMilliers(normeSurface))} m².`;
  }

  // ✅ Conclusion : mention de l'éligibilité
  const mentionEligibilite = (() => {
    if (zoneProposee && zoneProposee.aUnNom) {
      return `Le village initialement sélectionné${villageNonEligible?.nom ? ` (« ${esc(villageNonEligible.nom)} »)` : ""} n'est pas éligible à une nouvelle création. La zone éligible <strong>${esc(zoneProposee.nom)}</strong> a été retenue pour l'implantation de ${esc(cfg.leNouveau)}.`;
    }
    if (zoneProposee && !zoneProposee.aUnNom) {
      return `Le village initialement sélectionné${villageNonEligible?.nom ? ` (« ${esc(villageNonEligible.nom)} »)` : ""} n'est pas éligible à une nouvelle création. Une zone éligible <strong>sans nom</strong> a été proposée à proximité et affichée sur la carte à côté du village non éligible.`;
    }
    if (villageNonEligible?.nom) {
      return `Le village <strong>${esc(villageNonEligible.nom)}</strong> n'est pas éligible à une nouvelle création.`;
    }
    return "";
  })();

  const verdictHtml = analyseValidee === true
    ? `Au vu de ces éléments, le comité <strong>suggère l'ouverture</strong> ${esc(cfg.de)}${esc(cfg.long)} <strong>${esc(nomEtab)}</strong>, les conditions essentielles pour la création officielle de l'établissement étant respectées.`
    : `Au vu de ces éléments, le comité <strong>ne suggère pas l'ouverture</strong> ${esc(cfg.de)}${esc(cfg.long)} <strong>${esc(nomEtab)}</strong>, étant donné que les conditions essentielles pour la création officielle de l'établissement ne sont pas encore entièrement respectées.`;

  const verdictComplet = mentionEligibilite
    ? `${mentionEligibilite} ${verdictHtml}`
    : verdictHtml;

  // ─────────────────────────────────────────────────────────────
  // DESIGN : identique à la fiche de référence
  // ─────────────────────────────────────────────────────────────
  const css = `
    @page { size: A4; margin: 15mm; }
    body { font-family: "Times New Roman", Times, serif; font-size: 12pt; line-height: 1.5; color: #000000; background: #ffffff; }
    @media screen { body { max-width: 210mm; margin: 0 auto; padding: 15mm; background: #ffffff; } }
    p { margin: 2px 0; color: #000000; }
    .entete { text-align: center; margin-bottom: 4px; }
    .entete p { text-align: center; font-weight: bold; font-size: 12pt; margin: 0; color: #000000; line-height: 1.4; }
    .tirets { text-align: center; font-weight: bold; margin: 0 0 14px 0; }
    h2 { font-size: 12pt; font-weight: bold; color: #000000; margin: 12px 0 4px 0; padding: 0; border: 0; }
    h2 .num { margin-right: 2px; }
    h3 { font-size: 12pt; font-weight: bold; color: #000000; margin: 12px 0 4px 0; }
    h2, h3, p.puce-titre { page-break-after: avoid; }
    p.texte { text-align: justify; text-indent: 28pt; }
    p.tiret { margin: 2px 0 2px 24pt; text-indent: -14pt; text-align: justify; }
    p.puce-titre { margin: 10px 0 4px 18pt; text-indent: -12pt; }
    .bloc-loc { margin: 2px 0 2px 60pt; }
    p.loc { margin: 0; }
    .vide { font-style: italic; color: #000000; }
    p.source { font-style: italic; font-size: 10pt; color: #000000; margin: 3px 0 10px 0; }
    table { width: 100%; border-collapse: collapse; margin: 6px 0 4px 0; font-size: 10pt; border: 1px solid #000000; color: #000000; }
    th, td { border: 1px solid #000000; padding: 3px 5px; vertical-align: middle; text-align: left; word-wrap: break-word; background: #ffffff; color: #000000; }
    th { font-weight: bold; text-align: center; }
    th.l, td.l { text-align: left; }
    td.b { font-weight: bold; }
    td.c { text-align: center; }
    tr { page-break-inside: avoid; }
    tr.total td { font-weight: bold; background: #ffffff; }
    table.dense, table.personnel { table-layout: fixed; }
    table.dense { font-size: 8.5pt; }
    table.dense th, table.dense td { padding: 3px 3px; }
    table.personnel { font-size: 8pt; }
    table.personnel th, table.personnel td { padding: 3px 4px; }
    .carte { page-break-before: always; page-break-after: always; text-align: center; margin: 0; }
    .carte-image { width: 100%; max-width: 100%; height: auto; border: 1px solid #000000; }
    .carte-source { font-size: 9pt; color: #000000; margin-top: 4px; text-align: center; }
    .conclusion { margin-top: 4px; }
    .verdict { margin-top: 10px; text-align: justify; text-indent: 28pt; }
    .signatures { margin-top: 26px; page-break-inside: avoid; }
    .signatures p { font-weight: bold; margin: 0 0 54px 0; line-height: 1.3; color: #000000; }
    .signatures .g { text-align: left; width: 48%; }
    .signatures .d { text-align: right; margin-left: 52%; }
    .signatures .m { text-align: center; }
  `.replace(/\s+/g, " ");

  return `<!DOCTYPE html><html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8" /><title>Fiche technique ${esc(nomEtab)}</title><!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]--><style>${css}</style></head><body>
  <div class="entete" style="text-align:center;"><p style="font-weight:bold;font-size:12pt;margin:0;text-align:center;color:#000000;">FICHE TECHNIQUE</p><p style="font-weight:bold;font-size:12pt;margin:0;text-align:center;color:#000000;">AUTORISATION D'OUVERTURE OFFICIELLE ${esc(cfg.de.toUpperCase())}${esc(cfg.long.toUpperCase())}</p><p style="font-weight:bold;font-size:12pt;margin:0;text-align:center;color:#000000;">${esc(nomEtab.toUpperCase())}</p></div>
  <p class="tirets" style="text-align:center;font-weight:bold;margin:0 0 14px 0;color:#000000;">----------------</p>
  ${section("I", "Objet")}${objetHtml}
  ${section("II", "Contexte")}${contexteHtml}
  ${section("III", "Pièces jointes")}${piecesHtml}
  ${section("IV", "Localisation de l'établissement")}${localisationHtml}
  ${carteHtml}
  ${section("V", "Évaluation technique du dossier")}<p class="texte">${introEvaluation}</p>
  ${sousTitre("1", `Aire de recrutement (${cfg.aireNom} devant envoyer des élèves ${cfg.auNouveau})`)}${aireTableHtml}${aire.length ? source(`Fiche Primaire d'Enquête ${anneeEnquete}`) : ""}
  ${sousTitre("2", `${cfg.pluriel.charAt(0).toUpperCase() + cfg.pluriel.slice(1)} existants dans la CISCO de rattachement ainsi que les ${cfg.pluriel} environnants.`)}${prochesTableHtml}${prochesTries.length ? source(`FPE ${anneeEnqueteCourte}`) : ""}
  ${sousTitre("3", `Situation ${cfg.duNouveau}`)}${effectifsHtml}${infraHtml}${personnelHtml}
  <h2>CONCLUSION :</h2>
  <div class="conclusion">${tiret(c1)}${tiret(c2)}${tiret(c3)}${tiret(c4)}${tiret(c5)}<p class="verdict">${verdictComplet}</p></div>
  <div class="signatures"><p class="g">Avis de Madame Le Directeur de la Planification de l'Éducation</p><p class="d">Avis de Monsieur le Directeur de l'Enseignement Secondaire</p><p class="g">Avis de Madame le Directeur Général en charge des Établissements Scolaires</p><p class="d">Avis de Madame Le Secrétaire Général</p><p class="m">Décision du Ministre de l'Éducation Nationale</p></div>
  </body></html>`.trim();
};

export const telechargerFicheDOCX = (demande, htmlRiche) => {
  if (!demande || !htmlRiche) return;
  const nomFichier = `Fiche_Technique_${String(demande?.nom_etab || "etablissement").replace(/[^a-zA-Z0-9_-]/g, "_")}_${new Date().toISOString().slice(0, 10)}.doc`;
  const blob = new Blob(["\ufeff", htmlRiche], { type: "application/msword;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomFichier;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const imprimerFichePDF = (demande, htmlRiche) => {
  if (!demande || !htmlRiche) return;
  const win = window.open("", "_blank");
  if (!win) { alert("Merci d'autoriser les pop-ups."); return; }
  const html = htmlRiche.replace("</body>", `<script>window.onload = function() { setTimeout(function(){ window.print(); }, 700); };</script></body>`);
  win.document.open();
  win.document.write(html);
  win.document.close();
};

export const attendreTuilesChargees = (conteneur, timeoutMs = 8000) =>
  new Promise((resolve) => {
    const debut = Date.now();
    const check = () => {
      const tuiles = Array.from(conteneur.querySelectorAll(".leaflet-tile"));
      const pretes = tuiles.length > 0 && tuiles.every((t) => t.complete && t.naturalWidth > 0);
      if (pretes || Date.now() - debut > timeoutMs) resolve();
      else setTimeout(check, 150);
    };
    check();
  });

export const aplatirTransformsLeaflet = (docClone, racine) => {
  const vue = docClone.defaultView;
  racine.querySelectorAll("*").forEach((el) => {
    const transform = el.style?.transform;
    if (!transform || transform === "none") return;
    const m = transform.match(/translate(?:3d)?\(\s*(-?[\d.]+)px\s*,\s*(-?[\d.]+)px/);
    if (!m) return;
    const scale = transform.match(/scale\(\s*([\d.]+)/);
    if (scale && Math.abs(parseFloat(scale[1]) - 1) > 0.001) return;
    const cs = vue.getComputedStyle(el);
    if (cs.position === "static") return;
    const left = parseFloat(cs.left);
    const top = parseFloat(cs.top);
    el.style.left = `${(Number.isFinite(left) ? left : 0) + parseFloat(m[1])}px`;
    el.style.top = `${(Number.isFinite(top) ? top : 0) + parseFloat(m[2])}px`;
    el.style.transform = "none";
  });
};