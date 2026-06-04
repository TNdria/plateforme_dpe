import { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Filtre automatique DREN/CISCO selon l'utilisateur connecté.
 *
 * Règles métier (alignées sur le code Django original `USER_DREN`/`USER_CISCO`) :
 *  - Un utilisateur lambda avec une DREN affectée ne peut voir QUE sa DREN.
 *  - Idem pour la CISCO si elle est affectée.
 *  - Les is_staff / is_superuser ne sont PAS verrouillés (vue nationale).
 *  - Si user.dren = 0 / null → libre.
 *
 * Utilisé par : ORS Primaire / Collège / Lycée, SIG, Besoins.
 */
export interface UserScope {
  userDren: number;
  userCisco: number;
  isAdmin: boolean;
  drenLocked: boolean;
  ciscoLocked: boolean;
  /** Valeur initiale à utiliser pour selectedDren (0 = libre) */
  initialDren: number;
  /** Valeur initiale à utiliser pour selectedCisco */
  initialCisco: number;
  /** True si on doit auto-déclencher l'application des filtres au montage */
  autoApply: boolean;
}

export const useUserScope = (): UserScope => {
  const { user } = useAuth();

  return useMemo(() => {
    const d = Number(user?.dren);
    const c = Number(user?.cisco);
    const userDren = Number.isFinite(d) && d > 0 ? d : 0;
    const userCisco = Number.isFinite(c) && c > 0 ? c : 0;
    const isAdmin = !!user?.is_superuser || !!user?.is_staff;
    const drenLocked = !isAdmin && userDren > 0;
    const ciscoLocked = !isAdmin && userCisco > 0;

    // Pré-sélection : pour TOUT utilisateur ayant une DREN affectée (même staff),
    // on pré-remplit. Le verrou n'est posé que pour les non-admin.
    const initialDren = userDren > 0 ? userDren : 0;
    const initialCisco = userCisco > 0 ? userCisco : 0;
    // Auto-apply quand le scope est verrouillé (cas typique terrain CISCO)
    const autoApply = drenLocked && initialDren > 0;

    return { userDren, userCisco, isAdmin, drenLocked, ciscoLocked, initialDren, initialCisco, autoApply };
  }, [user]);
};

export default useUserScope;