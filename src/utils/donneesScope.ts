// Périmètre par défaut du module Données, selon le profil connecté.
//
// Règles métier :
//  - Visiteur non connecté ou profil national (is_staff / is_superuser, ou
//    aucun rattachement) : statistiques nationales, filtres libres.
//  - Profil DREN : la DREN est verrouillée sur celle de l'utilisateur ; CISCO,
//    ZAP et commune restent sélectionnables à l'intérieur de ce périmètre.
//  - Profil CISCO : DREN et CISCO sont verrouillés ; ZAP et commune restent
//    sélectionnables à l'intérieur de la CISCO.
//
// Le modèle de compte ne porte aujourd'hui que `dren` et `cisco` : les profils
// ZAP / Établissement ne peuvent pas être déterminés côté client et ne sont
// donc pas inventés ici.

export type DonneesScopeLevel = "national" | "dren" | "cisco";

export interface DonneesScopeUser {
  dren?: unknown;
  cisco?: unknown;
  is_staff?: boolean;
  is_superuser?: boolean;
}

export interface DonneesScope {
  level: DonneesScopeLevel;
  /** DREN de rattachement (0 = aucune). */
  dren: number;
  /** CISCO de rattachement (0 = aucune). */
  cisco: number;
  drenLocked: boolean;
  ciscoLocked: boolean;
  /** Valeur initiale du filtre DREN ("0" = toutes les DREN). */
  defaultDren: string;
  /** Valeur initiale du filtre CISCO ("0" = toutes les CISCO). */
  defaultCisco: string;
  /** Clé stable du périmètre, pour déclencher un rechargement au changement. */
  key: string;
}

const positive = (value: unknown): number => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : 0;
};

export const resolveDonneesScope = (
  user: DonneesScopeUser | null | undefined,
): DonneesScope => {
  const isAdmin = !!user?.is_staff || !!user?.is_superuser;
  const dren = positive(user?.dren);
  const cisco = positive(user?.cisco);

  // Un administrateur garde la vue nationale et des filtres libres.
  const drenLocked = !isAdmin && dren > 0;
  const ciscoLocked = !isAdmin && cisco > 0;

  const level: DonneesScopeLevel = ciscoLocked ? "cisco" : drenLocked ? "dren" : "national";
  const defaultDren = drenLocked ? String(dren) : "0";
  const defaultCisco = ciscoLocked ? String(cisco) : "0";

  return {
    level,
    dren,
    cisco,
    drenLocked,
    ciscoLocked,
    defaultDren,
    defaultCisco,
    key: `${defaultDren}:${defaultCisco}`,
  };
};
