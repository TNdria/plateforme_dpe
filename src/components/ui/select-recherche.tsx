// @ts-nocheck
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const MAX_AFFICHES = 100;

export function SelectAvecRecherche({
  value,
  onValueChange,
  options = [],
  placeholder = "Sélectionner...",
  disabled = false,
  className = "",
  searchPlaceholder = "Rechercher...",
}) {
  const [recherche, setRecherche] = useState("");

  const optionsFiltrees = useMemo(() => {
    const q = String(recherche || "").toLowerCase().trim();
    const filtrees = q
      ? options.filter((opt) => String(opt).toLowerCase().includes(q))
      : options;
    return filtrees.slice(0, MAX_AFFICHES);
  }, [options, recherche]);

  return (
    <Select
      value={value || ""}
      onValueChange={(v) => {
        setRecherche("");
        onValueChange(v);
      }}
      disabled={disabled}
    >
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <div className="sticky top-0 z-10 bg-popover p-2 border-b">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              autoFocus
              placeholder={searchPlaceholder}
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              className="h-8 pl-7 text-xs"
              onKeyDown={(e) => e.stopPropagation()}
            />
          </div>
          {options.length > MAX_AFFICHES && (
            <p className="text-[10px] text-muted-foreground mt-1">
              {optionsFiltrees.length} / {options.length} résultats
            </p>
          )}
        </div>
        {optionsFiltrees.length === 0 ? (
          <div className="py-4 text-center text-xs text-muted-foreground">
            Aucun résultat
          </div>
        ) : (
          optionsFiltrees.map((opt) => (
            <SelectItem key={opt} value={opt}>
              {opt}
            </SelectItem>
          ))
        )}
      </SelectContent>
    </Select>
  );
}