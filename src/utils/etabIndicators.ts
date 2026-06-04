/**
 * Port TypeScript des calculs d'indicateurs d'établissement
 * depuis docs/python-reference/etab.py
 *
 * Tables source:
 *  - tdb_v_e1 : effectifs par niveau (T1=CP1, T2=CP2, T3=CE, T4=CM1, T5=CM2)
 *               colonnes par sexe G/F + variantes _REDOUBLANT, _PASSANT, _NOUVEAU, _TRANSFERT
 *  - v_sm_cepe : résultats CEPE (G, F, ADMIS_G, ADMIS_F, SM_*, SUP_10_*)
 */

type Row = Record<string, any> | null | undefined;
const num = (r: Row, k: string): number => {
  if (!r) return 0;
  const v = Number(r[k]);
  return isFinite(v) ? v : 0;
};
const safeRound = (v: number, dec = 1) => {
  if (!isFinite(v)) return 0;
  const f = Math.pow(10, dec);
  return Math.round(v * f) / f;
};
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
const mean = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);

export interface AbandonResult {
  txAbdcp1cp2: number; txAbdcp2ce: number; txAbdcecm1: number; txAbdcm1cm2: number;
  txAbdGlobal: number;
}

/** Taux d'abandon par transition de niveau (port de Etab.abandon) */
export function calcAbandon(e1_n_minus_1: Row, e1_n: Row): AbandonResult {
  if (!e1_n_minus_1 || !e1_n) {
    return { txAbdcp1cp2: -1, txAbdcp2ce: -1, txAbdcecm1: -1, txAbdcm1cm2: -1, txAbdGlobal: -1 };
  }
  const transitions: Array<[string, string, string]> = [
    ['T1', 'T2', 'txAbdcp1cp2'],
    ['T2', 'T3', 'txAbdcp2ce'],
    ['T3', 'T4', 'txAbdcecm1'],
    ['T4', 'T5', 'txAbdcm1cm2'],
  ];
  const out: any = {};
  let totalEff = 0, totalAbd = 0;
  for (const [from, to, key] of transitions) {
    const eff_g0 = num(e1_n_minus_1, `${from}_G`);
    const eff_f0 = num(e1_n_minus_1, `${from}_F`);
    const eff0 = eff_g0 + eff_f0;
    const abd_g = eff_g0 - (
      num(e1_n, `${from}_G_REDOUBLANT`)
      + num(e1_n, `${to}_G_PASSANT`)
      - num(e1_n, `${to}_G_NOUVEAU`)
      - num(e1_n, `${to}_G_TRANSFERT`)
    );
    const abd_f = eff_f0 - (
      num(e1_n, `${from}_F_REDOUBLANT`)
      + num(e1_n, `${to}_F_PASSANT`)
      - num(e1_n, `${to}_F_NOUVEAU`)
      - num(e1_n, `${to}_F_TRANSFERT`)
    );
    const abd = abd_g + abd_f;
    out[key] = eff0 > 0 ? safeRound((abd * 100) / eff0, 1) : -1;
    totalEff += eff0;
    totalAbd += abd;
  }
  out.txAbdGlobal = totalEff > 0 ? safeRound((totalAbd * 100) / totalEff, 1) : -1;
  return out as AbandonResult;
}

export interface RetentionResult {
  txRetentionGarcons: number;
  txRetentionFilles: number;
  txRetentionTotal: number;
  profilRetGarcons: number[];   // [100, %CP2, %CE, %CM1, %CM2]
  profilRetFilles: number[];
  profilRetEnsemble: number[];
}

/** Taux de rétention (port de Etab.retention) */
export function calcRetention(e1_n_minus_1: Row, e1_n: Row): RetentionResult {
  const empty: RetentionResult = {
    txRetentionGarcons: 0, txRetentionFilles: 0, txRetentionTotal: 0,
    profilRetGarcons: [100, 0, 0, 0, 0],
    profilRetFilles: [100, 0, 0, 0, 0],
    profilRetEnsemble: [100, 0, 0, 0, 0],
  };
  if (!e1_n_minus_1 || !e1_n) return empty;

  // Limites par sexe et index (i = 0..3 → CP2..CM2)
  const limites: Record<string, number> = {
    'G_2': 90, 'F_1': 98, 'F_2': 95, 'G_3': 80, 'F_3': 80,
  };

  const survie = (sexe: 'G' | 'F', from: string, to: string): number => {
    const denom = num(e1_n_minus_1, `${from}_${sexe}_PASSANT`);
    if (denom <= 0) return 1; // = 100% par défaut
    const numer = num(e1_n, `${to}_${sexe}`)
      - num(e1_n, `${to}_${sexe}_REDOUBLANT`)
      - num(e1_n, `${to}_${sexe}_NOUVEAU`)
      - num(e1_n, `${to}_${sexe}_TRANSFERT`);
    return numer / denom;
  };

  const transitions: Array<[string, string]> = [
    ['T1', 'T2'], ['T2', 'T3'], ['T3', 'T4'], ['T4', 'T5'],
  ];

  const sg = transitions.map(([f, t]) => survie('G', f, t));
  const sf = transitions.map(([f, t]) => survie('F', f, t));
  const se = sg.map((v, i) => (v + sf[i]) / 2);

  const buildProfil = (taux: number[], sexe?: 'G' | 'F') => {
    const profil = [100];
    taux.forEach((t, i) => {
      const lim = sexe ? (limites[`${sexe}_${i}`] ?? 100) : 100;
      profil.push(clamp(safeRound(t * 100, 1), 0, lim));
    });
    const prod = taux.reduce((a, b) => a * b, 1);
    return { profil, retention: clamp(safeRound(prod * 100, 1), 0, 100) };
  };

  const g = buildProfil(sg, 'G');
  const f = buildProfil(sf, 'F');
  const e = buildProfil(se);

  return {
    txRetentionGarcons: g.retention,
    txRetentionFilles: f.retention,
    txRetentionTotal: e.retention,
    profilRetGarcons: g.profil,
    profilRetFilles: f.profil,
    profilRetEnsemble: e.profil,
  };
}

export interface RedoublementResult {
  red_garcons: number;
  red_fille: number;
  red_ensemble: number;
  parNiveau: Record<string, { g: number; f: number; ens: number }>;
}

/** Pourcentage de redoublants (port de Etab.pourcentage_redoublant) */
export function calcRedoublement(e1_n: Row): RedoublementResult {
  const noms = ['CP1', 'CP2', 'CE', 'CM1', 'CM2'];
  const codes = ['T1', 'T2', 'T3', 'T4', 'T5'];
  const parNiveau: Record<string, { g: number; f: number; ens: number }> = {};
  if (!e1_n) {
    noms.forEach(n => parNiveau[n] = { g: 0, f: 0, ens: 0 });
    return { red_garcons: 0, red_fille: 0, red_ensemble: 0, parNiveau };
  }
  const gs: number[] = [], fs: number[] = [], es: number[] = [];
  codes.forEach((c, i) => {
    const eff_g = num(e1_n, `${c}_G`);
    const eff_f = num(e1_n, `${c}_F`);
    const red_g = num(e1_n, `${c}_G_REDOUBLANT`);
    const red_f = num(e1_n, `${c}_F_REDOUBLANT`);
    const ptg_g = eff_g > 0 ? clamp(safeRound((100 * red_g) / eff_g, 1), 0, 100) : 0;
    const ptg_f = eff_f > 0 ? clamp(safeRound((100 * red_f) / eff_f, 1), 0, 100) : 0;
    const eff_e = eff_g + eff_f;
    const red_e = red_g + red_f;
    const ptg_e = eff_e > 0 ? clamp(safeRound((100 * red_e) / eff_e, 1), 0, 100) : 0;
    parNiveau[noms[i]] = { g: ptg_g, f: ptg_f, ens: ptg_e };
    gs.push(ptg_g); fs.push(ptg_f); es.push(ptg_e);
  });
  return {
    red_garcons: clamp(safeRound(mean(gs), 1), 0, 100),
    red_fille: clamp(safeRound(mean(fs), 1), 0, 100),
    red_ensemble: clamp(safeRound(mean(es), 1), 0, 100),
    parNiveau,
  };
}

export interface CepeResult {
  tx_admis_g: number; tx_admis_f: number; tx_admis: number;
  sm_maths: number; sup_10_maths: number;
  sm_tfm: number; sup_10_tfm: number;
  sm_mlg: number; sup_10_mlg: number;
  sm_fr: number;  sup_10_fr: number;
  sm_geo: number; sup_10_geo: number;
  sm_svt: number; sup_10_svt: number;
}

/** Indicateurs CEPE (port de Etab.cepe) */
export function calcCepe(v_sm_cepe: Row): CepeResult {
  const empty: CepeResult = {
    tx_admis_g: 0, tx_admis_f: 0, tx_admis: 0,
    sm_maths: 0, sup_10_maths: 0,
    sm_tfm: 0, sup_10_tfm: 0,
    sm_mlg: 0, sup_10_mlg: 0,
    sm_fr: 0, sup_10_fr: 0,
    sm_geo: 0, sup_10_geo: 0,
    sm_svt: 0, sup_10_svt: 0,
  };
  if (!v_sm_cepe) return empty;

  const nbr_g = num(v_sm_cepe, 'G');
  const nbr_f = num(v_sm_cepe, 'F');
  const admis_g = num(v_sm_cepe, 'ADMIS_G');
  const admis_f = num(v_sm_cepe, 'ADMIS_F');
  const tx_admis_g = nbr_g > 0 ? safeRound((admis_g * 100) / nbr_g, 1) : 0;
  const tx_admis_f = nbr_f > 0 ? safeRound((admis_f * 100) / nbr_f, 1) : 0;
  const nbr_tt = nbr_g + nbr_f;
  const admis_tt = admis_g + admis_f;
  const tx_admis = nbr_tt > 0 ? safeRound((admis_tt * 100) / nbr_tt, 1) : 0;

  const sm_op = safeRound(num(v_sm_cepe, 'SM_OP'), 1);
  const sm_probleme = safeRound(num(v_sm_cepe, 'SM_PROBLEME'), 1);
  const sup_10_op = num(v_sm_cepe, 'SUP_10_OP');
  const sup_10_probleme = num(v_sm_cepe, 'SUP_10_PROBLEME');

  return {
    tx_admis_g, tx_admis_f, tx_admis,
    sm_maths: safeRound((sm_op + sm_probleme) / 2, 1),
    sup_10_maths: sup_10_op + sup_10_probleme,
    sm_tfm: safeRound(num(v_sm_cepe, 'SM_TFM'), 1),
    sup_10_tfm: num(v_sm_cepe, 'SUP_10_TFM'),
    sm_mlg: safeRound(num(v_sm_cepe, 'SM_MALAGASY'), 1),
    sup_10_mlg: num(v_sm_cepe, 'SUP_10_MALAGASY'),
    sm_fr: safeRound(num(v_sm_cepe, 'SM_FRANCAIS'), 1),
    sup_10_fr: num(v_sm_cepe, 'SUP_10_FRANCAIS'),
    sm_geo: safeRound(num(v_sm_cepe, 'SM_GEOGRAPHIE'), 1),
    sup_10_geo: num(v_sm_cepe, 'SUP_10_GEOGRAPHIE'),
    sm_svt: safeRound(num(v_sm_cepe, 'SM_SVT'), 1),
    sup_10_svt: num(v_sm_cepe, 'SUP_10_SVT'),
  };
}

/** Interprétation taux d'abandon vs ZAP (port de interpretation_abandon) */
export function interpretationAbandon(ecole: number, zap: number) {
  let niveau: string;
  if (ecole < 5) niveau = "Très faible taux d'abandon : excellente rétention des élèves.";
  else if (ecole < 10) niveau = "Faible taux d'abandon : la majorité des élèves restent scolarisés.";
  else if (ecole < 20) niveau = "Taux d'abandon préoccupant : plusieurs élèves quittent encore l'école.";
  else niveau = "Taux d'abandon élevé : une grande partie des élèves sort prématurément du système.";

  let comparaison: string, suggestion: string;
  if (ecole < zap * 0.9) {
    comparaison = "L'école fait nettement mieux que la moyenne de la commune (ZAP).";
    suggestion = "Poursuivre et consolider les pratiques positives (suivi parental, cantine, sensibilisation).";
  } else if (ecole <= zap * 1.1) {
    comparaison = "L'école est globalement au même niveau que la commune.";
    suggestion = "Renforcer les actions locales conjointes avec la ZAP pour améliorer encore la rétention.";
  } else {
    comparaison = "L'école est en moins bonne situation que la commune.";
    suggestion = "Identifier les causes spécifiques (absentéisme, pauvreté, éloignement) et mettre en place un suivi ciblé.";
  }
  return { niveau, comparaison, suggestion };
}

/** Diagnostic d'efficience à 9 quadrants (port de tdb_pdf.diagnostic_efficience) */
export function diagnosticEfficience(scoreX: number, scoreY: number): { label: string; color: string } {
  // X = ressources, Y = résultats. Seuils 33 et 66.
  const lvlX = scoreX < 33 ? 0 : scoreX < 66 ? 1 : 2;
  const lvlY = scoreY < 33 ? 0 : scoreY < 66 ? 1 : 2;
  const matrix: Array<Array<{ label: string; color: string }>> = [
    [
      { label: 'Faibles ressources & faibles résultats', color: '#d32f2f' },
      { label: 'Faibles ressources & résultats moyens', color: '#f57c00' },
      { label: 'Faibles ressources mais bons résultats', color: '#388e3c' },
    ],
    [
      { label: 'Ressources moyennes & faibles résultats', color: '#f57c00' },
      { label: 'Profil équilibré moyen', color: '#fbc02d' },
      { label: 'Ressources moyennes & bons résultats', color: '#388e3c' },
    ],
    [
      { label: 'Bonnes ressources mais faibles résultats', color: '#d32f2f' },
      { label: 'Bonnes ressources & résultats moyens', color: '#f57c00' },
      { label: 'Bonnes ressources & bons résultats', color: '#1b5e20' },
    ],
  ];
  return matrix[lvlX][lvlY];
}

/** Calcul complet pour un établissement à partir des tables brutes */
export function calculateAllIndicators(df_n_minus_1: Record<string, any>, df_n: Record<string, any>) {
  const e1_0 = df_n_minus_1?.tdb_v_e1 ?? null;
  const e1_1 = df_n?.tdb_v_e1 ?? null;
  const cepe_src = df_n_minus_1?.v_sm_cepe ?? null;
  return {
    abandon: calcAbandon(e1_0, e1_1),
    retention: calcRetention(e1_0, e1_1),
    redoublement: calcRedoublement(e1_1),
    cepe: calcCepe(cepe_src),
  };
}
