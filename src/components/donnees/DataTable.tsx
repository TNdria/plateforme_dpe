import { useState, useMemo, useEffect } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Download,
  Search,
  SearchX,
  Filter,
  MapPin,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  FileSpreadsheet,
  FileText,
  Grid3x3,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import * as XLSX from 'xlsx';
import { cn } from '@/lib/utils';

interface Column {
  key: string;
  label: string;
  align?: 'left' | 'center' | 'right';
  width?: number;
  render?: (value: any, row: any) => React.ReactNode;
}

const formatColumnLabel = (label: string) => {
  const normalized = label.trim().toUpperCase();

  const replacements: Array<[string, string]> = [
    ['EFF. ', 'Effectifs '],
    ['EFF ', 'Effectifs '],
    ['ENS. EN CLASSE', 'Enseignants en classe'],
    ['TOTAL PERS.', 'Total personnel'],
    ['TOTAL PERSONNEL', 'Total personnel'],
    ['FONCTIONNAIRES', 'Fonctionnaires'],
    ['CONTRACTUELS', 'Contractuels'],
    ['QUALIFIÉ(E)S', 'Qualifié(e)s'],
    ['FRAM SUB', 'FRAM subventionné'],
    ['FRAM NON SUB', 'FRAM non subventionné'],
    ['SDC BE', 'SDC bon état'],
    ['SDC ME', 'SDC moyen état'],
    ['TYPE_SOURCE_EAU', 'Source d’eau'],
    ['TYPE_SOURCE_ELECTRICITE', 'Source d’électricité'],
    ['CATEGORIE_COMMUNE', 'Zone'],
    ['NOM_ETAB', 'Établissement'],
    ['CODE_ETAB', 'Code établissement'],
    ['CODE', 'Code'],
    ['DREN', 'DREN'],
    ['CISCO', 'CISCO'],
    ['COMMUNE', 'Commune'],
    ['ZAP', 'ZAP'],
    ['FOKONTANY', 'Fokontany'],
    ['PLACES', 'Places'],
    ['EAU', 'Eau'],
    ['ÉLECTRICITÉ', 'Électricité'],
  ];

  let formatted = normalized;
  replacements.forEach(([from, to]) => {
    formatted = formatted.replace(from, to);
  });

  return formatted.replace(/\s+/g, ' ').trim();
};

const getColumnWidth = (col: Column) => {
  if (col.width) return col.width;
  const displayLabel = formatColumnLabel(col.label);
  return Math.min(240, Math.max(96, displayLabel.length * 8 + 24));
};

const cellClass = (col: Column, isHeader: boolean) => {
  const base = 'overflow-hidden text-ellipsis whitespace-nowrap';
  const align =
    col.align === 'right'
      ? 'text-right'
      : col.align === 'center'
        ? 'text-center'
        : 'text-left';
  return `${base} ${align}`;
};

interface DataTableProps {
  data: any[];
  columns: Column[];
  title: string;
  exportFilename?: string;
  pageSize?: number;
  headerClassName?: string;
  pageSizeOptions?: number[];
  hasAppliedFilter?: boolean;
  hasSelectedDren?: boolean;
}

const DataTable = ({
  data,
  columns,
  title,
  exportFilename = 'export.csv',
  pageSize = 10,
  headerClassName,
  pageSizeOptions = [10, 25, 50, 100],
  hasAppliedFilter = false,
  hasSelectedDren = false,
}: DataTableProps) => {
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(pageSize);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportFormat, setExportFormat] = useState<'csv' | 'xlsx'>('xlsx');
  // Affiche/masque les bordures de grille du tableau (lignes + colonnes),
  // utile pour bien distinguer les colonnes lorsqu'elles sont nombreuses.
  const [showGrid, setShowGrid] = useState(false);
  useEffect(() => {
    setCurrentPage(1);
  }, [data]);
  const filteredData = useMemo(() => {
    if (!search.trim()) return data;
    const searchLower = search.toLowerCase();
    return data.filter((row) =>
      columns.some((col) => {
        const value = row[col.key];
        return value?.toString().toLowerCase().includes(searchLower);
      })
    );
  }, [data, search, columns]);

  // Largeur totale = somme des largeurs fixes de chaque colonne. Posée en
  // style inline sur <Table> (plutôt que `min-w-full` seul) pour empêcher le
  // navigateur de redistribuer l'espace excédentaire entre colonnes en
  // `table-layout: fixed`, ce qui romprait l'alignement voulu.
  const totalTableWidth = useMemo(
    () => columns.reduce((sum, col) => sum + getColumnWidth(col), 0),
    [columns]
  );

  const totalPages = Math.ceil(filteredData.length / rowsPerPage);
  const paginatedData = filteredData.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  );

  const buildExportFileName = (format: 'csv' | 'xlsx') => {
    const base = exportFilename.replace(/\.(csv|xlsx)$/i, '');
    return `${base}.${format}`;
  };

  const handleExport = (format: 'csv' | 'xlsx') => {
    if (filteredData.length === 0) {
      toast.error('Aucune donnée à exporter');
      return;
    }

    const headers = columns.map((c) => formatColumnLabel(c.label));

    if (format === 'csv') {
      const rows = filteredData.map((row) =>
        columns.map((col) => {
          const value = row[col.key];
          return typeof value === 'string' && value.includes(',')
            ? `"${value}"`
            : (value ?? '');
        })
      );

      const csv = [headers.join(';'), ...rows.map((r) => r.join(';'))].join(
        '\n'
      );
      const blob = new Blob(['\ufeff' + csv], {
        type: 'text/csv;charset=utf-8;',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = buildExportFileName('csv');
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Export CSV téléchargé');
    } else {
      const rows = filteredData.map((row) =>
        Object.fromEntries(
          columns.map((col) => [
            formatColumnLabel(col.label),
            row[col.key] ?? '',
          ])
        )
      );
      const sheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, sheet, 'Données');
      XLSX.writeFile(workbook, buildExportFileName('xlsx'));
      toast.success('Export Excel téléchargé');
    }

    setShowExportModal(false);
  };

  return (
    <div className="flex flex-col h-full min-h-[420px]">
      {/* Header avec recherche et export */}
      <div className="flex items-center justify-between p-4 border-b bg-card">
        <div className="flex items-center gap-4">
          <h3 className="font-semibold">
            {title} ({filteredData.length})
          </h3>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              className="pl-9 w-64"
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={showGrid ? 'secondary' : 'outline'}
            size="sm"
            onClick={() => setShowGrid((v) => !v)}
            title="Afficher/masquer la grille du tableau"
          >
            <Grid3x3 className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Grille</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (filteredData.length === 0) {
                toast.error('Aucune donnée à exporter');
                return;
              }
              setShowExportModal(true);
            }}
            disabled={filteredData.length === 0}
          >
            <Download className="w-4 h-4 mr-2" />
            Exporter Excel
          </Button>
        </div>
      </div>

      {/* Tableau */}
      <div className="flex-1 overflow-auto relative">
        <Table
          className="table-fixed"
          style={{ width: totalTableWidth, minWidth: '100%' }}
        >
          <colgroup>
            {columns.map((col) => (
              <col key={col.key} style={{ width: getColumnWidth(col) }} />
            ))}
          </colgroup>
          <TableHeader
            className={cn(
              'sticky top-0 z-20 backdrop-blur supports-[backdrop-filter]:bg-muted/80',
              headerClassName || 'bg-muted/95'
            )}
          >
            <TableRow className={showGrid ? 'divide-x' : undefined}>
              {columns.map((col) => (
                <TableHead
                  key={col.key}
                  className={cellClass(col, true)}
                  title={formatColumnLabel(col.label)}
                >
                  {formatColumnLabel(col.label)}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedData.length > 0 ? (
              paginatedData.map((row, i) => (
                <TableRow key={i} className={showGrid ? 'divide-x' : undefined}>
                  {columns.map((col) => {
                    const value = row[col.key];
                    const display = col.render
                      ? col.render(value, row)
                      : (value ?? '-');

                    return (
                      <TableCell
                        key={col.key}
                        className={cellClass(col, false)}
                        title={
                          typeof display === 'string' ? display : undefined
                        }
                      >
                        {display}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="p-0">
                  <div className="flex flex-col items-center justify-center min-h-[420px] text-center px-6">
                    <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-muted mb-4">
                      {!hasSelectedDren ? (
                        <MapPin className="h-6 w-6 text-muted-foreground" />
                      ) : !hasAppliedFilter ? (
                        <Filter className="h-6 w-6 text-muted-foreground" />
                      ) : (
                        <SearchX className="h-6 w-6 text-muted-foreground" />
                      )}
                    </div>

                    {!hasSelectedDren ? (
                      <>
                        <p className="text-sm font-semibold text-foreground">
                          Aucune DREN sélectionnée
                        </p>

                        <p className="text-xs text-muted-foreground mt-1.5 max-w-sm">
                          Sélectionnez une DREN pour commencer la recherche des
                          établissements.
                        </p>
                      </>
                    ) : !hasAppliedFilter ? (
                      <>
                        <p className="text-sm font-semibold text-foreground">
                          Filtres prêts
                        </p>

                        <p className="text-xs text-muted-foreground mt-1.5 max-w-sm">
                          Les critères sont sélectionnés.
                          <br />
                          Cliquez sur « Filtrer » pour charger les données.
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-sm font-semibold text-foreground">
                          Aucun établissement trouvé
                        </p>

                        <p className="text-xs text-muted-foreground mt-1.5 max-w-sm">
                          Aucun établissement ne correspond aux filtres
                          appliqués.
                          <br />
                          Essayez de modifier vos critères.
                        </p>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={showExportModal} onOpenChange={setShowExportModal}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Download className="h-4 w-4 text-primary" />
              Exporter les données
            </DialogTitle>
            <DialogDescription>
              {filteredData.length} ligne{filteredData.length > 1 ? 's' : ''}{' '}
              prête{filteredData.length > 1 ? 's' : ''} à être exportée
              {filteredData.length > 1 ? 's' : ''}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <p className="text-sm font-medium mb-2">Format du fichier</p>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant={exportFormat === 'xlsx' ? 'default' : 'outline'}
                  onClick={() => setExportFormat('xlsx')}
                  className="justify-start"
                >
                  <FileSpreadsheet className="mr-2 h-4 w-4" />
                  Excel (.xlsx)
                </Button>
                <Button
                  variant={exportFormat === 'csv' ? 'default' : 'outline'}
                  onClick={() => setExportFormat('csv')}
                  className="justify-start"
                >
                  <FileText className="mr-2 h-4 w-4" />
                  CSV (.csv)
                </Button>
              </div>
            </div>

            <div className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">Contenu exporté</p>
              <p className="mt-1">
                Tableau {title} avec les colonnes visibles et les résultats
                filtrés par votre recherche.
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setShowExportModal(false)}>
              Annuler
            </Button>
            <Button onClick={() => handleExport(exportFormat)}>
              <Download className="mr-2 h-4 w-4" />
              Exporter
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Pagination — always visible */}
      <div className="flex items-center justify-between gap-3 p-3 border-t bg-gradient-to-r from-muted/40 via-card to-muted/40 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-sm text-muted-foreground">
            Page{' '}
            <span className="font-semibold text-foreground">{currentPage}</span>{' '}
            sur{' '}
            <span className="font-semibold text-foreground">
              {Math.max(1, totalPages)}
            </span>
            <span className="mx-2">·</span>
            <span className="font-semibold text-foreground">
              {filteredData.length}
            </span>{' '}
            résultats
          </span>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground hidden sm:inline">
              Lignes par page
            </span>
            <Select
              value={String(rowsPerPage)}
              onValueChange={(v) => {
                setRowsPerPage(Number(v));
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="h-8 w-[72px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent side="top">
                {pageSizeOptions.map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(1)}
            disabled={currentPage === 1 || totalPages <= 1}
            title="Première page"
          >
            <ChevronsLeft className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1 || totalPages <= 1}
            title="Page précédente"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm font-semibold px-3 py-1 rounded-md bg-primary/10 text-primary min-w-[3rem] text-center">
            {currentPage} / {Math.max(1, totalPages)}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage >= totalPages || totalPages <= 1}
            title="Page suivante"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(totalPages)}
            disabled={currentPage >= totalPages || totalPages <= 1}
            title="Dernière page"
          >
            <ChevronsRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default DataTable;
