import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { useMapData, Etablissement } from "@/hooks/useMapData";
import {
  MapFilters,
  type LayerVisibility,
  type TableBancFilter,
} from "@/components/ors/MapFilters";
import { ORSMap } from "@/components/ors/ORSMap";
import { ORS_COLORS, NIVEAU_MAIN_COLOR } from "@/components/ors/orsColors";
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
  FileSpreadsheet,
  FileText,
  Layers,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import DataActionsBar from "@/components/admin/DataActionsBar";
import { useUserScope } from "@/hooks/useUserScope";
import useAutoApplyScope from "@/hooks/useAutoApplyScope";
import { VillageAnalysisDialog } from "@/components/ors/VillageAnalysisDialog";
import type { VillageAnalysisResult } from "@/components/ors/MapInteractions";
import { HelpPanel } from "@/components/ors/HelpPanel";
import { cn } from "@/lib/utils";
import { ORS_CSV_COLUMNS } from "@/utils/csvExport";
import * as XLSX from "xlsx";

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
    defaultRadius: 4000,
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
    defaultRadius: 5000,
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
    defaultRadius: 8000,
    filenamePrefix: "ORS_LYCEE",
  },
};

const NIVEAUX_ORDER: OrsNiveau[] = ["primaire", "college", "lycee"];

const normalizeSectorValue = (value: unknown): 0 | 1 | 2 | null => {
  if (value === null || value === undefined || value === "") return null;

  if (typeof value === "number") {
    if (value === 0 || value === 2) return value;
    if (value === 1) return 1;
    return null;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toUpperCase();
    if (["0", "PUBLIC", "PUBLIQUE"].includes(normalized)) return 0;
    if (["2", "PUBLIC_2", "PUBLIQUE_2"].includes(normalized)) return 2;
    if (["1", "PRIVE", "PRIVÉ", "PRIVEE", "PRIVATE"].includes(normalized)) return 1;
    return null;
  }

  return null;
};

const isPublicSector = (item: Pick<Etablissement, "SECTEUR"> | null | undefined): boolean => {
  const normalized = normalizeSectorValue(item?.SECTEUR);
  return normalized === 0 || normalized === 2;
};

const isPrivateSector = (item: Pick<Etablissement, "SECTEUR"> | null | undefined): boolean =>
  normalizeSectorValue(item?.SECTEUR) === 1;

const getSectorLabel = (value: unknown): string => {
  const normalized = normalizeSectorValue(value);
  if (normalized === 1) return "PRIVÉ";
  if (normalized === 0 || normalized === 2) return "PUBLIC";
  return "Non déterminé";
};

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

  if (key === "SECTEUR")
    return v === 0 || v === "0" || v === 2 || v === "2"
      ? "PUBLIC"
      : v === 1 || v === "1"
        ? "PRIVÉ"
        : "Non renseigné";
  if (key === "eligible_reconstruction" || key === "eligible_rehabilitation")
    return v === true || v === 1 || v === "1" || v === "true" ? "OUI" : "NON";
  // Ne jamais produire de cellule vide : le libellé indique clairement que la
  // donnée n'était pas fournie par la source, sans inventer une valeur métier.
  if (v === null || v === undefined || v === "") return "Non renseigné";
  if (typeof v === "object") return JSON.stringify(v);
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return v;
  return String(v);
};

// Légende unique du panneau droit. La pastille flottante <MapLegend> de
// ORSMap est désactivée via showLegend={false} pour éviter la duplication.
//
// Fix #1 (audit du 19/08/2026) : cette légende était une table STATIQUE et
// fausse sur deux points vérifiés en la comparant au rendu réel de
// ORSMap.tsx :
//   - "CEG public" et "Lycée public" étaient annoncés en cyan (#36b9cc) alors
//     que le marqueur principal est réellement rendu en vert (#16a34a) pour
//     le CEG et en violet (#8b5cf6) pour le Lycée.
//   - Elle ne documentait JAMAIS les couleurs des filtres "Extension /
//     Reconstruction / Réhabilitation / Table-bancs" pour collège et lycée,
//     alors que ces filtres sont sélectionnables (RadioGroup "Catégorie de
//     la carte" ci-dessous) et recolorent bel et bien les marqueurs.
//   - Elle listait "Nouvelle création" bien qu'aucune option de l'UI ne
//     permette de sélectionner ce filtre (entrée morte, supprimée ici).
//
// Elle est remplacée par une fonction qui (a) importe ses couleurs de
// ORS_COLORS / NIVEAU_MAIN_COLOR — exportées par ORSMap.tsx, seule source de
// vérité — pour ne plus jamais diverger du rendu réel, et (b) s'adapte au
// filtre de catégorie actif pour toujours documenter les couleurs
// effectivement visibles sur la carte.
interface LegendItem {
  color: string;
  label: string;
  iconClass?: string;
}

const CATEGORY_FILTER_INFO: Record<string, { label: string; color: string }> = {
  extension: { label: "Extension requise", color: ORS_COLORS.extension },
  reconstruction: { label: "Reconstruction requise", color: ORS_COLORS.reconstruction },
  rehabilitation: { label: "Réhabilitation requise", color: ORS_COLORS.rehabilitation },
  tablebanc: { label: "Table-bancs insuffisants", color: ORS_COLORS.tablebanc },
};

function getLegendItems(niveau: OrsNiveau, categoryFilter: string): LegendItem[] {
  const filterInfo = CATEGORY_FILTER_INFO[categoryFilter];
  const items: LegendItem[] = [];

  if (niveau === "primaire") {
    if (filterInfo) {
      items.push(
        { color: filterInfo.color, label: filterInfo.label, iconClass: "fas fa-book-open" },
        {
          color: ORS_COLORS.conforme,
          label: "Conforme (critère satisfait)",
          iconClass: "fas fa-book-open",
        },
      );
    } else {
      items.push({
        color: ORS_COLORS.default,
        label: "École Primaire Publique",
        iconClass: "fas fa-book-open",
      });
    }
    items.push(
      { color: ORS_COLORS.prive, label: "École Primaire Privée", iconClass: "fas fa-book-open" },
      { color: ORS_COLORS.villageHorsZone, label: "Village hors zone", iconClass: "fas fa-home" },
      { color: ORS_COLORS.villageCouvert, label: "Village couvert", iconClass: "fas fa-home" },
    );
  } else {
    const isCollege = niveau === "college";
    const mainLabel = isCollege ? "CEG public" : "Lycée public";
    const mainIcon = isCollege ? "fas fa-school" : "fas fa-building";
    const secondaryLabel = isCollege ? "EPP dans zone CEG" : "Collège existant";
    const exclusionLabel = isCollege
      ? "EPP hors zone (éligible à un nouveau CEG)"
      : "Collège hors zone (éligible à un nouveau lycée)";
    const privateLabel = isCollege ? "École privée" : "Établissement privé";

    if (filterInfo) {
      items.push(
        {
          color: filterInfo.color,
          label: `${mainLabel} / ${secondaryLabel} — ${filterInfo.label}`,
          iconClass: mainIcon,
        },
        {
          color: ORS_COLORS.conforme,
          label: "Conforme (critère satisfait)",
          iconClass: mainIcon,
        },
      );
    } else {
      items.push(
        { color: NIVEAU_MAIN_COLOR[niveau], label: mainLabel, iconClass: mainIcon },
        { color: ORS_COLORS.default, label: secondaryLabel, iconClass: "fas fa-book-open" },
      );
    }
    items.push(
      { color: ORS_COLORS.horsZoneEligible, label: exclusionLabel, iconClass: "fas fa-book-open" },
      { color: ORS_COLORS.prive, label: privateLabel, iconClass: "fas fa-school" },
      { color: ORS_COLORS.villageAutre, label: "Village", iconClass: "fas fa-home" },
    );
  }

  items.push(
    { color: ORS_COLORS.limiteDren, label: "Limite DREN" },
    { color: ORS_COLORS.limiteCisco, label: "Limite CISCO" },
  );
  return items;
}

const ORS = () => {
  const { niveau: niveauParam } = useParams<{ niveau: string }>();
  const niveau: OrsNiveau = (
    NIVEAUX_ORDER.includes(niveauParam as OrsNiveau) ? niveauParam : "primaire"
  ) as OrsNiveau;
  const meta = NIVEAU_META[niveau];
  const NiveauIcon = meta.icon;

  const {
    drens,
    ciscos,
    colleges,
    primaires,
    lycees,
    villages,
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

  const [radius, setRadius] = useState(meta.defaultRadius);
  const [mapCenter, setMapCenter] = useState<[number, number]>([-18.9189596, 47.5135653]);
  const [mapZoom, setMapZoom] = useState(6);
  const [selectedEtablissement, setSelectedEtablissement] = useState<Etablissement | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>("aucune");
  const [analysisResult, setAnalysisResult] = useState<VillageAnalysisResult | null>(null);
  const [layerVisibility, setLayerVisibility] = useState<LayerVisibility>({
    publiques: true,
    prives: true,
    villages: true,
  });
  const [etabInfoVisible, setEtabInfoVisible] = useState(true);
  const [tableBancFilter, setTableBancFilter] = useState<TableBancFilter>("tous");
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [downloadFormat, setDownloadFormat] = useState<"csv" | "xlsx">("csv");
  const [downloadCategory, setDownloadCategory] = useState<
    "tous" | "reconstruction" | "nouvelle_creation" | "rehabilitation"
  >("tous");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // ====================== DONNÉES SELON LE NIVEAU ACTIF ======================
  const mainData: Etablissement[] =
    meta.mainDataKey === "primaires"
      ? primaires
      : meta.mainDataKey === "colleges"
        ? colleges
        : lycees;
  const refData: Etablissement[] =
    meta.refDataKey === "primaires" ? primaires : meta.refDataKey === "colleges" ? colleges : [];

  const filteredMainData = useMemo(
    () =>
      mainData.filter((e) => {
        if (isPublicSector(e)) return layerVisibility.publiques;
        if (isPrivateSector(e)) return layerVisibility.prives;
        return layerVisibility.publiques || layerVisibility.prives;
      }),
    [mainData, layerVisibility.publiques, layerVisibility.prives],
  );

  const filteredRefData = useMemo(
    () =>
      refData.filter((e) => {
        if (isPublicSector(e)) return layerVisibility.publiques;
        if (isPrivateSector(e)) return layerVisibility.prives;
        return layerVisibility.publiques || layerVisibility.prives;
      }),
    [refData, layerVisibility.publiques, layerVisibility.prives],
  );
  const filteredVillages = useMemo(
    () => (layerVisibility.villages ? villages : []),
    [villages, layerVisibility.villages],
  );
  const downloadCategories = useMemo(() => {
    const data = mainData;

    return {
      tous: data,

      reconstruction: data.filter((e) => Boolean(e.eligible_reconstruction)),

      rehabilitation: data.filter((e) => Boolean(e.eligible_rehabilitation)),

      nouvelle_creation: data.filter(
        (e) =>
          Boolean((e as any).nouvelle_creation) ||
          Boolean((e as any).nouvelleCreation) ||
          Boolean((e as any).eligible_nouvelle_creation),
      ),
    };
  }, [mainData]);

  const downloadData = useMemo(() => {
    return downloadCategories[downloadCategory];
  }, [downloadCategories, downloadCategory]);
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
      Boolean(e.eligible_reconstruction),
    ).length;
    return { total, publics, prives, refTotal, eligiblesReconstruction };
  }, [mainData, refData]);

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

  const handleApplyFilter = useCallback(async () => {
    if (selectedDren === 0) {
      toast.error("Veuillez sélectionner une DREN");
      return;
    }
    setActionLoading("Application du filtre...");
    try {
      await fetchEtablissements(selectedDren, selectedCisco);
      setMapZoom(selectedCisco > 0 ? 10 : 8);
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
    setMapZoom,
  });

  const handleSearchSelect = useCallback((item: Etablissement) => {
    if (item.latitude && item.longitude) {
      setMapCenter([item.latitude, item.longitude]);
      setMapZoom(14);
      setSelectedEtablissement(item);
    }
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
    if (!downloadData.length) {
      toast.error("Aucune donnée à télécharger");
      return;
    }

    setActionLoading("Génération du fichier...");

    try {
      // Canevas ORS fixe : les entêtes sont identiques dans chaque export,
      // quelle que soit la catégorie choisie et quel que soit le format.
      const columns = ORS_CSV_COLUMNS;

      const categorySuffix =
        downloadCategory === "tous" ? "" : `_${downloadCategory.toUpperCase()}`;

      const filename =
        `${meta.filenamePrefix}_${drenLabel}_${ciscoLabel}` +
        `${categorySuffix}_${new Date().toISOString().slice(0, 10)}`;

      if (downloadFormat === "csv") {
        const headerRow = columns.map((c) => c.label).join(";");

        const rows = downloadData.map((etab) =>
          columns
            .map((c) => `"${String(formatExportValue(etab, c.key)).replace(/"/g, '""')}"`)
            .join(";"),
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
        const rows = downloadData.map((etab) => {
          const row: Record<string, string | number | boolean> = {};

          columns.forEach((c) => {
            row[c.label] = formatExportValue(etab, c.key);
          });

          return row;
        });

        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();

        XLSX.utils.book_append_sheet(wb, ws, meta.label.slice(0, 31));

        XLSX.writeFile(wb, `${filename}.xlsx`);
      }

      toast.success(`${downloadData.length} établissements exportés`);

      setShowDownloadModal(false);
    } finally {
      setActionLoading(null);
    }
  }, [downloadData, downloadCategory, niveau, meta, drenLabel, ciscoLabel, downloadFormat]);

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
      <div
        className={`shrink-0 border-b border-border bg-gradient-to-r ${meta.gradientClass} px-3 sm:px-4 py-2.5`}
      >
        <div className="flex items-center justify-between flex-wrap gap-2">
          <span className="text-sm font-semibold text-muted-foreground flex items-center gap-2 min-w-0">
            <NiveauIcon className="w-4 h-4 shrink-0" />
            <span className="truncate">CARTE SCOLAIRE / ORS / {meta.breadcrumb}</span>
          </span>

          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Récap filtre — même style que le badge de Besoins.tsx */}
            <Badge
              variant="outline"
              className="text-[10px] font-normal border-green-500 text-green-600 bg-green-50 dark:bg-green-950 dark:text-green-400 px-3 py-1"
            >
              {meta.label}
              {(selectedDren > 0 || selectedCisco > 0) && (
                <>
                  {selectedDren > 0 && ` • ${drenLabel}`}
                  {selectedCisco > 0 && `, ${ciscoLabel}`}
                </>
              )}
            </Badge>

            {/* Compteurs */}
            {stats.total > 0 && !loading && (
              <>
                <Badge variant="secondary" className="text-xs">
                  {stats.total} {meta.unitLabel}
                </Badge>
                {meta.refUnitLabel && (
                  <Badge variant="outline" className="text-xs bg-cyan-500/10 text-cyan-700">
                    {stats.refTotal} {meta.refUnitLabel} alentour
                  </Badge>
                )}
                {stats.eligiblesReconstruction > 0 && (
                  <Badge variant="destructive" className="text-xs">
                    {stats.eligiblesReconstruction} reconstruction
                  </Badge>
                )}
              </>
            )}

            {/* Chargement d'une action précise */}
            {actionLoading && (
              <Badge variant="outline" className="text-xs gap-1.5">
                <Loader2 className="w-3 h-3 animate-spin" />
                {actionLoading}
              </Badge>
            )}
            {!actionLoading && loading && (
              <Badge variant="outline" className="text-xs gap-1.5">
                <Loader2 className="w-3 h-3 animate-spin" />
                Chargement des données...
              </Badge>
            )}

            {/* Téléchargement — visible seulement une fois le filtre appliqué */}
            {isFiltered && mainData.length > 0 && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1.5"
                onClick={() => {
                  setDownloadCategory("tous");
                  setShowDownloadModal(true);
                }}
              >
                <Download className="w-3.5 h-3.5" />
                Télécharger
              </Button>
            )}

            <DataActionsBar table="fpe_a1" tableLabel={`Établissements (${meta.label})`} compact />
          </div>
        </div>

        {/* Onglets de niveau */}
        <div className="mt-2 inline-flex items-center rounded-md border border-border overflow-hidden">
          {NIVEAUX_ORDER.map((n) => {
            const m = NIVEAU_META[n];
            const Icon = m.icon;
            const active = n === niveau;
            return (
              <Link
                key={n}
                to={`/ors/${n}`}
                className={cn(
                  "inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide transition-colors",
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
            "relative z-10 shrink-0 h-full min-h-0 bg-background/80 backdrop-blur-xl border-r shadow-xl flex flex-col overflow-hidden transition-[width] duration-300 ease-in-out",
            leftOpen ? "w-[300px] min-w-[300px] max-w-[300px] flex-[0_0_300px]" : "w-0 border-r-0",
          )}
          aria-hidden={!leftOpen}
        >
          {/* Conteneur scrollable propre au panneau gauche */}
          <div className="h-full w-full overflow-y-auto overflow-x-hidden overscroll-contain smooth-scroll">
            <div className="mx-auto flex w-full max-w-[270px] flex-col justify-center gap-3 px-3 py-5">
              {/* Filtres + Recherche (layerVisibility / tableBancFilter → panneau droit) */}
              <MapFilters
                drens={drens}
                ciscos={ciscos}
                selectedDren={selectedDren}
                selectedCisco={selectedCisco}
                radius={radius}
                onDrenChange={handleDrenChange}
                onCiscoChange={handleCiscoChange}
                onRadiusChange={setRadius}
                onApplyFilter={handleApplyFilter}
                onResetFilter={resetFilter}
                loading={loading || !!actionLoading}
                searchItems={[...mainData, ...refData]}
                onSearchSelect={handleSearchSelect}
                isFiltered={isFiltered}
                drenLocked={scope.drenLocked}
                ciscoLocked={scope.ciscoLocked}
              />

              <HelpPanel type={meta.helpType} />

              {mainData.length > 0 && (
                <div className="w-full">
                  <ORSAnalysisPanel
                    type={niveau}
                    primaires={
                      niveau === "primaire" ? mainData : niveau === "college" ? refData : []
                    }
                    colleges={niveau === "college" ? mainData : niveau === "lycee" ? refData : []}
                    lycees={niveau === "lycee" ? mainData : []}
                    villages={villages}
                    radius={radius}
                  />
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* Bouton repli/déploi GAUCHE */}
        <button
          type="button"
          onClick={() => setLeftOpen((v) => !v)}
          title={leftOpen ? "Réduire le panneau filtres" : "Développer le panneau filtres"}
          className="absolute top-1/2 -translate-y-1/2 -ml-4 z-[1500] bg-background border shadow-xl rounded-full w-9 h-9 flex items-center justify-center hover:bg-muted transition-[left] duration-300 ease-in-out"
          style={{ left: leftOpen ? "calc(300px - 18px)" : "0px" }}
        >
          {leftOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>

        {/* ---------- PANNEAU CENTRE (carte, s'étend sur tout l'espace restant) ---------- */}
        <div className="relative z-0 overflow-hidden min-w-0 min-h-0 h-full flex-1">
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
            geoLayers={geoLayers}
            villages={filteredVillages}
            onVillageAnalysis={setAnalysisResult}
            showLegend={false}
            layerVisibility={layerVisibility}
            etabInfoVisible={etabInfoVisible}
          />
        </div>

        {/* Bouton repli/déploi DROITE */}
        <button
          type="button"
          onClick={() => setRightOpen((v) => !v)}
          title={rightOpen ? "Réduire le panneau couches" : "Développer le panneau couches"}
          className="absolute top-1/2 -translate-y-1/2 -mr-4 z-[1500] bg-background border shadow-xl rounded-full w-9 h-9 flex items-center justify-center hover:bg-muted transition-[right] duration-300 ease-in-out"
          style={{ right: rightOpen ? "calc(300px - 18px)" : "0px" }}
        >
          {rightOpen ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>

        {/* ---------- PANNEAU DROITE ---------- */}
        <aside
          className={cn(
            "relative z-10 shrink-0 h-full min-h-0 bg-background/80 backdrop-blur-xl border-l shadow-xl flex flex-col overflow-hidden transition-[width] duration-300 ease-in-out",
            rightOpen ? "w-[300px] min-w-[300px] max-w-[300px] flex-[0_0_300px]" : "w-0 border-l-0",
          )}
          aria-hidden={!rightOpen}
        >
          {/* Conteneur scrollable propre au panneau droit */}
          <div className="h-full w-full overflow-y-auto overflow-x-hidden overscroll-contain smooth-scroll">
            <div className="mx-auto flex w-full max-w-[270px] flex-col justify-center gap-2.5 px-3 py-5">
              {/* Couches à afficher */}
              <Card className="shadow-sm border-border/80 w-full">
                <CardHeader className="py-2 px-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Layers className="w-4 h-4 text-primary" />
                    Couches à afficher
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-3 pb-3 pt-0 space-y-1.5">
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
                        <span className="inline-block w-2 h-2 rounded-full bg-cyan-500" />
                        Établissements publiques
                      </span>
                    </label>
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
                        <span className="inline-block w-2 h-2 rounded-full bg-amber-500" />
                        Établissements privées
                      </span>
                    </label>
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
                      <span className="text-xs flex items-center gap-1.5">
                        <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
                        Villages
                      </span>
                    </label>
                    <label className="flex items-center gap-2 p-1.5 rounded hover:bg-muted/50 cursor-pointer transition-colors">
                      <Checkbox
                        checked={etabInfoVisible}
                        onCheckedChange={(checked) => setEtabInfoVisible(!!checked)}
                      />
                      <span className="text-xs flex items-center gap-1.5">
                        <span className="inline-block w-2 h-2 rounded-full bg-primary" />
                        INFOS ÉTAB.
                      </span>
                    </label>
                  </div>

                  {niveau !== "primaire" && (
                    <div className="pt-1.5 border-t border-border">
                      <Label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1.5 block">
                        Table-bancs
                      </Label>
                      <RadioGroup
                        value={tableBancFilter}
                        onValueChange={(v) => setTableBancFilter(v as TableBancFilter)}
                        className="space-y-1"
                      >
                        <div className="flex items-center gap-2 p-1 rounded hover:bg-muted/50">
                          <RadioGroupItem value="tous" id="r-tb-tous" />
                          <Label htmlFor="r-tb-tous" className="text-xs cursor-pointer flex-1">
                            Tous
                          </Label>
                        </div>
                        <div className="flex items-center gap-2 p-1.5 rounded hover:bg-muted/50">
                          <RadioGroupItem value="suffisant" id="r-tb-suff" />
                          <Label htmlFor="r-tb-suff" className="text-xs cursor-pointer flex-1">
                            Suffisant
                          </Label>
                        </div>
                        <div className="flex items-center gap-2 p-1.5 rounded hover:bg-muted/50">
                          <RadioGroupItem value="insuffisant" id="r-tb-insuff" />
                          <Label htmlFor="r-tb-insuff" className="text-xs cursor-pointer flex-1">
                            Insuffisant
                          </Label>
                        </div>
                      </RadioGroup>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Catégorie de la carte */}
              {mainData.length > 0 && (
                <Card className="shadow-sm border-border/80 w-full">
                  <CardHeader className="py-2 px-3">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-primary" />
                      Catégorie de la carte
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-3 pb-3 pt-0">
                    <RadioGroup
                      value={categoryFilter}
                      onValueChange={setCategoryFilter}
                      className="space-y-1"
                    >
                      <div className="flex items-center space-x-2 p-1.5 rounded-lg hover:bg-muted/50 transition-colors">
                        <RadioGroupItem value="aucune" id="cat-aucune" />
                        <Label htmlFor="cat-aucune" className="text-sm cursor-pointer flex-1">
                          Aucune
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2 p-1.5 rounded-lg hover:bg-muted/50 transition-colors">
                        <RadioGroupItem value="extension" id="cat-extension" />
                        <Label htmlFor="cat-extension" className="text-sm cursor-pointer flex-1">
                          Extension
                        </Label>
                        <Badge variant="destructive" className="text-[10px]">
                          Prioritaire
                        </Badge>
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
                      {niveau !== "primaire" && (
                        <div className="flex items-center space-x-2 p-1.5 rounded-lg hover:bg-muted/50 transition-colors">
                          <RadioGroupItem value="tablebanc" id="cat-tablebanc" />
                          <Label htmlFor="cat-tablebanc" className="text-sm cursor-pointer flex-1">
                            Table-bancs
                          </Label>
                        </div>
                      )}
                    </RadioGroup>
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
                        {item.iconClass ? (
                          <i
                            className={`${item.iconClass} inline-flex w-5 shrink-0 justify-center text-base`}
                            style={{ color: item.color }}
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
            {/* =========================================================
          OPTIONS D'EXPORT
      ========================================================= */}
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                Données à exporter
              </Label>

              <div className="space-y-2">
                {/* TOUS */}
                <Button
                  type="button"
                  variant={downloadCategory === "tous" ? "default" : "outline"}
                  className="w-full h-11 justify-between"
                  onClick={() => setDownloadCategory("tous")}
                >
                  <span className="flex items-center gap-2">
                    <School className="w-4 h-4" />
                    Tous les établissements
                  </span>

                  <Badge variant={downloadCategory === "tous" ? "secondary" : "outline"}>
                    {downloadCategories.tous.length}
                  </Badge>
                </Button>

                {/* RECONSTRUCTION */}
                {downloadCategories.reconstruction.length > 0 && (
                  <Button
                    type="button"
                    variant={downloadCategory === "reconstruction" ? "default" : "outline"}
                    className="w-full h-11 justify-between"
                    onClick={() => setDownloadCategory("reconstruction")}
                  >
                    <span className="flex items-center gap-2">
                      <Building2 className="w-4 h-4" />
                      Reconstruction
                    </span>

                    <Badge
                      variant={downloadCategory === "reconstruction" ? "secondary" : "destructive"}
                    >
                      {downloadCategories.reconstruction.length}
                    </Badge>
                  </Button>
                )}

                {/* NOUVELLE CRÉATION */}
                {downloadCategories.nouvelle_creation.length > 0 && (
                  <Button
                    type="button"
                    variant={downloadCategory === "nouvelle_creation" ? "default" : "outline"}
                    className="w-full h-11 justify-between"
                    onClick={() => setDownloadCategory("nouvelle_creation")}
                  >
                    <span className="flex items-center gap-2">
                      <School className="w-4 h-4" />
                      Nouvelle création
                    </span>

                    <Badge
                      variant={downloadCategory === "nouvelle_creation" ? "secondary" : "outline"}
                    >
                      {downloadCategories.nouvelle_creation.length}
                    </Badge>
                  </Button>
                )}

                {/* RÉHABILITATION */}
                {downloadCategories.rehabilitation.length > 0 && (
                  <Button
                    type="button"
                    variant={downloadCategory === "rehabilitation" ? "default" : "outline"}
                    className="w-full h-11 justify-between"
                    onClick={() => setDownloadCategory("rehabilitation")}
                  >
                    <span className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" />
                      Réhabilitation
                    </span>

                    <Badge
                      variant={downloadCategory === "rehabilitation" ? "secondary" : "outline"}
                    >
                      {downloadCategories.rehabilitation.length}
                    </Badge>
                  </Button>
                )}
              </div>
            </div>

            {/* =========================================================
          RÉCAPITULATIF
      ========================================================= */}
            <div className="bg-muted/40 rounded-lg p-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Établissements à exporter</span>

                <Badge variant="secondary">{downloadData.length}</Badge>
              </div>

              {downloadCategory !== "tous" && (
                <div className="mt-2 text-xs text-muted-foreground">
                  Catégorie :{" "}
                  <span className="font-medium text-foreground">
                    {downloadCategory === "reconstruction" && "Reconstruction"}

                    {downloadCategory === "nouvelle_creation" && "Nouvelle création"}

                    {downloadCategory === "rehabilitation" && "Réhabilitation"}
                  </span>
                </div>
              )}
            </div>

            {/* =========================================================
          FORMAT
      ========================================================= */}
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

            {/* =========================================================
          BOUTON TÉLÉCHARGER
      ========================================================= */}
            <Button
              onClick={runDownload}
              className="w-full h-10"
              disabled={downloadData.length === 0 || !!actionLoading}
            >
              {actionLoading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Download className="w-4 h-4 mr-2" />
              )}
              Télécharger {downloadData.length} établissement
              {downloadData.length > 1 ? "s" : ""}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedEtablissement} onOpenChange={() => setSelectedEtablissement(null)}>
        <DialogContent className="max-w-2xl p-3 sm:p-4">
          <DialogHeader className="pb-2">
            <DialogTitle className="flex items-center gap-2 text-base">
              <NiveauIcon className="w-4 h-4 text-primary" />
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
                    selectedEtablissement.effectifs !== "" ? (
                      <InfoRow
                        icon={<Users className="w-3.5 h-3.5 text-muted-foreground" />}
                        label="Effectif total"
                        value={String(selectedEtablissement.effectifs)}
                      />
                    ) : null}
                    {selectedEtablissement.eff_t5 !== null &&
                    selectedEtablissement.eff_t5 !== undefined &&
                    selectedEtablissement.eff_t5 !== "" ? (
                      <InfoRow
                        icon={<Users className="w-3.5 h-3.5 text-muted-foreground" />}
                        label="Effectif T5"
                        value={String(selectedEtablissement.eff_t5)}
                      />
                    ) : null}
                    {selectedEtablissement.eff_2024 !== null &&
                    selectedEtablissement.eff_2024 !== undefined &&
                    selectedEtablissement.eff_2024 !== "" ? (
                      <InfoRow
                        icon={<Users className="w-3.5 h-3.5 text-muted-foreground" />}
                        label="Effectif 2024"
                        value={String(selectedEtablissement.eff_2024)}
                      />
                    ) : null}
                    {selectedEtablissement.sdc_be !== null &&
                    selectedEtablissement.sdc_be !== undefined &&
                    selectedEtablissement.sdc_be !== "" ? (
                      <InfoRow
                        icon={<CheckCircle className="w-3.5 h-3.5 text-emerald-600" />}
                        label="Salles bonnes"
                        value={String(selectedEtablissement.sdc_be)}
                      />
                    ) : null}
                    {selectedEtablissement.sdc_me !== null &&
                    selectedEtablissement.sdc_me !== undefined &&
                    selectedEtablissement.sdc_me !== "" ? (
                      <InfoRow
                        icon={<AlertTriangle className="w-3.5 h-3.5 text-rose-600" />}
                        label="Salles dégradées"
                        value={String(selectedEtablissement.sdc_me)}
                      />
                    ) : null}
                    {selectedEtablissement.sdc_requis !== null &&
                    selectedEtablissement.sdc_requis !== undefined &&
                    selectedEtablissement.sdc_requis !== "" ? (
                      <InfoRow
                        icon={<XCircle className="w-3.5 h-3.5 text-muted-foreground" />}
                        label="Salles requises"
                        value={String(selectedEtablissement.sdc_requis)}
                      />
                    ) : null}
                    {selectedEtablissement.places !== null &&
                    selectedEtablissement.places !== undefined &&
                    selectedEtablissement.places !== "" ? (
                      <InfoRow
                        icon={<Users className="w-3.5 h-3.5 text-muted-foreground" />}
                        label="Places"
                        value={String(selectedEtablissement.places)}
                      />
                    ) : null}
                    {selectedEtablissement.eligible_reconstruction !== null &&
                    selectedEtablissement.eligible_reconstruction !== undefined ? (
                      <InfoRow
                        icon={<Building2 className="w-3.5 h-3.5 text-rose-600" />}
                        label="Reconstruction"
                        value={eligibleReconstructionBadge(
                          Boolean(selectedEtablissement.eligible_reconstruction),
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
                          selectedEtablissement.eligible_rehabilitation ? (
                            <Badge
                              variant="outline"
                              className="gap-1 text-emerald-600 border-emerald-600 text-[9px]"
                            >
                              <CheckCircle className="w-2.5 h-2.5" /> OUI
                            </Badge>
                          ) : (
                            <Badge variant="destructive" className="gap-1 text-[9px]">
                              <XCircle className="w-2.5 h-2.5" /> NON
                            </Badge>
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
