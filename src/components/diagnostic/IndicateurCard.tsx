import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface IndicateurCardProps {
  nom: string;
  valeur: number | null | undefined;
  unite: '%' | 'ratio' | 'nombre';
  evolution?: number;
  interpretation?: 'bon' | 'moyen' | 'mauvais';
  description?: string;
  compact?: boolean;
}

const IndicateurCard = ({
  nom,
  valeur,
  unite,
  evolution,
  interpretation = 'moyen',
  description,
  compact = false,
}: IndicateurCardProps) => {
  const formatValue = (val: number | null | undefined) => {
    if (val === null || val === undefined) return 'N/A';
    if (unite === '%') return `${val.toFixed(1)}%`;
    if (unite === 'ratio') return val.toFixed(1);
    return new Intl.NumberFormat('fr-FR').format(val);
  };

  const getInterpretationStyles = () => {
    switch (interpretation) {
      case 'bon':
        return {
          bg: 'bg-green-500/10 border-green-500/20',
          text: 'text-green-600',
          icon: <CheckCircle className="w-4 h-4 text-green-500" />,
        };
      case 'mauvais':
        return {
          bg: 'bg-red-500/10 border-red-500/20',
          text: 'text-red-600',
          icon: <AlertTriangle className="w-4 h-4 text-red-500" />,
        };
      default:
        return {
          bg: 'bg-yellow-500/10 border-yellow-500/20',
          text: 'text-yellow-600',
          icon: <AlertCircle className="w-4 h-4 text-yellow-500" />,
        };
    }
  };

  const styles = getInterpretationStyles();

  if (compact) {
    return (
      <div className={cn('p-3 rounded-lg border', styles.bg)}>
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-muted-foreground truncate">{nom}</span>
          {styles.icon}
        </div>
        <div className={cn('text-lg font-bold mt-1', styles.text)}>
          {formatValue(valeur)}
        </div>
        {evolution !== undefined && (
          <div className="flex items-center gap-1 mt-1">
            {evolution > 0 ? (
              <TrendingUp className="w-3 h-3 text-green-500" />
            ) : evolution < 0 ? (
              <TrendingDown className="w-3 h-3 text-red-500" />
            ) : (
              <Minus className="w-3 h-3 text-muted-foreground" />
            )}
            <span className={cn('text-xs', evolution > 0 ? 'text-green-500' : evolution < 0 ? 'text-red-500' : 'text-muted-foreground')}>
              {evolution > 0 ? '+' : ''}{evolution?.toFixed(1)}%
            </span>
          </div>
        )}
      </div>
    );
  }

  return (
    <Card className={cn('border', styles.bg)}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <p className="text-sm font-medium text-muted-foreground">{nom}</p>
            <p className={cn('text-2xl font-bold mt-1', styles.text)}>
              {formatValue(valeur)}
            </p>
            {description && (
              <p className="text-xs text-muted-foreground mt-2">{description}</p>
            )}
          </div>
          <div className="flex flex-col items-end gap-2">
            {styles.icon}
            {evolution !== undefined && (
              <div className="flex items-center gap-1">
                {evolution > 0 ? (
                  <TrendingUp className="w-4 h-4 text-green-500" />
                ) : evolution < 0 ? (
                  <TrendingDown className="w-4 h-4 text-red-500" />
                ) : (
                  <Minus className="w-4 h-4 text-muted-foreground" />
                )}
                <span className={cn('text-sm font-medium', evolution > 0 ? 'text-green-500' : evolution < 0 ? 'text-red-500' : 'text-muted-foreground')}>
                  {evolution > 0 ? '+' : ''}{evolution?.toFixed(1)}%
                </span>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default IndicateurCard;
