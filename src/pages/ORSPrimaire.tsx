import { useState, useCallback, useMemo, useEffect } from 'react';
import { useMapData, Etablissement } from '@/hooks/useMapData';
import { MapFilters, type LayerVisibility, type TableBancFilter } from '@/components/ors/MapFilters';
import { ORSMap } from '@/components/ors/ORSMap';
import { ORSAnalysisPanel } from '@/components/ors/ORSAnalysisPanel';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { MapPin, School, Users, AlertTriangle, Loader2 } from 'lucide-react';
import DataActionsBar from '@/components/admin/DataActionsBar';
import { useUserScope } from '@/hooks/useUserScope';
import useAutoApplyScope from '@/hooks/useAutoApplyScope';
import { VillageAnalysisDialog } from '@/components/ors/VillageAnalysisDialog';
import type { VillageAnalysisResult } from '@/components/ors/MapInteractions';
import { HelpPanel } from '@/components/ors/HelpPanel';
import { downloadAsCsv, ORS_CSV_COLUMNS } from '@/utils/csvExport';

const ORSPrimaire = () => {
  const {
    drens,
    ciscos,
    primaires,
    villages,
    geoLayers,
    loading,
    error,
    selectedDren,
    selectedCisco,
    isFiltered,
    handleDrenChange,
    handleCiscoChange,
    fetchEtablissements,
    resetFilter,
    getDownloadUrl,
  } = useMapData('primaire');

  const scope = useUserScope();

  const [radius, setRadius] = useState(4000);
  const [mapCenter, setMapCenter] = useState<[number, number]>([-18.9189596, 47.5135653]);
  const [mapZoom, setMapZoom] = useState(6);
  const [selectedEtablissement, setSelectedEtablissement] = useState<Etablissement | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>('aucune');
  const [analysisResult, setAnalysisResult] = useState<VillageAnalysisResult | null>(null);
  const [layerVisibility, setLayerVisibility] = useState<LayerVisibility>({
    publiques: true,
    prives: true,
    villages: true,
    nouvelleCreation: true,
  });
  const [tableBancFilter, setTableBancFilter] = useState<TableBancFilter>('tous');

  // Établissements filtrés selon les couches visibles (publiques/privées)
  const filteredPrimaires = useMemo(() => {
    return primaires.filter(p => {
      if (p.SECTEUR === 0 && !layerVisibility.publiques) return false;
      if (p.SECTEUR === 1 && !layerVisibility.prives) return false;
      return true;
    });
  }, [primaires, layerVisibility.publiques, layerVisibility.prives]);

  const filteredVillages = useMemo(
    () => layerVisibility.villages ? villages : [],
    [villages, layerVisibility.villages]
  );

  // Calculer les statistiques
  const stats = useMemo(() => {
    const total = primaires.length;
    const publics = primaires.filter(p => p.SECTEUR === 0).length;
    const prives = primaires.filter(p => p.SECTEUR === 1).length;
    return { total, publics, prives };
  }, [primaires]);

  const handleApplyFilter = useCallback(async () => {
    if (selectedDren === 0) {
      toast.error('Veuillez sélectionner une DREN');
      return;
    }
    
    await fetchEtablissements(selectedDren, selectedCisco);
    
    // Ajuster le zoom selon la sélection
    if (selectedCisco > 0) {
      setMapZoom(10);
    } else {
      setMapZoom(8);
    }
  }, [selectedDren, selectedCisco, fetchEtablissements]);

  useAutoApplyScope({
    scope, selectedDren, selectedCisco, isFiltered,
    handleDrenChange, handleCiscoChange, fetchEtablissements, setMapZoom,
  });

  const handleDownload = useCallback(() => {
    if (!primaires.length) {
      toast.error('Aucune donnée à télécharger');
      return;
    }
    const drenLabel = drens.find(d => d.CODE_DREN === selectedDren)?.DREN ?? `dren${selectedDren}`;
    const ciscoLabel = selectedCisco > 0
      ? (ciscos.find(c => c.CODE_CISCO === selectedCisco)?.CISCO ?? `cisco${selectedCisco}`)
      : 'tous';
    const filename = `ORS_PRIMAIRE_${drenLabel}_${ciscoLabel}_${new Date().toISOString().slice(0,10)}.csv`;
    const ok = downloadAsCsv(primaires, filename, ORS_CSV_COLUMNS);
    if (ok) toast.success(`${primaires.length} établissements exportés`);
  }, [primaires, drens, ciscos, selectedDren, selectedCisco]);

  const handleSearchSelect = useCallback((item: Etablissement) => {
    if (item.latitude && item.longitude) {
      setMapCenter([item.latitude, item.longitude]);
      setMapZoom(14);
      setSelectedEtablissement(item);
    }
  }, []);

  const handleMarkerClick = useCallback((etablissement: Etablissement) => {
    setSelectedEtablissement(etablissement);
  }, []);

  return (
    <div className="h-full flex flex-col">
      {/* Breadcrumb */}
      <div className="px-4 py-2 bg-gradient-to-r from-primary/10 to-transparent border-b border-border">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
            <School className="w-4 h-4" />
            CARTE SCOLAIRE / ORS / ORS PRIMAIRE
          </span>
          <div className="flex items-center gap-2">
            {loading && (
              <Badge variant="outline" className="text-xs gap-1">
                <Loader2 className="w-3 h-3 animate-spin" />
                Chargement...
              </Badge>
            )}
            {stats.total > 0 && !loading && (
              <>
                <Badge variant="secondary" className="text-xs">
                  {stats.total} établissements
                </Badge>
                <Badge variant="outline" className="text-xs bg-cyan-500/10 text-cyan-700">
                  {stats.publics} publics
                </Badge>
                <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-700">
                  {stats.prives} privés
                </Badge>
              </>
            )}
            <DataActionsBar table="fpe_a1" tableLabel="Établissements (Primaire)" compact />
          </div>
        </div>
      </div>

      <div className="flex-1 flex gap-4 p-4 overflow-hidden">
        {/* Filters Panel */}
        <div className="w-80 flex-shrink-0 space-y-4 overflow-y-auto hidden md:block">
          <MapFilters
            drens={drens}
            ciscos={ciscos}
            selectedDren={selectedDren}
            selectedCisco={selectedCisco}
            radius={radius}
            onDrenChange={handleDrenChange}
            onCiscoChange={handleCiscoChange}
            onRadiusChange={setRadius}
            onApplyFilter={handleApplyFilter}
            onResetFilter={resetFilter}
            onDownload={primaires.length > 0 ? handleDownload : undefined}
            loading={loading}
            searchItems={primaires}
            onSearchSelect={handleSearchSelect}
            isFiltered={isFiltered}
            drenLocked={scope.drenLocked}
            ciscoLocked={scope.ciscoLocked}
            layerVisibility={layerVisibility}
            onLayerVisibilityChange={setLayerVisibility}
            showVillagesLayer
            showNouvelleCreationLayer
            tableBancFilter={tableBancFilter}
            onTableBancFilterChange={setTableBancFilter}
          />

          <HelpPanel type="primaire" />

          {/* Category Filter */}
          {primaires.length > 0 && (
            <Card className="shadow-sm">
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-primary" />
                  Catégoriser la carte
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 pt-0">
                <RadioGroup value={categoryFilter} onValueChange={setCategoryFilter} className="space-y-2">
                  <div className="flex items-center space-x-2 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                    <RadioGroupItem value="aucune" id="aucune" />
                    <Label htmlFor="aucune" className="text-sm cursor-pointer flex-1">Aucune</Label>
                  </div>
                  <div className="flex items-center space-x-2 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                    <RadioGroupItem value="extension" id="extension" />
                    <Label htmlFor="extension" className="text-sm cursor-pointer flex-1">Extension</Label>
                    <Badge variant="destructive" className="text-[10px]">Prioritaire</Badge>
                  </div>
                  <div className="flex items-center space-x-2 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                    <RadioGroupItem value="reconstruction" id="reconstruction" />
                    <Label htmlFor="reconstruction" className="text-sm cursor-pointer flex-1">Reconstruction</Label>
                  </div>
                  <div className="flex items-center space-x-2 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                    <RadioGroupItem value="rehabilitation" id="rehabilitation" />
                    <Label htmlFor="rehabilitation" className="text-sm cursor-pointer flex-1">Réhabilitation</Label>
                  </div>
                </RadioGroup>
              </CardContent>
            </Card>
          )}

          {primaires.length > 0 && (
            <ORSAnalysisPanel
              type="primaire"
              primaires={primaires}
              colleges={[]}
              lycees={[]}
              villages={villages}
              radius={radius}
            />
          )}
        </div>

        {/* Map Container */}
        <div className="flex-1 relative rounded-lg overflow-hidden shadow-sm">
          {loading && (
            <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                <span className="text-sm text-muted-foreground">Chargement des données...</span>
              </div>
            </div>
          )}
          <ORSMap
            colleges={[]}
            primaires={filteredPrimaires}
            radius={radius}
            type="primaire"
            onMarkerClick={handleMarkerClick}
            center={mapCenter}
            zoom={mapZoom}
            categoryFilter={categoryFilter}
            geoLayers={geoLayers}
            villages={filteredVillages}
            onVillageAnalysis={setAnalysisResult}
          />
        </div>
      </div>

      {/* Detail Modal */}
      <Dialog open={!!selectedEtablissement} onOpenChange={() => setSelectedEtablissement(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <School className="w-5 h-5 text-primary" />
              {selectedEtablissement?.NOM_ETAB}
            </DialogTitle>
          </DialogHeader>
          {selectedEtablissement && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-muted/50 rounded-lg p-3">
                  <div className="text-xs text-muted-foreground">Code Établissement</div>
                  <div className="font-semibold">{selectedEtablissement.CODE_ETAB}</div>
                </div>
                <div className="bg-muted/50 rounded-lg p-3">
                  <div className="text-xs text-muted-foreground">Secteur</div>
                  <Badge variant={selectedEtablissement.SECTEUR === 0 ? 'default' : 'secondary'}>
                    {selectedEtablissement.SECTEUR === 0 ? 'PUBLIC' : 'PRIVÉ'}
                  </Badge>
                </div>
              </div>
              
              <table className="w-full text-sm">
                <tbody className="divide-y divide-border">
                  <tr className="hover:bg-muted/30">
                    <td className="py-2 font-medium flex items-center gap-2">
                      <Users className="w-4 h-4 text-muted-foreground" />
                      Effectif T5
                    </td>
                    <td className="py-2 text-right font-semibold">{selectedEtablissement.eff_t5 || '-'}</td>
                  </tr>
                  <tr className="hover:bg-muted/30">
                    <td className="py-2 font-medium flex items-center gap-2">
                      <Users className="w-4 h-4 text-muted-foreground" />
                      Effectif Total 2024
                    </td>
                    <td className="py-2 text-right font-semibold">{selectedEtablissement.eff_2024 || '-'}</td>
                  </tr>
                  <tr className="hover:bg-muted/30">
                    <td className="py-2 font-medium flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-muted-foreground" />
                      Commune
                    </td>
                    <td className="py-2 text-right">{selectedEtablissement.COMMUNE || '-'}</td>
                  </tr>
                  <tr className="hover:bg-muted/30">
                    <td className="py-2 font-medium flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-muted-foreground" />
                      Fokontany
                    </td>
                    <td className="py-2 text-right">{selectedEtablissement.FOKONTANY || '-'}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <VillageAnalysisDialog
        result={analysisResult}
        open={!!analysisResult}
        onOpenChange={(open) => !open && setAnalysisResult(null)}
      />
    </div>
  );
};

export default ORSPrimaire;
