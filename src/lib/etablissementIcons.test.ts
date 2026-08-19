import { describe, expect, it } from "vitest";
import {
  ETABLISSEMENT_ICON_CLASSES,
  ETABLISSEMENT_ICON_ORDER,
  type EtablissementIconType,
} from "./etablissementIcons";

describe("etablissementIcons", () => {
  it("matches the SIG reference for all establishment types", () => {
    expect(ETABLISSEMENT_ICON_CLASSES.primaire).toBe("fas fa-book-open");
    expect(ETABLISSEMENT_ICON_CLASSES.college).toBe("fas fa-school");
    expect(ETABLISSEMENT_ICON_CLASSES.lycee).toBe("fas fa-building");
    expect(ETABLISSEMENT_ICON_CLASSES.village).toBe("fas fa-home");
    expect(ETABLISSEMENT_ICON_ORDER).toEqual(["primaire", "college", "lycee", "village"]);
  });

  it("supports the known icon type union", () => {
    const value: EtablissementIconType = "college";
    expect(ETABLISSEMENT_ICON_CLASSES[value]).toBe("fas fa-school");
  });
});
