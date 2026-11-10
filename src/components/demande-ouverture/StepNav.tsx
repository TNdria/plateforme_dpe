// @ts-nocheck
import { CheckCircle2, ChevronLeft, ChevronRight, Loader2, Save } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function StepProgressBar({
  steps,
  currentStep,
  setCurrentStep,
  totalSteps,
  // ✅ NOUVEAU : étape à partir de laquelle on ne peut plus cliquer
  // (ex. "localisation" bloquée par éligibilité village)
  blocageAPartirDe = null, // { id: "localisation", index: <int> }
  // ✅ NOUVEAU : liste d'index désactivés (calculée par le parent)
  disabledSteps = [],
}) {
  const indexBlocage = (() => {
    if (blocageAPartirDe && typeof blocageAPartirDe.index === "number") {
      return blocageAPartirDe.index;
    }
    const i = steps.findIndex((s) => s.id === blocageAPartirDe?.id);
    return i >= 0 ? i : -1;
  })();

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-center justify-between gap-2 mb-3 overflow-x-auto pb-2">
          {steps.map((step, index) => {
            const isActive = index === currentStep;
            const isCompleted = index < currentStep;

            // ✅ Blocage : on ne peut pas cliquer sur une étape POSTÉRIEURE
            // à la localisation si le village est non éligible.
            const bloqueParEligibilite =
              indexBlocage >= 0 &&
              index > indexBlocage &&
              index !== currentStep;

            const bloqueParParent = disabledSteps.includes(index);

            const disabled = bloqueParEligibilite || bloqueParParent;

            return (
              <button
                key={step.id}
                type="button"
                onClick={() => {
                  if (disabled) return;
                  setCurrentStep(index);
                }}
                disabled={disabled}
                aria-disabled={disabled}
                title={
                  disabled
                    ? "Vous ne pouvez pas accéder à cette étape tant que le village n'est pas éligible."
                    : step.label
                }
                className={cn(
                  "flex flex-col items-center gap-1 shrink-0 min-w-[65px] sm:min-w-[75px] transition-all",
                  isActive && "scale-105",
                  disabled && "opacity-40 cursor-not-allowed pointer-events-none"
                )}
              >
                <div
                  className={cn(
                    "w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all",
                    isActive && "bg-primary text-primary-foreground shadow-md shadow-primary/30",
                    isCompleted && "bg-emerald-500 text-white",
                    !isActive && !isCompleted && "bg-muted text-muted-foreground",
                    disabled && "opacity-60"
                  )}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  ) : (
                    <span>{index + 1}</span>
                  )}
                </div>
                <span
                  className={cn(
                    "text-[10px] font-medium text-center leading-tight",
                    isActive ? "text-primary font-semibold" : "text-muted-foreground",
                    disabled && "opacity-60"
                  )}
                >
                  {step.label}
                </span>
              </button>
            );
          })}
        </div>
        <div className="w-full h-1 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-primary to-emerald-500 rounded-full transition-all duration-500"
            style={{ width: `${((currentStep + 1) / totalSteps) * 100}%` }}
          />
        </div>
      </CardContent>
    </Card>
  );
}

export function StepFooter({
  currentStep,
  totalSteps,
  isFirstStep,
  isLastStep,
  loading,
  goToPrev,
  goToNext,
  // ✅ NOUVEAU : désactive le bouton Suivant / Enregistrer
  disabledNext = false,
  // ✅ NOUVEAU : message d'aide à afficher si bloqué
  blockedMessage = "",
}) {
  return (
    <div className="space-y-2">
      {disabledNext && blockedMessage && (
        <p className="text-xs text-amber-700 dark:text-amber-400 text-center">
          {blockedMessage}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={goToPrev}
          disabled={isFirstStep}
          className="gap-2"
        >
          <ChevronLeft className="h-4 w-4" />
          Précédent
        </Button>

        <span className="text-xs sm:text-sm text-muted-foreground font-medium">
          Étape {currentStep + 1} / {totalSteps}
        </span>

        {isLastStep ? (
          <Button
            className="gap-2 shadow-md"
            size="sm"
            disabled={loading || disabledNext}
            type="submit"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {loading ? "Enregistrement..." : "Enregistrer"}
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            onClick={goToNext}
            disabled={disabledNext}
            className="gap-2 shadow-md"
          >
            Suivant
            <ChevronRight className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}