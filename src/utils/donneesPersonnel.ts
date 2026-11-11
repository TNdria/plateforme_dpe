type PersonnelRow = Record<string, unknown>;

const count = (value: unknown) => {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const combine = (base: unknown, extra: unknown) => {
  const first = count(base);
  const second = count(extra);
  return first === null && second === null ? null : (first ?? 0) + (second ?? 0);
};

export function groupPersonnel(row: PersonnelRow) {
  return {
    // When no separate contractuel field is supplied, retain the API aggregate.
    personnel_etat: combine(row.fonctionnaire, row.contractuel),
    personnel_subventionne: count(row.fram_sub),
    personnel_non_subventionne: combine(row.fram_nonsub, row.autres),
  };
}

export function sumPersonnelGroups(rows: PersonnelRow[]) {
  const sum = (subset: PersonnelRow[], key: keyof ReturnType<typeof groupPersonnel>) => {
    const values = subset.map(row => groupPersonnel(row)[key]);
    if (!subset.length) return 0;
    if (values.some(value => value === null)) return null;
    return values.reduce<number>((total, value) => total + (value ?? 0), 0);
  };
  return (['personnel_etat', 'personnel_subventionne', 'personnel_non_subventionne'] as const).map(key => ({
    key,
    public: sum(rows.filter(row => String(row.SECTEUR) === '0'), key),
    prive: sum(rows.filter(row => String(row.SECTEUR) === '1'), key),
    total: sum(rows, key),
  }));
}