/**
 * TDBImportDialog — sélecteur multi-tables pour importer les CSV TDB.
 *
 * Affiche les 12 tables sources documentées dans `create_df_all.py` (tdb_v_a1, e1, g1, …),
 * regroupées par catégorie (Effectifs, Ressources humaines, Infrastructures, Examens),
 * puis ouvre le `QuickImportDialog` existant pour la table choisie.
 *
 * Restreint aux administrateurs (le DataActionsBar parent est déjà admin-only).
 */
import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileSpreadsheet, Database, Users, Building2, GraduationCap, Award } from 'lucide-react';
import QuickImportDialog from '@/components/admin/QuickImportDialog';
import { useAuth } from '@/contexts/AuthContext';

interface TableDef {
  table: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  category: string;
}

// Tables documentées dans docs/python-reference/create_df_all.py
const TDB_TABLES: TableDef[] = [
  // === Indicateurs calculés (sortie du pipeline Python: df_*.csv) ===
  { table: 'tdb_ecole', label: 'df_ecole.csv → tdb_ecole', description: 'Indicateurs calculés par établissement (sortie create_df_ecole)', category: 'Indicateurs calculés (df_*.csv)', icon: <FileSpreadsheet className="w-4 h-4" /> },
  { table: 'tdb_zap', label: 'df_zap.csv → tdb_zap', description: 'Indicateurs agrégés par ZAP', category: 'Indicateurs calculés (df_*.csv)', icon: <FileSpreadsheet className="w-4 h-4" /> },
  { table: 'tdb_cisco', label: 'df_cisco.csv → tdb_cisco', description: 'Indicateurs agrégés par CISCO', category: 'Indicateurs calculés (df_*.csv)', icon: <FileSpreadsheet className="w-4 h-4" /> },
  { table: 'tdb_dren', label: 'df_dren.csv → tdb_dren', description: 'Indicateurs agrégés par DREN', category: 'Indicateurs calculés (df_*.csv)', icon: <FileSpreadsheet className="w-4 h-4" /> },
  { table: 'tdb_mada', label: 'df_mada.csv → tdb_mada', description: 'Indicateurs nationaux (Madagascar)', category: 'Indicateurs calculés (df_*.csv)', icon: <FileSpreadsheet className="w-4 h-4" /> },
  { table: 'tdb_ref', label: 'df_ref.csv → tdb_ref', description: 'Référentiel établissements (CODE_ETAB, géolocalisation, milieu, secteur)', category: 'Indicateurs calculés (df_*.csv)', icon: <FileSpreadsheet className="w-4 h-4" /> },

  // === Résultats CEPE par candidat ===
  {
    table: 'examen_cepe_candidates',
    label: 'EXAMEN_CEPE_*.xlsx → examen_cepe_candidates',
    description: 'Résultats CEPE par candidat (ANNEE_SCOLAIRE, CODE_ETAB, GENRE, notes par matière, MOYENNE, CEPE A/NA). Agrégés automatiquement dans le TDB.',
    category: 'Examens — résultats par candidat',
    icon: <Award className="w-4 h-4" />,
  },

  // === Effectifs ===
  { table: 'tdb_v_a1', label: 'A1 — Identification', description: 'Établissements : code, nom, secteur, niveaux', category: 'Identification', icon: <Database className="w-4 h-4" /> },
  { table: 'tdb_v_d1', label: 'D1 — Effectifs trimestriels', description: 'Effectifs par trimestre (eff_t1…eff_t5)', category: 'Effectifs', icon: <Users className="w-4 h-4" /> },
  { table: 'tdb_v_e1', label: 'E1 — Effectifs par classe', description: 'Élèves par classe et par genre', category: 'Effectifs', icon: <Users className="w-4 h-4" /> },
  { table: 'tdb_v_e4', label: 'E4 — Redoublants', description: 'Redoublants par trimestre / niveau', category: 'Effectifs', icon: <Users className="w-4 h-4" /> },

  // === Ressources humaines / sections ===
  { table: 'tdb_v_g1_section', label: 'G1 — Sections / classes pédagogiques', description: 'Nombre de sections et de classes pédagogiques', category: 'Ressources humaines', icon: <GraduationCap className="w-4 h-4" /> },
  { table: 'tdb_v_p1', label: 'P1 — Personnel', description: 'Enseignants, fonctionnaires, FRAM', category: 'Ressources humaines', icon: <Users className="w-4 h-4" /> },

  // === Infrastructures ===
  { table: 'tdb_v_h1_cantine', label: 'H1 — Cantine', description: 'Présence de cantine scolaire', category: 'Infrastructures', icon: <Building2 className="w-4 h-4" /> },
  { table: 'tdb_v_j1_sdc', label: 'J1 — Salles de classe', description: 'Nombre de salles de classe utilisables', category: 'Infrastructures', icon: <Building2 className="w-4 h-4" /> },
  { table: 'tdb_v_j2_latrine', label: 'J2 — Latrines', description: 'Nombre de latrines (total / filles)', category: 'Infrastructures', icon: <Building2 className="w-4 h-4" /> },
  { table: 'tdb_v_k1_place', label: 'K1 — Places assises', description: 'Capacité d\'accueil', category: 'Infrastructures', icon: <Building2 className="w-4 h-4" /> },
  { table: 'tdb_v_l1_manuel', label: 'L1 — Manuels scolaires', description: 'Manuels (Mlg, Fr, Maths)', category: 'Infrastructures', icon: <Building2 className="w-4 h-4" /> },

  // === Examens / Finances ===
  { table: 'tdb_v_ce', label: 'CE — Caisse école', description: 'Ressources financières (Ariary)', category: 'Finances', icon: <Database className="w-4 h-4" /> },
];

const CATEGORIES = ['Indicateurs calculés (df_*.csv)', 'Examens — résultats par candidat', 'Identification', 'Effectifs', 'Ressources humaines', 'Infrastructures', 'Finances'];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function TDBImportDialog({ open, onOpenChange }: Props) {
  const { user } = useAuth();
  const [selected, setSelected] = useState<TableDef | null>(null);

  const adminUsername = user?.username || '';
  const isAdmin = !!user?.is_superuser || !!user?.is_staff;

  if (!isAdmin) return null;

  return (
    <>
      <Dialog open={open && !selected} onOpenChange={(o) => !o && onOpenChange(false)}>
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-primary" />
              Importer des données TDB (CSV ou Excel)
            </DialogTitle>
            <DialogDescription>
              <strong>Recommandé :</strong> importez directement vos fichiers <code className="bg-muted px-1 rounded text-xs">df_ecole.csv</code>,
              <code className="bg-muted px-1 rounded text-xs mx-1">df_cisco.csv</code>,
              <code className="bg-muted px-1 rounded text-xs">df_dren.csv</code>… (sortie du pipeline Python) dans les
              tables <code className="bg-muted px-1 rounded text-xs">tdb_*</code> correspondantes.
              Les vues sources <code className="bg-muted px-1 rounded text-xs">tdb_v_*</code> sont quant à elles redirigées vers les tables
              <code className="bg-muted px-1 rounded text-xs mx-1">fpe_*</code> / <code className="bg-muted px-1 rounded text-xs">caisse_ecole</code>.
              Les colonnes inconnues sont ignorées automatiquement.
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 -mx-2 px-2">
            <div className="space-y-4 py-2">
              {CATEGORIES.map((cat) => {
                const tables = TDB_TABLES.filter((t) => t.category === cat);
                if (!tables.length) return null;
                return (
                  <div key={cat}>
                    <div className="mb-2 flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-foreground">{cat}</h3>
                      <Badge variant="secondary" className="text-[10px]">{tables.length}</Badge>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {tables.map((t) => (
                        <button
                          key={t.table}
                          onClick={() => setSelected(t)}
                          className="text-left rounded-lg border bg-card hover:bg-accent hover:border-primary transition-colors p-3 space-y-1 group"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="text-primary">{t.icon}</span>
                              <span className="text-sm font-medium">{t.label}</span>
                            </div>
                            <code className="text-[10px] text-muted-foreground group-hover:text-primary">
                              {t.table}
                            </code>
                          </div>
                          <p className="text-xs text-muted-foreground">{t.description}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>

          <DialogFooter className="pt-2 border-t">
            <p className="text-xs text-muted-foreground mr-auto">
              {TDB_TABLES.length} tables sources disponibles
            </p>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Fermer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Délègue l'upload au composant existant */}
      {selected && (
        <QuickImportDialog
          open={!!selected}
          onOpenChange={(o) => {
            if (!o) {
              setSelected(null);
              onOpenChange(false);
            }
          }}
          table={selected.table}
          tableLabel={selected.label}
          adminUsername={adminUsername}
          onImported={() => {
            setSelected(null);
            onOpenChange(false);
          }}
        />
      )}
    </>
  );
}
