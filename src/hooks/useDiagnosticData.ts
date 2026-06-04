import { useState, useEffect, useMemo } from 'react';
import { dashboardApi, StatsData } from '@/services/api';
import { SEUILS_INDICATEURS } from '@/types/diagnostic';

interface DiagnosticStats {
  etablissements: StatsData | null;
  elevesN0N1: StatsData | null;
  elevesN2N3: StatsData | null;
  enseignants: StatsData | null;
  places: StatsData | null;
}

interface IndicateursCalcules {
  // Indicateurs de couverture
  partPrive: {
    prescolaire: number | null;
    primaire: number | null;
    college: number | null;
    lycee: number | null;
  };
  // Indicateurs de qualité
  rem: {
    prescolaire: number | null;
    primaire: number | null;
    college: number | null;
    lycee: number | null;
  };
  ratioElevePlaceAssise: {
    prescolaire: number | null;
    primaire: number | null;
    college: number | null;
    lycee: number | null;
  };
  // Données brutes formatées
  donnees: {
    etablissements: { prescolaire: number; primaire: number; college: number; lycee: number; total: number };
    eleves: { prescolaire: number; primaire: number; college: number; lycee: number; total: number };
    enseignants: { prescolaire: number; primaire: number; college: number; lycee: number; total: number };
    places: { prescolaire: number; primaire: number; college: number; lycee: number; total: number };
  };
}

export const useDiagnosticData = (
  codeDren: number,
  codeCisco: number,
  secteur: number,
  annee: string
) => {
  const [stats, setStats] = useState<DiagnosticStats>({
    etablissements: null,
    elevesN0N1: null,
    elevesN2N3: null,
    enseignants: null,
    places: null,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);
      setError(null);
      try {
        const [etablissements, elevesN0N1, elevesN2N3, enseignants, places] = await Promise.all([
          dashboardApi.getStatsEtablissements(codeDren, codeCisco, secteur),
          dashboardApi.getStatsElevesN0N1(codeDren, codeCisco, secteur).catch(() => [] as any[]),
          dashboardApi.getStatsElevesN2N3(codeDren, codeCisco, secteur).catch(() => [] as any[]),
          dashboardApi.getStatsEnseignants(codeDren, codeCisco, secteur).catch(() => [] as any[]),
          dashboardApi.getStatsPlacesAssises(codeDren, codeCisco, secteur).catch(() => [] as any[]),
        ]);

        setStats({
          etablissements: etablissements[0] || null,
          elevesN0N1: elevesN0N1[0] || null,
          elevesN2N3: elevesN2N3[0] || null,
          enseignants: enseignants[0] || null,
          places: places[0] || null,
        });
      } catch (err) {
        console.error('Error fetching diagnostic stats:', err);
        setError('Erreur lors du chargement des données');
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [codeDren, codeCisco, secteur]);

  // Calcul des indicateurs
  const indicateurs = useMemo<IndicateursCalcules>(() => {
    const getVal = (data: StatsData | null, niveau: string, an: string): number => {
      if (!data) return 0;
      const key = `${niveau}_${an}` as keyof StatsData;
      return Number(data[key]) || 0;
    };

    const etab = stats.etablissements;
    const elevesN0N1 = stats.elevesN0N1;
    const elevesN2N3 = stats.elevesN2N3;
    const ens = stats.enseignants;
    const places = stats.places;

    // Données par niveau
    const donnees = {
      etablissements: {
        prescolaire: getVal(etab, 'N0', annee),
        primaire: getVal(etab, 'N1', annee),
        college: getVal(etab, 'N2', annee),
        lycee: getVal(etab, 'N3', annee),
        total: getVal(etab, 'N0', annee) + getVal(etab, 'N1', annee) + getVal(etab, 'N2', annee) + getVal(etab, 'N3', annee),
      },
      eleves: {
        prescolaire: getVal(elevesN0N1, 'N0', annee),
        primaire: getVal(elevesN0N1, 'N1', annee),
        college: getVal(elevesN2N3, 'N2', annee),
        lycee: getVal(elevesN2N3, 'N3', annee),
        total: getVal(elevesN0N1, 'N0', annee) + getVal(elevesN0N1, 'N1', annee) + getVal(elevesN2N3, 'N2', annee) + getVal(elevesN2N3, 'N3', annee),
      },
      enseignants: {
        prescolaire: getVal(ens, 'N0', annee),
        primaire: getVal(ens, 'N1', annee),
        college: getVal(ens, 'N2', annee),
        lycee: getVal(ens, 'N3', annee),
        total: getVal(ens, 'N0', annee) + getVal(ens, 'N1', annee) + getVal(ens, 'N2', annee) + getVal(ens, 'N3', annee),
      },
      places: {
        prescolaire: getVal(places, 'N0', annee),
        primaire: getVal(places, 'N1', annee),
        college: getVal(places, 'N2', annee),
        lycee: getVal(places, 'N3', annee),
        total: getVal(places, 'N0', annee) + getVal(places, 'N1', annee) + getVal(places, 'N2', annee) + getVal(places, 'N3', annee),
      },
    };

    // Calcul du REM (Ratio Élève/Maître)
    const calcRem = (eleves: number, enseignants: number): number | null => {
      if (enseignants === 0) return null;
      return eleves / enseignants;
    };

    // Calcul du ratio élève/place assise
    const calcRatioPlaces = (eleves: number, places: number): number | null => {
      if (places === 0) return null;
      return eleves / places;
    };

    return {
      partPrive: {
        prescolaire: null, // Nécessite données public/privé séparées
        primaire: null,
        college: null,
        lycee: null,
      },
      rem: {
        prescolaire: calcRem(donnees.eleves.prescolaire, donnees.enseignants.prescolaire),
        primaire: calcRem(donnees.eleves.primaire, donnees.enseignants.primaire),
        college: calcRem(donnees.eleves.college, donnees.enseignants.college),
        lycee: calcRem(donnees.eleves.lycee, donnees.enseignants.lycee),
      },
      ratioElevePlaceAssise: {
        prescolaire: calcRatioPlaces(donnees.eleves.prescolaire, donnees.places.prescolaire),
        primaire: calcRatioPlaces(donnees.eleves.primaire, donnees.places.primaire),
        college: calcRatioPlaces(donnees.eleves.college, donnees.places.college),
        lycee: calcRatioPlaces(donnees.eleves.lycee, donnees.places.lycee),
      },
      donnees,
    };
  }, [stats, annee]);

  // Interprétation des indicateurs REM
  const interpreterRem = (rem: number | null): 'bon' | 'moyen' | 'mauvais' => {
    if (rem === null) return 'moyen';
    if (rem <= SEUILS_INDICATEURS.rem.bon) return 'bon';
    if (rem >= SEUILS_INDICATEURS.rem.mauvais) return 'mauvais';
    return 'moyen';
  };

  return {
    stats,
    indicateurs,
    loading,
    error,
    interpreterRem,
  };
};
