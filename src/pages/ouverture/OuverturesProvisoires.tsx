import { useEffect, useMemo, useState } from "react";
import {
  Eye,
  Search,
  School,
  CalendarDays,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

import { api } from "@/services/demandeApi";

type OuvertureProvisoire = {
  id: number;
  code: string;
  nom_etab: string;
  niveau: string;
  commune: string;
  cisco: string;
  date_ouverture: string;
  annee_suivi: number;
  statut: string;
};

type ApiItem = Record<string, any>;

export default function OuverturesProvisoires() {
  const [donnees, setDonnees] = useState<OuvertureProvisoire[]>([]);
  const [recherche, setRecherche] = useState("");
  const [niveau, setNiveau] = useState("Tous");
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");

  /**
   * ============================================================
   * CONVERSION DU NIVEAU
   * ============================================================
   */
  const normaliserNiveau = (niveauValue: any): string => {
    if (!niveauValue) return "";

    const valeur = String(niveauValue).trim().toLowerCase();

    if (
      valeur.includes("préscolaire") ||
      valeur.includes("prescolaire") ||
      valeur.includes("maternelle") ||
      valeur === "presco"
    ) {
      return "Préscolaire";
    }

    if (
      valeur.includes("primaire") ||
      valeur === "epp"
    ) {
      return "Primaire";
    }

    if (
      valeur.includes("collège") ||
      valeur.includes("college") ||
      valeur === "ceg"
    ) {
      return "Collège";
    }

    if (
      valeur.includes("lycée") ||
      valeur.includes("lycee")
    ) {
      return "Lycée";
    }

    return String(niveauValue);
  };

  /**
   * ============================================================
   * CONVERSION DU STATUT
   * ============================================================
   */
  const normaliserStatut = (statutValue: any): string => {
    if (!statutValue) {
      return "En suivi";
    }

    const valeur = String(statutValue).trim().toLowerCase();

    if (
      valeur.includes("analyse") ||
      valeur.includes("analyser")
    ) {
      return "À analyser";
    }

    if (
      valeur.includes("suivi") ||
      valeur.includes("provisoire")
    ) {
      return "En suivi";
    }

    return String(statutValue);
  };

  /**
   * ============================================================
   * CONVERSION D'UNE LIGNE API
   * ============================================================
   */
  const convertirDonnee = (
    item: ApiItem,
    index: number
  ): OuvertureProvisoire => {
    const code =
      item.code ??
      item.code_etab ??
      item.CODE_ETAB ??
      item.code_etablissement ??
      item.code_attribution ??
      item.code_etab_attribue ??
      "";

    const nom =
      item.nom_etab ??
      item.nom_etablissement ??
      item.NOM_ETAB ??
      item.etablissement ??
      item.nom ??
      "";

    const niveau =
      item.niveau ??
      item.niveau_etablissement ??
      item.NIVEAU ??
      item.type_etablissement ??
      "";

    const commune =
      item.commune ??
      item.COMMUNE ??
      item.localisation?.commune ??
      "";

    const cisco =
      item.cisco ??
      item.CISCO ??
      item.localisation?.cisco ??
      "";

    const dateOuverture =
      item.date_ouverture ??
      item.dateOuverture ??
      item.annee_ouverture ??
      item.anneeOuverture ??
      item.date_creation ??
      item.date_attribution ??
      "";

    const anneeSuivi =
      Number(
        item.annee_suivi ??
        item.anneeSuivi ??
        item.annee ??
        item.annee_suivi_provisoire ??
        1
      ) || 1;

    const statut = normaliserStatut(
      item.statut ??
      item.status ??
      item.etat
    );

    return {
      id:
        Number(
          item.id ??
          item.pk ??
          index + 1
        ) || index + 1,

      code: String(code),

      nom_etab: String(nom),

      niveau: normaliserNiveau(niveau),

      commune: String(commune),

      cisco: String(cisco),

      date_ouverture: String(dateOuverture),

      annee_suivi: anneeSuivi,

      statut,
    };
  };

  /**
   * ============================================================
   * RECUPERATION DEPUIS DJANGO
   * ============================================================
   */
  useEffect(() => {
    let actif = true;

    const chargerDonnees = async () => {
      try {
        setChargement(true);
        setErreur("");

        /**
         * Endpoint Django.
         *
         * Si ton backend utilise déjà :
         * /ouverture/demandes/
         * alors cette URL récupère les demandes.
         */
        const response = await api.get("/ouverture/demandes/");

        if (!actif) return;

        const data = response?.data;

        let liste: ApiItem[] = [];

        /**
         * DRF peut retourner :
         *
         * [
         *   {...},
         *   {...}
         * ]
         *
         * ou :
         *
         * {
         *   count: 10,
         *   results: [...]
         * }
         */
        if (Array.isArray(data)) {
          liste = data;
        } else if (Array.isArray(data?.results)) {
          liste = data.results;
        } else if (Array.isArray(data?.data)) {
          liste = data.data;
        } else {
          liste = [];
        }

        /**
         * On garde uniquement les établissements
         * correspondant à une ouverture provisoire.
         *
         * Si ton backend renvoie déjà uniquement les
         * ouvertures provisoires, cette partie ne supprime rien.
         */
        const donneesConverties = liste
          .map((item, index) => convertirDonnee(item, index))
          .filter((item) => {
            return (
              item.code !== "" ||
              item.nom_etab !== ""
            );
          });

        setDonnees(donneesConverties);
      } catch (error: any) {
        console.error(
          "Erreur récupération ouvertures provisoires :",
          error
        );

        if (!actif) return;

        setDonnees([]);

        const message =
          error?.response?.data?.detail ??
          error?.response?.data?.message ??
          "Impossible de récupérer les données depuis la base de données.";

        setErreur(String(message));
      } finally {
        if (actif) {
          setChargement(false);
        }
      }
    };

    chargerDonnees();

    return () => {
      actif = false;
    };
  }, []);

  /**
   * ============================================================
   * RECHERCHE + FILTRE NIVEAU
   * ============================================================
   */
  const resultat = useMemo(() => {
    const texte = recherche.toLowerCase().trim();

    return donnees.filter((item) => {
      const rechercheOK =
        !texte ||
        item.code.toLowerCase().includes(texte) ||
        item.nom_etab.toLowerCase().includes(texte) ||
        item.commune.toLowerCase().includes(texte) ||
        item.cisco.toLowerCase().includes(texte);

      const niveauOK =
        niveau === "Tous" ||
        item.niveau === niveau;

      return rechercheOK && niveauOK;
    });
  }, [donnees, recherche, niveau]);

  /**
   * ============================================================
   * STATISTIQUES
   * ============================================================
   */
  const nombreEnSuivi = useMemo(() => {
    return donnees.filter(
      (item) =>
        item.statut.toLowerCase().includes("suivi")
    ).length;
  }, [donnees]);

  const nombreAAnalyser = useMemo(() => {
    return donnees.filter(
      (item) =>
        item.statut.toLowerCase().includes("analyse")
    ).length;
  }, [donnees]);

  /**
   * ============================================================
   * AFFICHAGE
   * ============================================================
   */
  return (
    <div className="space-y-6">
      {/* ====================================================== */}
      {/* TITRE */}
      {/* ====================================================== */}

      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Ouvertures provisoires
        </h1>

        <p className="text-sm text-muted-foreground mt-1">
          Suivi des établissements ayant obtenu un code et
          bénéficiant d'une ouverture provisoire.
        </p>
      </div>

      {/* ====================================================== */}
      {/* STATISTIQUES */}
      {/* ====================================================== */}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">
              Établissements provisoires
            </p>

            <p className="text-2xl font-bold mt-1">
              {donnees.length}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">
              En suivi
            </p>

            <p className="text-2xl font-bold mt-1">
              {nombreEnSuivi}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">
              À analyser
            </p>

            <p className="text-2xl font-bold mt-1">
              {nombreAAnalyser}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ====================================================== */}
      {/* RECHERCHE */}
      {/* ====================================================== */}

      <Card>
        <CardHeader>
          <CardTitle>
            Recherche
          </CardTitle>
        </CardHeader>

        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />

              <Input
                value={recherche}
                onChange={(e) =>
                  setRecherche(e.target.value)
                }
                placeholder="Code, établissement, commune..."
                className="pl-9"
              />
            </div>

            <select
              value={niveau}
              onChange={(e) =>
                setNiveau(e.target.value)
              }
              className="h-10 rounded-md border bg-background px-3 text-sm"
            >
              <option value="Tous">
                Tous les niveaux
              </option>

              <option value="Préscolaire">
                Préscolaire
              </option>

              <option value="Primaire">
                Primaire
              </option>

              <option value="Collège">
                Collège
              </option>

              <option value="Lycée">
                Lycée
              </option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* ====================================================== */}
      {/* TABLEAU */}
      {/* ====================================================== */}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <School className="h-5 w-5" />

            Établissements en ouverture provisoire
          </CardTitle>
        </CardHeader>

        <CardContent>
          {chargement ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              Chargement des établissements...
            </div>
          ) : erreur ? (
            <div className="py-10 text-center text-sm text-red-500">
              {erreur}
            </div>
          ) : resultat.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              Aucun établissement trouvé.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-2">
                      Code
                    </th>

                    <th className="text-left py-3 px-2">
                      Établissement
                    </th>

                    <th className="text-left py-3 px-2">
                      Niveau
                    </th>

                    <th className="text-left py-3 px-2">
                      Ouverture
                    </th>

                    <th className="text-left py-3 px-2">
                      Suivi
                    </th>

                    <th className="text-left py-3 px-2">
                      Statut
                    </th>

                    <th className="text-right py-3 px-2">
                      Action
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {resultat.map((item) => (
                    <tr
                      key={item.id}
                      className="border-b last:border-0"
                    >
                      <td className="py-3 px-2 font-medium">
                        {item.code || "—"}
                      </td>

                      <td className="py-3 px-2">
                        <div className="font-medium">
                          {item.nom_etab || "—"}
                        </div>

                        <div className="text-xs text-muted-foreground">
                          {item.commune || "Commune non renseignée"}
                        </div>

                        {item.cisco && (
                          <div className="text-xs text-muted-foreground">
                            CISCO : {item.cisco}
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-2">
                        {item.niveau || "—"}
                      </td>

                      <td className="py-3 px-2">
                        <div className="flex items-center gap-2">
                          <CalendarDays className="h-4 w-4" />

                          {item.date_ouverture || "—"}
                        </div>
                      </td>

                      <td className="py-3 px-2">
                        Année {item.annee_suivi}
                      </td>

                      <td className="py-3 px-2">
                        <Badge variant="outline">
                          {item.statut || "—"}
                        </Badge>
                      </td>

                      <td className="py-3 px-2 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          type="button"
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          Voir
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}