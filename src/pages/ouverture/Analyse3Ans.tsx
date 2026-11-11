import { useEffect, useMemo, useState } from "react";
import {
  TrendingUp,
  Users,
  GraduationCap,
  DoorOpen,
  BarChart3,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

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
};

type ApiItem = Record<string, any>;

export default function Analyse3Ans() {
  const [donnees, setDonnees] = useState<DonneesAnnuelles[]>([]);

  const [etablissement, setEtablissement] =
    useState<Etablissement>({
      code: "",
      nom_etab: "",
      niveau: "",
      commune: "",
      cisco: "",
    });

  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");

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

    return Number.isNaN(resultat) ? 0 : resultat;
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
   * CONVERSION DES DONNEES ANNUELLES
   * ============================================================
   */

  const convertirDonnee = (
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
   * CONVERSION ETABLISSEMENT
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
    };
  };

  /**
   * ============================================================
   * EXTRACTION D'UNE LISTE API
   * ============================================================
   */

  const extraireListe = (
    data: any
  ): ApiItem[] => {
    if (Array.isArray(data)) {
      return data;
    }

    if (Array.isArray(data?.results)) {
      return data.results;
    }

    if (Array.isArray(data?.data)) {
      return data.data;
    }

    return [];
  };

  /**
   * ============================================================
   * CHARGEMENT DES DONNEES
   * ============================================================
   */

  useEffect(() => {
    let actif = true;

    const chargerDonnees = async () => {
      try {
        setChargement(true);
        setErreur("");

        /**
         * --------------------------------------------------------
         * ETABLISSEMENT
         * --------------------------------------------------------
         */

        const demandeResponse =
          await api.get(
            "/ouverture/demandes/"
          );

        if (!actif) return;

        const listeEtablissements =
          extraireListe(
            demandeResponse?.data
          );

        if (
          listeEtablissements.length > 0
        ) {
          setEtablissement(
            convertirEtablissement(
              listeEtablissements[0]
            )
          );
        }


        let suiviResponse;

        try {
          suiviResponse =
            await api.get(
              "/ouverture/suivis/"
            );
        } catch {
          suiviResponse =
            await api.get(
              "/ouverture/suivi/"
            );
        }

        if (!actif) return;

        const listeSuivi =
          extraireListe(
            suiviResponse?.data
          );

        /**
         * Conversion
         */
        const donneesConverties =
          listeSuivi.map(
            convertirDonnee
          );

        /**
         * Tri chronologique.
         *
         * On conserve toutes les années disponibles.
         */
        donneesConverties.sort(
          (a, b) =>
            a.annee_scolaire.localeCompare(
              b.annee_scolaire
            )
        );

        /**
         * Suppression des éventuels doublons
         * sur la même année scolaire.
         */
        const donneesUniques =
          donneesConverties.filter(
            (item, index, tableau) =>
              index ===
              tableau.findIndex(
                (autre) =>
                  autre.annee_scolaire ===
                  item.annee_scolaire
              )
          );

        setDonnees(
          donneesUniques
        );
      } catch (error: any) {
        console.error(
          "Erreur récupération analyse période provisoire :",
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

    chargerDonnees();

    return () => {
      actif = false;
    };
  }, []);

  /**
   * ============================================================
   * EVOLUTION
   * ============================================================
   */

  const evolution = (
    premiere: number,
    derniere: number
  ): number => {
    if (premiere === 0) {
      return derniere === 0
        ? 0
        : 100;
    }

    return Math.round(
      ((derniere - premiere) /
        premiere) *
        100
    );
  };

  /**
   * ============================================================
   * PREMIERE ET DERNIERE ANNEE
   *
   * IMPORTANT :
   * La dernière année peut être la 3e, 4e, 5e année,
   * etc.
   * ============================================================
   */

  const debut =
    donnees.length > 0
      ? donnees[0]
      : undefined;

  const fin =
    donnees.length > 0
      ? donnees[donnees.length - 1]
      : undefined;

  /**
   * ============================================================
   * NOMBRE D'ANNEES
   * ============================================================
   */

  const nombreAnnees =
    donnees.length;

  const periodeMinimumRespectee =
    nombreAnnees >= 3;

  /**
   * ============================================================
   * EVOLUTIONS
   * ============================================================
   */

  const evolutionEleves =
    debut && fin
      ? evolution(
          debut.eleves,
          fin.eleves
        )
      : 0;

  const evolutionSections =
    debut && fin
      ? evolution(
          debut.sections,
          fin.sections
        )
      : 0;

  const evolutionEnseignants =
    debut && fin
      ? evolution(
          debut.enseignants,
          fin.enseignants
        )
      : 0;

  const evolutionSalles =
    debut && fin
      ? evolution(
          debut.salles,
          fin.salles
        )
      : 0;

  const evolutionRedoublants =
    debut && fin
      ? evolution(
          debut.redoublants,
          fin.redoublants
        )
      : 0;

  /**
   * ============================================================
   * FORMAT EVOLUTION
   * ============================================================
   */

  const afficherEvolution = (
    valeur: number
  ) => {
    if (valeur > 0) {
      return `+${valeur} %`;
    }

    return `${valeur} %`;
  };

  /**
   * ============================================================
   * PERIODE
   *
   * Affiche toute la période réellement présente en base.
   * ============================================================
   */

  const periode = useMemo(() => {
    if (!debut || !fin) {
      return "Aucune donnée";
    }

    if (
      debut.annee_scolaire ===
      fin.annee_scolaire
    ) {
      return debut.annee_scolaire;
    }

    return `${debut.annee_scolaire} → ${fin.annee_scolaire}`;
  }, [debut, fin]);

  /**
   * ============================================================
   * CHARGEMENT
   * ============================================================
   */

  if (chargement) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Analyse de l'ouverture provisoire
          </h1>
        </div>

        <Card>
          <CardContent className="p-10 text-center text-sm text-muted-foreground">
            Chargement des données depuis la base de données...
          </CardContent>
        </Card>
      </div>
    );
  }

  /**
   * ============================================================
   * ERREUR
   * ============================================================
   */

  if (erreur) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Analyse de l'ouverture provisoire
          </h1>

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
          Analyse de l'ouverture provisoire
        </h1>

      </div>

      {/* ====================================================== */}
      {/* ETABLISSEMENT */}
      {/* ====================================================== */}

      <Card>
        <CardContent className="p-5">
          <div>
            <p className="text-lg font-semibold">
              {etablissement.nom_etab ||
                "Établissement non renseigné"}
            </p>

            <p className="text-sm text-muted-foreground">
              Code :{" "}
              {etablissement.code ||
                "Non renseigné"}

              {" · "}

              {etablissement.niveau ||
                "Niveau non renseigné"}
            </p>

            <p className="text-sm text-muted-foreground">
              Commune :{" "}
              {etablissement.commune ||
                "Non renseignée"}
            </p>

            <p className="text-sm text-muted-foreground">
              CISCO :{" "}
              {etablissement.cisco ||
                "Non renseigné"}
            </p>

            <p className="text-sm text-muted-foreground mt-1">
              Période : {periode}
            </p>

            <p className="text-sm text-muted-foreground">
              Nombre d'années disponibles :{" "}
              {nombreAnnees}
            </p>

            {/* ================================================= */}
            {/* INDICATION PERIODE MINIMALE */}
            {/* ================================================= */}

            <div className="mt-3">
              {periodeMinimumRespectee ? (
                <Badge variant="outline">
                  Période minimale de 3 ans atteinte
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="text-orange-600"
                >
                  Période provisoire :{" "}
                  {nombreAnnees} année(s) disponible(s) —
                  minimum requis : 3 ans
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ====================================================== */}
      {/* AUCUNE DONNEE */}
      {/* ====================================================== */}

      {donnees.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center">
            <p className="text-sm text-muted-foreground">
              Aucune donnée annuelle n'est disponible pour
              effectuer l'analyse.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* ================================================== */}
          {/* CARTES STATISTIQUES */}
          {/* ================================================== */}

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">

            <Card>
              <CardContent className="p-5">
                <Users className="h-5 w-5 mb-3" />

                <p className="text-sm text-muted-foreground">
                  Élèves
                </p>

                <p className="text-2xl font-bold">
                  {fin?.eleves ?? 0}
                </p>

                <Badge
                  variant="outline"
                  className="mt-2"
                >
                  {afficherEvolution(
                    evolutionEleves
                  )}
                </Badge>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5">
                <BarChart3 className="h-5 w-5 mb-3" />

                <p className="text-sm text-muted-foreground">
                  Sections
                </p>

                <p className="text-2xl font-bold">
                  {fin?.sections ?? 0}
                </p>

                <Badge
                  variant="outline"
                  className="mt-2"
                >
                  {afficherEvolution(
                    evolutionSections
                  )}
                </Badge>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5">
                <GraduationCap className="h-5 w-5 mb-3" />

                <p className="text-sm text-muted-foreground">
                  Enseignants
                </p>

                <p className="text-2xl font-bold">
                  {fin?.enseignants ?? 0}
                </p>

                <Badge
                  variant="outline"
                  className="mt-2"
                >
                  {afficherEvolution(
                    evolutionEnseignants
                  )}
                </Badge>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5">
                <DoorOpen className="h-5 w-5 mb-3" />

                <p className="text-sm text-muted-foreground">
                  Salles
                </p>

                <p className="text-2xl font-bold">
                  {fin?.salles ?? 0}
                </p>

                <Badge
                  variant="outline"
                  className="mt-2"
                >
                  {afficherEvolution(
                    evolutionSalles
                  )}
                </Badge>
              </CardContent>
            </Card>

          </div>

          {/* ================================================== */}
          {/* TABLEAU */}
          {/* ================================================== */}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />

                Évolution pendant la période provisoire
              </CardTitle>
            </CardHeader>

            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">

                  <thead>
                    <tr className="border-b">

                      <th className="text-left py-3 px-2">
                        Indicateur
                      </th>

                      {donnees.map(
                        (item, index) => (
                          <th
                            key={
                              item.id ??
                              `${item.annee_scolaire}-${index}`
                            }
                            className="text-center py-3 px-2"
                          >
                            Année {index + 1}

                            <div className="font-normal text-xs text-muted-foreground">
                              {
                                item.annee_scolaire
                              }
                            </div>
                          </th>
                        )
                      )}

                    </tr>
                  </thead>

                  <tbody>

                    {/* ======================================== */}
                    {/* ELEVES */}
                    {/* ======================================== */}

                    <tr className="border-b">
                      <td className="py-3 px-2 font-medium">
                        Élèves
                      </td>

                      {donnees.map(
                        (item, index) => (
                          <td
                            key={`eleves-${item.id ?? index}`}
                            className="text-center py-3 px-2"
                          >
                            {item.eleves}
                          </td>
                        )
                      )}
                    </tr>

                    {/* ======================================== */}
                    {/* SECTIONS */}
                    {/* ======================================== */}

                    <tr className="border-b">
                      <td className="py-3 px-2 font-medium">
                        Sections
                      </td>

                      {donnees.map(
                        (item, index) => (
                          <td
                            key={`sections-${item.id ?? index}`}
                            className="text-center py-3 px-2"
                          >
                            {item.sections}
                          </td>
                        )
                      )}
                    </tr>

                    {/* ======================================== */}
                    {/* ENSEIGNANTS */}
                    {/* ======================================== */}

                    <tr className="border-b">
                      <td className="py-3 px-2 font-medium">
                        Enseignants
                      </td>

                      {donnees.map(
                        (item, index) => (
                          <td
                            key={`enseignants-${item.id ?? index}`}
                            className="text-center py-3 px-2"
                          >
                            {item.enseignants}
                          </td>
                        )
                      )}
                    </tr>

                    {/* ======================================== */}
                    {/* SALLES */}
                    {/* ======================================== */}

                    <tr className="border-b">
                      <td className="py-3 px-2 font-medium">
                        Salles
                      </td>

                      {donnees.map(
                        (item, index) => (
                          <td
                            key={`salles-${item.id ?? index}`}
                            className="text-center py-3 px-2"
                          >
                            {item.salles}
                          </td>
                        )
                      )}
                    </tr>

                    {/* ======================================== */}
                    {/* REDOUBLANTS */}
                    {/* ======================================== */}

                    <tr>
                      <td className="py-3 px-2 font-medium">
                        Redoublants
                      </td>

                      {donnees.map(
                        (item, index) => (
                          <td
                            key={`redoublants-${item.id ?? index}`}
                            className="text-center py-3 px-2"
                          >
                            {item.redoublants}
                          </td>
                        )
                      )}
                    </tr>

                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* ================================================== */}
          {/* INDICATEURS */}
          {/* ================================================== */}

          <Card>
            <CardHeader>
              <CardTitle>
                Indicateurs d'analyse
              </CardTitle>
            </CardHeader>

            <CardContent className="space-y-3">

              <div className="flex justify-between items-center border rounded-lg p-4">
                <span>
                  Évolution des effectifs
                </span>

                <Badge variant="outline">
                  {afficherEvolution(
                    evolutionEleves
                  )}
                </Badge>
              </div>

              <div className="flex justify-between items-center border rounded-lg p-4">
                <span>
                  Évolution des sections
                </span>

                <Badge variant="outline">
                  {afficherEvolution(
                    evolutionSections
                  )}
                </Badge>
              </div>

              <div className="flex justify-between items-center border rounded-lg p-4">
                <span>
                  Disponibilité des enseignants
                </span>

                <Badge variant="outline">
                  {fin?.enseignants ?? 0}
                </Badge>
              </div>

              <div className="flex justify-between items-center border rounded-lg p-4">
                <span>
                  Disponibilité des salles
                </span>

                <Badge variant="outline">
                  {fin?.salles ?? 0}
                </Badge>
              </div>

              <div className="flex justify-between items-center border rounded-lg p-4">
                <span>
                  Évolution du redoublement
                </span>

                <Badge variant="outline">
                  {afficherEvolution(
                    evolutionRedoublants
                  )}
                </Badge>
              </div>

              <div className="flex justify-between items-center border rounded-lg p-4">
                <span>
                  Durée minimale de l'ouverture provisoire
                </span>

                <Badge variant="outline">
                  3 ans minimum
                </Badge>
              </div>

            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}