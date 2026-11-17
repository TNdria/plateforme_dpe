import { describe, expect, it } from "vitest";
import { buildSigUniqueEstablishmentStats, countUniqueEstablishments } from "./sigUniqueCounts";

describe("SIG unique establishment counts", () => {
  it("counts the 2025 witness once while preserving its eight detail rows", () => {
    const witnessRows = Array.from({ length: 8 }, (_, index) => ({
      CODE_ETAB: index % 2 === 0 ? 312130017 : "312130017",
      ANNEE_SCOLAIRE: 2025,
      SECTEUR: 0,
      CONFIGURATION: index,
    }));

    expect(witnessRows).toHaveLength(8);
    expect(countUniqueEstablishments(witnessRows)).toBe(1);
    expect(new Set(witnessRows.map((row) => row.CONFIGURATION)).size).toBe(8);
  });

  it("counts a code once overall and once within each applicable level/sector", () => {
    const stats = buildSigUniqueEstablishmentStats(
      {
        n0: [
          { CODE_ETAB: 312130017, SECTEUR: 0 },
          { CODE_ETAB: "312130017", SECTEUR: 0 },
        ],
        n1: [
          { CODE_ETAB: "312130017", SECTEUR: 0 },
          { CODE_ETAB: 312130018, SECTEUR: 0 },
        ],
        n2: [],
        n3: [],
      },
      3,
    );

    expect(stats.etablissements).toBe(2);
    expect(stats.total).toBe(5);
    expect(stats.public).toEqual({ total: 2, prescolaire: 1, primaire: 2, college: 0, lycee: 0 });
    expect(stats.private.total).toBe(0);
    expect(stats.villages).toBe(3);
  });
});
