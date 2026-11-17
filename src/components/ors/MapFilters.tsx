import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Filter, Download, Loader2, X, Lock } from "lucide-react";
import { DREN, CISCO } from "@/hooks/useMapData";

export interface LayerVisibility {
  publiques: boolean;
  prives: boolean;
  villages: boolean;
  /** Cercles d'aire de recrutement par établissement — désactivé par défaut
   * pour éviter d'encombrer la carte. */
  aires: boolean;
}

interface MapFiltersProps {
  niveau?: string;
  aireRecrutementMeters?: number;
  drens: DREN[];
  ciscos: CISCO[];
  selectedDren: number;
  selectedCisco: number;
  radius: number;
  onDrenChange: (value: number) => void;
  onCiscoChange: (value: number) => void;
  onRadiusChange: (value: number) => void;
  onApplyFilter: () => void;
  onResetFilter?: () => void;
  onDownload?: () => void;
  loading?: boolean;
  isFiltered?: boolean;
  /** Verrouille le sélecteur DREN (utilisateur scope DREN) */
  drenLocked?: boolean;
  /** Verrouille le sélecteur CISCO (utilisateur scope CISCO) */
  ciscoLocked?: boolean;
}

export const MapFilters = ({
  drens,
  ciscos,
  selectedDren,
  selectedCisco,
  radius,
  onDrenChange,
  onCiscoChange,
  onRadiusChange,
  onApplyFilter,
  onResetFilter,
  onDownload,
  loading,
  isFiltered = false,
  drenLocked = false,
  ciscoLocked = false,
}: MapFiltersProps) => {

  return (
    <div className="bg-card border border-border rounded-lg shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2.5 bg-primary/5 border-b border-border">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-primary" />
            Filtres de sélection
          </h3>
          {isFiltered && (
            <span className="text-[9px] font-medium bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full">
              Filtre actif
            </span>
          )}
        </div>
      </div>

      <div className="p-3 space-y-3">
        {/* DREN Select */}
        <div className="space-y-1">
          <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
            DREN
            {drenLocked && (
              <Lock className="w-3 h-3 text-primary" aria-label="Verrouillée par votre profil" />
            )}
          </label>
          <Select
            value={selectedDren.toString()}
            onValueChange={(v) => onDrenChange(parseInt(v))}
            disabled={drenLocked}
          >
            <SelectTrigger className={`h-8 ${drenLocked ? "opacity-80 bg-muted/40" : ""}`}>
              <SelectValue placeholder="Sélectionner une DREN" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">-- Toutes les DREN --</SelectItem>
              {drens.map((dren) => (
                <SelectItem key={dren.CODE_DREN} value={dren.CODE_DREN.toString()}>
                  {dren.DREN}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* CISCO Select */}
        <div className="space-y-1">
          <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
            CISCO
            {ciscoLocked && (
              <Lock className="w-3 h-3 text-primary" aria-label="Verrouillée par votre profil" />
            )}
          </label>
          <Select
            value={selectedCisco.toString()}
            onValueChange={(v) => onCiscoChange(parseInt(v))}
            disabled={selectedDren === 0 || ciscoLocked}
          >
            <SelectTrigger
              className={`h-8 ${selectedDren === 0 ? "opacity-50" : ""} ${ciscoLocked ? "opacity-80 bg-muted/40" : ""}`}
            >
              <SelectValue
                placeholder={
                  selectedDren === 0 ? "Choisir une DREN d'abord" : "Sélectionner une CISCO"
                }
              />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">-- Toutes les CISCO --</SelectItem>
              {ciscos.map((cisco) => (
                <SelectItem key={cisco.CODE_CISCO} value={cisco.CODE_CISCO.toString()}>
                  {cisco.CISCO}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Radius Slider */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
              Rayon de couverture
            </label>
            <span className="text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded">
              {radius / 1000} km
            </span>
          </div>
          <Slider
            value={[radius]}
            onValueChange={([v]) => onRadiusChange(v)}
            min={2000}
            max={20000}
            step={500}
            className="w-full"
          />
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>2 km</span>
            <span>20 km</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 pt-1">
          <Button
            onClick={onApplyFilter}
            disabled={selectedDren === 0 || loading}
            className="flex-1 h-8"
            size="default"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Filter className="w-4 h-4 mr-2" />
            )}
            {loading ? "Chargement..." : "Appliquer"}
          </Button>

          {isFiltered && onResetFilter && (
            <Button
              variant="outline"
              onClick={onResetFilter}
              className="h-8 px-2.5"
              title="Réinitialiser les filtres"
            >
              <X className="w-4 h-4" />
            </Button>
          )}

          {onDownload && (
            <Button
              variant="outline"
              onClick={onDownload}
              disabled={selectedDren === 0}
              className="h-8 px-2.5"
              title="Télécharger les données"
            >
              <Download className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>


    </div>
  );
};
