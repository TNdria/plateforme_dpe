export function sumFields(row: any, fields: string[]) {
  return fields.reduce((acc, key) => {
    const val = Number(row?.[key] ?? 0);
    return acc + (isNaN(val) ? 0 : val);
  }, 0);
}

export const BE_FIELDS = [
  "presco_1pl_be",
  "presco_2pl_be",
  "presco_3pl_be",
  "presco_4pl_be",
  "presco_5pl_be",
  "prim_1pl_be",
  "prim_2pl_be",
  "prim_3pl_be",
  "prim_4pl_be",
  "prim_5pl_be",
  "coll_1pl_be",
  "coll_2pl_be",
  "coll_3pl_be",
  "coll_4pl_be",
  "coll_5pl_be",
  "lyc_1pl_be",
  "lyc_2pl_be",
  "lyc_3pl_be",
  "lyc_4pl_be",
  "lyc_5pl_be",
];

export const ME_FIELDS = BE_FIELDS.map(f => f.replace("_be", "_me"));