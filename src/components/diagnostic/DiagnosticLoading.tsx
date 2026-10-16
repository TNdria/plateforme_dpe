import { useEffect, useState } from 'react';
import { AlertTriangle, Check, Database, Layers, RefreshCw, Sigma } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import logoMen from '@/assets/logoMen.jpg';

/**
 * Indicateur de chargement des données du diagnostic.
 * - overlay au-dessus de la zone de contenu (les filtres restent utilisables)
 * - étapes affichées pour informer l'utilisateur de ce qui se prépare
 * - état d'erreur avec relance possible
 */

const STEPS = [
  { label: 'Connexion à la base de données', icon: Database },
  { label: 'Agrégation des indicateurs FPE', icon: Layers },
  { label: 'Calcul des taux et ratios', icon: Sigma },
];

interface DiagnosticLoadingProps {
  loading: boolean;
  error?: string | null;
  scope?: string;
  annee?: string;
  onRetry?: () => void;
}

export const DiagnosticLoading = ({ loading, error, scope, annee, onRetry }: DiagnosticLoadingProps) => {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!loading) {
      setStep(0);
      return;
    }
    setStep(0);
    const id = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 1100);
    return () => clearInterval(id);
  }, [loading]);

  if (!loading && !error) return null;

  const failed = !!error && !loading;

  return (
    <div
      className="absolute inset-0 z-20 flex items-center justify-center bg-background/75 p-4 backdrop-blur-sm"
      role="status"
      aria-live="polite"
      aria-busy={loading}
    >
      <div className="w-[min(92%,430px)] animate-scale-in rounded-xl border border-border bg-card/95 p-6 shadow-xl">
        <div className="flex items-center gap-4">
          <div className="relative h-14 w-14 shrink-0">
            <span
              className={`absolute inset-0 rounded-full border-2 border-transparent ${
                failed ? 'border-destructive/60' : 'border-t-primary border-r-secondary/70 border-b-secondary/20 animate-spin'
              }`}
            />
            <img
              src={logoMen}
              alt=""
              aria-hidden="true"
              className="absolute inset-1.5 rounded-full bg-card object-contain p-1"
            />
          </div>
          <div className="min-w-0 leading-tight">
            <p className="text-sm font-bold uppercase tracking-wide text-primary">
              {failed ? 'Chargement impossible' : 'Chargement des données'}
            </p>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {failed
                ? 'La base de données n\'a pas répondu.'
                : `${scope || 'Niveau national'}${annee ? ` — année ${annee}` : ''}`}
            </p>
          </div>
        </div>

        {failed ? (
          <div className="mt-5 space-y-3">
            <p className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span className="break-words">{error}</span>
            </p>
            {onRetry && (
              <Button size="sm" variant="outline" onClick={onRetry} className="w-full gap-2">
                <RefreshCw className="h-4 w-4" />
                Réessayer
              </Button>
            )}
          </div>
        ) : (
          <>
            <ul className="mt-5 space-y-2">
              {STEPS.map((s, i) => {
                const Icon = s.icon;
                const done = i < step;
                const active = i === step;
                return (
                  <li
                    key={s.label}
                    className={`flex items-center gap-2 text-xs transition-colors ${
                      done ? 'text-secondary' : active ? 'text-foreground' : 'text-muted-foreground/60'
                    }`}
                  >
                    <span
                      className={`flex h-5 w-5 items-center justify-center rounded-full border transition-colors ${
                        done
                          ? 'border-secondary/50 bg-secondary/10'
                          : active
                            ? 'border-primary/50 bg-primary/10'
                            : 'border-border bg-muted/40'
                      }`}
                    >
                      {done ? (
                        <Check className="h-3 w-3" />
                      ) : active ? (
                        <Icon className="h-3 w-3 animate-pulse" />
                      ) : (
                        <Icon className="h-3 w-3 opacity-50" />
                      )}
                    </span>
                    <span className={active ? 'font-semibold' : ''}>{s.label}</span>
                  </li>
                );
              })}
            </ul>

            <div className="mt-4 h-1 w-full overflow-hidden rounded-full bg-muted">
              <span className="block h-full w-1/4 rounded-full bg-primary animate-route-progress" />
            </div>
            <p className="mt-2 text-[10px] text-muted-foreground/70">
              Agrégation des indicateurs pluriannuels — veuillez patienter.
            </p>
          </>
        )}
      </div>
    </div>
  );
};

/** Remplace la ligne de KPI le temps que les données arrivent. */
export const KpiSkeletonRow = () => (
  <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-5" aria-hidden="true">
    {['Établissements', 'Salles de classe', 'Élèves', 'Enseignants', 'TBS Primaire'].map((l) => (
      <div key={l} className="rounded-lg border border-border bg-card p-3 pl-4 shadow-sm">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="mt-2 h-6 w-16" />
        <Skeleton className="mt-1.5 h-2.5 w-20" />
      </div>
    ))}
  </div>
);

export default DiagnosticLoading;
