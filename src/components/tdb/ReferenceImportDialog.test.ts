import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { parseCaisse, parsePopulation } from './ReferenceImportDialog';

const book = (sheets: Record<string, any[][]>) => {
  const wb = XLSX.utils.book_new();
  for (const [n, d] of Object.entries(sheets)) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(d), n);
  return wb;
};

describe('import référence TDB', () => {
  it('caisse : niveau tiré du nom de feuille, année du fichier sinon année choisie', () => {
    const r = parseCaisse(XLSX, book({ PRIMAIRE: [['Code', 'Total'], [503140006, 2565500]], LYCEE: [['Code', 'Total', 'Annee'], [101010004, 40853000, 2026]] }), 2025);
    expect(r).toEqual([
      { annee: 2025, niveau: 'PRIMAIRE', code: 503140006, total: 2565500 },
      { annee: 2026, niveau: 'LYCEE', code: 101010004, total: 40853000 },
    ]);
  });
  it('population : colonnes G/F/T par âge', () => {
    const r = parsePopulation(XLSX, book({ pop_dren_par_age: [['annee', 'code_dren', 'dren', 'G_3_ANS', 'F_3_ANS', 'T_3_ANS'], [2018, 51, 'ALAOTRA', 18895, 18681, 37576]] }));
    expect(r[0]).toMatchObject({ annee: 2018, code_dren: 51, g_3: 18895, f_3: 18681, t_3: 37576 });
  });
});
