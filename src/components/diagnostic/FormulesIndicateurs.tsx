import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Target, Activity, ShieldCheck, GraduationCap, Sigma } from 'lucide-react';

interface Formule {
  indicateur: string;
  formule: string;
  detail?: string;
}

interface Groupe {
  titre: string;
  icon: React.ElementType;
  formules: Formule[];
}

const GROUPES: Groupe[] = [
  {
    titre: 'I. Couverture et accès',
    icon: Target,
    formules: [
      {
        indicateur: 'Taux de préscolarisation',
        formule: 'Taux présco = Effectif préscolaire / Population 3-5 ans × 100',
      },
      {
        indicateur: 'Taux Brut de Scolarisation (TBS)',
        formule: 'TBS = Effectif du niveau / Population du groupe d’âge × 100',
        detail: 'Primaire : 6-10 ans · Collège : 11-14 ans · Lycée : 15-17 ans',
      },
      {
        indicateur: 'Taux Brut d’Accès (TBA)',
        formule: 'TBA = (Effectif classe d’entrée − Redoublants classe d’entrée) / Population de l’âge légal × 100',
        detail: 'Primaire : T1 (CP1) / pop. 6 ans · Collège : T6 (6ème) / pop. 11 ans · Lycée : 2nde / pop. 15 ans',
      },
      {
        indicateur: 'Taux de transition',
        formule: 'Transition = (Effectif classe d’entrée N − Redoublants N) / Effectif dernière classe du cycle précédent N−1 × 100',
        detail: 'Primaire→Collège : (6ème N − redoublants 6ème N) / CM2 N−1 · Collège→Lycée : (2nde N − redoublants 2nde N) / 3ème N−1',
      },
      {
        indicateur: 'Salles pour 1000 enfants scolarisables',
        formule: 'Salles/1000 = Salles de classe primaire / Population 6-10 ans × 1000',
      },
      {
        indicateur: 'Ratio classe pédagogique / salle',
        formule: 'Ratio = Nombre de classes pédagogiques (sections) / Nombre de salles de classe',
      },
      {
        indicateur: 'Taux d’utilisation des salles',
        formule: 'Taux d’utilisation = Nombre de sections / Nombre de salles de classe × 100',
      },
      {
        indicateur: '% EPP pourvus de CAP',
        formule: '% EPP-CAP = EPP disposant d’un CAP / Total EPP × 100',
      },
      {
        indicateur: 'Part du privé',
        formule: 'Part privé = Effectif élèves privé / Effectif élèves total × 100',
      },
      {
        indicateur: 'Parité filles/garçons',
        formule: 'Parité = Effectif filles / Effectif garçons',
        detail: 'Cible : 1,00 (autant de filles que de garçons)',
      },
    ],
  },
  {
    titre: 'II. Efficacité interne (flux des élèves)',
    icon: Activity,
    formules: [
      {
        indicateur: 'Taux de promotion',
        formule: 'Promotion = (Effectif classe supérieure N − Redoublants classe supérieure N) / Effectif classe N−1 × 100',
        detail: 'Ex. T1→T2 : (T2 N − redoublants T2 N) / T1 N−1. N = année courante, N−1 = année précédente.',
      },
      {
        indicateur: 'Taux de redoublement',
        formule: 'Redoublement = Redoublants de la classe N / Effectif de la classe N−1 × 100',
      },
      {
        indicateur: 'Taux d’abandon',
        formule: 'Abandon = 100 − (Taux de promotion + Taux de redoublement)',
      },
      {
        indicateur: 'Profil de rétention (cohorte apparente)',
        formule: 'Rétention niveau k = Effectif classe k (année N−d+k) / Effectif classe d’entrée (année N−d) × 100',
        detail: 'Primaire : T1 → T5 sur 5 ans · Collège : T6 → T9 sur 4 ans · Lycée : 2nde → Terminale sur 3 ans',
      },
    ],
  },
  {
    titre: 'III. Qualité et intrants pédagogiques',
    icon: ShieldCheck,
    formules: [
      {
        indicateur: '% enseignants qualifiés',
        formule: '% qualifiés = Enseignants qualifiés (diplôme pédagogique) / Total enseignants × 100',
      },
      {
        indicateur: '% enseignants non fonctionnaires (FRAM)',
        formule: '% non fonctionnaires = (Total enseignants − Enseignants fonctionnaires) / Total enseignants × 100',
      },
      {
        indicateur: 'Ratio élève / enseignant (REM)',
        formule: 'REM = Effectif élèves / Effectif enseignants',
        detail: 'Norme MEN primaire : 40 à 52 élèves par enseignant',
      },
      {
        indicateur: 'Ratio élève / place assise',
        formule: 'Ratio = Effectif élèves / Nombre de places assises (tables-bancs)',
        detail: 'Cible : ≤ 1 (chaque élève dispose d’une place assise)',
      },
      {
        indicateur: 'Ratio élève / salle de classe',
        formule: 'Ratio = Effectif élèves / Nombre de salles de classe',
      },
      {
        indicateur: 'Ratio élève / manuel',
        formule: 'Ratio = Effectif élèves primaire / Nombre de manuels de la matière',
        detail: 'Cible : 1 (un manuel par élève et par matière)',
      },
      {
        indicateur: '% salles en mauvais état',
        formule: '% = Salles en mauvais état / Total salles de classe × 100',
      },
      {
        indicateur: '% élèves en classe multigrade',
        formule: '% multigrade = Sections multigrade / Total sections primaire × 100',
      },
    ],
  },
  {
    titre: 'Résultats aux examens officiels',
    icon: GraduationCap,
    formules: [
      {
        indicateur: 'Taux de réussite (CEPE / BEPC)',
        formule: 'Taux de réussite = Admis / Présentés × 100',
      },
      {
        indicateur: 'Taux de réussite sur inscrits',
        formule: 'Taux = Admis / Effectif inscrit en classe terminale du cycle × 100',
        detail: 'CEPE : sur inscrits CM2 (T5) · BEPC : sur inscrits 3ème (T9)',
      },
      {
        indicateur: 'Scores moyens',
        formule: 'Moyenne = Σ des notes obtenues / Nombre de candidats (par matière et moyenne générale)',
      },
    ],
  },
];

const FormulesIndicateurs = () => {
  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-4">
        <Card className="border-border bg-primary/5 shadow-sm">
          <CardContent className="flex items-start gap-3 p-4">
            <Sigma className="h-5 w-5 shrink-0 text-primary mt-0.5" />
            <p className="text-sm text-muted-foreground leading-relaxed">
              Référentiel des formules de calcul des indicateurs du diagnostic du système éducatif
              (conformes au plan officiel du MEN). <strong className="text-foreground">N</strong> désigne l’année
              courante, <strong className="text-foreground">N−1</strong> l’année précédente. Ces formules sont
              celles effectivement appliquées aux données affichées dans les onglets Couverture, Efficacité
              interne et Qualité.
            </p>
          </CardContent>
        </Card>

        {GROUPES.map((g) => {
          const Icon = g.icon;
          return (
            <Card key={g.titre} className="overflow-hidden border-border shadow-sm">
              <CardHeader className="gap-1 border-b border-border bg-primary/5 pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-primary">
                  <Icon className="h-4 w-4" />
                  {g.titre}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ul className="divide-y divide-border">
                  {g.formules.map((f) => (
                    <li key={f.indicateur} className="px-4 py-3 transition-colors hover:bg-muted/40">
                      <p className="text-sm font-semibold text-foreground">{f.indicateur}</p>
                      <p className="mt-1 rounded-md border border-border bg-muted/50 px-3 py-2 font-mono text-[12px] leading-relaxed text-primary">
                        {f.formule}
                      </p>
                      {f.detail && (
                        <p className="mt-1.5 text-xs italic text-muted-foreground">{f.detail}</p>
                      )}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </ScrollArea>
  );
};

export default FormulesIndicateurs;
