import { useEffect, useState } from "react";
import {
  Save,
  Users,
  DoorOpen,
  GraduationCap,
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

type DonneesAnnuelles = {
  id?: number;
  annee_scolaire: string;
  eleves: number;
  sections: number;
  enseignants: number;
  salles: number;
  redoublants: number;
};

type Etablissement = {
  id?: number;
  code: string;
  nom_etab: string;
  niveau: string;
  commune: string;
  cisco: string;
  statut: string;
};

type ApiItem = Record<string, any>;

export default function SuiviEtablissement() {
  const [etablissement, setEtablissement] =
    useState<Etablissement>({
      code: "",
      nom_etab: "",
      niveau: "",
      commune: "",
      cisco: "",
      statut: "Ouverture provisoire",
    });

  const [donnees, setDonnees] =
    useState<DonneesAnnuelles[]>([]);

  const [anneeActive, setAnneeActive] =
    useState(0);

  const [chargement, setChargement] =
    useState(true);

  const [enregistrement, setEnregistrement] =
    useState(false);

  const [erreur, setErreur] =
    useState("");

  const [message, setMessage] =
    useState("");

  /**
   * ============================================================
   * OUTILS
   * ============================================================
   */

  const nombre = (value: any): number => {
    if (
      value === null ||
      value === undefined ||
      value === ""
    ) {
      return 0;
    }

    const resultat = Number(value);

    return Number.isNaN(resultat)
      ? 0
      : resultat;
  };

  const texte = (value: any): string => {
    if (
      value === null ||
      value === undefined
    ) {
      return "";
    }

    return String(value);
  };

  /**
   * ============================================================
   * RECUPERATION DES DONNEES ANNUELLES
   * ============================================================
   */

  const convertirDonneeAnnuelle = (
    item: ApiItem
  ): DonneesAnnuelles => {
    return {
      id:
        item.id ??
        item.pk ??
        undefined,

      annee_scolaire: texte(
        item.annee_scolaire ??
        item.anneeScolaire ??
        item.annee ??
        item.annee_suivi
      ),

      eleves: nombre(
        item.eleves ??
        item.effectif ??
        item.effectifs ??
        item.nombre_eleves ??
        item.nb_eleves
      ),

      sections: nombre(
        item.sections ??
        item.nombre_sections ??
        item.nb_sections
      ),

      enseignants: nombre(
        item.enseignants ??
        item.nombre_enseignants ??
        item.nb_enseignants
      ),

      salles: nombre(
        item.salles ??
        item.nombre_salles ??
        item.nb_salles
      ),

      redoublants: nombre(
        item.redoublants ??
        item.redoublements ??
        item.nombre_redoublants ??
        item.nb_redoublants
      ),
    };
  };

  /**
   * ============================================================
   * RECUPERATION DE L'ETABLISSEMENT
   * ============================================================
   */

  const convertirEtablissement = (
    item: ApiItem
  ): Etablissement => {
    return {
      id:
        item.id ??
        item.pk ??
        undefined,

      code: texte(
        item.code ??
        item.code_etab ??
        item.CODE_ETAB ??
        item.code_etablissement ??
        item.code_attribution
      ),

      nom_etab: texte(
        item.nom_etab ??
        item.nom_etablissement ??
        item.NOM_ETAB ??
        item.etablissement ??
        item.nom
      ),

      niveau: texte(
        item.niveau ??
        item.niveau_etablissement ??
        item.NIVEAU
      ),

      commune: texte(
        item.commune ??
        item.COMMUNE ??
        item.localisation?.commune
      ),

      cisco: texte(
        item.cisco ??
        item.CISCO ??
        item.localisation?.cisco
      ),

      statut: texte(
        item.statut ??
        item.status ??
        item.etat ??
        "Ouverture provisoire"
      ),
    };
  };

  /**
   * ============================================================
   * CHARGEMENT
   * ============================================================
   */

  useEffect(() => {
    let actif = true;

    const charger = async () => {
      try {
        setChargement(true);
        setErreur("");
        setMessage("");

        /**
         * --------------------------------------------------------
         * 1. Récupération des ouvertures provisoires
         * --------------------------------------------------------
         */

        const response =
          await api.get("/ouverture/demandes/");

        if (!actif) return;

        const data = response?.data;

        let listeEtablissements: ApiItem[] = [];

        if (Array.isArray(data)) {
          listeEtablissements = data;
        } else if (
          Array.isArray(data?.results)
        ) {
          listeEtablissements =
            data.results;
        } else if (
          Array.isArray(data?.data)
        ) {
          listeEtablissements =
            data.data;
        }

        /**
         * --------------------------------------------------------
         * 2. Prendre le premier établissement disponible
         *
         * Si ton écran est ouvert depuis une route avec un ID,
         * cette partie pourra ensuite utiliser cet ID.
         * --------------------------------------------------------
         */

        const premier =
          listeEtablissements[0];

        if (premier) {
          setEtablissement(
            convertirEtablissement(premier)
          );
        }

        /**
         * --------------------------------------------------------
         * 3. Recherche des données de suivi
         * --------------------------------------------------------
         *
         * Endpoint utilisé :
         *
         * /ouverture/suivis/
         *
         * --------------------------------------------------------
         */

        let suiviResponse;

        try {
          suiviResponse =
            await api.get(
              "/ouverture/suivis/"
            );
        } catch {
          /**
           * Certains backends utilisent :
           *
           * /ouverture/suivi/
           *
           * On essaie donc aussi cette route.
           */
          suiviResponse =
            await api.get(
              "/ouverture/suivi/"
            );
        }

        if (!actif) return;

        const suiviData =
          suiviResponse?.data;

        let listeSuivi: ApiItem[] = [];

        if (Array.isArray(suiviData)) {
          listeSuivi = suiviData;
        } else if (
          Array.isArray(
            suiviData?.results
          )
        ) {
          listeSuivi =
            suiviData.results;
        } else if (
          Array.isArray(
            suiviData?.data
          )
        ) {
          listeSuivi =
            suiviData.data;
        }

        /**
         * --------------------------------------------------------
         * 4. Conversion
         * --------------------------------------------------------
         */

        const donneesConverties =
          listeSuivi.map(
            convertirDonneeAnnuelle
          );

        /**
         * --------------------------------------------------------
         * 5. Si le backend ne contient aucune donnée,
         *    on affiche quand même les années vides.
         * --------------------------------------------------------
         */

        if (
          donneesConverties.length > 0
        ) {
          setDonnees(
            donneesConverties
          );
          setAnneeActive(0);
        } else {
          setDonnees([]);
          setAnneeActive(0);
        }
      } catch (error: any) {
        console.error(
          "Erreur chargement suivi établissement :",
          error
        );

        if (!actif) return;

        const detail =
          error?.response?.data?.detail ??
          error?.response?.data?.message ??
          "Impossible de récupérer les données depuis la base de données.";

        setErreur(
          String(detail)
        );
      } finally {
        if (actif) {
          setChargement(false);
        }
      }
    };

    charger();

    return () => {
      actif = false;
    };
  }, []);

  /**
   * ============================================================
   * MODIFICATION
   * ============================================================
   */

  const modifier = (
    champ: keyof DonneesAnnuelles,
    valeur: string
  ) => {
    setDonnees(
      (ancienne) =>
        ancienne.map(
          (item, index) => {
            if (
              index !== anneeActive
            ) {
              return item;
            }

            return {
              ...item,

              [champ]:
                champ ===
                "annee_scolaire"
                  ? valeur
                  : nombre(valeur),
            };
          }
        )
    );

    setMessage("");
  };

  /**
   * ============================================================
   * ENREGISTREMENT
   * ============================================================
   */

  const enregistrer = async () => {
    const annee =
      donnees[anneeActive];

    if (!annee) {
      return;
    }

    try {
      setEnregistrement(true);
      setErreur("");
      setMessage("");

      const payload = {
        etablissement:
          etablissement.id,

        code_etab:
          etablissement.code,

        annee_scolaire:
          annee.annee_scolaire,

        eleves:
          annee.eleves,

        sections:
          annee.sections,

        enseignants:
          annee.enseignants,

        salles:
          annee.salles,

        redoublants:
          annee.redoublants,
      };

      /**
       * --------------------------------------------------------
       * Si la ligne existe déjà
       * --------------------------------------------------------
       */

      if (annee.id) {
        await api.put(
          `/ouverture/suivis/${annee.id}/`,
          payload
        );
      } else {
        /**
         * ------------------------------------------------------
         * Nouvelle ligne
         * ------------------------------------------------------
         */

        const response =
          await api.post(
            "/ouverture/suivis/",
            payload
          );

        const nouvelleDonnee =
          convertirDonneeAnnuelle(
            response.data
          );

        setDonnees(
          (ancienne) =>
            ancienne.map(
              (item, index) =>
                index === anneeActive
                  ? nouvelleDonnee
                  : item
            )
        );
      }

      setMessage(
        "Les données ont été enregistrées avec succès."
      );
    } catch (error: any) {
      console.error(
        "Erreur enregistrement suivi :",
        error
      );

      const detail =
        error?.response?.data?.detail ??
        error?.response?.data?.message ??
        "Impossible d'enregistrer les données.";

      setErreur(
        String(detail)
      );
    } finally {
      setEnregistrement(false);
    }
  };

  /**
   * ============================================================
   * AFFICHAGE CHARGEMENT
   * ============================================================
   */

  if (chargement) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Suivi de l'établissement
          </h1>

          <p className="text-sm text-muted-foreground mt-1">
            Chargement des données...
          </p>
        </div>

        <Card>
          <CardContent className="p-10 text-center text-sm text-muted-foreground">
            Chargement des informations depuis la base de données...
          </CardContent>
        </Card>
      </div>
    );
  }

  /**
   * ============================================================
   * AFFICHAGE ERREUR
   * ============================================================
   */

  if (erreur && !donnees.length) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Suivi de l'établissement
          </h1>

          <p className="text-sm text-muted-foreground mt-1">
            Suivi des données réelles pendant les trois années
            d'ouverture provisoire.
          </p>
        </div>

        <Card>
          <CardContent className="p-10 text-center">
            <p className="text-sm text-red-500">
              {erreur}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  /**
   * ============================================================
   * DONNEE ACTIVE
   * ============================================================
   */

  const annee =
    donnees[anneeActive];

  return (
    <div className="space-y-6">
      {/* ====================================================== */}
      {/* TITRE */}
      {/* ====================================================== */}

      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Suivi de l'établissement
        </h1>

        <p className="text-sm text-muted-foreground mt-1">
          Suivi des données réelles pendant les trois années
          d'ouverture provisoire.
        </p>
      </div>

      {/* ====================================================== */}
      {/* ETABLISSEMENT */}
      {/* ====================================================== */}

      <Card>
        <CardContent className="p-5">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <p className="text-lg font-semibold">
                {etablissement.nom_etab ||
                  "Établissement non renseigné"}
              </p>

              <p className="text-sm text-muted-foreground">
                Code :{" "}
                {etablissement.code ||
                  "Non renseigné"}{" "}
                ·{" "}
                {etablissement.niveau ||
                  "Niveau non renseigné"}
              </p>

              <p className="text-sm text-muted-foreground">
                {etablissement.commune ||
                  "Commune non renseignée"}

                {etablissement.cisco &&
                  ` · ${etablissement.cisco}`}
              </p>
            </div>

            <Badge variant="outline">
              {etablissement.statut ||
                "Ouverture provisoire"}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* ====================================================== */}
      {/* ANNEES */}
      {/* ====================================================== */}

      {donnees.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {donnees.map(
            (item, index) => (
              <Button
                key={
                  item.id ??
                  `${item.annee_scolaire}-${index}`
                }
                variant={
                  anneeActive === index
                    ? "default"
                    : "outline"
                }
                onClick={() =>
                  setAnneeActive(index)
                }
                className="h-12"
                type="button"
              >
                Année {index + 1} ·{" "}
                {item.annee_scolaire ||
                  "Année non renseignée"}
              </Button>
            )
          )}
        </div>
      ) : (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            Aucune donnée annuelle n'est encore enregistrée
            pour cet établissement.
          </CardContent>
        </Card>
      )}

      {/* ====================================================== */}
      {/* FORMULAIRE */}
      {/* ====================================================== */}

      {annee && (
        <Card>
          <CardHeader>
            <CardTitle>
              Données de l'année{" "}
              {anneeActive + 1}
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* ================================================ */}
            {/* ANNEE SCOLAIRE */}
            {/* ================================================ */}

            <div>
              <label className="text-sm font-medium">
                Année scolaire
              </label>

              <Input
                value={
                  annee.annee_scolaire
                }
                onChange={(e) =>
                  modifier(
                    "annee_scolaire",
                    e.target.value
                  )
                }
                className="mt-2"
              />
            </div>

            {/* ================================================ */}
            {/* DONNEES */}
            {/* ================================================ */}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="text-sm font-medium flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Nombre d'élèves
                </label>

                <Input
                  type="number"
                  min="0"
                  value={
                    annee.eleves
                  }
                  onChange={(e) =>
                    modifier(
                      "eleves",
                      e.target.value
                    )
                  }
                  className="mt-2"
                />
              </div>

              <div>
                <label className="text-sm font-medium flex items-center gap-2">
                  <GraduationCap className="h-4 w-4" />
                  Nombre de sections
                </label>

                <Input
                  type="number"
                  min="0"
                  value={
                    annee.sections
                  }
                  onChange={(e) =>
                    modifier(
                      "sections",
                      e.target.value
                    )
                  }
                  className="mt-2"
                />
              </div>

              <div>
                <label className="text-sm font-medium">
                  Nombre d'enseignants
                </label>

                <Input
                  type="number"
                  min="0"
                  value={
                    annee.enseignants
                  }
                  onChange={(e) =>
                    modifier(
                      "enseignants",
                      e.target.value
                    )
                  }
                  className="mt-2"
                />
              </div>

              <div>
                <label className="text-sm font-medium flex items-center gap-2">
                  <DoorOpen className="h-4 w-4" />
                  Nombre de salles
                </label>

                <Input
                  type="number"
                  min="0"
                  value={
                    annee.salles
                  }
                  onChange={(e) =>
                    modifier(
                      "salles",
                      e.target.value
                    )
                  }
                  className="mt-2"
                />
              </div>

              <div>
                <label className="text-sm font-medium">
                  Nombre de redoublants
                </label>

                <Input
                  type="number"
                  min="0"
                  value={
                    annee.redoublants
                  }
                  onChange={(e) =>
                    modifier(
                      "redoublants",
                      e.target.value
                    )
                  }
                  className="mt-2"
                />
              </div>
            </div>

            {/* ================================================ */}
            {/* MESSAGES */}
            {/* ================================================ */}

            {message && (
              <p className="text-sm text-green-600">
                {message}
              </p>
            )}

            {erreur && (
              <p className="text-sm text-red-500">
                {erreur}
              </p>
            )}

            {/* ================================================ */}
            {/* ENREGISTRER */}
            {/* ================================================ */}

            <div className="flex justify-end">
              <Button
                onClick={enregistrer}
                disabled={enregistrement}
                type="button"
              >
                <Save className="h-4 w-4 mr-2" />

                {enregistrement
                  ? "Enregistrement..."
                  : "Enregistrer les données"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}