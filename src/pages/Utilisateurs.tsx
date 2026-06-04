import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Users, Plus, Pencil, Trash2, Upload, FileSpreadsheet, RefreshCw, Shield, ShieldCheck, Loader2, Search, Download } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const API_BASE = (() => {
  const pid = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  return pid ? `https://${pid}.supabase.co` : import.meta.env.VITE_SUPABASE_URL;
})();
const HEADERS = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
};

async function adminFetch(action: string, body: Record<string, any>) {
  const res = await fetch(`${API_BASE}/functions/v1/db-query?action=${action}`, {
    method: 'POST', headers: HEADERS, body: JSON.stringify(body),
  });
  return res.json();
}

interface DBUser {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  is_active: boolean;
  is_staff: boolean;
  is_superuser: boolean;
  dren: number;
  cisco: number;
  date_joined: string;
  last_login: string | null;
}

const Utilisateurs = () => {
  const { user } = useAuth();
  const isAdmin = user?.is_superuser === true;
  const [users, setUsers] = useState<DBUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editUser, setEditUser] = useState<DBUser | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showDelete, setShowDelete] = useState<DBUser | null>(null);
  const [formData, setFormData] = useState({ username: '', first_name: '', last_name: '', email: '', password: '', is_active: true, is_staff: false, is_superuser: false, dren: '0', cisco: '0' });
  const [editForm, setEditForm] = useState({ first_name: '', last_name: '', email: '', is_active: true, is_staff: false, is_superuser: false, dren: '0', cisco: '0', newPassword: '' });

  // Import state
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importData, setImportData] = useState<{ headers: string[]; rows: any[][] } | null>(null);
  const [importTable, setImportTable] = useState('');
  const [importing, setImporting] = useState(false);
  const [tables, setTables] = useState<{ table_name: string }[]>([]);
  const [tableColumns, setTableColumns] = useState<{ column_name: string; data_type: string }[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const fileRef = useRef<HTMLInputElement>(null);

  const loadUsers = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    try {
      const res = await adminFetch('listUsers', { adminUsername: user?.username });
      if (res.success) setUsers(res.users);
      else toast.error(res.error);
    } catch { toast.error('Erreur de chargement'); }
    setLoading(false);
  }, [isAdmin, user?.username]);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const handleCreate = async () => {
    if (!formData.username || formData.username.length < 3) { toast.error('Identifiant requis (min 3 car.)'); return; }
    if (!formData.password || formData.password.length < 4) { toast.error('Mot de passe requis (min 4 car.)'); return; }
    try {
      const res = await adminFetch('createUser', { adminUsername: user?.username, username: formData.username, password: formData.password, first_name: formData.first_name, last_name: formData.last_name, email: formData.email, is_active: formData.is_active, is_staff: formData.is_staff, is_superuser: formData.is_superuser, dren: formData.dren, cisco: formData.cisco });
      if (res.success) { toast.success(`Utilisateur ${formData.username} créé`); setShowCreate(false); setFormData({ username: '', first_name: '', last_name: '', email: '', password: '', is_active: true, is_staff: false, is_superuser: false, dren: '0', cisco: '0' }); loadUsers(); }
      else toast.error(res.error);
    } catch { toast.error('Erreur de création'); }
  };

  const handleUpdate = async () => {
    if (!editUser) return;
    try {
      const res = await adminFetch('updateUser', { adminUsername: user?.username, userId: editUser.id, first_name: editForm.first_name, last_name: editForm.last_name, email: editForm.email, is_active: editForm.is_active, is_staff: editForm.is_staff, is_superuser: editForm.is_superuser, dren: editForm.dren, cisco: editForm.cisco, newPassword: editForm.newPassword || undefined });
      if (res.success) { toast.success('Utilisateur mis à jour'); setEditUser(null); loadUsers(); }
      else toast.error(res.error);
    } catch { toast.error('Erreur de mise à jour'); }
  };

  const handleDelete = async () => {
    if (!showDelete) return;
    try {
      const res = await adminFetch('deleteUser', { adminUsername: user?.username, userId: showDelete.id });
      if (res.success) { toast.success('Utilisateur supprimé'); setShowDelete(null); loadUsers(); }
      else toast.error(res.error);
    } catch { toast.error('Erreur de suppression'); }
  };

  const openEdit = (u: DBUser) => {
    setEditUser(u);
    setEditForm({ first_name: u.first_name, last_name: u.last_name, email: u.email, is_active: u.is_active, is_staff: u.is_staff, is_superuser: u.is_superuser, dren: String(u.dren || 0), cisco: String(u.cisco || 0), newPassword: '' });
  };

  // Excel/CSV import
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFile(file);
    setImportData(null);
    setColumnMapping({});

    const fname = file.name.toLowerCase();
    let headers: string[] = [];
    let rows: any[][] = [];

    if (fname.endsWith('.csv') || fname.endsWith('.txt')) {
      // Parse CSV in browser
      const text = await file.text();
      // Strip BOM
      const clean = text.replace(/^\uFEFF/, '');
      const lines = clean.split(/\r?\n/).filter(l => l.trim().length > 0);
      if (lines.length < 2) { toast.error('Fichier CSV vide'); return; }
      // Detect separator
      const sep = lines[0].includes(';') && !lines[0].includes(',') ? ';' : ',';
      // Robust CSV parser handling quoted fields
      const parseLine = (line: string): string[] => {
        const out: string[] = [];
        let cur = '', inQ = false;
        for (let i = 0; i < line.length; i++) {
          const ch = line[i];
          if (ch === '"' && line[i+1] === '"') { cur += '"'; i++; }
          else if (ch === '"') { inQ = !inQ; }
          else if (ch === sep && !inQ) { out.push(cur); cur = ''; }
          else cur += ch;
        }
        out.push(cur);
        return out;
      };
      headers = parseLine(lines[0]).map(h => h.trim());
      rows = lines.slice(1).map(parseLine);
    } else {
      // Excel via SheetJS
      const XLSX = await import('xlsx');
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
      if (json.length < 2) { toast.error('Fichier vide'); return; }
      headers = (json[0] as any[]).map((h: any) => String(h).trim());
      rows = json.slice(1).filter((r: any[]) => r.some((c: any) => c !== null && c !== undefined && c !== ''));
    }

    setImportData({ headers, rows });
    toast.success(`${rows.length} lignes détectées (${headers.length} colonnes)`);

    // Auto-suggest TDB table based on columns present
    if (headers.includes('CODE_ETAB')) setImportTable('tdb_ecole');
    else if (headers.includes('CODE_ZAP')) setImportTable('tdb_zap');
    else if (headers.includes('CODE_CISCO')) setImportTable('tdb_cisco');
    else if (headers.includes('CODE_DREN')) setImportTable('tdb_dren');
    else if (headers.includes('CODE_MADA') || headers.includes('code_mada')) setImportTable('tdb_mada');
  };

  const loadTables = async () => {
    try {
      const res = await adminFetch('getTableList', { adminUsername: user?.username });
      if (res.success) setTables(res.tables);
    } catch { /* ignore */ }
  };

  const loadTableColumns = async (tableName: string) => {
    try {
      const res = await adminFetch('getTableColumns', { adminUsername: user?.username, tableName });
      if (res.success) {
        setTableColumns(res.columns);
        // Auto-map columns by name match
        if (importData) {
          const mapping: Record<string, string> = {};
          importData.headers.forEach(h => {
            const match = res.columns.find((c: any) => c.column_name.toLowerCase() === h.toLowerCase() || c.column_name === h);
            if (match) mapping[h] = match.column_name;
          });
          setColumnMapping(mapping);
        }
      }
    } catch { /* ignore */ }
  };

  useEffect(() => { if (isAdmin) loadTables(); }, [isAdmin]);

  const handleImport = async () => {
    if (!importData || !importTable) { toast.error('Sélectionnez une table'); return; }
    const mappedCols = Object.values(columnMapping).filter(Boolean);
    if (mappedCols.length === 0) { toast.error('Mappez au moins une colonne'); return; }
    
    setImporting(true);
    try {
      // Map rows according to column mapping
      const excelIndices = importData.headers.map((h, i) => ({ header: h, index: i, dbCol: columnMapping[h] })).filter(x => x.dbCol);
      const columns = excelIndices.map(x => x.dbCol);
      const rows = importData.rows.map(row => excelIndices.map(x => row[x.index] ?? null));
      
      // Send in batches of 100
      let totalInserted = 0;
      const allErrors: string[] = [];
      const batchSize = 100;
      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize);
        const res = await adminFetch('importData', { adminUsername: user?.username, tableName: importTable, columns, rows: batch });
        if (res.success) {
          totalInserted += res.inserted;
          if (res.errors?.length) allErrors.push(...res.errors);
        } else {
          allErrors.push(res.error);
          break;
        }
      }
      
      if (allErrors.length > 0) {
        toast.warning(`${totalInserted} lignes insérées, ${allErrors.length} erreurs`);
        console.warn('Import errors:', allErrors);
      } else {
        toast.success(`${totalInserted} lignes insérées avec succès`);
      }
      setImportFile(null);
      setImportData(null);
      setColumnMapping({});
    } catch (e: any) {
      toast.error(`Erreur d'import: ${e.message}`);
    }
    setImporting(false);
  };

  const filteredUsers = users.filter(u =>
    u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.last_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!isAdmin) {
    return (
      <div className="h-full flex flex-col">
        <div className="px-4 py-2 bg-muted/50 border-b border-border">
          <span className="text-sm font-semibold text-muted-foreground">ADMINISTRATION / UTILISATEURS</span>
        </div>
        <div className="flex-1 flex items-center justify-center p-8">
          <Card className="w-full max-w-md text-center">
            <CardContent className="pt-8 pb-8">
              <Shield className="w-16 h-16 mx-auto text-destructive/50 mb-4" />
              <h2 className="text-xl font-bold mb-2">Accès refusé</h2>
              <p className="text-muted-foreground">Seul l'administrateur peut accéder à cette page.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-2 bg-muted/50 border-b border-border">
        <span className="text-sm font-semibold text-muted-foreground">ADMINISTRATION / UTILISATEURS</span>
      </div>

      <div className="flex-1 overflow-auto p-4">
        <Tabs defaultValue="users" className="space-y-4">
          <TabsList>
            <TabsTrigger value="users" className="gap-2"><Users className="w-4 h-4" />Utilisateurs ({users.length})</TabsTrigger>
            <TabsTrigger value="import" className="gap-2"><FileSpreadsheet className="w-4 h-4" />Import CSV / Excel</TabsTrigger>
          </TabsList>

          {/* ============ Users Tab ============ */}
          <TabsContent value="users" className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Rechercher..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9" />
              </div>
              <Button variant="outline" size="sm" onClick={loadUsers} disabled={loading}>
                <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />Actualiser
              </Button>
              <Button size="sm" onClick={() => setShowCreate(true)}>
                <Plus className="w-4 h-4 mr-1" />Nouveau
              </Button>
            </div>

            <Card>
              <div className="overflow-auto max-h-[calc(100vh-280px)]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Identifiant</TableHead>
                      <TableHead>Nom</TableHead>
                      <TableHead>Prénom</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead className="text-center">Actif</TableHead>
                      <TableHead className="text-center">Rôle</TableHead>
                      <TableHead>DREN</TableHead>
                      <TableHead>CISCO</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow><TableCell colSpan={9} className="text-center py-8"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></TableCell></TableRow>
                    ) : filteredUsers.length === 0 ? (
                      <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Aucun utilisateur trouvé</TableCell></TableRow>
                    ) : filteredUsers.map(u => (
                      <TableRow key={u.id}>
                        <TableCell className="font-medium">{u.username}</TableCell>
                        <TableCell>{u.first_name}</TableCell>
                        <TableCell>{u.last_name}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{u.email}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant={u.is_active ? 'default' : 'destructive'} className="text-xs">
                            {u.is_active ? 'Oui' : 'Non'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          {u.is_superuser ? (
                            <Badge className="bg-primary/20 text-primary border-primary/30 text-xs"><ShieldCheck className="w-3 h-3 mr-1" />Admin</Badge>
                          ) : u.is_staff ? (
                            <Badge variant="secondary" className="text-xs">Staff</Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs">User</Badge>
                          )}
                        </TableCell>
                        <TableCell>{u.dren || '-'}</TableCell>
                        <TableCell>{u.cisco || '-'}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-1 justify-end">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(u)}><Pencil className="w-4 h-4" /></Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setShowDelete(u)}><Trash2 className="w-4 h-4" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </TabsContent>

          {/* ============ Import Tab ============ */}
          <TabsContent value="import" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Upload className="w-5 h-5" />Importer des données Excel</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Step 1: Select file */}
                <div className="space-y-2">
                  <Label>1. Sélectionner un fichier Excel (.xlsx, .xls, .csv)</Label>
                  <div className="flex gap-2">
                    <Input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFileSelect} />
                  </div>
                  {importData && (
                    <p className="text-sm text-muted-foreground">
                      ✅ {importData.headers.length} colonnes, {importData.rows.length} lignes détectées
                    </p>
                  )}
                </div>

                {/* Step 2: Select target table */}
                {importData && (
                  <div className="space-y-2">
                    <Label>2. Table de destination</Label>
                    <Select value={importTable} onValueChange={(v) => { setImportTable(v); loadTableColumns(v); }}>
                      <SelectTrigger><SelectValue placeholder="Choisir la table..." /></SelectTrigger>
                      <SelectContent>
                        {tables.map(t => (
                          <SelectItem key={t.table_name} value={t.table_name}>{t.table_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Step 3: Column mapping */}
                {importData && importTable && tableColumns.length > 0 && (
                  <div className="space-y-2">
                    <Label>3. Correspondance des colonnes</Label>
                    <div className="border rounded-lg overflow-auto max-h-72">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Colonne Excel</TableHead>
                            <TableHead>Aperçu</TableHead>
                            <TableHead>→ Colonne DB</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {importData.headers.map((h, i) => (
                            <TableRow key={i}>
                              <TableCell className="font-medium text-sm">{h}</TableCell>
                              <TableCell className="text-xs text-muted-foreground max-w-32 truncate">{String(importData.rows[0]?.[i] ?? '')}</TableCell>
                              <TableCell>
                                <Select value={columnMapping[h] || '_skip'} onValueChange={(v) => setColumnMapping(prev => ({ ...prev, [h]: v === '_skip' ? '' : v }))}>
                                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="_skip">— Ignorer —</SelectItem>
                                    {tableColumns.map(c => (
                                      <SelectItem key={c.column_name} value={c.column_name}>{c.column_name} ({c.data_type})</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}

                {/* Step 4: Import */}
                {importData && importTable && (
                  <Button onClick={handleImport} disabled={importing} className="w-full">
                    {importing ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Importation en cours...</> : <><Download className="w-4 h-4 mr-2" />Importer {importData.rows.length} lignes dans {importTable}</>}
                  </Button>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* ============ Create Dialog ============ */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Créer un utilisateur</DialogTitle>
            <DialogDescription>Remplissez les informations du nouvel utilisateur</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Identifiant *</Label><Input value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} placeholder="ex: admin" /></div>
              <div><Label>Mot de passe *</Label><Input type="password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} placeholder="Min 4 car." /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Nom</Label><Input value={formData.first_name} onChange={e => setFormData({...formData, first_name: e.target.value})} /></div>
              <div><Label>Prénom</Label><Input value={formData.last_name} onChange={e => setFormData({...formData, last_name: e.target.value})} /></div>
            </div>
            <div><Label>Email</Label><Input value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>DREN</Label><Input value={formData.dren} onChange={e => setFormData({...formData, dren: e.target.value})} /></div>
              <div><Label>CISCO</Label><Input value={formData.cisco} onChange={e => setFormData({...formData, cisco: e.target.value})} /></div>
            </div>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2"><Switch checked={formData.is_active} onCheckedChange={v => setFormData({...formData, is_active: v})} /><Label>Actif</Label></div>
              <div className="flex items-center gap-2"><Switch checked={formData.is_staff} onCheckedChange={v => setFormData({...formData, is_staff: v})} /><Label>Staff</Label></div>
              <div className="flex items-center gap-2"><Switch checked={formData.is_superuser} onCheckedChange={v => setFormData({...formData, is_superuser: v})} /><Label>Admin</Label></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Annuler</Button>
            <Button onClick={handleCreate}><Plus className="w-4 h-4 mr-1" />Créer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============ Edit Dialog ============ */}
      <Dialog open={!!editUser} onOpenChange={() => setEditUser(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Modifier: {editUser?.username}</DialogTitle>
            <DialogDescription>Modifiez les informations de l'utilisateur</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Nom</Label><Input value={editForm.first_name} onChange={e => setEditForm({...editForm, first_name: e.target.value})} /></div>
              <div><Label>Prénom</Label><Input value={editForm.last_name} onChange={e => setEditForm({...editForm, last_name: e.target.value})} /></div>
            </div>
            <div><Label>Email</Label><Input value={editForm.email} onChange={e => setEditForm({...editForm, email: e.target.value})} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>DREN</Label><Input value={editForm.dren} onChange={e => setEditForm({...editForm, dren: e.target.value})} /></div>
              <div><Label>CISCO</Label><Input value={editForm.cisco} onChange={e => setEditForm({...editForm, cisco: e.target.value})} /></div>
            </div>
            <div><Label>Nouveau mot de passe (laisser vide pour ne pas changer)</Label><Input type="password" value={editForm.newPassword} onChange={e => setEditForm({...editForm, newPassword: e.target.value})} placeholder="Laisser vide..." /></div>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2"><Switch checked={editForm.is_active} onCheckedChange={v => setEditForm({...editForm, is_active: v})} /><Label>Actif</Label></div>
              <div className="flex items-center gap-2"><Switch checked={editForm.is_staff} onCheckedChange={v => setEditForm({...editForm, is_staff: v})} /><Label>Staff</Label></div>
              <div className="flex items-center gap-2"><Switch checked={editForm.is_superuser} onCheckedChange={v => setEditForm({...editForm, is_superuser: v})} /><Label>Admin</Label></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUser(null)}>Annuler</Button>
            <Button onClick={handleUpdate}><Pencil className="w-4 h-4 mr-1" />Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============ Delete Dialog ============ */}
      <Dialog open={!!showDelete} onOpenChange={() => setShowDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supprimer l'utilisateur</DialogTitle>
            <DialogDescription>Êtes-vous sûr de vouloir supprimer <strong>{showDelete?.username}</strong> ? Cette action est irréversible.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDelete(null)}>Annuler</Button>
            <Button variant="destructive" onClick={handleDelete}><Trash2 className="w-4 h-4 mr-1" />Supprimer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Utilisateurs;
