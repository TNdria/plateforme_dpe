import { User, LogOut, ShieldCheck, Settings, ChevronDown, HelpCircle, LogIn } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { NotificationsBell } from "./NotificationsBell";

const Header = () => {
  const navigate = useNavigate();
  const { user, logout, isAuthenticated } = useAuth();

  const handleLogout = () => {
    logout();
    toast.success("Déconnexion réussie");
    navigate("/login", { replace: true });
  };

  const initials = isAuthenticated && user
    ? `${(user.first_name?.[0] || user.username?.[0] || "U").toUpperCase()}${
        (user.last_name?.[0] || "").toUpperCase()
      }`
    : "G";

  const fullName =
    isAuthenticated && user
      ? (user.first_name || user.last_name)
        ? `${user.first_name || ""} ${user.last_name || ""}`.trim()
        : user.username
      : "Mode invité";

  const role = !isAuthenticated
    ? { label: "Non connecté", className: "bg-muted text-muted-foreground border-border" }
    : user?.is_superuser
    ? { label: "Administrateur", className: "bg-primary/15 text-primary border-primary/30" }
    : user?.is_staff
    ? { label: "Staff", className: "bg-secondary text-secondary-foreground" }
    : user?.cisco && Number(user.cisco) > 0
    ? { label: `CISCO ${user.cisco}`, className: "bg-info/15 text-info-foreground border-info/30" }
    : user?.dren && Number(user.dren) > 0
    ? { label: `DREN ${user.dren}`, className: "bg-info/15 text-info-foreground border-info/30" }
    : { label: "Utilisateur", className: "bg-muted text-muted-foreground" };

  return (
    <header className="sticky top-0 z-50 h-16 bg-gradient-to-r from-background via-background to-accent/40 backdrop-blur-xl border-b border-border/60 flex items-center justify-end px-4 sm:px-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      <div className="flex items-center gap-1 sm:gap-2">
        {/* Notifications — only when authenticated */}
        {isAuthenticated && <NotificationsBell />}

        {/* User Menu (PDP) — toutes les actions (login, aide, profil, admin, logout) sont ici */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="flex items-center gap-2 sm:gap-3 p-1 sm:pr-2.5 rounded-full hover:bg-muted/80 transition-all duration-200 group"
              aria-label={isAuthenticated ? "Menu utilisateur" : "Menu invité"}
            >
              <Avatar
                className={`h-9 w-9 ring-2 transition-all ${
                  isAuthenticated
                    ? "ring-primary/25 group-hover:ring-primary/50"
                    : "ring-muted-foreground/20 group-hover:ring-muted-foreground/40"
                }`}
              >
                <AvatarFallback
                  className={`text-sm font-semibold ${
                    isAuthenticated
                      ? "bg-gradient-to-br from-primary to-info text-primary-foreground"
                      : "bg-gradient-to-br from-muted-foreground/30 to-muted-foreground/50 text-foreground"
                  }`}
                >
                  {isAuthenticated ? initials : <User className="w-4 h-4" />}
                </AvatarFallback>
              </Avatar>
              <div className="hidden sm:flex flex-col items-start leading-tight">
                <span className="text-sm font-semibold text-foreground max-w-[160px] truncate">
                  {fullName}
                </span>
                <Badge
                  variant="outline"
                  className={`text-[10px] px-1.5 py-0 h-4 mt-0.5 ${role.className}`}
                >
                  {user?.is_superuser && <ShieldCheck className="w-2.5 h-2.5 mr-0.5" />}
                  {role.label}
                </Badge>
              </div>
              <ChevronDown className="hidden sm:block w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72 p-0 overflow-hidden border-border/60 shadow-xl">
            {isAuthenticated ? (
              <>
                <div className="px-4 pt-4 pb-3 bg-gradient-to-br from-primary/10 via-primary/5 to-info/10 border-b">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-12 w-12 ring-2 ring-background shadow-md">
                      <AvatarFallback className="bg-gradient-to-br from-primary to-info text-primary-foreground font-bold">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="font-semibold text-sm truncate">{fullName}</span>
                      <span className="text-xs text-muted-foreground truncate">@{user?.username || "—"}</span>
                      <Badge
                        variant="outline"
                        className={`text-[10px] px-1.5 py-0 h-4 mt-1 w-fit ${role.className}`}
                      >
                        {user?.is_superuser && <ShieldCheck className="w-2.5 h-2.5 mr-0.5" />}
                        {role.label}
                      </Badge>
                    </div>
                  </div>
                </div>
                <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium pt-2 px-3">
                  Compte
                </DropdownMenuLabel>
                <DropdownMenuItem asChild>
                  <Link to="/profil" className="cursor-pointer mx-1 rounded-md">
                    <User className="w-4 h-4 mr-2" />
                    Mon profil
                  </Link>
                </DropdownMenuItem>
                {user?.is_superuser && (
                  <DropdownMenuItem asChild>
                    <Link to="/admin" className="cursor-pointer mx-1 rounded-md">
                      <Settings className="w-4 h-4 mr-2" />
                      Administration
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10 mx-1 mb-1 rounded-md"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Déconnexion
                </DropdownMenuItem>
              </>
            ) : (
              <>
                <div className="px-4 pt-4 pb-3 bg-gradient-to-br from-muted/50 via-muted/30 to-muted/50 border-b">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-12 w-12 ring-2 ring-background shadow-md">
                      <AvatarFallback className="bg-gradient-to-br from-muted-foreground/30 to-muted-foreground/50 text-foreground">
                        <User className="w-5 h-5" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="font-semibold text-sm">Mode invité</span>
                      <span className="text-xs text-muted-foreground">
                        Connectez-vous pour accéder à toutes les fonctionnalités
                      </span>
                    </div>
                  </div>
                </div>
                <div className="p-2 space-y-1">
                  <DropdownMenuItem asChild>
                    <Link
                      to="/login"
                      className="cursor-pointer rounded-md bg-primary text-primary-foreground hover:bg-primary/90 focus:bg-primary/90 focus:text-primary-foreground justify-center font-medium"
                    >
                      <LogIn className="w-4 h-4 mr-2" />
                      Se connecter
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/" className="cursor-pointer rounded-md">
                      <HelpCircle className="w-4 h-4 mr-2" />
                      En savoir plus
                    </Link>
                  </DropdownMenuItem>
                </div>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};

export default Header;
