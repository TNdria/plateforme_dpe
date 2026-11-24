import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { dashboardApi, donneesApi, Dren, Cisco, Zap } from '@/services/api';

interface Commune {
  CODE_COMMUNE: number;
  COMMUNE: string;
}

/**
 * Périmètre autorisé pour les filtres du module Données.
 * `dren`/`cisco` sont les valeurs par défaut (celles du profil connecté),
 * `drenLocked`/`ciscoLocked` interdisent toute sortie de ce périmètre.
 */
export interface DonneesFilterScope {
  dren: string;
  cisco: string;
  drenLocked: boolean;
  ciscoLocked: boolean;
}

export const NATIONAL_FILTER_SCOPE: DonneesFilterScope = {
  dren: '0',
  cisco: '0',
  drenLocked: false,
  ciscoLocked: false,
};

/**
 * Déduplique un tableau selon une clé (ex: CODE_ZAP, CODE_COMMUNE).
 * Nécessaire car les endpoints DREN/CISCO/ZAP/Commune peuvent renvoyer
 * plusieurs lignes pour un même code (jointure avec les établissements).
 */
const dedupeByKey = <T,>(rows: T[] | null | undefined, keyFn: (row: T) => string): T[] => {
  if (!rows) return [];
  const map = new Map<string, T>();
  for (const row of rows) {
    const key = keyFn(row).trim();
    if (key && !map.has(key)) map.set(key, row);
  }
  return Array.from(map.values());
};

export const useDonneesFilters = (scope: DonneesFilterScope = NATIONAL_FILTER_SCOPE) => {
  const [drens, setDrens] = useState<Dren[]>([]);
  const [ciscos, setCiscos] = useState<Cisco[]>([]);
  const [zaps, setZaps] = useState<Zap[]>([]);
  const [communes, setCommunes] = useState<Commune[]>([]);
  const [selectedDren, setSelectedDren] = useState<string>(scope.dren);
  const [selectedCisco, setSelectedCisco] = useState<string>(scope.cisco);
  const [selectedZap, setSelectedZap] = useState<string>('0');
  const [selectedCommune, setSelectedCommune] = useState<string>('0');
  const [selectedSecteur, setSelectedSecteur] = useState<string>('2');
  const [loadingFilters, setLoadingFilters] = useState(false);

  // Initialise (ou réinitialise après connexion / déconnexion) les listes et
  // les sélections sur le périmètre autorisé. Les listes DREN/CISCO sont
  // elles-mêmes restreintes au périmètre : on ne peut pas choisir une valeur
  // hors autorisation depuis l'interface.
  useEffect(() => {
    let cancelled = false;

    const loadScope = async () => {
      setSelectedDren(scope.dren);
      setSelectedCisco(scope.cisco);
      setSelectedZap('0');
      setSelectedCommune('0');
      setCiscos([]);
      setZaps([]);
      setCommunes([]);
      setLoadingFilters(true);

      try {
        const drenRows = await dashboardApi.getDrens();
        if (cancelled) return;
        const allDrens = dedupeByKey(drenRows, (d) => String(d.CODE_DREN));
        setDrens(
          scope.drenLocked
            ? allDrens.filter((d) => String(d.CODE_DREN) === scope.dren)
            : allDrens,
        );

        if (scope.dren === '0') return;

        const ciscoRows = await dashboardApi.getCiscos(Number(scope.dren));
        if (cancelled) return;
        const allCiscos = dedupeByKey(ciscoRows, (c) => String(c.CODE_CISCO));
        setCiscos(
          scope.ciscoLocked
            ? allCiscos.filter((c) => String(c.CODE_CISCO) === scope.cisco)
            : allCiscos,
        );

        // Périmètre CISCO : charge directement ZAP/communes pour permettre la
        // descente sans sélection manuelle supplémentaire.
        if (scope.cisco === '0') return;

        const [zapRows, communeRows] = await Promise.all([
          donneesApi.getZaps(Number(scope.dren), Number(scope.cisco), 0),
          donneesApi.getCommunes(Number(scope.dren), Number(scope.cisco), 0),
        ]);
        if (cancelled) return;
        setZaps(dedupeByKey(zapRows, (z) => String(z.CODE_ZAP)));
        setCommunes(dedupeByKey(communeRows, (c) => String(c.CODE_COMMUNE)));
      } catch (err) {
        if (!cancelled) {
          console.error('Erreur lors du chargement des filtres du périmètre', err);
          toast.error('Erreur lors du chargement des filtres');
        }
      } finally {
        if (!cancelled) setLoadingFilters(false);
      }
    };

    loadScope();
    return () => {
      cancelled = true;
    };
  }, [scope.dren, scope.cisco, scope.drenLocked, scope.ciscoLocked]);

  const handleDrenChange = async (value: string) => {
    // Hors périmètre : la DREN d'un utilisateur rattaché n'est pas modifiable.
    if (scope.drenLocked) return;

    setSelectedDren(value);
    setSelectedCisco('0');
    setSelectedZap('0');
    setSelectedCommune('0');
    setCiscos([]);
    setZaps([]);
    setCommunes([]);

    if (value !== '0') {
      try {
        setLoadingFilters(true);
        const data = await dashboardApi.getCiscos(Number(value));
        setCiscos(dedupeByKey(data, (c) => String(c.CODE_CISCO)));
      } catch (err) {
        toast.error('Erreur lors du chargement des CISCOs');
      } finally {
        setLoadingFilters(false);
      }
    }
  };

  const handleCiscoChange = async (value: string) => {
    // Hors périmètre : la CISCO d'un utilisateur rattaché n'est pas modifiable.
    if (scope.ciscoLocked) return;

    setSelectedCisco(value);
    setSelectedZap('0');
    setSelectedCommune('0');
    setZaps([]);
    setCommunes([]);
    // La liste des CISCO dépend de la DREN, pas du CISCO choisi : la vider
    // ici laissait un menu CISCO sans options après « Réinitialiser ».

    if (value !== '0') {
      try {
        setLoadingFilters(true);
        // Communes = toutes celles du CISCO tant qu'aucun ZAP n'est choisi (zap=0)
        const [zapsData, communesData] = await Promise.all([
          donneesApi.getZaps(Number(selectedDren), Number(value), 0),
          donneesApi.getCommunes(Number(selectedDren), Number(value), 0)
        ]);
        setZaps(dedupeByKey(zapsData, (z) => String(z.CODE_ZAP)));
        setCommunes(dedupeByKey(communesData, (c) => String(c.CODE_COMMUNE)));
      } catch (err) {
        toast.error('Erreur lors du chargement des filtres');
      } finally {
        setLoadingFilters(false);
      }
    }
  };

  // ZAP et Commune sont deux critères indépendants à l'intérieur du CISCO :
  // en base ils se recoupent (une commune peut relever de plusieurs ZAP, un
  // ZAP regroupe plusieurs communes). Choisir un ZAP ne doit donc ni effacer
  // la commune déjà sélectionnée ni vider la liste des communes du CISCO ;
  // les deux filtres se combinent en ET dans la requête.
  const handleZapChange = (value: string) => {
    setSelectedZap(value);
  };

  return {
    drens,
    ciscos,
    zaps,
    communes,
    selectedDren,
    selectedCisco,
    selectedZap,
    selectedCommune,
    selectedSecteur,
    loadingFilters,
    handleDrenChange,
    handleCiscoChange,
    handleZapChange,
    setSelectedZap,
    setSelectedCommune,
    setSelectedSecteur,
  };
};
