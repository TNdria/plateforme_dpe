import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { MapPin, Search, X } from "lucide-react";
import type { Etablissement, Village } from "@/hooks/useMapData";

interface MapSearchProps {
  searchItems: Etablissement[];
  villages: Village[];
  onSearchSelect: (item: Etablissement) => void;
  onVillageSelect: (village: Village) => void;
  showTitle?: boolean;
}

export const MapSearch = ({
  searchItems,
  villages,
  onSearchSelect,
  onVillageSelect,
  showTitle = true,
}: MapSearchProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const filteredSearchItems = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase();
    if (!query) return [];

    return searchItems
      .filter(
        (item) =>
          item.NOM_ETAB?.toLocaleLowerCase().includes(query) ||
          String(item.CODE_ETAB ?? "").toLocaleLowerCase().includes(query),
      )
      .slice(0, 20);
  }, [searchItems, searchQuery]);

  const filteredVillages = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase();
    if (!query) return [];

    return villages
      .filter((village) => village.name?.toLocaleLowerCase().includes(query))
      .slice(0, 20);
  }, [villages, searchQuery]);

  const hasResults =
    filteredSearchItems.length > 0 || filteredVillages.length > 0;

  const resetSearch = () => {
    setSearchQuery("");
    setIsSearchOpen(false);
  };

  return (
    <div className="w-full overflow-hidden rounded-lg border border-border bg-card shadow-sm">
      {showTitle && (
        <div className="border-b border-border bg-primary/5 px-3 py-2.5">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Search className="h-3.5 w-3.5 text-primary" />
            Recherches
          </h3>
        </div>
      )}

      <div className="space-y-2 p-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Établissement (nom/code) ou village..."
            value={searchQuery}
            onChange={(event) => {
              setSearchQuery(event.target.value);
              setIsSearchOpen(true);
            }}
            onFocus={() => setIsSearchOpen(true)}
            className="h-9 pl-9 pr-9"
            aria-label="Rechercher un établissement ou un village"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={resetSearch}
              aria-label="Effacer la recherche"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {isSearchOpen && searchQuery.trim() && (
          <div className="max-h-64 overflow-y-auto rounded-lg border border-border bg-background">
            {!hasResults ? (
              <div className="px-3 py-3 text-xs text-muted-foreground">
                Aucun établissement ou village trouvé pour « {searchQuery} ».
              </div>
            ) : (
              <>
                {filteredSearchItems.length > 0 && (
                  <div>
                    <div className="sticky top-0 border-b border-border bg-muted/80 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Établissements ({filteredSearchItems.length})
                    </div>
                    {filteredSearchItems.map((item, index) => (
                      <button
                        type="button"
                        key={`${String(item.CODE_ETAB)}-${index}`}
                        onClick={() => {
                          onSearchSelect(item);
                          resetSearch();
                        }}
                        className="flex w-full items-center gap-2 border-b border-border px-3 py-2 text-left transition-colors last:border-0 hover:bg-muted/50"
                      >
                        <MapPin className="h-3 w-3 shrink-0 text-primary" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-xs font-medium">
                            {item.NOM_ETAB || "Établissement sans nom"}
                          </span>
                          <span className="block text-[10px] text-muted-foreground">
                            Code : {item.CODE_ETAB}
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {filteredVillages.length > 0 && (
                  <div>
                    <div className="sticky top-0 border-b border-border bg-muted/80 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Villages ({filteredVillages.length})
                    </div>
                    {filteredVillages.map((village, index) => (
                      <button
                        type="button"
                        key={`${village.code_dren}-${village.code_cisco}-${village.name}-${index}`}
                        onClick={() => {
                          onVillageSelect(village);
                          resetSearch();
                        }}
                        className="flex w-full items-center gap-2 border-b border-border px-3 py-2 text-left transition-colors last:border-0 hover:bg-muted/50"
                      >
                        <MapPin className="h-3 w-3 shrink-0 text-emerald-600" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-xs font-medium">
                            {village.name}
                          </span>
                          <span className="block text-[10px] text-muted-foreground">
                            Village · Population : {village.population ?? "Non renseignée"}
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
