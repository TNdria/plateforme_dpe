import { ReactNode } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Loader2, FileDown, Eye, Printer, Upload, Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import logoMen from '@/assets/logoMen.jpg';
import logoDpe from '@/assets/logoDpe.jpg';
import { useAuth } from '@/contexts/AuthContext';

export interface TDBTab {
  value: string;
  label: string;
  icon?: ReactNode;
  content: ReactNode;
}

interface TDBShellProps {
  /** Niveau du TDB: DREN | CISCO | ZAP | ÉCOLE */
  level: 'DREN' | 'CISCO' | 'ZAP' | 'ÉCOLE';
  /** Cycle pour le titre: PRIMAIRE | COLLÈGE | LYCÉE */
  cycle?: 'PRIMAIRE' | 'COLLÈGE' | 'LYCÉE';
  /** Titre principal personnalisé (sinon généré automatiquement) */
  title?: string;
  /** Identifiant (ex: nom DREN, code) */
  entityName?: string;
  entityCode?: string | number;
  /** Année scolaire affichée */
  annee?: string;
  /** Filtres en haut (selects) */
  filters: ReactNode;
  /** Bouton(s) d'action principal (Appliquer, etc.) */
  primaryAction?: ReactNode;
  /** Onglets de contenu */
  tabs: TDBTab[];
  defaultTab?: string;
  /** Indique si on a des données chargées (sinon on affiche un état vide) */
  hasData?: boolean;
  loading?: boolean;
  /** Callbacks PDF / Aperçu / Impression / Import CSV */
  onDownloadPdf?: () => void;
  onPreviewPdf?: () => void;
  onPrint?: () => void;
  onImportCsv?: () => void;
  generatingPdf?: boolean;
  generatingPreview?: boolean;
  /** Score Y optionnel à afficher dans l'en-tête */
  scoreSlot?: ReactNode;
  /** Masquer la barre d'identification + légende (utile si le contenu inclut déjà son propre en-tête) */
  hideIdentificationBar?: boolean;
}

const COLOR_LEGEND = [
  { color: '#7CB5EC', label: 'Données manquantes' },
  { color: '#ffff00', label: 'À vérifier' },
  { color: 'rgba(255,0,0,0.75)', label: 'Attention' },
];

export function TDBShell({
  level,
  cycle = 'PRIMAIRE',
  title,
  entityName,
  entityCode,
  annee,
  filters,
  primaryAction,
  tabs,
  defaultTab,
  hasData = false,
  loading = false,
  onDownloadPdf,
  onPreviewPdf,
  onPrint,
  onImportCsv,
  generatingPdf = false,
  generatingPreview = false,
  scoreSlot,
  hideIdentificationBar = false,
}: TDBShellProps) {
  const { user } = useAuth();
  const isAdmin = !!user?.is_superuser || !!user?.is_staff;
  const computedTitle = title ?? `Tableau de Bord ${cycle} — ${level}`;

  return (
    <TooltipProvider>
      <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-br from-muted/40 via-background to-muted/30">
        {/* === Hero header (sticky toolbar) === */}
        <div className="sticky top-0 z-30 border-b shadow-md bg-gradient-to-r from-primary/90 via-primary to-primary/80 text-primary-foreground supports-[backdrop-filter]:from-primary/85 supports-[backdrop-filter]:via-primary/95 supports-[backdrop-filter]:to-primary/75 backdrop-blur">
          <div className="mx-auto max-w-none px-4 py-3">
            <div className="flex flex-wrap items-center gap-3">
              {/* Logos */}
              <div className="flex items-center gap-2 shrink-0">
                <img src={logoMen} alt="MEN" className="h-10 w-10 rounded-md object-contain ring-1 ring-white/40 bg-white p-0.5 shadow-sm" />
                <img src={logoDpe} alt="DPE" className="h-10 w-10 rounded-md object-contain ring-1 ring-white/40 bg-white p-0.5 shadow-sm" />
              </div>

              {/* Titre */}
              <div className="flex-1 min-w-[220px]">
                <h1 className="text-base sm:text-lg font-bold leading-tight text-primary-foreground drop-shadow-sm">{computedTitle}</h1>
                <p className="text-xs text-primary-foreground/80">
                  Ministère de l'Éducation Nationale
                  {annee && <> · Année scolaire <strong className="text-primary-foreground">{annee}</strong></>}
                </p>
              </div>

              {/* Score Y */}
              {scoreSlot && <div className="shrink-0">{scoreSlot}</div>}

              {/* Actions */}
              <div className="flex flex-wrap items-center gap-2">
                {onDownloadPdf && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button size="sm" variant="secondary" onClick={onDownloadPdf} disabled={!hasData || generatingPdf} className="bg-white text-primary hover:bg-white/90 shadow">
                        {generatingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
                        <span className="hidden sm:inline">Télécharger PDF</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Export A3 portrait fidèle au format ministériel</TooltipContent>
                  </Tooltip>
                )}
                {onPrint && !isAdmin && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button size="sm" variant="outline" onClick={onPrint} disabled={!hasData} className="bg-white/10 text-primary-foreground border-white/40 hover:bg-white/20 hover:text-primary-foreground">
                        <Printer className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Imprimer</TooltipContent>
                  </Tooltip>
                )}
                {/* Import CSV bouton retiré : centralisé sur la page Administration */}
              </div>
            </div>

            {/* Identification (gauche) + légende (droite) — étirés sur toute la largeur */}
            {!hideIdentificationBar && (
            <div className="mt-2 flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-white/20 pt-2 text-xs">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="inline-flex items-center gap-1 rounded-md bg-white/20 px-2 py-0.5 font-semibold text-primary-foreground ring-1 ring-white/30">
                  {level}
                </span>
                {entityName && (
                  <span className="text-primary-foreground">
                    <strong>{entityName}</strong>
                    {entityCode != null && entityCode !== '0' && (
                      <span className="ml-1 text-primary-foreground/75">· Code {entityCode}</span>
                    )}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                {COLOR_LEGEND.map((l) => (
                  <span key={l.label} className="inline-flex items-center gap-1.5 text-primary-foreground/85">
                    <span
                      className="inline-block h-3 w-3 rounded-sm ring-1 ring-white/40"
                      style={{ background: l.color }}
                    />
                    {l.label}
                  </span>
                ))}
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-3.5 w-3.5 text-primary-foreground/80" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-[260px] text-xs">
                    Le code couleur signale les zones nécessitant une attention. Survolez les cellules pour plus de détails.
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
            )}
          </div>
        </div>

        {/* === Filtres === */}
        <div className="mx-auto max-w-none px-4 pt-4">
          <Card className="p-3 shadow-sm">
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex flex-wrap items-end gap-3 flex-1">{filters}</div>
              {primaryAction && <div className="shrink-0">{primaryAction}</div>}
            </div>
          </Card>
        </div>

        {/* === Contenu === */}
        <div className="mx-auto max-w-none px-4 py-4">
          {loading ? (
            <Card className="flex h-64 items-center justify-center">
              <div className="text-center">
                <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
                <p className="mt-3 text-sm text-muted-foreground">Chargement du tableau de bord…</p>
              </div>
            </Card>
          ) : !hasData ? (
            <Card className="flex h-64 items-center justify-center border-dashed">
              <div className="text-center max-w-md px-4">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                  <Info className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-base font-semibold text-foreground">Sélectionnez les filtres</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Choisissez les paramètres ci-dessus puis cliquez sur <strong>Appliquer</strong> pour générer le tableau de bord.
                </p>
              </div>
            </Card>
          ) : (
            <Tabs defaultValue={defaultTab ?? tabs[0]?.value} className="w-full">
              <TabsList className="w-full justify-start overflow-x-auto bg-card border shadow-sm h-auto p-1">
                {tabs.map((t) => (
                  <TabsTrigger
                    key={t.value}
                    value={t.value}
                    className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-2 px-4 py-2 text-sm"
                  >
                    {t.icon}
                    {t.label}
                  </TabsTrigger>
                ))}
              </TabsList>
              {tabs.map((t) => (
                <TabsContent key={t.value} value={t.value} forceMount className="data-[state=inactive]:hidden mt-3">
                  <Card className="overflow-hidden shadow-sm">{t.content}</Card>
                </TabsContent>
              ))}
            </Tabs>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
