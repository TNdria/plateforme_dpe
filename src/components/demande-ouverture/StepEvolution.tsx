// @ts-nocheck
import { Users, BarChart3, TrendingUp, TrendingDown, Minus, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { NIVEAU_COLONNES_EFFECTIF } from "@/constants/demandeOuvertureConfig";
import { SectionBar } from "./FormulaireUI";

export default function StepEvolution({ niveauKey, evolutionRecuperee }) {
  const colonnesEffectif = NIVEAU_COLONNES_EFFECTIF[niveauKey] || [];

  // ✅ Tri du plus récent au plus ancien (fonctionne aussi avec "2023-2024")
  const evolutionTriee = [...(evolutionRecuperee || [])].sort((a, b) =>
    String(b.annee).localeCompare(String(a.annee))
  );

  const derniereAnnee = evolutionTriee[0];
  const premiereAnnee = evolutionTriee[evolutionTriee.length - 1];

  const totalDebut = Number(premiereAnnee?.effectif_total) || 0;
  const totalFin = Number(derniereAnnee?.effectif_total) || 0;

  const evolutionGlobalePct =
    evolutionTriee.length > 1 && totalDebut > 0
      ? Math.round(((totalFin - totalDebut) / totalDebut) * 1000) / 10
      : null;

  return (
    <div className="space-y-5">
      <SectionBar num="VI" title="Évolution des effectifs" accent="blue" />

      {evolutionTriee.length === 0 ? (
        <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-xs flex items-start gap-2">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span>Aucune évolution d'effectif disponible dans les données ORS.</span>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            <Card>
              <CardContent className="pt-3 px-4">
                <div className="flex items-center gap-3">
                  <Users className="w-7 h-7 text-primary flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground truncate">Année {premiereAnnee?.annee}</p>
                    <p className="text-lg font-bold">{totalDebut}</p>
                    <p className="text-[10px] text-muted-foreground">élèves (1ère année)</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-3 px-4">
                <div className="flex items-center gap-3">
                  <BarChart3 className="w-7 h-7 text-blue-500 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground truncate">Année {derniereAnnee?.annee}</p>
                    <p className="text-lg font-bold">{totalFin}</p>
                    <p className="text-[10px] text-muted-foreground">élèves (dernière année)</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-3 px-4">
                <div className="flex items-center gap-3">
                  {evolutionGlobalePct === null || evolutionGlobalePct === 0
                    ? <Minus className="w-7 h-7 text-muted-foreground flex-shrink-0" />
                    : evolutionGlobalePct > 0
                      ? <TrendingUp className="w-7 h-7 text-green-500 flex-shrink-0" />
                      : <TrendingDown className="w-7 h-7 text-red-500 flex-shrink-0" />}
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground truncate">Évolution globale</p>
                    <p className={cn("text-lg font-bold",
                      evolutionGlobalePct === null ? "text-muted-foreground"
                      : evolutionGlobalePct > 0 ? "text-emerald-600"
                      : evolutionGlobalePct < 0 ? "text-red-600"
                      : "text-muted-foreground")}>
                      {evolutionGlobalePct === null
                        ? "—"
                        : `${evolutionGlobalePct > 0 ? "+" : ""}${evolutionGlobalePct}%`}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      sur {evolutionTriee.length} année{evolutionTriee.length > 1 ? "s" : ""}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="overflow-hidden">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm sm:text-base">
                Effectif par classe et par année scolaire (3 dernières années — données ORS)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-card z-10">
                    <TableRow>
                      <TableHead>Année scolaire</TableHead>
                      {colonnesEffectif.map((c) => <TableHead key={c.key} className="text-center">{c.label}</TableHead>)}
                      <TableHead className="text-primary text-center bg-primary/5">Total</TableHead>
                      <TableHead className="text-center">Évolution</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {evolutionTriee.map((item, index) => {
                      const anneeAnterieure = evolutionTriee[index + 1];
                      const total = Number(item.effectif_total) || 0;
                      const totalAnterieur = anneeAnterieure ? Number(anneeAnterieure.effectif_total) || 0 : null;
                      const variation = totalAnterieur !== null ? total - totalAnterieur : null;
                      const variationPct = totalAnterieur ? Math.round((variation / totalAnterieur) * 1000) / 10 : null;

                      return (
                        <TableRow key={`${item.annee}-${index}`} className={cn(index % 2 === 1 && "bg-muted/20")}>
                          <TableCell className="font-medium text-foreground">{item.annee}</TableCell>
                          {colonnesEffectif.map((c) => (
                            <TableCell key={c.key} className="text-center text-muted-foreground">{item[c.key] ?? 0}</TableCell>
                          ))}
                          <TableCell className="text-center font-bold text-primary bg-primary/5">{total}</TableCell>
                          <TableCell className="text-center">
                            {variation === null ? (
                              <span className="text-muted-foreground text-xs">—</span>
                            ) : (
                              <span className={cn("inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full",
                                variation > 0 ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                                : variation < 0 ? "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400"
                                : "bg-muted text-muted-foreground")}>
                                {variation > 0 ? <TrendingUp className="h-3 w-3" />
                                  : variation < 0 ? <TrendingDown className="h-3 w-3" />
                                  : <Minus className="h-3 w-3" />}
                                {variation > 0 ? "+" : ""}{variation}
                                {variationPct !== null ? ` (${variationPct > 0 ? "+" : ""}${variationPct}%)` : ""}
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}