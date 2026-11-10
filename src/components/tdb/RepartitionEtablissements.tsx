import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import type { ManualAllocationRow, TeacherAllocationRow } from '@/utils/tdbDrenReportModel';
import { formatDrenValue } from '@/utils/tdbDrenReportModel';

const PAGE_SIZE = 25;

function usePagedRows<T>(rows: T[], search: string, label: (row: T) => string) {
  const [page, setPage] = useState(0);
  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('fr');
    return query ? rows.filter((row) => label(row).toLocaleLowerCase('fr').includes(query)) : rows;
  }, [rows, search, label]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  return {
    rows: filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE),
    total: filtered.length,
    page: currentPage,
    pageCount,
    setPage,
  };
}

function Pagination({ page, pageCount, total, onPage }: { page: number; pageCount: number; total: number; onPage: (page: number) => void }) {
  return (
    <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
      <span>{total} ligne{total > 1 ? 's' : ''} · page {page + 1} / {pageCount}</span>
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" disabled={page === 0} onClick={() => onPage(page - 1)}>Précédent</Button>
        <Button type="button" variant="outline" size="sm" disabled={page >= pageCount - 1} onClick={() => onPage(page + 1)}>Suivant</Button>
      </div>
    </div>
  );
}

function Search({ value, onChange, id }: { value: string; onChange: (value: string) => void; id: string }) {
  return (
    <div className="mb-2 flex items-center gap-2">
      <label htmlFor={id} className="text-xs font-medium text-muted-foreground">Rechercher un établissement</label>
      <input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-8 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-sm text-foreground"
        placeholder="Nom ou code"
      />
    </div>
  );
}

function TeacherTable({ rows }: { rows: TeacherAllocationRow[] }) {
  const [search, setSearch] = useState('');
  const paged = usePagedRows(rows, search, (row) => `${row.nomEtab} ${row.codeEtab}`);
  return (
    <section aria-label="Répartition des enseignants par établissement">
      <h4 className="mb-2 font-semibold">Répartition des enseignants</h4>
      <Search id="recherche-repartition-enseignants" value={search} onChange={setSearch} />
      <div className="overflow-x-auto">
        <table className="tdb-table w-full">
          <thead><tr><th>Établissement</th><th>Effectif des élèves (X)</th><th>Nombre d’enseignants (Y)</th></tr></thead>
          <tbody>
            {paged.rows.map((row) => (
              <tr key={row.codeEtab}>
                <th scope="row" className="tdb-row-label">{row.nomEtab} ({row.codeEtab})</th>
                <td className="tdb-cell">{formatDrenValue(row.eleves, '', 0)}</td>
                <td className="tdb-cell">{formatDrenValue(row.enseignants, '', 0)}</td>
              </tr>
            ))}
            {paged.rows.length === 0 && <tr><td colSpan={3} className="tdb-cell">Aucun établissement trouvé.</td></tr>}
          </tbody>
        </table>
      </div>
      <Pagination page={paged.page} pageCount={paged.pageCount} total={paged.total} onPage={paged.setPage} />
    </section>
  );
}

function ManualTable({ rows }: { rows: ManualAllocationRow[] }) {
  const [search, setSearch] = useState('');
  const paged = usePagedRows(rows, search, (row) => `${row.nomEtab} ${row.codeEtab} ${row.matiere} ${row.groupe}`);
  return (
    <section aria-label="Répartition des manuels par établissement">
      <h4 className="mb-2 font-semibold">Répartition des manuels</h4>
      <Search id="recherche-repartition-manuels" value={search} onChange={setSearch} />
      <div className="overflow-x-auto">
        <table className="tdb-table w-full">
          <thead><tr><th>Établissement</th><th>Matière</th><th>Groupe de niveaux</th><th>Effectif des élèves (X)</th><th>Nombre de manuels (Y)</th></tr></thead>
          <tbody>
            {paged.rows.map((row) => (
              <tr key={`${row.codeEtab}-${row.matiere}-${row.groupe}`}>
                <th scope="row" className="tdb-row-label">{row.nomEtab} ({row.codeEtab})</th>
                <td className="tdb-cell">{row.matiere}</td>
                <td className="tdb-cell">{row.groupe}</td>
                <td className="tdb-cell">{formatDrenValue(row.eleves, '', 0)}</td>
                <td className="tdb-cell">{formatDrenValue(row.manuels, '', 0)}</td>
              </tr>
            ))}
            {paged.rows.length === 0 && <tr><td colSpan={5} className="tdb-cell">Aucun établissement trouvé.</td></tr>}
          </tbody>
        </table>
      </div>
      <Pagination page={paged.page} pageCount={paged.pageCount} total={paged.total} onPage={paged.setPage} />
    </section>
  );
}

export function RepartitionEtablissements({ teachers, manuals }: { teachers: TeacherAllocationRow[]; manuals: ManualAllocationRow[] }) {
  if (teachers.length === 0 && manuals.length === 0) return null;
  return (
    <details className="tdb-table-block mt-3 rounded-md border border-border p-3 print:hidden">
      <summary className="cursor-pointer font-semibold">Détail de la répartition par établissement (public)</summary>
      <p className="my-3 text-xs text-muted-foreground">
        Chaque ligne aligne les deux variables du même établissement. Le pourcentage affiché dans le tableau de bord est (1 − R²) × 100 ; il mesure une concordance statistique, pas un nombre d’enseignants ou de manuels excédentaires.
      </p>
      <div className="space-y-6">
        {teachers.length > 0 && <TeacherTable rows={teachers} />}
        {manuals.length > 0 && <ManualTable rows={manuals} />}
      </div>
    </details>
  );
}
