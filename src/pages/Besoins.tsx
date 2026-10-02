import { useEffect, useMemo, useState, useCallback } from "react";
import { Link, useParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Loader2,
  Filter,
  Building2,
  CheckCircle2,
  Lock,
  AlertTriangle,
  TrendingUp,
  Layers,
  GraduationCap,
  School,
  BookOpen,
  RefreshCw,
  Database,
  Info,
  Users,
  Armchair,
  Library,
  Download,
  FileSpreadsheet,
  FileText,
  Calculator,
  Search,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { besoinsApi, donneesApi, type Dren, type Cisco, type Zap } from "@/services/api";
import { notify } from "@/contexts/NotificationsContext";
import { toast } from "sonner";
import DataTable from "@/components/donnees/DataTable";
// Normes officielles centralisées (horaires, utilisation SDC), colocalisées
// avec ce module dans components/besoins/, comme les autres modules.
import {
  HORAIRE_HEBDO_ENSEIGNANT,
  HORAIRE_COLLEGE,
  UTILISATION_SDC_HEBDO,
  HORAIRE_ELEVE_COLLEGE_SANS_EPS,
  MATIERES_LYCEE as MATIERES_LYCEE_NORMES,
  HORAIRE_LYCEE_MOYENNE_PAR_CYCLE,
  type MatiereCode,
} from "@/components/besoins/normesHoraires";
import { useAuth } from "@/contexts/AuthContext";
import DataActionsBar from "@/components/admin/DataActionsBar";
import { cn } from "@/lib/utils";
import { getZoneInfo, isRuralZone } from "@/lib/zone";
import logoMen from "@/assets/logoMen.jpg";
import logoDpe from "@/assets/logoDpe.jpg";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import * as XLSX from "xlsx";

type Niveau = "prescolaire" | "primaire" | "college" | "lycee";
type Categorie = "salles" | "enseignants" | "tb" | "manuels";
type ExportFormat = "csv" | "xlsx";

const NIVEAU_META: Record<
  Niveau,
  {
    label: string;
    icon: any;
    badgeBg: string;
    badgeText: string;
    activeBg: string;
    activeText: string;
    ring: string;
  }
> = {
  prescolaire: {
    label: "Préscolaire",
    icon: BookOpen,
    badgeBg: "bg-amber-600",
    badgeText: "text-white",
    activeBg: "bg-amber-600",
    activeText: "text-white",
    ring: "ring-amber-500/30",
  },
  primaire: {
    label: "Primaire",
    icon: BookOpen,
    badgeBg: "bg-emerald-600",
    badgeText: "text-white",
    activeBg: "bg-emerald-600",
    activeText: "text-white",
    ring: "ring-emerald-500/30",
  },
  college: {
    label: "Collège",
    icon: School,
    badgeBg: "bg-blue-600",
    badgeText: "text-white",
    activeBg: "bg-blue-600",
    activeText: "text-white",
    ring: "ring-blue-500/30",
  },
  lycee: {
    label: "Lycée",
    icon: GraduationCap,
    badgeBg: "bg-violet-600",
    badgeText: "text-white",
    activeBg: "bg-violet-600",
    activeText: "text-white",
    ring: "ring-violet-500/30",
  },
};

const secteurLabel: Record<string, string> = {
  "2": "Tous",
  "0": "Public",
  "1": "Privé",
};
const getSecteurLabel = (value: string) => secteurLabel[value] ?? "Tous";

const isRural = (row: Record<string, unknown> | null | undefined): boolean => isRuralZone(row);

const pickNumRaw = (row: any, keys: string[]): number | null => {
  if (!row) return null;
  for (const k of keys) {
    const v = row[k] ?? row[k.toLowerCase()] ?? row[k.toUpperCase()];
    if (v != null && v !== "") {
      const n = Number(v);
      if (Number.isFinite(n)) return n;
    }
  }
  return null;
};

const NORME_ELEVE_PRESCO = 25; // norme élève par salle de classe — préscolaire
const NORME_ELEVE_PRIMAIRE = 50; // norme élève par salle de classe — primaire

/**
 * Test générique à deux niveaux combinables (Test n°1 : T1-T2 ; Test n°4 :
 * T4-T5) du document « MODALITES DE CALCUL DES BESOINS EN ENSEIGNANTS
 * PRESCOLAIRES ET PRIMAIRES » :
 * - Classes complètes de 50 élèves comptées séparément pour chaque niveau.
 * - Un reste <= 10 élèves est absorbé dans les classes déjà comptées (pas
 *   de classe supplémentaire).
 * - Si la somme des restes non absorbés (> 10) passe le seuil, une seule
 *   classe multigrade est ouverte ; sinon, deux classes distinctes.
 * `inclusiveThreshold` : Test n°1 utilise "somme < 50" (strict), Test n°4
 * utilise "somme <= 50" (inclusif) — distinction du document source.
 */
const computePairTest = (a: number, b: number, inclusiveThreshold: boolean): number => {
  const Ga = Math.floor(a / 50);
  const Ra = a % 50;
  const Gb = Math.floor(b / 50);
  const Rb = b % 50;

  const activeRa = Ra > 10 ? Ra : 0;
  const activeRb = Rb > 10 ? Rb : 0;
  const sumR = activeRa + activeRb;

  let extra = 0;
  if (sumR > 0) {
    const fitsMultigrade = inclusiveThreshold ? sumR <= 50 : sumR < 50;
    extra = fitsMultigrade ? 1 : 2;
  }

  return Ga + Gb + extra;
};

/**
 * Test n°2 (T3) : T3 reste toujours seul (jamais combiné en multigrade) ;
 * un reste <= 10 est absorbé, sinon il ouvre une classe supplémentaire.
 */
const computeSoloTest = (t: number): number => {
  const G = Math.floor(t / 50);
  const R = t % 50;
  return R > 10 ? G + 1 : G;
};

/**
 * Groupe pédagogique primaire = résultat des 4 tests du document source :
 * Test n°3 (exception T1+T2+T3 <= 50 → 1 seule classe) prime sur les
 * Tests n°1 et n°2 combinés ; le Test n°4 (T4-T5) s'ajoute toujours.
 */
const getGroupePeda = (row: any): number => {
  const t1 = pickNumRaw(row, ["EFF_T1", "eff_t1"]) || 0;
  const t2 = pickNumRaw(row, ["EFF_T2", "eff_t2"]) || 0;
  const t3 = pickNumRaw(row, ["EFF_T3", "eff_t3"]) || 0;
  const t4 = pickNumRaw(row, ["EFF_T4", "eff_t4"]) || 0;
  const t5 = pickNumRaw(row, ["EFF_T5", "eff_t5"]) || 0;

  const sum123 = t1 + t2 + t3;
  const gpT1T2T3 =
    sum123 > 0 && sum123 <= 50
      ? 1 // Test n°3 : exception, une seule classe multigrade
      : computePairTest(t1, t2, false) + computeSoloTest(t3); // Tests n°1 + n°2

  const gpT4T5 = computePairTest(t4, t5, true); // Test n°4

  return gpT1T2T3 + gpT4T5;
};

/**
 * Groupe pédagogique préscolaire = effectif / 25 (une classe pédagogique
 * correspond à un enseignant).
 */
const getGroupePedaPresco = (row: any): number => {
  const eff = getEffectifs(row);
  return Math.ceil((eff || 0) / NORME_ELEVE_PRESCO);
};

/* ───────── Scénario de vérification / traçabilité du calcul ───────── */

type EtapeVerification = {
  titre: string;
  valeurs: { label: string; valeur: string }[];
  condition?: string;
  resultat: string;
  avertissement?: string;
};

type ExplicationGroupePeda = {
  t1: number;
  t2: number;
  t3: number;
  t4: number;
  t5: number;
  etapes: EtapeVerification[];
  gpT1T2T3: number;
  gpT4T5: number;
  gpT: number;
};

/**
 * Version « traçable » de computePairTest : renvoie le résultat ET le détail
 * (valeurs, condition évaluée, éventuel avertissement) de l'étape.
 */
const explainPairTest = (
  a: number,
  b: number,
  labelA: string,
  labelB: string,
  inclusiveThreshold: boolean,
): { etape: EtapeVerification; resultat: number } => {
  const Ga = Math.floor(a / 50);
  const Ra = a % 50;
  const Gb = Math.floor(b / 50);
  const Rb = b % 50;
  const activeRa = Ra > 10 ? Ra : 0;
  const activeRb = Rb > 10 ? Rb : 0;
  const sumR = activeRa + activeRb;

  let extra = 0;
  let condition: string;

  if (sumR === 0) {
    condition = `Restes ${labelA}=${Ra} et ${labelB}=${Rb} : tous deux ≤ 10 → absorbés, aucune classe supplémentaire.`;
  } else {
    const seuilTxt = inclusiveThreshold ? "≤ 50" : "< 50";
    const fitsMultigrade = inclusiveThreshold ? sumR <= 50 : sumR < 50;
    extra = fitsMultigrade ? 1 : 2;
    condition = `Somme des restes actifs (> 10) = ${sumR} — seuil de fusion ${labelA}-${labelB} : ${seuilTxt} → ${
      fitsMultigrade ? "1 classe multigrade supplémentaire" : "2 classes distinctes supplémentaires"
    }.`;
  }

  const resultat = Ga + Gb + extra;

  const etape: EtapeVerification = {
    titre: `Test ${labelA}-${labelB}`,
    valeurs: [
      { label: labelA, valeur: `${a} élève(s) → ${Ga} classe(s) pleine(s) de 50, reste ${Ra}` },
      { label: labelB, valeur: `${b} élève(s) → ${Gb} classe(s) pleine(s) de 50, reste ${Rb}` },
    ],
    condition,
    resultat: `${labelA}-${labelB} = ${Ga} + ${Gb} + ${extra} = ${resultat} classe(s)`,
  };

  if (resultat === 0 && a + b > 0) {
    etape.avertissement = `${a + b} élève(s) au total (${labelA}=${a}, ${labelB}=${b}) mais aucune classe pleine et restes ≤ 10 des deux côtés : le calcul officiel n'ouvre aucune classe ici — à vérifier manuellement sur le terrain.`;
  }

  return { etape, resultat };
};

/**
 * Version « traçable » de computeSoloTest (T3 seul).
 */
const explainSoloTest = (
  t: number,
  label: string,
): { etape: EtapeVerification; resultat: number } => {
  const G = Math.floor(t / 50);
  const R = t % 50;
  const extra = R > 10 ? 1 : 0;
  const resultat = G + extra;

  return {
    resultat,
    etape: {
      titre: `Test ${label} (seul)`,
      valeurs: [{ label, valeur: `${t} élève(s) → ${G} classe(s) pleine(s) de 50, reste ${R}` }],
      condition:
        R > 10
          ? `Reste ${R} > 10 → +1 classe supplémentaire.`
          : `Reste ${R} ≤ 10 → absorbé, aucune classe supplémentaire.`,
      resultat: `${label} = ${G} + ${extra} = ${resultat} classe(s)`,
    },
  };
};

/**
 * Reproduit le calcul de getGroupePeda mais en conservant, à chaque étape,
 * les valeurs et conditions évaluées — pour affichage dans un panneau de
 * vérification destiné à l'utilisateur (arguments clairs et vérifiables).
 */
const explainGroupePeda = (row: any): ExplicationGroupePeda => {
  const t1 = pickNumRaw(row, ["EFF_T1", "eff_t1"]) || 0;
  const t2 = pickNumRaw(row, ["EFF_T2", "eff_t2"]) || 0;
  const t3 = pickNumRaw(row, ["EFF_T3", "eff_t3"]) || 0;
  const t4 = pickNumRaw(row, ["EFF_T4", "eff_t4"]) || 0;
  const t5 = pickNumRaw(row, ["EFF_T5", "eff_t5"]) || 0;

  const etapes: EtapeVerification[] = [];
  const sum123 = t1 + t2 + t3;
  let gpT1T2T3: number;

  if (sum123 > 0 && sum123 <= 50) {
    gpT1T2T3 = 1;
    etapes.push({
      titre: "Exception T1+T2+T3",
      valeurs: [
        { label: "T1", valeur: `${t1} élève(s)` },
        { label: "T2", valeur: `${t2} élève(s)` },
        { label: "T3", valeur: `${t3} élève(s)` },
      ],
      condition: `T1+T2+T3 = ${sum123} ≤ 50 → exception prioritaire, s'applique avant tout autre calcul.`,
      resultat: "GPT1T2T3 = 1 (une seule classe multigrade regroupant T1, T2 et T3).",
    });
  } else {
    const { etape: etapeT1T2, resultat: gpT1T2 } = explainPairTest(t1, t2, "T1", "T2", false);
    const { etape: etapeT3, resultat: gpT3 } = explainSoloTest(t3, "T3");
    gpT1T2T3 = gpT1T2 + gpT3;
    etapes.push(etapeT1T2, etapeT3, {
      titre: "Cumul T1-T2-T3",
      valeurs: [],
      resultat: `GPT1T2T3 = ${gpT1T2} (T1-T2) + ${gpT3} (T3) = ${gpT1T2T3} classe(s)`,
    });
  }

  const { etape: etapeT4T5, resultat: gpT4T5 } = explainPairTest(t4, t5, "T4", "T5", true);
  etapes.push(etapeT4T5);

  const gpT = gpT1T2T3 + gpT4T5;
  etapes.push({
    titre: "Résultat final",
    valeurs: [],
    resultat: `GpT = ${gpT1T2T3} (T1-T2-T3) + ${gpT4T5} (T4-T5) = ${gpT} classe(s) pédagogique(s)`,
  });

  return { t1, t2, t3, t4, t5, etapes, gpT1T2T3, gpT4T5, gpT };
};

/**
 * Rendu partagé de la trace de vérification — utilisé à la fois par le
 * Dialog déclenché depuis une ligne du tableau (icône ⓘ) et par le panneau
 * de vérification manuelle (« Vérifier un calcul »).
 */
const GroupePedaTraceContent = ({ exp }: { exp: ExplicationGroupePeda }) => (
  <div className="flex-1 overflow-y-auto space-y-4 px-1">
    <div className="grid grid-cols-5 gap-2 text-center">
      {[
        ["T1", exp.t1],
        ["T2", exp.t2],
        ["T3", exp.t3],
        ["T4", exp.t4],
        ["T5", exp.t5],
      ].map(([label, val]) => (
        <div key={label as string} className="rounded-lg border p-2">
          <div className="text-[11px] uppercase text-muted-foreground font-semibold">{label}</div>
          <div className="text-lg font-bold tabular-nums">{formatNumber(Number(val))}</div>
        </div>
      ))}
    </div>

    <div className="space-y-3">
      {exp.etapes.map((etape, i) => (
        <div key={i} className="rounded-xl border p-3 space-y-1.5">
          <div className="font-semibold text-sm">{etape.titre}</div>
          {etape.valeurs.length > 0 && (
            <ul className="text-sm text-muted-foreground space-y-0.5 list-disc list-inside">
              {etape.valeurs.map((v, j) => (
                <li key={j}>
                  <span className="font-medium text-foreground">{v.label} :</span> {v.valeur}
                </li>
              ))}
            </ul>
          )}
          {etape.condition && (
            <div className="text-xs text-muted-foreground italic">{etape.condition}</div>
          )}
          <div className="text-sm font-medium">{etape.resultat}</div>
          {etape.avertissement && (
            <div className="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 rounded-md p-2 mt-1">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>{etape.avertissement}</span>
            </div>
          )}
        </div>
      ))}
    </div>

    <div className="rounded-xl border-2 border-primary/30 bg-primary/5 p-4 text-center">
      <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-1">
        Groupe pédagogique total (GpT)
      </div>
      <div className="text-3xl font-bold text-primary tabular-nums">{formatNumber(exp.gpT)}</div>
      <div className="text-xs text-muted-foreground mt-1">
        = {formatNumber(exp.gpT)} enseignant(s) requis (1 par classe)
      </div>
    </div>
  </div>
);

/* ─────────────────────────────────────────────────────────────────── */

/**
 * Requis en salles de classe à partir du groupe pédagogique :
 * zone rurale = 1 salle par groupe ; zone urbaine = double vacation
 * possible, donc 1 salle pour 2 groupes.
 */
const computeRequisSdcFromGroupe = (groupePeda: number, rural: boolean): number => {
  if (groupePeda <= 0) return 0;
  return rural ? groupePeda : Math.ceil(groupePeda / 2);
};

const computeSectionsGrade = (effGrade: number): number => {
  const eff = Math.max(0, Math.floor(Number(effGrade) || 0));
  if (eff === 0) return 0;
  if (eff < 50) return 1;

  const quotient = Math.floor(eff / 50);
  const reste = eff % 50;
  // reste < 20 → absorbé ; reste >= 20 → section supplémentaire
  return reste < 20 ? quotient : quotient + 1;
};

/**
 * Sections requises pour un niveau donné (collège ou lycée) : somme des
 * sections de chaque grade/filière, chacun calculé séparément via
 * computeSectionsGrade (pas de combinaison multigrade entre grades).
 */
const pickEffCollege = (row: any) => ({
  eff6e: pickNumRaw(row, ["EFF_6E", "eff_6e", "EFF_6eme", "EFF_T6", "eff_t6"]) || 0,
  eff5e: pickNumRaw(row, ["EFF_5E", "eff_5e", "EFF_5eme", "EFF_T7", "eff_t7"]) || 0,
  eff4e: pickNumRaw(row, ["EFF_4E", "eff_4e", "EFF_4eme", "EFF_T8", "eff_t8"]) || 0,
  eff3e: pickNumRaw(row, ["EFF_3E", "eff_3e", "EFF_3eme", "EFF_T9", "eff_t9"]) || 0,
});

const pickEffLycee = (row: any) => {
  const eff2nde = pickNumRaw(row, ["EFF_2NDE", "eff_2nde", "EFF_2nde", "_2nde"]) || 0;
  const eff1l = pickNumRaw(row, ["EFF_1L", "eff_1l", "_1l"]) || 0;
  const eff1s = pickNumRaw(row, ["EFF_1S", "eff_1s", "_1s"]) || 0;
  const eff1ose = pickNumRaw(row, ["EFF_1OSE", "eff_1ose", "_1ose"]) || 0;
  const effTl = pickNumRaw(row, ["EFF_TL", "eff_tl", "tl"]) || 0;
  const effTs = pickNumRaw(row, ["EFF_TS", "eff_ts", "ts"]) || 0;
  const effTose = pickNumRaw(row, ["EFF_TOSE", "eff_tose", "tose"]) || 0;

  const eff1reFromApi = pickNumRaw(row, ["EFF_1RE", "eff_1re", "EFF_1ere"]);
  const effTleFromApi = pickNumRaw(row, ["EFF_TLE", "eff_tle", "EFF_Terminale"]);
  const eff1re = eff1reFromApi != null ? eff1reFromApi : eff1l + eff1s + eff1ose;
  const effTle = effTleFromApi != null ? effTleFromApi : effTl + effTs + effTose;

  return {
    eff2nde,
    eff1l,
    eff1s,
    eff1ose,
    effTl,
    effTs,
    effTose,
    eff1re,
    effTle,
  };
};

/**
 * Sections collège = somme 6e+5e+4e+3e.
 * Sections lycée = somme par filière (2nde, 1L, 1S, 1OSE, TL, TS, TOSE)
 * si le détail est présent, sinon repli sur 2nde / 1re / Tle agrégés.
 */
const computeSectionsRequises = (row: any, niveau: "college" | "lycee"): number => {
  if (niveau === "college") {
    const grades = Object.values(pickEffCollege(row));
    const total = grades.reduce((a: number, b: number) => a + b, 0);
    if (total === 0) return computeSectionsGrade(getEffectifs(row) || 0);
    return grades.reduce((acc: number, e: number) => acc + computeSectionsGrade(e), 0);
  }

  const ly = pickEffLycee(row);
  const detail = [ly.eff2nde, ly.eff1l, ly.eff1s, ly.eff1ose, ly.effTl, ly.effTs, ly.effTose];
  const detailTotal = detail.reduce((a, b) => a + b, 0);
  if (detailTotal > 0) {
    return detail.reduce((acc, e) => acc + computeSectionsGrade(e), 0);
  }
  const agg = [ly.eff2nde, ly.eff1re, ly.effTle];
  const aggTotal = agg.reduce((a, b) => a + b, 0);
  if (aggTotal === 0) return computeSectionsGrade(getEffectifs(row) || 0);
  return agg.reduce((acc, e) => acc + computeSectionsGrade(e), 0);
};

/* ───────── Vérification sections (collège / lycée) ───────── */

type ExplicationSections = {
  niveau: "college" | "lycee";
  grades: { label: string; effectif: number; sections: number }[];
  totalSections: number;
  regle: string[];
};

const REGLE_SECTIONS = [
  "Pour chaque classe / filière, séparément (pas de multigrade entre grades) :",
  "• effectif = 0 → 0 section",
  "• 0 < effectif < 50 → 1 section",
  "• effectif ≥ 50 : quotient = floor(effectif / 50), reste = effectif % 50",
  "  – reste < 20 → absorbé → sections = quotient",
  "  – reste ≥ 20 → sections = quotient + 1",
  "Total = somme des sections de chaque classe / filière.",
];

const explainSections = (row: any, niveau: "college" | "lycee"): ExplicationSections => {
  if (niveau === "college") {
    const { eff6e, eff5e, eff4e, eff3e } = pickEffCollege(row);
    const grades = [
      { label: "6e", effectif: eff6e, sections: computeSectionsGrade(eff6e) },
      { label: "5e", effectif: eff5e, sections: computeSectionsGrade(eff5e) },
      { label: "4e", effectif: eff4e, sections: computeSectionsGrade(eff4e) },
      { label: "3e", effectif: eff3e, sections: computeSectionsGrade(eff3e) },
    ];
    return {
      niveau,
      grades,
      totalSections: grades.reduce((a, g) => a + g.sections, 0),
      regle: REGLE_SECTIONS,
    };
  }

  const ly = pickEffLycee(row);
  const detail = [
    { label: "2nde", effectif: ly.eff2nde, sections: computeSectionsGrade(ly.eff2nde) },
    { label: "1re L", effectif: ly.eff1l, sections: computeSectionsGrade(ly.eff1l) },
    { label: "1re S", effectif: ly.eff1s, sections: computeSectionsGrade(ly.eff1s) },
    { label: "1re OSE", effectif: ly.eff1ose, sections: computeSectionsGrade(ly.eff1ose) },
    { label: "Tle L", effectif: ly.effTl, sections: computeSectionsGrade(ly.effTl) },
    { label: "Tle S", effectif: ly.effTs, sections: computeSectionsGrade(ly.effTs) },
    { label: "Tle OSE", effectif: ly.effTose, sections: computeSectionsGrade(ly.effTose) },
  ];
  const detailTotal = detail.reduce((a, g) => a + g.effectif, 0);
  const grades =
    detailTotal > 0
      ? detail
      : [
          { label: "2nde", effectif: ly.eff2nde, sections: computeSectionsGrade(ly.eff2nde) },
          { label: "1re", effectif: ly.eff1re, sections: computeSectionsGrade(ly.eff1re) },
          { label: "Tle", effectif: ly.effTle, sections: computeSectionsGrade(ly.effTle) },
        ];

  return {
    niveau,
    grades,
    totalSections: grades.reduce((a, g) => a + g.sections, 0),
    regle: REGLE_SECTIONS,
  };
};

const SectionsTraceContent = ({ exp }: { exp: ExplicationSections }) => (
  <div className="flex-1 overflow-y-auto space-y-4 px-1">
    <div className="rounded-xl border p-3 space-y-1 text-sm">
      <div className="font-semibold">Règle de calcul des sections</div>
      <ul className="text-muted-foreground space-y-0.5 list-disc list-inside text-xs">
        {exp.regle.map((l, i) => (
          <li key={i}>{l}</li>
        ))}
      </ul>
    </div>

    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
      {exp.grades.map((g) => (
        <div key={g.label} className="rounded-lg border p-2">
          <div className="text-[11px] uppercase text-muted-foreground font-semibold">{g.label}</div>
          <div className="text-sm tabular-nums text-muted-foreground">
            {formatNumber(g.effectif)} él.
          </div>
          <div className="text-lg font-bold tabular-nums">{formatNumber(g.sections)} sect.</div>
        </div>
      ))}
    </div>

    <div className="rounded-xl border-2 border-primary/30 bg-primary/5 p-4 text-center">
      <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-1">
        Sections totales
      </div>
      <div className="text-3xl font-bold text-primary tabular-nums">
        {formatNumber(exp.totalSections)}
      </div>
      <div className="text-xs text-muted-foreground mt-1">
        Base des calculs salles / enseignants ({exp.niveau === "college" ? "collège" : "lycée"})
      </div>
    </div>
  </div>
);

const computeRequisPrimaire = (row: any, effTotal: number): number => {
  const t1 = pickNumRaw(row, ["EFF_T1", "eff_t1"]) || 0;
  const t2 = pickNumRaw(row, ["EFF_T2", "eff_t2"]) || 0;
  const t3 = pickNumRaw(row, ["EFF_T3", "eff_t3"]) || 0;
  const t4 = pickNumRaw(row, ["EFF_T4", "eff_t4"]) || 0;
  const t5 = pickNumRaw(row, ["EFF_T5", "eff_t5"]) || 0;

  if ([t1, t2, t3, t4, t5].every((v) => v === 0)) {
    return Math.ceil((effTotal || 0) / 50);
  }

  // Chaque classe pédagogique correspond à un enseignant requis.
  return getGroupePeda(row);
};

type EnseignantsCollegeDetail = {
  sections: number;
  requisEps: number;
  requisLitteraire: number;
  requisScientifique: number;
  requisTotal: number;
};

/**
 * Enseignants requis au collège = ceil(sections × heures_matière / heures_hebdo_enseignant)
 * calculé séparément pour EPS, Littéraire et Scientifique, puis sommé.
 * Normes officielles : HORAIRE_COLLEGE (litteraire=14, scientifique=16) et
 * HORAIRE_HEBDO_ENSEIGNANT=20, importées de normesHoraires.ts. La valeur
 * EPS (2h) n'était pas fournie explicitement pour le collège — reprise de
 * la valeur EPS du lycée (constante sur les 7 filières/cycles) ; voir
 * HORAIRE_COLLEGE_CONFIRME dans normesHoraires.ts.
 */
const computeEnseignantsCollege = (row: any): EnseignantsCollegeDetail => {
  const sections = computeSectionsRequises(row, "college");
  const requisEps = Math.ceil((sections * HORAIRE_COLLEGE.eps) / HORAIRE_HEBDO_ENSEIGNANT);
  const requisLitteraire = Math.ceil(
    (sections * HORAIRE_COLLEGE.litteraire) / HORAIRE_HEBDO_ENSEIGNANT,
  );
  const requisScientifique = Math.ceil(
    (sections * HORAIRE_COLLEGE.scientifique) / HORAIRE_HEBDO_ENSEIGNANT,
  );

  return {
    sections,
    requisEps,
    requisLitteraire,
    requisScientifique,
    requisTotal: requisEps + requisLitteraire + requisScientifique,
  };
};

const computeRequisCollege = (row: any): number => computeEnseignantsCollege(row).requisTotal;

/**
 * Salles de classe requises au collège — formule officielle (fichier Excel
 * fourni) : ARRONDI( Σ(sections_grade × horaire_élève_grade) / utilisation
 * hebdomadaire d'une salle ), avec un seuil d'utilisation différent en
 * zone rurale (40h/semaine) et urbaine (45h/semaine). horaire_élève_grade
 * exclut l'EPS (qui n'occupe pas une salle de classe). Remplace l'ancien
 * calcul "1 salle par section", moins précis.
 */
const computeRequisSdcCollege = (row: any): number => {
  const { eff6e, eff5e, eff4e, eff3e } = pickEffCollege(row);
  const heuresTotales =
    computeSectionsGrade(eff6e) * HORAIRE_ELEVE_COLLEGE_SANS_EPS["6e"] +
    computeSectionsGrade(eff5e) * HORAIRE_ELEVE_COLLEGE_SANS_EPS["5e"] +
    computeSectionsGrade(eff4e) * HORAIRE_ELEVE_COLLEGE_SANS_EPS["4e"] +
    computeSectionsGrade(eff3e) * HORAIRE_ELEVE_COLLEGE_SANS_EPS["3e"];
  const utilisationHebdo = isRural(row)
    ? UTILISATION_SDC_HEBDO.rural
    : UTILISATION_SDC_HEBDO.urbain;
  if (utilisationHebdo <= 0 || heuresTotales <= 0) return 0;
  return Math.round(heuresTotales / utilisationHebdo);
};

type EnseignantsLyceeDetail = {
  sections: number;
  parMatiere: { code: MatiereCode; label: string; requis: number }[];
  requisTotal: number;
};

/**
 * Enseignants requis au lycée, matière par matière, avec les normes
 * officielles de normesHoraires.ts (HORAIRE_LYCEE : 7 filières × 10
 * matières). Notre modèle de données actuel n'a que 3 agrégats
 * (2nde/1ère/Tle globaux, sans détail L/S/OSE) : on applique donc, par
 * repli, la MOYENNE des horaires des filières de chaque cycle
 * (HORAIRE_LYCEE_MOYENNE_PAR_CYCLE) aux sections de ce cycle. Dès que les
 * effectifs par filière seront collectés, remplacer ce repli par un calcul
 * filière par filière utilisant HORAIRE_LYCEE directement (plus précis).
 */
const computeEnseignantsLycee = (row: any): EnseignantsLyceeDetail => {
  const ly = pickEffLycee(row);
  const sections2nde = computeSectionsGrade(ly.eff2nde);
  // Si détail filière dispo : sections 1re/Tle = somme des sections filière
  // (plus fidèle que sections(somme effectifs)).
  const sections1re =
    ly.eff1l + ly.eff1s + ly.eff1ose > 0
      ? computeSectionsGrade(ly.eff1l) +
        computeSectionsGrade(ly.eff1s) +
        computeSectionsGrade(ly.eff1ose)
      : computeSectionsGrade(ly.eff1re);
  const sectionsTle =
    ly.effTl + ly.effTs + ly.effTose > 0
      ? computeSectionsGrade(ly.effTl) +
        computeSectionsGrade(ly.effTs) +
        computeSectionsGrade(ly.effTose)
      : computeSectionsGrade(ly.effTle);

  const parMatiere = MATIERES_LYCEE_NORMES.map((m) => {
    const heures =
      sections2nde * HORAIRE_LYCEE_MOYENNE_PAR_CYCLE["2nde"][m.code] +
      sections1re * HORAIRE_LYCEE_MOYENNE_PAR_CYCLE["1ere"][m.code] +
      sectionsTle * HORAIRE_LYCEE_MOYENNE_PAR_CYCLE["terminale"][m.code];
    return {
      code: m.code,
      label: m.label,
      requis: Math.ceil(heures / HORAIRE_HEBDO_ENSEIGNANT),
    };
  });

  return {
    sections: sections2nde + sections1re + sectionsTle,
    parMatiere,
    requisTotal: parMatiere.reduce((acc, m) => acc + m.requis, 0),
  };
};

const computeRequisLycee = (row: any): number => computeEnseignantsLycee(row).requisTotal;

type CategorieDef = {
  id: Categorie;
  label: string;
  shortLabel: string;
  icon: any;
  unit: string;
  computeRequis?: (eff: number, niveau: Niveau, row?: any) => number;
};

const CATEGORIES: CategorieDef[] = [
  {
    id: "salles",
    label: "Besoins en salles de classe",
    shortLabel: "Salles de classe",
    icon: Building2,
    unit: "salles",
    computeRequis: (eff: number, niv: Niveau, row?: any) => {
      if (niv === "primaire") {
        const grp = getGroupePeda(row);
        if (grp > 0) return computeRequisSdcFromGroupe(grp, isRural(row));
        return Math.ceil((eff || 0) / 50);
      }
      if (niv === "prescolaire") {
        const grp = getGroupePedaPresco(row);
        if (grp > 0) return computeRequisSdcFromGroupe(grp, isRural(row));
        return 0;
      }
      if (niv === "college") {
        // Formule officielle (Excel) : ARRONDI(Σ(sections×horaire_élève) / utilisation hebdo)
        return computeRequisSdcCollege(row);
      }
      // Lycée : pas de formule officielle horaire fournie pour les salles —
      // on garde le calcul par sections (1 classe par tranche de 50 élèves).
      return computeSectionsRequises(row, "lycee");
    },
  },
  {
    id: "enseignants",
    label: "Besoins en enseignants",
    shortLabel: "Enseignants",
    icon: Users,
    unit: "enseignants",
    computeRequis: (eff: number, niv: Niveau, row?: any) =>
      niv === "primaire"
        ? computeRequisPrimaire(row, eff)
        : niv === "prescolaire"
          ? getGroupePedaPresco(row) // chaque classe pédagogique = 1 enseignant
          : niv === "college"
            ? computeRequisCollege(row)
            : computeRequisLycee(row),
  },
  {
    id: "tb",
    label: "Besoins en tables-bancs (places assises)",
    shortLabel: "Tables-bancs",
    icon: Armchair,
    unit: "places",
    computeRequis: (eff: number, niv: Niveau, row?: any) => {
      if (niv === "primaire") {
        if (isRural(row)) return eff || 0;
        const grp = getGroupePeda(row);
        const requisSdc = computeRequisSdcFromGroupe(grp, false);
        return requisSdc * NORME_ELEVE_PRIMAIRE;
      }
      if (niv === "prescolaire") {
        if (isRural(row)) return eff || 0;
        const grp = getGroupePedaPresco(row);
        const requisSdc = computeRequisSdcFromGroupe(grp, false);
        return requisSdc * NORME_ELEVE_PRESCO;
      }
      // Collège / lycée : toujours l'effectif total, pas de distinction rurale
      return eff || 0;
    },
  },
  {
    id: "manuels",
    label: "Besoins en manuels",
    shortLabel: "Manuels",
    icon: Library,
    unit: "manuels",
    computeRequis: (eff: number, niv: Niveau) => {
      // Un manuel pour 2 élèves — uniquement préscolaire et primaire
      // (non pertinent pour le collège/lycée, catégorie masquée pour ces niveaux).
      if (niv === "primaire" || niv === "prescolaire") return Math.ceil((eff || 0) / 2);
      return 0;
    },
  },
];

const getCodeEtab = (row: any): string => String(row?.CODE_ETAB ?? row?.code_etab ?? "").trim();

const getEffectifs = (row: any): number => {
  const total = pickNumRaw(row, ["EFFECTIFS", "eff_total", "EFFECTIF", "EFF_TOTAL"]);
  if (total != null) return total;

  const byClass = [
    "EFF_PS",
    "EFF_MS",
    "EFF_GS",
    "EFF_T1",
    "EFF_T2",
    "EFF_T3",
    "EFF_T4",
    "EFF_T5",
    "EFF_T6",
    "EFF_T7",
    "EFF_T8",
    "EFF_T9",
    "EFF_6E",
    "EFF_5E",
    "EFF_4E",
    "EFF_3E",
    "EFF_2NDE",
    "EFF_1RE",
    "EFF_TLE",
    "EFF_1L",
    "EFF_1S",
    "EFF_1OSE",
    "EFF_TL",
    "EFF_TS",
    "EFF_TOSE",
  ];
  return byClass.reduce((sum, key) => sum + (pickNumRaw(row, [key]) ?? 0), 0);
};
const dedupeByCodeEtab = (rows: any[]): any[] => {
  const byCode = new Map<string, any>();
  rows.forEach((row) => {
    const code = getCodeEtab(row);
    if (!code) return;
    const existing = byCode.get(code);
    if (!existing || getEffectifs(row) > getEffectifs(existing)) {
      byCode.set(code, row);
    }
  });
  return Array.from(byCode.values());
};

const computeRow = (row: any, cat: CategorieDef, niveau: Niveau) => {
  const eff = getEffectifs(row);
  const computedRequis = cat.computeRequis ? cat.computeRequis(eff, niveau, row) : 0;

  let existant = 0;
  let warning = "";

  switch (cat.id) {
    case "salles":
      existant = pickNumRaw(row, ["SDC_EXISTANT", "SDC_BE", "sdc_be"]) ?? 0;
      break;
    case "enseignants":
      existant = pickNumRaw(row, ["ENS_EXISTANT", "en_classe"]) ?? 0;
      break;
    case "tb":
      existant = pickNumRaw(row, ["PLACES", "places_n2", "places_n3"]) ?? 0;
      break;
    case "manuels":
      if (niveau === "college" || niveau === "lycee") {
        existant = 0;
        warning = "Données manuels non disponibles pour le secondaire";
      } else {
        existant = pickNumRaw(row, ["MANUEL_EXISTANT", "manuel_existant"]) ?? 0;
      }
      break;
  }

  const besoin = Math.max(0, computedRequis - existant);
  const excedent = Math.max(0, existant - computedRequis);

  const couverture =
    computedRequis > 0
      ? Math.max(0, Math.min(100, ((computedRequis - besoin) / computedRequis) * 100))
      : 100;

  const statut: "correcte" | "moderes" | "critiques" =
    computedRequis <= 0
      ? "correcte"
      : couverture >= 80
        ? "correcte"
        : couverture >= 50
          ? "moderes"
          : "critiques";

  return {
    requis: Math.round(computedRequis),
    existant: Math.round(existant),
    besoin: Math.round(besoin),
    excedent: Math.round(excedent),
    couverture,
    statut,
    warning,
  };
};

const formatNumber = (n: number) => new Intl.NumberFormat("fr-FR").format(Math.round(n || 0));

const besoinsCache = new Map<string, any[]>();

const Besoins = () => {
  const { niveau: niveauParam } = useParams<{ niveau: Niveau }>();
  const niveau: Niveau = (
    ["prescolaire", "primaire", "college", "lycee"].includes(niveauParam || "")
      ? niveauParam
      : "primaire"
  ) as Niveau;
  const meta = NIVEAU_META[niveau];
  const NiveauIcon = meta.icon;

  const { user } = useAuth();
  const userDren = useMemo(() => {
    const d = Number(user?.dren);
    return Number.isFinite(d) && d > 0 ? d : 0;
  }, [user]);
  const userCisco = useMemo(() => {
    const c = Number(user?.cisco);
    return Number.isFinite(c) && c > 0 ? c : 0;
  }, [user]);
  const isAdmin = !!user?.is_superuser || !!user?.is_staff;
  const drenLocked = !isAdmin && userDren > 0;
  const ciscoLocked = !isAdmin && userCisco > 0;

  const [drens, setDrens] = useState<Dren[]>([]);
  const [ciscos, setCiscos] = useState<Cisco[]>([]);
  const [zaps, setZaps] = useState<Zap[]>([]);
  const [annee, setAnnee] = useState<number>(2025); // Année par défaut
  const [selectedSecteur, setSelectedSecteur] = useState("2");
  const [codeDren, setCodeDren] = useState<string>(drenLocked ? String(userDren) : "0");
  const [codeCisco, setCodeCisco] = useState<string>(ciscoLocked ? String(userCisco) : "0");
  const [codeZap, setCodeZap] = useState<string>("0");
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingFilters, setLoadingFilters] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [categorie, setCategorie] = useState<Categorie>("salles");
  const availableCategories = useMemo(
    () =>
      niveau === "college" || niveau === "lycee"
        ? CATEGORIES.filter((c) => c.id !== "manuels")
        : CATEGORIES,
    [niveau],
  );
  const activeCat = availableCategories.find((c) => c.id === categorie) ?? availableCategories[0];
  const [showExportModal, setShowExportModal] = useState(false);
  const [verifRow, setVerifRow] = useState<any | null>(null);
  const [showVerifModal, setShowVerifModal] = useState(false);
  const [verifCodeEtab, setVerifCodeEtab] = useState("");
  const [verifEtabLabel, setVerifEtabLabel] = useState("");
  const [verifNotFound, setVerifNotFound] = useState(false);
  const [verifT1, setVerifT1] = useState("0");
  const [verifT2, setVerifT2] = useState("0");
  const [verifT3, setVerifT3] = useState("0");
  const [verifT4, setVerifT4] = useState("0");
  const [verifT5, setVerifT5] = useState("0");
  const [verif6e, setVerif6e] = useState("0");
  const [verif5e, setVerif5e] = useState("0");
  const [verif4e, setVerif4e] = useState("0");
  const [verif3e, setVerif3e] = useState("0");
  const [verif2nde, setVerif2nde] = useState("0");
  const [verif1l, setVerif1l] = useState("0");
  const [verif1s, setVerif1s] = useState("0");
  const [verif1ose, setVerif1ose] = useState("0");
  const [verifTl, setVerifTl] = useState("0");
  const [verifTs, setVerifTs] = useState("0");
  const [verifTose, setVerifTose] = useState("0");
  const [sectionRow, setSectionRow] = useState<any | null>(null);
  const [exportFormat, setExportFormat] = useState<ExportFormat>("xlsx");
  const [isFilterDirty, setIsFilterDirty] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const markFilterDirty = () => {
    if (!isResetting) setIsFilterDirty(true);
  };

  useEffect(() => {
    if (!availableCategories.some((category) => category.id === categorie)) {
      setCategorie("salles");
    }
  }, [availableCategories, categorie]);

  const fetchData = useCallback(
    async (
      cd: number,
      cc: number,
      cz: number,
      an: number = 2025,
      opts: { silent?: boolean; force?: boolean } = {},
    ) => {
      const cacheKey = `${niveau}:${cd}:${cc}:${cz}:${an}`;

      // force=true (Appliquer / Reset) → recharge toujours pour l'année demandée
      if (!opts.force && besoinsCache.has(cacheKey)) {
        const cached = besoinsCache.get(cacheKey)!;
        setData(cached);
        setLastUpdate(new Date());
        return cached;
      }

      setLoading(true);
      try {
        let res: any[] = [];
        if (niveau === "prescolaire") {
          // L'API Besoins ne fournit pas encore de niveau N0 : calculer les
          // besoins à partir des données préscolaires retournées par Données.
          res = await donneesApi.getEtabN0(cd, cc, 0, cz, Number(selectedSecteur), an);
        } else if (niveau === "primaire") {
          res = await besoinsApi.getBesoinsN1(cd, cc, cz, an);
        } else if (niveau === "college") {
          res = await besoinsApi.getBesoinsN2(cd, cc, cz, an);
        } else {
          res = await besoinsApi.getBesoinsN3(cd, cc, cz, an);
        }

        const deduped = dedupeByCodeEtab(Array.isArray(res) ? res : []);

        besoinsCache.set(cacheKey, deduped);
        setData(deduped);
        setLastUpdate(new Date());

        if (!opts.silent && deduped.length > 0) {
          notify({
            title: `Données chargées avec succès`,
            message: `${formatNumber(deduped.length)} établissements analysés pour l'année ${an - 1}-${an}`,
            type: "success",
            silent: false,
          });
        } else if (deduped.length === 0) {
          notify({
            title: "Aucune donnée trouvée",
            message: `Aucun établissement trouvé pour les filtres sélectionnés (${an - 1}-${an}).`,
            type: "warning",
          });
        }

        return deduped;
      } catch (e) {
        console.error(e);
        notify({
          title: "Erreur de chargement",
          message: `Impossible de récupérer les besoins pour ${meta.label}.`,
          type: "error",
        });
        setData([]);
        return [];
      } finally {
        setLoading(false);
      }
    },
    [niveau, meta.label, selectedSecteur],
  );

  /* Chargement initial */
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const d = await besoinsApi.getDrens();
        if (cancelled) return;
        setDrens(d || []);
      } catch {
        toast.error("Erreur chargement DREN");
      }

      const initialDren = drenLocked ? userDren : 0;
      const initialCisco = ciscoLocked ? userCisco : 0;

      setCodeDren(String(initialDren));
      setCodeCisco(String(initialCisco));
      setCodeZap("0");
      setZaps([]);
      setAnnee(2025); // Année par défaut

      if (drenLocked) {
        try {
          const c = await besoinsApi.getCiscos(userDren);
          if (!cancelled) setCiscos(c || []);
        } catch {
          /* noop */
        }
      } else {
        setCiscos([]);
      }

      // Chargement initial des données avec l'année
      await fetchData(initialDren, initialCisco, 0, 2025, { silent: true });
    })();

    return () => {
      cancelled = true;
    };
  }, [niveau, drenLocked, ciscoLocked, userDren, userCisco, fetchData]);

  // Le rechargement des données ne part plus automatiquement à chaque
  // changement de filtre (DREN/CISCO/ZAP/Année) : cela provoquait un
  // double appel au montage et rendait le bouton "Appliquer" inopérant.
  // Le fetch est désormais déclenché explicitement par handleFilter
  // (clic sur "Appliquer") ou par handleReset — comme dans Donnees.tsx.

  // Chargement automatique des ZAP quand DREN et CISCO sont figés (restriction utilisateur)
  useEffect(() => {
    if (drenLocked && ciscoLocked && codeCisco !== "0") {
      const loadLockedZaps = async () => {
        setLoadingFilters(true);
        try {
          const z = await besoinsApi.getZaps(userDren, userCisco);
          const uniqueZaps = z
            ? Array.from(
                new Map(
                  z
                    .filter(
                      (item: any) => item?.CODE_ZAP != null && String(item.CODE_ZAP).trim() !== "",
                    )
                    .map((item: any) => [String(item.CODE_ZAP).trim(), item]),
                ).values(),
              )
            : [];
          setZaps(uniqueZaps);
        } catch (error) {
          console.error("Erreur ZAP restreint:", error);
          setZaps([]);
        } finally {
          setLoadingFilters(false);
        }
      };

      loadLockedZaps();
    }
  }, [drenLocked, ciscoLocked, codeCisco, userDren, userCisco]);

  const handleDrenChange = async (value: string) => {
    if (drenLocked) return;

    setCodeDren(value);
    setCodeCisco("0");
    setCodeZap("0");
    setCiscos([]);
    setZaps([]);
    markFilterDirty();

    if (value === "0") return;

    setLoadingFilters(true);

    try {
      const c = await besoinsApi.getCiscos(parseInt(value));
      const uniqueCiscos = c
        ? Array.from(new Map(c.map((item) => [item.CODE_CISCO, item])).values())
        : [];
      setCiscos(uniqueCiscos);
    } catch (error) {
      console.error("Erreur CISCO:", error);
      toast.error("Erreur chargement CISCO");
      setCiscos([]);
    } finally {
      setLoadingFilters(false);
    }
  };

  const handleCiscoChange = async (value: string) => {
    if (ciscoLocked) return;

    setCodeCisco(value);
    setCodeZap("0");
    setZaps([]);
    markFilterDirty();

    if (value === "0") return;

    setLoadingFilters(true);

    try {
      const currentDren = parseInt(codeDren) || 0;
      const currentCisco = parseInt(value);

      // Charger uniquement les ZAP du CISCO sélectionné
      const z = await besoinsApi.getZaps(currentDren, currentCisco);

      const uniqueZaps = z
        ? Array.from(
            new Map(
              z
                .filter(
                  (item: any) => item?.CODE_ZAP != null && String(item.CODE_ZAP).trim() !== "",
                )
                .map((item: any) => [String(item.CODE_ZAP).trim(), item]),
            ).values(),
          )
        : [];

      setZaps(uniqueZaps);
    } catch (error: any) {
      console.error("Erreur ZAP:", error);
      toast.error("Erreur lors du chargement des ZAP");
      setZaps([]);
    } finally {
      setLoadingFilters(false);
    }
  };

  const handleFilter = () => {
    setIsFilterDirty(false);
    fetchData(parseInt(codeDren) || 0, parseInt(codeCisco) || 0, parseInt(codeZap) || 0, annee, {
      force: true,
    });
  };

  const handleReset = () => {
    if (drenLocked) return;

    setIsResetting(true);
    setCodeDren("0");
    setCodeCisco("0");
    setCodeZap("0");
    setCiscos([]);
    setZaps([]);

    setAnnee(2025);
    setSelectedSecteur("2");
    setIsFilterDirty(false);

    fetchData(0, 0, 0, 2025, { force: true });
    setTimeout(() => setIsResetting(false), 0);
  };

  const enrichedData = useMemo(() => {
    return data.map((row) => {
      const c = computeRow(row, activeCat, niveau);
      const zone = getZoneInfo(row).label;

      // Primaire
      const t1 = pickNumRaw(row, ["EFF_T1", "eff_t1"]) || 0;
      const t2 = pickNumRaw(row, ["EFF_T2", "eff_t2"]) || 0;
      const t3 = pickNumRaw(row, ["EFF_T3", "eff_t3"]) || 0;
      const t4 = pickNumRaw(row, ["EFF_T4", "eff_t4"]) || 0;
      const t5 = pickNumRaw(row, ["EFF_T5", "eff_t5"]) || 0;
      const classePeda = getGroupePeda(row);

      // Préscolaire —
      const effPs = pickNumRaw(row, ["EFF_PS", "eff_ps"]) || 0;
      const effMs = pickNumRaw(row, ["EFF_MS", "eff_ms"]) || 0;
      const effGs = pickNumRaw(row, ["EFF_GS", "eff_gs"]) || 0;

      // Collège (EFF_6E… ou EFF_T6…)
      const eff6e = pickNumRaw(row, ["EFF_6E", "eff_6e", "EFF_6eme", "EFF_T6", "eff_t6"]) || 0;
      const eff5e = pickNumRaw(row, ["EFF_5E", "eff_5e", "EFF_5eme", "EFF_T7", "eff_t7"]) || 0;
      const eff4e = pickNumRaw(row, ["EFF_4E", "eff_4e", "EFF_4eme", "EFF_T8", "eff_t8"]) || 0;
      const eff3e = pickNumRaw(row, ["EFF_3E", "eff_3e", "EFF_3eme", "EFF_T9", "eff_t9"]) || 0;

      // Lycée (agrégats + détail filière si API le fournit)
      const ly = pickEffLycee(row);
      const eff2nde = ly.eff2nde;
      const eff1re = ly.eff1re;
      const effTle = ly.effTle;

      // Sections : calculées (pas le champ API absent)
      const nbSection =
        niveau === "college"
          ? computeSectionsRequises(row, "college")
          : niveau === "lycee"
            ? computeSectionsRequises(row, "lycee")
            : 0;

      // Affichage ZAP = CODE_ZAP (pas le libellé)
      const codeZap = String(row?.CODE_ZAP ?? row?.code_zap ?? "").trim();
      const zapName = String(row?.ZAP ?? row?.zap ?? row?.NOM_ZAP ?? row?.nom_zap ?? "").trim();

      return {
        ...row,
        ZONE: zone,
        CODE_ZAP: codeZap,
        ZAP_LABEL: zapName || codeZap,
        REQUIS: c.requis,
        EXISTANT: c.existant,
        BESOIN: c.besoin,
        EXCEDENT: c.excedent,
        COUVERTURE: c.couverture,
        STATUT: c.statut,
        WARNING: c.warning || "",
        EFFECTIFS: getEffectifs(row),
        EFF_PS: effPs,
        EFF_MS: effMs,
        EFF_GS: effGs,
        EFF_T1: t1,
        EFF_T2: t2,
        EFF_T3: t3,
        EFF_T4: t4,
        EFF_T5: t5,
        CLASSE_PEDA: classePeda,
        NB_SECTION: nbSection,
        EFF_6E: eff6e,
        EFF_5E: eff5e,
        EFF_4E: eff4e,
        EFF_3E: eff3e,
        EFF_2NDE: eff2nde,
        EFF_1RE: eff1re,
        EFF_TLE: effTle,
        EFF_1L: ly.eff1l,
        EFF_1S: ly.eff1s,
        EFF_1OSE: ly.eff1ose,
        EFF_TL: ly.effTl,
        EFF_TS: ly.effTs,
        EFF_TOSE: ly.effTose,
      };
    });
  }, [data, activeCat, niveau]);

  const filteredData = useMemo(() => {
    return enrichedData.filter((row) => {
      const rowSecteur = String(row.SECTEUR ?? row.secteur ?? "").trim();

      if (selectedSecteur === "2") return true;
      if (selectedSecteur === "0") return rowSecteur === "0" || rowSecteur === "";
      if (selectedSecteur === "1") return rowSecteur === "1";

      return true;
    });
  }, [enrichedData, selectedSecteur]);

  /* Scénario de vérification du groupe pédagogique (primaire) : recherche
   * d'un établissement par code pour pré-remplir T1-T5, puis calcul de la
   * trace détaillée en temps réel à partir des champs (modifiables). */
  const handleVerifRecherche = () => {
    const code = verifCodeEtab.trim();
    if (!code) {
      setVerifNotFound(false);
      setVerifEtabLabel("");
      return;
    }
    const row = enrichedData.find((r) => getCodeEtab(r) === code);
    if (!row) {
      setVerifNotFound(true);
      setVerifEtabLabel("");
      return;
    }
    setVerifNotFound(false);
    setVerifEtabLabel(String(row.NOM_ETAB ?? row.nom_etab ?? ""));
    if (niveau === "primaire" || niveau === "prescolaire") {
      setVerifT1(String(row.EFF_T1 ?? 0));
      setVerifT2(String(row.EFF_T2 ?? 0));
      setVerifT3(String(row.EFF_T3 ?? 0));
      setVerifT4(String(row.EFF_T4 ?? 0));
      setVerifT5(String(row.EFF_T5 ?? 0));
    } else if (niveau === "college") {
      setVerif6e(String(row.EFF_6E ?? row.EFF_T6 ?? 0));
      setVerif5e(String(row.EFF_5E ?? row.EFF_T7 ?? 0));
      setVerif4e(String(row.EFF_4E ?? row.EFF_T8 ?? 0));
      setVerif3e(String(row.EFF_3E ?? row.EFF_T9 ?? 0));
    } else {
      setVerif2nde(String(row.EFF_2NDE ?? 0));
      setVerif1l(String(row.EFF_1L ?? 0));
      setVerif1s(String(row.EFF_1S ?? 0));
      setVerif1ose(String(row.EFF_1OSE ?? 0));
      setVerifTl(String(row.EFF_TL ?? 0));
      setVerifTs(String(row.EFF_TS ?? 0));
      setVerifTose(String(row.EFF_TOSE ?? 0));
    }
  };

  const toNumVerif = (v: string) => {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
  };

  const verifTrace = useMemo(() => {
    return explainGroupePeda({
      EFF_T1: toNumVerif(verifT1),
      EFF_T2: toNumVerif(verifT2),
      EFF_T3: toNumVerif(verifT3),
      EFF_T4: toNumVerif(verifT4),
      EFF_T5: toNumVerif(verifT5),
    });
  }, [verifT1, verifT2, verifT3, verifT4, verifT5]);

  const verifSectionsTrace = useMemo(() => {
    if (niveau === "college") {
      return explainSections(
        {
          EFF_6E: toNumVerif(verif6e),
          EFF_5E: toNumVerif(verif5e),
          EFF_4E: toNumVerif(verif4e),
          EFF_3E: toNumVerif(verif3e),
        },
        "college",
      );
    }
    return explainSections(
      {
        EFF_2NDE: toNumVerif(verif2nde),
        EFF_1L: toNumVerif(verif1l),
        EFF_1S: toNumVerif(verif1s),
        EFF_1OSE: toNumVerif(verif1ose),
        EFF_TL: toNumVerif(verifTl),
        EFF_TS: toNumVerif(verifTs),
        EFF_TOSE: toNumVerif(verifTose),
      },
      "lycee",
    );
  }, [
    niveau,
    verif6e,
    verif5e,
    verif4e,
    verif3e,
    verif2nde,
    verif1l,
    verif1s,
    verif1ose,
    verifTl,
    verifTs,
    verifTose,
  ]);

  const stats = useMemo(() => {
    const ecoles = new Set(filteredData.map((e) => e.CODE_ETAB)).size;

    let requis = 0,
      existant = 0,
      besoins = 0,
      excedent = 0;

    let correcte = 0,
      moderes = 0,
      critiques = 0;

    for (const row of filteredData) {
      requis += row.REQUIS;
      existant += row.EXISTANT;
      besoins += row.BESOIN;
      excedent += row.EXCEDENT;

      switch (row.STATUT) {
        case "correcte":
          correcte++;
          break;

        case "moderes":
          moderes++;
          break;

        case "critiques":
          critiques++;
          break;
      }
    }

    const couverture =
      requis > 0 ? Math.max(0, Math.min(100, ((requis - besoins) / requis) * 100)) : 0;

    const status: "correcte" | "moderes" | "critiques" =
      couverture >= 80 ? "correcte" : couverture >= 50 ? "moderes" : "critiques";

    return {
      ecoles,
      requis,
      existant,
      besoins,
      excedent,
      couverture,
      correcte,
      moderes,
      critiques,
      status,
    };
  }, [filteredData]);

  // === À METTRE AVANT le useMemo des columns ===
  const zapMap = useMemo(() => {
    const map = new Map<string, string>();
    zaps.forEach((z: any) => {
      if (z.CODE_ZAP) {
        map.set(String(z.CODE_ZAP).trim(), z.ZAP || z.zap || "");
      }
    });
    return map;
  }, [zaps]);

  // === Ensuite le columns ===
  const columns = useMemo(() => {
    const getStatutColor = (statut: string) => {
      switch (statut?.toLowerCase()) {
        case "correcte":
          return "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800";
        case "moderes":
          return "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800";
        case "critiques":
          return "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800";
        default:
          return "bg-muted text-muted-foreground border-border";
      }
    };

    const getCouvertureColor = (couverture: number) => {
      if (couverture >= 80)
        return "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300";
      if (couverture >= 50)
        return "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300";
      return "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-950 dark:text-rose-300";
    };

    const numCol = (key: string, label: string, width = 90) => ({
      key,
      label,
      width,
      sortable: true,
      align: "center" as const,
      render: (v: any) => formatNumber(Number(v) || 0),
    });

    const baseCols: any[] = [
      {
        key: "DREN",
        label: "DREN",
        width: 140,
        sortable: true,
        align: "left" as const,
      },
      {
        key: "CISCO",
        label: "CISCO",
        width: 140,
        sortable: true,
        align: "left" as const,
      },
      {
        key: "CODE_ZAP",
        label: "ZAP",
        width: 180,
        sortable: true,
        align: "left" as const,
        render: (_value: any, row: any) => {
          const code = String(row?.CODE_ZAP ?? row?.code_zap ?? "").trim();
          const fromApi = String(row?.ZAP ?? row?.zap ?? "").trim();
          const fromMap = code ? zapMap.get(code) || "" : "";
          const name =
            (fromApi && fromApi !== code ? fromApi : "") ||
            (fromMap && fromMap !== code ? fromMap : "") ||
            "";
          return (
            <span className="font-medium text-sm" title={code ? `Code ZAP : ${code}` : undefined}>
              {name || (code ? `ZAP ${code}` : "—")}
            </span>
          );
        },
      },
      {
        key: "NOM_ETAB",
        label: "Nom établissement",
        width: 260,
        sortable: true,
        align: "left" as const,
      },
      {
        key: "CODE_ETAB",
        label: "CODE établissement",
        width: 200,
        sortable: true,
        align: "center" as const,
      },
      {
        key: "ZONE",
        label: "Zone",
        width: 110,
        sortable: true,
        align: "center" as const,
        render: (value: string) => (
          <Badge
            variant="outline"
            className={
              value === "Rurale"
                ? "bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/60 dark:border-amber-800 dark:text-amber-300"
                : value === "Urbaine"
                  ? "bg-sky-50 border-sky-200 text-sky-800 dark:bg-sky-950/60 dark:border-sky-800 dark:text-sky-300"
                  : "bg-slate-50 border-slate-200 text-slate-600 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-300"
            }
          >
            {value}
          </Badge>
        ),
      },
      numCol("EFFECTIFS", "Effectifs", 100),
    ];

    // Colonnes dynamiques selon le niveau scolaire
    const detailCols: any[] = [];
    if (niveau === "prescolaire") {
      detailCols.push(
        numCol("EFF_PS", "PS", 70),
        numCol("EFF_MS", "MS", 70),
        numCol("EFF_GS", "GS", 70),
      );
    } else if (niveau === "primaire") {
      detailCols.push(
        numCol("EFF_T1", "T1", 70),
        numCol("EFF_T2", "T2", 70),
        numCol("EFF_T3", "T3", 70),
        numCol("EFF_T4", "T4", 70),
        numCol("EFF_T5", "T5", 70),
        {
          key: "CLASSE_PEDA",
          label: "Classe pédagogique",
          width: 160,
          sortable: true,
          align: "center" as const,
          render: (v: any, row: any) => (
            <div className="flex items-center justify-center gap-1.5">
              <span>{formatNumber(Number(v) || 0)}</span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setVerifRow(row);
                    }}
                    className="text-muted-foreground hover:text-primary transition-colors"
                    aria-label="Vérifier le calcul du groupe pédagogique"
                  >
                    <Info className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Vérifier le calcul</TooltipContent>
              </Tooltip>
            </div>
          ),
        },
      );
    } else if (niveau === "college") {
      detailCols.push(
        {
          key: "NB_SECTION",
          label: "Sections",
          width: 120,
          sortable: true,
          align: "center" as const,
          render: (v: any, row: any) => (
            <div className="flex items-center justify-center gap-1.5">
              <span>{formatNumber(Number(v) || 0)}</span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSectionRow(row);
                    }}
                    className="text-muted-foreground hover:text-primary transition-colors"
                    aria-label="Vérifier le calcul des sections"
                  >
                    <Info className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Vérifier le calcul des sections</TooltipContent>
              </Tooltip>
            </div>
          ),
        },
        numCol("EFF_6E", "6e", 70),
        numCol("EFF_5E", "5e", 70),
        numCol("EFF_4E", "4e", 70),
        numCol("EFF_3E", "3e", 70),
      );
    } else {
      detailCols.push(
        {
          key: "NB_SECTION",
          label: "Sections",
          width: 120,
          sortable: true,
          align: "center" as const,
          render: (v: any, row: any) => (
            <div className="flex items-center justify-center gap-1.5">
              <span>{formatNumber(Number(v) || 0)}</span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSectionRow(row);
                    }}
                    className="text-muted-foreground hover:text-primary transition-colors"
                    aria-label="Vérifier le calcul des sections"
                  >
                    <Info className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Vérifier le calcul des sections</TooltipContent>
              </Tooltip>
            </div>
          ),
        },
        numCol("EFF_2NDE", "2nde", 80),
        numCol("EFF_1RE", "1re", 70),
        numCol("EFF_TLE", "Tle", 70),
      );
    }

    const metricCols: any[] = [
      numCol("REQUIS", "Requis", 100),
      numCol("EXISTANT", "Existant", 100),
      numCol("BESOIN", "Besoin", 100),
      numCol("EXCEDENT", "Excédent", 100),
      {
        key: "COUVERTURE",
        label: "Couverture",
        width: 120,
        sortable: true,
        align: "center" as const,
        render: (value: number) => {
          const cov = Number(value) || 0;
          return (
            <Badge variant="outline" className={cn("font-semibold", getCouvertureColor(cov))}>
              {cov.toFixed(0)}%
            </Badge>
          );
        },
      },
      {
        key: "STATUT",
        label: "Statut",
        width: 130,
        sortable: true,
        align: "center" as const,
        render: (value: string) => (
          <Badge variant="outline" className={cn("font-medium capitalize", getStatutColor(value))}>
            {value}
          </Badge>
        ),
      },
    ];

    return [...baseCols, ...detailCols, ...metricCols];
  }, [zapMap, niveau]);

  const handleExportCategory = (catId: Categorie) => {
    const filtered = filteredData;
    const category = availableCategories.find((item) => item.id === catId);
    if (!category) return;
    const filename = `besoins_${catId}_${niveau}_${getSecteurLabel(selectedSecteur)}_${annee}_${new Date().toISOString().slice(0, 10)}`;
    const rows = filtered.map((row) => {
      const metric = computeRow(row, category, niveau);
      return {
        DREN: row.DREN ?? "",
        CISCO: row.CISCO ?? "",
        ZAP: row.ZAP_LABEL || row.ZAP || row.CODE_ZAP || "",
        Établissement: row.NOM_ETAB ?? "",
        "Code établissement": row.CODE_ETAB ?? "",
        Zone: row.ZONE ?? "",
        Effectifs: row.EFFECTIFS ?? 0,
        Requis: metric.requis,
        Existant: metric.existant,
        Besoin: metric.besoin,
        Excédent: metric.excedent,
        "Couverture (%)": metric.couverture,
        Statut: metric.statut,
        Observation: metric.warning,
      };
    });

    if (exportFormat === "xlsx") {
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, "Besoins");
      XLSX.writeFile(wb, `${filename}.xlsx`);
    } else {
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(rows);
      XLSX.writeFile(wb, `${filename}.csv`, { bookType: "csv" });
    }

    toast.success(`Export ${annee} réussi`);
    setShowExportModal(false);
  };

  return (
    <TooltipProvider>
      <div className="space-y-6 pb-8">
        {/* ===== Header style TDBShell ===== */}
        <div className="sticky top-0 z-30 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 shadow-sm animate-fade-in">
          <div className="mx-auto max-w-none px-4 py-3">
            <div className="flex flex-wrap items-center gap-3">
              {/* Logos */}
              <div className="flex items-center gap-2 shrink-0">
                <img
                  src={logoMen}
                  alt="MEN"
                  className="h-10 w-10 rounded-md object-contain ring-1 ring-border bg-white p-0.5"
                />
                <img
                  src={logoDpe}
                  alt="DPE"
                  className="h-10 w-10 rounded-md object-contain ring-1 ring-border bg-white p-0.5"
                />
              </div>

              {/* Titre */}
              <div className="flex-1 min-w-[220px]">
                <h1 className="text-base sm:text-lg font-bold leading-tight text-foreground">
                  Besoins Scolaires — {meta.label}
                </h1>
                <p className="text-xs text-muted-foreground">
                  Ministère de l'Éducation Nationale · Année scolaire{" "}
                  <strong className="text-foreground">
                    {annee - 1}-{annee}
                  </strong>
                </p>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {(drenLocked || ciscoLocked) && (
                  <Badge
                    variant="outline"
                    className="gap-1 border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400"
                  >
                    <Lock className="h-3 w-3" /> Périmètre restreint
                  </Badge>
                )}
                {lastUpdate && (
                  <Badge variant="outline" className="gap-1 text-xs text-muted-foreground">
                    <RefreshCw className="h-3 w-3" />
                    {lastUpdate.toLocaleTimeString("fr-FR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    • {annee - 1}-{annee}
                  </Badge>
                )}
                <DataActionsBar
                  table={`besoins_${niveau}`}
                  tableLabel={`Besoins ${meta.label}`}
                  onChange={handleFilter}
                />
                {isAdmin && (
                  <Button onClick={() => setShowVerifModal(true)} size="sm" variant="outline">
                    <Calculator className="mr-2 h-4 w-4" /> Vérifier un calcul
                  </Button>
                )}
                <Button onClick={() => setShowExportModal(true)} size="sm" variant="outline">
                  <Download className="mr-2 h-4 w-4" /> Exporter
                </Button>
              </div>
            </div>

            {/* Identification (niveau actif intégré) + légende dynamique */}
            <div className="mt-2 flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t pt-2 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex items-center rounded-md border border-border overflow-hidden shrink-0">
                  {(Object.keys(NIVEAU_META) as Niveau[]).map((n) => {
                    const m = NIVEAU_META[n];
                    const Icon = m.icon;
                    const active = n === niveau;
                    return (
                      <Link
                        key={n}
                        to={`/besoins/${n}`}
                        className={cn(
                          "inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide transition-colors",
                          active
                            ? cn(m.activeBg, m.activeText, "shadow-inner")
                            : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground",
                        )}
                        aria-current={active ? "page" : undefined}
                      >
                        <Icon className="h-3 w-3" /> {m.label}
                      </Link>
                    );
                  })}
                </div>
                <span className="text-foreground">
                  <strong>{activeCat.label}</strong>
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <LegendChip
                  color="bg-emerald-500"
                  label="Couverture correcte"
                  count={stats.correcte}
                  active={stats.status === "correcte"}
                />
                <LegendChip
                  color="bg-amber-500"
                  label="Besoins modérés"
                  count={stats.moderes}
                  active={stats.status === "moderes"}
                />
                <LegendChip
                  color="bg-rose-500"
                  label="Besoins critiques"
                  count={stats.critiques}
                  active={stats.status === "critiques"}
                />
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-3.5 w-3.5 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-[280px] text-xs">
                    Répartition des établissements selon leur taux de couverture : ≥ 80 % correcte ·
                    50–80 % modérés · &lt; 50 % critiques. L'élément mis en avant correspond à la
                    situation globale du périmètre filtré.
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
          </div>
        </div>

        {/* Filters bar */}
        <Card
          className="border-border/60 shadow-sm animate-fade-in overflow-hidden"
          style={{ animationDelay: "60ms" }}
        >
          <div className="flex items-center gap-2 px-5 py-2.5 border-b bg-muted/30">
            <Filter className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">
              Filtres géographiques & Année scolaire
            </h2>
            {/* Badge filtre */}
            <div className="ml-auto">
              <Badge
                variant="outline"
                className="text-[10px] font-normal border-green-500 text-green-600 bg-green-50 dark:bg-green-950 dark:text-green-400 px-3 py-1"
              >
                Année {annee - 1}-{annee}
                {(codeDren !== "0" || codeCisco !== "0" || codeZap !== "0") && (
                  <>
                    {" • "}
                    {codeDren !== "0" && drens.find((d) => String(d.CODE_DREN) === codeDren)?.DREN}
                    {codeCisco !== "0" &&
                      `, ${ciscos.find((c) => String(c.CODE_CISCO) === codeCisco)?.CISCO}`}
                    {codeZap !== "0" &&
                      `, ${zaps.find((z) => String(z.CODE_ZAP) === codeZap)?.ZAP}`}
                    {`, ${getSecteurLabel(selectedSecteur)}`}
                  </>
                )}
              </Badge>
            </div>
          </div>
          <CardContent className="p-4 sm:p-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {/* DREN */}
              <FilterField label="DREN" locked={drenLocked}>
                <Select value={codeDren} onValueChange={handleDrenChange} disabled={drenLocked}>
                  <SelectTrigger className="bg-background h-10">
                    <SelectValue placeholder="Toutes DREN" />
                  </SelectTrigger>
                  <SelectContent side="bottom" position="popper">
                    <SelectItem value="0">Toutes DREN</SelectItem>
                    {drens.map((d) => (
                      <SelectItem key={d.CODE_DREN} value={String(d.CODE_DREN)}>
                        {d.DREN}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FilterField>

              {/* CISCO */}
              <FilterField label="CISCO" locked={ciscoLocked}>
                <Select
                  value={codeCisco}
                  onValueChange={handleCiscoChange}
                  disabled={ciscoLocked || codeDren === "0" || loadingFilters}
                >
                  <SelectTrigger className="bg-background h-10">
                    <SelectValue placeholder="Toutes CISCO" />
                  </SelectTrigger>
                  <SelectContent side="bottom" position="popper">
                    <SelectItem value="0">Toutes CISCO</SelectItem>
                    {ciscos.map((c) => (
                      <SelectItem key={c.CODE_CISCO} value={String(c.CODE_CISCO)}>
                        {c.CISCO}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FilterField>

              {/* ZAP */}
              <FilterField label="ZAP">
                <Select
                  value={codeZap}
                  onValueChange={(v) => {
                    setCodeZap(v);
                    markFilterDirty();
                  }}
                  disabled={codeCisco === "0" || loadingFilters}
                >
                  <SelectTrigger className="bg-background h-10">
                    <SelectValue placeholder="Toutes ZAP" />
                  </SelectTrigger>
                  <SelectContent side="bottom" position="popper">
                    <SelectItem value="0">Toutes ZAP</SelectItem>
                    {zaps.map((z) => (
                      <SelectItem key={z.CODE_ZAP} value={String(z.CODE_ZAP)}>
                        {z.ZAP}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FilterField>

              {/* Secteur */}
              <FilterField label="Secteur">
                <Select
                  value={selectedSecteur}
                  onValueChange={(value) => {
                    setSelectedSecteur(value);
                    markFilterDirty();
                  }}
                >
                  <SelectTrigger className="bg-background h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent side="bottom" position="popper">
                    <SelectItem value="2">Tous</SelectItem>
                    <SelectItem value="0">Public</SelectItem>
                    <SelectItem value="1">Privé</SelectItem>
                  </SelectContent>
                </Select>
              </FilterField>

              {/* Année Scolaire */}
              <FilterField label="Année Scolaire">
                <Select
                  value={String(annee)}
                  onValueChange={(v) => {
                    setAnnee(parseInt(v));
                    markFilterDirty();
                  }}
                >
                  <SelectTrigger className="bg-background h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent side="bottom" position="popper">
                    <SelectItem value="2025">2024-2025</SelectItem>
                    <SelectItem value="2024">2023-2024</SelectItem>
                    <SelectItem value="2023">2022-2023</SelectItem>
                    <SelectItem value="2022">2021-2022</SelectItem>
                  </SelectContent>
                </Select>
              </FilterField>

              {/* Boutons Action */}
              <div className="flex items-end gap-2 lg:col-span-1">
                <div className="flex-1 flex flex-col gap-1">
                  <Button
                    onClick={handleFilter}
                    disabled={loading}
                    className="w-full h-10 shadow-sm"
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Filter className="h-4 w-4 mr-2" />
                    )}
                    Appliquer
                  </Button>
                  {isFilterDirty && !loading && (
                    <p className="text-[10px] text-amber-600 dark:text-amber-400 text-center font-medium">
                      Filtres modifiés — cliquez sur Appliquer
                    </p>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleReset}
                  disabled={loading || drenLocked}
                  className="h-10 w-10"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Catégorie de besoins (Tabs) */}
        <Tabs
          value={categorie}
          onValueChange={(v) => setCategorie(v as Categorie)}
          className="animate-fade-in"
          style={{ animationDelay: "90ms" }}
        >
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 h-auto p-1 bg-muted/50">
            {availableCategories.map((c) => {
              const Icon = c.icon;
              return (
                <TabsTrigger
                  key={c.id}
                  value={c.id}
                  className="data-[state=active]:bg-background data-[state=active]:shadow-sm flex items-center gap-1.5 py-2 text-xs sm:text-sm"
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{c.shortLabel}</span>
                  <span className="sm:hidden">{c.shortLabel.split(" ")[0]}</span>
                </TabsTrigger>
              );
            })}
          </TabsList>
        </Tabs>

        {/* KPI cards (catégorie active) */}
        <div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 animate-fade-in"
          style={{ animationDelay: "120ms" }}
        >
          <StatCard
            icon={CheckCircle2}
            accent="success"
            label="Établissements"
            value={formatNumber(stats.ecoles)}
            hint="Écoles dans le périmètre"
          />
          <StatCard
            icon={activeCat.icon}
            accent="primary"
            label={`Requis (${activeCat.unit})`}
            value={formatNumber(stats.requis)}
            hint="Total nécessaire"
          />
          <StatCard
            icon={Database}
            accent="info"
            label={`Existant (${activeCat.unit})`}
            value={formatNumber(stats.existant)}
            hint="Ressources actuelles"
          />
          <StatCard
            icon={AlertTriangle}
            accent="warning"
            label="Besoin"
            value={formatNumber(stats.besoins)}
            hint={`${activeCat.unit} manquants`}
            progress={stats.requis > 0 ? (stats.besoins / stats.requis) * 100 : 0}
          />
          <StatCard
            icon={TrendingUp}
            accent="info"
            label="Excédent"
            value={formatNumber(stats.excedent)}
            hint={`Taux de couverture : ${stats.couverture.toFixed(1)}%`}
            progress={stats.couverture}
          />
        </div>

        {/* Table card */}
        <Card
          className="border-border/60 shadow-sm overflow-hidden animate-fade-in"
          style={{ animationDelay: "180ms" }}
        >
          <div className="flex items-center justify-between gap-3 px-5 py-3 border-b bg-muted/30">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">
                {activeCat.label} — Détail par établissement
              </h3>
              {filteredData.length > 0 && (
                <Badge variant="secondary" className="font-normal">
                  {formatNumber(filteredData.length)} ligne
                  {filteredData.length > 1 ? "s" : ""}
                </Badge>
              )}
            </div>
            <div className="text-xs text-muted-foreground hidden sm:flex items-center gap-1.5">
              <Layers className="h-3 w-3" /> Triable et exportable
            </div>
          </div>

          <CardContent className="p-0">
            {/* Warning pour Manuels en Collège / Lycée */}
            {activeCat.id === "manuels" && (niveau === "college" || niveau === "lycee") && (
              <div className="mx-5 mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-sm flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 mt-0.5 flex-shrink-0 text-amber-600" />
                <div>
                  <p className="font-medium">Données des manuels existants non disponibles</p>
                  <p className="text-amber-700 mt-1 text-sm">
                    Le calcul du besoin est effectué selon les normes MEN, mais les données
                    d'existant ne sont pas encore intégrées pour le Collège et le Lycée.
                  </p>
                </div>
              </div>
            )}

            {loading ? (
              <div className="flex flex-col items-center justify-center py-24 gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Chargement des données…</p>
              </div>
            ) : filteredData.length === 0 ? (
              <div className="text-center py-24 px-6">
                <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-muted mb-4">
                  <Filter className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-sm font-semibold text-foreground">Aucune donnée à afficher</p>
                <p className="text-xs text-muted-foreground mt-1.5 max-w-sm mx-auto">
                  Ajustez les filtres géographiques ci-dessus puis cliquez sur « Appliquer » pour
                  charger les besoins.
                </p>
              </div>
            ) : (
              <div className="h-[600px]">
                <DataTable
                  data={filteredData}
                  columns={columns}
                  title={`${activeCat.label} — ${meta.label}`}
                  exportFilename={`besoins_${categorie}_${niveau}.csv`}
                  pageSize={10}
                  maxHeight="65vh"
                  stickyFirstColumn
                  stickyHeader
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Explication couverture */}
        <Card className="border-border/60 shadow-sm">
          <CardContent className="p-5">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Info className="h-4 w-4" /> Comprendre les statuts de couverture
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
              <div className="flex items-start gap-3 p-4 rounded-lg border border-emerald-500/30 bg-emerald-500/5">
                <div className="mt-1 h-3 w-3 rounded-full bg-emerald-500 flex-shrink-0" />
                <div>
                  <p className="font-medium text-emerald-700">Correcte — ≥ 80%</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    L'établissement dispose de la quasi-totalité des ressources nécessaires.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-4 rounded-lg border border-amber-500/30 bg-amber-500/5">
                <div className="mt-1 h-3 w-3 rounded-full bg-amber-500 flex-shrink-0" />
                <div>
                  <p className="font-medium text-amber-700">Modéré — 50% à 79%</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Déficit significatif, attention particulière recommandée.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-4 rounded-lg border border-rose-500/30 bg-rose-500/5">
                <div className="mt-1 h-3 w-3 rounded-full bg-rose-500 flex-shrink-0" />
                <div>
                  <p className="font-medium text-rose-700">Critique — &lt; 50%</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Manque important de ressources.
                  </p>
                </div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-4">
              Taux de couverture = (Requis − Besoin) / Requis × 100. Calculé pour chaque catégorie
              selon les normes MEN/DPE.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Modal Export */}
      <Dialog open={showExportModal} onOpenChange={setShowExportModal}>
        <DialogContent className="w-[95vw] sm:w-[560px] md:w-[600px] max-w-[600px] max-h-[90dvh] overflow-hidden flex flex-col p-0">
          <DialogHeader className="border-b px-4 py-3">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div>
                <DialogTitle className="flex items-center gap-2 text-base font-semibold">
                  <Download className="h-5 w-5 text-primary" />
                  Exporter les besoins
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Année scolaire {annee - 1}-{annee}
                </DialogDescription>
              </div>

              {/* Recap Géographique */}
              <div className="text-left sm:text-right text-[11px] leading-tight text-muted-foreground">
                <div>
                  <strong>DREN :</strong>{" "}
                  {codeDren !== "0"
                    ? drens.find((d) => String(d.CODE_DREN) === codeDren)?.DREN || "Toutes"
                    : "Toutes"}
                </div>
                <div>
                  <strong>CISCO :</strong>{" "}
                  {codeCisco !== "0"
                    ? ciscos.find((c) => String(c.CODE_CISCO) === codeCisco)?.CISCO || "Toutes"
                    : "Toutes"}
                </div>
                <div>
                  <strong>ZAP :</strong>{" "}
                  {codeZap !== "0"
                    ? zaps.find((z) => String(z.CODE_ZAP) === codeZap)?.ZAP || "Toutes"
                    : "Toutes"}
                </div>
                <div>
                  <strong>Secteur :</strong> {getSecteurLabel(selectedSecteur)}
                </div>
                <div className="mt-2 pt-1 border-t font-medium text-foreground">
                  {formatNumber(stats.ecoles)} établissements
                </div>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
            {/* Format du fichier */}
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
                Format du fichier
              </label>
              <div className="flex gap-2">
                <Button
                  variant={exportFormat === "xlsx" ? "default" : "outline"}
                  onClick={() => setExportFormat("xlsx")}
                  className="flex-1 h-9 text-xs font-medium"
                >
                  <FileSpreadsheet className="mr-2 h-4 w-4" />
                  Excel (.xlsx)
                </Button>
                <Button
                  variant={exportFormat === "csv" ? "default" : "outline"}
                  onClick={() => setExportFormat("csv")}
                  className="flex-1 h-9 text-xs font-medium"
                >
                  <FileText className="mr-2 h-4 w-4" />
                  CSV (.csv)
                </Button>
              </div>
            </div>

            {/* Catégories à exporter */}
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 block">
                Catégorie à exporter
              </label>
              <div className="space-y-2">
                {availableCategories.map((cat) => {
                  const Icon = cat.icon;
                  return (
                    <div
                      key={cat.id}
                      className="group flex items-center gap-4 p-4 border rounded-2xl hover:border-primary hover:bg-muted/60 transition-all cursor-pointer active:scale-[0.985]"
                      onClick={() => handleExportCategory(cat.id)}
                    >
                      <div className="p-3 bg-primary/10 text-primary rounded-xl group-hover:bg-primary/20 transition-colors">
                        <Icon className="h-6 w-6" />
                      </div>
                      <div className="flex-1">
                        <div className="font-medium group-hover:text-primary transition-colors">
                          {cat.label}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {formatNumber(stats.ecoles)} établissements • {cat.unit}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        className="opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <Download className="mr-2 h-4 w-4" />
                        Exporter
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="border-t p-3 flex justify-end">
            <Button variant="ghost" onClick={() => setShowExportModal(false)}>
              Fermer
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Panneau de vérification du groupe pédagogique (primaire) */}
      <Dialog open={!!verifRow} onOpenChange={(open) => !open && setVerifRow(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Info className="h-5 w-5 text-primary" />
              Vérification du groupe pédagogique
            </DialogTitle>
            <DialogDescription>
              {verifRow?.NOM_ETAB || verifRow?.nom_etab || "Établissement"}
              {verifRow?.CODE_ETAB ? ` — ${verifRow.CODE_ETAB}` : ""}
            </DialogDescription>
          </DialogHeader>

          {verifRow &&
            (() => {
              const exp = explainGroupePeda(verifRow);
              return <GroupePedaTraceContent exp={exp} />;
            })()}

          <div className="border-t pt-3 flex justify-end">
            <Button variant="ghost" onClick={() => setVerifRow(null)}>
              Fermer
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal sections — icône ⓘ collège / lycée */}
      <Dialog open={!!sectionRow} onOpenChange={(open) => !open && setSectionRow(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Info className="h-5 w-5 text-primary" />
              Vérification des sections — {niveau === "college" ? "Collège" : "Lycée"}
            </DialogTitle>
            <DialogDescription>
              {sectionRow?.NOM_ETAB || sectionRow?.nom_etab || "Établissement"}
              {sectionRow?.CODE_ETAB ? ` — ${sectionRow.CODE_ETAB}` : ""}
            </DialogDescription>
          </DialogHeader>
          {sectionRow && (niveau === "college" || niveau === "lycee") && (
            <SectionsTraceContent exp={explainSections(sectionRow, niveau)} />
          )}
          <div className="border-t pt-3 flex justify-end">
            <Button variant="ghost" onClick={() => setSectionRow(null)}>
              Fermer
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Vérifier un calcul — adapté au niveau scolaire */}
      <Dialog open={showVerifModal} onOpenChange={setShowVerifModal}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5 text-primary" />
              {niveau === "college" || niveau === "lycee"
                ? "Vérifier un calcul de sections"
                : "Vérifier un calcul de groupe pédagogique"}
            </DialogTitle>
            <DialogDescription>
              {niveau === "college"
                ? "Recherchez un établissement ou saisissez les effectifs 6e à 3e."
                : niveau === "lycee"
                  ? "Recherchez un établissement ou saisissez les effectifs par filière."
                  : "Recherchez un établissement ou saisissez les effectifs T1 à T5."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 px-1">
            <div className="flex items-end gap-2">
              <div className="flex-1 space-y-1">
                <label className="text-xs font-medium text-muted-foreground">
                  Code établissement
                </label>
                <Input
                  value={verifCodeEtab}
                  onChange={(e) => setVerifCodeEtab(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleVerifRecherche()}
                  placeholder="Ex : 516020001"
                />
              </div>
              <Button onClick={handleVerifRecherche} size="sm" variant="secondary">
                <Search className="mr-2 h-4 w-4" /> Rechercher
              </Button>
            </div>

            {verifNotFound && (
              <div className="text-xs text-rose-600 dark:text-rose-400">
                Aucun établissement trouvé avec ce code (niveau {meta.label}, filtres actuels).
              </div>
            )}
            {!verifNotFound && verifEtabLabel && (
              <div className="text-xs text-muted-foreground">
                Établissement trouvé :{" "}
                <span className="font-medium text-foreground">{verifEtabLabel}</span>
              </div>
            )}

            {(niveau === "primaire" || niveau === "prescolaire") && (
              <div className="grid grid-cols-5 gap-2">
                {[
                  ["T1", verifT1, setVerifT1],
                  ["T2", verifT2, setVerifT2],
                  ["T3", verifT3, setVerifT3],
                  ["T4", verifT4, setVerifT4],
                  ["T5", verifT5, setVerifT5],
                ].map(([label, value, setValue]) => (
                  <div key={label as string} className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">
                      {label as string}
                    </label>
                    <Input
                      type="number"
                      min={0}
                      value={value as string}
                      onChange={(e) => (setValue as (v: string) => void)(e.target.value)}
                      className="text-center"
                    />
                  </div>
                ))}
              </div>
            )}

            {niveau === "college" && (
              <div className="grid grid-cols-4 gap-2">
                {[
                  ["6e", verif6e, setVerif6e],
                  ["5e", verif5e, setVerif5e],
                  ["4e", verif4e, setVerif4e],
                  ["3e", verif3e, setVerif3e],
                ].map(([label, value, setValue]) => (
                  <div key={label as string} className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">
                      {label as string}
                    </label>
                    <Input
                      type="number"
                      min={0}
                      value={value as string}
                      onChange={(e) => (setValue as (v: string) => void)(e.target.value)}
                      className="text-center"
                    />
                  </div>
                ))}
              </div>
            )}

            {niveau === "lycee" && (
              <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                {[
                  ["2nde", verif2nde, setVerif2nde],
                  ["1L", verif1l, setVerif1l],
                  ["1S", verif1s, setVerif1s],
                  ["1OSE", verif1ose, setVerif1ose],
                  ["TL", verifTl, setVerifTl],
                  ["TS", verifTs, setVerifTs],
                  ["TOSE", verifTose, setVerifTose],
                ].map(([label, value, setValue]) => (
                  <div key={label as string} className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">
                      {label as string}
                    </label>
                    <Input
                      type="number"
                      min={0}
                      value={value as string}
                      onChange={(e) => (setValue as (v: string) => void)(e.target.value)}
                      className="text-center"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {(niveau === "primaire" || niveau === "prescolaire") && (
            <GroupePedaTraceContent exp={verifTrace} />
          )}
          {(niveau === "college" || niveau === "lycee") && (
            <SectionsTraceContent exp={verifSectionsTrace} />
          )}

          <div className="border-t pt-3 flex justify-end">
            <Button variant="ghost" onClick={() => setShowVerifModal(false)}>
              Fermer
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
};

/* ───────── Sub-components ───────── */

const LegendChip = ({
  color,
  label,
  count,
  active,
}: {
  color: string;
  label: string;
  count: number;
  active: boolean;
}) => (
  <span
    className={cn(
      "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 transition-colors",
      active
        ? "border-foreground/20 bg-muted text-foreground font-medium shadow-sm"
        : "border-transparent text-muted-foreground",
    )}
    title={`${count} établissement${count > 1 ? "s" : ""}`}
  >
    <span className={cn("inline-block h-2.5 w-2.5 rounded-full ring-1 ring-border", color)} />
    {label}
    <span
      className={cn(
        "tabular-nums text-[10px] rounded px-1 ml-0.5",
        active ? "bg-background text-foreground" : "bg-muted/60 text-muted-foreground",
      )}
    >
      {new Intl.NumberFormat("fr-FR").format(count)}
    </span>
  </span>
);

const FilterField = ({
  label,
  locked,
  children,
}: {
  label: string;
  locked?: boolean;
  children: React.ReactNode;
}) => (
  <div className="space-y-1.5">
    <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
      {label}
      {locked && <Lock className="h-3 w-3 text-amber-600" />}
    </label>
    {children}
  </div>
);

type Accent = "success" | "primary" | "warning" | "info";

const StatCard = ({
  icon: Icon,
  accent,
  label,
  value,
  hint,
  progress,
}: {
  icon: any;
  accent: Accent;
  label: string;
  value: string;
  hint?: string;
  progress?: number;
}) => {
  const styles: Record<Accent, { ring: string; iconBg: string; iconColor: string; bar: string }> = {
    success: {
      ring: "ring-emerald-500/30 border-emerald-500/20",
      iconBg: "bg-emerald-500/10",
      iconColor: "text-emerald-600 dark:text-emerald-400",
      bar: "bg-emerald-500",
    },
    primary: {
      ring: "ring-primary/30 border-primary/20",
      iconBg: "bg-primary/10",
      iconColor: "text-primary",
      bar: "bg-primary",
    },
    warning: {
      ring: "ring-amber-500/30 border-amber-500/20",
      iconBg: "bg-amber-500/10",
      iconColor: "text-amber-600 dark:text-amber-400",
      bar: "bg-amber-500",
    },
    info: {
      ring: "ring-blue-500/30 border-blue-500/20",
      iconBg: "bg-blue-500/10",
      iconColor: "text-blue-600 dark:text-blue-400",
      bar: "bg-blue-500",
    },
  };

  const s = styles[accent];

  return (
    <Card
      className={cn(
        "group relative overflow-hidden shadow-sm hover:shadow-md transition-all h-full flex flex-col border-2",
        s.ring,
      )}
    >
      {/* Header */}
      <div className="px-4 pt-4 pb-2 border-b border-border/40">
        <p className="text-[11px] uppercase tracking-[0.18em] font-semibold text-muted-foreground text-center">
          {label}
        </p>
      </div>

      {/* Body - Centré */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-5 bg-gradient-to-b from-transparent to-muted/10">
        <div className="h-14 flex items-center justify-center">
          <div
            className={cn(
              "w-12 h-12 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110",
              s.iconBg,
            )}
          >
            <Icon className={cn("w-6 h-6", s.iconColor)} />
          </div>
        </div>

        <div className="h-14 flex items-center justify-center">
          <p className="text-[2.1rem] font-bold tracking-tight leading-none tabular-nums text-foreground">
            {value}
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 pt-3 pb-4 border-t border-border/30 text-center">
        <div className="min-h-[36px] flex items-center justify-center">
          {hint && (
            <p className="text-xs text-muted-foreground text-center leading-relaxed">{hint}</p>
          )}
        </div>

        {typeof progress === "number" && (
          <div className="mt-3 h-1 w-full bg-muted rounded-full overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-all duration-700", s.bar)}
              style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
            />
          </div>
        )}
      </div>
    </Card>
  );
};

export default Besoins;
