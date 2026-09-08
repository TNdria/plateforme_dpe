import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { dashboardApi, donneesApi, Dren, Cisco, Zap } from '@/services/api';

interface Commune {
  CODE_COMMUNE: number;
  COMMUNE: string;
}

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

export const useDonneesFilters = () => {
  const [drens, setDrens] = useState<Dren[]>([]);
  const [ciscos, setCiscos] = useState<Cisco[]>([]);
  const [zaps, setZaps] = useState<Zap[]>([]);
  const [communes, setCommunes] = useState<Commune[]>([]);
  const [selectedDren, setSelectedDren] = useState<string>('0');
  const [selectedCisco, setSelectedCisco] = useState<string>('0');
  const [selectedZap, setSelectedZap] = useState<string>('0');
  const [selectedCommune, setSelectedCommune] = useState<string>('0');
  const [selectedSecteur, setSelectedSecteur] = useState<string>('2');
  const [loadingFilters, setLoadingFilters] = useState(false);

  useEffect(() => {
    const fetchDrens = async () => {
      try {
        const data = await dashboardApi.getDrens();
        setDrens(dedupeByKey(data, (d) => String(d.CODE_DREN)));
      } catch (err) {
        console.error('Erreur:', err);
        toast.error('Erreur lors du chargement des DRENs');
      }
    };
    fetchDrens();
  }, []);

  const handleDrenChange = async (value: string) => {
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
    setSelectedCisco(value);
    setSelectedZap('0');
    setSelectedCommune('0');
    setZaps([]);
    setCommunes([]);

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

  // Recharge la liste des communes en la restreignant au ZAP sélectionné.
  // Sans cela, le dropdown Commune continue d'afficher TOUTES les communes
  // du CISCO même après le choix d'un ZAP précis.
  const handleZapChange = async (value: string) => {
    setSelectedZap(value);
    setSelectedCommune('0');
    setCommunes([]);

    if (value === '0') {
      // Retour à "toutes les communes du CISCO"
      if (selectedCisco !== '0') {
        try {
          setLoadingFilters(true);
          const communesData = await donneesApi.getCommunes(
            Number(selectedDren),
            Number(selectedCisco),
            0
          );
          setCommunes(dedupeByKey(communesData, (c) => String(c.CODE_COMMUNE)));
        } catch (err) {
          toast.error('Erreur lors du chargement des communes');
        } finally {
          setLoadingFilters(false);
        }
      }
      return;
    }

    try {
      setLoadingFilters(true);
      const communesData = await donneesApi.getCommunes(
        Number(selectedDren),
        Number(selectedCisco),
        Number(value)
      );
      setCommunes(dedupeByKey(communesData, (c) => String(c.CODE_COMMUNE)));
    } catch (err) {
      toast.error('Erreur lors du chargement des communes du ZAP');
      setCommunes([]);
    } finally {
      setLoadingFilters(false);
    }
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