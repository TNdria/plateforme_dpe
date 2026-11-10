// @ts-nocheck
import { XCircle, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const normaliserStatutAnalyse = (item) => {
  const valeur = String(item?.statut ?? item?.status ?? item?.resultat ?? item?.etat ?? "").toLowerCase().trim();
  if (["na", "non_applicable", "non applicable", "non-applicable"].includes(valeur)) return "non_applicable";
  if (["ok", "conforme", "derog", "derogation"].includes(valeur) || valeur.includes("derog") ||
      (valeur.includes("conforme") && !valeur.includes("non"))) return "conforme";
  if (["ko", "non_conforme"].includes(valeur) || valeur.includes("non conforme") ||
      valeur.includes("refus") || valeur.includes("echec") || valeur.includes("échec")) return "non_conforme";
  return "non_verifiable";
};

export default function AnalyseInline({
  analyse,
  ids,
  titre = "Résultat de l'analyse automatique",
  sansConteneur = false,
}) {
  const tous = Array.isArray(analyse?.items) ? analyse.items : [];
  const items = ids?.length ? tous.filter((x) => ids.includes(String(x.id))) : tous;
  if (!items.length) return null;

  // On ne garde QUE les items non conformes (non vérifiables inclus)
  const nonConformes = items.filter((x) => {
    const s = normaliserStatutAnalyse(x);
    return s !== "conforme" && s !== "non_applicable";
  });

  // Si tous les critères sont conformes → on n'affiche RIEN
  if (nonConformes.length === 0) return null;

  const renduItems = nonConformes.map((item) => {
    const estDerog = String(item?.statut || "").toLowerCase().includes("derog");
    return (
      <div
        key={String(item.id)}
        className={cn(
          "rounded-lg border p-3",
          estDerog
            ? "border-amber-200 bg-amber-50"
            : "border-red-200 bg-red-50"
        )}
      >
        <div className="flex items-start gap-2">
          {estDerog ? (
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          ) : (
            <XCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
          )}
          <div className="min-w-0 flex-1">
            <p className={cn("text-xs font-semibold", estDerog ? "text-amber-800" : "text-red-800")}>
              {item.libelle}
            </p>
            {item.norme && (
              <p className="text-[11px] text-muted-foreground mt-1">
                <strong>Norme :</strong> {item.norme}
              </p>
            )}
            <p className="text-[11px] text-muted-foreground mt-1">
              <strong>Valeur :</strong> {item.valeur ?? "Non renseignée"}
            </p>
            <p className={cn("text-xs mt-1", estDerog ? "text-amber-700" : "text-red-700")}>
              {item.detail || "Information obligatoire absente ou non conforme."}
            </p>
          </div>
        </div>
      </div>
    );
  });

  // ✅ MODE SANS CONTENEUR : Juste les items (sans la Card rouge, sans le titre, sans le badge)
  if (sansConteneur) {
    return <div className="space-y-2">{renduItems}</div>;
  }

  // MODE NORMAL : Avec la Card rouge (pour les autres onglets)
  return (
    <Card className="border-2 border-red-500/40 bg-red-50/30">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center justify-between gap-3">
          <span className="flex items-center gap-2">
            <XCircle className="h-5 w-5 text-red-600" />
            {titre}
          </span>
          <Badge className="text-[10px] bg-red-600 text-white">
            ANALYSE NON VALIDÉE
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {renduItems}
      </CardContent>
    </Card>
  );
}

export { normaliserStatutAnalyse };