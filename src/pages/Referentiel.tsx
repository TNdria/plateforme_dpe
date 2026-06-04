import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Database, MapPin, Building, Users, Loader2 } from "lucide-react";
import { dashboardApi, Dren, Cisco } from '@/services/api';

const Referentiel = () => {
  const [drens, setDrens] = useState<Dren[]>([]);
  const [ciscos, setCiscos] = useState<Cisco[]>([]);
  const [selectedDren, setSelectedDren] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch DRENs on mount
  useEffect(() => {
    const fetchDrens = async () => {
      try {
        setLoading(true);
        const data = await dashboardApi.getDrens();
        setDrens(data);
      } catch (err) {
        console.error('Error fetching DRENs:', err);
        setError('Erreur lors du chargement des DRENs');
      } finally {
        setLoading(false);
      }
    };
    fetchDrens();
  }, []);

  // Fetch CISCOs when DREN changes
  useEffect(() => {
    const fetchCiscos = async () => {
      if (selectedDren === 0) {
        setCiscos([]);
        return;
      }
      try {
        setLoading(true);
        const data = await dashboardApi.getCiscos(selectedDren);
        setCiscos(data);
      } catch (err) {
        console.error('Error fetching CISCOs:', err);
        setError('Erreur lors du chargement des CISCOs');
      } finally {
        setLoading(false);
      }
    };
    fetchCiscos();
  }, [selectedDren]);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Référentiel</h1>
          <p className="text-muted-foreground">Gestion des données de référence</p>
        </div>
      </div>

      {error && (
        <Card className="bg-destructive/10 border-destructive">
          <CardContent className="pt-4">
            <p className="text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total DRENs</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{drens.length}</div>
            <p className="text-xs text-muted-foreground">Directions régionales</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">CISCOs</CardTitle>
            <Building className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{ciscos.length}</div>
            <p className="text-xs text-muted-foreground">
              {selectedDren === 0 ? 'Sélectionnez une DREN' : 'Dans la DREN sélectionnée'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">DREN Sélectionnée</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">
              {selectedDren === 0 
                ? 'Aucune' 
                : drens.find(d => d.CODE_DREN === selectedDren)?.DREN || '-'}
            </div>
            <p className="text-xs text-muted-foreground">Code: {selectedDren || '-'}</p>
          </CardContent>
        </Card>
      </div>

      {/* DREN Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Liste des DRENs
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium">Sélectionner une DREN:</label>
            <Select 
              value={selectedDren.toString()} 
              onValueChange={(v) => setSelectedDren(Number(v))}
            >
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Toutes les DRENs" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Toutes les DRENs</SelectItem>
                {drens.map((dren) => (
                  <SelectItem key={dren.CODE_DREN} value={dren.CODE_DREN.toString()}>
                    {dren.DREN}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>DREN</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {drens.map((dren) => (
                  <TableRow 
                    key={dren.CODE_DREN}
                    className={selectedDren === dren.CODE_DREN ? 'bg-primary/10' : ''}
                  >
                    <TableCell className="font-mono">{dren.CODE_DREN}</TableCell>
                    <TableCell className="font-medium">{dren.DREN}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant={selectedDren === dren.CODE_DREN ? 'default' : 'secondary'}>
                        {selectedDren === dren.CODE_DREN ? 'Sélectionnée' : 'Active'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* CISCOs Table */}
      {selectedDren > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="h-5 w-5" />
              CISCOs de {drens.find(d => d.CODE_DREN === selectedDren)?.DREN}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : ciscos.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">Aucune CISCO trouvée</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code CISCO</TableHead>
                    <TableHead>CISCO</TableHead>
                    <TableHead>Code DREN</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ciscos.map((cisco) => (
                    <TableRow key={cisco.CODE_CISCO}>
                      <TableCell className="font-mono">{cisco.CODE_CISCO}</TableCell>
                      <TableCell className="font-medium">{cisco.CISCO}</TableCell>
                      <TableCell className="font-mono">{cisco.CODE_DREN || selectedDren}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Referentiel;
