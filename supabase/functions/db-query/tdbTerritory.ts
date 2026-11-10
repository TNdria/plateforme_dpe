import { administrativeCode, type TdbDownloadTarget, type TdbTerritory, type TdbLevel } from './tdbDownloadAuth.ts';

interface TerritoryClient {
  queryObject: (query: string, args: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>;
}

// Fixed views and bound parameters only. DISTINCT removes repeated years and
// sectors while conflicting parent chains fail closed instead of picking a row.
export async function resolveTdbTerritory(client: TerritoryClient, target: TdbDownloadTarget): Promise<TdbTerritory | null> {
  if (administrativeCode(target.code) == null) return null;
  let query: string;
  switch (target.level) {
    case 'DREN': query = 'SELECT DISTINCT "CODE_DREN" FROM v_dren WHERE "CODE_DREN" = $1'; break;
    case 'CISCO': query = 'SELECT DISTINCT "CODE_DREN", "CODE_CISCO" FROM v_cisco WHERE "CODE_CISCO" = $1'; break;
    case 'ZAP': query = 'SELECT DISTINCT "CODE_DREN", "CODE_CISCO", "CODE_ZAP" FROM v_zap WHERE "CODE_ZAP" = $1'; break;
    case 'ÉCOLE': query = `SELECT DISTINCT "CODE_DREN", "CODE_CISCO", "CODE_ZAP", "CODE_ETAB" FROM (
      SELECT "CODE_DREN", "CODE_CISCO", "CODE_ZAP", "CODE_ETAB" FROM v_fiche_ecole_n0 WHERE "CODE_ETAB" = $1
      UNION SELECT "CODE_DREN", "CODE_CISCO", "CODE_ZAP", "CODE_ETAB" FROM v_fiche_ecole_n1 WHERE "CODE_ETAB" = $1
      UNION SELECT "CODE_DREN", "CODE_CISCO", "CODE_ZAP", "CODE_ETAB" FROM v_fiche_ecole_n2 WHERE "CODE_ETAB" = $1
      UNION SELECT "CODE_DREN", "CODE_CISCO", "CODE_ZAP", "CODE_ETAB" FROM v_fiche_ecole_n3 WHERE "CODE_ETAB" = $1
    ) schools`; break;
    default: return null;
  }
  const { rows } = await client.queryObject(query, [target.code]);
  if (rows.length !== 1) return null;
  const territory: TdbTerritory = {};
  for (const [level, field] of [['DREN', 'CODE_DREN'], ['CISCO', 'CODE_CISCO'], ['ZAP', 'CODE_ZAP'], ['ÉCOLE', 'CODE_ETAB']] as const) {
    if (!(field in rows[0])) continue;
    const code = administrativeCode(rows[0][field]);
    if (code == null) return null;
    territory[level] = code;
  }
  if (territory[target.level as TdbLevel] !== target.code) return null;
  const parentLevel: TdbLevel | undefined = target.level === 'CISCO' ? 'DREN' : target.level === 'ZAP' ? 'CISCO' : target.level === 'ÉCOLE' ? 'ZAP' : undefined;
  if (parentLevel) {
    const parentCode = territory[parentLevel];
    if (parentCode == null) return null;
    const parent = await resolveTdbTerritory(client, { level: parentLevel, code: parentCode });
    if (!parent || Object.entries(parent).some(([level, code]) => territory[level as TdbLevel] !== code)) return null;
  }
  return territory;
}