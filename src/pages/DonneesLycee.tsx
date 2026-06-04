import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Download, Filter, Loader2, School, Users, GraduationCap } from 'lucide-react';
import { dashboardApi, donneesApi, Dren, Cisco, Zap } from '@/services/api';

interface Commune {
  CODE_COMMUNE: number;
  COMMUNE: string;
}

const DonneesLycee = () => {
  const [drens, setDrens] = useState<Dren[]>([]);
  const [ciscos, setCiscos] = useState<Cisco[]>([]);
  const [zaps, setZaps] = useState<Zap[]>([]);
  const [communes, setCommunes] = useState<Commune[]>([]);
  const [selectedDren, setSelectedDren] = useState<string>('0');
  const [selectedCisco, setSelectedCisco] = useState<string>('0');
  const [selectedZap, setSelectedZap] = useState<string>('0');
  const [selectedCommune, setSelectedCommune] = useState<string>('0');
  const [selectedSecteur, setSelectedSecteur] = useState<string>('2');
  const [loading, setLoading] = useState(false);
  const [loadingFilters, setLoadingFilters] = useState(false);
  const [etablissements, setEtablissements] = useState<any[]>([]);

  useEffect(() => {
    const fetchDrens = async () => {
      try {
        const data = await dashboardApi.getDrens();
        setDrens(data);
      } catch (err) {
        console.error('Erreur:', err);
        toast.error('Erreur lors du chargement des DRENs');
      }
    };
    fetchDrens();
  }, []);

  const handleDrenChange = async (value: string) => {
    setSelectedDren(value);
    setSelectedCisco('0');
    setSelectedZap('0');
    setSelectedCommune('0');
    setCiscos([]);
    setZaps([]);
    setCommunes([]);
    
    if (value !== '0') {
      try {
        setLoadingFilters(true);
        const data = await dashboardApi.getCiscos(Number(value));
        setCiscos(data);
      } catch (err) {
        toast.error('Erreur lors du chargement des CISCOs');
      } finally {
        setLoadingFilters(false);
      }
    }
  };

  const handleCiscoChange = async (value: string) => {
    setSelectedCisco(value);
    setSelectedZap('0');
    setSelectedCommune('0');
    setZaps([]);
    setCommunes([]);
    
    if (value !== '0') {
      try {
        setLoadingFilters(true);
        const [zapsData, communesData] = await Promise.all([
          donneesApi.getZaps(Number(selectedDren), Number(value), 0),
          donneesApi.getCommunes(Number(selectedDren), Number(value), 0)
        ]);
        setZaps(zapsData);
        setCommunes(communesData);
      } catch (err) {
        toast.error('Erreur lors du chargement des filtres');
      } finally {
        setLoadingFilters(false);
      }
    }
  };

  const handleFilter = async () => {
    if (selectedDren === '0') {
      toast.error('Veuillez sélectionner au moins une DREN');
      return;
    }
    
    setLoading(true);
    try {
      const dren = Number(selectedDren);
      const cisco = selectedCisco !== '0' ? Number(selectedCisco) : 0;
      const commune = selectedCommune !== '0' ? Number(selectedCommune) : 0;
      const zap = selectedZap !== '0' ? Number(selectedZap) : 0;
      const secteur = Number(selectedSecteur);
      
      const data = await donneesApi.getEtabN3(dren, cisco, commune, zap, secteur);
      setEtablissements(data || []);
      toast.success(`${data?.length || 0} établissements chargés`);
    } catch (err) {
      console.error(err);
      toast.error('Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    if (etablissements.length === 0) {
      toast.error('Aucune donnée à exporter');
      return;
    }
    
    const headers = ['Code', 'Établissement', 'DREN', 'CISCO', 'ZAP', 'Commune', 'Fokontany', 'Secteur', '2nde', '1ère', 'Tle', 'Total'];
    const rows = etablissements.map(e => [
      e.CODE_ETAB,
      e.NOM_ETAB,
      e.DREN,
      e.CISCO,
      e.ZAP,
      e.COMMUNE,
      e.FOKONTANY || '',
      e.SECTEUR === 0 ? 'Public' : 'Privé',
      e._2nde || 0,
      e._1re || 0,
      e.tle || 0,
      (e._2nde || 0) + (e._1re || 0) + (e.tle || 0)
    ]);
    
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'donnees_lycee.csv';
    a.click();
    toast.success('Export CSV téléchargé');
  };

  const totalEleves = etablissements.reduce((acc, e) => 
    acc + (e._2nde || 0) + (e._1re || 0) + (e.tle || 0), 0);

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-2 bg-muted/50 border-b border-border">
        <span className="text-sm font-semibold text-muted-foreground">
          DONNÉES / LYCÉE
        </span>
      </div>

      {/* Filtres */}
      <div className="p-4 border-b border-border bg-card">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="space-y-1">
            <label className="text-sm font-medium">DREN</label>
            <Select value={selectedDren} onValueChange={handleDrenChange}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Sélectionner DREN" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">-- Sélectionner --</SelectItem>
                {drens.map((d) => (
                  <SelectItem key={d.CODE_DREN} value={d.CODE_DREN.toString()}>
                    {d.DREN}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">CISCO</label>
            <Select value={selectedCisco} onValueChange={handleCiscoChange} disabled={selectedDren === '0' || loadingFilters}>
              <SelectTrigger className="w-52">
                <SelectValue placeholder="Tous les CISCOs" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Tous les CISCOs</SelectItem>
                {ciscos.map((c) => (
                  <SelectItem key={c.CODE_CISCO} value={c.CODE_CISCO.toString()}>
                    {c.CISCO}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">ZAP</label>
            <Select value={selectedZap} onValueChange={setSelectedZap} disabled={selectedCisco === '0' || loadingFilters}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Tous les ZAPs" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Tous les ZAPs</SelectItem>
                {zaps.map((z) => (
                  <SelectItem key={z.CODE_ZAP} value={z.CODE_ZAP.toString()}>
                    {z.ZAP}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Commune</label>
            <Select value={selectedCommune} onValueChange={setSelectedCommune} disabled={selectedCisco === '0' || loadingFilters}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Toutes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Toutes les communes</SelectItem>
                {communes.map((c) => (
                  <SelectItem key={c.CODE_COMMUNE} value={c.CODE_COMMUNE.toString()}>
                    {c.COMMUNE}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Secteur</label>
            <Select value={selectedSecteur} onValueChange={setSelectedSecteur}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2">Tous</SelectItem>
                <SelectItem value="0">Public</SelectItem>
                <SelectItem value="1">Privé</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button onClick={handleFilter} disabled={loading || selectedDren === '0'}>
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Filter className="w-4 h-4 mr-2" />}
            Filtrer
          </Button>
        </div>
      </div>

      {/* Stats cards */}
      {etablissements.length > 0 && (
        <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4 bg-muted/30">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <School className="w-8 h-8 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">Établissements</p>
                  <p className="text-2xl font-bold">{etablissements.length}</p>
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
                  <p className="text-sm text-muted-foreground">Moy. élèves/établ.</p>
                  <p className="text-2xl font-bold">{etablissements.length > 0 ? Math.round(totalEleves / etablissements.length) : 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tableau de données */}
      <div className="flex-1 p-4 overflow-auto">
        <Card className="h-full">
          <CardHeader className="flex flex-row items-center justify-between py-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <School className="w-5 h-5" />
              Lycées ({etablissements.length})
            </CardTitle>
            <Button variant="outline" size="sm" onClick={handleExport} disabled={etablissements.length === 0}>
              <Download className="w-4 h-4 mr-2" />
              Exporter CSV
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin" />
              </div>
            ) : etablissements.length > 0 ? (
              <div className="max-h-[calc(100vh-450px)] overflow-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-card z-10">
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Établissement</TableHead>
                      <TableHead>CISCO</TableHead>
                      <TableHead>ZAP</TableHead>
                      <TableHead>Commune</TableHead>
                      <TableHead>Secteur</TableHead>
                      <TableHead className="text-right">2nde</TableHead>
                      <TableHead className="text-right">1ère</TableHead>
                      <TableHead className="text-right">Tle</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {etablissements.map((etab, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-mono text-xs">{etab.CODE_ETAB}</TableCell>
                        <TableCell className="font-medium">{etab.NOM_ETAB}</TableCell>
                        <TableCell>{etab.CISCO}</TableCell>
                        <TableCell>{etab.ZAP}</TableCell>
                        <TableCell>{etab.COMMUNE}</TableCell>
                        <TableCell>
                          <Badge variant={etab.SECTEUR === 0 ? 'default' : 'secondary'}>
                            {etab.SECTEUR === 0 ? 'Public' : 'Privé'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">{etab._2nde || 0}</TableCell>
                        <TableCell className="text-right">{etab._1re || 0}</TableCell>
                        <TableCell className="text-right">{etab.tle || 0}</TableCell>
                        <TableCell className="text-right font-semibold">
                          {(etab._2nde || 0) + (etab._1re || 0) + (etab.tle || 0)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">
                Sélectionnez une DREN et cliquez sur Filtrer pour charger les données
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DonneesLycee;
