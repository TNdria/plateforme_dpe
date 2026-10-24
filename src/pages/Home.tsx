import { useNavigate } from "react-router-dom";
import { useEffect, useState, type ElementType } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight, ArrowUpRight, ArrowDown, GraduationCap, Users, School, Globe, BookOpen, Building2, UserCheck, MapPin, Baby, Mail, Sparkles, Target, BarChart4, Menu, X } from "lucide-react";
import { referentielApi, dashboardApi } from "@/services/api";
import ministryBuilding from "@/assets/ministry-building.jpg";
import logoDpe from "@/assets/logoDpe.jpg";
import logoMen from "@/assets/logoMen.jpg";

type ModuleItem = { title: string; path: string; icon: ElementType; detail: string; tone: string };

const ModuleLinks = ({ items }: { items: ModuleItem[] }) => {
  const navigate = useNavigate();
  return <div className={`home-modules ${items.length === 4 ? "home-modules-four" : ""}`}>
    {items.map(({ title, path, icon: Icon, detail, tone }) => (
      <Button key={path} variant="outline" onClick={() => navigate(path)} className={`home-module ${tone}`}>
        <span className="home-module-top"><span className="home-module-icon"><Icon size={23} strokeWidth={1.6} /></span><ArrowUpRight size={20} className="home-module-arrow" /></span>
        <span className="home-module-title">{title}</span>
        <span className="home-module-detail">{detail}</span>
      </Button>
    ))}
  </div>;
};

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
  }, []);

  const formatNumber = (num: number) => {
    return num.toLocaleString("fr-FR");
  };

  const anneeLabel = stats.annee ? `${stats.annee - 1}-${stats.annee}` : null;

  const [menuOpen, setMenuOpen] = useState(false);
  const navLinks = [
    { href: "#stats", label: "Chiffres clés" },
    { href: "#tdb", label: "Tableaux de bord" },
    { href: "#ors", label: "Carte scolaire" },
    { href: "#analyse", label: "Analyse" },
  ];
  const mainStats = [
    { label: "Établissements", value: stats.etabTotal, icon: School, detail: "Écoles, collèges et lycées", tone: "home-tone-blue" },
    { label: "Élèves", value: stats.eleves, icon: Users, detail: "Primaire, collège et lycée", tone: "home-tone-green" },
    { label: "Préscolaire", value: stats.presco, icon: Baby, detail: "Effectifs du préscolaire", tone: "home-tone-red" },
    { label: "Enseignants", value: stats.enseignants, icon: UserCheck, detail: "Personnel enseignant", tone: "home-tone-blue" },
  ];
  const renderValue = (value: number | null) => stats.loading
    ? <span className="home-stat-skeleton shimmer" aria-label="Chargement" />
    : value === null ? <span className="home-stat-unavailable">Non disponible</span> : formatNumber(value);

  return (
    <div className="home-page">
      <header className="home-header">
        <div className="home-identity-line" aria-hidden="true" />
        <nav className="home-container home-navigation" aria-label="Navigation principale">
          <a href="#" className="home-brand" aria-label="DPE Plateforme — Accueil">
            <img src={logoDpe} alt="Logo DPE" />
            <span><strong>DPE Plateforme</strong><small>Planification de l’Éducation</small></span>
          </a>
          <div className="home-desktop-nav">{navLinks.map(link => <a key={link.href} href={link.href}>{link.label}</a>)}</div>
          <div className="home-header-actions">
            <img className="home-men-logo" src={logoMen} alt="Ministère de l’Éducation Nationale" />
            <Button onClick={() => navigate("/login")} className="home-login">Connexion <ArrowUpRight size={16} /></Button>
            <Button variant="ghost" size="icon" className="home-menu-toggle" aria-label={menuOpen ? "Fermer le menu" : "Ouvrir le menu"} aria-expanded={menuOpen} aria-controls="home-mobile-nav" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X size={22} /> : <Menu size={22} />}</Button>
          </div>
        </nav>
        {menuOpen && <nav id="home-mobile-nav" className="home-mobile-nav" aria-label="Navigation mobile">{navLinks.map(link => <a key={link.href} href={link.href} onClick={() => setMenuOpen(false)}>{link.label}<ArrowUpRight size={16} /></a>)}</nav>}
      </header>

      <section className="home-hero" aria-labelledby="home-title">
        <img className="home-hero-photo" src={ministryBuilding} alt="Façade du Ministère de l’Éducation Nationale à Madagascar" fetchPriority="high" />
        <div className="home-hero-shade" aria-hidden="true" />
        <div className="home-container home-hero-inner">
          <div className="home-hero-copy">
            <p className="home-eyebrow"><span />Ministère de l’Éducation Nationale</p>
            <h1 id="home-title">DPE Plateforme</h1>
            <h2>Direction de la Planification<br className="hidden sm:block" /> de l’Éducation</h2>
            <p className="home-hero-description">La planification éducative à Madagascar,<br className="hidden sm:block" /> éclairée par les données.</p>
            <div className="home-hero-actions">
              <Button size="lg" variant="secondary" onClick={() => navigate("/dashboard")}>Explorer les données <ArrowRight size={18} /></Button>
              <Button size="lg" variant="outline" className="home-hero-secondary" onClick={() => navigate("/login")}>Se connecter <ArrowUpRight size={18} /></Button>
            </div>
          </div>
          <div className="home-hero-bottom"><span>Direction de la Planification de l’Éducation · Madagascar</span><a href="#stats" aria-label="Voir les chiffres clés"><ArrowDown size={19} /></a></div>
        </div>
      </section>

      <main>
        <section id="stats" className="home-section home-stats-section">
          <div className="home-container">
            <div className="home-section-heading"><div><p className="home-section-kicker">Aperçu national</p><h2>Chiffres clés</h2></div><p className="home-period">{anneeLabel ? `Année scolaire ${anneeLabel}` : "Données nationales consolidées"}</p></div>
            <div className="home-stats-grid" aria-busy={stats.loading}>
              {mainStats.map(({ label, value, icon: Icon, detail, tone }) => <div key={label} className={`home-stat ${tone}`}><div className="home-stat-label"><Icon size={20} strokeWidth={1.7} /><span>{label}</span></div><div className="home-stat-value">{renderValue(value)}</div><p>{detail}</p></div>)}
            </div>
            <div className="home-network">
              {[{ label: "DREN", value: stats.drens, icon: Globe }, { label: "CISCO", value: stats.ciscos, icon: Building2 }, { label: "ZAP", value: stats.zaps, icon: MapPin }].map(({ label, value, icon: Icon }) => <div key={label}><Icon size={18} /><strong>{renderValue(value)}</strong><span>{label}</span></div>)}
              {(stats.etabPublic !== null || stats.etabPrive !== null) && <p>Établissements publics : {stats.etabPublic !== null ? formatNumber(stats.etabPublic) : "n.d."}<br />Établissements privés : {stats.etabPrive !== null ? formatNumber(stats.etabPrive) : "n.d."}</p>}
            </div>
          </div>
        </section>

        <section id="tdb" className="home-section home-band">
          <div className="home-container"><div className="home-section-heading"><div><p className="home-section-kicker">Tableaux de bord</p><h2>Pilotage territorial</h2></div><span className="home-section-index">01 /</span></div>
            <ModuleLinks items={[
              { title: "DREN", detail: "Directions régionales", path: "/tdb-dren", icon: Globe, tone: "home-tone-blue" },
              { title: "CISCO", detail: "Circonscriptions scolaires", path: "/tdb-cisco", icon: Building2, tone: "home-tone-green" },
              { title: "ZAP", detail: "Zones pédagogiques", path: "/tdb-zap", icon: MapPin, tone: "home-tone-red" },
              { title: "École", detail: "Établissements scolaires", path: "/tdb-ecole", icon: School, tone: "home-tone-blue" },
            ]} />
          </div>
        </section>

        <section id="ors" className="home-section">
          <div className="home-container"><div className="home-section-heading"><div><p className="home-section-kicker home-kicker-green">Carte scolaire ORS</p><h2>Organisation du Réseau Scolaire</h2></div><span className="home-section-index">02 /</span></div>
            <ModuleLinks items={[
              { title: "ORS Primaire", detail: "EPP et écoles primaires", path: "/ors-primaire", icon: School, tone: "home-tone-green" },
              { title: "ORS Collèges", detail: "Collèges publics et privés", path: "/ors-college", icon: BookOpen, tone: "home-tone-blue" },
              { title: "ORS Lycée", detail: "Lycées publics et privés", path: "/ors-lycee", icon: GraduationCap, tone: "home-tone-red" },
            ]} />
          </div>
        </section>

        <section id="analyse" className="home-section home-band">
          <div className="home-container"><div className="home-section-heading"><div><p className="home-section-kicker">Analyse et prospective</p><h2>Diagnostic, besoins et cartographie</h2></div><span className="home-section-index">03 /</span></div>
            <ModuleLinks items={[
              { title: "Diagnostic IA", detail: "Indicateurs éducatifs", path: "/diagnostic", icon: Sparkles, tone: "home-tone-blue" },
              { title: "Besoins", detail: "Infrastructures et ressources", path: "/besoins", icon: Target, tone: "home-tone-red" },
              { title: "DataViz", detail: "Cartographie thématique", path: "/dataviz", icon: BarChart4, tone: "home-tone-green" },
            ]} />
          </div>
        </section>
      </main>

      <footer id="contact" className="home-footer">
        <div className="home-container home-footer-inner"><div className="home-footer-brand"><img src={logoDpe} alt="DPE" /><img src={logoMen} alt="MEN" /><div><strong>DPE Plateforme</strong><p>Direction de la Planification de l’Éducation</p><p>Ministère de l’Éducation Nationale</p></div></div><div className="home-footer-contact"><a href="mailto:contact@dpe.education.gov.mg"><Mail size={16} />contact@dpe.education.gov.mg</a><p>© {new Date().getFullYear()} Plateforme DPE</p></div></div>
        <div className="home-identity-line" aria-hidden="true" />
      </footer>
    </div>
  );
};

export default Home;
