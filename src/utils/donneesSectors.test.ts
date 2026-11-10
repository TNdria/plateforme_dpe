import { describe, expect, it } from "vitest";
import { buildSectorGroups, getTotalEleves } from "./donneesSectors";

const rows = [
  // Public : 10 fonctionnaires + 4 FRAM sub + 6 FRAM non sub = 20 personnels
  { SECTEUR: "0", pers_total: "20", fonctionnaire: "10", fram_sub: "4", fram_nonsub: "6", eff_t1: 30, eff_t2: 25 },
  // Privé : aucun fonctionnaire, 12 FRAM sub + 8 FRAM non sub = 20 personnels
  { SECTEUR: "1", pers_total: "20", fonctionnaire: "0", fram_sub: "12", fram_nonsub: "8", eff_t1: 40, eff_t2: 10 },
  // Public avec valeurs vides : ne doivent jamais casser les cumuls
  { SECTEUR: "0", pers_total: "", fonctionnaire: "", fram_sub: "", fram_nonsub: "", eff_t1: "5", eff_t2: null },
];

describe("buildSectorGroups", () => {
  const [pub, priv, total] = buildSectorGroups(rows, "primaire");

  it("compte les subventionnés et les non subventionnés par secteur", () => {
    expect(pub.sub).toBe(4);
    expect(pub.nonSub).toBe(6);
    expect(priv.sub).toBe(12);
    expect(priv.nonSub).toBe(8);
    expect(total.sub).toBe(16);
    expect(total.nonSub).toBe(14);
  });

  it("sépare fonctionnaires et ENF, le privé n'ayant aucun fonctionnaire", () => {
    expect(pub.fonct).toBe(10);
    expect(pub.enf).toBe(10);
    expect(priv.fonct).toBe(0);
    expect(priv.enf).toBe(20);
    expect(total.fonct).toBe(10);
    expect(total.enf).toBe(30);
  });

  it("cumule établissements, élèves et personnels sans perdre les lignes vides", () => {
    expect(pub.etabs).toBe(2);
    expect(priv.etabs).toBe(1);
    expect(total.etabs).toBe(3);
    expect(pub.eleves).toBe(60);
    expect(total.eleves).toBe(110);
    expect(total.pers).toBe(40);
  });

  it("ignore les secteurs inconnus du public et du privé mais les garde au total", () => {
    const groups = buildSectorGroups([...rows, { SECTEUR: "2", pers_total: 3, eff_t1: 7 }], "primaire");
    expect(groups[0].pers).toBe(20);
    expect(groups[1].pers).toBe(20);
    expect(groups[2].pers).toBe(43);
    expect(groups[2].eleves).toBe(117);
  });

  it("borne les effectifs au niveau demandé", () => {
    expect(getTotalEleves([{ eff_t6: 3, eff_t1: 99 }], "college")).toBe(3);
    expect(getTotalEleves([{ _2nde: 2, _1re: 3, tle: 4 }], "lycee")).toBe(9);
    expect(getTotalEleves([{ eff_ps: 1, eff_ms: 2, eff_gs: 3 }], "prescolaire")).toBe(6);
  });
});
