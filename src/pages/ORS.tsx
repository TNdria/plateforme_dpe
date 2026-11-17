import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import type { ElementType } from "react";
import { useParams, Link } from "react-router-dom";
import { useMapData, Etablissement, Village } from "@/hooks/useMapData";
import type { VillageEligibleNouvelleCreationFeatureCollection } from "@/services/api";
import {
  MapFilters,
  type LayerVisibility,
} from "@/components/ors/MapFilters";
import { MapSearch } from "@/components/ors/MapSearch";
import { ORSMap } from "@/components/ors/ORSMap";
import {
  ORS_COLORS,
  NIVEAU_MAIN_COLOR,
  AIRE_RECRUTEMENT_RADIUS,
  normalizeSectorValue,
  isPublicSecteur as isPublicSector,
  isPrivateSecteur as isPrivateSector,
  secteurLabel as getSectorLabel,
} from "@/components/ors/orsColors";
import {
  NC_CONFIG,
  analyserNouvelleCreation,
  filtrerSecteur,
} from "@/components/ors/nouvelleCreation";
import { ORSAnalysisPanel } from "@/components/ors/ORSAnalysisPanel";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  MapPin,
  School,
  Users,
  Building2,
  GraduationCap,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Loader2,
  Download,
  FileImage,
  FileSpreadsheet,
  FileText,
  Layers,
  Search,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import DataActionsBar from "@/components/admin/DataActionsBar";
import { useUserScope } from "@/hooks/useUserScope";
import useAutoApplyScope from "@/hooks/useAutoApplyScope";
import { VillageAnalysisDialog } from "@/components/ors/VillageAnalysisDialog";
import type { VillageAnalysisResult } from "@/components/ors/nouvelleCreation";
import { HelpPanel } from "@/components/ors/HelpPanel";
import { cn } from "@/lib/utils";
import { ORS_CSV_COLUMNS } from "@/utils/csvExport";
import { captureMapPng } from "@/utils/captureMapPng";
import type { EtablissementIconType, SchoolLevel } from "@/lib/etablissementIcons";
import { EtablissementIcon, SchoolLevelIcon } from "@/components/SchoolLevelIcon";
import * as XLSX from "xlsx";
import logoMen from "@/assets/logoMen.jpg";
import logoDpe from "@/assets/logoDpe.jpg";


interface CollapsibleCardHeaderProps {
  title: string;
  icon: ElementType;
  open: boolean;
  onToggle: () => void;
}

const CollapsibleCardHeader = ({
  title,
  icon,
  open,
  onToggle,
}: CollapsibleCardHeaderProps) => {
  const Icon = icon;

  return (
    <CardHeader className="py-2 px-3">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-semibold">
          <Icon className="w-4 h-4 text-primary" />
          {title}
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 transition-transform duration-200",
            open && "rotate-180",
          )}
        />
      </button>
    </CardHeader>
  );
};

// ============================================================================
//  CONFIGURATION PAR NIVEAU
// ============================================================================

export type OrsNiveau = "primaire" | "college" | "lycee";

interface NiveauMeta {
  label: string;
  icon: typeof School;
  breadcrumb: string;
  gradientClass: string;
  activeBg: string;
  activeText: string;
  helpType: "primaire" | "college" | "lycee";
  mainDataKey: "primaires" | "colleges" | "lycees";
  refDataKey: "primaires" | "colleges" | null;
  unitLabel: string;
  /** Libellé du niveau de référence (inférieur) affiché en badge — null si
   * aucune donnée de référence n'existe pour ce niveau (cas du préscolaire,
   * non disponible dans l'application). */
  refUnitLabel: string | null;
  defaultRadius: number;
  filenamePrefix: string;
}

const NIVEAU_META: Record<OrsNiveau, NiveauMeta> = {
  primaire: {
    label: "Primaire",
    icon: School,
    breadcrumb: "ORS PRIMAIRE",
    gradientClass: "from-primary/10 to-transparent",
    activeBg: "bg-primary",
    activeText: "text-primary-foreground",
    helpType: "primaire",
    mainDataKey: "primaires",
    refDataKey: null,
    unitLabel: "EPP",
    refUnitLabel: null,
    defaultRadius: 2000, // = AIRE primaire 2 km
    filenamePrefix: "ORS_PRIMAIRE",
  },
  college: {
    label: "Collège",
    icon: Building2,
    breadcrumb: "ORS COLLEGE",
    gradientClass: "from-green-500/10 to-transparent",
    activeBg: "bg-green-600",
    activeText: "text-white",
    helpType: "college",
    mainDataKey: "colleges",
    refDataKey: "primaires",
    unitLabel: "CEG",
    refUnitLabel: "EPP",
    defaultRadius: 5000, // = AIRE collège 5 km
    filenamePrefix: "ORS_COLLEGE",
  },
  lycee: {
    label: "Lycée",
    icon: GraduationCap,
    breadcrumb: "ORS LYCEE",
    gradientClass: "from-purple-500/10 to-transparent",
    activeBg: "bg-purple-600",
    activeText: "text-white",
    helpType: "lycee",
    mainDataKey: "lycees",
    refDataKey: "colleges",
    unitLabel: "Lycées",
    refUnitLabel: "CEG",
    defaultRadius: 20000, // = AIRE lycée 20 km
    filenamePrefix: "ORS_LYCEE",
  },
};

const NIVEAUX_ORDER: OrsNiveau[] = ["primaire", "college", "lycee"];

const getCoordinateLabel = (
  etab: Pick<Etablissement, "latitude" | "longitude"> | null | undefined,
) => {
  const latRaw = etab?.latitude;
  const lngRaw = etab?.longitude;

  // Normaliser en string puis en nombre pour éviter des comparaisons
  // directes entre `number` et `string` qui posent problème en TS.
  const latStr = latRaw === null || latRaw === undefined ? "" : String(latRaw).trim();
  const lngStr = lngRaw === null || lngRaw === undefined ? "" : String(lngRaw).trim();

  if (!latStr || !lngStr) return "Non renseigné";

  const latNumber = Number(latStr);
  const lngNumber = Number(lngStr);
  if (Number.isNaN(latNumber) || Number.isNaN(lngNumber)) return "Non renseigné";

  return `${latNumber.toFixed(6)}, ${lngNumber.toFixed(6)}`;
};

const formatExportValue = (etab: Etablissement, key: string): string | number | boolean => {
  const data = etab as unknown as Record<string, unknown>;
  const firstAvailable = (...keys: string[]) =>
    keys
      .map((candidate) => data[candidate])
      .find((value) => value !== null && value !== undefined && value !== "");

  // Les couches ORS ne donnent pas systématiquement le même nom à l'effectif.
  // Cette normalisation garantit une valeur dans le canevas commun d'export.

  const v =
    key === "effectifs"
      ? firstAvailable("effectifs", "eff_2024", "eff_t5")
      : key === "eff_t5"
        ? firstAvailable("eff_t5", "effectifs", "eff_2024")
        : key === "eff_2024"
          ? firstAvailable("eff_2024", "effectifs", "eff_t5")
          : data[key];

  if (key === "SECTEUR") {
    const n = normalizeSectorValue(v);
    if (n === 1) return "PRIVÉ";
    if (n === 0 || n === 2) return "PUBLIC";
    return "Non renseigné";
  }
  if (key === "eligible_reconstruction" || key === "eligible_rehabilitation")
    return v === true || v === 1 || v === "1" || v === "true" ? "OUI" : "NON";
  // Ne jamais produire de cellule vide : le libellé indique clairement que la
  // donnée n'était pas fournie par la source, sans inventer une valeur métier.
  if (v === null || v === undefined || v === "") return "Non renseigné";
  if (typeof v === "object") return JSON.stringify(v);
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return v;
  return String(v);
};

interface LegendItem {
  color: string;
  label: string;
  iconClass?: string;
  schoolLevel?: SchoolLevel;
  etablissementType?: EtablissementIconType;
}

const CATEGORY_FILTER_LABELS: Record<string, string> = {
  nouvelle_creation: "Nouvelle Création",
  extension: "Extension",
  reconstruction: "Reconstruction",
  rehabilitation: "Réhabilitation",
};

function getLegendItems(niveau: OrsNiveau, categoryFilter: string): LegendItem[] {
  const items: LegendItem[] = [];
  const activeCategory = niveau !== "primaire" && categoryFilter === "nouvelle_creation"
    ? "aucune"
    : categoryFilter;
  const critereActif = activeCategory !== "aucune";
  const critereLabel = CATEGORY_FILTER_LABELS[activeCategory] ?? activeCategory;

  // Nouvelle Création est réservée au niveau Primaire.
  if (niveau === "primaire" && activeCategory === "nouvelle_creation") {
    items.push(
      {
        color: ORS_COLORS.eligible,
        label: "Village éligible — Nouvelle Création",
        etablissementType: "village",
      },
      { color: ORS_COLORS.nonEligible, label: "Village non éligible", etablissementType: "village" },
    );
    items.push(
      { color: ORS_COLORS.limiteDren, label: "Limite DREN", iconClass: "fa fa-square" },
      { color: ORS_COLORS.limiteCisco, label: "Limite CISCO", iconClass: "fa fa-square" },
    );
    return items;
  }

  if (niveau === "primaire") {
    if (critereActif) {
      // Extension / Reconstruction / Réhabilitation :
      // établissements visibles (public + privé confondus, colorés
      // uniquement par éligibilité), villages masqués.
      items.push(
        {
          color: ORS_COLORS.eligible,
          label: `Éligible — ${critereLabel}`,
          schoolLevel: "primaire",
        },
        {
          color: ORS_COLORS.nonEligible,
          label: `Non éligible — ${critereLabel}`,
          schoolLevel: "primaire",
        },
      );
    } else {
      items.push(
        {
          color: ORS_COLORS.default,
          label: "École Primaire Publique",
          schoolLevel: "primaire",
        },
        {
          color: ORS_COLORS.villageHorsZone,
          label: "Village hors zone (hors aire de recrutement)",
          etablissementType: "village",
        },
        {
          color: ORS_COLORS.villageCouvert,
          label: "Village couvert (dans l'aire de recrutement)",
          etablissementType: "village",
        },
      );
    }
  } else {
    const isCollege = niveau === "college";
    const mainIcon: SchoolLevel = niveau;
    const secondaryIcon: SchoolLevel = isCollege ? "primaire" : "college";
    const mainLabel = isCollege ? "CEG public" : "Lycée public";
    const secondaryLabel = isCollege ? "EPP dans zone CEG" : "Collège existant";
    const exclusionLabel = isCollege ? "EPP hors zone d'un CEG" : "Collège hors zone d'un lycée";
    const privateMainLabel = isCollege ? "CEG privé" : "Lycée privé";
    const privateSecondaryLabel = isCollege ? "EPP privée" : "Collège privé";

    if (critereActif) {
      // Extension / Reconstruction / Réhabilitation :
      // établissements visibles (principal + secondaire, public + privé
      // confondus), villages masqués.
      items.push(
        {
          color: ORS_COLORS.eligible,
          label: `Éligible — ${critereLabel}`,
          schoolLevel: mainIcon,
        },
        {
          color: ORS_COLORS.nonEligible,
          label: `Non éligible — ${critereLabel}`,
          schoolLevel: mainIcon,
        },
      );
    } else {
      items.push(
        { color: NIVEAU_MAIN_COLOR[niveau], label: mainLabel, schoolLevel: mainIcon },
        { color: ORS_COLORS.default, label: secondaryLabel, schoolLevel: secondaryIcon },
        { color: ORS_COLORS.nonEligible, label: exclusionLabel, schoolLevel: secondaryIcon },
        { color: ORS_COLORS.prive, label: privateMainLabel, schoolLevel: mainIcon },
        { color: ORS_COLORS.prive, label: privateSecondaryLabel, schoolLevel: secondaryIcon },
        {
          color: ORS_COLORS.villageHorsZone,
          label: "Village hors zone (hors aire de recrutement)",
          etablissementType: "village",
        },
        {
          color: ORS_COLORS.villageCouvert,
          label: "Village couvert (dans l'aire de recrutement)",
          etablissementType: "village",
        },
      );
    }
  }

  items.push(
    { color: ORS_COLORS.limiteDren, label: "Limite DREN", iconClass: "fa fa-square" },
    { color: ORS_COLORS.limiteCisco, label: "Limite CISCO", iconClass: "fa fa-square" },
  );
  return items;
}

const ORS = () => {
  const { niveau: niveauParam } = useParams<{ niveau: string }>();
  const niveau: OrsNiveau = (
    NIVEAUX_ORDER.includes(niveauParam as OrsNiveau) ? niveauParam : "primaire"
  ) as OrsNiveau;
  const meta = NIVEAU_META[niveau];

  const {
    drens,
    ciscos,
    colleges,
    primaires,
    lycees,
    villages,
    villagesEligiblesNouvelleCreation,
    geoLayers,
    loading,
    selectedDren,
    selectedCisco,
    isFiltered,
    handleDrenChange,
    handleCiscoChange,
    fetchEtablissements,
    resetFilter,
  } = useMapData(niveau);

  const scope = useUserScope();
  const mapCaptureRef = useRef<HTMLDivElement>(null);
  const layerControlHostRef = useRef<HTMLDivElement>(null);
  const [capturingMap, setCapturingMap] = useState(false);

  // ====================== PANNEAUX GAUCHE / DROITE REPLIABLES ======================
  // Ouverts par défaut sur desktop (>=1024px, on a 2 panneaux + carte donc on
  // laisse un peu plus de place qu'une simple page à un seul panneau),
  // repliés par défaut sur mobile/tablette pour laisser la carte respirer.
  const [leftOpen, setLeftOpen] = useState<boolean>(() =>
    typeof window !== "undefined" ? window.innerWidth >= 1024 : true,
  );
  const [rightOpen, setRightOpen] = useState<boolean>(() =>
    typeof window !== "undefined" ? window.innerWidth >= 1024 : true,
  );
  const [panelSections, setPanelSections] = useState({
    search: false,
    analysis: false,
    map: false,
    layers: false,
    newCreation: false,
    categories: false,
    eligibility: false,
  });

  const togglePanelSection = (section: keyof typeof panelSections) => {
    setPanelSections((current) => ({
      ...current,
      [section]: !current[section],
    }));
  };
  useEffect(() => {
    const keepSingleDrawer = () => {
      if (window.matchMedia("(max-width: 767px)").matches && leftOpen && rightOpen) {
        setRightOpen(false);
      }
    };
    window.addEventListener("resize", keepSingleDrawer);
    return () => window.removeEventListener("resize", keepSingleDrawer);
  }, [leftOpen, rightOpen]);
  const [radius, setRadius] = useState(meta.defaultRadius);
  const [mapCenter, setMapCenter] = useState<[number, number]>([-18.9189596, 47.5135653]);
  const [mapZoom, setMapZoom] = useState(6);
  const [selectedEtablissement, setSelectedEtablissement] = useState<Etablissement | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>("aucune");
  const handleCategoryChange = useCallback((value: string) => {
    if (value === "nouvelle_creation" && niveau !== "primaire") {
      toast.error(
        niveau === "college"
          ? "Nouvelle Création non disponible pour le niveau Collège"
          : "Nouvelle Création non disponible pour le niveau Lycée",
      );
      setCategoryFilter("aucune");
      return;
    }
    setCategoryFilter(value);
  }, [niveau]);
  const [eligibiliteFilter, setEligibiliteFilter] = useState<"tous" | "eligible" | "non_eligible">(
    "tous",
  );
  useEffect(() => {
    setEligibiliteFilter("tous");
  }, [categoryFilter]);
  const [analysisResult, setAnalysisResult] = useState<VillageAnalysisResult | null>(null);
  const [layerVisibility, setLayerVisibility] = useState<LayerVisibility>({
    publiques: true,
    prives: true,
    villages: true,
    aires: false,
  });

  // Nouvelle Création : priorité partenaires — forcer la couche Villages
  // (les établissements sont masqués côté carte, seuls les villages comptent).
  useEffect(() => {
    if (categoryFilter === "nouvelle_creation") {
      setLayerVisibility((v) => (v.villages ? v : { ...v, villages: true }));
    }
  }, [categoryFilter]);
  const [etabInfoVisible, setEtabInfoVisible] = useState(true);
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [downloadFormat, setDownloadFormat] = useState<"csv" | "xlsx">("csv");
  const [downloadCategory, setDownloadCategory] = useState<
    "tous" | "extension" | "reconstruction" | "rehabilitation" | "nouvelle_creation"
  >("tous");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const handleMapCapture = useCallback(async () => {
    setCapturingMap(true);
    try {
      const date = new Date().toISOString().slice(0, 10);
      await captureMapPng(mapCaptureRef.current, `ORS_${niveau}_${date}.png`);
      toast.success("Carte ORS téléchargée");
    } catch (error) {
      console.error("ORS map capture error:", error);
      toast.error("Impossible de capturer la carte. Vérifiez que les tuiles sont chargées, puis réessayez.");
    } finally {
      setCapturingMap(false);
    }
  }, [niveau]);

  // ====================== DONNÉES SELON LE NIVEAU ACTIF ======================
  // Règles d'affichage / calcul par niveau : primaire = PUBLIC seulement ;
  // collège et lycée = PUBLIC + PRIVÉ (voir NC_CONFIG).
  const ncConfig = NC_CONFIG[niveau];
  const mainDataRaw: Etablissement[] =
    meta.mainDataKey === "primaires"
      ? primaires
      : meta.mainDataKey === "colleges"
        ? colleges
        : lycees;
  const refDataRaw: Etablissement[] =
    meta.refDataKey === "primaires" ? primaires : meta.refDataKey === "colleges" ? colleges : [];

  const mainData = useMemo(
    () => filtrerSecteur(mainDataRaw, ncConfig.existantsPrives),
    [mainDataRaw, ncConfig.existantsPrives],
  );
  const refData = useMemo(
    () => filtrerSecteur(refDataRaw, ncConfig.refsPrives),
    [refDataRaw, ncConfig.refsPrives],
  );

  // Visibilité effective : la couche "privés" n'existe pas en primaire.
  const effectiveLayerVisibility = useMemo<LayerVisibility>(
    () => ({ ...layerVisibility, prives: ncConfig.existantsPrives && layerVisibility.prives }),
    [layerVisibility, ncConfig.existantsPrives],
  );

  // Nouvelle Création : calcul UNIQUE (carte, récap, panneau, export), indépendant
  // des cases à cocher d'affichage (couches publiques/privées/villages).
  // Le moteur Nouvelle Création ne s'exécute qu'au niveau Primaire.
  // Collège et Lycée ne produisent aucun calcul ni candidat NC.
  const ncAnalysis = useMemo(
    () => niveau === "primaire"
      ? analyserNouvelleCreation({ niveau, existants: mainData, refs: refData, villages })
      : null,
    [niveau, mainData, refData, villages],
  );

  const filteredMainData = useMemo(
    () =>
      mainData.filter((e) => {
        if (isPublicSector(e)) return effectiveLayerVisibility.publiques;
        if (isPrivateSector(e)) return effectiveLayerVisibility.prives;
        return effectiveLayerVisibility.publiques || effectiveLayerVisibility.prives;
      }),
    [mainData, effectiveLayerVisibility.publiques, effectiveLayerVisibility.prives],
  );

  const filteredRefData = useMemo(
    () =>
      refData.filter((e) => {
        if (isPublicSector(e)) return effectiveLayerVisibility.publiques;
        if (isPrivateSector(e)) return effectiveLayerVisibility.prives;
        return effectiveLayerVisibility.publiques || effectiveLayerVisibility.prives;
      }),
    [refData, effectiveLayerVisibility.publiques, effectiveLayerVisibility.prives],
  );
  const filteredVillages = useMemo(
    () => (layerVisibility.villages ? villages : []),
    [villages, layerVisibility.villages],
  );
  // Contrat ORSMap : "primaires" = slot générique "couche principale" (pour
  // le lycée, ce sont les données lycées qui y transitent — comportement
  // volontaire d'ORSMap, on le respecte tel quel).
  const mapColleges =
    niveau === "lycee" ? filteredRefData : niveau === "college" ? filteredMainData : [];
  const mapPrimaires =
    niveau === "primaire"
      ? filteredMainData
      : niveau === "college"
        ? filteredRefData
        : filteredMainData;

  // ====================== STATISTIQUES ======================
  const stats = useMemo(() => {
    const total = mainData.length;
    const publics = mainData.filter(isPublicSector).length;
    const prives = mainData.filter(isPrivateSector).length;
    const refTotal = refData.length;
    const eligiblesReconstruction = mainData.filter((e) =>
      e.eligible_reconstruction === true ||
      e.eligible_reconstruction === 1 ||
      e.eligible_reconstruction === "1" ||
      e.eligible_reconstruction === "true",
    ).length;
    return { total, publics, prives, refTotal, eligiblesReconstruction };
  }, [mainData, refData]);

  const isEligibilityFlagEnabled = (value: unknown): boolean =>
    value === true || value === 1 || value === "1" || value === "true";

  /** Helpers d'éligibilité communs aux filtres, récapitulatifs et exports. */
  const isEtabEligibleForCategory = useCallback((etab: Etablissement, cat: string): boolean => {
    switch (cat) {
      case "extension":
        return isEligibilityFlagEnabled(etab.eligible_extension);
      case "reconstruction":
        return isEligibilityFlagEnabled(etab.eligible_reconstruction);
      case "rehabilitation":
        return isEligibilityFlagEnabled(etab.eligible_rehabilitation);
      default:
        return true;
    }
  }, []);

  // Source officielle Nouvelle Création : candidats retournés par Django.
  const ncCandidateFeatures =
    niveau === "primaire"
      ? villagesEligiblesNouvelleCreation.features
      : [];

  const ncCandidateStats = useMemo(() => {
    const correspondances = ncCandidateFeatures.filter(
      (feature) => feature.properties?.correspondance_village === true,
    ).length;

    const pointsProposes = ncCandidateFeatures.filter(
      (feature) => feature.properties?.correspondance_village === false,
    ).length;

    return {
      total: ncCandidateFeatures.length,
      correspondances,
      pointsProposes,
    };
  }, [ncCandidateFeatures]);

  /**
   * Récapitulatif dynamique selon la catégorie sélectionnée.
   * - Aucune : aucun récapitulatif.
   * - Nouvelle Création : candidats officiels Django au niveau Primaire.
   * - Autres critères : total des établissements et répartition éligibles/non éligibles.
   * Les compteurs restent complets quel que soit le filtre d'éligibilité de la carte.
   */
  const categoryRecap = useMemo(() => {
    if (categoryFilter === "aucune") return null;

    const catLabel = CATEGORY_FILTER_LABELS[categoryFilter] ?? categoryFilter;

    // --- Nouvelle Création : candidats officiels Django ---
    if (categoryFilter === "nouvelle_creation") {
      if (niveau !== "primaire") return null;
      return {
        catLabel,
        unit: "village/point",
        unitPlural: "villages/points",
        eligible: 0,
        nonEligible: 0,
        total: ncCandidateStats.total,
        correspondances: ncCandidateStats.correspondances,
        pointsProposes: ncCandidateStats.pointsProposes,
      };
    }

    // --- Critères établissement ---
    let eligible = 0;
    let nonEligible = 0;
    for (const etab of mainData) {
      if (isEtabEligibleForCategory(etab, categoryFilter)) eligible++;
      else nonEligible++;
    }

    return {
      catLabel,
      unit: meta.unitLabel,
      unitPlural: meta.unitLabel,
      eligible,
      nonEligible,
      total: eligible + nonEligible,
      correspondances: 0,
      pointsProposes: 0,
    };
  }, [
    categoryFilter,
    niveau,
    ncCandidateStats,
    mainData,
    meta.unitLabel,
    isEtabEligibleForCategory,
  ]);

  // ====================== DONNÉES D'EXPORT (selon le choix UNIQUEMENT) ======================
  const downloadCategories = useMemo(
    () => ({
      tous: mainData,
      extension: mainData.filter((e) => isEtabEligibleForCategory(e, "extension")),
      reconstruction: mainData.filter((e) => isEtabEligibleForCategory(e, "reconstruction")),
      rehabilitation: mainData.filter((e) => isEtabEligibleForCategory(e, "rehabilitation")),
    }),
    [mainData, niveau, isEtabEligibleForCategory],
  );

  // Nouvelle Création : export de tous les candidats officiels Django.
  const ncCandidates = ncCandidateFeatures;

  const isNcDownload = downloadCategory === "nouvelle_creation";
  const downloadData: Etablissement[] = isNcDownload ? [] : downloadCategories[downloadCategory];
  const downloadCount = isNcDownload ? ncCandidates.length : downloadData.length;

  const downloadOptions = useMemo(
    () => [
      {
        key: "tous" as const,
        label: "Tous les établissements",
        icon: <School className="w-4 h-4" />,
        count: downloadCategories.tous.length,
      },
      {
        key: "extension" as const,
        label: "Extension",
        icon: <Layers className="w-4 h-4" />,
        count: downloadCategories.extension.length,
      },
      {
        key: "reconstruction" as const,
        label: "Reconstruction",
        icon: <Building2 className="w-4 h-4" />,
        count: downloadCategories.reconstruction.length,
      },
      {
        key: "rehabilitation" as const,
        label: "Réhabilitation",
        icon: <AlertTriangle className="w-4 h-4" />,
        count: downloadCategories.rehabilitation.length,
      },
      {
        key: "nouvelle_creation" as const,
        label: "Nouvelle création",
        icon: <MapPin className="w-4 h-4" />,
        count: ncCandidates.length,
      },
    ],
    [downloadCategories, ncCandidates],
  );

  // ====================== RESET AU CHANGEMENT DE NIVEAU ======================
  const prevNiveauRef = useRef(niveau);
  useEffect(() => {
    if (prevNiveauRef.current === niveau) return;
    prevNiveauRef.current = niveau;

    setRadius(meta.defaultRadius);
    setCategoryFilter("aucune");
    setSelectedEtablissement(null);
    setAnalysisResult(null);

    if (selectedDren > 0) {
      fetchEtablissements(selectedDren, selectedCisco);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [niveau]);

  // ====================== ZOOM INTELLIGENT SUR LA ZONE ======================
  // fitSignal est incrémenté quand un filtre vient d'être appliqué (clic sur
  // « Appliquer », application automatique du scope, changement de niveau) ou
  // réinitialisé. ORSMap cadre alors la CISCO (ou la DREN) correspondante.
  const [fitSignal, setFitSignal] = useState(0);
  const prevLoadingRef = useRef(loading);
  const prevFilteredRef = useRef(isFiltered);
  useEffect(() => {
    const wasLoading = prevLoadingRef.current;
    const wasFiltered = prevFilteredRef.current;
    prevLoadingRef.current = loading;
    prevFilteredRef.current = isFiltered;
    if ((wasLoading && !loading && isFiltered) || (wasFiltered && !isFiltered)) {
      setFitSignal((s) => s + 1);
    }
  }, [loading, isFiltered]);

  // L'ancien zoom fixe (8 / 10) de useAutoApplyScope entrerait en conflit avec
  // le cadrage de la zone : on lui fournit un setter neutre.
  const ignoreAutoZoom = useCallback(() => {}, []) as unknown as typeof setMapZoom;

  const handleApplyFilter = useCallback(async () => {
    if (selectedDren === 0) {
      toast.error("Veuillez sélectionner une DREN");
      return;
    }
    setActionLoading("Application du filtre...");
    try {
      await fetchEtablissements(selectedDren, selectedCisco);
      setFitSignal((s) => s + 1);
    } finally {
      setActionLoading(null);
    }
  }, [selectedDren, selectedCisco, fetchEtablissements]);

  useAutoApplyScope({
    scope,
    selectedDren,
    selectedCisco,
    isFiltered,
    handleDrenChange,
    handleCiscoChange,
    fetchEtablissements,
    setMapZoom: ignoreAutoZoom,
  });

  const handleSearchSelect = useCallback((item: Etablissement) => {
    if (item.latitude && item.longitude) {
      setMapCenter([item.latitude, item.longitude]);
      setMapZoom(14);
      setSelectedEtablissement(item);
    }
  }, []);

  const handleVillageSearchSelect = useCallback((village: Village) => {
    if (
      !Number.isFinite(village.latitude) ||
      !Number.isFinite(village.longitude)
    ) {
      return;
    }

    setLayerVisibility((current) => ({
      ...current,
      villages: true,
    }));
    setMapCenter([village.latitude, village.longitude]);
    setMapZoom(14);
  }, []);

  const handleMarkerClick = useCallback((etablissement: Etablissement) => {
    setSelectedEtablissement(etablissement);
  }, []);

  // ====================== TÉLÉCHARGEMENT ======================
  const drenLabel =
    drens.find((d) => d.CODE_DREN === selectedDren)?.DREN ??
    (selectedDren > 0 ? `DREN ${selectedDren}` : "Toutes DREN");
  const ciscoLabel =
    selectedCisco > 0
      ? (ciscos.find((c) => c.CODE_CISCO === selectedCisco)?.CISCO ?? `CISCO ${selectedCisco}`)
      : "Toutes CISCO";

  const runDownload = useCallback(async () => {
    if (downloadCount === 0) {
      toast.error("Aucune donnée à télécharger");
      return;
    }

    setActionLoading("Génération du fichier...");

    try {
      // Seule la sélection choisie est exportée : liste d'établissements
      // (canevas ORS fixe) ou liste des villages éligibles (Nouvelle Création).
      let headers: string[];
      let table: Array<Array<string | number | boolean>>;

      if (isNcDownload) {
        if (niveau !== "primaire") {
          toast.error("Nouvelle Création est disponible uniquement pour le niveau Primaire");
          return;
        }

        headers = [
          "Village candidat",
          "Latitude",
          "Longitude",
          "Score",
          "Rang de sélection",
          "Distance village SIG (m)",
          "Correspondance village SIG",
          "ID WorldPop",
          "ID village SIG",
          "Code DREN",
          "Code CISCO",
          "Run ID",
          "Date de calcul",
        ];

        table = ncCandidates.map((feature) => {
          const properties = feature.properties;
          const coordinates =
            feature.geometry?.type === "Point" &&
            Array.isArray(feature.geometry.coordinates)
              ? feature.geometry.coordinates
              : [];

          const longitude = coordinates[0];
          const latitude = coordinates[1];

          return [
            properties.village_nom ?? "Non renseigné",
            typeof latitude === "number" && Number.isFinite(latitude) ? latitude : "",
            typeof longitude === "number" && Number.isFinite(longitude) ? longitude : "",
            properties.score ?? "",
            properties.rang_selection ?? "",
            properties.distance_village_m ?? "",
            properties.correspondance_village ? "OUI" : "NON",
            properties.worldpop_id ?? "",
            properties.village_id ?? "",
            properties.code_dren ?? "",
            properties.code_cisco ?? "",
            properties.run_id ?? "",
            properties.calcule_le ?? "",
          ];
        });
      } else {
        const columns = ORS_CSV_COLUMNS;
        headers = columns.map((c) => c.label);
        table = downloadData.map((etab) => columns.map((c) => formatExportValue(etab, c.key)));
      }

      const categorySuffix =
        downloadCategory === "tous" ? "" : `_${downloadCategory.toUpperCase()}`;

      const filename =
        `${meta.filenamePrefix}_${drenLabel}_${ciscoLabel}` +
        `${categorySuffix}_${new Date().toISOString().slice(0, 10)}`;

      if (downloadFormat === "csv") {
        const headerRow = headers.join(";");
        const rows = table.map((row) =>
          row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(";"),
        );
        const csv = [headerRow, ...rows].join("\n");

        const blob = new Blob(["\ufeff" + csv], {
          type: "text/csv;charset=utf-8;",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${filename}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      } else {
        const ws = XLSX.utils.aoa_to_sheet([headers, ...table]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, meta.label.slice(0, 31));
        XLSX.writeFile(wb, `${filename}.xlsx`);
      }

      toast.success(`${table.length} ${isNcDownload ? "villages" : "établissements"} exportés`);
      setShowDownloadModal(false);
    } finally {
      setActionLoading(null);
    }
  }, [
    downloadCount,
    isNcDownload,
    ncAnalysis,
    ncCandidates,
    niveau,
    downloadData,
    downloadCategory,
    meta,
    drenLabel,
    ciscoLabel,
    downloadFormat,
  ]);

  const eligibleReconstructionBadge = (value: boolean | undefined) =>
    value ? (
      <Badge variant="outline" className="gap-1 text-emerald-600 border-emerald-600">
        <CheckCircle className="w-3 h-3" /> OUI
      </Badge>
    ) : (
      <Badge variant="destructive" className="gap-1">
        <XCircle className="w-3 h-3" /> NON
      </Badge>
    );

  const InfoRow = ({
    icon,
    label,
    value,
    isBadge = false,
    className,
  }: {
    icon: React.ReactNode;
    label: string;
    value: React.ReactNode;
    isBadge?: boolean;
    className?: string;
  }) => (
    <div className={cn("rounded-md border bg-muted/20 p-2", className)}>
      <div className="flex items-center gap-1.5 text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className={cn("mt-1 text-xs font-medium", isBadge && "flex")}>{value}</div>
    </div>
  );

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col w-full overflow-hidden bg-muted/20">
      {/* ====================================================================
          BLOC TOP — titre, récap filtre, compteurs, téléchargement, action loading
      ==================================================================== */}
      <div className="shrink-0 sticky top-0 z-30 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 shadow-sm animate-fade-in">
        <div className="mx-auto max-w-none px-4 py-3">
          {/* LIGNE 1 — Identité et actions */}
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <div className="flex shrink-0 items-center gap-2">
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

              <div className="min-w-0">
                <h1 className="text-base sm:text-lg font-bold leading-tight text-foreground">
                  Organisation du Réseau Scolaire (ORS) — {meta.label}
                </h1>
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <SchoolLevelIcon level={niveau} className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">
                    Ministère de l'Éducation Nationale · Carte scolaire et analyse des besoins en infrastructures · {meta.breadcrumb}
                  </span>
                </p>
              </div>
            </div>

            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
              {actionLoading && (
                <Badge variant="outline" className="gap-1.5 text-xs">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  {actionLoading}
                </Badge>
              )}

              {!actionLoading && loading && (
                <Badge variant="outline" className="gap-1.5 text-xs">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Chargement...
                </Badge>
              )}

              {isFiltered && mainData.length > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 gap-1.5 text-xs"
                  onClick={() => {
                    const categories = [
                      "extension",
                      "reconstruction",
                      "rehabilitation",
                      "nouvelle_creation",
                    ] as const;

                    setDownloadCategory(
                      categories.includes(categoryFilter as (typeof categories)[number])
                        ? (categoryFilter as (typeof categories)[number])
                        : "tous",
                    );
                    setShowDownloadModal(true);
                  }}
                >
                  <Download className="h-3.5 w-3.5" />
                  Télécharger
                </Button>
              )}

              <Button
                size="sm"
                variant="outline"
                className="h-7 gap-1.5 text-xs"
                onClick={handleMapCapture}
                disabled={loading || capturingMap}
                title="Télécharger une image PNG de la carte ORS"
              >
                <FileImage className={`h-3.5 w-3.5 ${capturingMap ? "animate-pulse" : ""}`} />
                {capturingMap ? "Préparation…" : "Image PNG"}
              </Button>

              <DataActionsBar
                table="fpe_a1"
                tableLabel={`Établissements (${meta.label})`}
                compact
              />
            </div>
          </div>

          {/* LIGNE 2 — Structure harmonisée avec Donnees.tsx */}
          <div className="mt-2 flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t pt-2 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <nav
                className="inline-flex items-center rounded-md border border-border overflow-hidden shrink-0"
                aria-label="Niveau scolaire"
              >
                {NIVEAUX_ORDER.map((n) => {
                  const m = NIVEAU_META[n];
                  const active = n === niveau;

                  return (
                    <Link
                      key={n}
                      to={`/ors/${n}`}
                      onClick={() => {
                        if (n !== "primaire") {
                          toast.warning(
                            `Le niveau ${m.label} est actuellement en cours de développement. Les fonctionnalités et résultats ne sont pas encore définitifs.`,
                          );
                        }
                      }}
                      className={cn(
                        "inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide transition-colors",
                        active
                          ? cn(m.activeBg, m.activeText, "shadow-inner")
                          : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground",
                      )}
                      aria-current={active ? "page" : undefined}
                    >
                      <SchoolLevelIcon level={n} className="h-3 w-3" /> {m.label}
                    </Link>
                  );
                })}
              </nav>
              <span className="text-foreground">
                Niveau : <strong>{meta.label}</strong>
              </span>
            </div>

            <div className="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-x-3 gap-y-1 text-xs">
              {(selectedDren > 0 || selectedCisco > 0) && (
                <span className="text-muted-foreground">
                  {selectedDren > 0 && drenLabel}
                  {selectedDren > 0 && selectedCisco > 0 && " · "}
                  {selectedCisco > 0 && ciscoLabel}
                </span>
              )}

              {!loading && categoryFilter !== "aucune" && categoryRecap && (
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md bg-muted/60 px-2.5 py-1">
                  <span className="font-semibold text-foreground">
                    {categoryRecap.catLabel}
                  </span>

                  {categoryFilter === "nouvelle_creation" ? (
                    <>
                      <span className="font-semibold tabular-nums">
                        {categoryRecap.total.toLocaleString("fr-FR")} villages éligibles
                      </span>
                      <span className="tabular-nums" style={{ color: ORS_COLORS.eligible }}>
                        {categoryRecap.correspondances.toLocaleString("fr-FR")} villages détectés
                      </span>
                      <span className="tabular-nums">
                        {categoryRecap.pointsProposes.toLocaleString("fr-FR")} points proposés
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="font-semibold tabular-nums">
                        {categoryRecap.total.toLocaleString("fr-FR")} établissements
                      </span>
                      <span className="tabular-nums" style={{ color: ORS_COLORS.eligible }}>
                        {categoryRecap.eligible.toLocaleString("fr-FR")} éligibles
                      </span>
                      <span className="tabular-nums" style={{ color: ORS_COLORS.nonEligible }}>
                        {categoryRecap.nonEligible.toLocaleString("fr-FR")} non éligibles
                      </span>
                    </>
                  )}
                </div>
              )}

              {loading && categoryFilter !== "aucune" && (
                <span className="text-muted-foreground">Actualisation du récapitulatif...</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ====================================================================
          BLOC BOTTOM — 3 panneaux : gauche (filtres/recherche/analyse) repliable,
          centre (carte, adaptatif), droite (couches/légende/catégorie) repliable
          - Chaque panneau latéral a son propre overflow-y (scrollbar indépendante)
          - En repli (w-0), la carte (flex-1) occupe tout le parent
          - Légende flottante de la carte désactivée (showLegend={false}) :
            la légende unique est celle du panneau droit
      ==================================================================== */}
      <div className="flex-1 flex overflow-hidden relative min-h-0">
        {/* ---------- PANNEAU GAUCHE ---------- */}
        <aside
          className={cn(
            "relative z-10 shrink-0 h-full min-h-0 bg-background/80 backdrop-blur-xl border-r shadow-xl flex flex-col overflow-hidden transition-[width,flex-basis,min-width] duration-300 ease-in-out",
            leftOpen
              ? "w-[300px] min-w-[300px] max-w-[300px] flex-[0_0_300px]"
              : "w-0 min-w-0 max-w-0 flex-[0_0_0px] border-r-0",
          )}
          aria-hidden={!leftOpen}
        >
          {/* Conteneur scrollable propre au panneau gauche */}
          <div className="h-full w-full overflow-y-auto overflow-x-hidden overscroll-contain smooth-scroll">
            <div className={cn("mx-auto flex w-full max-w-[270px] flex-col justify-center gap-3 px-3 py-5 transition-transform duration-300 ease-in-out motion-reduce:transition-none", leftOpen ? "translate-x-0" : "-translate-x-full")}>
              {/* Filtres + Recherche (layerVisibility → panneau droit) */}
              <MapFilters
                drens={drens}
                ciscos={ciscos}
                selectedDren={selectedDren}
                selectedCisco={selectedCisco}
                radius={radius}
                niveau={niveau}
                aireRecrutementMeters={AIRE_RECRUTEMENT_RADIUS[niveau]}
                onDrenChange={handleDrenChange}
                onCiscoChange={handleCiscoChange}
                onRadiusChange={setRadius}
                onApplyFilter={handleApplyFilter}
                onResetFilter={resetFilter}
                loading={loading || !!actionLoading}
                isFiltered={isFiltered}
                drenLocked={scope.drenLocked}
                ciscoLocked={scope.ciscoLocked}
              />

              <Card className="shadow-sm border-border/80 w-full">
                <CollapsibleCardHeader
                  title="Recherches"
                  icon={Search}
                  open={panelSections.search}
                  onToggle={() => togglePanelSection("search")}
                />
                <div hidden={!panelSections.search} className="px-3 pb-3 pt-0">
                  <MapSearch
                    searchItems={[...mainData, ...refData]}
                    villages={villages}
                    onSearchSelect={handleSearchSelect}
                    onVillageSelect={handleVillageSearchSelect}
                    showTitle={false}
                  />
                </div>
              </Card>

              <HelpPanel type={meta.helpType} />

              {(mainData.length > 0 ||
                (niveau === "primaire" && (ncCandidateStats.total > 0 || (ncAnalysis?.stats.villagesTotal ?? 0) > 0))) && (
                <Card className="shadow-sm border-border/80 w-full">
                  <CollapsibleCardHeader
                    title="Analyses d'éligibilités"
                    icon={Building2}
                    open={panelSections.analysis}
                    onToggle={() => togglePanelSection("analysis")}
                  />
                  <div hidden={!panelSections.analysis}>
                    <div className="w-full px-3 pb-3 pt-0">
                      <ORSAnalysisPanel
                        type={niveau}
                        primaires={
                          niveau === "primaire" ? mainData : niveau === "college" ? refData : []
                        }
                        colleges={niveau === "college" ? mainData : niveau === "lycee" ? refData : []}
                        lycees={niveau === "lycee" ? mainData : []}
                        nc={ncAnalysis}
                        villagesEligiblesNouvelleCreation={villagesEligiblesNouvelleCreation}
                      />
                    </div>
                  </div>
                </Card>
              )}
            </div>
          </div>
        </aside>

        {/* Bouton repli/déploi GAUCHE */}
        <button
          type="button"
          onClick={() => {
            if (window.matchMedia("(max-width: 767px)").matches && !leftOpen) setRightOpen(false);
            setLeftOpen((v) => !v);
          }}
          title={leftOpen ? "Réduire le panneau filtres" : "Développer le panneau filtres"}
          className="absolute top-1/2 -translate-y-1/2 -ml-4 z-[1500] bg-background border shadow-xl rounded-full w-9 h-9 flex items-center justify-center hover:bg-muted transition-[left] duration-300 ease-in-out motion-reduce:transition-none"
          style={{ left: leftOpen ? "calc(300px - 18px)" : "0px" }}
        >
          {leftOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>

        {/* ---------- PANNEAU CENTRE (carte, s'étend sur tout l'espace restant) ---------- */}
        <div ref={mapCaptureRef} className="relative z-0 overflow-hidden min-w-0 min-h-0 h-full flex-1">
          {loading && (
            <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-[1400] flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                <span className="text-sm text-muted-foreground">Chargement des données...</span>
              </div>
            </div>
          )}
          <ORSMap
            colleges={mapColleges}
            primaires={mapPrimaires}
            radius={radius}
            type={niveau}
            onMarkerClick={handleMarkerClick}
            center={mapCenter}
            zoom={mapZoom}
            categoryFilter={categoryFilter}
            eligibiliteFilter={eligibiliteFilter}
            geoLayers={geoLayers}
            villages={filteredVillages}
            villagesEligiblesNouvelleCreation={villagesEligiblesNouvelleCreation}
            onVillageAnalysis={setAnalysisResult}
            showLegend={false}
            layerVisibility={effectiveLayerVisibility}
            etabInfoVisible={etabInfoVisible}
            ncAnalysis={ncAnalysis}
            fitSignal={fitSignal}
            zoneLevel={selectedCisco > 0 ? "cisco" : selectedDren > 0 ? "dren" : null}
            layerControlHostRef={layerControlHostRef}
          />
        </div>

        {/* Bouton repli/déploi DROITE */}
        <button
          type="button"
          onClick={() => {
            if (window.matchMedia("(max-width: 767px)").matches && !rightOpen) setLeftOpen(false);
            setRightOpen((v) => !v);
          }}
          title={rightOpen ? "Réduire le panneau couches" : "Développer le panneau couches"}
          className="absolute top-1/2 -translate-y-1/2 -mr-4 z-[1500] bg-background border shadow-xl rounded-full w-9 h-9 flex items-center justify-center hover:bg-muted transition-[right] duration-300 ease-in-out motion-reduce:transition-none"
          style={{ right: rightOpen ? "calc(300px - 18px)" : "0px" }}
        >
          {rightOpen ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>

        {/* ---------- PANNEAU DROITE ---------- */}
        <aside
          className={cn(
            "relative z-10 shrink-0 h-full min-h-0 bg-background/80 backdrop-blur-xl border-l shadow-xl flex flex-col overflow-hidden transition-[width,flex-basis,min-width] duration-300 ease-in-out",
            rightOpen
              ? "w-[300px] min-w-[300px] max-w-[300px] flex-[0_0_300px]"
              : "w-0 min-w-0 max-w-0 flex-[0_0_0px] border-l-0",
          )}
          aria-hidden={!rightOpen}
        >
          {/* Conteneur scrollable propre au panneau droit */}
          <div className="h-full w-full overflow-y-auto overflow-x-hidden overscroll-contain smooth-scroll">
            <div className={cn("mx-auto flex w-full max-w-[270px] flex-col justify-center gap-2.5 px-3 py-5 transition-transform duration-300 ease-in-out motion-reduce:transition-none", rightOpen ? "translate-x-0" : "translate-x-full")}>
              {/* Choix de carte et délimitations — représentation SIG */}
              <Card className="shadow-sm border-border/80 w-full">
                <CollapsibleCardHeader
                  title="Choix de carte et délimitations"
                  icon={Layers}
                  open={panelSections.map}
                  onToggle={() => togglePanelSection("map")}
                />
                <CardContent className="px-3 pb-3 pt-0">
                  <div hidden={!panelSections.map}>
                  <div
                    ref={layerControlHostRef}
                    className="sig-layer-panel-host"
                  />

                  </div>
                </CardContent>
              </Card>

              {/* Couches à afficher */}
              <Card className="shadow-sm border-border/80 w-full">
                <CollapsibleCardHeader
                  title="Couches à afficher"
                  icon={Layers}
                  open={panelSections.layers}
                  onToggle={() => togglePanelSection("layers")}
                />
                <CardContent className="px-3 pb-3 pt-0 space-y-1.5">
                  <div hidden={!panelSections.layers}>
                  <div className="grid grid-cols-1 gap-1">
                    <label className="flex items-center gap-2 p-1 rounded hover:bg-muted/50 cursor-pointer transition-colors">
                      <Checkbox
                        checked={layerVisibility.publiques}
                        onCheckedChange={(checked) =>
                          setLayerVisibility((v) => ({
                            ...v,
                            publiques: !!checked,
                          }))
                        }
                      />
                      <span className="text-xs flex items-center gap-1.5">
                        Établissements publiques
                      </span>
                    </label>
                    {ncConfig.existantsPrives && (
                      <label className="flex items-center gap-2 p-1.5 rounded hover:bg-muted/50 cursor-pointer transition-colors">
                        <Checkbox
                          checked={layerVisibility.prives}
                          onCheckedChange={(checked) =>
                            setLayerVisibility((v) => ({
                              ...v,
                              prives: !!checked,
                            }))
                          }
                        />
                        <span className="text-xs flex items-center gap-1.5">
                          Établissements privées
                        </span>
                      </label>
                    )}
                    <label className="flex items-center gap-2 p-1.5 rounded hover:bg-muted/50 cursor-pointer transition-colors">
                      <Checkbox
                        checked={layerVisibility.villages}
                        onCheckedChange={(checked) =>
                          setLayerVisibility((v) => ({
                            ...v,
                            villages: !!checked,
                          }))
                        }
                      />
                      <span className="text-xs flex items-center gap-1.5">Villages</span>
                    </label>
                    <label className="flex items-center gap-2 p-1.5 rounded hover:bg-muted/50 cursor-pointer transition-colors">
                      <Checkbox
                        checked={etabInfoVisible}
                        onCheckedChange={(checked) => setEtabInfoVisible(!!checked)}
                      />
                      <span className="text-xs flex items-center gap-1.5">INFOS ÉTAB.</span>
                    </label>
                    <div className="p-1.5 rounded transition-colors">
                      <span className="text-xs flex items-center gap-1.5 mb-1">
                        Aires de recrutement
                      </span>
                      <RadioGroup
                        value={layerVisibility.aires ? "affichees" : "masquees"}
                        onValueChange={(v) =>
                          setLayerVisibility((prev) => ({
                            ...prev,
                            aires: v === "affichees",
                          }))
                        }
                        className="flex items-center gap-3 pl-1"
                      >
                        <div className="flex items-center space-x-1.5">
                          <RadioGroupItem value="masquees" id="aires-masquees" />
                          <Label
                            htmlFor="aires-masquees"
                            className="text-xs cursor-pointer font-normal"
                          >
                            Masquées
                          </Label>
                        </div>
                        <div className="flex items-center space-x-1.5">
                          <RadioGroupItem value="affichees" id="aires-affichees" />
                          <Label
                            htmlFor="aires-affichees"
                            className="text-xs cursor-pointer font-normal"
                          >
                            Affichées
                          </Label>
                        </div>
                      </RadioGroup>
                    </div>
                  </div>


                  </div>
                </CardContent>
              </Card>

              {/* Contrôles Nouvelle Création — candidats issus de Django */}
              <Card className="shadow-sm border-border/80 w-full">
                <CollapsibleCardHeader
                  title="Contrôles Nouvelle Création"
                  icon={MapPin}
                  open={panelSections.newCreation}
                  onToggle={() => togglePanelSection("newCreation")}
                />
                <CardContent className="px-3 pb-3 pt-0">
                  <div hidden={!panelSections.newCreation} className="space-y-3">
                    {niveau !== "primaire" ? (
                      <p className="text-[11px] text-muted-foreground">
                        Nouvelle Création n’est disponible que pour le niveau Primaire.
                      </p>
                    ) : selectedDren <= 0 || selectedCisco <= 0 ? (
                      <p className="text-[11px] text-muted-foreground">
                        Sélectionnez une DREN et une CISCO pour consulter les villages de ce périmètre.
                      </p>
                    ) : (
                      <>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-xs font-medium">
                            villages pour le périmètre sélectionné
                          </span>
                          <Badge variant="outline" className="text-[10px]">
                            {ncCandidateFeatures.length > 0
                              ? "Données reçues"
                              : "Aucune donnée reçue"}
                          </Badge>
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                          <div className="rounded-md bg-muted/50 p-2 text-center">
                            <div className="text-base font-semibold tabular-nums">
                              {ncCandidateStats.total.toLocaleString("fr-FR")}
                            </div>
                            <div className="text-[10px] text-muted-foreground">Villages/Points</div>
                          </div>
                          <div className="rounded-md bg-muted/50 p-2 text-center">
                            <div className="text-base font-semibold tabular-nums text-emerald-600">
                              {ncCandidateStats.correspondances.toLocaleString("fr-FR")}
                            </div>
                            <div className="text-[10px] text-muted-foreground">Correspondances SIG</div>
                          </div>
                          <div className="rounded-md bg-muted/50 p-2 text-center">
                            <div className="text-base font-semibold tabular-nums">
                              {ncCandidateStats.pointsProposes.toLocaleString("fr-FR")}
                            </div>
                            <div className="text-[10px] text-muted-foreground">Points proposés</div>
                          </div>
                        </div>

                        {ncCandidateFeatures.length > 0 ? (
                          <>
                            <div className="text-[11px] text-muted-foreground">
                              Liste des candidats reçus pour le périmètre sélectionné
                              (30 premiers affichés).
                            </div>
                            <div className="max-h-64 space-y-1 overflow-y-auto rounded-md border border-border p-2">
                              {ncCandidateFeatures.slice(0, 30).map((feature) => {
                                const p = feature.properties;
                                return (
                                  <div
                                    key={feature.id}
                                    className="flex items-start justify-between gap-2 border-b border-border/60 py-1.5 last:border-0"
                                  >
                                    <div className="min-w-0">
                                      <div className="truncate text-xs font-medium">
                                        {p.village_nom || `Point candidat ${p.id}`}
                                      </div>
                                      <div className="text-[10px] text-muted-foreground">
                                        Rang {p.rang_selection}
                                        {" · "}
                                        Score {Number(p.score).toLocaleString("fr-FR")}
                                      </div>
                                    </div>
                                    <Badge
                                      variant={p.correspondance_village ? "outline" : "secondary"}
                                      className="shrink-0 text-[9px]"
                                    >
                                      {p.correspondance_village
                                        ? "Correspondance SIG"
                                        : "Point proposé"}
                                    </Badge>
                                  </div>
                                );
                              })}
                            </div>
                            {ncCandidateFeatures.length > 30 && (
                              <p className="text-[10px] text-muted-foreground">
                                {ncCandidateFeatures.length - 30} autres candidats non affichés dans cette liste.
                                Tous les candidats restent représentés sur la carte.
                              </p>
                            )}
                          </>
                        ) : (
                          <p className="rounded-md border border-dashed p-3 text-[11px] text-muted-foreground">
                            Aucun candidat n’a été retourné par la source Django pour cette sélection.
                          </p>
                        )}
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Catégorie de la carte */}
              {mainData.length > 0 && (
                <Card className="shadow-sm border-border/80 w-full">
                  <CollapsibleCardHeader
                    title="Catégorie de la carte"
                    icon={AlertTriangle}
                    open={panelSections.categories}
                    onToggle={() => togglePanelSection("categories")}
                  />
                  <CardContent className="px-3 pb-3 pt-0">
                    <div hidden={!panelSections.categories}>
                    <RadioGroup
                      value={categoryFilter}
                      onValueChange={handleCategoryChange}
                      className="space-y-1"
                    >
                      <div className="flex items-center space-x-2 p-1.5 rounded-lg hover:bg-muted/50 transition-colors">
                        <RadioGroupItem value="aucune" id="cat-aucune" />
                        <Label htmlFor="cat-aucune" className="text-sm cursor-pointer flex-1">
                          Aucune
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2 p-1.5 rounded-lg hover:bg-muted/50 transition-colors">
                        <RadioGroupItem value="nouvelle_creation" id="cat-nouvelle-creation" />
                        <Label
                          htmlFor="cat-nouvelle-creation"
                          className="text-sm cursor-pointer flex-1"
                        >
                          Nouvelle Création
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2 p-1.5 rounded-lg hover:bg-muted/50 transition-colors">
                        <RadioGroupItem value="extension" id="cat-extension" />
                        <Label htmlFor="cat-extension" className="text-sm cursor-pointer flex-1">
                          Extension
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2 p-1.5 rounded-lg hover:bg-muted/50 transition-colors">
                        <RadioGroupItem value="reconstruction" id="cat-reconstruction" />
                        <Label
                          htmlFor="cat-reconstruction"
                          className="text-sm cursor-pointer flex-1"
                        >
                          Reconstruction
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2 p-1.5 rounded-lg hover:bg-muted/50 transition-colors">
                        <RadioGroupItem value="rehabilitation" id="cat-rehabilitation" />
                        <Label
                          htmlFor="cat-rehabilitation"
                          className="text-sm cursor-pointer flex-1"
                        >
                          Réhabilitation
                        </Label>
                      </div>
                    </RadioGroup>

                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Filtrer par éligibilité — visible uniquement quand un
                  critère (Nouvelle Création / Extension / Reconstruction /
                  Réhabilitation) est actif. */}
              {categoryFilter !== "aucune" && (
                <Card className="shadow-sm border-border/80 w-full">
                  <CollapsibleCardHeader
                    title="Filtrer par éligibilité"
                    icon={CheckCircle}
                    open={panelSections.eligibility}
                    onToggle={() => togglePanelSection("eligibility")}
                  />
                  <CardContent className="px-3 pb-3 pt-0">
                    <div hidden={!panelSections.eligibility}>
                    <RadioGroup
                      value={eligibiliteFilter}
                      onValueChange={(v) => setEligibiliteFilter(v as typeof eligibiliteFilter)}
                      className="space-y-1"
                    >
                      <div className="flex items-center space-x-2 p-1.5 rounded-lg hover:bg-muted/50 transition-colors">
                        <RadioGroupItem value="tous" id="elig-tous" />
                        <Label htmlFor="elig-tous" className="text-sm cursor-pointer flex-1">
                          Tous
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2 p-1.5 rounded-lg hover:bg-muted/50 transition-colors">
                        <RadioGroupItem value="eligible" id="elig-eligible" />
                        <Label
                          htmlFor="elig-eligible"
                          className="text-sm cursor-pointer flex-1 flex items-center gap-1.5"
                        >
                          <CheckCircle
                            className="w-3.5 h-3.5"
                            style={{ color: ORS_COLORS.eligible }}
                          />
                          Éligibles
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2 p-1.5 rounded-lg hover:bg-muted/50 transition-colors">
                        <RadioGroupItem value="non_eligible" id="elig-non-eligible" />
                        <Label
                          htmlFor="elig-non-eligible"
                          className="text-sm cursor-pointer flex-1 flex items-center gap-1.5"
                        >
                          <XCircle
                            className="w-3.5 h-3.5"
                            style={{ color: ORS_COLORS.nonEligible }}
                          />
                          Non éligibles
                        </Label>
                      </div>
                    </RadioGroup>

                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Légende — seule source de vérité (pas de légende flottante sur la carte) */}
              <Card className="shadow-sm border-border/80 w-full">
                <CardHeader className="py-2 px-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-primary" />
                    Légende
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-3 pb-3 pt-0">
                  <div className="space-y-1">
                    {getLegendItems(niveau, categoryFilter).map((item, i) => (
                      <div key={i} className="flex items-center gap-2">
                        {item.schoolLevel ? (
                          <SchoolLevelIcon
                            level={item.schoolLevel}
                            className="h-4 w-4 shrink-0"
                            style={{ color: item.color }}
                          />
                        ) : item.etablissementType ? (
                          <EtablissementIcon
                            type={item.etablissementType}
                            className="h-4 w-4 shrink-0"
                            style={{ color: item.color }}
                          />
                        ) : item.iconClass ? (
                          <span
                            className="inline-block h-3 w-6 shrink-0 border-2 bg-transparent"
                            style={{ borderColor: item.color }}
                            aria-hidden="true"
                          />
                        ) : (
                          <span
                            className="inline-block w-3 h-3 rounded-full border border-black/10 shrink-0"
                            style={{ backgroundColor: item.color }}
                          />
                        )}
                        <span className="text-xs text-foreground">{item.label}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </aside>
      </div>

      {/* ====================================================================
          MODALES
      ==================================================================== */}
      <Dialog open={showDownloadModal} onOpenChange={setShowDownloadModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Download className="w-5 h-5 text-primary" />
              Télécharger — {meta.label}
            </DialogTitle>

            <DialogDescription>
              Zone : <strong>{drenLabel}</strong> — {ciscoLabel}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            {/* Choix : seule la sélection est exportée */}
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                Données à exporter
              </Label>

              <div className="space-y-2">
                {downloadOptions
                  .filter((o) => o.key === "tous" || o.count > 0)
                  .map((o) => (
                    <Button
                      key={o.key}
                      type="button"
                      variant={downloadCategory === o.key ? "default" : "outline"}
                      className="w-full h-11 justify-between"
                      onClick={() => setDownloadCategory(o.key)}
                    >
                      <span className="flex items-center gap-2">
                        {o.icon}
                        {o.label}
                      </span>
                      <Badge variant={downloadCategory === o.key ? "secondary" : "outline"}>
                        {o.count}
                      </Badge>
                    </Button>
                  ))}
              </div>
            </div>

            {/* Récapitulatif */}
            <div className="bg-muted/40 rounded-lg p-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {isNcDownload ? "Villages à exporter" : "Établissements à exporter"}
                </span>
                <Badge variant="secondary">{downloadCount}</Badge>
              </div>

              {downloadCategory !== "tous" && (
                <div className="mt-2 text-xs text-muted-foreground">
                  Catégorie :{" "}
                  <span className="font-medium text-foreground">
                    {downloadOptions.find((o) => o.key === downloadCategory)?.label}
                  </span>
                </div>
              )}
            </div>

            {/* Format */}
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                Format
              </Label>

              <Select
                value={downloadFormat}
                onValueChange={(v) => setDownloadFormat(v as "csv" | "xlsx")}
              >
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>

                <SelectContent>
                  <SelectItem value="csv">
                    <span className="flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      CSV
                    </span>
                  </SelectItem>

                  <SelectItem value="xlsx">
                    <span className="flex items-center gap-2">
                      <FileSpreadsheet className="w-4 h-4" />
                      Excel (.xlsx)
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={runDownload}
              className="w-full h-10"
              disabled={downloadCount === 0 || !!actionLoading}
            >
              {actionLoading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Download className="w-4 h-4 mr-2" />
              )}
              Télécharger {downloadCount} {isNcDownload ? "village" : "établissement"}
              {downloadCount > 1 ? "s" : ""}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedEtablissement} onOpenChange={() => setSelectedEtablissement(null)}>
        <DialogContent className="max-w-2xl p-3 sm:p-4">
          <DialogHeader className="pb-2">
            <DialogTitle className="flex items-center gap-2 text-base">
              <SchoolLevelIcon level={niveau} className="w-4 h-4 text-primary" />
              {selectedEtablissement?.NOM_ETAB || "Établissement"}
            </DialogTitle>
          </DialogHeader>
          {selectedEtablissement && (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2 rounded-md border border-primary/15 bg-primary/5 px-2.5 py-2">
                <div className="min-w-0">
                  <div className="text-[9px] uppercase tracking-wide text-muted-foreground">
                    Code
                  </div>
                  <div className="truncate text-sm font-semibold text-foreground">
                    {selectedEtablissement.CODE_ETAB || "Non renseigné"}
                  </div>
                </div>
                <Badge
                  variant={
                    normalizeSectorValue(selectedEtablissement.SECTEUR) === 1
                      ? "secondary"
                      : "default"
                  }
                  className="shrink-0 whitespace-nowrap text-[10px]"
                >
                  {getSectorLabel(selectedEtablissement.SECTEUR)}
                </Badge>
              </div>

              <Card className="border-0 shadow-none">
                <CardContent className="p-0">
                  <div className="grid gap-2 md:grid-cols-2">
                    {selectedEtablissement.COMMUNE ? (
                      <InfoRow
                        icon={<MapPin className="w-3.5 h-3.5 text-muted-foreground" />}
                        label="Commune"
                        value={selectedEtablissement.COMMUNE}
                      />
                    ) : null}
                    {selectedEtablissement.FOKONTANY ? (
                      <InfoRow
                        icon={<MapPin className="w-3.5 h-3.5 text-muted-foreground" />}
                        label="Fokontany"
                        value={selectedEtablissement.FOKONTANY}
                      />
                    ) : null}
                    {selectedEtablissement.effectifs !== null &&
                    selectedEtablissement.effectifs !== undefined &&
                    String(selectedEtablissement.effectifs) !== "" ? (
                      <InfoRow
                        icon={<Users className="w-3.5 h-3.5 text-muted-foreground" />}
                        label="Effectif total"
                        value={String(selectedEtablissement.effectifs)}
                      />
                    ) : null}
                    {selectedEtablissement.eff_t5 !== null &&
                    selectedEtablissement.eff_t5 !== undefined &&
                    String(selectedEtablissement.eff_t5) !== "" ? (
                      <InfoRow
                        icon={<Users className="w-3.5 h-3.5 text-muted-foreground" />}
                        label="Effectif T5"
                        value={String(selectedEtablissement.eff_t5)}
                      />
                    ) : null}
                    {selectedEtablissement.eff_2024 !== null &&
                    selectedEtablissement.eff_2024 !== undefined &&
                    String(selectedEtablissement.eff_2024) !== "" ? (
                      <InfoRow
                        icon={<Users className="w-3.5 h-3.5 text-muted-foreground" />}
                        label="Effectif 2024"
                        value={String(selectedEtablissement.eff_2024)}
                      />
                    ) : null}
                    {selectedEtablissement.sdc_be !== null &&
                    selectedEtablissement.sdc_be !== undefined &&
                    String(selectedEtablissement.sdc_be) !== "" ? (
                      <InfoRow
                        icon={<CheckCircle className="w-3.5 h-3.5 text-emerald-600" />}
                        label="Salles bonnes"
                        value={String(selectedEtablissement.sdc_be)}
                      />
                    ) : null}
                    {selectedEtablissement.sdc_me !== null &&
                    selectedEtablissement.sdc_me !== undefined &&
                    String(selectedEtablissement.sdc_me) !== "" ? (
                      <InfoRow
                        icon={<AlertTriangle className="w-3.5 h-3.5 text-rose-600" />}
                        label="Salles dégradées"
                        value={String(selectedEtablissement.sdc_me)}
                      />
                    ) : null}
                    {selectedEtablissement.sdc_requis !== null &&
                    selectedEtablissement.sdc_requis !== undefined &&
                    String(selectedEtablissement.sdc_requis) !== "" ? (
                      <InfoRow
                        icon={<XCircle className="w-3.5 h-3.5 text-muted-foreground" />}
                        label="Salles requises"
                        value={String(selectedEtablissement.sdc_requis)}
                      />
                    ) : null}
                    {selectedEtablissement.places !== null &&
                    selectedEtablissement.places !== undefined &&
                    String(selectedEtablissement.places) !== "" ? (
                      <InfoRow
                        icon={<Users className="w-3.5 h-3.5 text-muted-foreground" />}
                        label="Places"
                        value={String(selectedEtablissement.places)}
                      />
                    ) : null}

                    {selectedEtablissement.eligible_extension !== null &&
                    selectedEtablissement.eligible_extension !== undefined ? (
                      <InfoRow
                        icon={<Building2 className="w-3.5 h-3.5 text-blue-600" />}
                        label="Extension"
                        value={eligibleReconstructionBadge(
                          isEligibilityFlagEnabled(selectedEtablissement.eligible_extension),
                        )}
                        isBadge
                      />
                    ) : null}
                    {selectedEtablissement.eligible_reconstruction !== null &&
                    selectedEtablissement.eligible_reconstruction !== undefined ? (
                      <InfoRow
                        icon={<Building2 className="w-3.5 h-3.5 text-rose-600" />}
                        label="Reconstruction"
                        value={eligibleReconstructionBadge(
                          isEligibilityFlagEnabled(selectedEtablissement.eligible_reconstruction),
                        )}
                        isBadge
                      />
                    ) : null}
                    {selectedEtablissement.eligible_rehabilitation !== null &&
                    selectedEtablissement.eligible_rehabilitation !== undefined ? (
                      <InfoRow
                        icon={<AlertTriangle className="w-3.5 h-3.5 text-amber-600" />}
                        label="Réhabilitation"
                        value={
                          eligibleReconstructionBadge(
                            isEligibilityFlagEnabled(selectedEtablissement.eligible_rehabilitation),
                          )
                        }
                        isBadge
                      />
                    ) : null}
                    {getCoordinateLabel(selectedEtablissement) !== "Non renseigné" ? (
                      <InfoRow
                        icon={<MapPin className="w-3.5 h-3.5 text-muted-foreground" />}
                        label="Coordonnées"
                        value={getCoordinateLabel(selectedEtablissement)}
                        className="md:col-span-2"
                      />
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <VillageAnalysisDialog
        result={analysisResult}
        open={!!analysisResult}
        onOpenChange={(open) => !open && setAnalysisResult(null)}
      />
    </div>
  );
};

export default ORS;