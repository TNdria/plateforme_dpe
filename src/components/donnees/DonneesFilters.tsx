import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Filter, Loader2 } from 'lucide-react';
import { Dren, Cisco, Zap } from '@/services/api';

interface Commune {
  CODE_COMMUNE: number;
  COMMUNE: string;
}

interface DonneesFiltersProps {
  drens: Dren[];
  ciscos: Cisco[];
  zaps: Zap[];
  communes: Commune[];
  selectedDren: string;
  selectedCisco: string;
  selectedZap: string;
  selectedCommune: string;
  selectedSecteur: string;
  loading: boolean;
  loadingFilters: boolean;
  onDrenChange: (value: string) => void;
  onCiscoChange: (value: string) => void;
  onZapChange: (value: string) => void;
  onCommuneChange: (value: string) => void;
  onSecteurChange: (value: string) => void;
  onFilter: () => void;
}

const DonneesFilters = ({
  drens,
  ciscos,
  zaps,
  communes,
  selectedDren,
  selectedCisco,
  selectedZap,
  selectedCommune,
  selectedSecteur,
  loading,
  loadingFilters,
  onDrenChange,
  onCiscoChange,
  onZapChange,
  onCommuneChange,
  onSecteurChange,
  onFilter,
}: DonneesFiltersProps) => {
  const getOptionKey = (
    prefix: string,
    value: string | number,
    index: number
  ) => `${prefix}-${String(value)}-${index}`;

  return (
    <div className="p-5 bg-card">
      <div className="flex flex-wrap gap-4 items-end">
        <div className="space-y-1">
          <label className="text-sm font-medium">DREN</label>
          <Select value={selectedDren} onValueChange={onDrenChange}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Sélectionner DREN" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">-- Sélectionner --</SelectItem>
              {drens.map((d, index) => (
                <SelectItem
                  key={getOptionKey('dren', d.CODE_DREN, index)}
                  value={d.CODE_DREN.toString()}
                >
                  {d.DREN}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">CISCO</label>
          <Select
            value={selectedCisco}
            onValueChange={onCiscoChange}
            disabled={selectedDren === '0' || loadingFilters}
          >
            <SelectTrigger className="w-52">
              <SelectValue placeholder="Tous les CISCOs" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">Tous les CISCOs</SelectItem>
              {ciscos.map((c, index) => (
                <SelectItem
                  key={getOptionKey('cisco', c.CODE_CISCO, index)}
                  value={c.CODE_CISCO.toString()}
                >
                  {c.CISCO}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">ZAP</label>
          <Select
            value={selectedZap}
            onValueChange={onZapChange}
            disabled={selectedCisco === '0' || loadingFilters}
          >
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Tous les ZAPs" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">Tous les ZAPs</SelectItem>
              {zaps.map((z, index) => (
                <SelectItem
                  key={getOptionKey('zap', z.CODE_ZAP, index)}
                  value={z.CODE_ZAP.toString()}
                >
                  {z.ZAP}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Commune</label>
          <Select
            value={selectedCommune}
            onValueChange={onCommuneChange}
            disabled={selectedCisco === '0' || loadingFilters}
          >
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Toutes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">Toutes les communes</SelectItem>
              {communes.map((c, index) => (
                <SelectItem
                  key={getOptionKey('commune', c.CODE_COMMUNE, index)}
                  value={c.CODE_COMMUNE.toString()}
                >
                  {c.COMMUNE}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Secteur</label>
          <Select value={selectedSecteur} onValueChange={onSecteurChange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="2">Tous</SelectItem>
              <SelectItem value="0">Public</SelectItem>
              <SelectItem value="1">Privé</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button
          onClick={onFilter}
          disabled={loading || selectedDren === '0'}
          className="h-10 px-4"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Filter className="w-4 h-4 mr-2" />
          )}
          Filtrer
        </Button>
      </div>
    </div>
  );
};

export default DonneesFilters;
