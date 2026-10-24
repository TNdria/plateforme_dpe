/**
 * Import des fichiers de référence TDB :
 *  - Caisse école : classeur avec feuilles PRIMAIRE / COLLEGE / LYCEE (colonnes Code, Total, Annee optionnelle)
 *  - Population DREN : feuille pop_dren_par_age (annee, code_dren, dren, G_3_ANS, F_3_ANS, T_3_ANS … 17 ans)
 */
import { useRef, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2, Upload, FileSpreadsheet } from 'lucide-react';
import { sendReferenceImport } from '@/utils/referenceImport';

export type RefKind = 'caisse' | 'population';

const API = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/db-query?action=importReference`;
const norm = (v: unknown) => String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '');
const NIVEAUX = ['PRIMAIRE', 'COLLEGE', 'LYCEE'];

function firstValue(obj: Record<string, any>, keys: string[]) {
  for (const key of keys) {
    const direct = obj[key];
    if (direct !== null && direct !== undefined && direct !== '') return direct;
    const match = Object.entries(obj).find(([k]) => norm(k) === norm(key));
    if (match && match[1] !== null && match[1] !== undefined && match[1] !== '') return match[1];
  }
  return undefined;
}

function sheetObjects(XLSX: any, ws: any): Record<string, any>[] {
  const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false, defval: null });
  if (rows.length < 2) return [];
  const h = rows[0].map(norm);
  return rows.slice(1).map((r) => Object.fromEntries(h.map((k, i) => [k, r[i]])));
}

export function parseCaisse(XLSX: any, wb: any, defaultYear: number) {
  const out: { annee: number; niveau: string; code: any; total: any }[] = [];
  for (const name of wb.SheetNames) {
    const niveau = NIVEAUX.find((n) => norm(name).includes(norm(n)));
    if (!niveau) continue;
    for (const o of sheetObjects(XLSX, wb.Sheets[name])) {
      const code = firstValue(o, ['codeetab', 'code_etab', 'codeetablissement', 'code', 'codeetab', 'etab']);
      const total = firstValue(o, ['total', 'montant', 'montant_total', 'fce', 'total_a_doter']);
      if (code === null || code === undefined || code === '') continue;
      const annee = Number(firstValue(o, ['annee', 'anneescolaire', 'annee_scolaire', 'annee_scolaire']) ?? defaultYear) || defaultYear;
      if (total === null || total === undefined || total === '') continue;
      out.push({ annee, niveau, code, total });
    }
  }
  return out;
}

export function parsePopulation(XLSX: any, wb: any) {
  const name = wb.SheetNames.find((n: string) => norm(n).includes('parage')) ?? wb.SheetNames[0];
  return sheetObjects(XLSX, wb.Sheets[name]).filter((o) => firstValue(o, ['codedren', 'code_dren', 'code_dren', 'codedren_annee'])).map((o) => {
    const r: Record<string, any> = {
      annee: firstValue(o, ['annee', 'anneescolaire', 'annee_scolaire']),
      code_dren: firstValue(o, ['codedren', 'code_dren']),
      dren: firstValue(o, ['dren', 'nom_dren']),
    };
    for (let a = 3; a <= 17; a++) {
      for (const s of ['g', 'f', 't']) {
        r[`${s}_${a}`] = firstValue(o, [`${s}${a}ans`, `${s}_${a}_ans`, `${s}${a}`, `${s}_${a}`]) ?? null;
      }
    }
    return r;
  });
}

interface Props { kind: RefKind; open: boolean; onOpenChange: (v: boolean) => void; adminUsername: string }

export default function ReferenceImportDialog({ kind, open, onOpenChange, adminUsername }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [summary, setSummary] = useState<string[]>([]);
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [busy, setBusy] = useState(false);
  const isCaisse = kind === 'caisse';

  const reset = () => { setFile(null); setRows([]); setSummary([]); if (fileRef.current) fileRef.current.value = ''; };

  const parse = async (f: File, y = year) => {
    try {
      const XLSX = await import('xlsx');
      const wb = XLSX.read(await f.arrayBuffer(), { type: 'array' });
      const data = isCaisse ? parseCaisse(XLSX, wb, Number(y)) : parsePopulation(XLSX, wb);
      setRows(data);
      if (isCaisse) {
        setSummary(NIVEAUX.map((n) => {
          const sub = data.filter((r: any) => r.niveau === n);
          const yrs = [...new Set(sub.map((r: any) => r.annee))].join(', ');
          return `${n} : ${sub.length} établissements${yrs ? ` (année ${yrs})` : ''}`;
        }));
      } else {
        const yrs = [...new Set(data.map((r) => r.annee))].sort();
        setSummary([`${data.length} lignes DREN`, `Années : ${yrs.join(', ')}`]);
      }
      if (!data.length) toast.error('Aucune donnée reconnue dans ce fichier');
    } catch (e: any) { toast.error(`Lecture impossible : ${e.message}`); }
  };

  const submit = async () => {
    setBusy(true);
    try {
      const r = await sendReferenceImport(
        API,
        { adminUsername, kind, rows, fileName: file?.name || null },
        import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      );
      toast.success(`${r.inserted} lignes importées`); reset(); onOpenChange(false);
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !busy) { reset(); onOpenChange(false); } }}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-primary" />
            {isCaisse ? 'Importer la Caisse école' : 'Importer la population par DREN'}
          </DialogTitle>
          <DialogDescription>
            {isCaisse
              ? 'Classeur Excel avec les feuilles PRIMAIRE, COLLEGE et LYCEE (colonnes Code et Total, Annee facultative). Les montants de la même année et du même niveau sont remplacés.'
              : 'Classeur Excel (.xlsx ou .xlsb) avec la feuille pop_dren_par_age : annee, code_dren, dren, puis G/F/T de 3 à 17 ans. Les années présentes dans le fichier sont remplacées.'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.xlsb" disabled={busy}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) { setFile(f); parse(f); } }}
            className="block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-primary file:text-primary-foreground cursor-pointer" />
          {isCaisse && (
            <div className="space-y-1">
              <Label>Année (si la feuille n'a pas de colonne Annee)</Label>
              <Select disabled={busy} value={year} onValueChange={(v) => { setYear(v); if (file) parse(file, v); }}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 12 }, (_, k) => new Date().getFullYear() + 1 - k).map((y) => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {summary.length > 0 && (
            <div className="flex flex-wrap gap-2">{summary.map((s) => <Badge key={s} variant="secondary">{s}</Badge>)}</div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={() => { reset(); onOpenChange(false); }}>Annuler</Button>
          <Button disabled={!rows.length || busy} onClick={submit}>
            {busy ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Upload className="w-4 h-4 mr-1" />}
            Importer ({rows.length})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
