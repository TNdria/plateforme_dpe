import { School, Circle, MapPin, Home, Building2 } from 'lucide-react';

interface LegendItem {
  icon: React.ReactNode;
  label: string;
  color: string;
  bgColor?: string;
  description?: string;
}

interface MapLegendProps {
  type: 'primaire' | 'college' | 'lycee' | 'sig' | 'dataviz';
  categoryFilter?: string;
}

// Légende pour ORS Primaire avec icônes visuelles
const primaireLegendItems: LegendItem[] = [
  { 
    icon: <div className="w-4 h-4 rounded-full border-2" style={{ borderColor: '#36b9cc', backgroundColor: 'rgba(54, 185, 204, 0.3)' }} />, 
    label: 'École Primaire Publique', 
    color: '#36b9cc',
    description: 'EPP existant'
  },
  { 
    icon: <div className="w-4 h-4 rounded-full border-2" style={{ borderColor: '#f6c23e', backgroundColor: 'rgba(246, 194, 62, 0.3)' }} />, 
    label: 'École Primaire Privée', 
    color: '#f6c23e',
    description: 'Établissement privé'
  },
  { 
    icon: <div className="w-4 h-4 rounded-full" style={{ backgroundColor: '#8b5cf6' }} />, 
    label: 'Nouvelle création', 
    color: '#8b5cf6',
    description: 'Établissement à créer'
  },
  { 
    icon: <div className="w-4 h-4 rounded-full" style={{ backgroundColor: '#dc2626' }} />, 
    label: 'Reconstruction', 
    color: '#dc2626',
    description: 'Bâtiment à reconstruire'
  },
  { 
    icon: <div className="w-4 h-4 rounded-full" style={{ backgroundColor: '#f97316' }} />, 
    label: 'Extension', 
    color: '#f97316',
    description: 'Salles supplémentaires'
  },
  { 
    icon: <div className="w-4 h-4 rounded-full" style={{ backgroundColor: '#eab308' }} />, 
    label: 'Réhabilitation', 
    color: '#eab308',
    description: 'Travaux nécessaires'
  },
  { 
    icon: <div className="w-4 h-4 rounded-full" style={{ backgroundColor: '#16a34a' }} />, 
    label: 'Conforme / Zone couverte', 
    color: '#16a34a',
    description: 'Accès satisfaisant'
  },
  {
    icon: <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#FF0000' }} />,
    label: 'Village hors zone',
    color: '#FF0000',
    description: 'Au-delà du rayon EPP',
  },
  {
    icon: <div className="w-2.5 h-2.5 rounded-full border" style={{ borderColor: '#888', backgroundColor: '#FFFFFF' }} />,
    label: 'Village couvert',
    color: '#888',
    description: 'Dans le rayon d\'une école',
  },
  {
    icon: <div className="w-6 h-1 rounded" style={{ backgroundColor: '#4e73df' }} />,
    label: 'Limite DREN',
    color: '#4e73df',
  },
  {
    icon: <div className="w-6 h-1 rounded" style={{ backgroundColor: '#22afbe' }} />,
    label: 'Limite CISCO',
    color: '#22afbe',
  },
  {
    icon: <div className="w-6 h-1 rounded" style={{ backgroundColor: '#c0c0c0' }} />,
    label: 'Limite Commune',
    color: '#c0c0c0',
  },
];

// Légende pour ORS Collège — alignée sur les couleurs RÉELLES de ORSMap.tsx
const collegeLegendItems: LegendItem[] = [
  {
    icon: <div className="w-5 h-5 rounded-full border-2" style={{ borderColor: 'green', backgroundColor: 'rgba(0, 128, 0, 0.15)' }} />,
    label: 'CEG (Collège public)',
    color: 'green',
    description: 'Avec cercle de zone de couverture',
  },
  {
    icon: <div className="w-4 h-4 rounded-full" style={{ backgroundColor: '#36b9cc' }} />,
    label: 'EPP dans zone CEG',
    color: '#36b9cc',
    description: 'École couverte par un CEG',
  },
  {
    icon: <div className="w-4 h-4 rounded-full border-2" style={{ borderColor: '#dc2626', backgroundColor: '#36b9cc' }} />,
    label: 'EPP HORS zone',
    color: '#dc2626',
    description: 'Cerclée rouge → éligible nouveau CEG',
  },
  {
    icon: <div className="w-4 h-4 rounded-full border" style={{ borderColor: '#888', backgroundColor: '#ffffcc' }} />,
    label: 'École privée',
    color: '#ffffcc',
    description: 'Hors analyse d\'éligibilité',
  },
  {
    icon: <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#e74a3b' }} />,
    label: 'Village',
    color: '#e74a3b',
    description: 'Population cible',
  },
  {
    icon: <div className="w-6 h-1 rounded" style={{ backgroundColor: '#4e73df' }} />,
    label: 'Limite DREN',
    color: '#4e73df',
  },
  {
    icon: <div className="w-6 h-1 rounded" style={{ backgroundColor: '#22afbe' }} />,
    label: 'Limite CISCO',
    color: '#22afbe',
  },
  {
    icon: <div className="w-6 h-1 rounded" style={{ backgroundColor: '#c0c0c0' }} />,
    label: 'Limite Commune',
    color: '#c0c0c0',
  },
];

// Légende pour ORS Lycée — alignée sur ORSMap.tsx (lycées violet, collèges cyan)
const lyceeLegendItems: LegendItem[] = [
  {
    icon: <div className="w-5 h-5 rounded-full border-2" style={{ borderColor: '#8b5cf6', backgroundColor: 'rgba(139, 92, 246, 0.2)' }} />,
    label: 'Lycée public',
    color: '#8b5cf6',
    description: 'Avec cercle de zone d\'attraction',
  },
  {
    icon: <div className="w-4 h-4 rounded-full" style={{ backgroundColor: '#36b9cc' }} />,
    label: 'Collège existant',
    color: '#36b9cc',
    description: 'CEG potentiel pour extension',
  },
  {
    icon: <div className="w-4 h-4 rounded-full border" style={{ borderColor: '#888', backgroundColor: '#ffffcc' }} />,
    label: 'Établissement privé',
    color: '#ffffcc',
  },
  {
    icon: <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#e74a3b' }} />,
    label: 'Village',
    color: '#e74a3b',
  },
  {
    icon: <div className="w-6 h-1 rounded" style={{ backgroundColor: '#4e73df' }} />,
    label: 'Limite DREN',
    color: '#4e73df',
  },
  {
    icon: <div className="w-6 h-1 rounded" style={{ backgroundColor: '#22afbe' }} />,
    label: 'Limite CISCO',
    color: '#22afbe',
  },
];

// Légende pour SIG
const sigLegendItems: LegendItem[] = [
  { 
    icon: <div className="w-4 h-4 rounded-full" style={{ backgroundColor: '#8b5cf6' }} />, 
    label: 'Préscolaire Public', 
    color: '#8b5cf6' 
  },
  { 
    icon: <div className="w-4 h-4 rounded-full" style={{ backgroundColor: '#36b9cc' }} />, 
    label: 'Primaire Public', 
    color: '#36b9cc' 
  },
  { 
    icon: <div className="w-4 h-4 rounded-full" style={{ backgroundColor: '#22c55e' }} />, 
    label: 'Collège Public', 
    color: '#22c55e' 
  },
  { 
    icon: <div className="w-4 h-4 rounded-full" style={{ backgroundColor: '#f59e0b' }} />, 
    label: 'Lycée Public', 
    color: '#f59e0b' 
  },
  { 
    icon: <div className="w-4 h-4 rounded-full" style={{ backgroundColor: '#f6c23e' }} />, 
    label: 'Établissement Privé', 
    color: '#f6c23e' 
  },
];

// Légende pour DataViz
const datavizLegendItems: LegendItem[] = [
  { 
    icon: <div className="w-4 h-4 rounded-full" style={{ backgroundColor: '#36b9cc' }} />, 
    label: 'École Publique', 
    color: '#36b9cc' 
  },
  { 
    icon: <div className="w-4 h-4 rounded-full" style={{ backgroundColor: '#f6c23e' }} />, 
    label: 'École Privée', 
    color: '#f6c23e' 
  },
];

export const MapLegend = ({ type, categoryFilter }: MapLegendProps) => {
  let items: LegendItem[];
  let title = 'Légende';

  switch (type) {
    case 'lycee':
      items = lyceeLegendItems;
      title = 'Légende ORS Lycée';
      break;
    case 'college':
      items = collegeLegendItems;
      title = 'Légende ORS Collège';
      break;
    case 'sig':
      items = sigLegendItems;
      title = 'Légende SIG';
      break;
    case 'dataviz':
      items = datavizLegendItems;
      title = 'Établissements';
      break;
    default:
      items = primaireLegendItems;
      title = 'Légende ORS Primaire';
  }

  // Filtrer les items selon la catégorie sélectionnée
  if (categoryFilter && categoryFilter !== 'aucune') {
    const categoryItems = items.filter(item => {
      const label = item.label.toLowerCase();
      switch (categoryFilter) {
        case 'extension':
          return label.includes('extension') || label.includes('école') || label.includes('collège') || label.includes('lycée') || label.includes('limite') || label.includes('epp');
        case 'reconstruction':
          return label.includes('reconstruction') || label.includes('école') || label.includes('collège') || label.includes('lycée') || label.includes('limite');
        case 'rehabilitation':
          return label.includes('réhabilitation') || label.includes('école') || label.includes('collège') || label.includes('lycée') || label.includes('limite');
        case 'tablebanc':
          return label.includes('table') || label.includes('école') || label.includes('collège') || label.includes('lycée') || label.includes('limite');
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
            <div className="flex-shrink-0">
              {item.icon}
            </div>
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
