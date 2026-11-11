export const STATUT = {
  OK: "ok",
  DEROG: "derog",
  KO: "ko",
  NV: "nv",
  INFO: "info",
} as const;

export const CAT = {
  OUVERTURE: "ouverture",
  PEDAGO: "pedago",
  DOSSIER: "dossier",
  ADMIN: "admin",
} as const;

export function buildAnalyseContext(context: Record<string, unknown> = {}) {
  return {
    ...context,
    phase: context.phase ?? "provisoire",
    verdict: context.verdict ?? "validee",
    items: Array.isArray(context.items) ? context.items : [],
  };
}

export function detectPhase(_context: Record<string, unknown> = {}) {
  return "provisoire";
}

export function analyserNormes(context: Record<string, unknown> = {}, _phase?: string) {
  const items = Array.isArray(context.items) ? context.items : [];

  return {
    phase: _phase ?? "provisoire",
    verdict: "validee",
    message: "Analyse non renseignée",
    summary: {
      total: items.length,
      ok: items.length,
      derog: 0,
      ko: 0,
      nv: 0,
    },
    items,
  };
}

export default {
  CAT,
  STATUT,
  buildAnalyseContext,
  detectPhase,
  analyserNormes,
};
