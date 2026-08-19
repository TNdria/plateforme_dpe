import { MapPin } from "lucide-react";
import { ORS_COLORS, NIVEAU_MAIN_COLOR } from "./orsColors";

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

// NB (audit du 19/08/2026) : ce composant est désactivé pour les 3 pages ORS
// (showLegend={false} dans ORSMap.tsx — la légende réellement affichée est
// `getLegendItems()` dans ORS.tsx, seule source de vérité pour ces pages).
// Il reste utilisé tel quel pour "sig"/"dataviz". Les tableaux
// primaire/college/lycee ci-dessous sont donc du code mort pour l'instant,
// mais on les garde exacts (et alignés sur ORS_COLORS/NIVEAU_MAIN_COLOR, la
// même source que ORSMap.tsx/ORS.tsx) pour qu'une réactivation future ne
// réintroduise pas silencieusement les incohérences détectées lors de
// l'audit (CEG annoncé en cyan alors que rendu en vert, école privée avec
// une couleur d'icône différente de la couleur déclarée dans le même objet).

// Légende pour ORS Primaire avec icônes visuelles
const primaireLegendItems: LegendItem[] = [
  {
    icon: <i className="fas fa-book-open w-4 text-center" style={{ color: ORS_COLORS.default }} />,
    label: "École Primaire Publique",
    color: ORS_COLORS.default,
    description: "EPP existant",
  },
  {
    icon: <i className="fas fa-book-open w-4 text-center" style={{ color: ORS_COLORS.prive }} />,
    label: "École Primaire Privée",
    color: ORS_COLORS.prive,
    description: "Établissement privé",
  },
  {
    icon: (
      <div
        className="w-4 h-4 rounded-full"
        style={{ backgroundColor: ORS_COLORS.reconstruction }}
      />
    ),
    label: "Reconstruction",
    color: ORS_COLORS.reconstruction,
    description: "Bâtiment à reconstruire",
  },
  {
    icon: (
      <div className="w-4 h-4 rounded-full" style={{ backgroundColor: ORS_COLORS.extension }} />
    ),
    label: "Extension",
    color: ORS_COLORS.extension,
    description: "Salles supplémentaires",
  },
  {
    icon: (
      <div
        className="w-4 h-4 rounded-full"
        style={{ backgroundColor: ORS_COLORS.rehabilitation }}
      />
    ),
    label: "Réhabilitation",
    color: ORS_COLORS.rehabilitation,
    description: "Travaux nécessaires",
  },
  {
    icon: <div className="w-4 h-4 rounded-full" style={{ backgroundColor: ORS_COLORS.conforme }} />,
    label: "Conforme / Zone couverte",
    color: ORS_COLORS.conforme,
    description: "Accès satisfaisant",
  },
  {
    icon: (
      <div
        className="w-3 h-3 rounded-full"
        style={{ backgroundColor: ORS_COLORS.villageHorsZone }}
      />
    ),
    label: "Village hors zone",
    color: ORS_COLORS.villageHorsZone,
    description: "Au-delà du rayon EPP",
  },
  {
    icon: (
      <div
        className="w-2.5 h-2.5 rounded-full border"
        style={{ borderColor: ORS_COLORS.villageCouvert, backgroundColor: "#FFFFFF" }}
      />
    ),
    label: "Village couvert",
    color: ORS_COLORS.villageCouvert,
    description: "Dans le rayon d'une école",
  },
  {
    icon: <div className="w-6 h-1 rounded" style={{ backgroundColor: ORS_COLORS.limiteDren }} />,
    label: "Limite DREN",
    color: ORS_COLORS.limiteDren,
  },
  {
    icon: <div className="w-6 h-1 rounded" style={{ backgroundColor: ORS_COLORS.limiteCisco }} />,
    label: "Limite CISCO",
    color: ORS_COLORS.limiteCisco,
  },
  {
    icon: <div className="w-6 h-1 rounded" style={{ backgroundColor: "#c0c0c0" }} />,
    label: "Limite Commune",
    color: "#c0c0c0",
  },
];

// Légende pour ORS Collège — alignée sur les couleurs RÉELLES de ORSMap.tsx
// (ORS_COLORS / NIVEAU_MAIN_COLOR, importées ci-dessus)
const collegeLegendItems: LegendItem[] = [
  {
    icon: (
      <i className="fas fa-school w-5 text-center" style={{ color: NIVEAU_MAIN_COLOR.college }} />
    ),
    label: "CEG (Collège public)",
    color: NIVEAU_MAIN_COLOR.college,
    description: "Avec cercle de zone de couverture",
  },
  {
    icon: <i className="fas fa-book-open w-4 text-center" style={{ color: ORS_COLORS.default }} />,
    label: "EPP dans zone CEG",
    color: ORS_COLORS.default,
    description: "École couverte par un CEG",
  },
  {
    icon: (
      <i
        className="fas fa-book-open w-4 text-center"
        style={{ color: ORS_COLORS.horsZoneEligible }}
      />
    ),
    label: "EPP HORS zone",
    color: ORS_COLORS.horsZoneEligible,
    description: "Cerclée rouge → éligible nouveau CEG",
  },
  {
    icon: <i className="fas fa-book-open w-4 text-center" style={{ color: ORS_COLORS.prive }} />,
    label: "École privée",
    color: ORS_COLORS.prive,
    description: "Hors analyse d'éligibilité",
  },
  {
    icon: <i className="fas fa-home w-4 text-center" style={{ color: ORS_COLORS.villageAutre }} />,
    label: "Village",
    color: ORS_COLORS.villageAutre,
    description: "Population cible",
  },
  {
    icon: <div className="w-6 h-1 rounded" style={{ backgroundColor: ORS_COLORS.limiteDren }} />,
    label: "Limite DREN",
    color: ORS_COLORS.limiteDren,
  },
  {
    icon: <div className="w-6 h-1 rounded" style={{ backgroundColor: ORS_COLORS.limiteCisco }} />,
    label: "Limite CISCO",
    color: ORS_COLORS.limiteCisco,
  },
  {
    icon: <div className="w-6 h-1 rounded" style={{ backgroundColor: "#c0c0c0" }} />,
    label: "Limite Commune",
    color: "#c0c0c0",
  },
];

// Légende pour ORS Lycée — alignée sur ORSMap.tsx (lycées violet, collèges cyan)
const lyceeLegendItems: LegendItem[] = [
  {
    icon: (
      <i className="fas fa-building w-5 text-center" style={{ color: NIVEAU_MAIN_COLOR.lycee }} />
    ),
    label: "Lycée public",
    color: NIVEAU_MAIN_COLOR.lycee,
    description: "Avec cercle de zone d'attraction",
  },
  {
    icon: <i className="fas fa-school w-4 text-center" style={{ color: ORS_COLORS.default }} />,
    label: "Collège existant",
    color: ORS_COLORS.default,
    description: "CEG potentiel pour extension",
  },
  {
    icon: (
      <i className="fas fa-school w-4 text-center" style={{ color: ORS_COLORS.horsZoneEligible }} />
    ),
    label: "Collège HORS zone",
    color: ORS_COLORS.horsZoneEligible,
    description: "Cerclé rouge → éligible nouveau lycée",
  },
  {
    icon: <i className="fas fa-school w-4 text-center" style={{ color: ORS_COLORS.prive }} />,
    label: "Établissement privé",
    color: ORS_COLORS.prive,
  },
  {
    icon: <i className="fas fa-home w-4 text-center" style={{ color: ORS_COLORS.villageAutre }} />,
    label: "Village",
    color: ORS_COLORS.villageAutre,
  },
  {
    icon: <div className="w-6 h-1 rounded" style={{ backgroundColor: ORS_COLORS.limiteDren }} />,
    label: "Limite DREN",
    color: ORS_COLORS.limiteDren,
  },
  {
    icon: <div className="w-6 h-1 rounded" style={{ backgroundColor: "#22afbe" }} />,
    label: "Limite CISCO",
    color: "#22afbe",
  },
];

// Légende pour SIG
// NB (audit du 19/08/2026) : #8b5cf6 (violet) désigne ici "Préscolaire",
// alors que le même hex désigne "Lycée" côté ORS (NIVEAU_MAIN_COLOR.lycee) —
// collision de sens cross-module repérée lors de l'audit. Non corrigée ici
// faute d'accès à SIG.tsx pour vérifier les couleurs RÉELLEMENT rendues par
// ce module (le principe de l'audit est de ne jamais corriger une légende
// sans avoir vérifié le code qui dessine réellement les marqueurs). À
// reprendre si SIG.tsx est fourni.
const sigLegendItems: LegendItem[] = [
  {
    icon: <i className="fas fa-book-open w-4 text-center" style={{ color: "#8b5cf6" }} />,
    label: "Préscolaire Public",
    color: "#8b5cf6",
  },
  {
    icon: <i className="fas fa-book-open w-4 text-center" style={{ color: "#36b9cc" }} />,
    label: "Primaire Public",
    color: "#36b9cc",
  },
  {
    icon: <i className="fas fa-school w-4 text-center" style={{ color: "#22c55e" }} />,
    label: "Collège Public",
    color: "#22c55e",
  },
  {
    icon: <i className="fas fa-building w-4 text-center" style={{ color: "#f59e0b" }} />,
    label: "Lycée Public",
    color: "#f59e0b",
  },
  {
    icon: <i className="fas fa-home w-4 text-center" style={{ color: "#f6c23e" }} />,
    label: "Village",
    color: "#f6c23e",
  },
];

// Légende pour DataViz
const datavizLegendItems: LegendItem[] = [
  {
    icon: <i className="fas fa-book-open w-4 text-center" style={{ color: "#36b9cc" }} />,
    label: "École Publique",
    color: "#36b9cc",
  },
  {
    icon: <i className="fas fa-school w-4 text-center" style={{ color: "#f6c23e" }} />,
    label: "École Privée",
    color: "#f6c23e",
  },
  {
    icon: <i className="fas fa-home w-4 text-center" style={{ color: "#e74a3b" }} />,
    label: "Village",
    color: "#e74a3b",
  },
];

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

  // Filtrer les items selon la catégorie sélectionnée
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
        case "tablebanc":
          return (
            label.includes("table") ||
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

  return (
    <div className="absolute bottom-4 right-4 bg-card/95 backdrop-blur-sm rounded-xl shadow-lg border border-border z-[1000] min-w-[200px] max-w-[280px]">
      <div className="px-4 py-3 border-b border-border bg-primary/5 rounded-t-xl">
        <h4 className="font-semibold text-sm text-foreground flex items-center gap-2">
          <MapPin className="w-4 h-4 text-primary" />
          {title}
        </h4>
      </div>
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
