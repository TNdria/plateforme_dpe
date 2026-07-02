import { useEffect, useMemo, useState, useCallback } from "react";
import { Link, useParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Loader2, Filter, Building2, CheckCircle2, Lock, AlertTriangle,
  TrendingUp, Layers, GraduationCap, School, BookOpen, RefreshCw,
  Database, Info, Users, Armchair, Library,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { besoinsApi, type Dren, type Cisco, type Zap } from "@/services/api";
import { notify } from "@/contexts/NotificationsContext";
import { toast } from "sonner";
import DataTable from "@/components/donnees/DataTable";
import { useAuth } from "@/contexts/AuthContext";
import DataActionsBar from "@/components/admin/DataActionsBar";
import { cn } from "@/lib/utils";
import logoMen from "@/assets/logoMen.jpg";
import logoDpe from "@/assets/logoDpe.jpg";

type Niveau = "primaire" | "college" | "lycee";
type Categorie = "salles" | "enseignants" | "tb" | "manuels";

const NIVEAU_META: Record<Niveau, {
  label: string; icon: any;
  badgeBg: string; badgeText: string;
  activeBg: string; activeText: string; ring: string;
}> = {
  primaire: { label: "Primaire", icon: BookOpen, badgeBg: "bg-emerald-600", badgeText: "text-white", activeBg: "bg-emerald-600", activeText: "text-white", ring: "ring-emerald-500/30" },
  college:  { label: "Collège",  icon: School,   badgeBg: "bg-blue-600",    badgeText: "text-white", activeBg: "bg-blue-600",    activeText: "text-white", ring: "ring-blue-500/30" },
  lycee:    { label: "Lycée",    icon: GraduationCap, badgeBg: "bg-violet-600", badgeText: "text-white", activeBg: "bg-violet-600", activeText: "text-white", ring: "ring-violet-500/30" },
};

// Ratios standards MEN Madagascar (fallback si effectifs détaillés indisponibles)
const RATIOS: Record<Niveau, { elevesParEns: number; elevesParTB: number; manuelsParEleve: number }> = {
  primaire: { elevesParEns: 40, elevesParTB: 2, manuelsParEleve: 5 },
  college:  { elevesParEns: 35, elevesParTB: 2, manuelsParEleve: 7 },
  lycee:    { elevesParEns: 30, elevesParTB: 2, manuelsParEleve: 9 },
};

// Normes élèves par salle de classe (doc MEN "MODE DE CALCUL BESOINS SDC")
const NORME_ELEVE_SDC: Record<Niveau, number> = {
  primaire: 50,
  college: 50,
  lycee: 50,
};

// Détection zone rurale (rural = commune de type rural)
const isRural = (row: any): boolean => {
  const cat = String(row?.CATEGORIE_COMMUNE ?? row?.categorie_commune ?? row?.MILIEU ?? '')
    .toLowerCase()
    .trim();
  return cat.startsWith('rural') || cat === 'r';
};

// Récupère le nombre de groupes pédagogiques (primaire)
const getGroupePeda = (row: any): number =>
  pickNumRaw(row, ['GRP_PED', 'GROUPE_PED', 'GROUPES', 'NB_GRP_PED', 'GRP_PEDA', 'GROUPE_PEDAGOGIQUE']) ?? 0;

// Récupère le nombre de sections (collège / lycée)
const getNbSection = (row: any): number =>
  pickNumRaw(row, ['NB_SECTION', 'SECTIONS', 'NB_SECTIONS', 'SECTION']) ?? 0;

type CategorieDef = {
  id: Categorie; label: string; shortLabel: string; icon: any; unit: string;
  requisKeys: string[]; existantKeys: string[]; besoinKeys: string[]; excedentKeys: string[];
  computeRequis?: (eff: number, niveau: Niveau, row?: any) => number;
};

// ============================================================================
//  Calcul des classes pédagogiques / sections (selon doc MEN — juin 2025)
// ============================================================================

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

// --- PRIMAIRE : tests T1-T2, T3, T1-T2-T3, T4-T5 ---
const computeRequisPrimaire = (row: any, effTotal: number): number => {
  const t1 = pickNumRaw(row, ["EFF_T1", "eff_t1"]);
  const t2 = pickNumRaw(row, ["EFF_T2", "eff_t2"]);
  const t3 = pickNumRaw(row, ["EFF_T3", "eff_t3"]);
  const t4 = pickNumRaw(row, ["EFF_T4", "eff_t4"]);
  const t5 = pickNumRaw(row, ["EFF_T5", "eff_t5"]);
  if ([t1, t2, t3, t4, t5].some((v) => v == null)) {
    // fallback ratio si effectifs détaillés absents
    return Math.ceil((effTotal || 0) / RATIOS.primaire.elevesParEns);
  }
  const NORMAL = 50, RESTE_INTEG = 10, MULTI_MAX = 50;
  const classesPourGroupe = (a: number, b: number): number => {
    const cA = Math.floor(a / NORMAL), cB = Math.floor(b / NORMAL);
    const rA = a % NORMAL, rB = b % NORMAL;
    let extra = 0;
    if (rA <= RESTE_INTEG && rB <= RESTE_INTEG) extra = 0;
    else if (rA + rB < MULTI_MAX) extra = 1; // 1 classe multigrade
    else extra = 2;
    return cA + cB + extra;
  };
  // Test 3 : si T1+T2+T3 ≤ 50 → 1 seule multigrade pour T1-T3
  const sumT123 = (t1 || 0) + (t2 || 0) + (t3 || 0);
  let classesT1T3: number;
  if (sumT123 > 0 && sumT123 <= 50) {
    classesT1T3 = 1;
  } else {
    // T1-T2
    const cT12 = classesPourGroupe(t1 || 0, t2 || 0);
    // T3 seul
    const cT3base = Math.floor((t3 || 0) / NORMAL);
    const rT3 = (t3 || 0) % NORMAL;
    const cT3 = cT3base + (rT3 > RESTE_INTEG ? 1 : 0);
    classesT1T3 = cT12 + cT3;
  }
  // T4-T5
  const cT45 = classesPourGroupe(t4 || 0, t5 || 0);
  return classesT1T3 + cT45;
};

// --- COLLÈGE : sections T6..T9 puis Σ horaires / 22 ---
const computeRequisCollege = (row: any, effTotal: number): number => {
  const t6 = pickNumRaw(row, ["EFF_T6", "eff_t6", "EFF_6E"]);
  const t7 = pickNumRaw(row, ["EFF_T7", "eff_t7", "EFF_5E"]);
  const t8 = pickNumRaw(row, ["EFF_T8", "eff_t8", "EFF_4E"]);
  const t9 = pickNumRaw(row, ["EFF_T9", "eff_t9", "EFF_3E"]);
  const effs = [t6, t7, t8, t9];
  if (effs.some((v) => v == null)) {
    return Math.ceil((effTotal || 0) / RATIOS.college.elevesParEns);
  }
  const MIN = 40, NORMAL = 50, VOL = 22, HOR_TOTAL = 16 + 14 + 2; // sci+litt+EPS
  const total = effs.reduce<number>((s, v) => s + (v || 0), 0);
  const section = (eff: number): number => {
    if (eff <= 0) return 0;
    if (total < 160 && eff < MIN) return 1;
    const base = Math.floor(eff / NORMAL);
    const reste = eff % NORMAL;
    return reste >= MIN ? base + 1 : Math.max(base, eff >= MIN ? 1 : 0);
  };
  const totSect = effs.reduce<number>((s, v) => s + section(v || 0), 0);
  return Math.ceil((HOR_TOTAL * totSect) / VOL);
};

// --- LYCÉE : sections par classe puis Σ (horaire_eleves * section) / 20 ---
const LYCEE_CLASSES: Array<{ keys: string[]; horaire: number }> = [
  { keys: ["EFF_2NDE", "EFF_2ND", "eff_2nde"], horaire: 31 },
  { keys: ["EFF_1ERE_A", "eff_1ere_a"], horaire: 26 },
  { keys: ["EFF_1ERE_L", "eff_1ere_l"], horaire: 30 },
  { keys: ["EFF_1ERE_C", "eff_1ere_c"], horaire: 32 },
  { keys: ["EFF_1ERE_D", "EFF_1D", "eff_1ere_d"], horaire: 33 },
  { keys: ["EFF_1ERE_S", "EFF_1S", "eff_1ere_s"], horaire: 30 },
  { keys: ["EFF_1ERE_OSE", "EFF_1OSE", "eff_1ere_ose"], horaire: 30 },
  { keys: ["EFF_TLE_A", "EFF_TA", "eff_tle_a"], horaire: 32 },
  { keys: ["EFF_TLE_L", "EFF_TL", "eff_tle_l"], horaire: 30 },
  { keys: ["EFF_TLE_C", "EFF_TC", "eff_tle_c"], horaire: 39 },
  { keys: ["EFF_TLE_D", "EFF_TD", "eff_tle_d"], horaire: 37 },
  { keys: ["EFF_TLE_S", "EFF_TS", "eff_tle_s"], horaire: 30 },
  { keys: ["EFF_TLE_OSE", "EFF_TOSE", "eff_tle_ose"], horaire: 30 },
];

const computeRequisLycee = (row: any, effTotal: number): number => {
  const MIN = 30, NORMAL = 50, VOL = 20;
  let found = false;
  let sumHours = 0;
  for (const cls of LYCEE_CLASSES) {
    const eff = pickNumRaw(row, cls.keys);
    if (eff == null) continue;
    found = true;
    let sect = 0;
    if (eff >= NORMAL) {
      const base = Math.floor(eff / NORMAL);
      const reste = eff % NORMAL;
      sect = reste >= MIN ? base + 1 : base;
    } else if (eff >= MIN) {
      sect = 1;
    }
    sumHours += cls.horaire * sect;
  }
  if (!found) {
    return Math.ceil((effTotal || 0) / RATIOS.lycee.elevesParEns);
  }
  return Math.ceil(sumHours / VOL);
};

const CATEGORIES: CategorieDef[] = [
  {
    id: "salles", label: "Besoins en salles de classe", shortLabel: "Salles de classe",
    icon: Building2, unit: "salles",
    requisKeys: ["SDC_REQUIS", "REQUIS", "REQUIS_TOTAL"],
    existantKeys: ["SDC_BE", "SDC_EXISTANT", "NB_SDC", "EXISTANT", "EXISTANT_TOTAL"],
    besoinKeys: ["BESOIN_SDC", "BESOIN", "BESOINS_TOTAL", "BESOIN_TOTAL"],
    excedentKeys: ["EXCEDENT_SDC", "EXCEDENT", "EXCEDENT_TOTAL"],
    // Doc MEN: Primaire → rural: requis=groupe_péda; sinon: ceil(groupe_péda/2)
    //          Collège/Lycée → requis = nombre de sections
    computeRequis: (eff, niv, row) => {
      if (niv === "primaire") {
        const grp = getGroupePeda(row);
        if (grp <= 0) return Math.ceil((eff || 0) / NORME_ELEVE_SDC.primaire);
        return isRural(row) ? grp : Math.ceil(grp / 2);
      }
      const sec = getNbSection(row);
      if (sec > 0) return sec;
      return Math.ceil((eff || 0) / NORME_ELEVE_SDC[niv]);
    },
  },
  {
    id: "enseignants", label: "Besoins en enseignants", shortLabel: "Enseignants",
    icon: Users, unit: "enseignants",
    requisKeys: ["ENS_REQUIS", "REQUIS_ENS"],
    existantKeys: ["ENS_EXISTANT", "ENSEIGNANTS", "TOTAL_ENS", "EXISTANT_ENS"],
    besoinKeys: ["BESOIN_ENS", "ENS_BESOIN"],
    excedentKeys: ["EXCEDENT_ENS", "ENS_EXCEDENT"],
    computeRequis: (eff, niv, row) =>
      niv === "primaire" ? computeRequisPrimaire(row, eff)
      : niv === "college" ? computeRequisCollege(row, eff)
      : computeRequisLycee(row, eff),
  },
  {
    id: "tb", label: "Besoins en tables-bancs (places assises)", shortLabel: "Tables-bancs",
    icon: Armchair, unit: "places",
    requisKeys: ["TB_REQUIS", "REQUIS_TB", "PLACE_REQUIS"],
    existantKeys: ["TB_EXISTANT", "PLACES", "TABLES_BANCS", "TOTAL_TB", "NB_PLACES"],
    besoinKeys: ["BESOIN_TB", "TB_BESOIN", "BESOIN_PLACE"],
    excedentKeys: ["EXCEDENT_TB", "TB_EXCEDENT"],
    // Doc MEN: Primaire → rural: requis=effectif; sinon: requis_sdc * 50
    //          Collège/Lycée → requis = effectif total
    computeRequis: (eff, niv, row) => {
      if (niv === "primaire") {
        if (isRural(row)) return eff || 0;
        const grp = getGroupePeda(row);
        const requisSdc = grp > 0 ? Math.ceil(grp / 2) : Math.ceil((eff || 0) / NORME_ELEVE_SDC.primaire);
        return requisSdc * NORME_ELEVE_SDC.primaire;
      }
      return eff || 0;
    },
  },
  {
    id: "manuels", label: "Besoins en manuels", shortLabel: "Manuels",
    icon: Library, unit: "manuels",
    requisKeys: ["MANUEL_REQUIS", "REQUIS_MANUEL"],
    existantKeys: ["MANUEL_EXISTANT", "MANUELS", "TOTAL_MANUELS", "EXISTANT_MANUEL"],
    besoinKeys: ["BESOIN_MANUEL", "MANUEL_BESOIN"],
    excedentKeys: ["EXCEDENT_MANUEL", "MANUEL_EXCEDENT"],
    // Doc MEN: Primaire → 1 livre pour 2 élèves → requis = effectif / 2
    //          Collège/Lycée → ratio par élève (non spécifié dans doc SDC/BANC)
    computeRequis: (eff, niv) => {
      if (niv === "primaire") return Math.ceil((eff || 0) / 2);
      return (eff || 0) * RATIOS[niv].manuelsParEleve;
    },
  },
];

const pickNum = (row: any, keys: string[]): number | null => pickNumRaw(row, keys);

const getEffectifs = (row: any): number =>
  pickNum(row, ["EFFECTIFS", "EFFECTIFS_TOTAL", "EFFECTIF"]) ?? 0;

const computeRow = (row: any, cat: CategorieDef, niveau: Niveau) => {
  const eff = getEffectifs(row);

  // 1) Valeurs fournies directement par le backend (REQUIS / BESOIN / EXCEDENT ...).
  const apiRequis = pickNum(row, cat.requisKeys);
  const apiExistant = pickNum(row, cat.existantKeys);
  const apiBesoin = pickNum(row, cat.besoinKeys);
  const apiExcedent = pickNum(row, cat.excedentKeys);

  // 2) Fallback : formule MEN sur effectifs bruts si disponibles.
  const computedRequis = cat.computeRequis ? cat.computeRequis(eff, niveau, row) : 0;

  const requis = apiRequis != null ? apiRequis : computedRequis;

  // Existant : si l'API le donne, on l'utilise ; sinon on le dérive de requis/besoin/excédent
  // (existant = requis - besoin + excédent).
  let existant: number;
  if (apiExistant != null) {
    existant = apiExistant;
  } else if (apiBesoin != null || apiExcedent != null) {
    existant = Math.max(0, requis - (apiBesoin ?? 0) + (apiExcedent ?? 0));
  } else {
    existant = 0;
  }

  const besoin = apiBesoin != null ? apiBesoin : Math.max(0, requis - existant);
  const excedent = apiExcedent != null ? apiExcedent : Math.max(0, existant - requis);

  return { requis, existant, besoin, excedent };
};


const formatNumber = (n: number) =>
  new Intl.NumberFormat("fr-FR").format(Math.round(n || 0));

const besoinsCache = new Map<string, any[]>();

const Besoins = () => {
  const { niveau: niveauParam } = useParams<{ niveau: Niveau }>();
  const niveau: Niveau = (["primaire", "college", "lycee"].includes(niveauParam || "")
    ? niveauParam
    : "primaire") as Niveau;
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
  const [codeDren, setCodeDren] = useState<string>(drenLocked ? String(userDren) : "0");
  const [codeCisco, setCodeCisco] = useState<string>(ciscoLocked ? String(userCisco) : "0");
  const [codeZap, setCodeZap] = useState<string>("0");
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingFilters, setLoadingFilters] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [categorie, setCategorie] = useState<Categorie>("salles");
  const activeCat = useMemo(() => CATEGORIES.find((c) => c.id === categorie)!, [categorie]);

  const fetchData = useCallback(async (cd: number, cc: number, cz: number, opts: { silent?: boolean } = {}) => {
    const cacheKey = `${niveau}:${cd}:${cc}:${cz}`;
    if (besoinsCache.has(cacheKey)) {
      const cached = besoinsCache.get(cacheKey)!;
      setData(cached);
      setLastUpdate(new Date());
      return cached;
    }
    setLoading(true);
    try {
      const fn =
        niveau === "primaire" ? besoinsApi.getBesoinsPrimaire
        : niveau === "college" ? besoinsApi.getBesoinsCollege
        : besoinsApi.getBesoinsLycee;
      const res = await fn(cd, cc, cz);
      const arr = Array.isArray(res) ? res : [];
      besoinsCache.set(cacheKey, arr);
      setData(arr);
      setLastUpdate(new Date());
      if (!opts.silent && arr.length > 0) {
        notify({
          title: `Besoins ${meta.label} mis à jour`,
          message: `${formatNumber(arr.length)} établissements analysés.`,
          type: "success",
          silent: true, // already visible in UI; just append to bell
        });
      }
      return arr;
    } catch (e) {
      console.error(e);
      notify({
        title: "Erreur de chargement",
        message: `Impossible de récupérer les besoins ${meta.label}.`,
        type: "error",
      });
      setData([]);
      return [];
    } finally {
      setLoading(false);
    }
  }, [niveau, meta.label]);

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

      if (drenLocked) {
        try {
          const c = await besoinsApi.getCiscos(userDren);
          if (!cancelled) setCiscos(c || []);
        } catch { /* noop */ }
      } else {
        setCiscos([]);
      }
      await fetchData(initialDren, initialCisco, 0, { silent: true });
    })();
    return () => { cancelled = true; };
  }, [niveau, drenLocked, ciscoLocked, userDren, userCisco, fetchData]);

  const handleDrenChange = async (value: string) => {
    if (drenLocked) return;
    setCodeDren(value);
    setCodeCisco(ciscoLocked ? String(userCisco) : "0");
    setCodeZap("0");
    setCiscos([]);
    setZaps([]);
    if (value === "0") return;
    setLoadingFilters(true);
    try {
      const c = await besoinsApi.getCiscos(parseInt(value));
      setCiscos(c || []);
    } catch {
      toast.error("Erreur chargement CISCO");
    } finally {
      setLoadingFilters(false);
    }
  };

  const handleCiscoChange = async (value: string) => {
    if (ciscoLocked) return;
    setCodeCisco(value);
    setCodeZap("0");
    setZaps([]);
    if (value === "0") return;
    setLoadingFilters(true);
    try {
      const z = await besoinsApi.getZaps(parseInt(codeDren), parseInt(value));
      setZaps(z || []);
    } catch {
      toast.error("Erreur chargement ZAP");
    } finally {
      setLoadingFilters(false);
    }
  };

  const handleFilter = () => {
    fetchData(parseInt(codeDren), parseInt(codeCisco), parseInt(codeZap));
  };

  const handleReset = () => {
    if (drenLocked) return;
    setCodeDren("0"); setCodeCisco("0"); setCodeZap("0");
    setCiscos([]); setZaps([]);
    fetchData(0, 0, 0);
  };

  // Enriched rows: compute requis/existant/besoin/excedent for active category
  const enrichedData = useMemo(() => {
    return data.map((row) => {
      const c = computeRow(row, activeCat, niveau);
      return {
        ...row,
        REQUIS: c.requis,
        EXISTANT: c.existant,
        BESOIN: c.besoin,
        EXCEDENT: c.excedent,
      };
    });
  }, [data, activeCat, niveau]);

  const stats = useMemo(() => {
    const ecoles = new Set(data.map((e) => e.CODE_ETAB)).size;
    let requis = 0, existant = 0, besoins = 0, excedent = 0;
    let correcte = 0, moderes = 0, critiques = 0;
    for (const row of data) {
      const c = computeRow(row, activeCat, niveau);
      requis += c.requis; existant += c.existant; besoins += c.besoin; excedent += c.excedent;
      if (c.requis <= 0) { correcte++; continue; }
      const cov = ((c.requis - c.besoin) / c.requis) * 100;
      if (cov >= 80) correcte++;
      else if (cov >= 50) moderes++;
      else critiques++;
    }
    const couverture = requis > 0 ? Math.max(0, Math.min(100, ((requis - besoins) / requis) * 100)) : 0;
    const status: "correcte" | "moderes" | "critiques" =
      couverture >= 80 ? "correcte" : couverture >= 50 ? "moderes" : "critiques";
    return { ecoles, requis, existant, besoins, excedent, couverture, correcte, moderes, critiques, status };
  }, [data, activeCat, niveau]);

  const columns = useMemo(() => {
    const base = [
      { key: "DREN", label: "DREN", width: 140, sortable: true, align: "left" as const },
      { key: "CISCO", label: "CISCO", width: 140, sortable: true, align: "left" as const },
      { key: "ZAP", label: "ZAP", width: 160, sortable: true, align: "left" as const },
      { key: "NOM_ETAB", label: "Nom Établissement", width: 260, sortable: true, align: "left" as const },
      { key: "CODE_ETAB", label: "Code", width: 110, sortable: true, align: "left" as const },
      {
        key: "EFFECTIFS", label: "Effectifs", width: 110, sortable: true, align: "center" as const,
        render: (v: any) => formatNumber(Number(v) || 0),
      },
      {
        key: "REQUIS", label: "Requis", width: 110, sortable: true, align: "center" as const,
        render: (v: any) => formatNumber(Number(v) || 0),
      },
      {
        key: "EXISTANT", label: "Existant", width: 110, sortable: true, align: "center" as const,
        render: (v: any) => formatNumber(Number(v) || 0),
      },
      {
        key: "BESOIN", label: "Besoin", width: 110, sortable: true, align: "center" as const,
        render: (v: any) => formatNumber(Number(v) || 0),
      },
      {
        key: "EXCEDENT", label: "Excédent", width: 110, sortable: true, align: "center" as const,
        render: (v: any) => formatNumber(Number(v) || 0),
      },
    ];
    return base;
  }, [activeCat]);

  return (
    <TooltipProvider>
      <div className="space-y-6 pb-8">
        {/* ===== Header style TDBShell ===== */}
        <div className="sticky top-0 z-30 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 shadow-sm animate-fade-in">
          <div className="mx-auto max-w-none px-4 py-3">
            <div className="flex flex-wrap items-center gap-3">
              {/* Logos */}
              <div className="flex items-center gap-2 shrink-0">
                <img src={logoMen} alt="MEN" className="h-10 w-10 rounded-md object-contain ring-1 ring-border bg-white p-0.5" />
                <img src={logoDpe} alt="DPE" className="h-10 w-10 rounded-md object-contain ring-1 ring-border bg-white p-0.5" />
              </div>

              {/* Titre */}
              <div className="flex-1 min-w-[220px]">
                <h1 className="text-base sm:text-lg font-bold leading-tight text-foreground">
                  Besoins en infrastructures — {meta.label}
                </h1>
                <p className="text-xs text-muted-foreground">
                  Ministère de l'Éducation Nationale · Année scolaire <strong className="text-foreground">2024-2025</strong>
                </p>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {(drenLocked || ciscoLocked) && (
                  <Badge variant="outline" className="gap-1 border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400">
                    <Lock className="h-3 w-3" /> Périmètre restreint
                  </Badge>
                )}
                {lastUpdate && (
                  <Badge variant="outline" className="gap-1 text-xs text-muted-foreground">
                    <RefreshCw className="h-3 w-3" />
                    {lastUpdate.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                  </Badge>
                )}
                <DataActionsBar
                  table={`besoins_${niveau}`}
                  tableLabel={`Besoins ${meta.label}`}
                  onChange={handleFilter}
                />
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
                            : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
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
                <LegendChip color="bg-emerald-500" label="Couverture correcte" count={stats.correcte} active={stats.status === "correcte"} />
                <LegendChip color="bg-amber-500" label="Besoins modérés" count={stats.moderes} active={stats.status === "moderes"} />
                <LegendChip color="bg-rose-500" label="Besoins critiques" count={stats.critiques} active={stats.status === "critiques"} />
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-3.5 w-3.5 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-[280px] text-xs">
                    Répartition des établissements selon leur taux de couverture :
                    ≥ 80 % correcte · 50–80 % modérés · &lt; 50 % critiques.
                    L'élément mis en avant correspond à la situation globale du périmètre filtré.
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
          </div>
        </div>

        {/* Filters bar */}
        <Card className="border-border/60 shadow-sm animate-fade-in overflow-hidden" style={{ animationDelay: "60ms" }}>
          <div className="flex items-center gap-2 px-5 py-2.5 border-b bg-muted/30">
            <Filter className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Filtres géographiques</h2>
            {(codeDren !== "0" || codeCisco !== "0" || codeZap !== "0") && (
              <Badge variant="secondary" className="ml-1 font-normal text-[10px] h-5">
                Filtres actifs
              </Badge>
            )}
          </div>
          <CardContent className="p-4 sm:p-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <FilterField label="DREN" locked={drenLocked}>
                <Select value={codeDren} onValueChange={handleDrenChange} disabled={drenLocked}>
                  <SelectTrigger className="bg-background h-10"><SelectValue placeholder="Toutes DREN" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Toutes DREN</SelectItem>
                    {drens.map((d) => (
                      <SelectItem key={d.CODE_DREN} value={String(d.CODE_DREN)}>{d.DREN}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FilterField>

              <FilterField label="CISCO" locked={ciscoLocked}>
                <Select
                  value={codeCisco} onValueChange={handleCiscoChange}
                  disabled={ciscoLocked || codeDren === "0" || loadingFilters}
                >
                  <SelectTrigger className="bg-background h-10"><SelectValue placeholder="Toutes CISCO" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Toutes CISCO</SelectItem>
                    {ciscos.map((c) => (
                      <SelectItem key={c.CODE_CISCO} value={String(c.CODE_CISCO)}>{c.CISCO}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FilterField>

              <FilterField label="ZAP">
                <Select value={codeZap} onValueChange={setCodeZap} disabled={codeCisco === "0" || loadingFilters}>
                  <SelectTrigger className="bg-background h-10"><SelectValue placeholder="Toutes ZAP" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Toutes ZAP</SelectItem>
                    {zaps.map((z) => (
                      <SelectItem key={z.CODE_ZAP} value={String(z.CODE_ZAP)}>{z.ZAP}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FilterField>

              <div className="flex items-end gap-2">
                <Button onClick={handleFilter} disabled={loading} className="flex-1 h-10 shadow-sm">
                  {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Filter className="h-4 w-4 mr-2" />}
                  Appliquer
                </Button>
                <Button
                  variant="outline" size="icon"
                  onClick={handleReset} disabled={loading || drenLocked}
                  title="Réinitialiser" className="h-10 w-10 shrink-0"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Catégorie de besoins (Tabs) */}
        <Tabs value={categorie} onValueChange={(v) => setCategorie(v as Categorie)} className="animate-fade-in" style={{ animationDelay: "90ms" }}>
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 h-auto p-1 bg-muted/50">
            {CATEGORIES.map((c) => {
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 animate-fade-in" style={{ animationDelay: "120ms" }}>
          <StatCard
            icon={CheckCircle2} accent="success"
            label="Établissements" value={formatNumber(stats.ecoles)}
            hint="Écoles dans le périmètre"
          />
          <StatCard
            icon={activeCat.icon} accent="primary"
            label={`Requis (${activeCat.unit})`} value={formatNumber(stats.requis)}
            hint="Total nécessaire"
          />
          <StatCard
            icon={Database} accent="info"
            label={`Existant (${activeCat.unit})`} value={formatNumber(stats.existant)}
            hint="Ressources actuelles"
          />
          <StatCard
            icon={AlertTriangle} accent="warning"
            label="Besoin" value={formatNumber(stats.besoins)}
            hint={`${activeCat.unit} manquants`}
            progress={stats.requis > 0 ? (stats.besoins / stats.requis) * 100 : 0}
          />
          <StatCard
            icon={TrendingUp} accent="info"
            label="Excédent" value={formatNumber(stats.excedent)}
            hint={`Taux de couverture : ${stats.couverture.toFixed(1)}%`}
            progress={stats.couverture}
          />
        </div>

      {/* Table card */}
      <Card className="border-border/60 shadow-sm overflow-hidden animate-fade-in" style={{ animationDelay: "180ms" }}>
        <div className="flex items-center justify-between gap-3 px-5 py-3 border-b bg-muted/30">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">
              {activeCat.label} — Détail par établissement
            </h3>
            {data.length > 0 && (
              <Badge variant="secondary" className="font-normal">
                {formatNumber(data.length)} ligne{data.length > 1 ? "s" : ""}
              </Badge>
            )}
          </div>
          <div className="text-xs text-muted-foreground hidden sm:flex items-center gap-1.5">
            <Layers className="h-3 w-3" /> Triable et exportable
          </div>
        </div>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Chargement des données…</p>
            </div>
          ) : enrichedData.length === 0 ? (
            <div className="text-center py-24 px-6">
              <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-muted mb-4">
                <Filter className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm font-semibold text-foreground">Aucune donnée à afficher</p>
              <p className="text-xs text-muted-foreground mt-1.5 max-w-sm mx-auto">
                Ajustez les filtres géographiques ci-dessus puis cliquez sur « Appliquer » pour charger les besoins.
              </p>
            </div>
          ) : (
            <div className="h-[600px]">
              <DataTable
                data={enrichedData}
                columns={columns}
                title={`${activeCat.label} — ${meta.label}`}
                exportFilename={`besoins_${categorie}_${niveau}.csv`}
                pageSize={10}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  </TooltipProvider>
  );
};

/* ───────── Sub-components ───────── */

const LegendChip = ({
  color, label, count, active,
}: { color: string; label: string; count: number; active: boolean }) => (
  <span
    className={cn(
      "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 transition-colors",
      active
        ? "border-foreground/20 bg-muted text-foreground font-medium shadow-sm"
        : "border-transparent text-muted-foreground"
    )}
    title={`${count} établissement${count > 1 ? "s" : ""}`}
  >
    <span className={cn("inline-block h-2.5 w-2.5 rounded-full ring-1 ring-border", color)} />
    {label}
    <span className={cn(
      "tabular-nums text-[10px] rounded px-1 ml-0.5",
      active ? "bg-background text-foreground" : "bg-muted/60 text-muted-foreground"
    )}>
      {new Intl.NumberFormat("fr-FR").format(count)}
    </span>
  </span>
);

const FilterField = ({ label, locked, children }: { label: string; locked?: boolean; children: React.ReactNode }) => (
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
  icon: Icon, accent, label, value, hint, progress,
}: {
  icon: any; accent: Accent; label: string; value: string; hint?: string; progress?: number;
}) => {
  const styles: Record<Accent, { ring: string; iconBg: string; iconColor: string; bar: string; topBar: string }> = {
    success: {
      ring: "ring-[hsl(var(--success)/0.15)]",
      iconBg: "bg-[hsl(var(--success)/0.10)]",
      iconColor: "text-[hsl(var(--success))]",
      bar: "bg-[hsl(var(--success))]",
      topBar: "bg-[hsl(var(--success))]",
    },
    primary: {
      ring: "ring-primary/15",
      iconBg: "bg-primary/10",
      iconColor: "text-primary",
      bar: "bg-primary",
      topBar: "bg-primary",
    },
    warning: {
      ring: "ring-[hsl(var(--warning)/0.15)]",
      iconBg: "bg-[hsl(var(--warning)/0.10)]",
      iconColor: "text-[hsl(var(--warning))]",
      bar: "bg-[hsl(var(--warning))]",
      topBar: "bg-[hsl(var(--warning))]",
    },
    info: {
      ring: "ring-[hsl(var(--info)/0.15)]",
      iconBg: "bg-[hsl(var(--info)/0.10)]",
      iconColor: "text-[hsl(var(--info))]",
      bar: "bg-[hsl(var(--info))]",
      topBar: "bg-[hsl(var(--info))]",
    },
  };
  const s = styles[accent];
  return (
    <Card className={cn(
      "group relative overflow-hidden border-border/60 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all ring-1",
      s.ring
    )}>
      <div className={cn("absolute inset-x-0 top-0 h-1", s.topBar)} aria-hidden />
      <CardContent className="p-5 pt-6">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">{label}</p>
            <p className="text-3xl font-bold tracking-tight tabular-nums text-foreground mt-1.5 leading-none">{value}</p>
          </div>
          <div className={cn(
            "shrink-0 h-11 w-11 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110 ring-1 ring-border/40",
            s.iconBg, s.iconColor
          )}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
        {hint && <p className="text-xs text-muted-foreground leading-snug">{hint}</p>}
        {typeof progress === "number" && (
          <div className="mt-3 h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-all duration-700", s.bar)}
              style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default Besoins;