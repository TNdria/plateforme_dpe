import { useEffect, useMemo, useState, useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
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
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { besoinsApi, type Dren, type Cisco, type Zap } from '@/services/api';
import { notify } from '@/contexts/NotificationsContext';
import { toast } from 'sonner';
import DataTable from '@/components/donnees/DataTable';
import { useAuth } from '@/contexts/AuthContext';
import DataActionsBar from '@/components/admin/DataActionsBar';
import { cn } from '@/lib/utils';
import logoMen from '@/assets/logoMen.jpg';
import logoDpe from '@/assets/logoDpe.jpg';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import * as XLSX from 'xlsx';

type Niveau = 'primaire' | 'college' | 'lycee';
type Categorie = 'salles' | 'enseignants' | 'tb' | 'manuels';
type ExportFormat = 'csv' | 'xlsx';

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
  primaire: {
    label: 'Primaire',
    icon: BookOpen,
    badgeBg: 'bg-emerald-600',
    badgeText: 'text-white',
    activeBg: 'bg-emerald-600',
    activeText: 'text-white',
    ring: 'ring-emerald-500/30',
  },
  college: {
    label: 'Collège',
    icon: School,
    badgeBg: 'bg-blue-600',
    badgeText: 'text-white',
    activeBg: 'bg-blue-600',
    activeText: 'text-white',
    ring: 'ring-blue-500/30',
  },
  lycee: {
    label: 'Lycée',
    icon: GraduationCap,
    badgeBg: 'bg-violet-600',
    badgeText: 'text-white',
    activeBg: 'bg-violet-600',
    activeText: 'text-white',
    ring: 'ring-violet-500/30',
  },
};

// Ratios standards MEN Madagascar (fallback si effectifs détaillés indisponibles)
const RATIOS: Record<
  Niveau,
  { elevesParEns: number; elevesParTB: number; manuelsParEleve: number }
> = {
  primaire: { elevesParEns: 40, elevesParTB: 2, manuelsParEleve: 5 },
  college: { elevesParEns: 35, elevesParTB: 2, manuelsParEleve: 7 },
  lycee: { elevesParEns: 30, elevesParTB: 2, manuelsParEleve: 9 },
};

// Normes élèves par salle de classe (doc MEN "MODE DE CALCUL BESOINS SDC")
const NORME_ELEVE_SDC: Record<Niveau, number> = {
  primaire: 50,
  college: 50,
  lycee: 50,
};

// Détection zone rurale (rural = commune de type rural)
const isRural = (row: any): boolean => {
  const cat = String(
    row?.CATEGORIE_COMMUNE ?? row?.categorie_commune ?? row?.MILIEU ?? ''
  )
    .toLowerCase()
    .trim();
  return cat.startsWith('rural') || cat === 'r';
};

const pickNumRaw = (row: any, keys: string[]): number | null => {
  if (!row) return null;
  for (const k of keys) {
    const v = row[k] ?? row[k.toLowerCase()] ?? row[k.toUpperCase()];
    if (v != null && v !== '') {
      const n = Number(v);
      if (Number.isFinite(n)) return n;
    }
  }
  return null;
};

const getGroupePeda = (row: any): number => {
  const t1 = pickNumRaw(row, ['EFF_T1', 'eff_t1']) || 0;
  const t2 = pickNumRaw(row, ['EFF_T2', 'eff_t2']) || 0;
  const t3 = pickNumRaw(row, ['EFF_T3', 'eff_t3']) || 0;
  const t4 = pickNumRaw(row, ['EFF_T4', 'eff_t4']) || 0;
  const t5 = pickNumRaw(row, ['EFF_T5', 'eff_t5']) || 0;
  return Math.ceil((t1 + t2 + t3) / 50) + Math.ceil((t4 + t5) / 50);
};

const getNbSection = (row: any): number =>
  pickNumRaw(row, ['NB_SECTION', 'SECTIONS', 'NB_SECTIONS', 'SECTION']) ?? 0;

const computeRequisPrimaire = (row: any, effTotal: number): number => {
  const t1 = pickNumRaw(row, ['EFF_T1', 'eff_t1']) || 0;
  const t2 = pickNumRaw(row, ['EFF_T2', 'eff_t2']) || 0;
  const t3 = pickNumRaw(row, ['EFF_T3', 'eff_t3']) || 0;
  const t4 = pickNumRaw(row, ['EFF_T4', 'eff_t4']) || 0;
  const t5 = pickNumRaw(row, ['EFF_T5', 'eff_t5']) || 0;

  if ([t1, t2, t3, t4, t5].every((v) => v === 0)) {
    return Math.ceil((effTotal || 0) / 50);
  }

  const sumT123 = t1 + t2 + t3;
  let classesT123 = sumT123 > 0 && sumT123 <= 50 ? 1 : Math.ceil(sumT123 / 50);
  const classesT45 = Math.ceil((t4 + t5) / 50);
  return classesT123 + classesT45;
};

const computeRequisCollege = (row: any): number => {
  const nbSection = getNbSection(row);
  if (nbSection > 0) return nbSection * 2; // selon ta logique précédente

  // Fallback sur effectifs si pas de sections
  const eff = getEffectifs(row);
  return Math.ceil(eff / 35); // ratio standard collège
};

const computeRequisLycee = (row: any): number => {
  const eff = getEffectifs(row);
  if (eff > 0) return Math.ceil(eff / 30); // ratio standard lycée

  // Essayer les effectifs par classe si disponibles
  const eff2nde = pickNumRaw(row, ['EFF_2NDE', 'eff_2nde']) || 0;
  const eff1re = pickNumRaw(row, ['EFF_1RE', 'eff_1re']) || 0;
  const effTle = pickNumRaw(row, ['EFF_TLE', 'eff_tle']) || 0;

  return Math.ceil((eff2nde + eff1re + effTle) / 30);
};

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
    id: 'salles',
    label: 'Besoins en salles de classe',
    shortLabel: 'Salles de classe',
    icon: Building2,
    unit: 'salles',
    computeRequis: (eff: number, niv: Niveau, row?: any) => {
      if (niv === 'primaire') {
        const grp = getGroupePeda(row);
        return isRural(row) ? grp : Math.ceil(grp / 2);
      }
      const sections = getNbSection(row);
      if (sections > 0) return sections;
      return Math.ceil(eff / 50);
    },
  },
  {
    id: 'enseignants',
    label: 'Besoins en enseignants',
    shortLabel: 'Enseignants',
    icon: Users,
    unit: 'enseignants',
    computeRequis: (eff: number, niv: Niveau, row?: any) =>
      niv === 'primaire'
        ? computeRequisPrimaire(row, eff)
        : niv === 'college'
          ? computeRequisCollege(row)
          : computeRequisLycee(row),
  },
  {
    id: 'tb',
    label: 'Besoins en tables-bancs (places assises)',
    shortLabel: 'Tables-bancs',
    icon: Armchair,
    unit: 'places',
    computeRequis: (eff: number, niv: Niveau, row?: any) => {
      if (niv === 'primaire') {
        if (isRural(row)) return eff || 0;
        const grp = getGroupePeda(row);
        return Math.ceil(grp / 2) * 50;
      }
      return eff || 0;
    },
  },
  {
    id: 'manuels',
    label: 'Besoins en manuels',
    shortLabel: 'Manuels',
    icon: Library,
    unit: 'manuels',
    computeRequis: (eff: number, niv: Niveau) => {
      if (niv === 'primaire') return Math.ceil((eff || 0) / 2);
      return Math.ceil((eff || 0) * 1.5); // ratio approximatif secondaire
    },
  },
];

const getCodeEtab = (row: any): string =>
  String(row?.CODE_ETAB ?? row?.code_etab ?? '').trim();

const getEffectifs = (row: any): number =>
  pickNumRaw(row, ['EFFECTIFS', 'eff_total', 'EFFECTIF', 'EFF_TOTAL']) ?? 0;
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
  const computedRequis = cat.computeRequis
    ? cat.computeRequis(eff, niveau, row)
    : 0;

  let existant = 0;
  let warning = '';

  switch (cat.id) {
    case 'salles':
      existant = pickNumRaw(row, ['SDC_EXISTANT', 'SDC_BE', 'sdc_be']) ?? 0;
      break;
    case 'enseignants':
      existant = pickNumRaw(row, ['ENS_EXISTANT', 'en_classe']) ?? 0;
      break;
    case 'tb':
      existant = pickNumRaw(row, ['PLACES', 'places_n2', 'places_n3']) ?? 0;
      break;
    case 'manuels':
      if (niveau === 'college' || niveau === 'lycee') {
        existant = 0;
        warning = 'Données manuels non disponibles pour le secondaire';
      } else {
        existant = pickNumRaw(row, ['MANUEL_EXISTANT', 'manuel_existant']) ?? 0;
      }
      break;
  }

  const besoin = Math.max(0, computedRequis - existant);
  const excedent = Math.max(0, existant - computedRequis);

  const couverture =
    computedRequis > 0
      ? Math.max(
          0,
          Math.min(100, ((computedRequis - besoin) / computedRequis) * 100)
        )
      : 100;

  const statut: 'correcte' | 'moderes' | 'critiques' =
    computedRequis <= 0
      ? 'correcte'
      : couverture >= 80
        ? 'correcte'
        : couverture >= 50
          ? 'moderes'
          : 'critiques';

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

const formatNumber = (n: number) =>
  new Intl.NumberFormat('fr-FR').format(Math.round(n || 0));

const besoinsCache = new Map<string, any[]>();

const Besoins = () => {
  const { niveau: niveauParam } = useParams<{ niveau: Niveau }>();
  const niveau: Niveau = (
    ['primaire', 'college', 'lycee'].includes(niveauParam || '')
      ? niveauParam
      : 'primaire'
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
  const [codeDren, setCodeDren] = useState<string>(
    drenLocked ? String(userDren) : '0'
  );
  const [codeCisco, setCodeCisco] = useState<string>(
    ciscoLocked ? String(userCisco) : '0'
  );
  const [codeZap, setCodeZap] = useState<string>('0');
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingFilters, setLoadingFilters] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [categorie, setCategorie] = useState<Categorie>('salles');
  const activeCat = useMemo(
    () => CATEGORIES.find((c) => c.id === categorie)!,
    [categorie]
  );

  const [showExportModal, setShowExportModal] = useState(false);
  const [exportFormat, setExportFormat] = useState<ExportFormat>('xlsx');

  const fetchData = useCallback(
    async (
      cd: number,
      cc: number,
      cz: number,
      an: number = 2025,
      opts: { silent?: boolean } = {}
    ) => {
      const cacheKey = `${niveau}:${cd}:${cc}:${cz}:${an}`;

      if (besoinsCache.has(cacheKey)) {
        const cached = besoinsCache.get(cacheKey)!;
        setData(cached);
        setLastUpdate(new Date());
        return cached;
      }

      setLoading(true);
      try {
        let res: any[] = [];
        if (niveau === 'primaire') {
          res = await besoinsApi.getBesoinsN1(cd, cc, cz, an);
        } else if (niveau === 'college') {
          res = await besoinsApi.getBesoinsN2(cd, cc, cz, an);
        } else {
          res = await besoinsApi.getBesoinsN3(cd, cc, cz, an);
        }

        const deduped = dedupeByCodeEtab(Array.isArray(res) ? res : []);

        besoinsCache.set(cacheKey, deduped);
        setData(deduped);
        setLastUpdate(new Date());

        // ==================== NOTIFICATION ====================
        if (!opts.silent && deduped.length > 0) {
          notify({
            title: `Données chargées avec succès`,
            message: `${formatNumber(deduped.length)} établissements analysés pour l'année ${an - 1}-${an}`,
            type: 'success',
            silent: false, // Change à true si tu veux une notification discrète
          });
        } else if (deduped.length === 0) {
          notify({
            title: 'Aucune donnée trouvée',
            message: `Aucun établissement trouvé pour les filtres sélectionnés (${an - 1}-${an}).`,
            type: 'warning',
          });
        }
        // ====================================================

        return deduped;
      } catch (e) {
        console.error(e);
        notify({
          title: 'Erreur de chargement',
          message: `Impossible de récupérer les besoins pour ${meta.label}.`,
          type: 'error',
        });
        setData([]);
        return [];
      } finally {
        setLoading(false);
      }
    },
    [niveau, meta.label]
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
        toast.error('Erreur chargement DREN');
      }

      const initialDren = drenLocked ? userDren : 0;
      const initialCisco = ciscoLocked ? userCisco : 0;

      setCodeDren(String(initialDren));
      setCodeCisco(String(initialCisco));
      setCodeZap('0');
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

  // Chargement automatique quand l'année change
  useEffect(() => {
    if (codeDren !== undefined && codeCisco !== undefined) {
      fetchData(
        parseInt(codeDren),
        parseInt(codeCisco),
        parseInt(codeZap),
        annee
      );
    }
  }, [annee, codeDren, codeCisco, codeZap, fetchData]);

  const handleDrenChange = async (value: string) => {
    if (drenLocked) return;

    setCodeDren(value);
    setCodeCisco('0');
    setCodeZap('0');
    setCiscos([]);
    setZaps([]);

    if (value === '0') return;

    setLoadingFilters(true);

    try {
      const c = await besoinsApi.getCiscos(parseInt(value));
      // Éviter les doublons CISCO
      const uniqueCiscos = c
        ? Array.from(new Map(c.map((item) => [item.CODE_CISCO, item])).values())
        : [];
      setCiscos(uniqueCiscos);
    } catch (error) {
      console.error('Erreur CISCO:', error);
      toast.error('Erreur chargement CISCO');
      setCiscos([]);
    } finally {
      setLoadingFilters(false);
    }
  };

  const handleCiscoChange = async (value: string) => {
    if (ciscoLocked) return;

    setCodeCisco(value);
    setCodeZap('0');
    setZaps([]);

    if (value === '0') return;

    setLoadingFilters(true);

    try {
      const z = await besoinsApi.getZaps(parseInt(codeDren), parseInt(value));

      // Suppression des doublons éventuels
      const uniqueZaps = z
        ? Array.from(
            new Map(z.map((item: any) => [item.CODE_ZAP, item])).values()
          )
        : [];

      setZaps(uniqueZaps);
    } catch (error: any) {
      console.error('Erreur ZAP:', error);
      toast.error('Erreur lors du chargement des ZAP');
      setZaps([]);
    } finally {
      setLoadingFilters(false);
    }
  };

  const handleFilter = () => {
    fetchData(
      parseInt(codeDren),
      parseInt(codeCisco),
      parseInt(codeZap),
      annee
    );
  };

  const handleReset = () => {
    if (drenLocked) return;

    setCodeDren('0');
    setCodeCisco('0');
    setCodeZap('0');
    setCiscos([]);
    setZaps([]);

    // Réinitialisation année à la valeur par défaut
    setAnnee(2025);

    fetchData(0, 0, 0, 2025);
  };

  // Enriched rows: compute requis/existant/besoin/excedent for active category
  const enrichedData = useMemo(() => {
    return data.map((row) => {
      const c = computeRow(row, activeCat, niveau);
      const zone = isRural(row) ? 'Rurale' : 'Urbaine';
      return {
        ...row,
        ZONE: zone,
        REQUIS: c.requis,
        EXISTANT: c.existant,
        BESOIN: c.besoin,
        EXCEDENT: c.excedent,
        COUVERTURE: c.couverture,
        STATUT: c.statut,
        WARNING: c.warning || '',
      };
    });
  }, [data, activeCat, niveau]);

  const stats = useMemo(() => {
    const ecoles = new Set(data.map((e) => e.CODE_ETAB)).size;
    let requis = 0,
      existant = 0,
      besoins = 0,
      excedent = 0;
    let correcte = 0,
      moderes = 0,
      critiques = 0;
    for (const row of data) {
      const c = computeRow(row, activeCat, niveau);
      requis += c.requis;
      existant += c.existant;
      besoins += c.besoin;
      excedent += c.excedent;
      if (c.requis <= 0) {
        correcte++;
        continue;
      }
      const cov = ((c.requis - c.besoin) / c.requis) * 100;
      if (cov >= 80) correcte++;
      else if (cov >= 50) moderes++;
      else critiques++;
    }
    const couverture =
      requis > 0
        ? Math.max(0, Math.min(100, ((requis - besoins) / requis) * 100))
        : 0;
    const status: 'correcte' | 'moderes' | 'critiques' =
      couverture >= 80
        ? 'correcte'
        : couverture >= 50
          ? 'moderes'
          : 'critiques';
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
  }, [data, activeCat, niveau]);

// === À METTRE AVANT le useMemo des columns ===
const zapMap = useMemo(() => {
  const map = new Map<string, string>();
  zaps.forEach((z: any) => {
    if (z.CODE_ZAP) {
      map.set(String(z.CODE_ZAP).trim(), z.ZAP || z.zap || '');
    }
  });
  return map;
}, [zaps]);

// === Ensuite le columns ===
const columns = useMemo(() => {
  const getStatutColor = (statut: string) => {
    switch (statut?.toLowerCase()) {
      case 'correcte':
        return 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800';
      case 'moderes':
        return 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800';
      case 'critiques':
        return 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800';
      default:
        return 'bg-muted text-muted-foreground border-border';
    }
  };

  const getCouvertureColor = (couverture: number) => {
    if (couverture >= 80) return 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300';
    if (couverture >= 50) return 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300';
    return 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-950 dark:text-rose-300';
  };

  return [
    { key: 'DREN', label: 'DREN', width: 140, sortable: true, align: 'left' as const },
    { key: 'CISCO', label: 'CISCO', width: 140, sortable: true, align: 'left' as const },
    {
      key: 'ZAP',
      label: 'ZAP',
      width: 180,
      sortable: true,
      align: 'left' as const,
      render: (value: any, row: any) => {
        const zapName = zapMap.get(String(row?.CODE_ZAP || value)) || value || '—';
        return <span className="font-medium text-sm">{zapName}</span>;
      },
    },
    { key: 'NOM_ETAB', label: 'Nom Établissement', width: 260, sortable: true, align: 'left' as const },
    { key: 'CODE_ETAB', label: 'Code', width: 110, sortable: true, align: 'left' as const },
    {
      key: 'ZONE',
      label: 'Zone',
      width: 110,
      sortable: true,
      align: 'center' as const,
      render: (value: string) => (
        <Badge variant="outline" className="bg-violet-50 border-violet-200 text-violet-700 dark:bg-violet-950/60 dark:border-violet-800 dark:text-violet-300">
          {value}
        </Badge>
      ),
    },
    {
      key: 'EFFECTIFS',
      label: 'Effectifs',
      width: 110,
      sortable: true,
      align: 'center' as const,
      render: (v: any) => formatNumber(Number(v) || 0),
    },
    {
      key: 'REQUIS',
      label: 'Requis',
      width: 110,
      sortable: true,
      align: 'center' as const,
      render: (v: any) => formatNumber(Number(v) || 0),
    },
    {
      key: 'EXISTANT',
      label: 'Existant',
      width: 110,
      sortable: true,
      align: 'center' as const,
      render: (v: any) => formatNumber(Number(v) || 0),
    },
    {
      key: 'BESOIN',
      label: 'Besoin',
      width: 110,
      sortable: true,
      align: 'center' as const,
      render: (v: any) => formatNumber(Number(v) || 0),
    },
    {
      key: 'EXCEDENT',
      label: 'Excédent',
      width: 110,
      sortable: true,
      align: 'center' as const,
      render: (v: any) => formatNumber(Number(v) || 0),
    },
    {
      key: 'COUVERTURE',
      label: 'Couverture',
      width: 120,
      sortable: true,
      align: 'center' as const,
      render: (value: number) => {
        const cov = Number(value) || 0;
        return (
          <Badge
            variant="outline"
            className={cn('font-semibold', getCouvertureColor(cov))}
          >
            {cov.toFixed(0)}%
          </Badge>
        );
      },
    },
    {
      key: 'STATUT',
      label: 'Statut',
      width: 130,
      sortable: true,
      align: 'center' as const,
      render: (value: string) => (
        <Badge
          variant="outline"
          className={cn('font-medium capitalize', getStatutColor(value))}
        >
          {value}
        </Badge>
      ),
    },
  ];
}, [zapMap]);   // ← dépendance sur zapMap (pas sur zaps directement)

  const handleExportCategory = (catId: Categorie) => {
    const filtered = enrichedData;
    const filename = `besoins_${catId}_${niveau}_${annee}_${new Date().toISOString().slice(0, 10)}`;

    if (exportFormat === 'xlsx') {
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(filtered);
      XLSX.utils.book_append_sheet(wb, ws, 'Besoins');
      XLSX.writeFile(wb, `${filename}.xlsx`);
    } else {
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(filtered);
      XLSX.writeFile(wb, `${filename}.csv`, { bookType: 'csv' });
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
                  Ministère de l'Éducation Nationale · Année scolaire{' '}
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
                  <Badge
                    variant="outline"
                    className="gap-1 text-xs text-muted-foreground"
                  >
                    <RefreshCw className="h-3 w-3" />
                    {lastUpdate.toLocaleTimeString('fr-FR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                    • {annee - 1}-{annee}
                  </Badge>
                )}
                <DataActionsBar
                  table={`besoins_${niveau}`}
                  tableLabel={`Besoins ${meta.label}`}
                  onChange={handleFilter}
                />
                <Button
                  onClick={() => setShowExportModal(true)}
                  size="sm"
                  variant="outline"
                >
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
                          'inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide transition-colors',
                          active
                            ? cn(m.activeBg, m.activeText, 'shadow-inner')
                            : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
                        )}
                        aria-current={active ? 'page' : undefined}
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
                  active={stats.status === 'correcte'}
                />
                <LegendChip
                  color="bg-amber-500"
                  label="Besoins modérés"
                  count={stats.moderes}
                  active={stats.status === 'moderes'}
                />
                <LegendChip
                  color="bg-rose-500"
                  label="Besoins critiques"
                  count={stats.critiques}
                  active={stats.status === 'critiques'}
                />
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-3.5 w-3.5 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-[280px] text-xs">
                    Répartition des établissements selon leur taux de couverture
                    : ≥ 80 % correcte · 50–80 % modérés · &lt; 50 % critiques.
                    L'élément mis en avant correspond à la situation globale du
                    périmètre filtré.
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
          </div>
        </div>

        {/* Filters bar */}
        <Card
          className="border-border/60 shadow-sm animate-fade-in overflow-hidden"
          style={{ animationDelay: '60ms' }}
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
                {(codeDren !== '0' || codeCisco !== '0' || codeZap !== '0') && (
                  <>
                    {' • '}
                    {codeDren !== '0' &&
                      drens.find((d) => String(d.CODE_DREN) === codeDren)?.DREN}
                    {codeCisco !== '0' &&
                      `, ${ciscos.find((c) => String(c.CODE_CISCO) === codeCisco)?.CISCO}`}
                    {codeZap !== '0' &&
                      `, ${zaps.find((z) => String(z.CODE_ZAP) === codeZap)?.ZAP}`}
                  </>
                )}
              </Badge>
            </div>
          </div>
          <CardContent className="p-4 sm:p-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {/* DREN */}
              <FilterField label="DREN" locked={drenLocked}>
                <Select
                  value={codeDren}
                  onValueChange={handleDrenChange}
                  disabled={drenLocked}
                >
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
                  disabled={ciscoLocked || codeDren === '0' || loadingFilters}
                >
                  <SelectTrigger className="bg-background h-10">
                    <SelectValue placeholder="Toutes CISCO" />
                  </SelectTrigger>
                  <SelectContent side="bottom" position="popper">
                    <SelectItem value="0">Toutes CISCO</SelectItem>
                    {ciscos.map((c) => (
                      <SelectItem
                        key={c.CODE_CISCO}
                        value={String(c.CODE_CISCO)}
                      >
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
                  onValueChange={setCodeZap}
                  disabled={codeCisco === '0' || loadingFilters}
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

              {/* Année Scolaire */}
              <FilterField label="Année Scolaire">
                <Select
                  value={String(annee)}
                  onValueChange={(v) => setAnnee(parseInt(v))}
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
                <Button
                  onClick={handleFilter}
                  disabled={loading}
                  className="flex-1 h-10 shadow-sm"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Filter className="h-4 w-4 mr-2" />
                  )}
                  Appliquer
                </Button>
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
          style={{ animationDelay: '90ms' }}
        >
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
                  <span className="sm:hidden">
                    {c.shortLabel.split(' ')[0]}
                  </span>
                </TabsTrigger>
              );
            })}
          </TabsList>
        </Tabs>

        {/* KPI cards (catégorie active) */}
        <div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 animate-fade-in"
          style={{ animationDelay: '120ms' }}
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
            progress={
              stats.requis > 0 ? (stats.besoins / stats.requis) * 100 : 0
            }
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
          style={{ animationDelay: '180ms' }}
        >
          <div className="flex items-center justify-between gap-3 px-5 py-3 border-b bg-muted/30">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">
                {activeCat.label} — Détail par établissement
              </h3>
              {data.length > 0 && (
                <Badge variant="secondary" className="font-normal">
                  {formatNumber(data.length)} ligne{data.length > 1 ? 's' : ''}
                </Badge>
              )}
            </div>
            <div className="text-xs text-muted-foreground hidden sm:flex items-center gap-1.5">
              <Layers className="h-3 w-3" /> Triable et exportable
            </div>
          </div>

          <CardContent className="p-0">
            {/* Warning pour Manuels en Collège / Lycée */}
            {activeCat.id === 'manuels' &&
              (niveau === 'college' || niveau === 'lycee') && (
                <div className="mx-5 mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-sm flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 mt-0.5 flex-shrink-0 text-amber-600" />
                  <div>
                    <p className="font-medium">
                      Données des manuels existants non disponibles
                    </p>
                    <p className="text-amber-700 mt-1 text-sm">
                      Le calcul du besoin est effectué selon les normes MEN,
                      mais les données d'existant ne sont pas encore intégrées
                      pour le Collège et le Lycée.
                    </p>
                  </div>
                </div>
              )}

            {loading ? (
              <div className="flex flex-col items-center justify-center py-24 gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">
                  Chargement des données…
                </p>
              </div>
            ) : enrichedData.length === 0 ? (
              <div className="text-center py-24 px-6">
                <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-muted mb-4">
                  <Filter className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-sm font-semibold text-foreground">
                  Aucune donnée à afficher
                </p>
                <p className="text-xs text-muted-foreground mt-1.5 max-w-sm mx-auto">
                  Ajustez les filtres géographiques ci-dessus puis cliquez sur «
                  Appliquer » pour charger les besoins.
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
                  <p className="font-medium text-emerald-700">
                    Correcte — ≥ 80%
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    L'établissement dispose de la quasi-totalité des ressources
                    nécessaires.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-4 rounded-lg border border-amber-500/30 bg-amber-500/5">
                <div className="mt-1 h-3 w-3 rounded-full bg-amber-500 flex-shrink-0" />
                <div>
                  <p className="font-medium text-amber-700">
                    Modéré — 50% à 79%
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Déficit significatif, attention particulière recommandée.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-4 rounded-lg border border-rose-500/30 bg-rose-500/5">
                <div className="mt-1 h-3 w-3 rounded-full bg-rose-500 flex-shrink-0" />
                <div>
                  <p className="font-medium text-rose-700">
                    Critique — &lt; 50%
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Manque important de ressources.
                  </p>
                </div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-4">
              Taux de couverture = (Requis − Besoin) / Requis × 100. Calculé
              pour chaque catégorie selon les normes MEN/DPE.
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
                  <strong>DREN :</strong>{' '}
                  {codeDren !== '0'
                    ? drens.find((d) => String(d.CODE_DREN) === codeDren)
                        ?.DREN || 'Toutes'
                    : 'Toutes'}
                </div>
                <div>
                  <strong>CISCO :</strong>{' '}
                  {codeCisco !== '0'
                    ? ciscos.find((c) => String(c.CODE_CISCO) === codeCisco)
                        ?.CISCO || 'Toutes'
                    : 'Toutes'}
                </div>
                <div>
                  <strong>ZAP :</strong>{' '}
                  {codeZap !== '0'
                    ? zaps.find((z) => String(z.CODE_ZAP) === codeZap)?.ZAP ||
                      'Toutes'
                    : 'Toutes'}
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
                  variant={exportFormat === 'xlsx' ? 'default' : 'outline'}
                  onClick={() => setExportFormat('xlsx')}
                  className="flex-1 h-9 text-xs font-medium"
                >
                  <FileSpreadsheet className="mr-2 h-4 w-4" />
                  Excel (.xlsx)
                </Button>
                <Button
                  variant={exportFormat === 'csv' ? 'default' : 'outline'}
                  onClick={() => setExportFormat('csv')}
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
                {CATEGORIES.map((cat) => {
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
                          {formatNumber(stats.ecoles)} établissements •{' '}
                          {cat.unit}
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
      'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 transition-colors',
      active
        ? 'border-foreground/20 bg-muted text-foreground font-medium shadow-sm'
        : 'border-transparent text-muted-foreground'
    )}
    title={`${count} établissement${count > 1 ? 's' : ''}`}
  >
    <span
      className={cn(
        'inline-block h-2.5 w-2.5 rounded-full ring-1 ring-border',
        color
      )}
    />
    {label}
    <span
      className={cn(
        'tabular-nums text-[10px] rounded px-1 ml-0.5',
        active
          ? 'bg-background text-foreground'
          : 'bg-muted/60 text-muted-foreground'
      )}
    >
      {new Intl.NumberFormat('fr-FR').format(count)}
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

type Accent = 'success' | 'primary' | 'warning' | 'info';

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
  const styles: Record<
    Accent,
    { ring: string; iconBg: string; iconColor: string; bar: string }
  > = {
    success: {
      ring: 'ring-emerald-500/30 border-emerald-500/20',
      iconBg: 'bg-emerald-500/10',
      iconColor: 'text-emerald-600 dark:text-emerald-400',
      bar: 'bg-emerald-500',
    },
    primary: {
      ring: 'ring-primary/30 border-primary/20',
      iconBg: 'bg-primary/10',
      iconColor: 'text-primary',
      bar: 'bg-primary',
    },
    warning: {
      ring: 'ring-amber-500/30 border-amber-500/20',
      iconBg: 'bg-amber-500/10',
      iconColor: 'text-amber-600 dark:text-amber-400',
      bar: 'bg-amber-500',
    },
    info: {
      ring: 'ring-blue-500/30 border-blue-500/20',
      iconBg: 'bg-blue-500/10',
      iconColor: 'text-blue-600 dark:text-blue-400',
      bar: 'bg-blue-500',
    },
  };

  const s = styles[accent];

  return (
    <Card className={cn(
      'group relative overflow-hidden shadow-sm hover:shadow-md transition-all h-full flex flex-col border-2',
      s.ring
    )}>
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
              'w-12 h-12 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110',
              s.iconBg
            )}
          >
            <Icon className={cn('w-6 h-6', s.iconColor)} />
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
            <p className="text-xs text-muted-foreground text-center leading-relaxed">
              {hint}
            </p>
          )}
        </div>

        {typeof progress === 'number' && (
          <div className="mt-3 h-1 w-full bg-muted rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-700',
                s.bar
              )}
              style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
            />
          </div>
        )}
      </div>
    </Card>
  );
};

export default Besoins;
