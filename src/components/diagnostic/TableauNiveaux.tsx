import { cn } from '@/lib/utils';

interface NiveauRow {
  niveau: string;
  etablissements: number;
  eleves: number;
  enseignants: number;
  places: number;
  rem: number | null;
  ratioPlaces: number | null;
}

interface TableauNiveauxProps {
  rows: NiveauRow[];
  totals: NiveauRow;
}

const fmt = (num: number | null | undefined) => {
  if (num === null || num === undefined) return 'N/A';
  return new Intl.NumberFormat('fr-FR').format(num);
};

const fmtRatio = (num: number | null) => {
  if (num === null) return 'N/A';
  return num.toFixed(1);
};

const getRemColor = (rem: number | null) => {
  if (rem === null) return '';
  if (rem <= 40) return 'text-green-600 font-semibold';
  if (rem >= 52) return 'text-destructive font-semibold';
  return 'text-warning font-semibold';
};

const TableauNiveaux = ({ rows, totals }: TableauNiveauxProps) => {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left py-2.5 px-3 font-semibold text-muted-foreground">Niveau</th>
            <th className="text-right py-2.5 px-3 font-semibold text-muted-foreground">Établissements</th>
            <th className="text-right py-2.5 px-3 font-semibold text-muted-foreground">Élèves</th>
            <th className="text-right py-2.5 px-3 font-semibold text-muted-foreground">Enseignants</th>
            <th className="text-right py-2.5 px-3 font-semibold text-muted-foreground">Places</th>
            <th className="text-right py-2.5 px-3 font-semibold text-muted-foreground">REM</th>
            <th className="text-right py-2.5 px-3 font-semibold text-muted-foreground">Ratio Places</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.niveau} className={cn('border-b border-border/50 hover:bg-muted/30 transition-colors')}>
              <td className="py-2.5 px-3 font-medium">{row.niveau}</td>
              <td className="text-right py-2.5 px-3">{fmt(row.etablissements)}</td>
              <td className="text-right py-2.5 px-3">{fmt(row.eleves)}</td>
              <td className="text-right py-2.5 px-3">{fmt(row.enseignants)}</td>
              <td className="text-right py-2.5 px-3">{fmt(row.places)}</td>
              <td className={cn('text-right py-2.5 px-3', getRemColor(row.rem))}>{fmtRatio(row.rem)}</td>
              <td className={cn('text-right py-2.5 px-3', (row.ratioPlaces ?? 0) > 1 ? 'text-destructive font-semibold' : 'text-green-600 font-semibold')}>
                {fmtRatio(row.ratioPlaces)}
              </td>
            </tr>
          ))}
          <tr className="bg-muted/50 font-semibold">
            <td className="py-2.5 px-3">TOTAL</td>
            <td className="text-right py-2.5 px-3">{fmt(totals.etablissements)}</td>
            <td className="text-right py-2.5 px-3">{fmt(totals.eleves)}</td>
            <td className="text-right py-2.5 px-3">{fmt(totals.enseignants)}</td>
            <td className="text-right py-2.5 px-3">{fmt(totals.places)}</td>
            <td className={cn('text-right py-2.5 px-3', getRemColor(totals.rem))}>{fmtRatio(totals.rem)}</td>
            <td className={cn('text-right py-2.5 px-3', (totals.ratioPlaces ?? 0) > 1 ? 'text-destructive font-semibold' : 'text-green-600 font-semibold')}>
              {fmtRatio(totals.ratioPlaces)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};

export default TableauNiveaux;
