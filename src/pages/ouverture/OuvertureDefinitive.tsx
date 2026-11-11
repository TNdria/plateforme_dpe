import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  ClipboardCheck,
  School,
  XCircle,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";

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

type Decision = {
  id?: number;
  decision: string;
  motif: string;
  date_decision?: string;
  statut?: string;
};

type ApiItem = Record<string, any>;

export default function OuvertureDefinitive() {
  const [etablissement, setEtablissement] =
    useState<Etablissement>({
      code: "",
      nom_etab: "",
      niveau: "",
      commune: "",
      cisco: "",
    });

  const [donnees, setDonnees] =
    useState<DonneesAnnuelles[]>([]);

  const [decision, setDecision] =
    useState("");

  const [motif, setMotif] =
    useState("");

  const [decisionExistante, setDecisionExistante] =
    useState<Decision | null>(null);

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
   * CONVERSION SUIVI
   * ============================================================
   */

  const convertirSuivi = (
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
   * CONVERSION DECISION
   * ============================================================
   */

  const convertirDecision = (
    item: ApiItem
  ): Decision => {
    return {
      id:
        item.id ??
        item.pk ??
        undefined,

      decision: texte(
        item.decision ??
        item.type_decision ??
        item.resultat ??
        item.statut_decision
      ),

      motif: texte(
        item.motif ??
        item.motifs ??
        item.justification
      ),

      date_decision:
        item.date_decision ??
        item.dateDecision ??
        item.created_at ??
        item.date_creation,

      statut: texte(
        item.statut ??
        item.status
      ),
    };
  };

  /**
   * ============================================================
   * EXTRACTION LISTE API
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

    const charger = async () => {
      try {
        setChargement(true);
        setErreur("");
        setMessage("");

        /**
         * --------------------------------------------------------
         * 1. ETABLISSEMENT
         * --------------------------------------------------------
         */

        const demandeResponse =
          await api.get(
            "/ouverture/demandes/"
          );

        if (!actif) return;

        const demandes =
          extraireListe(
            demandeResponse?.data
          );

        if (demandes.length > 0) {
          setEtablissement(
            convertirEtablissement(
              demandes[0]
            )
          );
        }

        /**
         * --------------------------------------------------------
         * 2. DONNEES DE SUIVI
         * --------------------------------------------------------
         */

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

        const suivis =
          extraireListe(
            suiviResponse?.data
          );

        const suivisConvertis =
          suivis.map(
            convertirSuivi
          );

        suivisConvertis.sort(
          (a, b) =>
            a.annee_scolaire.localeCompare(
              b.annee_scolaire
            )
        );

        setDonnees(
          suivisConvertis
        );

        /**
         * --------------------------------------------------------
         * 3. DECISION EXISTANTE
         * --------------------------------------------------------
         */

        try {
          const decisionResponse =
            await api.get(
              "/ouverture/decisions/"
            );

          if (!actif) return;

          const decisions =
            extraireListe(
              decisionResponse?.data
            );

          if (
            decisions.length > 0
          ) {
            const derniere =
              convertirDecision(
                decisions[
                  decisions.length - 1
                ]
              );

            setDecisionExistante(
              derniere
            );

            setDecision(
              derniere.decision
            );

            setMotif(
              derniere.motif
            );
          }
        } catch (decisionError) {
          /**
           * Il n'y a simplement aucune
           * décision enregistrée.
           */
          console.warn(
            "Aucune décision existante :",
            decisionError
          );
        }
      } catch (error: any) {
        console.error(
          "Erreur chargement ouverture définitive :",
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
   * PERIODE
   * ============================================================
   */

  const periode = useMemo(() => {
    if (donnees.length === 0) {
      return "Aucune donnée";
    }

    const debut =
      donnees[0].annee_scolaire;

    const fin =
      donnees[
        donnees.length - 1
      ].annee_scolaire;

    if (debut === fin) {
      return debut;
    }

    return `${debut} → ${fin}`;
  }, [donnees]);

  /**
   * ============================================================
   * ENREGISTREMENT DECISION
   * ============================================================
   */

  const enregistrerDecision = async () => {
    if (
      !decision ||
      !motif.trim()
    ) {
      return;
    }

    try {
      setEnregistrement(true);
      setErreur("");
      setMessage("");

      const payload = {
        decision,
        motif: motif.trim(),

        etablissement:
          etablissement.id,

        code_etab:
          etablissement.code,

        date_decision:
          new Date().toISOString(),
      };

      /**
       * --------------------------------------------------------
       * MODIFICATION D'UNE DECISION EXISTANTE
       * --------------------------------------------------------
       */

      if (
        decisionExistante?.id
      ) {
        const response =
          await api.put(
            `/ouverture/decisions/${decisionExistante.id}/`,
            payload
          );

        setDecisionExistante(
          convertirDecision(
            response.data
          )
        );

        setMessage(
          "La décision a été modifiée avec succès."
        );
      } else {
        /**
         * ------------------------------------------------------
         * CREATION
         * ------------------------------------------------------
         */

        const response =
          await api.post(
            "/ouverture/decisions/",
            payload
          );

        const nouvelleDecision =
          convertirDecision(
            response.data
          );

        setDecisionExistante(
          nouvelleDecision
        );

        setDecision(
          nouvelleDecision.decision
        );

        setMotif(
          nouvelleDecision.motif
        );

        setMessage(
          "La décision a été enregistrée avec succès."
        );
      }
    } catch (error: any) {
      console.error(
        "Erreur enregistrement décision :",
        error
      );

      const detail =
        error?.response?.data?.detail ??
        error?.response?.data?.message ??
        "Impossible d'enregistrer la décision.";

      setErreur(
        String(detail)
      );
    } finally {
      setEnregistrement(false);
    }
  };

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
            Ouverture définitive
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
   * ERREUR
   * ============================================================
   */

  if (
    erreur &&
    !etablissement.code
  ) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Ouverture définitive
          </h1>

          <p className="text-sm text-muted-foreground mt-1">
            Décision finale après l'analyse des trois années
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
          Ouverture définitive
        </h1>

        <p className="text-sm text-muted-foreground mt-1">
          Décision finale après l'analyse des trois années
          d'ouverture provisoire.
        </p>
      </div>

      {/* ====================================================== */}
      {/* ETABLISSEMENT */}
      {/* ====================================================== */}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <School className="h-5 w-5" />
            Établissement
          </CardTitle>
        </CardHeader>

        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">
                Établissement
              </p>

              <p className="font-semibold">
                {etablissement.nom_etab ||
                  "Non renseigné"}
              </p>
            </div>

            <div>
              <p className="text-sm text-muted-foreground">
                Code
              </p>

              <p className="font-semibold">
                {etablissement.code ||
                  "Non renseigné"}
              </p>
            </div>

            <div>
              <p className="text-sm text-muted-foreground">
                Niveau
              </p>

              <p className="font-semibold">
                {etablissement.niveau ||
                  "Non renseigné"}
              </p>
            </div>

            <div>
              <p className="text-sm text-muted-foreground">
                Période de suivi
              </p>

              <p className="font-semibold">
                {periode}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ====================================================== */}
      {/* RESUME DES TROIS ANNEES */}
      {/* ====================================================== */}

      <Card>
        <CardHeader>
          <CardTitle>
            Résumé de l'analyse des trois années
          </CardTitle>
        </CardHeader>

        <CardContent>
          {donnees.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Aucune donnée annuelle disponible.
            </div>
          ) : (
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
          )}
        </CardContent>
      </Card>

      {/* ====================================================== */}
      {/* DECISION */}
      {/* ====================================================== */}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5" />
            Décision finale
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* ================================================== */}
          {/* CHOIX */}
          {/* ================================================== */}

          <div>
            <p className="text-sm font-medium mb-3">
              Décision
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Button
                type="button"
                variant={
                  decision ===
                  "Ouverture définitive"
                    ? "default"
                    : "outline"
                }
                onClick={() =>
                  setDecision(
                    "Ouverture définitive"
                  )
                }
                className="h-12"
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />

                Ouverture définitive
              </Button>

              <Button
                type="button"
                variant={
                  decision ===
                  "Non ouverture définitive"
                    ? "destructive"
                    : "outline"
                }
                onClick={() =>
                  setDecision(
                    "Non ouverture définitive"
                  )
                }
                className="h-12"
              >
                <XCircle className="h-4 w-4 mr-2" />

                Non ouverture définitive
              </Button>
            </div>
          </div>

          {/* ================================================== */}
          {/* MOTIF */}
          {/* ================================================== */}

          <div>
            <label className="text-sm font-medium">
              Motif de la décision
            </label>

            <Textarea
              value={motif}
              onChange={(e) =>
                setMotif(
                  e.target.value
                )
              }
              placeholder="Saisissez le motif de la décision..."
              className="mt-2 min-h-[120px]"
            />
          </div>

          {/* ================================================== */}
          {/* MESSAGES */}
          {/* ================================================== */}

          {message && (
            <div className="rounded-lg border bg-muted p-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />

                <span className="font-medium">
                  {message}
                </span>
              </div>

              <p className="text-sm text-muted-foreground mt-2">
                Décision : {decision}
              </p>
            </div>
          )}

          {erreur && (
            <div className="rounded-lg border border-red-200 p-4">
              <p className="text-sm text-red-500">
                {erreur}
              </p>
            </div>
          )}

          {/* ================================================== */}
          {/* ENREGISTRER */}
          {/* ================================================== */}

          <div className="flex justify-end">
            <Button
              onClick={
                enregistrerDecision
              }
              disabled={
                !decision ||
                !motif.trim() ||
                enregistrement
              }
              type="button"
            >
              <ClipboardCheck className="h-4 w-4 mr-2" />

              {enregistrement
                ? "Enregistrement..."
                : "Enregistrer la décision"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}