import { describe, expect, it } from "vitest";
import {
  ETABLISSEMENT_ICON_COLORS,
  ETABLISSEMENT_ICON_ORDER,
  SECTOR_COLORS,
  getEtablissementIconHtml,
  getSchoolLevelIconPath,
  getSchoolLevelIconHtml,
  normalizeSchoolLevel,
} from "./etablissementIcons";

describe("etablissementIcons", () => {
  it("associe une icône distincte à chaque niveau scolaire", () => {
    const paths = ["prescolaire", "primaire", "college", "lycee"].map((level) =>
      getSchoolLevelIconPath(level),
    );
    expect(paths.every(Boolean)).toBe(true);
    expect(new Set(paths).size).toBe(4);
    expect(getSchoolLevelIconHtml("college")).toContain('fill="currentColor"');
    expect(getSchoolLevelIconHtml("college")).toContain('viewBox="0 0 24 24"');
    expect(getSchoolLevelIconHtml("college")).toContain('fill-rule="evenodd"');
    expect(getSchoolLevelIconHtml("college")).not.toContain("stroke=");
  });

  it("associe chaque alias de niveau au tracé architectural canonique", () => {
    expect(getSchoolLevelIconPath("n0")).toBe(getSchoolLevelIconPath("prescolaire"));
    expect(getSchoolLevelIconPath("n1")).toBe(getSchoolLevelIconPath("primaire"));
    expect(getSchoolLevelIconPath("n2")).toBe(getSchoolLevelIconPath("college"));
    expect(getSchoolLevelIconPath("n3")).toBe(getSchoolLevelIconPath("lycee"));
    expect(getSchoolLevelIconPath("Préscolaire")).toBe(getSchoolLevelIconPath("prescolaire"));
  });

  it("représente les villages par une silhouette de maisons", () => {
    const villageIcon = getEtablissementIconHtml("village", "#888");
    expect(villageIcon).toContain('color:#888');
    expect(villageIcon).toContain('d="M1 11.2 6.2 6.8l5.1 4.4V21H1zM7.1 8.9 12 4.5l5 4.4V21H7.1zM14 11.2l4.3-3.8 4.7 3.8V21H14z"');
    expect(villageIcon).not.toContain('fill-rule="evenodd"');
  });

  it("distingue le secteur public du secteur privé avec la palette de l'application", () => {
    expect(SECTOR_COLORS).toMatchObject({
      public: "#2563eb",
      private: "#f59e0b",
    });
    expect(SECTOR_COLORS.public).not.toBe(SECTOR_COLORS.private);
    expect(getSchoolLevelIconHtml("prescolaire", `color:${SECTOR_COLORS.public}`)).toContain(`color:${SECTOR_COLORS.public}`);
    expect(getSchoolLevelIconHtml("lycee", `color:${SECTOR_COLORS.private}`)).toContain(`color:${SECTOR_COLORS.private}`);
  });

  it("conserve les couleurs validées et distinctes des niveaux", () => {
    expect(ETABLISSEMENT_ICON_COLORS).toMatchObject({
      prescolaire: "#f59e0b",
      primaire: "#00bfcd",
      college: "#16a34a",
      lycee: "#8b5cf6",
    });
    const colors = ETABLISSEMENT_ICON_ORDER.filter((type) => type !== "village").map((type) => ETABLISSEMENT_ICON_COLORS[type]);
    expect(new Set(colors).size).toBe(colors.length);
    for (const level of ["prescolaire", "primaire", "college", "lycee"] as const) {
      expect(getEtablissementIconHtml(level, ETABLISSEMENT_ICON_COLORS[level])).toContain(
        `color:${ETABLISSEMENT_ICON_COLORS[level]}`,
      );
    }
  });

  it("normalise les libellés français et les codes SIG connus", () => {
    expect(normalizeSchoolLevel("Préscolaire")).toBe("prescolaire");
    expect(normalizeSchoolLevel("presco")).toBe("prescolaire");
    expect(normalizeSchoolLevel("n2")).toBe("college");
    expect(normalizeSchoolLevel("N3")).toBe("lycee");
    expect(normalizeSchoolLevel("inconnu")).toBeNull();
    expect(normalizeSchoolLevel(null)).toBeNull();
  });

  it("génère un SVG stylable pour Leaflet et ignore les niveaux inconnus", () => {
    expect(getSchoolLevelIconHtml("college", "color:red;width:14px")).toContain(
      'style="color:red;width:14px"',
    );
    expect(getSchoolLevelIconHtml("n1", "", "school-marker")).toContain('class="school-marker"');
    expect(getSchoolLevelIconHtml("invalid")).toBeNull();
    expect(getSchoolLevelIconPath("invalid")).toBeNull();
  });
});
