import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { User, Save, Shield, KeyRound, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const Profil = () => {
  const { user, updateProfile } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  
  const [userData, setUserData] = useState({
    username: '',
    first_name: '',
    last_name: '',
  });

  const [passwords, setPasswords] = useState({
    current: '',
    new: '',
    confirm: '',
  });

  useEffect(() => {
    if (user) {
      setUserData({
        username: user.username,
        first_name: user.first_name,
        last_name: user.last_name,
      });
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!passwords.current) {
      toast.error('Le mot de passe actuel est obligatoire');
      return;
    }

    if (passwords.new && passwords.new !== passwords.confirm) {
      toast.error('Confirmation du nouveau mot de passe incorrecte!');
      return;
    }

    setIsLoading(true);
    
    try {
      const result = await updateProfile({
        first_name: userData.first_name,
        last_name: userData.last_name,
        current_password: passwords.current,
        new_password: passwords.new || undefined,
      });

      if (result.success) {
        toast.success(`Utilisateur ${userData.username} mis à jour avec succès.`);
        setPasswords({ current: '', new: '', confirm: '' });
      } else {
        toast.error(result.error || 'Erreur lors de la mise à jour');
      }
    } catch (error) {
      toast.error('Erreur lors de la mise à jour du profil');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Breadcrumb */}
      <div className="px-6 py-4 bg-gradient-to-r from-primary/10 to-info/10 border-b border-border">
        <div className="flex items-center gap-2">
          <User className="h-5 w-5 text-primary" />
          <span className="text-sm font-semibold text-foreground">
            ADMINISTRATION / UTILISATEURS / PROFIL
          </span>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6 bg-muted/30">
        <Card className="w-full max-w-lg shadow-xl border-0">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto mb-4 w-20 h-20 bg-gradient-to-br from-primary/20 to-info/20 rounded-full flex items-center justify-center ring-4 ring-primary/10">
              <User className="w-10 h-10 text-primary" />
            </div>
            <CardTitle className="text-2xl font-bold">Profil utilisateur</CardTitle>
            <CardDescription>Gérez vos informations personnelles et votre mot de passe</CardDescription>
          </CardHeader>
          <CardContent className="px-8 pb-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* User Info Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Shield className="h-4 w-4" />
                  Informations du compte
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="username">Nom d'utilisateur</Label>
                  <div className="relative">
                    <Input
                      id="username"
                      value={userData.username}
                      readOnly
                      className="bg-muted pl-10"
                    />
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="first_name">Nom</Label>
                    <Input
                      id="first_name"
                      placeholder="Votre nom"
                      value={userData.first_name}
                      onChange={(e) => setUserData({ ...userData, first_name: e.target.value })}
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="last_name">Prénom(s)</Label>
                    <Input
                      id="last_name"
                      placeholder="Votre prénom"
                      value={userData.last_name}
                      onChange={(e) => setUserData({ ...userData, last_name: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <Separator className="my-6" />

              {/* Password Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <KeyRound className="h-4 w-4" />
                  Sécurité
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="current_password">
                    Mot de passe actuel <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="current_password"
                    type="password"
                    placeholder="Entrez votre mot de passe actuel"
                    value={passwords.current}
                    onChange={(e) => setPasswords({ ...passwords, current: e.target.value })}
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="new_password">Nouveau mot de passe</Label>
                    <Input
                      id="new_password"
                      type="password"
                      placeholder="Nouveau mot de passe"
                      minLength={4}
                      value={passwords.new}
                      onChange={(e) => setPasswords({ ...passwords, new: e.target.value })}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="confirm_password">Confirmation</Label>
                    <Input
                      id="confirm_password"
                      type="password"
                      placeholder="Confirmer le mot de passe"
                      minLength={4}
                      value={passwords.confirm}
                      onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
                    />
                  </div>
                </div>
              </div>
              
              <Button 
                type="submit" 
                className="w-full h-12 text-base font-semibold bg-gradient-to-r from-primary to-info hover:from-primary/90 hover:to-info/90 shadow-lg"
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Save className="w-5 h-5 mr-2" />
                    Enregistrer les modifications
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Profil;
