// Répartition Public / Privé / Total des données d'établissements.
// Isolée de la page pour que les cumuls des cartes (personnels, fonctionnaires,
// ENF, subventionnés, non subventionnés) soient testables sans rendre l'UI.

export type Niveau = "prescolaire" | "primaire" | "college" | "lycee";

export type SectorGroup = {
  key: "public" | "prive" | "total";
  label: string;
  etabs: number;
  eleves: number;
  pers: number;
  fonct: number;
  enf: number;
  sub: number;
  nonSub: number;
};

const ELEVES_KEYS: Record<Niveau, string[]> = {
  prescolaire: ["eff_ps", "eff_ms", "eff_gs"],
  primaire: ["eff_t1", "eff_t2", "eff_t3", "eff_t4", "eff_t5"],
  college: ["eff_t6", "eff_t7", "eff_t8", "eff_t9"],
  lycee: ["_2nde", "_1re", "tle"],
};

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const sumBy = (rows: any[], key: string): number => rows.reduce((acc, r) => acc + num(r?.[key]), 0);

export const getTotalEleves = (data: any[], niveau: Niveau): number => {
  const keys = ELEVES_KEYS[niveau] || [];
  return data.reduce(
    (acc, row) => acc + keys.reduce((a, k) => a + num(row?.[k]), 0),
    0,
  );
};

export const buildSectorGroups = (data: any[], niveau: Niveau): SectorGroup[] => {
  const calc = (rows: any[]) => {
    const pers = sumBy(rows, "pers_total");
    const fonct = sumBy(rows, "fonctionnaire");
    return {
      etabs: rows.length,
      eleves: getTotalEleves(rows, niveau),
      pers,
      fonct,
      enf: Math.max(0, pers - fonct),
      sub: sumBy(rows, "fram_sub"),
      nonSub: sumBy(rows, "fram_nonsub"),
    };
  };

  const pub = data.filter((e) => String(e?.SECTEUR) === "0");
  const priv = data.filter((e) => String(e?.SECTEUR) === "1");
  const privCalc = calc(priv);

  return [
    { key: "public", label: "Public", ...calc(pub) },
    // Le privé ne compte pas de fonctionnaires : tout son personnel est ENF.
    { key: "prive", label: "Privé", ...privCalc, fonct: 0, enf: privCalc.pers },
    { key: "total", label: "Total", ...calc(data) },
  ];
};
