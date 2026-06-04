import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { AlertTriangle, CheckCircle2, Building2, MapPin, Hammer, Wrench, PackagePlus } from 'lucide-react';
import { Etablissement, Village } from '@/hooks/useMapData';
import { SpatialGrid } from '@/lib/spatialGrid';

interface ORSAnalysisPanelProps {
  type: 'primaire' | 'college' | 'lycee';
  primaires: Etablissement[];
  colleges: Etablissement[];
  lycees: Etablissement[];
  villages: Village[];
  radius: number;
}

/**
 * Synthèse d'éligibilité ORS : combien d'établissements à reconstruire / réhabiliter / étendre,
 * villages hors zone, etc. Inspiré des panneaux d'analyse Django (orsprimaire.js / orscollege.js / orslycee.js).
 */
export const ORSAnalysisPanel = ({
  type,
  primaires,
  colleges,
  lycees,
  villages,
  radius,
}: ORSAnalysisPanelProps) => {
  const analysis = useMemo(() => {
    // Sélectionne la liste cible selon le type
    const targets =
      type === 'primaire' ? primaires :
      type === 'college' ? colleges :
      lycees;

    const refs =
      type === 'primaire' ? [] :
      type === 'college' ? primaires :
      colleges;

    const total = targets.length;
    const reconstructions = targets.filter((e) => e.eligible_reconstruction).length;
    const rehabilitations = targets.filter((e) => e.eligible_rehabilitation).length;
    const extensions = targets.filter((e) => {
      const sdc_requis = e.sdc_requis || 0;
      const sdc_be = e.sdc_be || 0;
      const sdc_me = e.sdc_me || 0;
      return Math.max(sdc_requis - (sdc_be + sdc_me), 0) > 0;
    }).length;
    const tableBancs = targets.reduce((acc, e) => {
      const eff = e.effectifs || 0;
      const places = e.places || 0;
      return acc + Math.ceil(Math.max(eff - places, 0) / 2);
    }, 0);

    // Pour primaire : villages hors rayon (grille spatiale: O(N) au lieu de O(N×M))
    let villagesHorsZone = 0;
    let villagesTotal = 0;
    if (type === 'primaire' && villages.length > 0) {
      const ecolesPub = primaires.filter((p) => p.SECTEUR === 0 && p.latitude && p.longitude) as Array<{ latitude: number; longitude: number }>;
      const grid = new SpatialGrid(ecolesPub, radius);
      for (const v of villages) {
        if (v.latitude == null || v.longitude == null) continue;
        villagesTotal++;
        if (!grid.hasNeighborWithin(v.latitude, v.longitude, radius)) villagesHorsZone++;
      }
    }

    // Pour collège/lycée : refs (EPP/CEG) hors zone des cibles
    let refsHorsZone = 0;
    let refsTotal = 0;
    if (type !== 'primaire' && refs.length > 0) {
      const targetsCoords = targets.filter((t) => t.latitude && t.longitude) as Array<{ latitude: number; longitude: number }>;
      const grid = new SpatialGrid(targetsCoords, radius);
      for (const r of refs) {
        if (r.SECTEUR !== 0 || r.latitude == null || r.longitude == null) continue;
        refsTotal++;
        if (!grid.hasNeighborWithin(r.latitude, r.longitude, radius)) refsHorsZone++;
      }
    }

    return {
      total,
      reconstructions,
      rehabilitations,
      extensions,
      tableBancs,
      villagesHorsZone,
      villagesTotal,
      refsHorsZone,
      refsTotal,
    };
  }, [type, primaires, colleges, lycees, villages, radius]);

  const labels = {
    primaire: { unit: 'EPP', refUnit: 'Village' },
    college: { unit: 'CEG', refUnit: 'EPP' },
    lycee: { unit: 'Lycée', refUnit: 'CEG' },
  }[type];

  if (analysis.total === 0) return null;

  const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0);

  return (
    <Card className="shadow-sm">
      <CardHeader className="py-3 px-4">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-primary" />
          Analyse d'éligibilité
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 pt-0 space-y-3">
        {/* Total */}
        <div className="flex items-center justify-between text-xs">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <Building2 className="w-3.5 h-3.5" /> {labels.unit} total
          </span>
          <Badge variant="secondary">{analysis.total}</Badge>
        </div>

        {/* Reconstruction */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 text-foreground">
              <Hammer className="w-3.5 h-3.5 text-destructive" /> Reconstruction
            </span>
            <span className="font-semibold tabular-nums">
              {analysis.reconstructions}/{analysis.total}
            </span>
          </div>
          <Progress value={pct(analysis.reconstructions, analysis.total)} className="h-1.5" />
        </div>

        {/* Réhabilitation */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 text-foreground">
              <Wrench className="w-3.5 h-3.5 text-amber-600" /> Réhabilitation
            </span>
            <span className="font-semibold tabular-nums">
              {analysis.rehabilitations}/{analysis.total}
            </span>
          </div>
          <Progress value={pct(analysis.rehabilitations, analysis.total)} className="h-1.5" />
        </div>

        {/* Extension */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 text-foreground">
              <PackagePlus className="w-3.5 h-3.5 text-blue-600" /> Extension
            </span>
            <span className="font-semibold tabular-nums">
              {analysis.extensions}/{analysis.total}
            </span>
          </div>
          <Progress value={pct(analysis.extensions, analysis.total)} className="h-1.5" />
        </div>

        {/* Table-bancs */}
        {analysis.tableBancs > 0 && (
          <div className="flex items-center justify-between text-xs pt-1 border-t border-border">
            <span className="text-muted-foreground">Table-bancs (2 places) requis</span>
            <Badge variant="outline" className="bg-blue-500/10 text-blue-700">
              {analysis.tableBancs.toLocaleString('fr-FR')}
            </Badge>
          </div>
        )}

        {/* Villages hors zone (primaire) */}
        {type === 'primaire' && analysis.villagesTotal > 0 && (
          <div className="pt-2 border-t border-border space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 text-foreground">
                <MapPin className="w-3.5 h-3.5 text-destructive" /> Villages hors zone
              </span>
              <span className="font-semibold tabular-nums">
                {analysis.villagesHorsZone}/{analysis.villagesTotal}
              </span>
            </div>
            <Progress
              value={pct(analysis.villagesHorsZone, analysis.villagesTotal)}
              className="h-1.5"
            />
            <p className="text-[10px] text-muted-foreground">
              Rayon de couverture : {(radius / 1000).toFixed(1)} km
            </p>
          </div>
        )}

        {/* Refs hors zone (college/lycée) */}
        {type !== 'primaire' && analysis.refsTotal > 0 && (
          <div className="pt-2 border-t border-border space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 text-foreground">
                <MapPin className="w-3.5 h-3.5 text-destructive" />
                {labels.refUnit} hors zone
              </span>
              <span className="font-semibold tabular-nums">
                {analysis.refsHorsZone}/{analysis.refsTotal}
              </span>
            </div>
            <Progress value={pct(analysis.refsHorsZone, analysis.refsTotal)} className="h-1.5" />
            <p className="text-[10px] text-muted-foreground flex items-center gap-1">
              {analysis.refsHorsZone > 0 ? (
                <>
                  <AlertTriangle className="w-3 h-3 text-destructive" />
                  Éligibles à un nouveau {labels.unit}
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3 h-3 text-green-600" />
                  Couverture complète dans le rayon
                </>
              )}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
