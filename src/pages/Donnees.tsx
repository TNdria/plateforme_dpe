import { useState, useEffect, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
} from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import DataTable from '@/components/donnees/DataTable';
import { useDonneesFilters } from '@/hooks/useDonneesFilters';
import { donneesApi } from '@/services/api';
import DataActionsBar from '@/components/admin/DataActionsBar';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import logoMen from '@/assets/logoMen.jpg';
import logoDpe from '@/assets/logoDpe.jpg';

type Niveau = 'prescolaire' | 'primaire' | 'college' | 'lycee';
type Section = 'ecoles' | 'eleves' | 'personnels';
type ExportFormat = 'csv' | 'xlsx';

// Identité visuelle par niveau — même principe que NIVEAU_META dans Besoins.tsx
const NIVEAU_META: Record<
  Niveau,
  { label: string; icon: any; activeBg: string; activeText: string }
> = {
  prescolaire: {
    label: 'Préscolaire',
    icon: BookOpen,
    activeBg: 'bg-amber-600',
    activeText: 'text-white',
  },
  primaire: {
    label: 'Primaire',
    icon: School,
    activeBg: 'bg-emerald-600',
    activeText: 'text-white',
  },
  college: {
    label: 'Collège',
    icon: Users,
    activeBg: 'bg-blue-600',
    activeText: 'text-white',
  },
  lycee: {
    label: 'Lycée',
    icon: GraduationCap,
    activeBg: 'bg-violet-600',
    activeText: 'text-white',
  },
};

const ANNEES = ['2022', '2023', '2024', '2025'];

const secteurLabel: Record<string, string> = {
  '2': 'Tous',
  '0': 'Public',
  '1': 'Privé',
};
const getSecteurLabel = (value: string) => secteurLabel[value] ?? 'Tous';

const SECTION_META: Record<Section, { label: string; icon: any }> = {
  ecoles: { label: 'Écoles', icon: School },
  eleves: { label: 'Élèves', icon: Users },
  personnels: { label: 'Personnels', icon: GraduationCap },
};

const SECTION_THEME: Record<
  Section,
  { ring: string; iconBg: string; iconColor: string; tableHeader: string }
> = {
  ecoles: {
    ring: 'ring-blue-500/30 border-blue-500/20',
    iconBg: 'bg-blue-500/10',
    iconColor: 'text-blue-600 dark:text-blue-400',
    tableHeader: 'bg-blue-100/80 dark:bg-blue-950/40',
  },
  eleves: {
    ring: 'ring-emerald-500/30 border-emerald-500/20',
    iconBg: 'bg-emerald-500/10',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    tableHeader: 'bg-emerald-100/80 dark:bg-emerald-950/40',
  },
  personnels: {
    ring: 'ring-violet-500/30 border-violet-500/20',
    iconBg: 'bg-violet-500/10',
    iconColor: 'text-violet-600 dark:text-violet-400',
    tableHeader: 'bg-violet-100/80 dark:bg-violet-950/40',
  },
};

const getEcolesColumns = () => [
  { key: 'CODE_ETAB', label: 'CODE', width: 120 },
  { key: 'DREN', label: 'DREN', width: 90 },
  { key: 'CISCO', label: 'CISCO', width: 90 },
  { key: 'COMMUNE', label: 'COMMUNE', width: 130 },
  { key: 'ZAP', label: 'ZAP', width: 90 },
  { key: 'FOKONTANY', label: 'FOKONTANY', width: 140 },
  { key: 'NOM_ETAB', label: 'ÉTABLISSEMENT', width: 240 },
  { key: 'CATEGORIE_COMMUNE', label: 'ZONE', width: 90 },
  { key: 'eff_2025', label: 'EFF. 2025', align: 'right' as const, width: 100 },
  { key: 'places', label: 'PLACES', align: 'right' as const, width: 90 },
  { key: 'sdc_be', label: 'SDC BE', align: 'right' as const, width: 90 },
  { key: 'sdc_me', label: 'SDC ME', align: 'right' as const, width: 90 },
  { key: 'TYPE_SOURCE_EAU', label: 'EAU', width: 90 },
  { key: 'TYPE_SOURCE_ELECTRICITE', label: 'ÉLECTRICITÉ', width: 130 },
];

const getElevesColumns = (niveau: Niveau) => {
  const baseColumns = [
    { key: 'CODE_ETAB', label: 'CODE', width: 120 },
    { key: 'DREN', label: 'DREN', width: 90 },
    { key: 'CISCO', label: 'CISCO', width: 90 },
    { key: 'COMMUNE', label: 'COMMUNE', width: 130 },
    { key: 'ZAP', label: 'ZAP', width: 90 },
    { key: 'NOM_ETAB', label: 'ÉTABLISSEMENT', width: 240 },
    { key: 'CATEGORIE_COMMUNE', label: 'ZONE', width: 90 },
    {
      key: 'eff_2022',
      label: 'EFF. 2022',
      align: 'right' as const,
      width: 100,
    },
    {
      key: 'eff_2023',
      label: 'EFF. 2023',
      align: 'right' as const,
      width: 100,
    },
    {
      key: 'eff_2024',
      label: 'EFF. 2024',
      align: 'right' as const,
      width: 100,
    },
    {
      key: 'eff_2025',
      label: 'EFF. 2025',
      align: 'right' as const,
      width: 100,
    },
  ];

  const classeColumns: Record<
    Niveau,
    { key: string; label: string; align: 'right'; width: number }[]
  > = {
    prescolaire: [
      { key: 'eff_ps', label: 'PS', align: 'right', width: 72 },
      { key: 'eff_ms', label: 'MS', align: 'right', width: 72 },
      { key: 'eff_gs', label: 'GS', align: 'right', width: 72 },
    ],
    primaire: [
      { key: 'eff_t1', label: 'T1', align: 'right', width: 72 },
      { key: 'eff_t2', label: 'T2', align: 'right', width: 72 },
      { key: 'eff_t3', label: 'T3', align: 'right', width: 72 },
      { key: 'eff_t4', label: 'T4', align: 'right', width: 72 },
      { key: 'eff_t5', label: 'T5', align: 'right', width: 72 },
    ],
    college: [
      { key: 'eff_t6', label: '6ème', align: 'right', width: 72 },
      { key: 'eff_t7', label: '5ème', align: 'right', width: 72 },
      { key: 'eff_t8', label: '4ème', align: 'right', width: 72 },
      { key: 'eff_t9', label: '3ème', align: 'right', width: 72 },
    ],
    lycee: [
      { key: '_2nde', label: '2nde', align: 'right', width: 72 },
      { key: '_1re', label: '1ère', align: 'right', width: 72 },
      { key: 'tle', label: 'Tle', align: 'right', width: 72 },
    ],
  };

  return [...baseColumns, ...(classeColumns[niveau] || [])];
};

const getPersonnelsColumns = () => [
  { key: 'CODE_ETAB', label: 'CODE', width: 120 },
  { key: 'DREN', label: 'DREN', width: 90 },
  { key: 'CISCO', label: 'CISCO', width: 90 },
  { key: 'COMMUNE', label: 'COMMUNE', width: 130 },
  { key: 'ZAP', label: 'ZAP', width: 90 },
  { key: 'NOM_ETAB', label: 'ÉTABLISSEMENT', width: 240 },
  { key: 'CATEGORIE_COMMUNE', label: 'ZONE', width: 90 },
  { key: 'eff_2025', label: 'EFF. 2025', align: 'right' as const, width: 100 },
  {
    key: 'pers_total',
    label: 'TOTAL PERSONNEL',
    align: 'right' as const,
    width: 130,
  },
  {
    key: 'en_classe',
    label: 'ENSEIGNANTS EN CLASSE',
    align: 'right' as const,
    width: 160,
  },
  {
    key: 'fonctionnaire',
    label: 'FONCTIONNAIRES',
    align: 'right' as const,
    width: 130,
  },
  {
    key: 'contractuel',
    label: 'CONTRACTUELS',
    align: 'right' as const,
    width: 120,
  },
  { key: 'fram_sub', label: 'FRAM SUB', align: 'right' as const, width: 100 },
  {
    key: 'fram_nonsub',
    label: 'FRAM NON SUB',
    align: 'right' as const,
    width: 130,
  },
  { key: 'bepc', label: 'BEPC', align: 'right' as const, width: 90 },
  { key: 'bacc', label: 'BACC+4 ET PLUS', align: 'right' as const, width: 140 },
  {
    key: 'qualifiee',
    label: 'QUALIFIÉ(E)S',
    align: 'right' as const,
    width: 120,
  },
];

const SECTION_COLUMNS: Record<Section, (niveau: Niveau) => any[]> = {
  ecoles: () => getEcolesColumns(),
  eleves: (niveau) => getElevesColumns(niveau),
  personnels: () => getPersonnelsColumns(),
};

const formatNumber = (n: number) =>
  new Intl.NumberFormat('fr-FR').format(Math.round(n || 0));

const getTotalEleves = (data: any[], niveau: Niveau) => {
  const sum = (row: any, keys: string[]) =>
    keys.reduce((acc, k) => acc + (Number(row[k]) || 0), 0);
  const keysByNiveau: Record<Niveau, string[]> = {
    prescolaire: ['eff_ps', 'eff_ms', 'eff_gs'],
    primaire: ['eff_t1', 'eff_t2', 'eff_t3', 'eff_t4', 'eff_t5'],
    college: ['eff_t6', 'eff_t7', 'eff_t8', 'eff_t9'],
    lycee: ['_2nde', '_1re', 'tle'],
  };
  const keys = keysByNiveau[niveau];
  return data.reduce((acc, row) => acc + sum(row, keys), 0);
};

const donneesCache = new Map<string, any[]>();

const Donnees = () => {
  const { niveau: niveauParam } = useParams<{ niveau: string }>();
  const niveau: Niveau = (
    ['prescolaire', 'primaire', 'college', 'lycee'].includes(niveauParam || '')
      ? niveauParam
      : 'primaire'
  ) as Niveau;
  const meta = NIVEAU_META[niveau];

  // Restriction de périmètre — même principe que Besoins.tsx, mais ici on ne
  // restreint QUE la DREN (pas le CISCO) : un utilisateur non-admin rattaché
  // à une DREN ne peut consulter que les données de sa DREN ; le CISCO, la
  // Commune et le ZAP restent librement sélectionnables à l'intérieur de
  // cette DREN.
  const { user } = useAuth();
  const userDren = useMemo(() => {
    const d = Number((user as any)?.dren);
    return Number.isFinite(d) && d > 0 ? d : 0;
  }, [user]);
  const isAdmin = !!(user as any)?.is_superuser || !!(user as any)?.is_staff;
  const drenLocked = !isAdmin && userDren > 0;
  const [isFilterDirty, setIsFilterDirty] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [section, setSection] = useState<Section>('ecoles');
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportFormat, setExportFormat] = useState<ExportFormat>('xlsx');
  const [selectedAnnee, setSelectedAnnee] = useState('2025');
  const filters = useDonneesFilters();

  const markFilterDirty = () => {
    if (!isResetting) {
      setIsFilterDirty(true);
    }
  };
  // Verrouille automatiquement la DREN de l'utilisateur connecté (non-admin) :
  // on la sélectionne une seule fois au montage, ce qui déclenche aussi le
  // chargement des CISCO correspondants via `handleDrenChange`.
  useEffect(() => {
    if (drenLocked && filters.selectedDren !== String(userDren)) {
      filters.handleDrenChange(String(userDren));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drenLocked, userDren]);

  // Réinitialiser les données quand on change de niveau
  useEffect(() => {
    setData([]);
    setHasLoadedOnce(false);
  }, [niveau]);

  const handleFilter = async () => {
    if (filters.selectedDren === '0') {
      toast.error('Veuillez sélectionner au moins une DREN');
      return;
    }
    setIsFilterDirty(false);

    const dren = Number(filters.selectedDren);
    const cisco =
      filters.selectedCisco !== '0' ? Number(filters.selectedCisco) : 0;
    const commune =
      filters.selectedCommune !== '0' ? Number(filters.selectedCommune) : 0;
    const zap = filters.selectedZap !== '0' ? Number(filters.selectedZap) : 0;
    const secteur = Number(filters.selectedSecteur);
    const annee = Number(selectedAnnee);
    const cacheKey = `${niveau}:${annee}:${dren}:${cisco}:${commune}:${zap}:${secteur}`;

    if (donneesCache.has(cacheKey)) {
      setData(donneesCache.get(cacheKey)!);
      setHasLoadedOnce(true);
      setLastUpdate(new Date());
      return;
    }

    setLoading(true);
    try {
      let result: any[] = [];
      switch (niveau) {
        case 'prescolaire':
          result = await donneesApi.getEtabN0(
            dren,
            cisco,
            commune,
            zap,
            secteur,
            annee
          );
          break;
        case 'primaire':
          result = await donneesApi.getEtabN1(
            dren,
            cisco,
            commune,
            zap,
            secteur,
            annee
          );
          break;
        case 'college':
          result = await donneesApi.getEtabN2(
            dren,
            cisco,
            commune,
            zap,
            secteur,
            annee
          );
          break;
        case 'lycee':
          result = await donneesApi.getEtabN3(
            dren,
            cisco,
            commune,
            zap,
            secteur,
            annee
          );
          break;
      }

      const nextData = Array.isArray(result) ? result : [];
      donneesCache.set(cacheKey, nextData);
      setData(nextData);
      setHasLoadedOnce(true);
      setLastUpdate(new Date());

      if (nextData.length === 0) {
        toast.info('Aucune donnée ne correspond à ces filtres');
      } else {
        toast.success(
          `${formatNumber(nextData.length)} établissements chargés`
        );
      }
    } catch (err) {
      console.error(err);
      toast.error('Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setIsResetting(true);

    if (!drenLocked) {
      filters.handleDrenChange('0');
    }

    filters.handleCiscoChange('0');
    filters.setSelectedCommune('0');
    filters.setSelectedZap('0');
    filters.setSelectedSecteur('2');

    setData([]);
    setHasLoadedOnce(false);
    setIsFilterDirty(false);

    setTimeout(() => {
      setIsResetting(false);
    }, 0);
  };

  // Stats globales du périmètre chargé
  const totalEtablissements = data.length;
  const totalEleves = getTotalEleves(data, niveau);
  const totalPersonnels = data.reduce(
    (acc, e) => acc + (Number(e.pers_total) || 0),
    0
  );

  // Catégories exportables — indépendantes de l'onglet affiché, un seul jeu
  // de données déjà chargé (aucune requête supplémentaire).
  const exportCategories: {
    id: Section;
    label: string;
    icon: any;
    getColumns: () => any[];
  }[] = [
    {
      id: 'ecoles',
      label: 'Données écoles',
      icon: School,
      getColumns: getEcolesColumns,
    },
    {
      id: 'eleves',
      label: 'Données élèves',
      icon: Users,
      getColumns: () => getElevesColumns(niveau),
    },
    {
      id: 'personnels',
      label: 'Données enseignants',
      icon: GraduationCap,
      getColumns: getPersonnelsColumns,
    },
  ];

  const handleExportCategory = (catId: Section) => {
    if (data.length === 0) {
      toast.error('Aucune donnée à exporter');
      return;
    }
    const category = exportCategories.find((c) => c.id === catId)!;
    const columns = category.getColumns();
    const rows = data.map((row) =>
      Object.fromEntries(columns.map((col) => [col.label, row[col.key] ?? '']))
    );
    const filename = `donnees_${niveau}_${catId}_${new Date().toISOString().slice(0, 10)}`;

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    if (exportFormat === 'xlsx') {
      XLSX.utils.book_append_sheet(wb, ws, 'Données');
      XLSX.writeFile(wb, `${filename}.xlsx`);
    } else {
      XLSX.writeFile(wb, `${filename}.csv`, { bookType: 'csv' });
    }

    toast.success(
      `${category.label} exportées (${formatNumber(rows.length)} lignes)`
    );
    setShowExportModal(false);
  };

  const getTargetTable = (): { table: string; label: string } => {
    if (section === 'ecoles')
      return { table: 'fpe_a1', label: `Établissements ${meta.label}` };
    if (section === 'eleves')
      return { table: 'fpe_e1', label: `Élèves ${meta.label}` };
    return { table: 'fpe_p1', label: `Personnels ${meta.label}` };
  };

  const activeSectionMeta = SECTION_META[section];
  const columns = SECTION_COLUMNS[section](niveau);

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
                Ministère de l'Éducation Nationale · Établissements, effectifs
                et personnels
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {drenLocked && (
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
                </Badge>
              )}
              <Button
                onClick={() => {
                  if (data.length === 0) {
                    toast.error('Aucune donnée à exporter');
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
                Section : <strong>{activeSectionMeta.label}</strong> — Années
                Scolaire :{' '}
                <strong>
                  {' '}
                  {Number(selectedAnnee) - 1}-{selectedAnnee}
                </strong>
              </span>
            </div>

            {data.length > 0 && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground">
                <span>
                  <strong className="text-foreground">
                    {formatNumber(totalEtablissements)}
                  </strong>{' '}
                  établissements
                </span>
                <span>
                  <strong className="text-foreground">
                    {formatNumber(totalEleves)}
                  </strong>{' '}
                  élèves
                </span>
                <span>
                  <strong className="text-foreground">
                    {formatNumber(totalPersonnels)}
                  </strong>{' '}
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
        style={{ animationDelay: '60ms' }}
      >
        <div className="flex items-center gap-2 px-5 py-2.5 border-b bg-muted/30">
          <Filter className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">
            Filtres géographiques
          </h2>
          <div className="ml-auto">
            <Badge
              variant="outline"
              className="text-[10px] font-normal border-green-500 text-green-600 bg-green-50 dark:bg-green-950 dark:text-green-400 px-3 py-1"
            >
              {filters.selectedDren !== '0'
                ? filters.drens.find(
                    (d) => String(d.CODE_DREN) === filters.selectedDren
                  )?.DREN
                : 'Toutes DREN'}
              {filters.selectedCisco !== '0' &&
                `, ${filters.ciscos.find((c) => String(c.CODE_CISCO) === filters.selectedCisco)?.CISCO}`}
              {filters.selectedCommune !== '0' &&
                `, ${filters.communes.find((c) => String(c.CODE_COMMUNE) === filters.selectedCommune)?.COMMUNE}`}
              {filters.selectedZap !== '0' &&
                `, ${filters.zaps.find((z) => String(z.CODE_ZAP) === filters.selectedZap)?.ZAP}`}
              {`, ${getSecteurLabel(filters.selectedSecteur)}`}
            </Badge>
          </div>
        </div>
        <CardContent className="p-4 sm:p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-4 gap-4 items-end">
            {/* DREN */}
            <FilterField label="DREN" locked={drenLocked}>
              <Select
                value={filters.selectedDren}
                onValueChange={(value) => {
                  filters.handleDrenChange(value);
                  markFilterDirty();
                }}
                disabled={drenLocked}
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
                  filters.selectedDren === '0' || filters.loadingFilters
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

            {/* Commune */}
            <FilterField label="Commune">
              <Select
                value={filters.selectedCommune}
                onValueChange={(value) => {
                  filters.setSelectedCommune(value);
                  markFilterDirty();
                }}
                disabled={
                  filters.selectedCisco === '0' || filters.loadingFilters
                }
              >
                <SelectTrigger className="bg-background h-10">
                  <SelectValue placeholder="Toutes" />
                </SelectTrigger>
                <SelectContent side="bottom" position="popper">
                  <SelectItem value="0">Toutes les communes</SelectItem>
                  {filters.communes.map((c) => (
                    <SelectItem
                      key={c.CODE_COMMUNE}
                      value={String(c.CODE_COMMUNE)}
                    >
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
                  filters.setSelectedZap(value);
                  markFilterDirty();
                }}
                disabled={
                  filters.selectedCisco === '0' || filters.loadingFilters
                }
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
                  <SelectItem value="2025">2024-2025</SelectItem>
                  <SelectItem value="2024">2023-2024</SelectItem>
                  <SelectItem value="2023">2022-2023</SelectItem>
                  <SelectItem value="2022">2021-2022</SelectItem>
                </SelectContent>
              </Select>
            </FilterField>

            <div className="flex items-end gap-2">
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
        style={{ animationDelay: '90ms' }}
      >
        <TabsList className="grid w-full grid-cols-3 h-auto p-1 bg-muted/50">
          {(Object.keys(SECTION_META) as Section[]).map((s) => {
            const m = SECTION_META[s];
            const Icon = m.icon;
            return (
              <TabsTrigger
                key={s}
                value={s}
                className="data-[state=active]:bg-background data-[state=active]:shadow-sm flex items-center gap-1.5 py-2 text-xs sm:text-sm"
              >
                <Icon className="h-4 w-4" />
                {m.label}
              </TabsTrigger>
            );
          })}
        </TabsList>
      </Tabs>

      {/* KPI cards */}
      <div
        className="grid grid-cols-1 sm:grid-cols-3 gap-4 animate-fade-in"
        style={{ animationDelay: '120ms' }}
      >
        <StatCard
          icon={School}
          theme={SECTION_THEME[section]}
          label="Établissements"
          value={formatNumber(totalEtablissements)}
          hint="Dans le périmètre filtré"
        />
        <StatCard
          icon={Users}
          theme={SECTION_THEME[section]}
          label="Total élèves"
          value={formatNumber(totalEleves)}
          hint={`Effectifs ${meta.label.toLowerCase()}`}
        />
        <StatCard
          icon={GraduationCap}
          theme={SECTION_THEME[section]}
          label="Total personnels"
          value={formatNumber(totalPersonnels)}
          hint="Enseignants et personnel"
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
              {activeSectionMeta.label} — {meta.label}
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
          {loading ? (
            <div className="flex flex-col items-center justify-center min-h-[600px] gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">
                Chargement des données…
              </p>
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
                hasSelectedDren={filters.selectedDren !== '0'}
              />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center min-h-[600px] px-6 text-center">
              <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-muted mb-4">
                <Filter className="h-6 w-6 text-muted-foreground" />
              </div>

              {isFilterDirty ? (
                <>
                  <p className="text-sm font-semibold text-foreground">
                    Filtres modifiés
                  </p>

                  <p className="text-xs text-muted-foreground mt-1.5 max-w-sm mx-auto">
                    Les critères de recherche ont été modifiés.
                    <br />
                    Cliquez sur « Filtrer » pour appliquer les changements.
                  </p>
                </>
              ) : hasLoadedOnce ? (
                <>
                  <p className="text-sm font-semibold text-foreground">
                    Aucune donnée disponible
                  </p>

                  <p className="text-xs text-muted-foreground mt-1.5 max-w-sm mx-auto">
                    Aucun établissement ne correspond aux critères sélectionnés.
                    <br />
                    Modifiez vos filtres puis relancez la recherche.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-semibold text-foreground">
                    Aucun filtre appliqué
                  </p>

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
                  <strong>DREN :</strong>{' '}
                  {filters.selectedDren !== '0'
                    ? filters.drens.find(
                        (d) => String(d.CODE_DREN) === filters.selectedDren
                      )?.DREN || 'Toutes'
                    : 'Toutes'}
                </div>
                <div>
                  <strong>CISCO :</strong>{' '}
                  {filters.selectedCisco !== '0'
                    ? filters.ciscos.find(
                        (c) => String(c.CODE_CISCO) === filters.selectedCisco
                      )?.CISCO || 'Toutes'
                    : 'Toutes'}
                </div>
                <div>
                  <strong>ZAP :</strong>{' '}
                  {filters.selectedZap !== '0'
                    ? filters.zaps.find(
                        (z) => String(z.CODE_ZAP) === filters.selectedZap
                      )?.ZAP || 'Toutes'
                    : 'Toutes'}
                </div>
                <div className="mt-2 pt-1 border-t font-medium text-foreground">
                  {formatNumber(totalEtablissements)} établissements
                </div>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
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

          <div className="border-t p-3 flex justify-end">
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
      {locked && <Lock className="h-3 w-3 text-amber-600" />}
    </label>
    {children}
  </div>
);

type StatCardTheme = { ring: string; iconBg: string; iconColor: string };

const StatCard = ({
  icon: Icon,
  theme,
  label,
  value,
  hint,
}: {
  icon: any;
  theme: StatCardTheme;
  label: string;
  value: string;
  hint?: string;
}) => {
  return (
    <Card
      className={cn(
        'group relative overflow-hidden shadow-sm hover:shadow-md transition-all h-full flex flex-col border-2',
        theme.ring
      )}
    >
      <div className="px-4 pt-4 pb-2 border-b border-border/40">
        <p className="text-[11px] uppercase tracking-[0.18em] font-semibold text-muted-foreground text-center">
          {label}
        </p>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-5 bg-gradient-to-b from-transparent to-muted/10">
        <div className="h-14 flex items-center justify-center">
          <div
            className={cn(
              'w-12 h-12 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110',
              theme.iconBg
            )}
          >
            <Icon className={cn('w-6 h-6', theme.iconColor)} />
          </div>
        </div>
        <div className="h-14 flex items-center justify-center">
          <p className="text-[2.1rem] font-bold tracking-tight leading-none tabular-nums text-foreground">
            {value}
          </p>
        </div>
      </div>
      <div className="px-4 pt-3 pb-4 border-t border-border/30 text-center">
        <div className="min-h-[36px] flex items-center justify-center">
          {hint && (
            <p className="text-xs text-muted-foreground text-center leading-relaxed">
              {hint}
            </p>
          )}
        </div>
      </div>
    </Card>
  );
};

export default Donnees;
