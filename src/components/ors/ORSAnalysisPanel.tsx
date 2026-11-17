import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  AlertTriangle,
  Building2,
  MapPin,
  Hammer,
  Wrench,
  PackagePlus,
  Sparkles,
} from "lucide-react";
import { Etablissement } from "@/hooks/useMapData";
import type { VillageEligibleNouvelleCreationFeatureCollection } from "@/services/api";
import type { NcAnalysis } from "./nouvelleCreation";

interface ORSAnalysisPanelProps {
  type: "primaire" | "college" | "lycee";
  primaires: Etablissement[];
  colleges: Etablissement[];
  lycees: Etablissement[];
  /** Résultat Nouvelle Création : null pour Collège et Lycée. */
  nc: NcAnalysis | null;
  villagesEligiblesNouvelleCreation: VillageEligibleNouvelleCreationFeatureCollection;
}

const isEligibilityFlagEnabled = (value: unknown): boolean =>
  value === true || value === 1 || value === "1" || value === "true";

export const ORSAnalysisPanel = ({
  type,
  primaires,
  colleges,
  lycees,
  nc,
  villagesEligiblesNouvelleCreation,
}: ORSAnalysisPanelProps) => {
  const analysis = useMemo(() => {
    const targets =
      type === "primaire" ? primaires : type === "college" ? colleges : lycees;
    const total = targets.length;

    const reconstruction = targets.filter((etab) =>
      isEligibilityFlagEnabled(etab.eligible_reconstruction),
    ).length;

    const rehabilitation = targets.filter((etab) =>
      isEligibilityFlagEnabled(etab.eligible_rehabilitation),
    ).length;

    const extension = targets.filter((etab) =>
      isEligibilityFlagEnabled(etab.eligible_extension),
    ).length;

    return {
      total,
      criteria: [
        { key: "reconstruction", label: "Reconstruction", eligible: reconstruction },
        { key: "rehabilitation", label: "Réhabilitation", eligible: rehabilitation },
        { key: "extension", label: "Extension", eligible: extension },
      ],
    };
  }, [type, primaires, colleges, lycees]);

  const labels = {
    primaire: { unit: "EPP" },
    college: { unit: "CEG" },
    lycee: { unit: "Lycée" },
  }[type];

  const ncStats = type === "primaire" ? nc?.stats : undefined;
  const ncConfig = type === "primaire" ? nc?.config : undefined;

  const ncCandidates =
    type === "primaire"
      ? villagesEligiblesNouvelleCreation.features
      : [];

  const ncCorrespondances = ncCandidates.filter(
    (feature) => feature.properties?.correspondance_village === true,
  ).length;

  const ncPointsProposes = ncCandidates.filter(
    (feature) => feature.properties?.correspondance_village === false,
  ).length;

  const hasCandidates = ncCandidates.length > 0;
  const hasVillageAnalysis = !!ncStats && ncStats.villagesTotal > 0;

  if (analysis.total === 0 && !hasVillageAnalysis && !hasCandidates) return null;

  const pct = (value: number, total: number) =>
    total > 0 ? Math.round((value / total) * 100) : 0;

  return (
    <Card className="shadow-sm">
      <CardHeader className="py-3 px-4">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-primary" />
          Analyse d'éligibilité
        </CardTitle>
      </CardHeader>

      <CardContent className="px-4 pb-4 pt-0 space-y-4">
        {analysis.total > 0 && (
          <section className="space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 text-muted-foreground font-medium">
                <Building2 className="w-3.5 h-3.5" />
                Établissements — {labels.unit}
              </span>
              <Badge variant="secondary">
                {analysis.total.toLocaleString("fr-FR")}
              </Badge>
            </div>

            {analysis.criteria.map((criterion) => {
              const nonEligible = analysis.total - criterion.eligible;
              return (
                <div key={criterion.key} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-foreground">
                      {criterion.label}
                    </span>
                    <span className="font-semibold tabular-nums">
                      {criterion.eligible.toLocaleString("fr-FR")} éligibles
                    </span>
                  </div>
                  <Progress
                    value={pct(criterion.eligible, analysis.total)}
                    className="h-1.5"
                  />
                  <div className="flex flex-wrap justify-between gap-x-3 text-[10px] text-muted-foreground">
                    <span>
                      Non éligibles : {nonEligible.toLocaleString("fr-FR")}
                    </span>
                    <span>
                      Total : {analysis.total.toLocaleString("fr-FR")}
                    </span>
                  </div>
                </div>
              );
            })}
          </section>
        )}

        {hasCandidates && (
          <section className="pt-3 border-t border-border space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 text-foreground font-medium">
                <MapPin className="w-3.5 h-3.5" />
                Nouvelle Création (villages/points)
              </span>
              <Badge variant="secondary">
                {ncCandidates.length.toLocaleString("fr-FR")}
              </Badge>
            </div>

            <div className="flex flex-wrap justify-between gap-x-3 text-xs">
              <span className="text-emerald-600">
                Correspondances SIG : {ncCorrespondances.toLocaleString("fr-FR")}
              </span>
              <span className="text-muted-foreground">
                Points éligibles proposés : {ncPointsProposes.toLocaleString("fr-FR")}
              </span>
            </div>
          </section>
        )}

        {hasVillageAnalysis && ncStats && (
          <section className="pt-3 border-t border-border space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 text-foreground font-medium">
                <MapPin className="w-3.5 h-3.5" />
                Analyse historique des villages
              </span>
              <Badge variant="secondary">
                {ncStats.villagesTotal.toLocaleString("fr-FR")}
              </Badge>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-foreground">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                  Retenus par l’analyse historique
                </span>
                <span className="font-semibold tabular-nums">
                  {ncStats.eligibles.toLocaleString("fr-FR")}
                </span>
              </div>
              <Progress
                value={pct(ncStats.eligibles, ncStats.villagesTotal)}
                className="h-1.5"
              />
              <div className="flex flex-wrap justify-between gap-x-3 text-[10px] text-muted-foreground">
                <span>
                  Non retenus : {ncStats.nonEligibles.toLocaleString("fr-FR")}
                </span>
                <span>
                  Total : {ncStats.villagesTotal.toLocaleString("fr-FR")}
                </span>
              </div>
            </div>

            <div className="pt-2 border-t border-dashed border-border space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <MapPin className="w-3.5 h-3.5" />
                  Villages hors zone (indicateur géographique)
                </span>
                <span className="font-semibold tabular-nums">
                  {ncStats.horsZone.toLocaleString("fr-FR")} /{" "}
                  {ncStats.villagesTotal.toLocaleString("fr-FR")}
                </span>
              </div>
              <Progress
                value={pct(ncStats.horsZone, ncStats.villagesTotal)}
                className="h-1.5"
              />
            </div>

            {ncConfig && (
              <p className="text-[10px] text-muted-foreground">
                Aire de recrutement fixe : {ncConfig.aireMeters / 1000} km
                {" · "}
                {ncConfig.critereLabel} &gt;{" "}
                {ncConfig.seuil.toLocaleString("fr-FR")}
              </p>
            )}

            {nc?.refsSansDonnee !== undefined && nc.refsSansDonnee > 0 && (
              <p className="text-[10px] text-amber-600 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                {nc.refsSansDonnee.toLocaleString("fr-FR")}/
                {nc.refsTotal.toLocaleString("fr-FR")} établissement(s) de
                référence sans effectif renseigné (comptés 0)
              </p>
            )}
          </section>
        )}
      </CardContent>
    </Card>
  );
};
