import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, School, Users, GraduationCap, BookOpen } from 'lucide-react';
import { toast } from 'sonner';
import DonneesFilters from '@/components/donnees/DonneesFilters';
import DataTable from '@/components/donnees/DataTable';
import { useDonneesFilters } from '@/hooks/useDonneesFilters';
import { donneesApi } from '@/services/api';
import DataActionsBar from '@/components/admin/DataActionsBar';

// Configuration des colonnes par niveau et par section
const getEcolesColumns = () => {
  return [
    { key: 'CODE_ETAB', label: 'CODE' },
    { key: 'DREN', label: 'DREN' },
    { key: 'CISCO', label: 'CISCO' },
    { key: 'COMMUNE', label: 'COMMUNE' },
    { key: 'ZAP', label: 'ZAP' },
    { key: 'FOKONTANY', label: 'FOKONTANY' },
    { key: 'NOM_ETAB', label: 'ECOLE' },
    { key: 'CATEGORIE_COMMUNE', label: 'ZONE' },
    { key: 'places', label: 'PLACES', align: 'right' as const },
    { key: 'sdc_be', label: 'SdC BE', align: 'right' as const },
    { key: 'sdc_me', label: 'SdC ME', align: 'right' as const },
    { key: 'TYPE_SOURCE_EAU', label: 'EAU' },
    { key: 'TYPE_SOURCE_ELECTRICITE', label: 'ELEC' },
  ];
};

const getElevesColumns = (niveau: string) => {
  const baseColumns = [
    { key: 'CODE_ETAB', label: 'CODE' },
    { key: 'DREN', label: 'DREN' },
    { key: 'CISCO', label: 'CISCO' },
    { key: 'COMMUNE', label: 'COMMUNE' },
    { key: 'ZAP', label: 'ZAP' },
    { key: 'NOM_ETAB', label: 'ECOLE' },
    { key: 'CATEGORIE_COMMUNE', label: 'ZONE' },
    { key: 'eff_2022', label: '2022', align: 'right' as const },
    { key: 'eff_2023', label: '2023', align: 'right' as const },
    { key: 'eff_2024', label: '2024', align: 'right' as const },
    { key: 'eff_2025', label: '2025', align: 'right' as const },
  ];

  const classeColumns: Record<string, { key: string; label: string; align: 'right' }[]> = {
    prescolaire: [
      { key: 'eff_ps', label: 'PS', align: 'right' },
      { key: 'eff_ms', label: 'MS', align: 'right' },
      { key: 'eff_gs', label: 'GS', align: 'right' },
    ],
    primaire: [
      { key: 'eff_t1', label: 'T1', align: 'right' },
      { key: 'eff_t2', label: 'T2', align: 'right' },
      { key: 'eff_t3', label: 'T3', align: 'right' },
      { key: 'eff_t4', label: 'T4', align: 'right' },
      { key: 'eff_t5', label: 'T5', align: 'right' },
    ],
    college: [
      { key: 'eff_t6', label: '6ème', align: 'right' },
      { key: 'eff_t7', label: '5ème', align: 'right' },
      { key: 'eff_t8', label: '4ème', align: 'right' },
      { key: 'eff_t9', label: '3ème', align: 'right' },
    ],
    lycee: [
      { key: '_2nde', label: '2nde', align: 'right' },
      { key: '_1re', label: '1ère', align: 'right' },
      { key: 'tle', label: 'Tle', align: 'right' },
    ],
  };

  return [...baseColumns, ...(classeColumns[niveau] || [])];
};

const getPersonnelsColumns = () => {
  return [
    { key: 'CODE_ETAB', label: 'CODE' },
    { key: 'DREN', label: 'DREN' },
    { key: 'CISCO', label: 'CISCO' },
    { key: 'COMMUNE', label: 'COMMUNE' },
    { key: 'ZAP', label: 'ZAP' },
    { key: 'NOM_ETAB', label: 'ECOLE' },
    { key: 'CATEGORIE_COMMUNE', label: 'ZONE' },
    { key: 'pers_total', label: 'TOTAL', align: 'right' as const },
    { key: 'en_classe', label: 'EN CLASSE', align: 'right' as const },
    { key: 'fonctionnaire', label: 'FONCTIONNAIRE ET CONTRACTUEL', align: 'right' as const },
    { key: 'fram_sub', label: 'FRAM SUB', align: 'right' as const },
    { key: 'fram_nonsub', label: 'FRAM NON SUB', align: 'right' as const },
    { key: 'bepc', label: 'BEPC', align: 'right' as const },
    { key: 'bacc', label: 'BACC+4 et plus', align: 'right' as const },
    { key: 'qualifiee', label: 'QUALIFIÉE (CAP, CFFP, CAPEN, MAPEN, LAPEN…)', align: 'right' as const },
  ];
};

const niveauLabels: Record<string, string> = {
  prescolaire: 'Préscolaire',
  primaire: 'Primaire',
  college: 'Collège',
  lycee: 'Lycée',
};

const Donnees = () => {
  const { niveau } = useParams<{ niveau: string }>();
  const navigate = useNavigate();
  const activeNiveau = niveau || 'primaire';
  
  const [activeSection, setActiveSection] = useState('ecoles');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any[]>([]);
  
  const filters = useDonneesFilters();

  // Réinitialiser les données quand on change de niveau via URL
  useEffect(() => {
    setData([]);
  }, [niveau]);

  const handleFilter = async () => {
    if (filters.selectedDren === '0') {
      toast.error('Veuillez sélectionner au moins une DREN');
      return;
    }

    setLoading(true);
    try {
      const dren = Number(filters.selectedDren);
      const cisco = filters.selectedCisco !== '0' ? Number(filters.selectedCisco) : 0;
      const commune = filters.selectedCommune !== '0' ? Number(filters.selectedCommune) : 0;
      const zap = filters.selectedZap !== '0' ? Number(filters.selectedZap) : 0;
      const secteur = Number(filters.selectedSecteur);

      let result: any[] = [];
      
      // Appel API selon le niveau scolaire
      switch (activeNiveau) {
        case 'prescolaire':
          result = await donneesApi.getEtabN0(dren, cisco, commune, zap, secteur);
          break;
        case 'primaire':
          result = await donneesApi.getEtabN1(dren, cisco, commune, zap, secteur);
          break;
        case 'college':
          result = await donneesApi.getEtabN2(dren, cisco, commune, zap, secteur);
          break;
        case 'lycee':
          result = await donneesApi.getEtabN3(dren, cisco, commune, zap, secteur);
          break;
      }

      setData(result || []);
      toast.success(`${result?.length || 0} établissements chargés`);
    } catch (err) {
      console.error(err);
      toast.error('Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  };

  // Stats globales
  const totalEtablissements = data.length;
  const totalEleves = data.reduce((acc, e) => {
    // Calculer le total en fonction du niveau
    if (activeNiveau === 'prescolaire') {
      return acc + (Number(e.eff_ps) || 0) + (Number(e.eff_ms) || 0) + (Number(e.eff_gs) || 0);
    } else if (activeNiveau === 'primaire') {
      return acc + (Number(e.eff_t1) || 0) + (Number(e.eff_t2) || 0) + (Number(e.eff_t3) || 0) + (Number(e.eff_t4) || 0) + (Number(e.eff_t5) || 0);
    } else if (activeNiveau === 'college') {
      return acc + (Number(e.eff_t6) || 0) + (Number(e.eff_t7) || 0) + (Number(e.eff_t8) || 0) + (Number(e.eff_t9) || 0);
    } else if (activeNiveau === 'lycee') {
      return acc + (Number(e._2nde) || 0) + (Number(e._1re) || 0) + (Number(e.tle) || 0);
    }
    return acc;
  }, 0);
  const totalPersonnels = data.reduce((acc, e) => acc + (Number(e.ens_total) || 0), 0);

  const getNiveauIcon = (niv: string) => {
    switch (niv) {
      case 'prescolaire': return <BookOpen className="w-4 h-4" />;
      case 'primaire': return <School className="w-4 h-4" />;
      case 'college': return <Users className="w-4 h-4" />;
      case 'lycee': return <GraduationCap className="w-4 h-4" />;
      default: return <School className="w-4 h-4" />;
    }
  };

  const getColumns = () => {
    switch (activeSection) {
      case 'ecoles':
        return getEcolesColumns();
      case 'eleves':
        return getElevesColumns(activeNiveau);
      case 'personnels':
        return getPersonnelsColumns();
      default:
        return [];
    }
  };

  const getSectionTitle = () => {
    const sectionLabels: Record<string, string> = {
      ecoles: 'Écoles',
      eleves: 'Élèves',
      personnels: 'Personnels',
    };
    return `${sectionLabels[activeSection]} - ${niveauLabels[activeNiveau] || activeNiveau}`;
  };

  // Map (section, niveau) → table FPE pour les actions Nouveau/Importer/Gérer
  const getTargetTable = (): { table: string; label: string } => {
    const niveauTag = niveauLabels[activeNiveau] || activeNiveau;
    if (activeSection === 'ecoles')      return { table: 'fpe_a1', label: `Établissements ${niveauTag}` };
    if (activeSection === 'eleves')      return { table: 'fpe_e1', label: `Élèves ${niveauTag}` };
    if (activeSection === 'personnels')  return { table: 'fpe_p1', label: `Personnels ${niveauTag}` };
    return { table: 'fpe_a1', label: niveauTag };
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-4 py-2 bg-muted/50 border-b border-border flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-muted-foreground">
          DONNÉES GLOBALES SUR LES ÉTABLISSEMENTS / {niveauLabels[activeNiveau]?.toUpperCase() || activeNiveau.toUpperCase()}
        </span>
        <DataActionsBar
          table={getTargetTable().table}
          tableLabel={getTargetTable().label}
          compact
          onChange={handleFilter}
        />
      </div>

      {/* Filtres */}
      <DonneesFilters
        drens={filters.drens}
        ciscos={filters.ciscos}
        zaps={filters.zaps}
        communes={filters.communes}
        selectedDren={filters.selectedDren}
        selectedCisco={filters.selectedCisco}
        selectedZap={filters.selectedZap}
        selectedCommune={filters.selectedCommune}
        selectedSecteur={filters.selectedSecteur}
        loading={loading}
        loadingFilters={filters.loadingFilters}
        onDrenChange={filters.handleDrenChange}
        onCiscoChange={filters.handleCiscoChange}
        onZapChange={filters.setSelectedZap}
        onCommuneChange={filters.setSelectedCommune}
        onSecteurChange={filters.setSelectedSecteur}
        onFilter={handleFilter}
      />

      {/* Stats cards */}
      {data.length > 0 && (
        <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4 bg-muted/30">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                {getNiveauIcon(activeNiveau)}
                <div>
                  <p className="text-sm text-muted-foreground">Établissements</p>
                  <p className="text-2xl font-bold">{totalEtablissements.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <Users className="w-8 h-8 text-blue-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Total élèves</p>
                  <p className="text-2xl font-bold">{totalEleves.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <GraduationCap className="w-8 h-8 text-green-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Total personnels</p>
                  <p className="text-2xl font-bold">{totalPersonnels.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Contenu avec sous-onglets */}
      <Card className="flex-1 flex flex-col overflow-hidden m-4">
        {/* Sous-onglets (Écoles, Élèves, Personnels) */}
        <Tabs value={activeSection} onValueChange={setActiveSection} className="flex-1 flex flex-col">
          <div className="border-b">
            <TabsList className="h-10 px-4 bg-transparent">
              <TabsTrigger value="ecoles" className="flex items-center gap-2">
                <School className="w-4 h-4" />
                Écoles
              </TabsTrigger>
              <TabsTrigger value="eleves" className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                Élèves
              </TabsTrigger>
              <TabsTrigger value="personnels" className="flex items-center gap-2">
                <GraduationCap className="w-4 h-4" />
                Personnels
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value={activeSection} className="flex-1 mt-0 overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : data.length > 0 ? (
              <DataTable
                data={data}
                columns={getColumns()}
                title={getSectionTitle()}
                exportFilename={`donnees_${activeNiveau}_${activeSection}.csv`}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <School className="w-16 h-16 mb-4 opacity-20" />
                <p>Sélectionnez une DREN et cliquez sur Filtrer pour charger les données</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
};

export default Donnees;
