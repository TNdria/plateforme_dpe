import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LucideIcon } from 'lucide-react';
import IndicateurCard from './IndicateurCard';
import { cn } from '@/lib/utils';

interface Indicateur {
  id: string;
  nom: string;
  valeur: number | null | undefined;
  unite: '%' | 'ratio' | 'nombre';
  evolution?: number;
  interpretation?: 'bon' | 'moyen' | 'mauvais';
  description?: string;
}

interface CategorieIndicateursProps {
  titre: string;
  description?: string;
  icon: LucideIcon;
  indicateurs: Indicateur[];
  colorClass?: string;
  compact?: boolean;
}

const CategorieIndicateurs = ({
  titre,
  description,
  icon: Icon,
  indicateurs,
  colorClass = 'text-primary',
  compact = false,
}: CategorieIndicateursProps) => {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className={cn('p-2 rounded-lg', colorClass.replace('text-', 'bg-') + '/10')}>
            <Icon className={cn('w-5 h-5', colorClass)} />
          </div>
          <div>
            <CardTitle className="text-base">{titre}</CardTitle>
            {description && (
              <p className="text-sm text-muted-foreground mt-1">{description}</p>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className={cn('grid gap-3', compact ? 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3')}>
          {indicateurs.map((ind) => (
            <IndicateurCard
              key={ind.id}
              nom={ind.nom}
              valeur={ind.valeur}
              unite={ind.unite}
              evolution={ind.evolution}
              interpretation={ind.interpretation}
              description={compact ? undefined : ind.description}
              compact={compact}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default CategorieIndicateurs;
