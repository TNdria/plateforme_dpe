import { MapPin } from "lucide-react";
import { ORS_COLORS, NIVEAU_MAIN_COLOR } from "./orsColors";
import { EtablissementIcon, SchoolLevelIcon } from "@/components/SchoolLevelIcon";

interface LegendItem {
  icon: React.ReactNode;
  label: string;
  color: string;
  bgColor?: string;
  description?: string;
}

interface MapLegendProps {
  type: "primaire" | "college" | "lycee" | "sig" | "dataviz";
  categoryFilter?: string;
}

// ============================================================
// LÉGENDE ORS PRIMAIRE
// ============================================================

const primaireLegendItems: LegendItem[] = [
  {
    icon: <SchoolLevelIcon level="primaire" className="h-4 w-4" style={{ color: ORS_COLORS.default }} />,
    label: "École Primaire Publique",
    color: ORS_COLORS.default,
    description: "EPP existant",
  },

  {
    icon: <SchoolLevelIcon level="primaire" className="h-4 w-4" style={{ color: ORS_COLORS.prive }} />,
    label: "École Primaire Privée",
    color: ORS_COLORS.prive,
    description: "Établissement privé",
  },

  {
    icon: (
      <i className="fas fa-check-circle w-4 text-center" style={{ color: ORS_COLORS.eligible }} />
    ),
    label: "Éligible (critère actif)",
    color: ORS_COLORS.eligible,
    description: "Nouvelle Création / Extension / Reconstruction / Réhabilitation",
  },

  {
    icon: (
      <i
        className="fas fa-times-circle w-4 text-center"
        style={{ color: ORS_COLORS.nonEligible }}
      />
    ),
    label: "Non éligible (critère actif)",
    color: ORS_COLORS.nonEligible,
    description: "Ne remplit pas le critère sélectionné",
  },

  {
    icon: (
      <EtablissementIcon type="village" className="h-4 w-4 shrink-0" style={{ color: ORS_COLORS.villageHorsZone }} />
    ),
    label: "Village hors zone",
    color: ORS_COLORS.villageHorsZone,
    description: "Au-delà du rayon EPP",
  },

  {
    icon: (
      <EtablissementIcon type="village" className="h-4 w-4 shrink-0" style={{ color: ORS_COLORS.villageCouvert }} />
    ),
    label: "Village couvert",
    color: ORS_COLORS.villageCouvert,
    description: "Dans le rayon d'une école",
  },

  // Limites : fa fa-square uniquement
  {
    icon: <span className="inline-block h-3 w-6 shrink-0 border-2 bg-transparent" style={{ borderColor: ORS_COLORS.limiteDren }} />,
    label: "Limite DREN",
    color: ORS_COLORS.limiteDren,
  },

  {
    icon: <span className="inline-block h-3 w-6 shrink-0 border-2 bg-transparent" style={{ borderColor: ORS_COLORS.limiteCisco }} />,
    label: "Limite CISCO",
    color: ORS_COLORS.limiteCisco,
  },

  {
    icon: <span className="inline-block h-3 w-6 shrink-0 border-2 bg-transparent" style={{ borderColor: "#c0c0c0" }} />,
    label: "Limite Commune",
    color: "#c0c0c0",
  },
];

// ============================================================
// LÉGENDE ORS COLLÈGE
// ============================================================

const collegeLegendItems: LegendItem[] = [
  {
    icon: (
      <SchoolLevelIcon level="college" className="h-5 w-5" style={{ color: NIVEAU_MAIN_COLOR.college }} />
    ),
    label: "CEG (Collège public)",
    color: NIVEAU_MAIN_COLOR.college,
    description: "Avec cercle de zone de couverture",
  },

  {
    icon: <SchoolLevelIcon level="primaire" className="h-4 w-4" style={{ color: ORS_COLORS.default }} />,
    label: "EPP dans zone CEG",
    color: ORS_COLORS.default,
    description: "École couverte par un CEG",
  },

  {
    icon: (
      <SchoolLevelIcon level="primaire" className="h-4 w-4" style={{ color: ORS_COLORS.nonEligible }} />
    ),
    label: "EPP HORS zone",
    color: ORS_COLORS.nonEligible,
    description: "Cerclée rouge → éligible nouveau CEG",
  },

  {
    icon: <SchoolLevelIcon level="primaire" className="h-4 w-4" style={{ color: ORS_COLORS.prive }} />,
    label: "École privée",
    color: ORS_COLORS.prive,
    description: "Hors analyse d'éligibilité",
  },

  {
    icon: (
      <EtablissementIcon type="village" className="h-4 w-4 shrink-0" style={{ color: ORS_COLORS.villageHorsZone }} />
    ),
    label: "Village hors zone",
    color: ORS_COLORS.villageHorsZone,
    description: "Hors de toute aire de recrutement",
  },

  {
    icon: (
      <EtablissementIcon type="village" className="h-4 w-4 shrink-0" style={{ color: ORS_COLORS.villageCouvert }} />
    ),
    label: "Village couvert",
    color: ORS_COLORS.villageCouvert,
    description: "Dans l'aire de recrutement d'un CEG",
  },

  // Limites : fa fa-square uniquement
  {
    icon: <span className="inline-block h-3 w-6 shrink-0 border-2 bg-transparent" style={{ borderColor: ORS_COLORS.limiteDren }} />,
    label: "Limite DREN",
    color: ORS_COLORS.limiteDren,
  },

  {
    icon: <span className="inline-block h-3 w-6 shrink-0 border-2 bg-transparent" style={{ borderColor: ORS_COLORS.limiteCisco }} />,
    label: "Limite CISCO",
    color: ORS_COLORS.limiteCisco,
  },

  {
    icon: <span className="inline-block h-3 w-6 shrink-0 border-2 bg-transparent" style={{ borderColor: "#c0c0c0" }} />,
    label: "Limite Commune",
    color: "#c0c0c0",
  },
];

// ============================================================
// LÉGENDE ORS LYCÉE
// ============================================================

const lyceeLegendItems: LegendItem[] = [
  {
    icon: (
      <SchoolLevelIcon level="lycee" className="h-5 w-5" style={{ color: NIVEAU_MAIN_COLOR.lycee }} />
    ),
    label: "Lycée public",
    color: NIVEAU_MAIN_COLOR.lycee,
    description: "Avec cercle de zone d'attraction",
  },

  {
    icon: <SchoolLevelIcon level="college" className="h-4 w-4" style={{ color: ORS_COLORS.default }} />,
    label: "Collège existant",
    color: ORS_COLORS.default,
    description: "CEG potentiel pour extension",
  },

  {
    icon: <SchoolLevelIcon level="college" className="h-4 w-4" style={{ color: ORS_COLORS.nonEligible }} />,
    label: "Collège HORS zone",
    color: ORS_COLORS.nonEligible,
    description: "Cerclé rouge → éligible nouveau lycée",
  },

  {
    icon: <SchoolLevelIcon level="lycee" className="h-4 w-4" style={{ color: ORS_COLORS.prive }} />,
    label: "Établissement privé",
    color: ORS_COLORS.prive,
  },

  {
    icon: (
      <EtablissementIcon type="village" className="h-4 w-4 shrink-0" style={{ color: ORS_COLORS.villageHorsZone }} />
    ),
    label: "Village hors zone",
    color: ORS_COLORS.villageHorsZone,
  },

  {
    icon: (
      <EtablissementIcon type="village" className="h-4 w-4 shrink-0" style={{ color: ORS_COLORS.villageCouvert }} />
    ),
    label: "Village couvert",
    color: ORS_COLORS.villageCouvert,
  },

  // Limites : fa fa-square uniquement
  {
    icon: <span className="inline-block h-3 w-6 shrink-0 border-2 bg-transparent" style={{ borderColor: ORS_COLORS.limiteDren }} />,
    label: "Limite DREN",
    color: ORS_COLORS.limiteDren,
  },

  {
    icon: <span className="inline-block h-3 w-6 shrink-0 border-2 bg-transparent" style={{ borderColor: ORS_COLORS.limiteCisco }} />,
    label: "Limite CISCO",
    color: ORS_COLORS.limiteCisco,
  },

  {
    icon: <span className="inline-block h-3 w-6 shrink-0 border-2 bg-transparent" style={{ borderColor: "#c0c0c0" }} />,
    label: "Limite Commune",
    color: "#c0c0c0",
  },
];

// ============================================================
// LÉGENDE SIG
// ============================================================

const sigLegendItems: LegendItem[] = [
  {
    icon: <SchoolLevelIcon level="prescolaire" className="h-4 w-4" style={{ color: "#8b5cf6" }} />,
    label: "Préscolaire Public",
    color: "#8b5cf6",
  },

  {
    icon: <SchoolLevelIcon level="primaire" className="h-4 w-4" style={{ color: "#36b9cc" }} />,
    label: "Primaire Public",
    color: "#36b9cc",
  },

  {
    icon: <SchoolLevelIcon level="college" className="h-4 w-4" style={{ color: "#22c55e" }} />,
    label: "Collège Public",
    color: "#22c55e",
  },

  {
    icon: <SchoolLevelIcon level="lycee" className="h-4 w-4" style={{ color: "#f59e0b" }} />,
    label: "Lycée Public",
    color: "#f59e0b",
  },

  {
    icon: <EtablissementIcon type="village" className="h-4 w-4 shrink-0" style={{ color: "#f6c23e" }} />,
    label: "Village",
    color: "#f6c23e",
  },
];

// ============================================================
// LÉGENDE DATAVIZ
// ============================================================

const datavizLegendItems: LegendItem[] = [
  {
    icon: <SchoolLevelIcon level="primaire" className="h-4 w-4" style={{ color: "#36b9cc" }} />,
    label: "École Publique",
    color: "#36b9cc",
  },

  {
    icon: <SchoolLevelIcon level="primaire" className="h-4 w-4" style={{ color: "#f6c23e" }} />,
    label: "École Privée",
    color: "#f6c23e",
  },

  {
    icon: <EtablissementIcon type="village" className="h-4 w-4 shrink-0" style={{ color: "#e74a3b" }} />,
    label: "Village",
    color: "#e74a3b",
  },
];

// ============================================================
// COMPOSANT MAP LEGEND
// ============================================================

export const MapLegend = ({ type, categoryFilter }: MapLegendProps) => {
  let items: LegendItem[];
  let title = "Légende";

  switch (type) {
    case "lycee":
      items = lyceeLegendItems;
      title = "Légende ORS Lycée";
      break;

    case "college":
      items = collegeLegendItems;
      title = "Légende ORS Collège";
      break;

    case "sig":
      items = sigLegendItems;
      title = "Légende SIG";
      break;

    case "dataviz":
      items = datavizLegendItems;
      title = "Établissements";
      break;

    default:
      items = primaireLegendItems;
      title = "Légende ORS Primaire";
  }

  // ==========================================================
  // FILTRAGE SELON LA CATÉGORIE SÉLECTIONNÉE
  // ==========================================================

  if (categoryFilter && categoryFilter !== "aucune") {
    const categoryItems = items.filter((item) => {
      const label = item.label.toLowerCase();

      switch (categoryFilter) {
        case "extension":
          return (
            label.includes("extension") ||
            label.includes("école") ||
            label.includes("collège") ||
            label.includes("lycée") ||
            label.includes("limite") ||
            label.includes("epp")
          );

        case "reconstruction":
          return (
            label.includes("reconstruction") ||
            label.includes("école") ||
            label.includes("collège") ||
            label.includes("lycée") ||
            label.includes("limite")
          );

        case "rehabilitation":
          return (
            label.includes("réhabilitation") ||
            label.includes("école") ||
            label.includes("collège") ||
            label.includes("lycée") ||
            label.includes("limite")
          );

        default:
          return true;
      }
    });

    if (categoryItems.length > 0) {
      items = categoryItems;
    }
  }

  // ==========================================================
  // RENDU
  // ==========================================================

  return (
    <div className="absolute bottom-4 right-4 bg-card/95 backdrop-blur-sm rounded-xl shadow-lg border border-border z-[1000] min-w-[200px] max-w-[280px]">
      {/* En-tête */}
      <div className="px-4 py-3 border-b border-border bg-primary/5 rounded-t-xl">
        <h4 className="font-semibold text-sm text-foreground flex items-center gap-2">
          <MapPin className="w-4 h-4 text-primary" />
          {title}
        </h4>
      </div>

      {/* Éléments de la légende */}
      <div className="p-3 space-y-2.5 max-h-[350px] overflow-y-auto">
        {items.map((item, index) => (
          <div
            key={index}
            className="flex items-center gap-3 p-1.5 rounded-lg hover:bg-muted/50 transition-colors"
          >
            <div className="flex-shrink-0">{item.icon}</div>

            <div className="flex-1 min-w-0">
              <span className="text-xs font-medium text-foreground block leading-tight">
                {item.label}
              </span>

              {item.description && (
                <span className="text-[10px] text-muted-foreground block leading-tight mt-0.5">
                  {item.description}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Footer avec info */}
      <div className="px-3 py-2 border-t border-border bg-muted/30 rounded-b-xl">
        <span className="text-[10px] text-muted-foreground">
          Cliquez sur un élément pour voir les détails
        </span>
      </div>
    </div>
  );
};
