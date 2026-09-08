import { useNavigate } from "react-router-dom";
import { useEffect, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  GraduationCap,
  BarChart3,
  Map,
  Users,
  FileText,
  ArrowRight,
  Sparkles,
  School,
  TrendingUp,
  Globe,
  BookOpen,
  Building2,
  UserCheck,
  Shield,
  Cpu,
  Database,
  ChevronRight,
  Target,
  Layers,
  BarChart4,
  MapPin,
  Baby,
  Mail,
} from "lucide-react";
import { referentielApi, dashboardApi } from "@/services/api";
import ministryBuilding from "@/assets/ministry-building.jpg";
import { AnimatedLogo } from "@/components/AnimatedLogo";

const Home = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<{
    drens: number | null;
    ciscos: number | null;
    zaps: number | null;
    etabTotal: number | null;
    etabPublic: number | null;
    etabPrive: number | null;
    eleves: number | null;
    presco: number | null;
    enseignants: number | null;
    annee: number | null;
    loading: boolean;
  }>({
    drens: null,
    ciscos: null,
    zaps: null,
    etabTotal: null,
    etabPublic: null,
    etabPrive: null,
    eleves: null,
    presco: null,
    enseignants: null,
    annee: null,
    loading: true,
  });

  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef(null);

  useEffect(() => {
    // Chiffres réels issus de la base : aucun chiffre n'est inventé.
    const num = (v: any) => {
      const n = Number(v);
      return isNaN(n) ? 0 : n;
    };
    /** Somme des niveaux n1..n3 pour l'année demandée */
    const cell = (row: any, lv: string, annee: number) =>
      num(row?.[`${lv.toUpperCase()}_${annee}`] ?? row?.[`${lv.toLowerCase()}_${annee}`]);
    const sumLevels = (row: any, annee: number, levels: string[]) =>
      levels.reduce((t, lv) => t + cell(row, lv, annee), 0);
    /** Années présentes dans une ligne de statistiques, de la plus récente à la plus ancienne */
    const yearsOf = (row: any) => {
      const years = Object.keys(row || {})
        .map((k) => /_(\d{4})$/.exec(k)?.[1])
        .filter(Boolean)
        .map(Number);
      return [...new Set(years)].sort((a, b) => b - a);
    };

    const fetchCounts = async () => {
      try {
        const [
          drensData,
          ciscosData,
          zapRows,
          etabAll,
          etabPub,
          etabPriv,
          elevesN0N1,
          elevesN2N3,
          ens,
        ] = await Promise.all([
          referentielApi.getDrens().catch(() => [] as any[]),
          dashboardApi.getCiscos(0).catch(() => [] as any[]),
          dashboardApi.getZapCount().catch(() => [] as any[]),
          dashboardApi.getStatsEtablissements(0, 0, 2).catch(() => [] as any[]),
          dashboardApi.getStatsEtablissements(0, 0, 0).catch(() => [] as any[]),
          dashboardApi.getStatsEtablissements(0, 0, 1).catch(() => [] as any[]),
          dashboardApi.getStatsElevesN0N1(0, 0, 2).catch(() => [] as any[]),
          dashboardApi.getStatsElevesN2N3(0, 0, 2).catch(() => [] as any[]),
          dashboardApi.getStatsEnseignants(0, 0, 2).catch(() => [] as any[]),
        ]);

        const etabRow = etabAll?.[0] as any;
        const elevesRow01 = elevesN0N1?.[0] as any;
        const elevesRow23 = elevesN2N3?.[0] as any;
        const ensRow = ens?.[0] as any;
        const scolaire = ["n1", "n2", "n3"];
        // Année commune : la plus récente où établissements, élèves et enseignants ont des données.
        const annee =
          yearsOf(etabRow).find(
            (y) =>
              sumLevels(etabRow, y, scolaire) > 0 &&
              cell(elevesRow01, "n1", y) + cell(elevesRow23, "n2", y) + cell(elevesRow23, "n3", y) >
                0 &&
              sumLevels(ensRow, y, scolaire) > 0,
          ) ?? null;
        const zapTotal = zapRows?.[0]
          ? num(
              (zapRows[0] as any).total ?? (zapRows[0] as any).nbr_zap ?? (zapRows[0] as any).count,
            )
          : null;

        setStats({
          drens: drensData.length || null,
          ciscos: ciscosData.length || null,
          zaps: zapTotal || null,
          etabTotal: annee ? sumLevels(etabRow, annee, scolaire) : null,
          etabPublic: annee && etabPub?.[0] ? sumLevels(etabPub[0], annee, scolaire) : null,
          etabPrive: annee && etabPriv?.[0] ? sumLevels(etabPriv[0], annee, scolaire) : null,
          eleves: annee
            ? cell(elevesRow01, "n1", annee) +
                cell(elevesRow23, "n2", annee) +
                cell(elevesRow23, "n3", annee) || null
            : null,
          presco: annee ? cell(elevesRow01, "n0", annee) || null : null,
          enseignants: annee
            ? cell(ensRow, "n1", annee) + cell(ensRow, "n2", annee) + cell(ensRow, "n3", annee) ||
              null
            : null,
          annee,
          loading: false,
        });
      } catch (e) {
        console.error("Error fetching counts:", e);
        setStats((prev) => ({ ...prev, loading: false }));
      }
    };
    fetchCounts();

    // Animation trigger
    setTimeout(() => setIsVisible(true), 100);

    // Intersection Observer pour animations
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("animate-in");
          }
        });
      },
      { threshold: 0.1 },
    );

    document.querySelectorAll(".scroll-trigger").forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, []);

  const formatNumber = (num: number) => {
    return num.toLocaleString("fr-FR");
  };

  const features = [
    {
      icon: BarChart4,
      title: "Tableau de Bord Intelligent",
      description: "Analyse en temps réel des indicateurs éducatifs avec IA",
      gradient: "from-blue-500 via-blue-600 to-cyan-500",
      path: "/dashboard",
      badge: "Nouveau",
    },
    {
      icon: Map,
      title: "Carte Scolaire Interactive",
      description: "Visualisation géospatiale des infrastructures éducatives",
      gradient: "from-emerald-500 via-teal-500 to-green-500",
      path: "/ors-primaire",
      badge: "3D",
    },
    {
      icon: Database,
      title: "Base de Données Centralisée",
      description: "Données structurées et normalisées pour tous les niveaux",
      gradient: "from-orange-500 via-amber-500 to-yellow-500",
      path: "/donnees/primaire",
      badge: "Sécurisé",
    },
    {
      icon: Layers,
      title: "Référentiel Unifié",
      description: "Gestion centralisée des établissements et acteurs",
      gradient: "from-purple-500 via-violet-500 to-fuchsia-500",
      path: "/referentiel",
      badge: "Complet",
    },
  ];

  const anneeLabel = stats.annee ? `${stats.annee - 1}-${stats.annee}` : null;

  // Icônes normalisées (même famille, même taille) et couleur d'accent unique.
  const statsCards: Array<{
    label: string;
    value: number | null;
    icon: any;
    description: string;
    sub?: string;
    annuel?: boolean;
  }> = [
    {
      label: "Établissements",
      value: stats.etabTotal,
      icon: School,
      description: "Écoles, collèges et lycées",
      annuel: true,
      sub:
        stats.etabPublic !== null || stats.etabPrive !== null
          ? `Publics : ${stats.etabPublic !== null ? formatNumber(stats.etabPublic) : "n.d."} · Privés : ${stats.etabPrive !== null ? formatNumber(stats.etabPrive) : "n.d."}`
          : undefined,
    },
    {
      label: "Élèves",
      value: stats.eleves,
      icon: Users,
      description: "Effectifs primaire, collège et lycée",
      annuel: true,
    },
    {
      label: "Préscolaire",
      value: stats.presco,
      icon: Baby,
      description: "Effectifs du préscolaire",
      annuel: true,
    },
    {
      label: "Enseignants",
      value: stats.enseignants,
      icon: UserCheck,
      description: "Personnel enseignant",
      annuel: true,
    },
    { label: "DREN", value: stats.drens, icon: Globe, description: "Directions régionales" },
    {
      label: "CISCO",
      value: stats.ciscos,
      icon: Building2,
      description: "Circonscriptions scolaires",
    },
    {
      label: "ZAP",
      value: stats.zaps,
      icon: MapPin,
      description: "Zones d'administration pédagogique",
    },
  ];

  const highlights = [
    {
      icon: Shield,
      title: "Sécurité Maximale",
      description: "Certification ISO 27001 & chiffrement des données",
    },
    {
      icon: Cpu,
      title: "Performance Optimisée",
      description: "Temps de réponse < 200ms pour 95% des requêtes",
    },
    {
      icon: Target,
      title: "Précision des Données",
      description: "Taux de fiabilité > 99.8% sur les indicateurs",
    },
  ];

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-gray-900 via-black to-primary/20">
      {/* Animated Background */}
      <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:60px_60px]" />

      {/* Hero Gradient */}
      <div className="absolute top-0 left-0 right-0 h-[800px] bg-gradient-to-b from-primary/20 via-transparent to-transparent" />

      {/* Background Image avec parallax */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-20"
        style={{
          backgroundImage: `url(${ministryBuilding})`,
          backgroundAttachment: "fixed",
        }}
      />

      {/* Animated Orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-primary/10 rounded-full blur-3xl animate-pulse-slow" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-info/10 rounded-full blur-3xl animate-pulse-slow delay-1000" />

        {[...Array(15)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-white/30 rounded-full animate-orbital"
            style={{
              left: `${10 + i * 6}%`,
              top: `${20 + i * 4}%`,
              animationDelay: `${i * 0.5}s`,
              animationDuration: `${10 + i}s`,
            }}
          />
        ))}
      </div>

      <div className="relative z-10">
        {/* Navigation */}
        <nav className="container mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <AnimatedLogo className="h-14 w-14 shadow-lg border-2 border-white/20" />
              <div className="flex flex-col">
                <span className="text-lg font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                  DPE Plateforme
                </span>
                <span className="text-xs text-gray-400">Ministère de l'Éducation Nationale</span>
              </div>
            </div>
            <div className="hidden md:flex items-center gap-6">
              <a
                href="#stats"
                className="text-gray-300 hover:text-white transition-colors font-medium"
              >
                Chiffres clés
              </a>
              <a
                href="#tdb"
                className="text-gray-300 hover:text-white transition-colors font-medium"
              >
                Tableaux de bord
              </a>
              <a
                href="#ors"
                className="text-gray-300 hover:text-white transition-colors font-medium"
              >
                ORS
              </a>
              <a
                href="#analyse"
                className="text-gray-300 hover:text-white transition-colors font-medium"
              >
                DataViz
              </a>
              <a
                href="#contact"
                className="text-gray-300 hover:text-white transition-colors font-medium"
              >
                Contact
              </a>
            </div>
            <Button
              variant="ghost"
              className="text-white hover:bg-white/10"
              onClick={() => navigate("/login")}
            >
              Connexion
            </Button>
          </div>
        </nav>

        {/* Hero Section */}
        <section
          className={`container mx-auto px-6 py-16 md:py-32 transition-all duration-1000 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}
        >
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm rounded-full mb-8 animate-fade-in">
                <Sparkles className="h-4 w-4 text-warning" />
                <span className="text-sm text-gray-300">Plateforme Officielle • Version 3.0</span>
              </div>

              <h1 className="text-5xl md:text-8xl lg:text-7xl font-bold font-heading tracking-tight mb-6">
                <span className="bg-gradient-to-r from-white via-primary-foreground to-info bg-clip-text text-transparent">
                  Direction de la Planification de l'Éducation
                </span>
              </h1>

              <p className="text-xl md:text-2xl text-gray-400 max-w-3xl mx-auto mb-10 leading-relaxed">
                Plateforme de gouvernance éducative intégrée pour la planification stratégique et
                l'analyse des données nationales
              </p>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-6 justify-center items-center mt-16">
              <Button
                size="lg"
                className="h-16 px-12 text-lg font-semibold bg-gradient-to-r from-primary via-primary to-info hover:from-primary/90 hover:via-primary/90 hover:to-info/90 shadow-2xl shadow-primary/30 group transform transition-all duration-300 hover:scale-105"
                onClick={() => navigate("/login")}
              >
                <span className="mr-3">Accéder à l'espace sécurisé</span>
                <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-2" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-16 px-12 text-lg font-semibold border-2 border-white/20 text-white bg-white/5 backdrop-blur-lg hover:bg-white/10 hover:border-white/40 transform transition-all duration-300 hover:scale-105"
                onClick={() => navigate("/dashboard")}
              >
                <span className="mr-3">Explorer les données</span>
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>

            {/* Highlights retirés à la demande (Sécurité/Performance/Précision) */}
          </div>
        </section>

        {/* Stats Section */}
        <section id="stats" className="container mx-auto px-6 py-20 scroll-trigger">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-5xl font-bold mb-6 text-white">
                <span className="bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                  Chiffres Clés
                </span>
                <span className="block text-lg md:text-xl text-gray-400 font-normal mt-4">
                  Données nationales consolidées
                  {anneeLabel ? ` · Année scolaire ${anneeLabel}` : ""}
                </span>
              </h2>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-4">
              {statsCards.map((stat, index) => (
                <div
                  key={stat.label}
                  className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-white/5 to-white/10 backdrop-blur-sm border border-white/10 p-6 hover:border-white/20 transition-all duration-500 hover:scale-105 scroll-trigger"
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  {/* Hover effect */}
                  <div className="absolute inset-0 bg-gradient-to-br from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                  <div className="relative z-10">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl mb-4 bg-white/10 ring-1 ring-white/15 text-primary-foreground">
                      <stat.icon className="w-6 h-6" strokeWidth={1.75} />
                    </div>

                    <div className="text-2xl md:text-3xl font-bold text-white mb-2 tabular-nums">
                      {stats.loading ? (
                        <div className="h-8 w-full bg-white/10 rounded-lg animate-pulse" />
                      ) : stat.value === null ? (
                        <span className="text-base font-medium text-gray-400">
                          Donnée non disponible
                        </span>
                      ) : (
                        <span>{formatNumber(stat.value)}</span>
                      )}
                    </div>

                    <div className="space-y-1">
                      <div className="text-sm font-semibold text-white">{stat.label}</div>
                      <div className="text-xs text-gray-400">{stat.description}</div>
                      {stat.sub && <div className="text-xs text-gray-400">{stat.sub}</div>}
                      {stat.annuel && anneeLabel && (
                        <div className="text-[11px] text-gray-500">Année scolaire {anneeLabel}</div>
                      )}
                    </div>

                    {/* Animated border */}
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-white/30 to-transparent transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="container mx-auto px-6 py-20 scroll-trigger">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <div className="inline-block px-4 py-2 bg-primary/20 backdrop-blur-sm rounded-full mb-4">
                <span className="text-sm font-semibold text-primary">FONCTIONNALITÉS</span>
              </div>
              <h2 className="text-3xl md:text-5xl font-bold mb-6 text-white">
                Une plateforme <span className="text-primary">complète</span>
              </h2>
              <p className="text-lg text-gray-400 max-w-2xl mx-auto">
                Tous les outils nécessaires pour la gestion et l'analyse du système éducatif
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {features.map((feature, index) => (
                <div
                  key={feature.title}
                  className="group relative overflow-hidden rounded-3xl bg-gradient-to-b from-white/5 to-white/10 backdrop-blur-sm border border-white/10 hover:border-white/30 transition-all duration-500 hover:-translate-y-2 cursor-pointer scroll-trigger"
                  onClick={() => navigate(feature.path)}
                  style={{ animationDelay: `${index * 0.15}s` }}
                >
                  {/* Gradient overlay */}
                  <div className="absolute inset-0 bg-gradient-to-br from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                  <div className="relative z-10 p-8 h-full flex flex-col">
                    {/* Badge */}
                    {feature.badge && (
                      <div className="inline-flex items-center justify-center px-3 py-1 bg-white/10 backdrop-blur-sm rounded-full mb-6 self-start">
                        <span className="text-xs font-medium text-white">{feature.badge}</span>
                      </div>
                    )}

                    {/* Icon */}
                    <div
                      className={`inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br ${feature.gradient} rounded-3xl mb-6 shadow-2xl group-hover:scale-110 group-hover:rotate-3 transition-all duration-500`}
                    >
                      <feature.icon className="w-10 h-10 text-white" />
                    </div>

                    {/* Content */}
                    <div className="flex-grow">
                      <h3 className="text-xl font-bold text-white mb-3 group-hover:text-primary-foreground transition-colors">
                        {feature.title}
                      </h3>
                      <p className="text-gray-400 mb-6 leading-relaxed">{feature.description}</p>
                    </div>

                    {/* CTA */}
                    <div className="flex items-center justify-between pt-6 border-t border-white/10 group-hover:border-white/20 transition-colors">
                      <span className="text-sm font-medium text-white opacity-0 group-hover:opacity-100 translate-x-4 group-hover:translate-x-0 transition-all duration-300">
                        Explorer
                      </span>
                      <div className="p-2 bg-white/10 rounded-lg group-hover:bg-primary/20 transition-colors">
                        <ArrowRight className="h-5 w-5 text-white transform group-hover:translate-x-1 transition-transform" />
                      </div>
                    </div>
                  </div>

                  {/* Shine effect */}
                  <div className="absolute top-0 -left-full w-1/2 h-full bg-gradient-to-r from-transparent via-white/10 to-transparent group-hover:left-full transition-all duration-1000" />
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ORS Modules Section */}
        <section id="ors" className="container mx-auto px-6 py-20 scroll-trigger">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <div className="inline-block px-4 py-2 bg-emerald-500/20 backdrop-blur-sm rounded-full mb-4">
                <span className="text-sm font-semibold text-emerald-300">CARTE SCOLAIRE ORS</span>
              </div>
              <h2 className="text-3xl md:text-5xl font-bold mb-6 text-white">
                Organisation du <span className="text-emerald-400">Réseau Scolaire</span>
              </h2>
              <p className="text-lg text-gray-400 max-w-2xl mx-auto">
                Analyse géospatiale des établissements et villages pour planifier les implantations
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                {
                  title: "ORS Primaire",
                  desc: "EPP & écoles primaires",
                  path: "/ors-primaire",
                  icon: School,
                  color: "from-emerald-500 to-teal-500",
                },
                {
                  title: "ORS Collèges",
                  desc: "Collèges publics & privés",
                  path: "/ors-college",
                  icon: BookOpen,
                  color: "from-cyan-500 to-blue-500",
                },
                {
                  title: "ORS Lycée",
                  desc: "Lycées publics & privés",
                  path: "/ors-lycee",
                  icon: GraduationCap,
                  color: "from-indigo-500 to-purple-500",
                },
              ].map((m, i) => (
                <div
                  key={m.title}
                  onClick={() => navigate(m.path)}
                  className="group relative cursor-pointer rounded-3xl bg-white/5 backdrop-blur-sm border border-white/10 hover:border-white/30 p-8 transition-all duration-500 hover:-translate-y-2 scroll-trigger"
                  style={{ animationDelay: `${i * 0.15}s` }}
                >
                  <div
                    className={`inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br ${m.color} rounded-2xl mb-6 shadow-xl group-hover:scale-110 transition-transform`}
                  >
                    <m.icon className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">{m.title}</h3>
                  <p className="text-gray-400 mb-4">{m.desc}</p>
                  <div className="flex items-center gap-2 text-sm text-emerald-300 font-medium">
                    Ouvrir la carte{" "}
                    <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              ))}
            </div>
            <p className="text-center text-xs text-gray-500 mt-8">
              <Shield className="inline h-3 w-3 mr-1" /> Connexion requise pour accéder aux modules
              ORS
            </p>
          </div>
        </section>

        {/* TDB Section */}
        <section id="tdb" className="container mx-auto px-6 py-20 scroll-trigger">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <div className="inline-block px-4 py-2 bg-info/20 backdrop-blur-sm rounded-full mb-4">
                <span className="text-sm font-semibold text-info">TABLEAUX DE BORD</span>
              </div>
              <h2 className="text-3xl md:text-5xl font-bold mb-6 text-white">
                Pilotage par <span className="text-info">niveau territorial</span>
              </h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                {
                  title: "TDB DREN",
                  path: "/tdb-dren",
                  icon: Globe,
                  color: "from-blue-500 to-cyan-500",
                },
                {
                  title: "TDB CISCO",
                  path: "/tdb-cisco",
                  icon: Building2,
                  color: "from-indigo-500 to-purple-500",
                },
                {
                  title: "TDB ZAP",
                  path: "/tdb-zap",
                  icon: MapPin,
                  color: "from-teal-500 to-cyan-500",
                },
                {
                  title: "TDB École",
                  path: "/tdb-ecole",
                  icon: School,
                  color: "from-pink-500 to-rose-500",
                },
              ].map((t, i) => (
                <div
                  key={t.title}
                  onClick={() => navigate(t.path)}
                  className="group cursor-pointer rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 hover:border-white/30 p-6 transition-all hover:-translate-y-1 scroll-trigger"
                  style={{ animationDelay: `${i * 0.1}s` }}
                >
                  <div
                    className={`inline-flex items-center justify-center w-12 h-12 bg-gradient-to-br ${t.color} rounded-xl mb-4 shadow-lg group-hover:scale-110 transition-transform`}
                  >
                    <t.icon className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="font-bold text-white">{t.title}</h3>
                  <ArrowRight className="h-4 w-4 text-gray-400 mt-2 group-hover:text-white group-hover:translate-x-1 transition-all" />
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Analyse / Diagnostic Section */}
        <section id="analyse" className="container mx-auto px-6 py-20 scroll-trigger">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <div className="inline-block px-4 py-2 bg-warning/20 backdrop-blur-sm rounded-full mb-4">
                <span className="text-sm font-semibold text-warning">ANALYSE & PROSPECTIVE</span>
              </div>
              <h2 className="text-3xl md:text-5xl font-bold mb-6 text-white">
                Outils d'<span className="text-warning">analyse avancée</span>
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                {
                  title: "Diagnostic IA",
                  desc: "Analyse intelligente des indicateurs éducatifs",
                  path: "/diagnostic",
                  icon: Sparkles,
                  color: "from-amber-500 to-orange-500",
                },
                {
                  title: "Besoins",
                  desc: "Évaluation des besoins en infrastructure et ressources",
                  path: "/besoins",
                  icon: Target,
                  color: "from-rose-500 to-pink-500",
                },
                {
                  title: "DataViz",
                  desc: "Cartographie thématique et visualisation des données",
                  path: "/dataviz",
                  icon: BarChart4,
                  color: "from-violet-500 to-fuchsia-500",
                },
              ].map((a, i) => (
                <div
                  key={a.title}
                  onClick={() => navigate(a.path)}
                  className="group cursor-pointer rounded-3xl bg-white/5 backdrop-blur-sm border border-white/10 hover:border-white/30 p-8 transition-all duration-500 hover:-translate-y-2 scroll-trigger"
                  style={{ animationDelay: `${i * 0.15}s` }}
                >
                  <div
                    className={`inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br ${a.color} rounded-2xl mb-6 shadow-xl group-hover:scale-110 transition-transform`}
                  >
                    <a.icon className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">{a.title}</h3>
                  <p className="text-gray-400">{a.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Connexion */}
        <section className="container mx-auto px-6 py-16">
          <div className="max-w-4xl mx-auto rounded-3xl bg-gradient-to-br from-primary/20 via-info/10 to-primary/20 backdrop-blur-sm border border-white/20 p-12 text-center">
            <Shield className="h-12 w-12 text-primary mx-auto mb-4" />
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Accédez à toutes les fonctionnalités
            </h2>
            <p className="text-lg text-gray-300 mb-8 max-w-2xl mx-auto">
              Connectez-vous à votre espace sécurisé pour gérer les données, exécuter les analyses
              ORS et exporter vos rapports.
            </p>
            <Button
              size="lg"
              onClick={() => navigate("/login")}
              className="h-14 px-10 text-lg font-semibold bg-gradient-to-r from-primary to-info hover:opacity-90 shadow-2xl shadow-primary/30"
            >
              Se connecter <ArrowRight className="h-5 w-5 ml-2" />
            </Button>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-white/10 mt-20">
          <div className="container mx-auto px-6 py-12">
            <div className="flex flex-col lg:flex-row items-center justify-between gap-8">
              {/* Logo Section */}
              <div className="flex items-center gap-4">
                <AnimatedLogo size={64} className="shadow-lg border-2 border-white/20" />
                <div className="flex flex-col">
                  <div className="font-bold text-xl text-white">DPE Plateforme</div>
                  <div className="text-sm text-gray-400">
                    Direction de la Planification de l'Éducation
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Ministère de l'Éducation Nationale
                  </div>
                </div>
              </div>

              {/* Info Section */}
              <div
                id="contact"
                className="flex flex-col items-center lg:items-end gap-4 scroll-mt-24"
              >
                <a
                  href="mailto:contact@dpe.education.gov.mg"
                  className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
                >
                  <Mail className="h-4 w-4" strokeWidth={1.75} />
                  contact@dpe.education.gov.mg
                </a>
                <div className="text-sm text-gray-500 text-center lg:text-right">
                  © {new Date().getFullYear()} Plateforme DPE. Tous droits réservés.
                  <br />
                  <span className="text-xs">Version 3.0 • Conforme RGPD • ISO 27001</span>
                </div>
              </div>
            </div>
          </div>
        </footer>
      </div>

      {/* Global Styles pour les animations */}
      <style>{`
        @keyframes pulse-slow {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 0.8; }
        }
        
        @keyframes orbital {
          0% { transform: translate(0, 0) rotate(0deg); }
          100% { transform: translate(100px, 100px) rotate(360deg); }
        }
        
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        .animate-pulse-slow {
          animation: pulse-slow 4s ease-in-out infinite;
        }
        
        .animate-orbital {
          animation: orbital linear infinite;
        }
        
        .animate-fade-in {
          animation: fade-in 0.8s ease-out;
        }
        
        .scroll-trigger {
          opacity: 0;
          transform: translateY(30px);
          transition: opacity 0.8s ease-out, transform 0.8s ease-out;
        }
        
        .scroll-trigger.animate-in {
          opacity: 1;
          transform: translateY(0);
        }
        
        .bg-grid-white\/\[0\.02\] {
          background-image: linear-gradient(to right, rgba(255, 255, 255, 0.02) 1px, transparent 1px),
                            linear-gradient(to bottom, rgba(255, 255, 255, 0.02) 1px, transparent 1px);
        }
      `}</style>
    </div>
  );
};

export default Home;
