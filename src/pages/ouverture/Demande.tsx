// @ts-nocheck
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Search, Eye, Filter, ClipboardList, CalendarDays, Loader2, RefreshCw,
  Database, Layers, AlertTriangle, Trash2, ShieldCheck, ShieldAlert,
  BookOpen, School, Users, GraduationCap,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

import { useAuth } from "@/contexts/AuthContext";
import { demandeService } from "@/services/demandeService";
import { asList } from "@/services/demandeApi";
import { mapDemande } from "@/utils/demandeHelpers";

import DemandeDetailModal from "@/components/demandes/DemandeDetailModal";
import BoutonFicheTechnique from "@/components/demandes/BoutonFicheTechnique";
import { StatCard, FilterField } from "@/components/demandes/StatCardEtFilterField";
import logoMen from "@/assets/logoMen.jpg";
import logoDpe from "@/assets/logoDpe.jpg";

import { buildAnalyseContext, analyserNormes, detectPhase } from "@/services/normesAnalyse";
import { normaliserStatutAnalyse } from "@/components/demandes/AnalyseInline";
import {
  getEnseignantsAnalyse, getInfoComplementaireAnalyse, getEtablissementsProchesAnalyse,
  getAireRecrutementAnalyse, getEvolutionEffectifsAnalyse, getPiecesAnalyse,
  niveauToKey, calculerDernierEffectifConnu, getCodeProvisoireMen,
  getAccessibiliteSite, getDistancePlusProche, premierNonVide,
} from "@/utils/demandeHelpers";

const normaliser = (val) => String(val || "").toLowerCase().trim();
const normaliserCode = (val) => {
  const n = Number(val);
  return Number.isFinite(n) ? String(n) : String(val || "").trim();
};

const NIVEAU_TABS = [
  { key: "Tous",       label: "Tous",        icon: Layers },
  { key: "Préscolaire",label: "Préscolaire", icon: BookOpen, activeBg: "bg-amber-600",   activeText: "text-white" },
  { key: "Primaire",   label: "Primaire",    icon: School,   activeBg: "bg-emerald-600", activeText: "text-white" },
  { key: "Collège",    label: "Collège",     icon: Users,    activeBg: "bg-blue-600",    activeText: "text-white" },
  { key: "Lycée",      label: "Lycée",       icon: GraduationCap, activeBg: "bg-violet-600", activeText: "text-white" },
];

const TYPE_DEMANDE_LABEL = {
  Tous: "Tous les types",
  "Nouvelle création": "Nouvelle création",
  "Régularisation": "Régularisation",
};

const NIVEAU_LABEL = {
  Tous: "Tous les niveaux",
  "Préscolaire": "Préscolaire",
  "Primaire": "Primaire",
  "Collège": "Collège",
  "Lycée": "Lycée",
};

const calculerAnalyseValidee = (demande) => {
  if (!demande) return false;
  try {
    const base = buildAnalyseContext({
      details: demande,
      enseignants: getEnseignantsAnalyse(demande),
      infoComplementaire: getInfoComplementaireAnalyse(demande),
      etablissementsProches: getEtablissementsProchesAnalyse(demande),
      aireRecrutement: getAireRecrutementAnalyse(demande),
      evolutionEffectifs: getEvolutionEffectifsAnalyse(demande),
      pieces: getPiecesAnalyse(demande),
      niveauKey: niveauToKey(demande?.niveau_etab || demande?.niveau),
      surfaceTerrain: premierNonVide(
        demande?.nouvelle_creation?.surface_terrain_prevu,
        demande?.regularisation?.surface_terrain,
        demande?.ressources?.surface_terrain,
      ),
    });

    const effectif = calculerDernierEffectifConnu(demande);
    const codeProv = getCodeProvisoireMen(demande);
    const acc = getAccessibiliteSite(demande);
    const dist = getDistancePlusProche(demande);

    const ctx = {
      ...base,
      effectif_total: effectif,
      effectif,
      nombre_eleves: effectif,
      code_provisoire: codeProv,
      code_provisoire_men: codeProv,
      code_etab: codeProv,
      accessibilite_site: acc,
      accessibilite: acc,
      distance_plus_proche: dist,
      regularisation: demande?.regularisation || null,
      nouvelle_creation: demande?.nouvelle_creation || null,
      surfaceTerrain: premierNonVide(
        demande?.nouvelle_creation?.surface_terrain_prevu,
        demande?.regularisation?.surface_terrain,
        demande?.ressources?.surface_terrain,
      ),
    };

    const analyse = analyserNormes(ctx, detectPhase(ctx));
    const items = Array.isArray(analyse?.items) ? analyse.items : [];
    const nonConformes = items.filter((i) => {
      const s = normaliserStatutAnalyse(i);
      return s !== "conforme" && s !== "non_applicable";
    }).length;

    return nonConformes === 0 && analyse?.verdict === "validee" && items.length > 0;
  } catch (e) {
    console.error("Erreur calcul analyseValidee :", e);
    return false;
  }
};

export default function Demandes() {
  const { user } = useAuth();
  const [demandes, setDemandes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [recherche, setRecherche] = useState("");
  const [niveau, setNiveau] = useState("Tous");
  const [typeDemande, setTypeDemande] = useState("Tous");

  const [filtres, setFiltres] = useState({ recherche: "", niveau: "Tous", typeDemande: "Tous" });
  const [isFilterDirty, setIsFilterDirty] = useState(false);

  const [detailOuvert, setDetailOuvert] = useState(false);
  const [detailChargement, setDetailChargement] = useState(false);
  const [detailDemande, setDetailDemande] = useState(null);
  const [detailErreur, setDetailErreur] = useState("");

  const [suppressionOuverte, setSuppressionOuverte] = useState(false);
  const [demandeASupprimer, setDemandeASupprimer] = useState(null);
  const [suppressionEnCours, setSuppressionEnCours] = useState(false);

  const detailReqRef = useRef(0);
  const detailCacheRef = useRef(new Map());
  const detailPromesses = useRef(new Map());

  const analyseCacheRef = useRef(new Map());
  const [versionAnalyse, setVersionAnalyse] = useState(0);

  const getAnalyseValidee = (demande) => {
    if (!demande?.id) return false;
    if (analyseCacheRef.current.has(demande.id)) {
      return analyseCacheRef.current.get(demande.id);
    }
    const enCache = detailCacheRef.current.get(demande.id);
    if (!enCache) return undefined;
    const v = calculerAnalyseValidee(enCache);
    analyseCacheRef.current.set(demande.id, v);
    return v;
  };

  const isAdmin = !!user?.is_superuser || !!user?.is_staff;
  const codeCiscoUser = normaliserCode(user?.cisco);
  const codeDrenUser = normaliserCode(user?.dren);
  const hasCisco = codeCiscoUser !== "" && codeCiscoUser !== "0" && codeCiscoUser !== "NaN";
  const hasDren = codeDrenUser !== "" && codeDrenUser !== "0" && codeDrenUser !== "NaN";
  const isCISCO = !isAdmin && hasCisco;
  const isDREN = !isAdmin && !isCISCO && hasDren;
  const isDPE = !isAdmin && !isCISCO && !isDREN;

  const markFilterDirty = () => setIsFilterDirty(true);

  const chargerDetail = (id) => {
    if (!detailPromesses.current.has(id)) {
      const p = demandeService
        .detailComplet(id)
        .then((response) => {
          const data = response?.data ?? response;
          detailCacheRef.current.set(id, data);
          setVersionAnalyse(v => v + 1);
          return data;
        })
        .finally(() => detailPromesses.current.delete(id));
      detailPromesses.current.set(id, p);
    }
    return detailPromesses.current.get(id);
  };

  const prechargerDetail = (id) => {
    if (!detailCacheRef.current.has(id)) chargerDetail(id).catch(() => {});
  };

  // ✅ CORRIGÉ : la liste s'affiche immédiatement, les détails se chargent en arrière-plan
  const chargerDemandes = async () => {
    detailCacheRef.current.clear();
    analyseCacheRef.current.clear();
    setVersionAnalyse(0);
    setLoading(true);
    setError("");
    try {
      const response = await demandeService.list();
      const data = asList(response);
      setDemandes(data.map(mapDemande));
      setLoading(false);  // ✅ Liste affichée AVANT les détails

      // ✅ Détails en arrière-plan (non bloquant, sans await global)
      for (const d of data) {
        chargerDetail(d.id_demande ?? d.id).catch(() => {});
      }
    } catch (e) {
      console.error("Erreur chargement demandes :", e);
      setError(e?.message || "Impossible de charger les demandes depuis le serveur.");
      setDemandes([]);
      setLoading(false);
    }
  };

  useEffect(() => { chargerDemandes(); }, []);

  const ouvrirDetail = (demande) => {
    const id = demande?.id;
    if (!id) return;
    const reqId = ++detailReqRef.current;
    setDetailOuvert(true);
    setDetailErreur("");
    setDetailChargement(false);
    setDetailDemande(demande);

    const enCache = detailCacheRef.current.get(id);
    if (enCache) {
      setDetailDemande({ ...demande, ...enCache });
      return;
    }

    chargerDetail(id)
      .then((data) => {
        if (reqId !== detailReqRef.current) return;
        setDetailDemande({ ...demande, ...data });
      })
      .catch((e) => {
        if (reqId !== detailReqRef.current) return;
        console.error("Erreur chargement détail (non bloquant) :", e);
      });
  };

  const fermerDetail = () => {
    detailReqRef.current++;
    setDetailOuvert(false);
    setDetailDemande(null);
    setDetailErreur("");
    setDetailChargement(false);
  };

  const ouvrirSuppression = (demande) => {
    setDemandeASupprimer(demande);
    setSuppressionOuverte(true);
  };

  const confirmerSuppression = async () => {
    if (!demandeASupprimer) return;
    setSuppressionEnCours(true);
    try {
      await demandeService.remove(demandeASupprimer.id);
      detailCacheRef.current.delete(demandeASupprimer.id);
      analyseCacheRef.current.delete(demandeASupprimer.id);
      setDemandes((prev) => prev.filter((d) => d.id !== demandeASupprimer.id));
      setSuppressionOuverte(false);
      setDemandeASupprimer(null);
      setVersionAnalyse(v => v + 1);
    } catch (e) {
      console.error("Erreur suppression demande :", e);
      setError(e?.message || "Impossible de supprimer la demande.");
    } finally {
      setSuppressionEnCours(false);
    }
  };

  const handleFilter = () => {
    setFiltres({ recherche, niveau, typeDemande });
    setIsFilterDirty(false);
  };

  const handleReset = () => {
    setRecherche("");
    setNiveau("Tous");
    setTypeDemande("Tous");
    setFiltres({ recherche: "", niveau: "Tous", typeDemande: "Tous" });
    setIsFilterDirty(false);
  };

  const handleNiveauTab = (niveauChoisi) => {
    setNiveau(niveauChoisi);
    setFiltres((prev) => ({ ...prev, niveau: niveauChoisi }));
    setIsFilterDirty(false);
  };

  const demandesFiltrees = useMemo(() => {
    let filtered = demandes;

    if (isCISCO) {
      filtered = filtered.filter((d) => {
        const codeDemande = normaliserCode(d.code_cisco);
        const estLycee = d.niveau === "Lycée";
        return codeDemande !== "" && codeDemande === codeCiscoUser && !estLycee;
      });
    } else if (isDREN) {
      filtered = filtered.filter((d) => {
        const codeDemande = normaliserCode(d.code_dren);
        return codeDemande !== "" && codeDemande === codeDrenUser;
      });
    } else if (isDPE) {
      filtered = filtered.filter((d) => d.niveau === "Lycée");
    }

    const texte = normaliser(filtres.recherche);
    return filtered.filter((demande) => {
      const correspondRecherche = !texte ||
        normaliser(demande.reference).includes(texte) ||
        normaliser(demande.nom_etab).includes(texte) ||
        normaliser(demande.demandeur).includes(texte) ||
        normaliser(demande.commune).includes(texte) ||
        normaliser(demande.cisco).includes(texte);
      return correspondRecherche &&
        (filtres.niveau === "Tous" || demande.niveau === filtres.niveau) &&
        (filtres.typeDemande === "Tous" || demande.type_demande === filtres.typeDemande);
    });
  }, [demandes, filtres, isCISCO, isDPE, isDREN, codeCiscoUser, codeDrenUser]);

  const stats = useMemo(() => {
    const total = demandesFiltrees.length;
    let validees = 0;
    for (const d of demandesFiltrees) {
      if (getAnalyseValidee(d) === true) validees++;
    }
    return { total, validees, nonValidees: total - validees };
  }, [demandesFiltrees, versionAnalyse]);

  const STAT_THEMES = {
    total:       { ring: "ring-blue-500/30 border-blue-500/20",       iconBg: "bg-blue-500/10",    iconColor: "text-blue-600 dark:text-blue-400" },
    validees:    { ring: "ring-emerald-500/30 border-emerald-500/20", iconBg: "bg-emerald-500/10", iconColor: "text-emerald-600 dark:text-emerald-400" },
    nonValidees: { ring: "ring-rose-500/30 border-rose-500/20",       iconBg: "bg-rose-500/10",    iconColor: "text-rose-600 dark:text-rose-400" },
  };

  return (
    <div className="space-y-6 pb-8">
      <div className="sticky top-0 z-30 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 shadow-sm">
        <div className="mx-auto max-w-none px-4 py-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 shrink-0">
              <img src={logoMen} alt="MEN" className="h-10 w-10 rounded-md object-contain ring-1 ring-border bg-white p-0.5" />
              <img src={logoDpe} alt="DPE" className="h-10 w-10 rounded-md object-contain ring-1 ring-border bg-white p-0.5" />
            </div>

            <div className="flex-1 min-w-[220px]">
              <h1 className="text-base sm:text-lg font-bold leading-tight text-foreground">
                Demandes d'ouverture
              </h1>
              <p className="text-xs text-muted-foreground">
                Ministère de l'Éducation Nationale · Consultation et vérification des demandes
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {loading && (
                <Badge variant="outline" className="gap-1 text-xs text-muted-foreground">
                  <RefreshCw className="h-3 w-3 animate-spin" /> Chargement
                </Badge>
              )}
              <Badge variant="outline" className="gap-1 text-xs">
                <Database className="h-3 w-3" /> {demandesFiltrees.length} / {demandes.length}
              </Badge>
              <Button variant="outline" size="sm" onClick={chargerDemandes} disabled={loading}>
                <RefreshCw className={cn("mr-2 h-4 w-4", loading && "animate-spin")} /> Actualiser
              </Button>
            </div>
          </div>

          <div className="mt-2 flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t pt-2 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center rounded-md border border-border overflow-hidden shrink-0">
                {NIVEAU_TABS.map((tab) => {
                  const Icon = tab.icon;
                  const active = filtres.niveau === tab.key;
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => handleNiveauTab(tab.key)}
                      className={cn(
                        "inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide transition-colors",
                        active
                          ? cn(tab.activeBg || "bg-primary", tab.activeText || "text-primary-foreground", "shadow-inner")
                          : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground",
                      )}
                      aria-pressed={active}
                    >
                      <Icon className="h-3 w-3" /> {tab.label}
                    </button>
                  );
                })}
              </div>
              <span className="text-foreground">
                Filtres : <strong>{NIVEAU_LABEL[filtres.niveau]}</strong> ·{" "}
                <strong>{TYPE_DEMANDE_LABEL[filtres.typeDemande]}</strong>
                {filtres.recherche && (
                  <> · Recherche : <strong>« {filtres.recherche} »</strong></>
                )}
              </span>
            </div>

            {demandesFiltrees.length > 0 && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground">
                <span><strong className="text-foreground">{stats.total}</strong> demandes</span>
                <span><strong className="text-foreground">{stats.validees}</strong> validées</span>
                <span><strong className="text-foreground">{stats.nonValidees}</strong> non validées</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="mx-3 sm:mx-4 p-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-xs font-medium flex items-start gap-2">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <Card className="border-border/60 shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-2.5 border-b bg-muted/30">
          <Filter className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Recherche et filtres</h2>
          <div className="ml-auto">
            <Badge variant="outline" className="text-[10px] font-normal border-green-500 text-green-600 bg-green-50 dark:bg-green-950 dark:text-green-400 px-3 py-1">
              {demandesFiltrees.length} / {demandes.length} demandes
            </Badge>
          </div>
        </div>
        <CardContent className="p-4 sm:p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
            <FilterField label="Rechercher">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={recherche}
                  onChange={(e) => { setRecherche(e.target.value); markFilterDirty(); }}
                  placeholder="Référence, établissement, demandeur…"
                  className="bg-background pl-9 h-10"
                />
              </div>
            </FilterField>

            <FilterField label="Niveau">
              <select
                value={niveau}
                onChange={(e) => { setNiveau(e.target.value); markFilterDirty(); }}
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              >
                <option value="Tous">Tous les niveaux</option>
                <option value="Préscolaire">Préscolaire</option>
                <option value="Primaire">Primaire</option>
                <option value="Collège">Collège</option>
                <option value="Lycée">Lycée</option>
              </select>
            </FilterField>

            <FilterField label="Type de demande">
              <select
                value={typeDemande}
                onChange={(e) => { setTypeDemande(e.target.value); markFilterDirty(); }}
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              >
                <option value="Tous">Tous les types</option>
                <option value="Nouvelle création">Nouvelle création</option>
                <option value="Régularisation">Régularisation</option>
              </select>
            </FilterField>

            <div className="flex items-end gap-2">
              <Button onClick={handleFilter} disabled={loading} className="flex-1 h-10 shadow-sm">
                {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Filter className="h-4 w-4 mr-2" />}
                Filtrer
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={handleReset}
                disabled={loading}
                className="h-10 w-10"
                title="Réinitialiser les filtres"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard icon={ClipboardList} theme={STAT_THEMES.total}       label="Total des demandes" value={String(stats.total)}       hint="Demandes visibles" />
        <StatCard icon={ShieldCheck}   theme={STAT_THEMES.validees}    label="Validées"           value={String(stats.validees)}    hint="Analyse conforme" />
        <StatCard icon={ShieldAlert}   theme={STAT_THEMES.nonValidees} label="Non validées"       value={String(stats.nonValidees)} hint="Analyse non conforme" />
      </div>

      <Card className="border-border/60 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-5 py-3 border-b bg-muted/30">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">
              Liste des demandes — {NIVEAU_LABEL[filtres.niveau]}
            </h3>
            {demandesFiltrees.length > 0 && (
              <Badge variant="secondary" className="font-normal">
                {demandesFiltrees.length} ligne{demandesFiltrees.length > 1 ? "s" : ""}
              </Badge>
            )}
          </div>
          <div className="text-xs text-muted-foreground hidden sm:flex items-center gap-1.5">
            <Layers className="h-3 w-3" /> Triable et consultable
          </div>
        </div>

        <CardContent className="p-0">
          {loading && demandes.length === 0 ? (
            <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Chargement des demandes…</p>
            </div>
          ) : demandesFiltrees.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-blue-100/80 dark:bg-blue-950/40">
                    {["Référence", "Établissement", "Niveau", "Demandeur", "Date", "Type demande"].map((h) => (
                      <th key={h} className="text-left py-3 px-3 font-bold uppercase tracking-wider text-[11px] whitespace-nowrap">{h}</th>
                    ))}
                    <th className="text-right py-3 px-3 font-bold uppercase tracking-wider text-[11px]">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {demandesFiltrees.map((demande) => {
                    const analyseOk = getAnalyseValidee(demande);
                    return (
                      <tr key={demande.id} className="border-b last:border-0 hover:bg-muted/40 transition-colors">
                        <td className="py-3 px-3 font-medium whitespace-nowrap text-xs">{demande.reference}</td>
                        <td className="py-3 px-3">
                          <div className="font-medium text-sm">{demande.nom_etab}</div>
                          <div className="text-xs text-muted-foreground">{demande.commune} · {demande.cisco}</div>
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap text-sm">{demande.niveau}</td>
                        <td className="py-3 px-3 text-sm">{demande.demandeur}</td>
                        <td className="py-3 px-3 whitespace-nowrap text-sm">
                          <div className="flex items-center gap-2">
                            <CalendarDays className="h-4 w-4 text-muted-foreground" /> {demande.date_depot}
                          </div>
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <Badge variant="outline" className="text-[10px] font-semibold border-primary/30 bg-primary/5 text-primary">
                            {demande.type_demande_label}
                          </Badge>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="inline-flex items-center gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              onMouseEnter={() => prechargerDetail(demande.id)}
                              onClick={() => ouvrirDetail(demande)}
                              className="gap-1.5 h-8"
                              title="Voir le détail"
                            >
                              <Eye className="h-3.5 w-3.5" /> Voir
                            </Button>

                            <BoutonFicheTechnique
                              demande={demande}
                              analyseValidee={analyseOk === true}
                              vueRef={null}
                              chargerDetail={chargerDetail}
                              enLien={true}
                            />

                            {isAdmin && (
                              <Button variant="outline" size="sm" onClick={() => ouvrirSuppression(demande)}
                                className="gap-1.5 h-8 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-900 dark:hover:bg-red-950/30"
                                title="Supprimer la demande">
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center min-h-[400px] px-6 text-center">
              <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-muted mb-4">
                <Filter className="h-6 w-6 text-muted-foreground" />
              </div>

              {isFilterDirty ? (
                <>
                  <p className="text-sm font-semibold text-foreground">Filtres modifiés</p>
                  <p className="text-xs text-muted-foreground mt-1.5 max-w-sm mx-auto">
                    Les critères de recherche ont été modifiés.<br />
                    Cliquez sur « Filtrer » pour appliquer les changements.
                  </p>
                </>
              ) : demandes.length === 0 ? (
                <>
                  <p className="text-sm font-semibold text-foreground">Aucune demande enregistrée</p>
                  <p className="text-xs text-muted-foreground mt-1.5 max-w-sm mx-auto">
                    Aucune demande n'a encore été soumise.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-semibold text-foreground">Aucune demande trouvée</p>
                  <p className="text-xs text-muted-foreground mt-1.5 max-w-sm mx-auto">
                    Aucune demande ne correspond à ce niveau ou aux filtres sélectionnés.
                  </p>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <DemandeDetailModal
        ouvert={detailOuvert}
        onClose={fermerDetail}
        chargement={detailChargement}
        erreur={detailErreur}
        demande={detailDemande}
      />

      <Dialog open={suppressionOuverte} onOpenChange={setSuppressionOuverte}>
        <DialogContent className="w-[95vw] sm:w-[480px] max-w-[480px] p-0 gap-0">
          <DialogHeader className="border-b px-6 py-4">
            <DialogTitle className="flex items-center gap-2 text-red-600 text-sm sm:text-base">
              <AlertTriangle className="h-5 w-5" /> Confirmer la suppression
            </DialogTitle>
            <DialogDescription className="text-sm pt-1">
              Voulez-vous vraiment supprimer cette demande ? Cette action est <strong>irréversible</strong>.
            </DialogDescription>
          </DialogHeader>

          {demandeASupprimer && (
            <div className="px-6 py-4">
              <div className="rounded-lg border bg-muted/30 p-3 space-y-1.5 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Référence</span>
                  <span className="font-medium">{demandeASupprimer.reference}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Établissement</span>
                  <span className="font-medium truncate max-w-[200px]">{demandeASupprimer.nom_etab}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Niveau</span>
                  <span className="font-medium">{demandeASupprimer.niveau}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Type</span>
                  <span className="font-medium">{demandeASupprimer.type_demande_label}</span>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 border-t px-6 py-3">
            <Button variant="outline" size="sm" onClick={() => setSuppressionOuverte(false)} disabled={suppressionEnCours}>Annuler</Button>
            <Button variant="destructive" size="sm" onClick={confirmerSuppression} disabled={suppressionEnCours}
              className="gap-2 bg-red-600 hover:bg-red-700">
              {suppressionEnCours ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              {suppressionEnCours ? "Suppression…" : "Ok"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}