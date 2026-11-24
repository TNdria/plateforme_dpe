import { useState, useEffect, useMemo, useRef } from "react";
import { Link, useParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Loader2,
  School,
  Users,
  GraduationCap,
  BookOpen,
  Database,
  Filter,
  Download,
  FileSpreadsheet,
  FileText,
  RefreshCw,
  Layers,
  Lock,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import DataTable from "@/components/donnees/DataTable";
import { useDonneesFilters } from "@/hooks/useDonneesFilters";
import { donneesApi } from "@/services/api";
import DataActionsBar from "@/components/admin/DataActionsBar";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { getZoneInfo } from "@/lib/zone";
import logoMen from "@/assets/logoMen.jpg";
import logoDpe from "@/assets/logoDpe.jpg";
import {
  buildSectorGroups,
  getTotalEleves,
  type Niveau,
  type SectorGroup,
} from "@/utils/donneesSectors";
import { resolveDonneesScope } from "@/utils/donneesScope";
import {
  DEFAULT_SCHOOL_YEAR,
  SCHOOL_YEARS,
  formatAnneeScolaire,
  parseSchoolYear,
} from "@/utils/anneeScolaire";

type Section = "ecoles" | "eleves" | "personnels";
type ExportFormat = "csv" | "xlsx";

// Identité visuelle par niveau — même principe que NIVEAU_META dans Besoins.tsx
const NIVEAU_META: Record<
  Niveau,
  { label: string; icon: any; activeBg: string; activeText: string }
> = {
  prescolaire: {
    label: "Préscolaire",
    icon: BookOpen,
    activeBg: "bg-amber-600",
    activeText: "text-white",
  },
  primaire: {
    label: "Primaire",
    icon: School,
    activeBg: "bg-emerald-600",
    activeText: "text-white",
  },
  college: {
    label: "Collège",
    icon: Users,
    activeBg: "bg-blue-600",
    activeText: "text-white",
  },
  lycee: {
    label: "Lycée",
    icon: GraduationCap,
    activeBg: "bg-violet-600",
    activeText: "text-white",
  },
};

const ANNEES = SCHOOL_YEARS.map(String);
const HISTORICAL_EFFECTIF_YEARS = [2022, 2023, 2024, 2025];

const secteurLabel: Record<string, string> = {
  "2": "Tous",
  "0": "Public",
  "1": "Privé",
};
const getSecteurLabel = (value: string) => secteurLabel[value] ?? "Tous";

const SECTION_META: Record<Section, { label: string; icon: any }> = {
  ecoles: { label: "Écoles", icon: School },
  eleves: { label: "Élèves", icon: Users },
  personnels: { label: "Personnels", icon: GraduationCap },
};

type SectionTheme = { ring: string; iconBg: string; iconColor: string; tableHeader: string; tabActive: string; tabInactive: string; tint: string; tintBorder: string };

// Couleurs officielles MEN / DPE : bleu, vert, rouge
const SECTION_THEME: Record<Section, SectionTheme> = {
  ecoles: {
    ring: "border-t-primary", iconBg: "bg-primary/10", iconColor: "text-primary", tableHeader: "bg-primary/10",
    tabActive: "data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md",
    tabInactive: "text-muted-foreground hover:text-primary hover:bg-primary/10",
    tint: "bg-primary/[0.08]", tintBorder: "bg-primary/25",
  },
  eleves: {
    ring: "border-t-secondary", iconBg: "bg-secondary/10", iconColor: "text-secondary", tableHeader: "bg-secondary/10",
    tabActive: "data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground data-[state=active]:shadow-md",
    tabInactive: "text-muted-foreground hover:text-secondary hover:bg-secondary/10",
    tint: "bg-secondary/[0.08]", tintBorder: "bg-secondary/25",
  },
  personnels: {
    ring: "border-t-gold", iconBg: "bg-gold/10", iconColor: "text-gold", tableHeader: "bg-gold/10",
    tabActive: "data-[state=active]:bg-gold data-[state=active]:text-gold-foreground data-[state=active]:shadow-md",
    tabInactive: "text-muted-foreground hover:text-gold hover:bg-gold/10",
    tint: "bg-gold/[0.09]", tintBorder: "bg-gold/25",
  },
};

const zoneColumn = {
  key: "CATEGORIE_COMMUNE",
  label: "ZONE",
  width: 132,
  align: "center" as const,
  render: (_value: unknown, row: Record<string, unknown>) => {
    const zone = getZoneInfo(row);
    const styles = {
      rural:
        "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-300",
      urban:
        "border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-800 dark:bg-sky-950/60 dark:text-sky-300",
      unknown:
        "border-slate-300 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300",
    };
    return (
      <Badge variant="outline" className={cn("font-medium", styles[zone.kind])}>
        {zone.label}
      </Badge>
    );
  },
};

const getEcolesColumns = (annee: string = String(DEFAULT_SCHOOL_YEAR)) => [
  { key: "CODE_ETAB", label: "CODE", width: 120 },
  { key: "DREN", label: "DREN", width: 90 },
  { key: "CISCO", label: "CISCO", width: 90 },
  { key: "COMMUNE", label: "COMMUNE", width: 130 },
  { key: "ZAP", label: "ZAP", width: 90 },
  { key: "FOKONTANY", label: "FOKONTANY", width: 140 },
  { key: "NOM_ETAB", label: "ÉTABLISSEMENT", width: 240 },
  zoneColumn,
  {
    key: `eff_${annee}`,
    label: `EFF. ${annee}`,
    align: "right" as const,
    width: 100,
  },
  { key: "places", label: "PLACES", align: "right" as const, width: 90 },
  { key: "sdc_be", label: "SDC BE", align: "right" as const, width: 90 },
  { key: "sdc_me", label: "SDC ME", align: "right" as const, width: 90 },
  { key: "TYPE_SOURCE_EAU", label: "EAU", width: 90 },
  { key: "TYPE_SOURCE_ELECTRICITE", label: "ÉLECTRICITÉ", width: 130 },
];

const getElevesColumns = (
  niveau: Niveau,
  annee: string = String(DEFAULT_SCHOOL_YEAR),
) => {
  const baseColumns = [
    { key: "CODE_ETAB", label: "CODE", width: 120 },
    { key: "DREN", label: "DREN", width: 90 },
    { key: "CISCO", label: "CISCO", width: 90 },
    { key: "COMMUNE", label: "COMMUNE", width: 130 },
    { key: "ZAP", label: "ZAP", width: 90 },
    { key: "NOM_ETAB", label: "ÉTABLISSEMENT", width: 240 },
    zoneColumn,
    {
      key: "eff_2022",
      label: "EFF. 2022",
      align: "right" as const,
      width: 100,
    },
    {
      key: "eff_2023",
      label: "EFF. 2023",
      align: "right" as const,
      width: 100,
    },
    {
      key: "eff_2024",
      label: "EFF. 2024",
      align: "right" as const,
      width: 100,
    },
    {
      key: "eff_2025",
      label: "EFF. 2025",
      align: "right" as const,
      width: 100,
    },
    ...(HISTORICAL_EFFECTIF_YEARS.includes(Number(annee))
      ? []
      : [
          {
            key: `eff_${annee}`,
            label: `EFF. ${annee}`,
            align: "right" as const,
            width: 100,
          },
        ]),
  ];

  const classeColumns: Record<
    Niveau,
    { key: string; label: string; align: "right"; width: number }[]
  > = {
    prescolaire: [
      { key: "eff_ps", label: "PS", align: "right", width: 72 },
      { key: "eff_ms", label: "MS", align: "right", width: 72 },
      { key: "eff_gs", label: "GS", align: "right", width: 72 },
    ],
    primaire: [
      { key: "eff_t1", label: "T1", align: "right", width: 72 },
      { key: "eff_t2", label: "T2", align: "right", width: 72 },
      { key: "eff_t3", label: "T3", align: "right", width: 72 },
      { key: "eff_t4", label: "T4", align: "right", width: 72 },
      { key: "eff_t5", label: "T5", align: "right", width: 72 },
    ],
    college: [
      { key: "eff_t6", label: "6ème", align: "right", width: 72 },
      { key: "eff_t7", label: "5ème", align: "right", width: 72 },
      { key: "eff_t8", label: "4ème", align: "right", width: 72 },
      { key: "eff_t9", label: "3ème", align: "right", width: 72 },
    ],
    lycee: [
      { key: "_2nde", label: "2nde", align: "right", width: 72 },
      { key: "_1re", label: "1ère", align: "right", width: 72 },
      { key: "tle", label: "Tle", align: "right", width: 72 },
    ],
  };

  return [...baseColumns, ...(classeColumns[niveau] || [])];
};

const getPersonnelsColumns = (annee: string = String(DEFAULT_SCHOOL_YEAR)) => [
  { key: "CODE_ETAB", label: "CODE", width: 120 },
  { key: "DREN", label: "DREN", width: 90 },
  { key: "CISCO", label: "CISCO", width: 90 },
  { key: "COMMUNE", label: "COMMUNE", width: 130 },
  { key: "ZAP", label: "ZAP", width: 90 },
  { key: "NOM_ETAB", label: "ÉTABLISSEMENT", width: 240 },
  zoneColumn,
  {
    key: `eff_${annee}`,
    label: `EFF. ${annee}`,
    align: "right" as const,
    width: 100,
  },
  {
    key: "pers_total",
    label: "TOTAL PERSONNEL",
    align: "right" as const,
    width: 130,
  },
  // Personnel enseignant (en classe) : total puis ventilation par statut.
  {
    key: "en_classe",
    label: "ENSEIGNANTS EN CLASSE",
    align: "right" as const,
    width: 160,
  },
  {
    key: "ens_fonct",
    label: "ENS. FONCTIONNAIRES",
    align: "right" as const,
    width: 130,
  },
  {
    key: "ens_enf",
    label: "ENS. ENF",
    align: "right" as const,
    width: 100,
  },
  // Personnel administratif (PA) : total puis ventilation par statut.
  {
    key: "pers_admin",
    label: "PERSONNEL ADMINISTRATIF (PA)",
    align: "right" as const,
    width: 160,
  },
  {
    key: "admin_fonct",
    label: "PA FONCTIONNAIRES",
    align: "right" as const,
    width: 130,
  },
  {
    key: "admin_enf",
    label: "PA ENF",
    align: "right" as const,
    width: 100,
  },
  { key: "fram_sub", label: "FRAM SUB", align: "right" as const, width: 100 },
  {
    key: "fram_nonsub",
    label: "FRAM NON SUB",
    align: "right" as const,
    width: 130,
  },
  { key: "bepc", label: "BEPC", align: "right" as const, width: 90 },
  { key: "bacc", label: "BACC+4 ET PLUS", align: "right" as const, width: 140 },
  {
    key: "qualifiee",
    label: "QUALIFIÉ(E)S",
    align: "right" as const,
    width: 120,
  },
];

const SECTION_COLUMNS: Record<Section, (niveau: Niveau, annee: string) => any[]> = {
  ecoles: (_niveau, annee) => getEcolesColumns(annee),
  eleves: (niveau, annee) => getElevesColumns(niveau, annee),
  personnels: (_niveau, annee) => getPersonnelsColumns(annee),
};

const formatNumber = (n: number) => new Intl.NumberFormat("fr-FR").format(Math.round(n || 0));

const Donnees = () => {
  const { niveau: niveauParam } = useParams<{ niveau: string }>();
  const niveau: Niveau = (
    ["prescolaire", "primaire", "college", "lycee"].includes(niveauParam || "")
      ? niveauParam
      : "primaire"
  ) as Niveau;
  const meta = NIVEAU_META[niveau];

  // Périmètre par défaut : national pour un visiteur ou un profil national,
  // DREN ou CISCO du profil connecté sinon. La DREN / la CISCO verrouillées
  // ne peuvent pas être quittées depuis les filtres ; les niveaux inférieurs
  // (CISCO, ZAP, commune) restent consultables dans ce périmètre.
  const { user, isLoading: authLoading } = useAuth();
  const scope = useMemo(() => resolveDonneesScope(user), [user]);
  const filterScope = useMemo(
    () => ({
      dren: scope.defaultDren,
      cisco: scope.defaultCisco,
      drenLocked: scope.drenLocked,
      ciscoLocked: scope.ciscoLocked,
    }),
    [scope],
  );
  const [isFilterDirty, setIsFilterDirty] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [section, setSection] = useState<Section>("ecoles");
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportFormat, setExportFormat] = useState<ExportFormat>("xlsx");
  const [selectedAnnee, setSelectedAnnee] = useState(String(DEFAULT_SCHOOL_YEAR));
  // Une requête nationale peut durer plusieurs dizaines de secondes : si
  // l'utilisateur change de filtre entre-temps, seule la dernière réponse doit
  // être affichée (sinon une réponse plus ancienne écrase la plus récente).
  const requestIdRef = useRef(0);
  const filters = useDonneesFilters(filterScope);

  const markFilterDirty = () => {
    if (!isResetting) {
      setIsFilterDirty(true);
    }
  };
  // Réinitialiser les données quand on change de niveau ou de périmètre
  // autorisé (connexion / déconnexion / changement de profil).
  useEffect(() => {
    setData([]);
    setHasLoadedOnce(false);
  }, [niveau, scope.key]);

  const handleFilter = async (
    overrideAnnee?: number,
    silent = false,
    // Périmètre explicite pour le chargement initial : il ne doit pas dépendre
    // de l'état des filtres, encore en cours de synchronisation après une
    // connexion.
    perimeter?: { dren: number; cisco: number },
  ) => {
    // Un périmètre à 0 signifie « national » (toutes les DREN / CISCO / …).
    setIsFilterDirty(false);

    const dren = perimeter ? perimeter.dren : Number(filters.selectedDren);
    const cisco = perimeter
      ? perimeter.cisco
      : filters.selectedCisco !== "0"
        ? Number(filters.selectedCisco)
        : 0;
    // Le chargement par défaut repart du périmètre, sans réutiliser une
    // commune / un ZAP choisis précédemment (potentiellement hors périmètre).
    const commune =
      !perimeter && filters.selectedCommune !== "0" ? Number(filters.selectedCommune) : 0;
    const zap = !perimeter && filters.selectedZap !== "0" ? Number(filters.selectedZap) : 0;
    const secteur = Number(filters.selectedSecteur);
    // `overrideAnnee` vient parfois d'un gestionnaire d'événements : seul un
    // millésime entier est retenu, sinon on utilise le sélecteur. Sans ce
    // garde-fou la requête partait avec l'événement React comme année et ne
    // renvoyait aucune ligne pour les millésimes historiques.
    const requestedYear =
      parseSchoolYear(overrideAnnee) ?? parseSchoolYear(selectedAnnee) ?? DEFAULT_SCHOOL_YEAR;
    const requestId = ++requestIdRef.current;

    setLoading(true);
    try {
      // Le millésime choisi est autoritaire : on n'affiche jamais les
      // données d'une autre année sous l'étiquette sélectionnée. Une année
      // sans résultat pour ce périmètre reste un résultat vide, avec un
      // message explicite — pas un repli silencieux sur un autre millésime.
      let result: any[] = [];
      let lastError: unknown = null;
      try {
        let r: any[] = [];
        switch (niveau) {
          case "prescolaire":
            r = await donneesApi.getEtabN0(dren, cisco, commune, zap, secteur, requestedYear);
            break;
          case "primaire":
            r = await donneesApi.getEtabN1(dren, cisco, commune, zap, secteur, requestedYear);
            break;
          case "college":
            r = await donneesApi.getEtabN2(dren, cisco, commune, zap, secteur, requestedYear);
            break;
          case "lycee":
            r = await donneesApi.getEtabN3(dren, cisco, commune, zap, secteur, requestedYear);
            break;
        }
        result = Array.isArray(r) ? r : [];
      } catch (err) {
        // Une erreur de source ne doit pas laisser croire à une absence de
        // données : on la remonte à l'utilisateur.
        console.warn(`Chargement ${niveau} ${requestedYear} impossible.`, err);
        lastError = err;
        result = [];
      }

      // Réponse obsolète : un chargement plus récent est déjà en cours.
      if (requestId !== requestIdRef.current) return result;

      const nextData = result;
      setData(nextData);
      setHasLoadedOnce(true);
      setLastUpdate(new Date());

      if (!silent) {
        if (nextData.length === 0) {
          if (lastError) {
            toast.error("Erreur lors du chargement des données");
          } else {
            toast.info(
              `Aucune donnée pour l'année scolaire ${formatAnneeScolaire(String(requestedYear))} avec ces filtres`,
            );
          }
        } else {
          toast.success(`${formatNumber(nextData.length)} établissements chargés`);
        }
      }
      return nextData;
    } finally {
      // Le spinner suit la requête la plus récente uniquement.
      if (requestId === requestIdRef.current) setLoading(false);
    }
  };

  const handleReset = () => {
    setIsResetting(true);

    // Retour au périmètre par défaut : national pour un visiteur / profil
    // national, DREN ou CISCO de rattachement pour un utilisateur restreint.
    if (!scope.drenLocked) {
      filters.handleDrenChange("0");
    }

    filters.handleCiscoChange("0");
    filters.setSelectedCommune("0");
    filters.setSelectedZap("0");
    filters.setSelectedSecteur("2");

    setData([]);
    setHasLoadedOnce(false);
    setIsFilterDirty(false);

    setTimeout(() => {
      setIsResetting(false);
      handleFilter(undefined, true, {
        dren: Number(scope.defaultDren),
        cisco: Number(scope.defaultCisco),
      });
    }, 0);
  };

  // Chargement automatique du périmètre par défaut au montage et à chaque
  // changement de niveau ou de profil : national (public / profil national),
  // DREN ou CISCO de rattachement pour un utilisateur authentifié restreint.
  useEffect(() => {
    if (authLoading) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      if (cancelled) return;
      handleFilter(undefined, true, {
        dren: Number(scope.defaultDren),
        cisco: Number(scope.defaultCisco),
      });
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [niveau, scope.key, authLoading]);

  // Stats globales du périmètre chargé
  const totalEtablissements = data.length;
  const totalEleves = getTotalEleves(data, niveau);
  const hasPersonnelValue = data.some((e) => {
    const s = String(e?.pers_total ?? "").trim();
    return s !== "" && s !== "-" && s !== "0";
  });
  const totalPersonnels = hasPersonnelValue
    ? data.reduce((acc, e) => acc + (Number(e.pers_total) || 0), 0)
    : null;

  // Répartition Public (SECTEUR 0) / Privé (SECTEUR 1) / Total
  const sectorGroups = buildSectorGroups(data, niveau);

  // Catégories exportables — indépendantes de l'onglet affiché, un seul jeu
  // de données déjà chargé (aucune requête supplémentaire).
  const exportCategories: {
    id: Section;
    label: string;
    icon: any;
    getColumns: () => any[];
  }[] = [
    {
      id: "ecoles",
      label: "Données écoles",
      icon: School,
      getColumns: () => getEcolesColumns(selectedAnnee),
    },
    {
      id: "eleves",
      label: "Données élèves",
      icon: Users,
      getColumns: () => getElevesColumns(niveau, selectedAnnee),
    },
    {
      id: "personnels",
      label: "Données personnels",
      icon: GraduationCap,
      getColumns: () => getPersonnelsColumns(selectedAnnee),
    },
  ];

  const handleExportCategory = (catId: Section) => {
    if (data.length === 0) {
      toast.error("Aucune donnée à exporter");
      return;
    }
    // Le fichier est étiqueté avec l'année / les filtres affichés : refuser
    // d'exporter des lignes chargées avant la dernière modification évite
    // d'associer un millésime à des données d'un autre périmètre.
    if (isFilterDirty) {
      toast.error("Appliquez les filtres avant d'exporter");
      return;
    }
    if (loading) {
      toast.info("Chargement en cours, patientez avant d'exporter");
      return;
    }
    const category = exportCategories.find((c) => c.id === catId)!;
    const columns = category.getColumns();
    const rows = data.map((row) =>
      Object.fromEntries(columns.map((col) => [col.label, row[col.key] ?? ""])),
    );
    const filename = `donnees_${niveau}_${catId}_${selectedAnnee}_${new Date().toISOString().slice(0, 10)}`;

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    if (exportFormat === "xlsx") {
      XLSX.utils.book_append_sheet(wb, ws, "Données");
      XLSX.writeFile(wb, `${filename}.xlsx`);
    } else {
      XLSX.writeFile(wb, `${filename}.csv`, { bookType: "csv" });
    }

    toast.success(`${category.label} exportées (${formatNumber(rows.length)} lignes)`);
    setShowExportModal(false);
  };

  const getTargetTable = (): { table: string; label: string } => {
    if (section === "ecoles") return { table: "fpe_a1", label: `Établissements ${meta.label}` };
    if (section === "eleves") return { table: "fpe_e1", label: `Élèves ${meta.label}` };
    return { table: "fpe_p1", label: `Personnels ${meta.label}` };
  };

  const activeSectionMeta = SECTION_META[section];
  const columns = SECTION_COLUMNS[section](niveau, selectedAnnee);

  return (
    <div className="space-y-6 pb-8">
      {/* ===== Header  ===== */}
      <div className="sticky top-0 z-30 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 shadow-sm animate-fade-in">
        <div className="mx-auto max-w-none px-4 py-3">
          <div className="flex flex-wrap items-center gap-3">
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

            <div className="flex-1 min-w-[220px]">
              <h1 className="text-base sm:text-lg font-bold leading-tight text-foreground">
                Données Établissements — {meta.label}
              </h1>
              <p className="text-xs text-muted-foreground">
                Ministère de l'Éducation Nationale · Établissements, effectifs et personnels
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {scope.drenLocked && (
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
                </Badge>
              )}
              <Button
                onClick={() => {
                  if (data.length === 0) {
                    toast.error("Aucune donnée à exporter");
                    return;
                  }
                  setShowExportModal(true);
                }}
                size="sm"
                variant="outline"
                disabled={data.length === 0}
              >
                <Download className="mr-2 h-4 w-4" /> Exporter
              </Button>
              <DataActionsBar
                table={getTargetTable().table}
                tableLabel={getTargetTable().label}
                compact
                onChange={handleFilter}
              />
            </div>
          </div>

          {/* Niveau actif + section active */}
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
                      to={`/donnees/${n}`}
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
                Section : <strong>{activeSectionMeta.label}</strong> — Années Scolaire :{" "}
                <strong>
                  {" "}
                  {formatAnneeScolaire(selectedAnnee)}
                </strong>
              </span>
            </div>

            {data.length > 0 && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground">
                <span>
                  <strong className="text-foreground">{formatNumber(totalEtablissements)}</strong>{" "}
                  établissements
                </span>
                <span>
                  <strong className="text-foreground">{formatNumber(totalEleves)}</strong> élèves
                </span>
                <span>
                  <strong className="text-foreground">{totalPersonnels === null ? "—" : formatNumber(totalPersonnels)}</strong>{" "}
                  personnels
                </span>
              </div>
            )}
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
          <h2 className="text-sm font-semibold text-foreground">Filtres géographiques</h2>
          <div className="ml-auto">
            <Badge
              variant="outline"
              className="text-[10px] font-medium border-secondary/50 text-secondary bg-secondary/10 px-3 py-1"
            >
              {filters.selectedDren !== "0"
                ? filters.drens.find((d) => String(d.CODE_DREN) === filters.selectedDren)?.DREN
                : "Toutes DREN"}
              {filters.selectedCisco !== "0" &&
                `, ${filters.ciscos.find((c) => String(c.CODE_CISCO) === filters.selectedCisco)?.CISCO}`}
              {filters.selectedCommune !== "0" &&
                `, ${filters.communes.find((c) => String(c.CODE_COMMUNE) === filters.selectedCommune)?.COMMUNE}`}
              {filters.selectedZap !== "0" &&
                `, ${filters.zaps.find((z) => String(z.CODE_ZAP) === filters.selectedZap)?.ZAP}`}
              {`, ${getSecteurLabel(filters.selectedSecteur)}`}
            </Badge>
          </div>
        </div>
        <CardContent className="p-4 sm:p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-4 gap-4 items-end">
            {/* DREN */}
            <FilterField label="DREN" locked={scope.drenLocked}>
              <Select
                value={filters.selectedDren}
                onValueChange={(value) => {
                  filters.handleDrenChange(value);
                  markFilterDirty();
                }}
                disabled={scope.drenLocked}
              >
                <SelectTrigger className="bg-background h-10">
                  <SelectValue placeholder="Sélectionner" />
                </SelectTrigger>
                <SelectContent side="bottom" position="popper">
                  <SelectItem value="0">-- Sélectionner --</SelectItem>
                  {filters.drens.map((d) => (
                    <SelectItem key={d.CODE_DREN} value={String(d.CODE_DREN)}>
                      {d.DREN}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterField>

            {/* CISCO */}
            <FilterField label="CISCO">
              <Select
                value={filters.selectedCisco}
                onValueChange={(value) => {
                  filters.handleCiscoChange(value);
                  markFilterDirty();
                }}
                disabled={
                  scope.ciscoLocked ||
                  filters.selectedDren === "0" ||
                  filters.loadingFilters
                }
              >
                <SelectTrigger className="bg-background h-10">
                  <SelectValue placeholder="Toutes CISCO" />
                </SelectTrigger>
                <SelectContent side="bottom" position="popper">
                  <SelectItem value="0">Toutes CISCO</SelectItem>
                  {filters.ciscos.map((c) => (
                    <SelectItem key={c.CODE_CISCO} value={String(c.CODE_CISCO)}>
                      {c.CISCO}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterField>

            {/* Commune — niveau administratif sous la CISCO, avant le ZAP
                (découpage pédagogique transversal, pas un sous-niveau). */}
            <FilterField label="Commune">
              <Select
                value={filters.selectedCommune}
                onValueChange={(value) => {
                  filters.setSelectedCommune(value);
                  markFilterDirty();
                }}
                disabled={filters.selectedCisco === "0" || filters.loadingFilters}
              >
                <SelectTrigger className="bg-background h-10">
                  <SelectValue placeholder="Toutes" />
                </SelectTrigger>
                <SelectContent side="bottom" position="popper">
                  <SelectItem value="0">Toutes les communes</SelectItem>
                  {filters.communes.map((c) => (
                    <SelectItem key={c.CODE_COMMUNE} value={String(c.CODE_COMMUNE)}>
                      {c.COMMUNE}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterField>

            {/* ZAP */}
            <FilterField label="ZAP">
              <Select
                value={filters.selectedZap}
                onValueChange={(value) => {
                  // ZAP et commune se recoupent en base : choisir un ZAP
                  // conserve la commune sélectionnée.
                  filters.handleZapChange(value);
                  markFilterDirty();
                }}
                disabled={filters.selectedCisco === "0" || filters.loadingFilters}
              >
                <SelectTrigger className="bg-background h-10">
                  <SelectValue placeholder="Toutes ZAP" />
                </SelectTrigger>
                <SelectContent side="bottom" position="popper">
                  <SelectItem value="0">Toutes ZAP</SelectItem>
                  {filters.zaps.map((z) => (
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
                value={filters.selectedSecteur}
                onValueChange={(value) => {
                  filters.setSelectedSecteur(value);
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
            <FilterField label="Année scolaire">
              <Select
                value={selectedAnnee}
                onValueChange={(value) => {
                  setSelectedAnnee(value);
                  markFilterDirty();
                }}
              >
                <SelectTrigger className="bg-background h-10">
                  <SelectValue />
                </SelectTrigger>

                <SelectContent>
                  {[...ANNEES].reverse().map((a) => (
                    <SelectItem key={a} value={a}>
                      {formatAnneeScolaire(a)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterField>

            <div className="flex items-end gap-2">
              <Button onClick={() => handleFilter()} disabled={loading} className="flex-1 h-10 shadow-sm">
                {loading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Filter className="h-4 w-4 mr-2" />
                )}
                Filtrer
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={handleReset}
                disabled={loading}
                className="h-10 w-10"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section (Tabs) */}
      <Tabs
        value={section}
        onValueChange={(v) => setSection(v as Section)}
        className="animate-fade-in"
        style={{ animationDelay: "90ms" }}
      >
        <TabsList className="grid w-full grid-cols-3 h-auto gap-1 p-1 bg-muted/60 rounded-lg">
          {(Object.keys(SECTION_META) as Section[]).map((s) => {
            const m = SECTION_META[s];
            const t = SECTION_THEME[s];
            const Icon = m.icon;
            return (
              <TabsTrigger
                key={s}
                value={s}
                className={cn(
                  "flex items-center justify-center gap-1.5 rounded-md py-2 text-xs sm:text-sm font-semibold transition-colors",
                  t.tabInactive,
                  t.tabActive,
                )}
              >
                <Icon className="h-4 w-4" />
                {m.label}
              </TabsTrigger>
            );
          })}
        </TabsList>
      </Tabs>

      {/* KPI cards — adaptés à l'onglet actif : Public / Privé / Total */}
      <div
        className="grid grid-cols-1 sm:grid-cols-3 gap-4 animate-fade-in"
        style={{ animationDelay: "120ms" }}
      >
        {sectorGroups.map((g) => {
          const icon = section === "ecoles" ? School : section === "eleves" ? Users : GraduationCap;
          const base = section === "ecoles" ? "Établissements" : section === "eleves" ? "Élèves" : "Personnels";
          const value = section === "ecoles" ? g.etabs : section === "eleves" ? g.eleves : g.pers;
          // Le détail reste distinct par catégorie : les enseignants en classe
          // seuls sont ventilés en subventionnés / non subventionnés.
          // Un secteur absent du périmètre (filtre secteur) n'a pas de
          // ventilation à montrer : ni détail, ni message de donnée manquante.
          const breakdown =
            section === "personnels" && g.etabs > 0 ? buildPersonnelBreakdown(g) : undefined;
          return (
            <StatCard
              key={g.key}
              icon={icon}
              theme={SECTION_THEME[section]}
              label={base}
              sector={g.key === "total" ? "Total" : `Secteur ${g.label.toLowerCase()}`}
              highlight={g.key === "total"}
              value={formatNumber(value)}
              breakdown={breakdown}
              hint={
                section !== "personnels"
                  ? "Dans le périmètre filtré"
                  : g.etabs === 0
                    ? "Aucun établissement dans le périmètre"
                    : g.breakdownKnown
                      ? "Dans le périmètre filtré"
                      : "Ventilation par statut non disponible"
              }
            />
          );
        })}
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
              {activeSectionMeta.label} — {meta.label}
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
            <div className="flex flex-col items-center justify-center min-h-[600px] gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Chargement des données…</p>
            </div>
          ) : data.length > 0 ? (
            <div className="min-h-[600px]">
              <DataTable
                data={data}
                columns={columns}
                title={`${activeSectionMeta.label} — ${meta.label}`}
                exportFilename={`donnees_${niveau}_${section}.csv`}
                pageSize={10}
                headerClassName={SECTION_THEME[section].tableHeader}
                pageSizeOptions={[10, 25, 50, 100]}
                hasAppliedFilter={hasLoadedOnce}
                hasSelectedDren={filters.selectedDren !== "0"}
                maxHeight="65vh"
                stickyFirstColumn
                stickyHeader
              />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center min-h-[600px] px-6 text-center">
              <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-muted mb-4">
                <Filter className="h-6 w-6 text-muted-foreground" />
              </div>

              {isFilterDirty ? (
                <>
                  <p className="text-sm font-semibold text-foreground">Filtres modifiés</p>

                  <p className="text-xs text-muted-foreground mt-1.5 max-w-sm mx-auto">
                    Les critères de recherche ont été modifiés.
                    <br />
                    Cliquez sur « Filtrer » pour appliquer les changements.
                  </p>
                </>
              ) : hasLoadedOnce ? (
                <>
                  <p className="text-sm font-semibold text-foreground">Aucune donnée disponible</p>

                  <p className="text-xs text-muted-foreground mt-1.5 max-w-sm mx-auto">
                    Aucun établissement ne correspond aux critères sélectionnés.
                    <br />
                    Modifiez vos filtres puis relancez la recherche.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-semibold text-foreground">Aucun filtre appliqué</p>

                  <p className="text-xs text-muted-foreground mt-1.5 max-w-sm mx-auto">
                    Sélectionnez une DREN puis cliquez sur « Filtrer »
                    <br />
                    pour charger les données.
                  </p>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal Export */}
      <Dialog open={showExportModal} onOpenChange={setShowExportModal}>
        <DialogContent className="w-[95vw] sm:w-[560px] md:w-[600px] max-w-[600px] max-h-[90dvh] overflow-hidden flex flex-col p-0">
          <DialogHeader className="border-b px-4 py-3">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div>
                <DialogTitle className="flex items-center gap-2 text-base font-semibold">
                  <Download className="h-5 w-5 text-primary" />
                  Exporter les données
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  {meta.label}
                </DialogDescription>
              </div>

              <div className="text-left sm:text-right text-[11px] leading-tight text-muted-foreground">
                <div>
                  <strong>DREN :</strong>{" "}
                  {filters.selectedDren !== "0"
                    ? filters.drens.find((d) => String(d.CODE_DREN) === filters.selectedDren)
                        ?.DREN || "Toutes"
                    : "Toutes"}
                </div>
                <div>
                  <strong>CISCO :</strong>{" "}
                  {filters.selectedCisco !== "0"
                    ? filters.ciscos.find((c) => String(c.CODE_CISCO) === filters.selectedCisco)
                        ?.CISCO || "Toutes"
                    : "Toutes"}
                </div>
                <div>
                  <strong>Commune :</strong>{" "}
                  {filters.selectedCommune !== "0"
                    ? filters.communes.find(
                        (c) => String(c.CODE_COMMUNE) === filters.selectedCommune,
                      )?.COMMUNE || "Toutes"
                    : "Toutes"}
                </div>
                <div>
                  <strong>ZAP :</strong>{" "}
                  {filters.selectedZap !== "0"
                    ? filters.zaps.find((z) => String(z.CODE_ZAP) === filters.selectedZap)?.ZAP ||
                      "Toutes"
                    : "Toutes"}
                </div>
                <div className="mt-2 pt-1 border-t font-medium text-foreground">
                  {formatNumber(totalEtablissements)} établissements
                </div>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
            {/* Période à télécharger — le fichier ne contient que cette période */}
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
                Période à télécharger
              </label>
              <Select
                value={selectedAnnee}
                onValueChange={(value) => {
                  setSelectedAnnee(value);
                  markFilterDirty();
                }}
              >
                <SelectTrigger className="h-9 w-full text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[...ANNEES].reverse().map((a) => (
                    <SelectItem key={a} value={a}>
                      Année scolaire {formatAnneeScolaire(a)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                {isFilterDirty
                  ? "Période modifiée : cliquez sur Appliquer pour recharger les données avant le téléchargement."
                  : `Le fichier contiendra uniquement l'année scolaire ${formatAnneeScolaire(selectedAnnee)}.`}
              </p>
            </div>

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

            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 block">
                Catégorie à exporter
              </label>
              <div className="space-y-2">
                {exportCategories.map((cat) => {
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
                          {formatNumber(totalEtablissements)} établissements
                        </div>
                      </div>
                      <Button
                        size="sm"
                        className="opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <Download className="mr-2 h-4 w-4" />
                        Télécharger
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="border-t p-3 flex justify-end gap-2">
            {/* La période choisie ici doit être chargée avant l'export : le
                bouton évite de renvoyer l'utilisateur vers le filtre masqué
                par le modal. */}
            {isFilterDirty && (
              <Button onClick={() => void handleFilter()} disabled={loading}>
                Appliquer la période
              </Button>
            )}
            <Button variant="ghost" onClick={() => setShowExportModal(false)}>
              Fermer
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

/* ───────── Sub-components (mêmes styles que Besoins.tsx) ───────── */

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
      {locked && <Lock className="h-3 w-3 text-destructive" />}
    </label>
    {children}
  </div>
);

type StatCardTheme = { ring: string; iconBg: string; iconColor: string; tint: string; tintBorder: string };

type StatCardBreakdown = {
  // Faux quand la ventilation par statut n'est pas servie : on affiche alors
  // des tirets plutôt que des zéros trompeurs.
  available: boolean;
  groups: {
    label: string;
    total: number;
    // Statuts composant la catégorie ; absents quand seul le total est connu.
    lines?: { label: string; value: number }[];
  }[];
};

/**
 * Détail Personnels d'une carte de synthèse. Dans le public, l'enseignement en
 * classe se décompose en fonctionnaires + ENF subventionnés + ENF non
 * subventionnés, et le personnel administratif en fonctionnaires + ENF. Le
 * privé et le total n'affichent que les deux catégories dont la somme forme le
 * total de la carte.
 */
const buildPersonnelBreakdown = (g: SectorGroup): StatCardBreakdown => {
  if (g.key === "public") {
    return {
      available: g.breakdownKnown,
      groups: [
        {
          label: "Enseignants en classe",
          total: g.ens,
          lines: [
            { label: "Fonctionnaires", value: g.ensFonct },
            { label: "ENF subventionnés", value: g.ensSub },
            { label: "ENF non subventionnés", value: g.ensNonSub },
          ],
        },
        {
          label: "Personnel administratif",
          total: g.admin,
          lines: [
            { label: "Fonctionnaires", value: g.adminFonct },
            { label: "ENF", value: g.adminEnf },
          ],
        },
      ],
    };
  }
  return {
    available: g.breakdownKnown,
    groups: [
      { label: "Enseignants en classe", total: g.ens },
      { label: "Personnel administratif", total: g.admin },
    ],
  };
};

const StatCard = ({
  icon: Icon,
  theme,
  label,
  sector,
  value,
  hint,
  breakdown,
  highlight,
}: {
  icon: any;
  theme: StatCardTheme;
  label: string;
  sector: string;
  value: string;
  hint?: string;
  breakdown?: StatCardBreakdown;
  highlight?: boolean;
}) => {
  // Le détail est masqué au départ : la carte reste compacte et le chevron
  // révèle la composition sans quitter la page. Le public ouvre d'abord les
  // deux catégories, puis un second chevron révèle la ventilation par statut.
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [showStatuses, setShowStatuses] = useState(false);
  const hasStatuses = breakdown?.groups.some((group) => group.lines?.length) ?? false;
  const breakdownTotal = breakdown
    ? breakdown.groups.reduce((sum, group) => sum + group.total, 0)
    : 0;
  const breakdownValue = (n: number) => (breakdown?.available ? formatNumber(n) : "—");
  // Chaque part est rapportée au total de la carte : les lignes d'un groupe
  // comme les groupes eux-mêmes s'additionnent à 100 %.
  const breakdownShare = (n: number) =>
    breakdown?.available && breakdownTotal > 0
      ? `${Math.round((n / breakdownTotal) * 100)} %`
      : "";
  return (
    <Card
      className={cn(
        "relative flex flex-col overflow-hidden border border-border/60 border-t-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg",
        theme.ring,
        highlight && "bg-gradient-to-br from-card to-accent/60",
      )}
    >
      <div className="flex items-start justify-between gap-3 px-5 pt-4">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <span
            className={cn(
              "mt-1 inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
              theme.iconBg,
              theme.iconColor,
            )}
          >
            {sector}
          </span>
        </div>
        <div
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
            theme.iconBg,
          )}
        >
          <Icon className={cn("h-5 w-5", theme.iconColor)} />
        </div>
      </div>
      <p className="px-5 pb-3 pt-2 text-3xl font-bold leading-none tracking-tight tabular-nums text-foreground">
        {value}
      </p>
      {breakdown && breakdown.groups.length > 0 && (
        // Dépliage animé façon tiroir : la grille passe de 0fr à 1fr, ce qui
        // anime une hauteur inconnue sans mesure JavaScript.
        <div
          aria-hidden={!showBreakdown}
          className={cn(
            "grid transition-all duration-300 ease-out motion-reduce:transition-none",
            showBreakdown
              ? "grid-rows-[1fr] opacity-100"
              : "pointer-events-none grid-rows-[0fr] opacity-0",
          )}
        >
          <div className="overflow-hidden">
            <div className={cn("border-t border-border/50 px-5 py-3", theme.tint)}>
              <table className="w-full border-collapse text-[11px]">
                <caption className="sr-only">Répartition des personnels par catégorie</caption>
                <thead>
                  <tr className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    <th scope="col" className="pb-1.5 text-left font-medium">
                      Catégorie
                    </th>
                    <th scope="col" className="pb-1.5 pl-2 text-right font-medium">
                      Effectif
                    </th>
                    <th scope="col" className="w-10 pb-1.5 pl-2 text-right font-medium">
                      Part
                    </th>
                  </tr>
                </thead>
                {breakdown.groups.map((group) => (
                  <tbody key={group.label}>
                    <tr className="border-t border-border/50">
                        <th scope="row" className="py-1.5 text-left font-semibold text-foreground">
                          {group.label}
                        </th>
                        <td className="py-1.5 pl-2 text-right font-semibold tabular-nums text-foreground">
                          {breakdownValue(group.total)}
                        </td>
                        <td className="py-1.5 pl-2 text-right tabular-nums text-muted-foreground">
                          {breakdownShare(group.total)}
                        </td>
                      </tr>
                      {showStatuses &&
                        group.lines?.map((line) => (
                          <tr key={line.label}>
                            <th
                              scope="row"
                              className="py-1 pl-3 text-left font-normal text-muted-foreground"
                            >
                              {line.label}
                            </th>
                            <td className="py-1 pl-2 text-right font-semibold tabular-nums text-foreground">
                              {breakdownValue(line.value)}
                            </td>
                            <td className="py-1 pl-2 text-right tabular-nums text-muted-foreground">
                              {breakdownShare(line.value)}
                            </td>
                          </tr>
                        ))}
                  </tbody>
                ))}
              </table>
            </div>
          </div>
        </div>
      )}
      {(hint || breakdown) && (
        <div className="mt-auto flex items-center justify-between gap-2 border-t border-border/50 px-5 py-2">
          <p className="min-w-0 truncate text-[11px] text-muted-foreground">{hint}</p>
          {breakdown && breakdown.groups.length > 0 && (
            <div className="flex shrink-0 items-center gap-2">
              {showBreakdown && hasStatuses && (
                <button
                  type="button"
                  onClick={() => setShowStatuses((value) => !value)}
                  aria-expanded={showStatuses}
                  aria-label={
                    showStatuses
                      ? "Masquer le détail des personnels par statut"
                      : "Afficher le détail des personnels par statut"
                  }
                  className="inline-flex shrink-0 items-center gap-0.5 text-[11px] font-semibold text-primary transition-colors hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
                >
                  {showStatuses ? "Réduire les statuts" : "Détail par statut"}
                  <ChevronDown
                    aria-hidden="true"
                    className={cn(
                      "h-3.5 w-3.5 transition-transform duration-300 ease-out motion-reduce:transition-none",
                      showStatuses && "rotate-180",
                    )}
                  />
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowBreakdown((value) => !value)}
                aria-expanded={showBreakdown}
                aria-label={
                  showBreakdown ? "Masquer le détail des personnels" : "Afficher le détail des personnels"
                }
                className="inline-flex shrink-0 items-center gap-0.5 text-[11px] font-semibold text-primary transition-colors hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
              >
                {showBreakdown ? "Masquer" : "Voir le détail"}
                <ChevronDown
                  aria-hidden="true"
                  className={cn(
                    "h-3.5 w-3.5 transition-transform duration-300 ease-out motion-reduce:transition-none",
                    showBreakdown && "rotate-180",
                  )}
                />
              </button>
            </div>
          )}
        </div>
      )}
    </Card>
  );
};

export default Donnees;
