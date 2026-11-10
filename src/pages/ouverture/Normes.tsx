// @ts-nocheck

import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  HelpCircle,
  Info,
  ShieldCheck,
  ShieldAlert,
  ShieldQuestion,
  ClipboardCheck,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

import { CAT, STATUT } from "@/services/normesAnalyse";

// ============================================================
// TYPES
// ============================================================

type AnalyseSummary = {
  total?: number;
  ok?: number;
  derog?: number;
  ko?: number;
  nv?: number;
};

type AnalyseItem = {
  id?: string | number;
  categorie?: string;
  libelle?: string;
  norme?: string;
  valeur?: unknown;
  detail?: string;
  statut?: string;
};

type Analyse = {
  phase?: "provisoire" | "definitive";
  verdict?: "validee" | "reserve" | "non_conforme";
  message?: string;
  summary?: AnalyseSummary;
  items?: AnalyseItem[];
};

// ============================================================
// STYLES PAR STATUT
// ============================================================

const STATUT_UI = {
  [STATUT.OK]: {
    label: "Conforme",
    icon: CheckCircle2,
    cls:
      "bg-emerald-50 text-emerald-700 border-emerald-300 " +
      "dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800",
  },

  [STATUT.DEROG]: {
    label: "Conforme (dérogation)",
    icon: AlertTriangle,
    cls:
      "bg-amber-50 text-amber-700 border-amber-300 " +
      "dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800",
  },

  [STATUT.KO]: {
    label: "Non conforme",
    icon: XCircle,
    cls:
      "bg-red-50 text-red-700 border-red-300 " +
      "dark:bg-red-950/30 dark:text-red-400 dark:border-red-800",
  },

  [STATUT.NV]: {
    label: "Non vérifiable",
    icon: HelpCircle,
    cls:
      "bg-slate-100 text-slate-600 border-slate-300 " +
      "dark:bg-slate-900/40 dark:text-slate-400 dark:border-slate-700",
  },

  [STATUT.INFO]: {
    label: "Information",
    icon: Info,
    cls:
      "bg-blue-50 text-blue-700 border-blue-300 " +
      "dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800",
  },
};

// ============================================================
// STYLES DU VERDICT
// ============================================================

const VERDICT_UI = {
  validee: {
    icon: ShieldCheck,
    cls:
      "bg-emerald-50 border-emerald-500 text-emerald-800 " +
      "dark:bg-emerald-950/20 dark:text-emerald-300",
    titre: "Analyse validée",
  },

  reserve: {
    icon: ShieldQuestion,
    cls:
      "bg-amber-50 border-amber-500 text-amber-800 " +
      "dark:bg-amber-950/20 dark:text-amber-300",
    titre: "Analyse validée sous réserve",
  },

  non_conforme: {
    icon: ShieldAlert,
    cls:
      "bg-red-50 border-red-500 text-red-800 " +
      "dark:bg-red-950/20 dark:text-red-300",
    titre: "Analyse non validée",
  },
};

// ============================================================
// ORDRE DES CATÉGORIES
// ============================================================

const ORDRE_CATEGORIES = [
  CAT.OUVERTURE,
  CAT.PEDAGO,
  CAT.DOSSIER,
  CAT.ADMIN,
];

// ============================================================
// BADGE DE STATUT
// ============================================================

export const StatutBadge = ({
  statut,
}: {
  statut?: string;
}) => {
  const ui =
    STATUT_UI[statut] ||
    STATUT_UI[STATUT.NV];

  const Icon = ui.icon;

  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1 text-[11px] whitespace-nowrap",
        ui.cls
      )}
    >
      <Icon className="h-3 w-3" />
      {ui.label}
    </Badge>
  );
};

// ============================================================
// BANDEAU DE VERDICT
// ============================================================

export function VerdictBanner({
  analyse,
  className,
}: {
  analyse?: Analyse | null;
  className?: string;
}) {
  if (!analyse) return null;

  const ui =
    VERDICT_UI[analyse.verdict] ||
    VERDICT_UI.reserve;

  const Icon = ui.icon;

  const summary: AnalyseSummary =
    analyse.summary ?? {
      total: 0,
      ok: 0,
      derog: 0,
      ko: 0,
      nv: 0,
    };

  const total = summary.total ?? 0;
  const ok = summary.ok ?? 0;
  const derog = summary.derog ?? 0;
  const ko = summary.ko ?? 0;
  const nv = summary.nv ?? 0;

  const titreAffiche =
    analyse.verdict === "validee" && derog > 0
      ? "Analyse validée avec dérogation"
      : ui.titre;

  return (
    <div
      className={cn(
        "p-3 rounded-lg border-l-4 flex items-start gap-3",
        ui.cls,
        className
      )}
    >
      <Icon className="h-5 w-5 shrink-0 mt-0.5" />

      <div className="space-y-1 min-w-0 flex-1">
        <p className="text-sm font-bold">
          {titreAffiche}
        </p>

        <p className="text-xs">
          {analyse.message ||
            "Résultat de l'analyse des normes."}
        </p>

        <div className="flex flex-wrap gap-1.5 pt-1">
          <Badge variant="outline" className="text-[10px] bg-background">
            {ok} conforme(s)
          </Badge>

          {derog > 0 && (
            <Badge variant="outline" className="text-[10px] bg-background">
              {derog} dérogation(s)
            </Badge>
          )}

          {ko > 0 && (
            <Badge variant="outline" className="text-[10px] bg-background">
              {ko} non conforme(s)
            </Badge>
          )}

          {nv > 0 && (
            <Badge variant="outline" className="text-[10px] bg-background">
              {nv} non vérifiable(s)
            </Badge>
          )}

          {total > 0 && (
            <Badge variant="outline" className="text-[10px] bg-background">
              {total} critère(s)
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// SECTION D'ANALYSE
// ============================================================

export function AnalyseNormesSection({
  num = "IX",
  analyse,
  phase,
  onPhaseChange,
}: {
  num?: string;
  analyse?: Analyse | null;
  phase?: "provisoire" | "definitive";
  onPhaseChange?: (
    value: "provisoire" | "definitive"
  ) => void;
}) {
  if (!analyse) return null;

  const lignesAnalyse: AnalyseItem[] =
    Array.isArray(analyse.items)
      ? analyse.items
      : [];

  const phaseActuelle =
    phase ||
    analyse.phase ||
    "provisoire";

  const groupes = ORDRE_CATEGORIES
    .map((categorie) => ({
      categorie,
      lignes: lignesAnalyse.filter(
        (item) =>
          item?.categorie === categorie
      ),
    }))
    .filter(
      (groupe) =>
        groupe.lignes.length > 0
    );

  const categoriesSupplementaires =
    lignesAnalyse
      .map(
        (item) =>
          item?.categorie
      )
      .filter(
        (categorie, index, array) =>
          categorie &&
          !ORDRE_CATEGORIES.includes(
            categorie
          ) &&
          array.indexOf(categorie) ===
            index
      );

  const groupesComplets = [
    ...groupes,
    ...categoriesSupplementaires
      .map((categorie) => ({
        categorie,
        lignes:
          lignesAnalyse.filter(
            (item) =>
              item?.categorie ===
              categorie
          ),
      }))
      .filter(
        (groupe) =>
          groupe.lignes.length > 0
      ),
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 pb-3 border-b-2 border-border">
        <span
          className={
            "inline-flex items-center justify-center " +
            "w-8 h-8 rounded-full text-white font-bold " +
            "text-sm shrink-0 bg-primary"
          }
        >
          {num}
        </span>

        <span
          className={
            "text-lg font-semibold text-foreground " +
            "flex items-center gap-2"
          }
        >
          <ClipboardCheck className="h-5 w-5 text-primary" />
          Analyse de conformité aux normes
        </span>

        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            Phase d'ouverture
          </span>

          <Select
            value={phaseActuelle}
            onValueChange={(value) =>
              onPhaseChange?.(
                value as
                  | "provisoire"
                  | "definitive"
              )
            }
          >
            <SelectTrigger className="h-8 w-[190px] text-xs bg-background">
              <SelectValue placeholder="Sélectionner la phase" />
            </SelectTrigger>

            <SelectContent>
              <SelectItem value="provisoire">
                Ouverture provisoire
              </SelectItem>

              <SelectItem value="definitive">
                Ouverture définitive
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <VerdictBanner analyse={analyse} />

      {groupesComplets.length === 0 ? (
        <Card className="border-border/60">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <HelpCircle className="h-4 w-4" />
              Aucune donnée d'analyse disponible.
            </div>
          </CardContent>
        </Card>
      ) : (
        groupesComplets.map(
          ({ categorie, lignes }) => (
            <Card
              key={categorie}
              className="overflow-hidden border-border/60"
            >
              <div className="px-4 py-2 border-b bg-muted/40">
                <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
                  {categorie}
                </h4>
              </div>

              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead className="text-[11px] font-bold uppercase tracking-wider min-w-[230px]">
                          Critère
                        </TableHead>

                        <TableHead className="text-[11px] font-bold uppercase tracking-wider min-w-[220px]">
                          Norme
                        </TableHead>

                        <TableHead className="text-[11px] font-bold uppercase tracking-wider min-w-[190px]">
                          Valeur du dossier
                        </TableHead>

                        <TableHead className="text-[11px] font-bold uppercase tracking-wider min-w-[160px]">
                          Résultat
                        </TableHead>
                      </TableRow>
                    </TableHeader>

                    <TableBody>
                      {lignes.map((ligne, index) => {
                        const statut =
                          ligne?.statut ||
                          STATUT.NV;

                        return (
                          <TableRow
                            key={
                              ligne?.id
                                ? `${categorie}-${ligne.id}`
                                : `${categorie}-${index}`
                            }
                            className={cn(
                              statut === STATUT.KO &&
                                "bg-red-50/40 dark:bg-red-950/10",
                              statut === STATUT.DEROG &&
                                "bg-amber-50/20 dark:bg-amber-950/5",
                              statut === STATUT.NV &&
                                "bg-slate-50/40 dark:bg-slate-950/10"
                            )}
                          >
                            <TableCell className="text-sm font-medium align-top">
                              <div className="flex flex-col gap-1">
                                <span>
                                  {ligne?.libelle ||
                                    "Critère non renseigné"}
                                </span>

                                {ligne?.detail && (
                                  <p className="text-xs font-normal text-muted-foreground leading-relaxed">
                                    {ligne.detail}
                                  </p>
                                )}
                              </div>
                            </TableCell>

                            <TableCell className="text-sm text-muted-foreground align-top">
                              {ligne?.norme || "—"}
                            </TableCell>

                            <TableCell className="text-sm align-top">
                              {ligne?.valeur !== undefined &&
                              ligne?.valeur !== null &&
                              String(ligne.valeur).trim() !== ""
                                ? String(ligne.valeur)
                                : "Non renseigné"}
                            </TableCell>

                            <TableCell className="align-top">
                              <StatutBadge statut={statut} />
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )
        )
      )}

      <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
            <span className="text-[11px] text-muted-foreground">
              Conforme
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
            <span className="text-[11px] text-muted-foreground">
              Dérogation prévue par la norme
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <XCircle className="h-3.5 w-3.5 text-red-600" />
            <span className="text-[11px] text-muted-foreground">
              Non conforme
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <HelpCircle className="h-3.5 w-3.5 text-slate-500" />
            <span className="text-[11px] text-muted-foreground">
              Non vérifiable
            </span>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-3 dark:border-blue-900 dark:bg-blue-950/20">
        <p className="text-[11px] text-muted-foreground flex items-start gap-1.5 leading-relaxed">
          <Info className="h-3.5 w-3.5 shrink-0 mt-0.5 text-blue-600" />

          <span>
            Certains éléments restent à vérifier sur pièces ou lors de la visite
            de terrain : conformité ergonomique des latrines, état et équipement
            effectif des salles de classe, authenticité du code provisoire MEN,
            qualification des enseignants FRAM (diplômes + expérience dans le
            public), accessibilité réelle du site, disponibilité effective du
            domaine scolaire et de l'espace adéquat pour l'implantation, ainsi
            que tous les autres éléments techniques qui ne sont pas disponibles
            dans les données du dossier.
          </span>
        </p>
      </div>
    </div>
  );
}

export default AnalyseNormesSection;