import { useState } from 'react';
import { HelpCircle, ChevronDown, MousePointerClick, Filter, Download, Search, Layers, Map as MapIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface HelpPanelProps {
  type: 'primaire' | 'college' | 'lycee' | 'sig';
}

const TIPS: Record<HelpPanelProps['type'], { title: string; items: { icon: React.ReactNode; label: string }[] }> = {
  primaire: {
    title: "Guide d'utilisation — ORS Primaire",
    items: [
      { icon: <Filter className="w-3.5 h-3.5" />, label: '1. Choisissez une DREN puis (optionnel) une CISCO, ajustez le rayon, puis cliquez « Appliquer ».' },
      { icon: <Layers className="w-3.5 h-3.5" />, label: '2. Cochez/décochez les couches : EPP publiques, privées, villages, nouvelle création.' },
      { icon: <MousePointerClick className="w-3.5 h-3.5" />, label: '3. Cliquez sur un point pour voir les détails (effectifs, salles, table-bancs).' },
      { icon: <MapIcon className="w-3.5 h-3.5" />, label: '4. Clic droit sur un village pour lancer une analyse d\'éligibilité.' },
      { icon: <Search className="w-3.5 h-3.5" />, label: '5. Recherchez un établissement par nom ou par code dans la barre de recherche.' },
      { icon: <Download className="w-3.5 h-3.5" />, label: '6. Téléchargez les données affichées au format CSV.' },
    ],
  },
  college: {
    title: "Guide d'utilisation — ORS Collège",
    items: [
      { icon: <Filter className="w-3.5 h-3.5" />, label: '1. Sélectionnez DREN/CISCO, ajustez le rayon de couverture du CEG, puis « Appliquer ».' },
      { icon: <Layers className="w-3.5 h-3.5" />, label: '2. Les EPP rouges (cerclées) sont HORS zone d\'un CEG → éligibles à un nouveau collège.' },
      { icon: <MousePointerClick className="w-3.5 h-3.5" />, label: '3. Cliquez sur un CEG pour voir l\'analyse d\'éligibilité (extension, reconstruction, réhabilitation).' },
      { icon: <Search className="w-3.5 h-3.5" />, label: '4. Recherche rapide par nom ou code établissement.' },
      { icon: <Download className="w-3.5 h-3.5" />, label: '5. Export CSV des données affichées.' },
    ],
  },
  lycee: {
    title: "Guide d'utilisation — ORS Lycée",
    items: [
      { icon: <Filter className="w-3.5 h-3.5" />, label: '1. Filtrez par DREN/CISCO, le rayon couvre la zone d\'attraction d\'un lycée.' },
      { icon: <MousePointerClick className="w-3.5 h-3.5" />, label: '2. Cliquez sur un lycée pour ses besoins (places, salles, table-bancs).' },
      { icon: <Layers className="w-3.5 h-3.5" />, label: '3. Activez la couche « Collèges existants » pour identifier les extensions possibles.' },
      { icon: <Download className="w-3.5 h-3.5" />, label: '4. Téléchargez l\'analyse au format CSV.' },
    ],
  },
  sig: {
    title: "Guide d'utilisation — SIG",
    items: [
      { icon: <Filter className="w-3.5 h-3.5" />, label: '1. Choisissez le niveau (Préscolaire, Primaire, Collège, Lycée) et la zone administrative.' },
      { icon: <MousePointerClick className="w-3.5 h-3.5" />, label: '2. Cliquez sur un point pour ouvrir la fiche complète de l\'établissement.' },
      { icon: <Layers className="w-3.5 h-3.5" />, label: '3. Changez de fond de carte (OSM, Imagery, Mapbox) via le contrôle en haut à droite.' },
      { icon: <Search className="w-3.5 h-3.5" />, label: '4. Utilisez la recherche pour zoomer directement sur un établissement.' },
    ],
  },
};

export const HelpPanel = ({ type }: HelpPanelProps) => {
  const [open, setOpen] = useState(false);
  const data = TIPS[type];

  return (
    <div className="bg-card border border-border rounded-lg shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-muted/40 transition-colors"
        aria-expanded={open}
      >
        <span className="text-sm font-semibold flex items-center gap-2">
          <HelpCircle className="w-4 h-4 text-primary" />
          Indications & aide
        </span>
        <ChevronDown className={cn('w-4 h-4 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="px-4 py-3 border-t border-border space-y-2 bg-muted/10">
          <h4 className="text-xs font-semibold text-foreground mb-2">{data.title}</h4>
          <ul className="space-y-2">
            {data.items.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground leading-relaxed">
                <span className="mt-0.5 text-primary flex-shrink-0">{item.icon}</span>
                <span>{item.label}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
