import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, Loader2 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import DiagnosticMarkdownRenderer from './DiagnosticMarkdownRenderer';

interface DiagnosticTextViewProps {
  diagnostic: {
    diagnostic: string;
    drenName: string;
    ciscoName: string;
    annee: string;
    generatedAt: string;
  } | null;
  generating: boolean;
}

const DiagnosticTextView = ({ diagnostic, generating }: DiagnosticTextViewProps) => {
  if (generating) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground font-medium">Analyse des indicateurs en cours...</p>
          <p className="text-sm text-muted-foreground mt-2">L'IA génère un diagnostic complet avec tableaux et graphiques selon le plan officiel du MEN</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Cela peut prendre 30-60 secondes...</p>
        </div>
      </div>
    );
  }

  if (!diagnostic) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <FileText className="w-16 h-16 mx-auto mb-4 text-muted-foreground/30" />
          <p className="text-muted-foreground font-medium">Aucun diagnostic généré</p>
          <p className="text-sm text-muted-foreground mt-2">Cliquez sur "Générer le diagnostic IA" pour commencer</p>
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <FileText className="w-5 h-5 text-primary" />
              Diagnostic - {diagnostic.drenName || 'Niveau National'}
              {diagnostic.ciscoName && ` / ${diagnostic.ciscoName}`}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Généré le {new Date(diagnostic.generatedAt).toLocaleDateString('fr-FR', {
                year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
              })} | Année scolaire: {diagnostic.annee}
            </p>
          </CardHeader>
          <CardContent>
            <DiagnosticMarkdownRenderer content={diagnostic.diagnostic} />
          </CardContent>
        </Card>
      </div>
    </ScrollArea>
  );
};

export default DiagnosticTextView;
