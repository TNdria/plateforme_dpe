import { describe, expect, it } from "vitest";
import {
  ETABLISSEMENT_ICON_CLASSES,
  ETABLISSEMENT_ICON_COLORS,
  ETABLISSEMENT_ICON_ORDER,
  getEtablissementIconClass,
} from "./etablissementIcons";

describe("etablissementIcons", () => {
  it("utilise le même pictogramme bâtiment pour tous les établissements", () => {
    expect(ETABLISSEMENT_ICON_CLASSES.prescolaire).toBe("fas fa-school");
    expect(ETABLISSEMENT_ICON_CLASSES.primaire).toBe("fas fa-school");
    expect(ETABLISSEMENT_ICON_CLASSES.college).toBe("fas fa-school");
    expect(ETABLISSEMENT_ICON_CLASSES.lycee).toBe("fas fa-school");
  });

  it("représente les villages par un point", () => {
    expect(ETABLISSEMENT_ICON_CLASSES.village).toBe("fas fa-circle");
  });

  it("différencie les niveaux uniquement par la couleur", () => {
    const couleurs = ETABLISSEMENT_ICON_ORDER.filter((t) => t !== "village").map(
      (t) => ETABLISSEMENT_ICON_COLORS[t],
    );
    expect(new Set(couleurs).size).toBe(couleurs.length);
  });

  it("expose un helper de classe", () => {
    expect(getEtablissementIconClass("lycee")).toBe("fas fa-school");
  });
});
