import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SectionData {
  id: string;
  titre: string;
  contenu: React.ReactNode;
}

interface ChapitreTabProps {
  titre: string;
  sousTitre: string;
  icon: LucideIcon;
  sections: SectionData[];
  accentColor?: string;
}

const ChapitreTab = ({ titre, sousTitre, icon: Icon, sections, accentColor = 'text-primary' }: ChapitreTabProps) => {
  return (
    <div className="space-y-4">
      {/* Chapter header */}
      <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50 border border-border/50">
        <div className={cn('p-2 rounded-lg bg-primary/10')}>
          <Icon className={cn('w-6 h-6', accentColor)} />
        </div>
        <div>
          <h2 className={cn('text-lg font-bold', accentColor)}>{titre}</h2>
          <p className="text-sm text-muted-foreground mt-1">{sousTitre}</p>
        </div>
      </div>

      {/* Sections */}
      {sections.map((section) => (
        <Card key={section.id}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{section.titre}</CardTitle>
          </CardHeader>
          <CardContent>{section.contenu}</CardContent>
        </Card>
      ))}
    </div>
  );
};

export default ChapitreTab;
