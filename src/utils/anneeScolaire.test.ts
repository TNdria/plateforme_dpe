import { describe, expect, it } from "vitest";
import {
  DEFAULT_SCHOOL_YEAR,
  FIRST_SCHOOL_YEAR,
  LATEST_SCHOOL_YEAR,
  SCHOOL_YEARS,
  formatAnneeScolaire,
  parseSchoolYear,
} from "./anneeScolaire";

describe("parseSchoolYear", () => {
  it("accepte un millésime numérique ou sa forme chaîne", () => {
    expect(parseSchoolYear(2024)).toBe(2024);
    expect(parseSchoolYear("2024")).toBe(2024);
    expect(parseSchoolYear(` ${FIRST_SCHOOL_YEAR} `)).toBe(FIRST_SCHOOL_YEAR);
  });

  it("refuse l'événement React transmis par `onClick={handleFilter}`", () => {
    const clickEvent = { type: "click", target: null };
    expect(parseSchoolYear(clickEvent)).toBeNull();
  });

  it("refuse les valeurs vides ou non entières", () => {
    expect(parseSchoolYear(undefined)).toBeNull();
    expect(parseSchoolYear(null)).toBeNull();
    expect(parseSchoolYear("")).toBeNull();
    expect(parseSchoolYear("2024-2025")).toBeNull();
    expect(parseSchoolYear(2024.5)).toBeNull();
    expect(parseSchoolYear(Number.NaN)).toBeNull();
    expect(parseSchoolYear(true)).toBeNull();
  });
});

describe("années scolaires", () => {
  it("couvre les millésimes servis par l'application", () => {
    expect(SCHOOL_YEARS[0]).toBe(FIRST_SCHOOL_YEAR);
    expect(SCHOOL_YEARS[SCHOOL_YEARS.length - 1]).toBe(LATEST_SCHOOL_YEAR);
    expect(DEFAULT_SCHOOL_YEAR).toBe(LATEST_SCHOOL_YEAR);
    expect(SCHOOL_YEARS.every((annee) => parseSchoolYear(String(annee)) === annee)).toBe(true);
  });

  it("formate le libellé de l'année scolaire", () => {
    expect(formatAnneeScolaire(2024)).toBe("2023-2024");
    expect(formatAnneeScolaire("2026")).toBe("2025-2026");
  });
});
