import { useState, useMemo, useRef, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Filter, Download, Search, Loader2, MapPin, X, Lock, Layers } from 'lucide-react';
import { DREN, CISCO, Etablissement } from '@/hooks/useMapData';

export interface LayerVisibility {
  publiques: boolean;
  prives: boolean;
  villages: boolean;
  nouvelleCreation: boolean;
}

export type TableBancFilter = 'tous' | 'suffisant' | 'insuffisant';

interface MapFiltersProps {
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
  searchItems?: Etablissement[];
  onSearchSelect?: (item: Etablissement) => void;
  isFiltered?: boolean;
  /** Verrouille le sélecteur DREN (utilisateur scope DREN) */
  drenLocked?: boolean;
  /** Verrouille le sélecteur CISCO (utilisateur scope CISCO) */
  ciscoLocked?: boolean;
  /** Visibilité des couches (publiques / privées / villages / NC) */
  layerVisibility?: LayerVisibility;
  onLayerVisibilityChange?: (visibility: LayerVisibility) => void;
  /** Affiche/masque la couche villages (selon le type de page) */
  showVillagesLayer?: boolean;
  /** Affiche/masque la couche nouvelle création */
  showNouvelleCreationLayer?: boolean;
  /** Filtre table-bancs */
  tableBancFilter?: TableBancFilter;
  onTableBancFilterChange?: (value: TableBancFilter) => void;
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
  searchItems = [],
  onSearchSelect,
  isFiltered = false,
  drenLocked = false,
  ciscoLocked = false,
  layerVisibility,
  onLayerVisibilityChange,
  showVillagesLayer = true,
  showNouvelleCreationLayer = true,
  tableBancFilter,
  onTableBancFilterChange,
}: MapFiltersProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchSectionRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const prevFilteredRef = useRef(isFiltered);

  // Quand le filtre vient d'être appliqué et que des résultats arrivent, scroll vers la recherche
  useEffect(() => {
    if (!prevFilteredRef.current && isFiltered && searchItems.length > 0) {
      // Petit délai pour laisser le DOM se mettre à jour
      setTimeout(() => {
        searchSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        searchInputRef.current?.focus();
      }, 250);
    }
    prevFilteredRef.current = isFiltered;
  }, [isFiltered, searchItems.length]);

  // Filtrer les résultats de recherche
  const filteredSearchItems = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase();
    return searchItems
      .filter(item => 
        item.NOM_ETAB?.toLowerCase().includes(query) ||
        item.CODE_ETAB?.toString().includes(query)
      )
      .slice(0, 20); // Limiter à 20 résultats
  }, [searchItems, searchQuery]);

  const handleSearchSelect = (item: Etablissement) => {
    if (onSearchSelect) {
      onSearchSelect(item);
    }
    setSearchQuery('');
    setIsSearchOpen(false);
  };

  return (
    <div className="bg-card border border-border rounded-lg shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-primary/5 border-b border-border">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
            <Filter className="w-4 h-4 text-primary" />
            Filtres de sélection
          </h3>
          {isFiltered && (
            <span className="text-[10px] font-medium bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
              Filtre actif
            </span>
          )}
        </div>
      </div>
      
      <div className="p-4 space-y-4">
        {/* DREN Select */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
            DREN
            {drenLocked && <Lock className="w-3 h-3 text-primary" aria-label="Verrouillée par votre profil" />}
          </label>
          <Select
            value={selectedDren.toString()}
            onValueChange={(v) => onDrenChange(parseInt(v))}
            disabled={drenLocked}
          >
            <SelectTrigger className={`h-10 ${drenLocked ? 'opacity-80 bg-muted/40' : ''}`}>
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
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
            CISCO
            {ciscoLocked && <Lock className="w-3 h-3 text-primary" aria-label="Verrouillée par votre profil" />}
          </label>
          <Select
            value={selectedCisco.toString()}
            onValueChange={(v) => onCiscoChange(parseInt(v))}
            disabled={selectedDren === 0 || ciscoLocked}
          >
            <SelectTrigger className={`h-10 ${selectedDren === 0 ? 'opacity-50' : ''} ${ciscoLocked ? 'opacity-80 bg-muted/40' : ''}`}>
              <SelectValue placeholder={selectedDren === 0 ? "Choisir une DREN d'abord" : "Sélectionner une CISCO"} />
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
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Rayon de couverture
            </label>
            <span className="text-sm font-bold text-primary bg-primary/10 px-2 py-0.5 rounded">
              {radius / 1000} km
            </span>
          </div>
          <Slider
            value={[radius]}
            onValueChange={([v]) => onRadiusChange(v)}
            min={2000}
            max={15000}
            step={500}
            className="w-full"
          />
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>2 km</span>
            <span>15 km</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 pt-2">
          <Button 
            onClick={onApplyFilter}
            disabled={selectedDren === 0 || loading}
            className="flex-1 h-10"
            size="default"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Filter className="w-4 h-4 mr-2" />
            )}
            {loading ? 'Chargement...' : 'Appliquer'}
          </Button>
          
          {isFiltered && onResetFilter && (
            <Button 
              variant="outline"
              onClick={onResetFilter}
              className="h-10 px-3"
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
              className="h-10 px-3"
              title="Télécharger les données"
            >
              <Download className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Couches affichées */}
      {layerVisibility && onLayerVisibilityChange && (
        <div className="border-t border-border">
          <div className="px-4 py-3 bg-muted/20">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1">
              <Layers className="w-3.5 h-3.5" />
              Couches affichées
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="flex items-center gap-2 p-2 rounded hover:bg-muted/50 cursor-pointer transition-colors">
                <Checkbox
                  checked={layerVisibility.publiques}
                  onCheckedChange={(checked) =>
                    onLayerVisibilityChange({ ...layerVisibility, publiques: !!checked })
                  }
                />
                <span className="text-xs">
                  <span className="inline-block w-2 h-2 rounded-full bg-cyan-500 mr-1.5 align-middle" />
                  Publiques
                </span>
              </label>
              <label className="flex items-center gap-2 p-2 rounded hover:bg-muted/50 cursor-pointer transition-colors">
                <Checkbox
                  checked={layerVisibility.prives}
                  onCheckedChange={(checked) =>
                    onLayerVisibilityChange({ ...layerVisibility, prives: !!checked })
                  }
                />
                <span className="text-xs">
                  <span className="inline-block w-2 h-2 rounded-full bg-amber-500 mr-1.5 align-middle" />
                  Privées
                </span>
              </label>
              {showVillagesLayer && (
                <label className="flex items-center gap-2 p-2 rounded hover:bg-muted/50 cursor-pointer transition-colors">
                  <Checkbox
                    checked={layerVisibility.villages}
                    onCheckedChange={(checked) =>
                      onLayerVisibilityChange({ ...layerVisibility, villages: !!checked })
                    }
                  />
                  <span className="text-xs">
                    <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 mr-1.5 align-middle" />
                    Villages
                  </span>
                </label>
              )}
              {showNouvelleCreationLayer && (
                <label className="flex items-center gap-2 p-2 rounded hover:bg-muted/50 cursor-pointer transition-colors">
                  <Checkbox
                    checked={layerVisibility.nouvelleCreation}
                    onCheckedChange={(checked) =>
                      onLayerVisibilityChange({ ...layerVisibility, nouvelleCreation: !!checked })
                    }
                  />
                  <span className="text-xs">
                    <span className="inline-block w-2 h-2 rounded-full bg-rose-500 mr-1.5 align-middle" />
                    Nouvelle création
                  </span>
                </label>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Filtre Table-bancs */}
      {tableBancFilter !== undefined && onTableBancFilterChange && (
        <div className="border-t border-border">
          <div className="px-4 py-3 bg-muted/20">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 block">
              Table-bancs
            </label>
            <RadioGroup
              value={tableBancFilter}
              onValueChange={(v) => onTableBancFilterChange(v as TableBancFilter)}
              className="space-y-1"
            >
              <div className="flex items-center gap-2 p-1.5 rounded hover:bg-muted/50">
                <RadioGroupItem value="tous" id="tb-tous" />
                <Label htmlFor="tb-tous" className="text-xs cursor-pointer flex-1">Tous</Label>
              </div>
              <div className="flex items-center gap-2 p-1.5 rounded hover:bg-muted/50">
                <RadioGroupItem value="suffisant" id="tb-suff" />
                <Label htmlFor="tb-suff" className="text-xs cursor-pointer flex-1">Suffisant</Label>
              </div>
              <div className="flex items-center gap-2 p-1.5 rounded hover:bg-muted/50">
                <RadioGroupItem value="insuffisant" id="tb-insuff" />
                <Label htmlFor="tb-insuff" className="text-xs cursor-pointer flex-1">Insuffisant</Label>
              </div>
            </RadioGroup>
          </div>
        </div>
      )}

      {/* Search Section */}
      {searchItems.length > 0 && (
        <div className="border-t border-border" ref={searchSectionRef}>
          <div className="px-4 py-3 bg-muted/30">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 block">
              Recherche rapide ({searchItems.length} établissements)
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                ref={searchInputRef}
                type="text"
                placeholder="Rechercher un établissement..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setIsSearchOpen(true);
                }}
                onFocus={() => setIsSearchOpen(true)}
                className="pl-9 pr-8 h-9"
              />
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setIsSearchOpen(false);
                  }}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            
            {/* Search Results Dropdown */}
            {isSearchOpen && filteredSearchItems.length > 0 && (
              <div className="mt-2 max-h-48 overflow-y-auto bg-background border border-border rounded-lg shadow-lg">
                {filteredSearchItems.map((item) => (
                  <button
                    key={item.CODE_ETAB}
                    onClick={() => handleSearchSelect(item)}
                    className="w-full px-3 py-2 text-left hover:bg-muted/50 transition-colors flex items-center gap-2 border-b border-border last:border-0"
                  >
                    <MapPin className="w-3 h-3 text-primary flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium truncate">{item.NOM_ETAB}</div>
                      <div className="text-[10px] text-muted-foreground">Code: {item.CODE_ETAB}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
            
            {isSearchOpen && searchQuery && filteredSearchItems.length === 0 && (
              <div className="mt-2 px-3 py-2 text-xs text-muted-foreground bg-muted/30 rounded-lg">
                Aucun résultat trouvé pour "{searchQuery}"
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
