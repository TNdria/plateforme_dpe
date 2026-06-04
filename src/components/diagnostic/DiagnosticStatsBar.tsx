import { Card, CardContent } from '@/components/ui/card';
import { Building2, Users, GraduationCap, School, BarChart3, Loader2 } from 'lucide-react';

interface DiagnosticStatsBarProps {
  donnees: {
    etablissements: { total: number };
    eleves: { total: number };
    enseignants: { total: number };
    places: { total: number };
  };
  remGlobal: string;
  loading: boolean;
}

const statItems = [
  { key: 'etablissements', label: 'Établissements', icon: Building2, color: 'text-primary' },
  { key: 'eleves', label: 'Élèves', icon: Users, color: 'text-secondary' },
  { key: 'enseignants', label: 'Enseignants', icon: GraduationCap, color: 'text-accent-foreground' },
  { key: 'places', label: 'Places assises', icon: School, color: 'text-warning' },
] as const;

const formatNumber = (num: number) => new Intl.NumberFormat('fr-FR').format(num);

const DiagnosticStatsBar = ({ donnees, remGlobal, loading }: DiagnosticStatsBarProps) => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      {statItems.map(({ key, label, icon: Icon, color }) => (
        <Card key={key} className="border border-border/50">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <Icon className={`w-4 h-4 ${color}`} />
              <div>
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className={`text-lg font-bold ${color}`}>
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : formatNumber(donnees[key].total)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
      <Card className="border border-border/50">
        <CardContent className="p-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">REM Global</p>
              <p className="text-lg font-bold text-primary">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : remGlobal}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DiagnosticStatsBar;
