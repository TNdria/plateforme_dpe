import { useState, useMemo } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Database,
  MapPin,
  Map,
  BarChart3,
  FileText,
  GraduationCap,
  Users,
  ClipboardList,
  LogOut,
  Settings,
  User,
  Home,
  Menu,
  X,
} from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useAuth } from "@/contexts/AuthContext";
import { AnimatedLogo } from "@/components/AnimatedLogo";

interface MenuChild {
  label: string;
  path: string;
  requiresAuth?: boolean;
  adminOnly?: boolean;
  guestOnly?: boolean;
}

interface MenuItem {
  label: string;
  icon: React.ElementType;
  path?: string;
  children?: MenuChild[];
  requiresAuth?: boolean;
  adminOnly?: boolean;
}

const menuItems: { section?: string; items: MenuItem[] }[] = [
  {
    items: [
      { label: "Accueil", icon: Home, path: "/" },
      { label: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
    ],
  },
  {
    section: "DATA MUST SPEAK",
    items: [
      {
        label: "Tableau de Bord",
        icon: BarChart3,
        children: [
          { label: "TDB DREN", path: "/tdb-dren" },
          { label: "TDB CISCO", path: "/tdb-cisco" },
          { label: "TDB ZAP", path: "/tdb-zap" },
          { label: "TDB École", path: "/tdb-ecole" },
        ],
      },
    ],
  },
  {
    section: "STATISTIQUES",
    items: [
      {
        label: "Données",
        icon: Database,
        children: [
          { label: "Préscolaire", path: "/donnees/prescolaire" },
          { label: "Primaire", path: "/donnees/primaire" },
          { label: "Collège", path: "/donnees/college" },
          { label: "Lycée", path: "/donnees/lycee" },
        ],
      },
      {
        label: "Besoins",
        icon: GraduationCap,
        requiresAuth: true,
        children: [
          { label: "Besoins Primaire", path: "/besoins/primaire" },
          { label: "Besoins Collège", path: "/besoins/college" },
          { label: "Besoins Lycée", path: "/besoins/lycee" },
        ],
      },
    ],
  },
  {
    section: "CARTOGRAPHIE",
    items: [
      {
        label: "Géolocalisation",
        icon: MapPin,
        children: [
          { label: "ORS Primaire", path: "/ors-primaire", requiresAuth: true },
          { label: "ORS Collège", path: "/ors-college", requiresAuth: true },
          { label: "ORS Lycée", path: "/ors-lycee", requiresAuth: true },
          { label: "Établissement", path: "/sig" },
        ],
      },
      { label: "Carte Thématique", icon: Map, path: "/dataviz" },
    ],
  },
  {
    section: "GESTION",
    items: [
      { label: "Référentiel", icon: ClipboardList, path: "/referentiel", adminOnly: true },
      { label: "Diagnostic", icon: FileText, path: "/diagnostic", requiresAuth: true },
      { label: "Mon Profil", icon: User, path: "/profil", requiresAuth: true },
      { label: "EAGER", icon: Settings, path: "/eager", adminOnly: true },
    ],
  },
];

const Sidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, user, isAuthenticated } = useAuth();
  const isAdmin = !!user?.is_superuser || !!user?.is_staff;
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [openMenus, setOpenMenus] = useState<string[]>(["Tableau de Bord", "Données", "Géolocalisation"]);

  // Filter menu items based on auth/admin state
  const visibleGroups = useMemo(() => {
    return menuItems
      .map((group) => ({
        ...group,
        items: group.items
          .filter((item) => {
            if (item.adminOnly && !isAdmin) return false;
            if (item.requiresAuth && !isAuthenticated) return false;
            return true;
          })
          .map((item) => {
            if (!item.children) return item;
            const filteredChildren = item.children.filter((c) => {
              if (c.adminOnly && !isAdmin) return false;
              if (c.requiresAuth && !isAuthenticated) return false;
              return true;
            });
            return { ...item, children: filteredChildren };
          })
          .filter((item) => !item.children || item.children.length > 0),
      }))
      .filter((group) => group.items.length > 0);
  }, [isAuthenticated, isAdmin]);

  const toggleMenu = (label: string) => {
    setOpenMenus((prev) =>
      prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label]
    );
  };

  const isActive = (path?: string) => {
    if (!path) return false;
    return location.pathname === path;
  };

  const isChildActive = (children?: { path: string }[]) => {
    if (!children) return false;
    return children.some((child) => location.pathname === child.path);
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const handleNavClick = () => {
    setIsMobileOpen(false);
  };

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="flex items-center h-16 px-4 border-b border-sidebar-border">
        <div className="flex items-center gap-2 flex-1">
          <AnimatedLogo size={36} className="rounded-lg shadow-lg shadow-primary/30 ring-1 ring-sidebar-border" imgClassName="rounded-lg" />
          {!isCollapsed && (
            <span className="font-bold text-lg whitespace-nowrap">
              DPE<sup className="text-xs text-sidebar-primary ml-0.5">APP</sup>
            </span>
          )}
        </div>
        {/* Mobile close button */}
        <button
          onClick={() => setIsMobileOpen(false)}
          className="lg:hidden p-1 rounded hover:bg-sidebar-accent"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        {visibleGroups.map((group, groupIndex) => (
          <div key={groupIndex} className="mb-4">
            {group.section && !isCollapsed && (
              <div className="px-3 mb-2 text-[10px] font-semibold text-sidebar-foreground/50 uppercase tracking-[0.12em]">
                {group.section}
              </div>
            )}
            {group.items.map((item) => (
              <div key={item.label}>
                {item.children ? (
                  <Collapsible
                    open={!isCollapsed && openMenus.includes(item.label)}
                    onOpenChange={() => !isCollapsed && toggleMenu(item.label)}
                  >
                    <CollapsibleTrigger asChild>
                      <button
                        className={cn(
                          "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
                          isChildActive(item.children)
                            ? "bg-gradient-to-r from-primary to-primary/80 text-primary-foreground shadow-md shadow-primary/20"
                            : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                        )}
                      >
                        <item.icon className="w-5 h-5 flex-shrink-0" />
                        {!isCollapsed && (
                          <>
                            <span className="flex-1 text-left">{item.label}</span>
                            <ChevronDown
                              className={cn(
                                "w-4 h-4 transition-transform",
                                openMenus.includes(item.label) && "rotate-180"
                              )}
                            />
                          </>
                        )}
                      </button>
                    </CollapsibleTrigger>
                    {!isCollapsed && (
                      <CollapsibleContent className="mt-1 ml-4 space-y-1">
                        {item.children.map((child) => (
                          <Link
                            key={child.path}
                            to={child.path}
                            onClick={handleNavClick}
                            className={cn(
                              "flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all",
                              isActive(child.path)
                                ? "bg-sidebar-primary/15 text-sidebar-primary font-medium border-l-2 border-sidebar-primary pl-2.5"
                                : "text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                            )}
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-current" />
                            {child.label}
                          </Link>
                        ))}
                      </CollapsibleContent>
                    )}
                  </Collapsible>
                ) : (
                  <Link
                    to={item.path!}
                    onClick={handleNavClick}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
                      isActive(item.path)
                        ? "bg-gradient-to-r from-primary to-primary/80 text-primary-foreground shadow-md shadow-primary/20"
                        : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                    )}
                  >
                    <item.icon className="w-5 h-5 flex-shrink-0" />
                    {!isCollapsed && <span>{item.label}</span>}
                  </Link>
                )}
              </div>
            ))}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-sidebar-border space-y-2">
        <button
          onClick={handleLogout}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-sidebar-foreground/80 hover:bg-destructive/15 hover:text-destructive transition-colors",
            isCollapsed && "justify-center"
          )}
        >
          <LogOut className="w-5 h-5 flex-shrink-0" />
          {!isCollapsed && <span>Déconnexion</span>}
        </button>

        {/* Toggle Button - desktop only */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="hidden lg:flex w-full items-center justify-center p-2 rounded-lg bg-sidebar-accent hover:bg-sidebar-accent/70 transition-colors"
        >
          {isCollapsed ? (
            <ChevronRight className="w-5 h-5" />
          ) : (
            <ChevronLeft className="w-5 h-5" />
          )}
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile hamburger button */}
      <button
        onClick={() => setIsMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-sidebar text-sidebar-foreground shadow-lg"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Mobile overlay */}
      {isMobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <aside
        className={cn(
          "lg:hidden fixed inset-y-0 left-0 z-50 w-64 bg-sidebar text-sidebar-foreground flex flex-col transition-transform duration-300",
          isMobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
        style={{ background: "var(--sidebar-gradient)" }}
      >
        {sidebarContent}
      </aside>

      {/* Desktop sidebar */}
      <aside
        className={cn(
          "hidden lg:flex h-screen bg-sidebar text-sidebar-foreground transition-all duration-300 flex-col flex-shrink-0 border-r border-sidebar-border shadow-xl",
          isCollapsed ? "w-16" : "w-56"
        )}
        style={{ background: "var(--sidebar-gradient)" }}
      >
        {sidebarContent}
      </aside>
    </>
  );
};

export default Sidebar;
