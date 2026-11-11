import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  ClipboardCheck,
  KeyRound,
  Loader2,
  Search,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { api } from "@/services/demandeApi";

// ============================================================
// TYPES
// ============================================================

type Demande = {
  id: number | string;
  reference: string;
  nom_etab: string;
  niveau: string;
  commune: string;
  cisco: string;
  date_decision: string;
  type_demande: string;
  code?: string;
};

// ============================================================
// UTILITAIRES
// ============================================================

function getList<T>(data: unknown): T[] {
  if (Array.isArray(data)) {
    return data as T[];
  }

  if (
    data &&
    typeof data === "object" &&
    "results" in data &&
    Array.isArray(
      (data as { results?: unknown }).results,
    )
  ) {
    return (data as { results: T[] }).results;
  }

  return [];
}

function text(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).trim();
}

function normaliser(value: unknown): string {
  return text(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function formatDate(value: unknown): string {
  const valueText = text(value);

  if (!valueText) {
    return "";
  }

  const date = new Date(valueText);

  if (Number.isNaN(date.getTime())) {
    return valueText;
  }

  return date.toLocaleDateString("fr-FR");
}

// ============================================================
// DÉTECTION DU TYPE DE DEMANDE
// ============================================================

function estNouvelleCreation(demande: any): boolean {
  const typeDemande = normaliser(
    demande?.type_demande ??
      demande?.type ??
      demande?.nature_demande ??
      demande?.nature ??
      demande?.motif_demande,
  );

  // Nouvelle création
  if (
    typeDemande === "nouvelle creation" ||
    typeDemande === "nouvelle_creation" ||
    typeDemande === "creation" ||
    typeDemande === "nouvelle ouverture" ||
    typeDemande === "nouvelle ouverture d etablissement" ||
    typeDemande === "ouverture"
  ) {
    return true;
  }

  // Régularisation : toujours exclue
  if (
    typeDemande === "regularisation" ||
    typeDemande === "regularisation d etablissement" ||
    typeDemande === "regularisation ouverture"
  ) {
    return false;
  }

  return false;
}

// ============================================================
// DÉTECTION DE LA VALIDATION
// ============================================================

function estDemandeValidee(demande: any): boolean {
  const statut = normaliser(
    demande?.statut_demande ??
      demande?.statut ??
      demande?.status,
  );

  if (
    statut === "validee" ||
    statut === "valide" ||
    statut === "approuvee" ||
    statut === "approuve" ||
    statut === "acceptee" ||
    statut === "acceptee"
  ) {
    return true;
  }

  const decision = demande?.decision_detail;

  if (!decision) {
    return false;
  }

  const decisionStatut = normaliser(
    decision?.decision ??
      decision?.statut ??
      decision?.resultat ??
      decision?.decision_finale,
  );

  return (
    decisionStatut === "validee" ||
    decisionStatut === "valide" ||
    decisionStatut === "approuvee" ||
    decisionStatut === "approuve" ||
    decisionStatut === "acceptee"
  );
}

// ============================================================
// DÉTECTION DU CODE DÉJÀ ATTRIBUÉ
// ============================================================

function getCodeAttribution(demande: any): string {
  return text(
    demande?.attribution_code_detail?.code ??
      demande?.attribution_code?.code ??
      demande?.attribution?.code,
  );
}

// ============================================================
// COMPOSANT
// ============================================================

export default function AttributionCode() {
  const [demandes, setDemandes] = useState<Demande[]>([]);
  const [recherche, setRecherche] = useState("");
  const [selection, setSelection] =
    useState<Demande | null>(null);
  const [code, setCode] = useState("");
  const [chargement, setChargement] =
    useState(true);
  const [enregistrement, setEnregistrement] =
    useState(false);
  const [erreur, setErreur] = useState("");
  const [message, setMessage] = useState("");

  // ==========================================================
  // CHARGER LES DEMANDES
  // ==========================================================

  const chargerDemandes = async () => {
    try {
      setChargement(true);
      setErreur("");

      const reponse: unknown = await api.get(
        "/ouverture/demandes/",
      );

      console.log(
        "=== DEMANDES POUR ATTRIBUTION DE CODE ===",
      );

      console.log(
        "Réponse API :",
        reponse,
      );

      const liste = getList<any>(reponse);

      console.log(
        "Nombre total de demandes :",
        liste.length,
      );

      // --------------------------------------------------------
      // SEULEMENT :
      //
      // 1. NOUVELLE CRÉATION
      // 2. VALIDÉE / APPROUVÉE
      // 3. SANS CODE D'ATTRIBUTION
      //
      // Une régularisation est toujours exclue.
      // --------------------------------------------------------

      const demandesPourAttribution =
        liste.filter((demande: any) => {
          const nouvelleCreation =
            estNouvelleCreation(demande);

          const valide =
            estDemandeValidee(demande);

          const codeAttribution =
            getCodeAttribution(demande);

          const sansCode =
            !codeAttribution;

          const afficher =
            nouvelleCreation &&
            valide &&
            sansCode;

          console.log(
            "Demande :",
            demande?.id_demande ??
              demande?.id,
            {
              type:
                demande?.type_demande ??
                demande?.type ??
                demande?.nature_demande,
              statut:
                demande?.statut_demande ??
                demande?.statut ??
                demande?.status,
              code_etab:
                demande?.code_etab,
              code_attribution:
                codeAttribution,
              nouvelle_creation:
                nouvelleCreation,
              valide,
              sans_code:
                sansCode,
              afficher,
            },
          );

          return afficher;
        });

      console.log(
        "Demandes de nouvelle création validées sans code :",
        demandesPourAttribution,
      );

      // --------------------------------------------------------
      // MAPPING
      // --------------------------------------------------------

      const mapped: Demande[] =
        demandesPourAttribution.map(
          (d: any) => ({
            id:
              d.id_demande ??
              d.id,

            reference:
              text(d.reference) ||
              text(d.code_etab) ||
              `Demande #${
                d.id_demande ??
                d.id
              }`,

            nom_etab:
              text(d.nom_etab) ||
              text(d.nom_etablissement) ||
              "Non renseigné",

            niveau:
              text(d.niveau_etab) ||
              text(d.niveau) ||
              "Non renseigné",

            commune:
              text(d.commune) ||
              "Non renseignée",

            cisco:
              text(d.cisco) ||
              "Non renseigné",

            type_demande:
              text(
                d.type_demande ??
                  d.type ??
                  d.nature_demande,
              ) ||
              "Nouvelle création",

            date_decision:
              d.decision_detail
                ?.date_decision
                ? formatDate(
                    d.decision_detail
                      .date_decision,
                  )
                : d.date_decision
                  ? formatDate(
                      d.date_decision,
                    )
                  : "",

            // Ici on ne récupère volontairement
            // que le code d'attribution.
            //
            // code_etab n'est PAS utilisé comme
            // code d'attribution.
            code:
              getCodeAttribution(d),
          }),
        );

      setDemandes(mapped);

      // --------------------------------------------------------
      // SI UNE DEMANDE ÉTAIT SÉLECTIONNÉE ET
      // QU'ELLE N'EST PLUS DISPONIBLE
      // --------------------------------------------------------

      if (selection) {
        const existeEncore =
          mapped.some(
            (demande) =>
              String(demande.id) ===
              String(selection.id),
          );

        if (!existeEncore) {
          setSelection(null);
          setCode("");
        }
      }
    } catch (error: any) {
      console.error(
        "Erreur récupération demandes :",
        error,
      );

      setErreur(
        error?.message ||
          "Impossible de récupérer les demandes.",
      );

      setDemandes([]);
    } finally {
      setChargement(false);
    }
  };

  // ==========================================================
  // CHARGEMENT INITIAL
  // ==========================================================

  useEffect(() => {
    chargerDemandes();
  }, []);

  // ==========================================================
  // RECHERCHE
  // ==========================================================

  const demandesFiltrees = useMemo(() => {
    const valeur =
      recherche
        .toLowerCase()
        .trim();

    if (!valeur) {
      return demandes;
    }

    return demandes.filter(
      (demande) =>
        demande.reference
          .toLowerCase()
          .includes(valeur) ||
        demande.nom_etab
          .toLowerCase()
          .includes(valeur) ||
        demande.niveau
          .toLowerCase()
          .includes(valeur) ||
        demande.commune
          .toLowerCase()
          .includes(valeur) ||
        demande.cisco
          .toLowerCase()
          .includes(valeur),
    );
  }, [
    demandes,
    recherche,
  ]);

  // ==========================================================
  // ATTRIBUTION DU CODE
  // ==========================================================

  const attribuerCode = async () => {
    if (!selection) {
      return;
    }

    const codePropre =
      code.trim();

    if (!codePropre) {
      setErreur(
        "Veuillez saisir le code établissement.",
      );
      return;
    }

    try {
      setEnregistrement(true);
      setErreur("");
      setMessage("");

      await api.post(
        "/ouverture/attributions-code/",
        {
          demande:
            selection.id,
          code:
            codePropre,
        },
      );

      // ------------------------------------------------------
      // SUCCÈS
      // ------------------------------------------------------

      setSelection(null);
      setCode("");

      setMessage(
        "Code attribué avec succès.",
      );

      // ------------------------------------------------------
      // RECHARGEMENT
      //
      // La demande vient maintenant d'avoir
      // un attribution_code_detail.code.
      //
      // Elle ne sera donc plus affichée.
      // ------------------------------------------------------

      await chargerDemandes();
    } catch (error: any) {
      console.error(
        "Erreur attribution code :",
        error,
      );

      setErreur(
        error?.message ||
          "Impossible d'attribuer le code.",
      );
    } finally {
      setEnregistrement(false);
    }
  };

  // ==========================================================
  // ANNULER
  // ==========================================================

  const annuler = () => {
    setSelection(null);
    setCode("");
    setErreur("");
  };

  // ==========================================================
  // AFFICHAGE
  // ==========================================================

  return (
    <div className="space-y-6">
      {/* ======================================================
          TITRE
      ====================================================== */}

      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Attribution de code
        </h1>

        <p className="text-sm text-muted-foreground mt-1">
          Attribuez un code aux nouvelles créations
          approuvées pour l'ouverture provisoire.
        </p>
      </div>

      {/* ======================================================
          ERREUR
      ====================================================== */}

      {erreur && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {erreur}
        </div>
      )}

      {/* ======================================================
          MESSAGE
      ====================================================== */}

      {message && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {message}
        </div>
      )}

      {/* ======================================================
          LISTE
      ====================================================== */}

      <Card>
        <CardHeader>
          <CardTitle>
            Nouvelles créations approuvées
            sans code
          </CardTitle>
        </CardHeader>

        <CardContent>
          {/* ==================================================
              RECHERCHE
          ================================================== */}

          <div className="relative mb-5">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />

            <Input
              value={recherche}
              onChange={(event) =>
                setRecherche(
                  event.target.value,
                )
              }
              placeholder="Rechercher un établissement..."
              className="pl-9"
            />
          </div>

          {/* ==================================================
              CHARGEMENT
          ================================================== */}

          {chargement && (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              Chargement...
            </div>
          )}

          {/* ==================================================
              AUCUNE DEMANDE
          ================================================== */}

          {!chargement &&
            demandesFiltrees.length ===
              0 && (
              <div className="rounded-lg border border-dashed p-8 text-center">
                <p className="font-medium">
                  Aucune demande à traiter
                </p>

                <p className="text-sm text-muted-foreground mt-1">
                  Aucune nouvelle création
                  approuvée sans code n'a
                  été trouvée.
                </p>
              </div>
            )}

          {/* ==================================================
              LISTE DES DEMANDES
          ================================================== */}

          {!chargement &&
            demandesFiltrees.length >
              0 && (
              <div className="space-y-3">
                {demandesFiltrees.map(
                  (demande) => (
                    <div
                      key={
                        demande.id
                      }
                      className="border rounded-lg p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4"
                    >
                      {/* ======================================
                          INFORMATIONS
                      ====================================== */}

                      <div>
                        <p className="font-semibold">
                          {
                            demande.nom_etab
                          }
                        </p>

                        <p className="text-sm text-muted-foreground">
                          {
                            demande.reference
                          }{" "}
                          ·{" "}
                          {
                            demande.niveau
                          }
                        </p>

                        <p className="text-sm text-muted-foreground">
                          {
                            demande.commune
                          }{" "}
                          ·{" "}
                          {
                            demande.cisco
                          }
                        </p>

                        <p className="text-xs text-muted-foreground mt-1">
                          Type :{" "}
                          {
                            demande.type_demande
                          }
                        </p>

                        {demande.date_decision && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Décision :{" "}
                            {
                              demande.date_decision
                            }
                          </p>
                        )}
                      </div>

                      {/* ======================================
                          BOUTON
                      ====================================== */}

                      <div className="flex items-center gap-3">
                        <Button
                          size="sm"
                          onClick={() => {
                            setSelection(
                              demande,
                            );
                            setCode("");
                            setErreur("");
                            setMessage("");
                          }}
                        >
                          <KeyRound className="h-4 w-4 mr-2" />
                          Attribuer
                        </Button>
                      </div>
                    </div>
                  ),
                )}
              </div>
            )}
        </CardContent>
      </Card>

      {/* ======================================================
          FORMULAIRE ATTRIBUTION
      ====================================================== */}

      {selection && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5" />
              Attribution du code
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-5">
            {/* ==================================================
                DEMANDE SÉLECTIONNÉE
            ================================================== */}

            <div className="rounded-lg bg-muted p-4">
              <p className="font-semibold">
                {
                  selection.nom_etab
                }
              </p>

              <p className="text-sm text-muted-foreground">
                {
                  selection.reference
                }{" "}
                ·{" "}
                {
                  selection.niveau
                }
              </p>

              <p className="text-sm text-muted-foreground">
                {
                  selection.commune
                }{" "}
                ·{" "}
                {
                  selection.cisco
                }
              </p>

              <p className="text-xs text-muted-foreground mt-1">
                Type :{" "}
                {
                  selection.type_demande
                }
              </p>
            </div>

            {/* ==================================================
                CODE
            ================================================== */}

            <div>
              <label className="text-sm font-medium">
                Code établissement
              </label>

              <Input
                value={code}
                onChange={(event) =>
                  setCode(
                    event.target.value,
                  )
                }
                placeholder="Ex. 206030017"
                className="mt-2"
                disabled={
                  enregistrement
                }
              />
            </div>

            {/* ==================================================
                BOUTONS
            ================================================== */}

            <div className="flex gap-3">
              <Button
                onClick={
                  attribuerCode
                }
                disabled={
                  enregistrement ||
                  !code.trim()
                }
              >
                {enregistrement ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Attribution...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Attribuer le code
                  </>
                )}
              </Button>

              <Button
                variant="outline"
                onClick={annuler}
                disabled={
                  enregistrement
                }
              >
                Annuler
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}