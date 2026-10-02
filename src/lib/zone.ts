export type ZoneKind = "rural" | "urban" | "unknown";

export type ZoneInfo = {
  kind: ZoneKind;
  label: "Rurale" | "Urbaine" | "Non renseignée";
};

const normalize = (value: unknown) =>
  String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

/**
 * Interprète les catégories MEN sans confondre le niveau rural (1 ou 2) avec
 * une zone urbaine. Ainsi `RUR 1`, `RUR 2`, `RURAL-1` et `RURAL-2` restent
 * bien ruraux. Une valeur numérique seule est laissée non renseignée : son
 * sens varie selon les sources et ne doit pas créer une fausse zone urbaine.
 */
export const getZoneInfo = (row: Record<string, unknown> | null | undefined): ZoneInfo => {
  if (!row) return { kind: "unknown", label: "Non renseignée" };

  const candidates = [
    row.CATEGORIE_COMMUNE,
    row.categorie_commune,
    row.MILIEU,
    row.milieu,
    row.TYPE_COMMUNE,
    row.type_commune,
    row.URBAIN_RURAL,
    row.urbain_rural,
    row.ZONE_GEO,
    row.zone_geo,
    row.MILIEU_RESIDENCE,
    row.milieu_residence,
    row.ZONE_SOURCE,
    row.zone_source,
  ];

  for (const candidate of candidates) {
    const value = normalize(candidate);
    if (!value) continue;

    if (
      /^r(?:\b|\s|\d|[-_])/.test(value) ||
      /^rur(?:al|ale)?(?:\b|\s|\d|[-_])/.test(value) ||
      value.includes("campagne")
    ) {
      return { kind: "rural", label: "Rurale" };
    }

    if (
      /^u(?:\b|\s|\d|[-_])/.test(value) ||
      /^urb(?:ain|aine)?(?:\b|\s|\d|[-_])/.test(value) ||
      value.includes("ville")
    ) {
      return { kind: "urban", label: "Urbaine" };
    }
  }

  return { kind: "unknown", label: "Non renseignée" };
};

export const isRuralZone = (row: Record<string, unknown> | null | undefined) =>
  getZoneInfo(row).kind === "rural";
