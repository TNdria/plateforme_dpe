// @ts-nocheck
import { FileText, Upload } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { SectionBar } from "./FormulaireUI";

export default function StepPieces({ form, pieces, changePiece, errors, getFieldErrorMessage }) {
  return (
    <div className="space-y-5">
      <SectionBar
        num={form.type_demande === "Régularisation" ? "8" : "7"}
        title="Pièces jointes des dossiers à fournir"
        sub="Toutes les pièces sont obligatoires"
        accent=""
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {pieces.map((piece, index) => {
          const hasError = errors.some((e) => e.field === `piece.${index}`);
          return (
            <Card key={piece.code} className={cn(
              "transition-all hover:shadow-md",
              piece.fichier && "border-emerald-300 bg-emerald-50/50 dark:bg-emerald-950/10",
              hasError && "border-red-300 bg-red-50/50 dark:bg-red-950/10"
            )}>
              <CardContent className="p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <FileText className={cn("h-4 w-4", piece.fichier ? "text-emerald-600" : "text-muted-foreground")} />
                  <Badge variant={piece.fichier ? "default" : "outline"}
                    className={cn("text-[10px]", piece.fichier && "bg-emerald-600 hover:bg-emerald-600")}>
                    {piece.fichier ? "✓ Joint" : "Requis"}
                  </Badge>
                </div>

                <p className="text-xs font-medium text-foreground line-clamp-2 min-h-[32px]">{piece.nom}</p>

                {piece.fichier && (
                  <p className="text-[11px] text-muted-foreground truncate bg-muted px-2 py-1 rounded"
                    title={piece.fichier.name}>
                    {piece.fichier.name}
                  </p>
                )}

                <label className={cn(
                  "flex items-center justify-center gap-2 w-full py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors",
                  hasError ? "bg-red-100 text-red-700 hover:bg-red-200" : "bg-primary/10 text-primary hover:bg-primary/20"
                )}>
                  <Upload className="h-3.5 w-3.5" />
                  {piece.fichier ? "Remplacer" : "Choisir un fichier"}
                  <input type="file" className="hidden"
                    onChange={(e) => changePiece(index, e.target.files?.[0] || null)} />
                </label>

                {hasError && (
                  <p className="text-[11px] text-red-500">{getFieldErrorMessage(`piece.${index}`)}</p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}