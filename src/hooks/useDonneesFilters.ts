import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { dashboardApi, donneesApi, Dren, Cisco, Zap } from '@/services/api';

interface Commune {
  CODE_COMMUNE: number;
  COMMUNE: string;
}

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
        setDrens(data);
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
        setCiscos(data);
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
        const [zapsData, communesData] = await Promise.all([
          donneesApi.getZaps(Number(selectedDren), Number(value), 0),
          donneesApi.getCommunes(Number(selectedDren), Number(value), 0)
        ]);
        setZaps(zapsData);
        setCommunes(communesData);
      } catch (err) {
        toast.error('Erreur lors du chargement des filtres');
      } finally {
        setLoadingFilters(false);
      }
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
    setSelectedZap,
    setSelectedCommune,
    setSelectedSecteur,
  };
};
