export function normaliserStatutAnalyse(item: any) {
  const status = String(item?.statut ?? item?.status ?? "").trim().toLowerCase();
  if (["conforme", "ok", "valid", "valide"].includes(status)) return "conforme";
  if (["derog", "derogation", "dérogation"].includes(status)) return "conforme";
  if (["ko", "non_conforme", "non conforme", "nonconforme"].includes(status)) return "non_conforme";
  if (["nv", "non_verifiable", "non vérifiable", "nonverifiable"].includes(status)) return "non_verifiable";
  return "conforme";
}

export default { normaliserStatutAnalyse };
