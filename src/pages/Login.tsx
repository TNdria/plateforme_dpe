import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { User, Lock, Loader2, ArrowRight, Eye, EyeOff, ShieldCheck, Sparkles } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { AnimatedLogo } from "@/components/AnimatedLogo";

const Login = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const result = await login(username, password);
      
      if (result.success) {
        toast.success("Connexion réussie");
        navigate(result.redirect || '/dashboard');
      } else {
        setError(result.error || "Identifiants invalides");
      }
    } catch (err) {
      console.error('Login error:', err);
      setError("Identifiants invalides ou compte pas encore activé, veuillez réessayer ou contacter l'administrateur");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-info/5" />
      <div className="absolute inset-0 bg-grid-pattern opacity-30" />
      
      {/* Decorative Elements */}
      <div className="absolute top-20 left-20 w-72 h-72 bg-primary/10 rounded-full blur-3xl animate-float" />
      <div className="absolute bottom-20 right-20 w-96 h-96 bg-info/10 rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }} />
      <div className="absolute top-1/2 left-1/4 w-48 h-48 bg-secondary/10 rounded-full blur-3xl animate-float" style={{ animationDelay: '4s' }} />

      {/* Content */}
      <div className="relative z-10 min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          {/* Logo Section — animated MEN ↔ DPE */}
          <div className="text-center mb-8 animate-fade-in-up">
            <div className="inline-flex items-center justify-center mb-5">
              <div className="relative group">
                <div className="absolute -inset-2 bg-gradient-to-br from-primary/40 via-info/30 to-primary/40 rounded-3xl blur-xl group-hover:blur-2xl transition-all animate-pulse-soft" />
                <div className="relative h-24 w-24 bg-white rounded-2xl flex items-center justify-center shadow-2xl ring-1 ring-border/40 p-2 transition-transform group-hover:scale-105">
                  <AnimatedLogo className="h-full w-full rounded-xl" imgClassName="object-contain rounded-xl" interval={2600} />
                </div>
                <Sparkles className="absolute -top-1.5 -right-1.5 h-5 w-5 text-warning animate-pulse-soft drop-shadow" />
              </div>
            </div>
            <h1 className="text-3xl font-bold font-heading tracking-tight bg-gradient-to-r from-primary to-info bg-clip-text text-transparent">
              DPE Plateforme
            </h1>
            <p className="text-muted-foreground mt-2 text-sm">
              Système de Gestion & Pilotage du Système Éducatif
            </p>
          </div>

          {/* Login Card */}
          <Card className="border-0 shadow-2xl shadow-primary/10 bg-card/80 backdrop-blur-xl animate-fade-in-up overflow-hidden" style={{ animationDelay: '0.1s' }}>
            <CardHeader className="text-center pb-2">
              <CardTitle className="text-xl">Connexion</CardTitle>
              <CardDescription>Accédez à votre espace de travail</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="username" className="text-sm font-medium">Nom d'utilisateur</Label>
                  <div className="relative group">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 h-8 w-8 rounded-lg bg-muted flex items-center justify-center transition-colors group-focus-within:bg-primary/10">
                      <User className="h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
                    </div>
                    <Input
                      id="username"
                      placeholder="Entrez votre identifiant"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="pl-14 h-12 rounded-xl border-muted bg-muted/30 focus:bg-background focus:border-primary transition-all duration-200"
                      required
                      autoComplete="username"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-medium">Mot de passe</Label>
                  <div className="relative group">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 h-8 w-8 rounded-lg bg-muted flex items-center justify-center transition-colors group-focus-within:bg-primary/10">
                      <Lock className="h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
                    </div>
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Entrez votre mot de passe"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-14 pr-12 h-12 rounded-xl border-muted bg-muted/30 focus:bg-background focus:border-primary transition-all duration-200"
                      required
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                      aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 animate-scale-in">
                    <p className="text-sm text-destructive font-medium">{error}</p>
                  </div>
                )}

                <Button 
                  type="submit" 
                  className="w-full h-12 rounded-xl text-base font-semibold bg-gradient-to-r from-primary to-info hover:from-primary/90 hover:to-info/90 shadow-lg shadow-primary/25 transition-all duration-300 hover:shadow-xl hover:shadow-primary/30 hover:-translate-y-0.5 group" 
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <>
                      Se connecter
                      <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
                    </>
                  )}
                </Button>
              </form>
              <div className="mt-5 flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5 text-secondary" />
                <span>Connexion sécurisée et chiffrée</span>
              </div>
            </CardContent>
          </Card>
          
          {/* Footer */}
          <div className="mt-8 text-center animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-muted/50 backdrop-blur-sm">
              <div className="h-2 w-2 rounded-full bg-secondary animate-pulse" />
              <p className="text-xs text-muted-foreground">
                Ministère de l'Éducation Nationale
              </p>
            </div>
            <p className="text-xs text-muted-foreground mt-2 opacity-60">
              Direction de la Planification de l'Éducation
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
