import { describe, expect, it } from "vitest";
import { choisirEtablissementAttribue, isWithinRecruitmentRadius } from "./nouvelleCreation";
import type { Etablissement } from "@/services/api";

const school = (code: number, effectifs: unknown): Etablissement => ({
  CODE_ETAB: code,
  NOM_ETAB: `Établissement ${code}`,
  CODE_DREN: 1,
  CODE_CISCO: 1,
  latitude: 0,
  longitude: 0,
  effectifs: effectifs as number,
});

const candidate = (code: number, distanceKm: number, effectifs: unknown) => ({
  item: school(code, effectifs),
  lat: 0,
  lng: 0,
  distanceKm,
});

describe("choisirEtablissementAttribue", () => {
  it("retient le candidat le plus proche avant de comparer les effectifs", () => {
    const result = choisirEtablissementAttribue([
      candidate(1, 1.2, 900),
      candidate(2, 1.1, 10),
    ]);
    expect(result?.item.CODE_ETAB).toBe(2);
  });

  it("inclut une distance exactement égale au rayon parmi les candidats", () => {
    const radiusKm = 5;
    expect(isWithinRecruitmentRadius(5, radiusKm)).toBe(true);
    expect(isWithinRecruitmentRadius(4.999, radiusKm)).toBe(true);
    expect(isWithinRecruitmentRadius(5.001, radiusKm)).toBe(false);
    const result = choisirEtablissementAttribue([candidate(1, radiusKm, 20)]);
    expect(result?.item.CODE_ETAB).toBe(1);
  });

  it("départage un ex æquo exact par l'effectif maximal", () => {
    const result = choisirEtablissementAttribue([
      candidate(1, 2, 100),
      candidate(2, 2, 150),
    ]);
    expect(result?.item.CODE_ETAB).toBe(2);
  });

  it("départage un ex æquo d'effectif stablement par le code établissement", () => {
    const result = choisirEtablissementAttribue([
      candidate(20, 2, 100),
      candidate(3, 2, 100),
    ]);
    expect(result?.item.CODE_ETAB).toBe(3);
  });

  it("ne transforme pas un effectif absent ou invalide en effectif artificiel", () => {
    const result = choisirEtablissementAttribue([
      candidate(1, 2, null),
      candidate(2, 2, "invalide"),
    ]);
    expect(result?.item.CODE_ETAB).toBe(1);
  });

  it("renvoie null si aucun établissement n'est admissible", () => {
    expect(choisirEtablissementAttribue([])).toBeNull();
  });
});
