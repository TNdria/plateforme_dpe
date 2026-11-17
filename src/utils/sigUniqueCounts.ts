export interface SigEstablishmentRow {
  CODE_ETAB?: unknown;
  SECTEUR?: unknown;
}

export interface SigEstablishmentLevelRows {
  n0: readonly SigEstablishmentRow[];
  n1: readonly SigEstablishmentRow[];
  n2: readonly SigEstablishmentRow[];
  n3: readonly SigEstablishmentRow[];
}

export interface SigUniqueEstablishmentStats {
  etablissements: number;
  total: number;
  public: {
    total: number;
    prescolaire: number;
    primaire: number;
    college: number;
    lycee: number;
  };
  private: {
    total: number;
    prescolaire: number;
    primaire: number;
    college: number;
    lycee: number;
  };
  villages: number;
}

const codeKey = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  const key = String(value).trim();
  return key.length ? key : null;
};

/** Count distinct establishment codes without changing or selecting source rows. */
export function countUniqueEstablishments<T extends SigEstablishmentRow>(
  rows: readonly T[],
  predicate: (row: T) => boolean = () => true,
): number {
  const codes = new Set<string>();
  for (const row of rows) {
    if (!predicate(row)) continue;
    const key = codeKey(row.CODE_ETAB);
    if (key !== null) codes.add(key);
  }
  return codes.size;
}

/**
 * SIG recap counts establishments by code, independently within each
 * level/sector. The overall establishment total is distinct across levels.
 * Raw rows remain available to map markers, fiches and detailed exports.
 */
export function buildSigUniqueEstablishmentStats(
  levels: SigEstablishmentLevelRows,
  villageCount: number,
): SigUniqueEstablishmentStats {
  const allRows = [...levels.n0, ...levels.n1, ...levels.n2, ...levels.n3];
  const isPublic = (row: SigEstablishmentRow) => row.SECTEUR === 0;
  const isPrivate = (row: SigEstablishmentRow) => row.SECTEUR !== 0;

  const countLevel = (rows: readonly SigEstablishmentRow[], predicate: (row: SigEstablishmentRow) => boolean) =>
    countUniqueEstablishments(rows, predicate);

  const etablissements = countUniqueEstablishments(allRows);
  return {
    etablissements,
    total: etablissements + villageCount,
    public: {
      total: countLevel(allRows, isPublic),
      prescolaire: countLevel(levels.n0, isPublic),
      primaire: countLevel(levels.n1, isPublic),
      college: countLevel(levels.n2, isPublic),
      lycee: countLevel(levels.n3, isPublic),
    },
    private: {
      total: countLevel(allRows, isPrivate),
      prescolaire: countLevel(levels.n0, isPrivate),
      primaire: countLevel(levels.n1, isPrivate),
      college: countLevel(levels.n2, isPrivate),
      lycee: countLevel(levels.n3, isPrivate),
    },
    villages: villageCount,
  };
}
