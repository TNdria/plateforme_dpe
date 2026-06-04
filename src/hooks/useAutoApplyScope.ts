import { useEffect, useRef } from 'react';
import type { UserScope } from './useUserScope';

/**
 * Applique automatiquement le scope DREN/CISCO de l'utilisateur connecté
 * sur une page ORS / SIG. Encapsule l'orchestration verrou → DREN → CISCO → fetch.
 *
 * Utilise des refs pour ne déclencher l'auto-apply qu'UNE seule fois par session.
 */
interface Args {
  scope: UserScope;
  selectedDren: number;
  selectedCisco: number;
  isFiltered: boolean;
  handleDrenChange: (code: number) => void;
  handleCiscoChange: (code: number) => void;
  fetchEtablissements: (codeDren: number, codeCisco: number) => Promise<void> | void;
  setMapZoom?: (z: number) => void;
}

export const useAutoApplyScope = ({
  scope,
  selectedDren,
  selectedCisco,
  isFiltered,
  handleDrenChange,
  handleCiscoChange,
  fetchEtablissements,
  setMapZoom,
}: Args) => {
  const fetchedRef = useRef(false);

  // Sélection de la DREN dès qu'elle est connue
  useEffect(() => {
    if (!scope.autoApply) return;
    if (selectedDren !== scope.initialDren) {
      handleDrenChange(scope.initialDren);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope.autoApply, scope.initialDren]);

  // Une fois la DREN active, propager la CISCO et déclencher le fetch (1 fois)
  useEffect(() => {
    if (!scope.autoApply || fetchedRef.current) return;
    if (selectedDren !== scope.initialDren) return;
    if (scope.initialCisco > 0 && selectedCisco !== scope.initialCisco) {
      handleCiscoChange(scope.initialCisco);
      return;
    }
    if (!isFiltered) {
      fetchedRef.current = true;
      Promise.resolve(fetchEtablissements(scope.initialDren, scope.initialCisco));
      setMapZoom?.(scope.initialCisco > 0 ? 10 : 8);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope.autoApply, scope.initialDren, scope.initialCisco, selectedDren, selectedCisco, isFiltered]);
};

export default useAutoApplyScope;