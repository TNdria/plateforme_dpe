/**
 * Génère et télécharge un fichier CSV à partir d'un tableau d'objets.
 * Fonctionne 100% côté client — aucune dépendance backend.
 */
export function downloadAsCsv<T extends Record<string, any>>(
  rows: T[],
  filename: string,
  columns?: Array<{ key: keyof T | string; label?: string }>
) {
  if (!rows.length) {
    return false;
  }

  // Auto-détection des colonnes si non fournies
  const cols =
    columns ??
    Object.keys(rows[0]).map((k) => ({ key: k, label: k }));

  const escape = (v: any): string => {
    if (v === null || v === undefined) return '';
    const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
    if (/[",\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };

  const header = cols.map((c) => escape(c.label ?? c.key)).join(';');
  const body = rows
    .map((row) => cols.map((c) => escape(row[c.key as keyof T])).join(';'))
    .join('\n');

  // BOM UTF-8 pour Excel
  const csv = '\uFEFF' + header + '\n' + body;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}

/** Colonnes standard pour l'export ORS (tous niveaux). */
export const ORS_CSV_COLUMNS = [
  { key: 'CODE_ETAB', label: 'CODE_ETAB' },
  { key: 'NOM_ETAB', label: 'NOM_ETAB' },
  { key: 'SECTEUR', label: 'SECTEUR' },
  { key: 'COMMUNE', label: 'COMMUNE' },
  { key: 'FOKONTANY', label: 'FOKONTANY' },
  { key: 'latitude', label: 'LATITUDE' },
  { key: 'longitude', label: 'LONGITUDE' },
  { key: 'effectifs', label: 'EFFECTIFS' },
  { key: 'eff_t5', label: 'EFFECTIF_T5' },
  { key: 'eff_2024', label: 'EFFECTIF_2024' },
  { key: 'sdc_be', label: 'SALLES_BON_ETAT' },
  { key: 'sdc_me', label: 'SALLES_MAUVAIS_ETAT' },
  { key: 'sdc_requis', label: 'SALLES_REQUISES' },
  { key: 'places', label: 'PLACES_ASSISES' },
  { key: 'eligible_reconstruction', label: 'ELIGIBLE_RECONSTRUCTION' },
  { key: 'eligible_rehabilitation', label: 'ELIGIBLE_REHABILITATION' },
];
