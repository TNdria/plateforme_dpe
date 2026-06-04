import { useState, useCallback, useMemo } from 'react';
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
import { MapPin, School, Users, GraduationCap, AlertTriangle, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import DataActionsBar from '@/components/admin/DataActionsBar';
import { useUserScope } from '@/hooks/useUserScope';
import useAutoApplyScope from '@/hooks/useAutoApplyScope';
import { VillageAnalysisDialog } from '@/components/ors/VillageAnalysisDialog';
import type { VillageAnalysisResult } from '@/components/ors/MapInteractions';
import { HelpPanel } from '@/components/ors/HelpPanel';
import { downloadAsCsv, ORS_CSV_COLUMNS } from '@/utils/csvExport';

const ORSLycee = () => {
  const {
    drens,
    ciscos,
    lycees,
    colleges,
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
  } = useMapData('lycee');
  const scope = useUserScope();

  const [radius, setRadius] = useState(8000);
  const [mapCenter, setMapCenter] = useState<[number, number]>([-18.9189596, 47.5135653]);
  const [mapZoom, setMapZoom] = useState(6);
  const [selectedEtablissement, setSelectedEtablissement] = useState<Etablissement | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>('aucune');
  const [analysisResult, setAnalysisResult] = useState<VillageAnalysisResult | null>(null);
  const [layerVisibility, setLayerVisibility] = useState<LayerVisibility>({
    publiques: true, prives: true, villages: true, nouvelleCreation: true,
  });
  const [tableBancFilter, setTableBancFilter] = useState<TableBancFilter>('tous');

  const filteredLycees = useMemo(
    () => lycees.filter(l => (l.SECTEUR === 0 ? layerVisibility.publiques : layerVisibility.prives)),
    [lycees, layerVisibility.publiques, layerVisibility.prives]
  );
  const filteredColleges = useMemo(
    () => colleges.filter(c => (c.SECTEUR === 0 ? layerVisibility.publiques : layerVisibility.prives)),
    [colleges, layerVisibility.publiques, layerVisibility.prives]
  );
  const filteredVillages = useMemo(
    () => layerVisibility.villages ? villages : [],
    [villages, layerVisibility.villages]
  );

  // Calculer les statistiques
  const stats = useMemo(() => {
    const totalLycees = lycees.length;
    const totalColleges = colleges.length;
    const eligiblesReconstruction = lycees.filter(l => l.eligible_reconstruction).length;
    const eligiblesRehab = lycees.filter(l => l.eligible_rehabilitation).length;
    return { totalLycees, totalColleges, eligiblesReconstruction, eligiblesRehab };
  }, [lycees, colleges]);

  const handleApplyFilter = useCallback(async () => {
    if (selectedDren === 0) {
      toast.error('Veuillez sélectionner une DREN');
      return;
    }
    
    await fetchEtablissements(selectedDren, selectedCisco);
    
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
    const all = [...lycees, ...colleges];
    if (!all.length) {
      toast.error('Aucune donnée à télécharger');
      return;
    }
    const drenLabel = drens.find(d => d.CODE_DREN === selectedDren)?.DREN ?? `dren${selectedDren}`;
    const ciscoLabel = selectedCisco > 0
      ? (ciscos.find(c => c.CODE_CISCO === selectedCisco)?.CISCO ?? `cisco${selectedCisco}`)
      : 'tous';
    const filename = `ORS_LYCEE_${drenLabel}_${ciscoLabel}_${new Date().toISOString().slice(0,10)}.csv`;
    const ok = downloadAsCsv(all, filename, ORS_CSV_COLUMNS);
    if (ok) toast.success(`${all.length} établissements exportés`);
  }, [lycees, colleges, drens, ciscos, selectedDren, selectedCisco]);

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
      <div className="px-4 py-2 bg-gradient-to-r from-purple-500/10 to-transparent border-b border-border">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
            <GraduationCap className="w-4 h-4" />
            CARTE SCOLAIRE / ORS / ORS LYCEE
          </span>
          <div className="flex items-center gap-2">
            {loading && (
              <Badge variant="outline" className="text-xs gap-1">
                <Loader2 className="w-3 h-3 animate-spin" />
                Chargement...
              </Badge>
            )}
            {(stats.totalLycees > 0 || stats.totalColleges > 0) && !loading && (
              <>
                <Badge variant="secondary" className="text-xs bg-purple-500/10 text-purple-700">
                  {stats.totalLycees} Lycées
                </Badge>
                <Badge variant="outline" className="text-xs bg-green-500/10 text-green-700">
                  {stats.totalColleges} CEG
                </Badge>
                {stats.eligiblesReconstruction > 0 && (
                  <Badge variant="destructive" className="text-xs">
                    {stats.eligiblesReconstruction} reconstruction
                  </Badge>
                )}
              </>
            )}
            <DataActionsBar table="fpe_a1" tableLabel="Établissements (Lycée)" compact />
          </div>
        </div>
      </div>

      <div className="flex-1 flex gap-4 p-4 overflow-hidden">
        {/* Filters Panel */}
        <div className="w-80 flex-shrink-0 space-y-4 overflow-y-auto">
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
            onDownload={lycees.length > 0 ? handleDownload : undefined}
            loading={loading}
            searchItems={[...lycees, ...colleges]}
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

          <HelpPanel type="lycee" />

          {/* Category Filter */}
          {(lycees.length > 0 || colleges.length > 0) && (
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
                  <div className="flex items-center space-x-2 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                    <RadioGroupItem value="tablebanc" id="tablebanc" />
                    <Label htmlFor="tablebanc" className="text-sm cursor-pointer flex-1">Table-bancs</Label>
                  </div>
                </RadioGroup>
              </CardContent>
            </Card>
          )}

          {(lycees.length > 0 || colleges.length > 0) && (
            <ORSAnalysisPanel
              type="lycee"
              primaires={[]}
              colleges={colleges}
              lycees={lycees}
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
            colleges={filteredColleges}
            primaires={filteredLycees}
            radius={radius}
            type="lycee"
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
              <GraduationCap className="w-5 h-5 text-purple-600" />
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
                  <div className="text-xs text-muted-foreground">Effectifs</div>
                  <div className="font-semibold">{selectedEtablissement.effectifs || '-'}</div>
                </div>
              </div>
              
              <table className="w-full text-sm">
                <tbody className="divide-y divide-border">
                  <tr className="hover:bg-muted/30">
                    <td className="py-2 font-medium">Salles Bon État</td>
                    <td className="py-2 text-right font-semibold text-green-600">{selectedEtablissement.sdc_be || '-'}</td>
                  </tr>
                  <tr className="hover:bg-muted/30">
                    <td className="py-2 font-medium">Salles Mauvais État</td>
                    <td className="py-2 text-right font-semibold text-red-600">{selectedEtablissement.sdc_me || '-'}</td>
                  </tr>
                  <tr className="hover:bg-muted/30">
                    <td className="py-2 font-medium">Salles Requises</td>
                    <td className="py-2 text-right font-semibold">{selectedEtablissement.sdc_requis || '-'}</td>
                  </tr>
                  <tr className="hover:bg-muted/30">
                    <td className="py-2 font-medium">Places Disponibles</td>
                    <td className="py-2 text-right font-semibold">{selectedEtablissement.places || '-'}</td>
                  </tr>
                  <tr className="hover:bg-muted/30">
                    <td className="py-2 font-medium">Éligible Reconstruction</td>
                    <td className="py-2 text-right">
                      {selectedEtablissement.eligible_reconstruction ? (
                        <Badge variant="destructive" className="gap-1">
                          <XCircle className="w-3 h-3" /> OUI
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="gap-1 text-green-600 border-green-600">
                          <CheckCircle className="w-3 h-3" /> NON
                        </Badge>
                      )}
                    </td>
                  </tr>
                  <tr className="hover:bg-muted/30">
                    <td className="py-2 font-medium">Éligible Réhabilitation</td>
                    <td className="py-2 text-right">
                      {selectedEtablissement.eligible_rehabilitation ? (
                        <Badge variant="secondary" className="gap-1 bg-amber-100 text-amber-700">
                          <AlertTriangle className="w-3 h-3" /> OUI
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="gap-1 text-green-600 border-green-600">
                          <CheckCircle className="w-3 h-3" /> NON
                        </Badge>
                      )}
                    </td>
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

export default ORSLycee;
