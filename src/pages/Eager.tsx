import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, Search, FileCheck, Users, School, ExternalLink } from 'lucide-react';

const Eager = () => {
  const [loading, setLoading] = useState(false);
  const [loginForm, setLoginForm] = useState({ login: '', password: '' });
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginForm.login || !loginForm.password) {
      toast.error('Veuillez remplir tous les champs');
      return;
    }
    
    setLoading(true);
    // Simulate login - connect to real API
    setTimeout(() => {
      setIsAuthenticated(true);
      setLoading(false);
      toast.success('Connexion réussie');
    }, 1000);
  };

  const openDashboard = () => {
    window.open('https://lookerstudio.google.com/u/0/reporting/bd665096-3992-4f24-acdc-e2563a05f716/page/rf5RF', '_blank');
  };

  if (!isAuthenticated) {
    return (
      <div className="h-full flex flex-col">
        <div className="px-4 py-2 bg-muted/50 border-b border-border">
          <span className="text-sm font-semibold text-muted-foreground">
            EAGER / CONNEXION
          </span>
        </div>

        <div className="flex-1 flex items-center justify-center p-4 bg-primary/5">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center">
                <FileCheck className="w-8 h-8 text-primary" />
              </div>
              <CardTitle>EAGER - Vérification des données</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login">Identifiant</Label>
                  <Input
                    id="login"
                    placeholder="Votre identifiant"
                    value={loginForm.login}
                    onChange={(e) => setLoginForm({ ...loginForm, login: e.target.value })}
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="password">Mot de passe</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Votre mot de passe"
                    value={loginForm.password}
                    onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                    required
                  />
                </div>
                
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Search className="w-4 h-4 mr-2" />}
                  Se connecter
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-2 bg-muted/50 border-b border-border">
        <span className="text-sm font-semibold text-muted-foreground">
          EAGER / TABLEAU DE BORD
        </span>
      </div>

      <div className="flex-1 p-4 overflow-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Users className="w-4 h-4" />
                Bénéficiaires
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">-</p>
              <p className="text-xs text-muted-foreground">Total enregistrés</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <School className="w-4 h-4" />
                Établissements
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">-</p>
              <p className="text-xs text-muted-foreground">CEG participants</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <FileCheck className="w-4 h-4" />
                Dossiers validés
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">-</p>
              <p className="text-xs text-muted-foreground">En attente de traitement</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Accès au tableau de bord complet</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              Accédez au tableau de bord complet EAGER sur Google Looker Studio pour visualiser toutes les statistiques et données.
            </p>
            <Button onClick={openDashboard}>
              <ExternalLink className="w-4 h-4 mr-2" />
              Ouvrir le Dashboard EAGER
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Eager;
