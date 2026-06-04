import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Sparkles, Download, FileDown } from 'lucide-react';
import { Dren, Cisco, dashboardApi } from '@/services/api';

interface DiagnosticFiltersProps {
  drens: Dren[];
  ciscos: Cisco[];
  selectedDren: string;
  selectedCisco: string;
  selectedSecteur: string;
  selectedAnnee: string;
  generating: boolean;
  loading: boolean;
  statsLoading: boolean;
  hasDiagnostic: boolean;
  onDrenChange: (value: string) => void;
  onCiscoChange: (value: string) => void;
  onSecteurChange: (value: string) => void;
  onAnneeChange: (value: string) => void;
  onGenerate: () => void;
  onExportPDF: () => void;
  onExportDocx: () => void;
}

const DiagnosticFilters = ({
  drens, ciscos, selectedDren, selectedCisco, selectedSecteur, selectedAnnee,
  generating, loading, statsLoading, hasDiagnostic,
  onDrenChange, onCiscoChange, onSecteurChange, onAnneeChange,
  onGenerate, onExportPDF, onExportDocx,
}: DiagnosticFiltersProps) => {
  const [availableYears, setAvailableYears] = useState<number[]>([]);

  useEffect(() => {
    dashboardApi.getAvailableYears().then((data) => {
      const years = data.map((d: any) => Number(d.annee)).filter((y: number) => !isNaN(y));
      setAvailableYears(years);
      if (years.length > 0 && !selectedAnnee) onAnneeChange(String(years[0]));
    }).catch(() => {});
  }, []);

  return (
    <div className="flex flex-wrap gap-3 items-end">
      <div className="space-y-1">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">DREN</label>
        <Select value={selectedDren} onValueChange={onDrenChange}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Sélectionner DREN" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="0">Tous (National)</SelectItem>
            {drens.map((d) => (
              <SelectItem key={d.CODE_DREN} value={d.CODE_DREN.toString()}>{d.DREN}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">CISCO</label>
        <Select value={selectedCisco} onValueChange={onCiscoChange} disabled={selectedDren === '0'}>
          <SelectTrigger className="w-56"><SelectValue placeholder="Sélectionner CISCO" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="0">Tous les CISCOs</SelectItem>
            {ciscos.map((c) => (
              <SelectItem key={c.CODE_CISCO} value={c.CODE_CISCO.toString()}>{c.CISCO}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Secteur filter removed - always "Tous secteurs" */}

      <div className="space-y-1">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Année</label>
        <Select value={selectedAnnee} onValueChange={onAnneeChange}>
          <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
          <SelectContent>
            {availableYears.map((y) => (
              <SelectItem key={y} value={String(y)}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Button onClick={onGenerate} disabled={generating || loading || statsLoading} className="gap-2">
        {generating ? (
          <><Loader2 className="w-4 h-4 animate-spin" />Génération IA...</>
        ) : (
          <><Sparkles className="w-4 h-4" />Générer le diagnostic IA</>
        )}
      </Button>

      {hasDiagnostic && (
        <div className="flex gap-2">
          <Button variant="outline" onClick={onExportPDF} size="sm">
            <Download className="w-4 h-4 mr-1" />PDF
          </Button>
          <Button variant="outline" onClick={onExportDocx} size="sm">
            <FileDown className="w-4 h-4 mr-1" />DOCX
          </Button>
        </div>
      )}
    </div>
  );
};

export default DiagnosticFilters;
