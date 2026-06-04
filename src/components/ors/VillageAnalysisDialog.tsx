import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, AlertTriangle, MapPin, Users, School } from 'lucide-react';
import type { VillageAnalysisResult } from './MapInteractions';

interface Props {
  result: VillageAnalysisResult | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const VillageAnalysisDialog = ({ result, open, onOpenChange }: Props) => {
  if (!result) return null;
  const { village, eligible, reason, nearestEtab, nearbyEtabs, satelliteVillages, totalPopulation, radiusMeters } = result;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-primary" />
            Analyse d'éligibilité — {village.name}
          </DialogTitle>
          <DialogDescription>
            Étude de faisabilité d'une nouvelle école sur ce village (rayon de {(radiusMeters / 1000).toFixed(1)} km).
          </DialogDescription>
        </DialogHeader>

        <div className={`rounded-lg p-4 border ${eligible ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-destructive/10 border-destructive/30'}`}>
          <div className="flex items-start gap-3">
            {eligible ? (
              <CheckCircle2 className="w-6 h-6 text-emerald-600 flex-shrink-0" />
            ) : (
              <AlertTriangle className="w-6 h-6 text-destructive flex-shrink-0" />
            )}
            <div>
              <div className="font-semibold mb-1">
                {eligible ? 'Village éligible pour Nouvelle Création' : 'Village non éligible'}
              </div>
              <p className="text-sm text-muted-foreground">{reason}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-muted/40 rounded-lg p-3">
            <div className="text-xs text-muted-foreground flex items-center gap-1"><Users className="w-3 h-3" /> Population scolarisable cumulée</div>
            <div className="text-2xl font-bold">{totalPopulation.toLocaleString('fr-FR')}</div>
            <div className="text-[10px] text-muted-foreground">seuil: 300</div>
          </div>
          <div className="bg-muted/40 rounded-lg p-3">
            <div className="text-xs text-muted-foreground flex items-center gap-1"><School className="w-3 h-3" /> Écoles dans le rayon</div>
            <div className="text-2xl font-bold">{nearbyEtabs.length}</div>
            {nearestEtab && (
              <div className="text-[10px] text-muted-foreground truncate">+ proche: {nearestEtab.name} ({nearestEtab.distanceKm.toFixed(1)} km)</div>
            )}
          </div>
        </div>

        {nearbyEtabs.length > 0 && (
          <div>
            <div className="text-sm font-semibold mb-2 flex items-center gap-2">
              <School className="w-4 h-4 text-destructive" /> Écoles dans le rayon
              <Badge variant="destructive" className="text-[10px]">{nearbyEtabs.length}</Badge>
            </div>
            <div className="border border-border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr><th className="text-left p-2">Établissement</th><th className="text-right p-2">Distance</th></tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {nearbyEtabs.sort((a, b) => a.distanceKm - b.distanceKm).map((e, i) => (
                    <tr key={i} className="hover:bg-muted/30">
                      <td className="p-2">{e.name}</td>
                      <td className="p-2 text-right font-mono">{e.distanceKm.toFixed(2)} km</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {satelliteVillages.length > 0 && (
          <div>
            <div className="text-sm font-semibold mb-2 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-amber-500" /> Villages de la zone de desserte
              <Badge variant="secondary" className="text-[10px]">{satelliteVillages.length}</Badge>
            </div>
            <div className="border border-border rounded-lg overflow-hidden max-h-60 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 sticky top-0">
                  <tr><th className="text-left p-2">Village</th><th className="text-right p-2">Distance</th><th className="text-right p-2">Population</th></tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {satelliteVillages.sort((a, b) => a.distanceKm - b.distanceKm).map((s, i) => (
                    <tr key={i} className="hover:bg-muted/30">
                      <td className="p-2">{s.name}</td>
                      <td className="p-2 text-right font-mono">{s.distanceKm.toFixed(2)} km</td>
                      <td className="p-2 text-right">{s.population.toLocaleString('fr-FR')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="text-[11px] text-muted-foreground italic">
          Astuce : clic droit sur un établissement pour voir son aire, ou sur un village pour relancer l'analyse.
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default VillageAnalysisDialog;