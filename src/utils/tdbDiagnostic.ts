import { bottleneckStatus } from './tdbEfficience';

export interface DiagnosticGoulot { label: string; value: number | null }
export interface DiagnosticInput {
  entityLabel: string;          // ex. « CISCO »
  parentLabel?: string;         // ex. « DREN »
  score: { x: number | null; y: number | null };
  parentScore?: { x: number | null; y: number | null } | null;
  goulots?: DiagnosticGoulot[]; // uniquement là où le TDB affiche des goulots
}
export interface DiagnosticReport {
  quadrant: 'ideal' | 'efficient' | 'inefficient' | 'critical' | null;
  diagnostic: string[];
  recommandations: string[];
  goulots: { critical: DiagnosticGoulot[]; warning: DiagnosticGoulot[]; good: DiagnosticGoulot[]; missing: DiagnosticGoulot[] } | null;
}

const fmt = (n: number) => `${n.toFixed(1)} %`;

/** Seuil de la grille 3×3 : on classe « élevé » au-delà de 50 % sur chaque axe. */
export function buildDiagnostic({ entityLabel, parentLabel, score, parentScore, goulots }: DiagnosticInput): DiagnosticReport {
  const diagnostic: string[] = [];
  const recommandations: string[] = [];
  const la = `votre ${entityLabel}`;
  let quadrant: DiagnosticReport['quadrant'] = null;

  if (score.x === null || score.y === null) {
    diagnostic.push(`Données insuffisantes pour positionner ${la} sur le graphique d’efficience.`);
    recommandations.push('Compléter la saisie des données (effectifs, enseignants, examens) pour permettre l’analyse.');
  } else {
    const hiX = score.x >= 50, hiY = score.y >= 50;
    quadrant = hiX && hiY ? 'ideal' : !hiX && hiY ? 'efficient' : hiX ? 'inefficient' : 'critical';
    diagnostic.push(`Position de ${la} : ressources ${fmt(score.x)}, résultats ${fmt(score.y)}.`);
    const msg = {
      ideal: ['**Ressources et résultats élevés** : situation favorable, les moyens sont bien utilisés.',
        'Maintenir les acquis et partager les bonnes pratiques avec les entités moins performantes.'],
      efficient: ['**Ressources faibles mais résultats élevés** : forte efficience malgré des moyens limités.',
        'Renforcer en priorité les ressources (enseignants, manuels, infrastructures) pour pérenniser ces résultats.'],
      inefficient: ['**Ressources élevées mais résultats faibles** : les moyens ne se transforment pas en résultats.',
        'Analyser la qualité de l’enseignement, l’absentéisme et l’encadrement pédagogique ; renforcer le suivi des élèves.'],
      critical: ['**Ressources et résultats faibles** : situation critique.',
        'Mettre en place un plan d’action prioritaire : allocation de ressources et appui pédagogique rapproché.'],
    }[quadrant];
    diagnostic.push(msg[0]);
    recommandations.push(msg[1]);

    if (parentScore && parentScore.x !== null && parentScore.y !== null && parentLabel) {
      const dx = score.x - parentScore.x, dy = score.y - parentScore.y;
      const cmp = (d: number) => Math.abs(d) < 1 ? 'au même niveau que' : d > 0 ? `au-dessus (+${d.toFixed(1)} pts) de` : `en dessous (${d.toFixed(1)} pts) de`;
      diagnostic.push(`Par rapport à la ${parentLabel} : ressources ${cmp(dx)} la moyenne, résultats ${cmp(dy)} la moyenne.`);
      if (dy < -1) recommandations.push(`Viser au minimum le niveau de résultats de la ${parentLabel} (${fmt(parentScore.y)}).`);
    }
  }

  let goulotReport: DiagnosticReport['goulots'] = null;
  if (goulots && goulots.length) {
    goulotReport = { critical: [], warning: [], good: [], missing: [] };
    for (const g of goulots) goulotReport[bottleneckStatus(g.value)].push(g);
    for (const g of goulotReport.critical) recommandations.push(`Goulot critique — **${g.label}** (${fmt(g.value!)}) : action prioritaire à engager.`);
    for (const g of goulotReport.warning) recommandations.push(`À surveiller — ${g.label} (${fmt(g.value!)}) : renforcer pour dépasser 75 %.`);
    if (goulotReport.missing.length) recommandations.push(`Compléter les données manquantes : ${goulotReport.missing.map(g => g.label).join(', ')}.`);
  }
  return { quadrant, diagnostic, recommandations, goulots: goulotReport };
}
