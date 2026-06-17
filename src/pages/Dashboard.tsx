import { useState, useEffect, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Building2, Users, GraduationCap, Loader2, AlertCircle, Settings2, BarChart3 } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, LineChart, Line, XAxis, YAxis, CartesianGrid } from "recharts";
import { dashboardApi, Dren, Cisco } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

const YEARS_STORAGE_KEY = "dpe_dashboard_enabled_years";
const YEARS_SETTINGS_KEY = "dashboard_enabled_years";

interface LevelStat { prescolaire: number; primaire: number; college: number; lycee: number; }
interface LocalStats {
  etablissements: LevelStat;
  eleves: LevelStat;
  enseignants: LevelStat;
  // Année effectivement utilisée pour chaque bloc (peut différer si pas encore de données 2025-2026)
  etabYear: number | null;
  elevesYear: number | null;
  enseignantsYear: number | null;
}

const defaultStats: LocalStats = {
  etablissements: { prescolaire: 0, primaire: 0, college: 0, lycee: 0 },
  eleves: { prescolaire: 0, primaire: 0, college: 0, lycee: 0 },
  enseignants: { prescolaire: 0, primaire: 0, college: 0, lycee: 0 },
  etabYear: null,
  elevesYear: null,
  enseignantsYear: null,
};

const DIPLOME_COLORS = ['#C5E17A', '#7ED4A6', '#5B8DEF', '#9B6DD7', '#F59E0B', '#EF4444', '#06B6D4', '#8B5CF6'];

const Dashboard = () => {
  const { user } = useAuth();
  const isAdmin = !!user?.is_superuser;

  const [drens, setDrens] = useState<Dren[]>([]);
  const [ciscos, setCiscos] = useState<Cisco[]>([]);
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [enabledYears, setEnabledYears] = useState<number[] | null>(null); // null = toutes
  const [yearsDialogOpen, setYearsDialogOpen] = useState(false);
  const [draftYears, setDraftYears] = useState<Set<number>>(new Set());
  const [selectedDren, setSelectedDren] = useState<string>("0");
  const [selectedCisco, setSelectedCisco] = useState<string>("0");
  const [selectedSecteur, setSelectedSecteur] = useState<string>("2");
  const [stats, setStats] = useState<LocalStats>(defaultStats);
  const [statsEtab, setStatsEtab] = useState<any>(null);
  const [statsElevesN0N1, setStatsElevesN0N1] = useState<any>(null);
  const [statsElevesN2N3, setStatsElevesN2N3] = useState<any>(null);
  const [statsEnseignants, setStatsEnseignants] = useState<any>(null);
  const [diplomePrimaire, setDiplomePrimaire] = useState<Array<{name: string; value: number; color: string}>>([]);
  const [diplomeCollege, setDiplomeCollege] = useState<Array<{name: string; value: number; color: string}>>([]);
  const [diplomeLycee, setDiplomeLycee] = useState<Array<{name: string; value: number; color: string}>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Charger la sélection d'années persistée (côté serveur, partagé entre tous les navigateurs)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await (supabase as any)
          .from("app_settings")
          .select("value")
          .eq("key", YEARS_SETTINGS_KEY)
          .maybeSingle();
        if (cancelled) return;
        if (data?.value && Array.isArray(data.value)) {
          setEnabledYears((data.value as number[]).map(Number));
          return;
        }
      } catch {/* fallback to localStorage */}
      try {
        const raw = localStorage.getItem(YEARS_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) setEnabledYears(parsed.map(Number));
        }
      } catch {/* ignore */}
    })();
    return () => { cancelled = true; };
  }, []);

  // Années effectivement affichées : respecte la sélection admin (persistée)
  // null = toutes les années (par défaut). Tableau = sélection explicite.
  const displayYears = useMemo(() => {
    if (!availableYears.length) return [];
    if (enabledYears === null) return availableYears; // pas de préférence → toutes
    const set = new Set(enabledYears);
    const filtered = availableYears.filter(y => set.has(y));
    // Si l'admin a sauvegardé une sélection, on la respecte même si vide
    return filtered;
  }, [availableYears, enabledYears]);

  // Derived: latest year from display years
  const latestYear = useMemo(() => {
    if (displayYears.length === 0) return 2025;
    return Math.max(...displayYears);
  }, [displayYears]);

  const anneeDisplay = useMemo(() => `${latestYear - 1}-${latestYear}`, [latestYear]);

  // Fetch DRENs and available years on mount
  useEffect(() => {
    dashboardApi.getDrens().then(setDrens).catch((err) => {
      console.error("Erreur lors du chargement des DREN:", err);
      setError("Erreur de connexion à la base de données");
    });
    dashboardApi.getAvailableYears().then((data) => {
      const years = data.map((d: any) => Number(d.annee)).filter((y: number) => !isNaN(y)).sort((a: number, b: number) => a - b);
      setAvailableYears(years);
    }).catch((err) => {
      console.error("Erreur lors du chargement des années:", err);
    });
  }, []);

  const openYearsDialog = () => {
    setDraftYears(new Set(enabledYears && enabledYears.length ? enabledYears : availableYears));
    setYearsDialogOpen(true);
  };

  const toggleDraftYear = (year: number) => {
    setDraftYears(prev => {
      const next = new Set(prev);
      if (next.has(year)) next.delete(year); else next.add(year);
      return next;
    });
  };

  const saveYears = async () => {
    const arr = Array.from(draftYears).sort((a, b) => a - b);
    setEnabledYears(arr);
    try { localStorage.setItem(YEARS_STORAGE_KEY, JSON.stringify(arr)); } catch {/* ignore */}
    setYearsDialogOpen(false);
    // Persistance serveur (partagée entre navigateurs/utilisateurs)
    try {
      await (supabase as any)
        .from("app_settings")
        .upsert({ key: YEARS_SETTINGS_KEY, value: arr, updated_at: new Date().toISOString() }, { onConflict: "key" });
    } catch (err) {
      console.warn("Impossible d'enregistrer la sélection d'années côté serveur:", err);
    }
  };

  const resetYears = async () => {
    setEnabledYears(null);
    try { localStorage.removeItem(YEARS_STORAGE_KEY); } catch {/* ignore */}
    setYearsDialogOpen(false);
    try {
      await (supabase as any).from("app_settings").delete().eq("key", YEARS_SETTINGS_KEY);
    } catch {/* ignore */}
  };

  // Fetch CISCOs when DREN changes
  useEffect(() => {
    const fetchCiscos = async () => {
      if (selectedDren !== "0") {
        try {
          const data = await dashboardApi.getCiscos(parseInt(selectedDren));
          setCiscos(data);
        } catch (err) {
          console.error("Erreur lors du chargement des CISCO:", err);
        }
      } else {
        setCiscos([]);
      }
      setSelectedCisco("0");
    };
    fetchCiscos();
  }, [selectedDren]);

  // Fetch all statistics when filters change
  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);
      setError(null);
      
      const codeDren = parseInt(selectedDren);
      const codeCisco = parseInt(selectedCisco);
      const secteur = parseInt(selectedSecteur);

      try {
        const [etabData, elevesN0N1Data, elevesN2N3Data, enseignantsData, diplomesData] = await Promise.all([
          dashboardApi.getStatsEtablissements(codeDren, codeCisco, secteur),
          dashboardApi.getStatsElevesN0N1(codeDren, codeCisco, secteur).catch(() => [] as any[]),
          dashboardApi.getStatsElevesN2N3(codeDren, codeCisco, secteur).catch(() => [] as any[]),
          dashboardApi.getStatsEnseignants(codeDren, codeCisco, secteur).catch(() => [] as any[]),
          dashboardApi.getStatsDiplomes(codeDren, codeCisco, secteur).catch(() => []),
        ]);

        const etab = etabData?.[0] || {};
        const elevesN0N1 = elevesN0N1Data?.[0] || {};
        const elevesN2N3 = elevesN2N3Data?.[0] || {};
        const enseignants = enseignantsData?.[0] || {};

        setStatsEtab(etab);
        setStatsElevesN0N1(elevesN0N1);
        setStatsElevesN2N3(elevesN2N3);
        setStatsEnseignants(enseignants);

        // Process diploma data
        const diplomes = diplomesData?.[0] || {};
        const toDiplomeArray = (raw: any[]) => {
          if (!raw || !Array.isArray(raw)) return [];
          return raw.map((d: any, i: number) => ({
            name: d.diplome || 'NON RENSEIGNE',
            value: Number(d.total) || 0,
            color: DIPLOME_COLORS[i % DIPLOME_COLORS.length],
          })).filter(d => d.value > 0);
        };
        setDiplomePrimaire(toDiplomeArray(diplomes.primaire));
        setDiplomeCollege(toDiplomeArray(diplomes.college));
        setDiplomeLycee(toDiplomeArray(diplomes.lycee));

        // Recherche la dernière année disponible (<= latestYear) qui contient effectivement
        // des données non-nulles pour le bloc. Évite d'afficher des "0" partout quand la
        // dernière collecte (ex: 2025-2026) n'a pas encore été chargée dans la table cible.
        const yearsDesc = (displayYears.length ? displayYears : [latestYear]).slice().sort((a, b) => b - a);
        const pickYear = (row: any, keys: string[]): number | null => {
          for (const y of yearsDesc) {
            const sum = keys.reduce((acc, k) => acc + (Number(row?.[`${k}_${y}`]) || 0), 0);
            if (sum > 0) return y;
          }
          return null;
        };
        const valForYear = (row: any, key: string, y: number | null) =>
          y == null ? 0 : Number(row?.[`${key}_${y}`]) || 0;

        const etabYear = pickYear(etab, ["N0", "N1", "N2", "N3"]);
        const elevesYearN0N1 = pickYear(elevesN0N1, ["N0", "N1"]);
        const elevesYearN2N3 = pickYear(elevesN2N3, ["N2", "N3"]);
        // On garde une seule année "élèves" pour l'étiquette (la plus récente des deux)
        const elevesYear = Math.max(elevesYearN0N1 ?? 0, elevesYearN2N3 ?? 0) || null;
        const enseignantsYear = pickYear(enseignants, ["N0", "N1", "N2", "N3"]);

        setStats({
          etablissements: {
            prescolaire: valForYear(etab, "N0", etabYear),
            primaire: valForYear(etab, "N1", etabYear),
            college: valForYear(etab, "N2", etabYear),
            lycee: valForYear(etab, "N3", etabYear),
          },
          eleves: {
            prescolaire: valForYear(elevesN0N1, "N0", elevesYearN0N1),
            primaire: valForYear(elevesN0N1, "N1", elevesYearN0N1),
            college: valForYear(elevesN2N3, "N2", elevesYearN2N3),
            lycee: valForYear(elevesN2N3, "N3", elevesYearN2N3),
          },
          enseignants: {
            prescolaire: valForYear(enseignants, "N0", enseignantsYear),
            primaire: valForYear(enseignants, "N1", enseignantsYear),
            college: valForYear(enseignants, "N2", enseignantsYear),
            lycee: valForYear(enseignants, "N3", enseignantsYear),
          },
          etabYear,
          elevesYear,
          enseignantsYear,
        });
      } catch (err) {
        console.error("Erreur lors du chargement des statistiques:", err);
        setError("Erreur lors du chargement des statistiques");
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [selectedDren, selectedCisco, selectedSecteur, latestYear, displayYears]);

  // Build evolution data for establishments - based on years selected by admin
  const evolutionEtabData = useMemo(() => {
    if (!statsEtab || displayYears.length === 0) return [];
    return displayYears.map(year => ({
      annee: String(year),
      prescolaire: Number(statsEtab[`N0_${year}`]) || 0,
      primaire: Number(statsEtab[`N1_${year}`]) || 0,
      college: Number(statsEtab[`N2_${year}`]) || 0,
      lycee: Number(statsEtab[`N3_${year}`]) || 0,
    }));
  }, [statsEtab, displayYears]);

  // Build evolution data for students - based on years selected by admin
  const evolutionElevesData = useMemo(() => {
    if (!statsElevesN0N1 || !statsElevesN2N3 || displayYears.length === 0) return [];
    return displayYears.map(year => ({
      annee: String(year),
      prescolaire: Number(statsElevesN0N1[`N0_${year}`]) || 0,
      primaire: Number(statsElevesN0N1[`N1_${year}`]) || 0,
      college: Number(statsElevesN2N3[`N2_${year}`]) || 0,
      lycee: Number(statsElevesN2N3[`N3_${year}`]) || 0,
    }));
  }, [statsElevesN0N1, statsElevesN2N3, displayYears]);

  const formatNumber = (num: number) => {
    return num.toLocaleString("fr-FR");
  };

  return (
    <div className="space-y-6">
      {/* Header avec filtres */}
      <div className="flex flex-wrap items-center gap-4">
        <Select value={selectedDren} onValueChange={setSelectedDren}>
          <SelectTrigger className="w-[200px] bg-card border-border shadow-sm">
            <SelectValue placeholder="Toutes DREN" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="0">Toutes DREN</SelectItem>
            {drens.map((dren) => (
              <SelectItem key={dren.CODE_DREN} value={dren.CODE_DREN.toString()}>
                {dren.DREN}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={selectedCisco} onValueChange={setSelectedCisco}>
          <SelectTrigger className="w-[200px] bg-card border-border shadow-sm">
            <SelectValue placeholder="Toutes CISCO" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="0">Toutes CISCO</SelectItem>
            {ciscos.map((cisco) => (
              <SelectItem key={cisco.CODE_CISCO} value={cisco.CODE_CISCO.toString()}>
                {cisco.CISCO}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={selectedSecteur} onValueChange={setSelectedSecteur}>
          <SelectTrigger className="w-[160px] bg-card border-border shadow-sm">
            <SelectValue placeholder="Secteur" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="0">Secteur Public</SelectItem>
            <SelectItem value="1">Secteur Privé</SelectItem>
            <SelectItem value="2">Tous secteurs</SelectItem>
          </SelectContent>
        </Select>

        {loading && (
          <div className="flex items-center gap-2 text-primary">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Chargement...</span>
          </div>
        )}

        {/* Admin: choisir les années scolaires affichées */}
        {isAdmin && availableYears.length > 0 && (
          <div className="ml-auto">
            <Dialog open={yearsDialogOpen} onOpenChange={setYearsDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" onClick={openYearsDialog} className="gap-2">
                  <Settings2 className="h-4 w-4" />
                  Années affichées
                  <span className="ml-1 px-1.5 py-0.5 text-[10px] rounded bg-primary/10 text-primary">
                    {displayYears.length}/{availableYears.length}
                  </span>
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Années scolaires affichées</DialogTitle>
                  <DialogDescription>
                    Sélectionnez les années qui apparaîtront dans le dashboard (graphiques d'évolution et statistiques). Ces choix sont enregistrés sur le serveur et partagés sur tous les navigateurs.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 py-2 max-h-72 overflow-y-auto">
                  {availableYears.map(year => (
                    <label
                      key={year}
                      className="flex items-center gap-2 p-2 rounded border border-border hover:bg-muted/50 cursor-pointer transition-colors"
                    >
                      <Checkbox
                        checked={draftYears.has(year)}
                        onCheckedChange={() => toggleDraftYear(year)}
                      />
                      <span className="text-sm font-medium">{year - 1}-{year}</span>
                    </label>
                  ))}
                </div>
                <DialogFooter className="gap-2 sm:gap-2">
                  <Button variant="ghost" onClick={resetYears}>Toutes les années</Button>
                  <Button variant="outline" onClick={() => setYearsDialogOpen(false)}>Annuler</Button>
                  <Button onClick={saveYears} disabled={draftYears.size === 0}>Enregistrer</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div className="flex items-center gap-2 p-4 bg-destructive/10 border border-destructive/30 rounded-lg text-destructive">
          <AlertCircle className="h-5 w-5" />
          <span>{error}</span>
        </div>
      )}

      {/* Bannière titre - année dynamique */}
      <div className="relative overflow-hidden rounded-xl p-6 text-primary-foreground shadow-xl shadow-primary/20 animate-fade-in
                      bg-gradient-to-r from-primary via-primary/90 to-secondary">
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-12 left-20 w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none" />
        <div className="relative flex items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] opacity-80 mb-1">Tableau de bord national</p>
            <h1 className="text-2xl font-bold tracking-wide">
              Données sur les écoles · {anneeDisplay}
            </h1>
          </div>
          <div className="hidden sm:flex h-14 w-14 rounded-full bg-white/15 ring-1 ring-white/30 items-center justify-center backdrop-blur-sm">
            <BarChart3 className="h-7 w-7" />
          </div>
        </div>
      </div>

      {/* Cartes statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fade-in" style={{ animationDelay: '80ms' }}>
        {/* Nombre d'établissements */}
        <Card className="group relative overflow-hidden border-0 shadow-md hover:shadow-2xl hover:shadow-primary/15 hover:-translate-y-1 transition-all duration-300 bg-gradient-to-br from-card to-primary/5">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary to-primary/40" />
          <div className="p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-primary uppercase tracking-wide">
                  Nombre d'établissement
                </h3>
                {stats.etabYear && (
                  <p className="text-[11px] text-muted-foreground -mt-2">
                    Année {stats.etabYear - 1}-{stats.etabYear}
                    {stats.etabYear !== latestYear && " (dernière disponible)"}
                  </p>
                )}
                <div className="space-y-1.5 text-sm">
                  <div className="flex gap-3">
                    <span className="text-muted-foreground w-20">Préscolaire:</span>
                    <span className="font-semibold text-foreground tabular-nums">{formatNumber(stats.etablissements.prescolaire)}</span>
                  </div>
                  <div className="flex gap-3">
                    <span className="text-muted-foreground w-20">Primaire:</span>
                    <span className="font-semibold text-foreground tabular-nums">{formatNumber(stats.etablissements.primaire)}</span>
                  </div>
                  <div className="flex gap-3">
                    <span className="text-muted-foreground w-20">Collège:</span>
                    <span className="font-semibold text-foreground tabular-nums">{formatNumber(stats.etablissements.college)}</span>
                  </div>
                  <div className="flex gap-3">
                    <span className="text-muted-foreground w-20">Lycée:</span>
                    <span className="font-semibold text-foreground tabular-nums">{formatNumber(stats.etablissements.lycee)}</span>
                  </div>
                </div>
              </div>
              <div className="p-3 rounded-xl bg-primary/10 ring-1 ring-primary/20 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300">
                <Building2 className="h-8 w-8 text-primary" />
              </div>
            </div>
          </div>
        </Card>

        {/* Nombre d'élèves */}
        <Card className="group relative overflow-hidden border-0 shadow-md hover:shadow-2xl hover:shadow-secondary/15 hover:-translate-y-1 transition-all duration-300 bg-gradient-to-br from-card to-secondary/5">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-secondary to-secondary/40" />
          <div className="p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-secondary uppercase tracking-wide">
                  Nombre d'élèves
                </h3>
                {stats.elevesYear && (
                  <p className="text-[11px] text-muted-foreground -mt-2">
                    Année {stats.elevesYear - 1}-{stats.elevesYear}
                    {stats.elevesYear !== latestYear && " (dernière disponible)"}
                  </p>
                )}
                <div className="space-y-1.5 text-sm">
                  <div className="flex gap-3">
                    <span className="text-muted-foreground w-20">Préscolaire:</span>
                    <span className="font-semibold text-foreground tabular-nums">{formatNumber(stats.eleves.prescolaire)}</span>
                  </div>
                  <div className="flex gap-3">
                    <span className="text-muted-foreground w-20">Primaire:</span>
                    <span className="font-semibold text-foreground tabular-nums">{formatNumber(stats.eleves.primaire)}</span>
                  </div>
                  <div className="flex gap-3">
                    <span className="text-muted-foreground w-20">Collège:</span>
                    <span className="font-semibold text-foreground tabular-nums">{formatNumber(stats.eleves.college)}</span>
                  </div>
                  <div className="flex gap-3">
                    <span className="text-muted-foreground w-20">Lycée:</span>
                    <span className="font-semibold text-foreground tabular-nums">{formatNumber(stats.eleves.lycee)}</span>
                  </div>
                </div>
              </div>
              <div className="p-3 rounded-xl bg-secondary/10 ring-1 ring-secondary/20 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300">
                <Users className="h-8 w-8 text-secondary" />
              </div>
            </div>
          </div>
        </Card>

        {/* Nombre d'enseignants */}
        <Card className="group relative overflow-hidden border-0 shadow-md hover:shadow-2xl hover:shadow-destructive/10 hover:-translate-y-1 transition-all duration-300 bg-gradient-to-br from-card to-destructive/5">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-destructive to-destructive/40" />
          <div className="p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-destructive uppercase tracking-wide">
                  Nombre d'enseignants en salle
                </h3>
                {stats.enseignantsYear && (
                  <p className="text-[11px] text-muted-foreground -mt-2">
                    Année {stats.enseignantsYear - 1}-{stats.enseignantsYear}
                    {stats.enseignantsYear !== latestYear && " (dernière disponible)"}
                  </p>
                )}
                <div className="space-y-1.5 text-sm">
                  <div className="flex gap-3">
                    <span className="text-muted-foreground w-20">Préscolaire:</span>
                    <span className="font-semibold text-foreground tabular-nums">{formatNumber(stats.enseignants.prescolaire)}</span>
                  </div>
                  <div className="flex gap-3">
                    <span className="text-muted-foreground w-20">Primaire:</span>
                    <span className="font-semibold text-foreground tabular-nums">{formatNumber(stats.enseignants.primaire)}</span>
                  </div>
                  <div className="flex gap-3">
                    <span className="text-muted-foreground w-20">Collège:</span>
                    <span className="font-semibold text-foreground tabular-nums">{formatNumber(stats.enseignants.college)}</span>
                  </div>
                  <div className="flex gap-3">
                    <span className="text-muted-foreground w-20">Lycée:</span>
                    <span className="font-semibold text-foreground tabular-nums">{formatNumber(stats.enseignants.lycee)}</span>
                  </div>
                </div>
              </div>
              <div className="p-3 rounded-xl bg-destructive/10 ring-1 ring-destructive/20 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300">
                <GraduationCap className="h-8 w-8 text-destructive" />
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Section Répartition des diplômes */}
      <Card className="bg-card shadow-md border-0 animate-fade-in" style={{ animationDelay: '160ms' }}>
        <div className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-8 w-1 rounded-full bg-gradient-to-b from-primary to-secondary" />
            <h2 className="text-lg font-semibold text-foreground">
              Répartition des diplômes par niveau
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Primaire */}
            <div className="bg-muted/40 rounded-xl p-4 hover:bg-muted/60 transition-colors">
              <h3 className="font-medium text-foreground mb-4">Primaire</h3>
              <div className="flex flex-wrap gap-2 mb-4 text-xs">
                {diplomePrimaire.map((item) => (
                  <div key={item.name} className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded" style={{ backgroundColor: item.color }} />
                    <span className="text-muted-foreground">{item.name}</span>
                  </div>
                ))}
              </div>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={diplomePrimaire} cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={2} dataKey="value">
                      {diplomePrimaire.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Collège */}
            <div className="bg-muted/40 rounded-xl p-4 hover:bg-muted/60 transition-colors">
              <h3 className="font-medium text-foreground mb-4">Collège</h3>
              <div className="flex flex-wrap gap-2 mb-4 text-xs">
                {diplomeCollege.map((item) => (
                  <div key={item.name} className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded" style={{ backgroundColor: item.color }} />
                    <span className="text-muted-foreground">{item.name}</span>
                  </div>
                ))}
              </div>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={diplomeCollege} cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={2} dataKey="value">
                      {diplomeCollege.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Lycée */}
            <div className="bg-muted/40 rounded-xl p-4 hover:bg-muted/60 transition-colors">
              <h3 className="font-medium text-foreground mb-4">Lycée</h3>
              <div className="flex flex-wrap gap-2 mb-4 text-xs">
                {diplomeLycee.map((item) => (
                  <div key={item.name} className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded" style={{ backgroundColor: item.color }} />
                    <span className="text-muted-foreground">{item.name}</span>
                  </div>
                ))}
              </div>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={diplomeLycee} cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={2} dataKey="value">
                      {diplomeLycee.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Section Évolution des écoles */}
      <Card className="bg-card shadow-md border-0 animate-fade-in" style={{ animationDelay: '240ms' }}>
        <div className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-8 w-1 rounded-full bg-primary" />
            <h2 className="text-lg font-semibold text-foreground">
              Évolution du nombre d'écoles
            </h2>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={evolutionEtabData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="annee" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(value) => formatNumber(value)} />
                <Tooltip formatter={(value: number) => formatNumber(value)} />
                <Line type="monotone" dataKey="prescolaire" stroke="hsl(var(--chart-1))" strokeWidth={2.5} name="Préscolaire" dot={{ r: 4 }} activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="primaire" stroke="hsl(var(--chart-2))" strokeWidth={2.5} name="Primaire" dot={{ r: 4 }} activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="college" stroke="hsl(var(--chart-3))" strokeWidth={2.5} name="Collège" dot={{ r: 4 }} activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="lycee" stroke="hsl(var(--chart-4))" strokeWidth={2.5} name="Lycée" dot={{ r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap justify-center gap-6 mt-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ background: 'hsl(var(--chart-1))' }} />
              <span className="text-sm text-muted-foreground">Préscolaire</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ background: 'hsl(var(--chart-2))' }} />
              <span className="text-sm text-muted-foreground">Primaire</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ background: 'hsl(var(--chart-3))' }} />
              <span className="text-sm text-muted-foreground">Collège</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ background: 'hsl(var(--chart-4))' }} />
              <span className="text-sm text-muted-foreground">Lycée</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Section Évolution des élèves */}
      <Card className="bg-card shadow-md border-0 animate-fade-in" style={{ animationDelay: '320ms' }}>
        <div className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-8 w-1 rounded-full bg-secondary" />
            <h2 className="text-lg font-semibold text-foreground">
              Évolution du nombre d'élèves
            </h2>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={evolutionElevesData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="annee" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(value) => formatNumber(value)} />
                <Tooltip formatter={(value: number) => formatNumber(value)} />
                <Line type="monotone" dataKey="prescolaire" stroke="hsl(var(--chart-1))" strokeWidth={2.5} name="Préscolaire" dot={{ r: 4 }} activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="primaire" stroke="hsl(var(--chart-2))" strokeWidth={2.5} name="Primaire" dot={{ r: 4 }} activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="college" stroke="hsl(var(--chart-3))" strokeWidth={2.5} name="Collège" dot={{ r: 4 }} activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="lycee" stroke="hsl(var(--chart-4))" strokeWidth={2.5} name="Lycée" dot={{ r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap justify-center gap-6 mt-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ background: 'hsl(var(--chart-1))' }} />
              <span className="text-sm text-muted-foreground">Préscolaire</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ background: 'hsl(var(--chart-2))' }} />
              <span className="text-sm text-muted-foreground">Primaire</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ background: 'hsl(var(--chart-3))' }} />
              <span className="text-sm text-muted-foreground">Collège</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ background: 'hsl(var(--chart-4))' }} />
              <span className="text-sm text-muted-foreground">Lycée</span>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default Dashboard;
