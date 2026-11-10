// @ts-nocheck
import { useCallback } from "react";
import {
  CheckCircle2, ClipboardList, School, AlertTriangle,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import logoMen from "@/assets/logoMen.jpg";
import logoDpe from "@/assets/logoDpe.jpg";

import { useDemandeOuvertureLogic } from "@/components/demande-ouverture/useDemandeOuvertureLogic";
import { StepProgressBar, StepFooter } from "@/components/demande-ouverture/StepNav";
import StepGeneral from "@/components/demande-ouverture/StepGeneral";
import StepLocalisation from "@/components/demande-ouverture/StepLocalisation";
import StepNouvelleCreation from "@/components/demande-ouverture/StepNouvelleCreation";
import StepRegularisation from "@/components/demande-ouverture/StepRegularisation";
import StepComplementaire from "@/components/demande-ouverture/StepComplementaire";
import StepRecrutement from "@/components/demande-ouverture/StepRecrutement";
import StepEvolution from "@/components/demande-ouverture/StepEvolution";
import StepPieces from "@/components/demande-ouverture/StepPieces";

export default function DemandeOuverture() {
  const logic = useDemandeOuvertureLogic();
  const {
    form, change, niveauKey, cfg, steps, currentStep, setCurrentStep,
    validationErrors, error, ok, loading,
    localisationDetail, changeLocalisationDetail,
    locSelection, locOptions, changeLocSelection,
    villagesFokontany, villagesFokontanyLoading, villageLoading,
    rechercheEtabStatut, etablissementsTrouves, etablissementSelectionne,
    selectionnerEtablissement,
    nouvelleCreation, changeNouvelleCreation, evolutionSaisie, setEvolutionSaisie,
    regularisation, personnelExistant, personnelDetail, setPersonnelExistant, setPersonnelDetail,
    infoComplementaire, changeInfoComplementaire, tableProche, setTableProche,
    aireListe, setAireListe, evolutionRecuperee,
    ressources, changeEnseignants, pieces, changePiece,
    goToNext, goToPrev, submit,
    isAdmin, isDPE, isCISCO, isDREN, getNiveauxAutorises,
    nomDren, nomCisco,
    modalSecuriteOuvert, setModalSecuriteOuvert,
    modalSecuriteMessage, codeEtabInvalide,
    eligibiliteVillageErreur,
    villagesAlternatifsProposes,
    choisirVillageAlternatif,
    codeVillageSelectionne,
    zoneProposeeSelectionnee,
  } = logic;

  const stepId = steps[currentStep].id;
  const errors = validationErrors[stepId] || [];

  const hasFieldError = (name) => errors.some((e) => e.field === name);
  const getFieldErrorClass = (name) => hasFieldError(name) ? "border-red-500 bg-red-50 dark:bg-red-950/20" : "";
  const getFieldErrorMessage = (name) => errors.find((e) => e.field === name)?.message || "";
  const getTableErrors = () => errors.filter((e) => e.field && e.rowIndex !== undefined);

  const estRegularisation = form.type_demande === "Régularisation";
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === steps.length - 1;

  const estSurEtapeLocalisation = stepId === "localisation";

  // ✅ Le blocage est levé dès qu'une zone proposée (avec ou sans nom) est sélectionnée
  const zoneProposeeChoisie = Boolean(zoneProposeeSelectionnee);
  const blocageEligibilite =
    estSurEtapeLocalisation &&
    Boolean(eligibiliteVillageErreur) &&
    !zoneProposeeChoisie;

  const indexEtapeLocalisation = steps.findIndex((s) => s.id === "localisation");

  const handleGoToNext = useCallback(
    (e) => {
      if (blocageEligibilite) return;
      goToNext(e);
    },
    [blocageEligibilite, goToNext]
  );

  const handleSubmit = useCallback(
    (e) => {
      e.preventDefault();
      if (blocageEligibilite) return;
      submit(e);
    },
    [blocageEligibilite, submit]
  );

  const handleStepClick = useCallback(
    (index) => {
      if (
        blocageEligibilite &&
        indexEtapeLocalisation !== -1 &&
        index > indexEtapeLocalisation
      ) {
        return;
      }
      setCurrentStep(index);
    },
    [blocageEligibilite, indexEtapeLocalisation, setCurrentStep]
  );

  const renderStep = () => {
    switch (stepId) {
      case "general":
        return (
          <StepGeneral form={form} change={change}
            niveauKey={niveauKey} estRegularisation={estRegularisation}
            rechercheEtabStatut={rechercheEtabStatut}
            etablissementSelectionne={etablissementSelectionne}
            etablissementsTrouves={etablissementsTrouves}
            selectionnerEtablissement={selectionnerEtablissement}
            getFieldErrorClass={getFieldErrorClass}
            getFieldErrorMessage={getFieldErrorMessage}
            isAdmin={isAdmin}
            isDPE={isDPE}
            getNiveauxAutorises={getNiveauxAutorises}
          />
        );
      case "localisation":
        return (
          <StepLocalisation form={form} locSelection={locSelection}
            locOptions={locOptions} localisationDetail={localisationDetail}
            villagesFokontany={villagesFokontany}
            villagesFokontanyLoading={villagesFokontanyLoading}
            villageLoading={villageLoading}
            changeLocSelection={changeLocSelection}
            changeLocalisationDetail={changeLocalisationDetail}
            getFieldErrorClass={getFieldErrorClass}
            getFieldErrorMessage={getFieldErrorMessage}
            hasFieldError={hasFieldError}
            isAdmin={isAdmin}
            isCISCO={isCISCO}
            nomDren={nomDren}
            nomCisco={nomCisco}
            eligibiliteVillageErreur={eligibiliteVillageErreur}
            villagesAlternatifsProposes={villagesAlternatifsProposes}
            onChoisirVillageAlternatif={choisirVillageAlternatif}
            codeVillageSelectionne={codeVillageSelectionne}
            zoneProposeeSelectionnee={zoneProposeeSelectionnee}
          />
        );
      case "nouvelle_creation":
        return (
          <StepNouvelleCreation form={form} niveauKey={niveauKey} cfg={cfg}
            nouvelleCreation={nouvelleCreation} changeNouvelleCreation={changeNouvelleCreation}
            evolutionSaisie={evolutionSaisie} setEvolutionSaisie={setEvolutionSaisie}
            ressources={ressources} changeEnseignants={changeEnseignants}
            getFieldErrorClass={getFieldErrorClass}
            getFieldErrorMessage={getFieldErrorMessage}
            getTableErrors={getTableErrors} />
        );
      case "regularisation":
        return (
          <StepRegularisation regularisation={regularisation}
            personnelExistant={personnelExistant}
            personnelDetail={personnelDetail}
            setPersonnelExistant={setPersonnelExistant}
            setPersonnelDetail={setPersonnelDetail}
            getFieldErrorMessage={getFieldErrorMessage} />
        );
      case "complementaire":
        return (
          <StepComplementaire form={form} cfg={cfg}
            locSelection={locSelection}
            infoComplementaire={infoComplementaire}
            changeInfoComplementaire={changeInfoComplementaire}
            tableProche={tableProche} setTableProche={setTableProche}
            getFieldErrorClass={getFieldErrorClass}
            getFieldErrorMessage={getFieldErrorMessage}
            getTableErrors={getTableErrors} />
        );
      case "recrutement":
        return (
          <StepRecrutement form={form} cfg={cfg}
            aireListe={aireListe} setAireListe={setAireListe}
            villageLoading={villageLoading}
            getTableErrors={getTableErrors} />
        );
      case "evolution":
        return <StepEvolution niveauKey={niveauKey} evolutionRecuperee={evolutionRecuperee} />;
      case "pieces":
        return (
          <StepPieces form={form} pieces={pieces} changePiece={changePiece}
            errors={errors} getFieldErrorMessage={getFieldErrorMessage} />
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4 pb-8">
      <div className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 shadow-sm">
        <div className="mx-auto max-w-none px-3 sm:px-4 py-2 sm:py-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 shrink-0">
              <img src={logoMen} alt="MEN" className="h-8 w-8 sm:h-9 sm:w-9 rounded-md object-contain ring-1 ring-border bg-white p-0.5" />
              <img src={logoDpe} alt="DPE" className="h-8 w-8 sm:h-9 sm:w-9 rounded-md object-contain ring-1 ring-border bg-white p-0.5" />
            </div>
            <div className="flex-1 min-w-[180px]">
              <h1 className="text-sm sm:text-base font-semibold leading-tight text-foreground">Demande ouverture</h1>
              <p className="text-xs text-muted-foreground">Ministère de l'Éducation Nationale · Formulaire de demande</p>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <Badge variant="outline" className="text-xs gap-1">
                <ClipboardList className="h-3 w-3" />
                Étape {currentStep + 1} / {steps.length}
              </Badge>
              <Badge variant="outline" className="text-xs gap-1 border-primary/40 bg-primary/5 text-primary">
                <School className="h-3 w-3" />
                {form.type_demande || "—"}
                {form.type_demande === "Nouvelle création" && form.sous_type === "provisoire" && " Provisoire"}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {/* ✅ Bandeau d'éligibilité — bleu au lieu d'orange */}
      {eligibiliteVillageErreur && !zoneProposeeChoisie && (
        <div className="mx-3 sm:mx-4 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-300 dark:border-blue-800 text-blue-800 dark:text-blue-300 text-xs font-medium flex items-start gap-2">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold mb-0.5">Village non éligible</p>
            <p>{eligibiliteVillageErreur}</p>
            <p className="mt-1 text-[11px] opacity-80">
              Sélectionnez une zone éligible proposée ci-dessous, ou un autre village de la liste, pour continuer.
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="mx-3 sm:mx-4 p-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-xs font-medium flex items-start gap-2">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {ok && (
        <div className="mx-3 sm:mx-4 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 text-xs font-medium flex items-start gap-2">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span>{ok}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="px-3 sm:px-4 space-y-4">
        <StepProgressBar
          steps={steps}
          currentStep={currentStep}
          setCurrentStep={handleStepClick}
          totalSteps={steps.length}
          blocageAPartirDe={
            blocageEligibilite && indexEtapeLocalisation !== -1
              ? { id: "localisation", index: indexEtapeLocalisation }
              : null
          }
        />
        <Card className="min-h-[400px]">
          <CardContent className="p-3 sm:p-5">{renderStep()}</CardContent>
        </Card>
        <StepFooter
          currentStep={currentStep}
          totalSteps={steps.length}
          isFirstStep={isFirstStep}
          isLastStep={isLastStep}
          loading={loading}
          goToPrev={goToPrev}
          goToNext={handleGoToNext}
          disabledNext={blocageEligibilite}
          blockedMessage={
            blocageEligibilite
              ? "Sélectionnez une zone éligible proposée pour continuer."
              : ""
          }
        />
      </form>

      <Dialog open={modalSecuriteOuvert} onOpenChange={setModalSecuriteOuvert}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Erreur de sécurité
            </DialogTitle>
            <DialogDescription className="text-sm pt-2">
              {modalSecuriteMessage}
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border bg-red-50 p-3 mt-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold text-red-700">Code établissement :</span>
              <span className="font-mono font-bold text-red-900">{codeEtabInvalide}</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Veuillez saisir un code d'établissement qui appartient à votre CISCO et qui n'est pas un Lycée.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalSecuriteOuvert(false)}>
              Compris, changer le code
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}