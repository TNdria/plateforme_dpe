/**
 * EfficienceGrid — bloc unique « Efficience ».
 *
 * Fusionne (demande du 2026) l'ancien nuage de points Recharts et la grille 3x3
 * à pictogrammes : on conserve la grille (pictogrammes) et on y intègre les
 * points de comparaison précis qui étaient auparavant affichés dans le nuage.
 * Un seul bloc, compact et lisible.
 */
import MadagascarPin from '@/components/score/MadagascarPin';

export interface EfficiencePoint {
  name: string;
  x: number;
  y: number;
  isCurrent?: boolean;
}

interface Props {
  entity: any;             // cisco / zap / dren / ecole bag
  niveau?: 'primaire' | 'college' | 'lycee';
  entityLabel?: string;    // CEG / CISCO / ZAP / DREN
  /** Points de comparaison précis (entité, entité parente, national…) */
  points?: EfficiencePoint[];
  /** Titre de la liste de comparaison */
  pointsTitle?: string;
}

const norm = (val: number, lo: number, hi: number) => {
  if (!isFinite(val) || val <= 0) return 0;
  if (val <= lo) return 100;
  if (val >= hi) return 0;
  return ((hi - val) / (hi - lo)) * 100;
};

const pctVal = (n: any, d: any) => {
  const a = Number(n), b = Number(d);
  return b > 0 && !isNaN(a) ? (a / b) * 100 : 0;
};

export function EfficienceGrid({ entity, niveau = 'primaire', entityLabel = 'Entité', points = [], pointsTitle = 'Comparaison ressources / résultats' }: Props) {
  if (!entity) return null;
  const examKey = niveau === 'college' ? 'bepc' : niveau === 'lycee' ? 'bac' : 'cepe';
  const lastK = niveau === 'primaire' ? 't5' : niveau === 'college' ? 't4' : 't3';

  const redEns = pctVal(Number(entity.ressources?.red_g || 0) + Number(entity.ressources?.red_f || 0), entity.ressources?.nbr_eleve);
  const retEns = pctVal(entity.ressources?.[`eff_${lastK}`], entity.ressources?.eff_t1);
  const admisEns = pctVal(
    Number(entity?.[examKey]?.admis_g || 0) + Number(entity?.[examKey]?.admis_f || 0),
    Number(entity?.[examKey]?.nbr_g || 0) + Number(entity?.[examKey]?.nbr_f || 0),
  );
  const scoreY = Math.round((((100 - Math.min(redEns, 100)) + retEns + admisEns) / 3) * 10) / 10;

  const rem = norm(Number(entity.ressources?.nbr_eleve || 0) / Math.max(Number(entity.personnel?.pers_en_classe || 1), 1), 45, 60);
  const etabEau = Number(entity.ressources?.etab_eau || 0);
  const etabElec = Number(entity.ressources?.etab_elec || 0);
  const nbrEtab = Math.max(Number(entity.ressources?.nbr_etab || 1), 1);
  // Pour CISCO/ZAP/DREN c'est un % d'écoles avec eau/élec ; pour École c'est 0/1
  const eau = etabEau > 1 ? (etabEau / nbrEtab) * 100 : etabEau * 100;
  const elec = etabElec > 1 ? (etabElec / nbrEtab) * 100 : etabElec * 100;
  const scoreX = Math.round((((rem + Math.min(eau, 100) + Math.min(elec, 100)) / 3)) * 10) / 10;

  const binX = scoreX >= 66 ? 2 : scoreX >= 33 ? 1 : 0;
  const binY = scoreY >= 66 ? 2 : scoreY >= 33 ? 1 : 0;
  const row = 2 - binY;
  const col = binX;
  const FACES = [
    ['😊', '😊', '😊'],
    ['😐', '😐', '😐'],
    ['☹️', '☹️', '😢'],
  ];

  const niveauX = binX === 2 ? 'élevées' : binX === 1 ? 'moyennes' : 'faibles';
  const niveauY = binY === 2 ? 'bons' : binY === 1 ? 'moyens' : 'faibles';
  const reco = binY < binX
    ? `Ressources ${niveauX} mais résultats ${niveauY} : accompagnement pédagogique recommandé.`
    : binY > binX
      ? `Avec des ressources ${niveauX}, les résultats sont ${niveauY} : performance à pérenniser.`
      : `Ressources (${niveauX}) et résultats (${niveauY}) alignés. Cibler ${binX < 2 ? 'le renforcement des ressources' : 'la qualité pédagogique'}.`;

  // Point de référence = l'entité courante (sinon les scores calculés ci-dessus)
  const current = points.find((p) => p.isCurrent);
  const refX = current ? Number(current.x) : scoreX;
  const refY = current ? Number(current.y) : scoreY;

  const arrow = (v: number, ref: number) => {
    const d = Math.round((v - ref) * 10) / 10;
    if (Math.abs(d) < 0.5) return { txt: '=', color: '#666' };
    return d > 0 ? { txt: `↑ +${d}`, color: '#c62828' } : { txt: `↓ ${d}`, color: '#2e7d32' };
  };

  return (
    <div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <tbody>
          {[0, 1, 2].map((r) => (
            <tr key={r}>
              {[0, 1, 2].map((c) => {
                const active = r === row && c === col;
                return (
                  <td key={c} style={{
                    border: '1px solid #888', width: '33.33%', height: 62,
                    textAlign: 'center', fontSize: 34, position: 'relative',
                    background: active ? '#fff8b0' : '#fff',
                  }}>
                    <span style={{ opacity: active ? 1 : 0.35 }}>{FACES[r][c]}</span>
                    {active && (
                      <>
                        <span style={{ position: 'absolute', top: 4, right: 6, fontSize: 9, fontWeight: 'bold', color: '#2e7d32' }}>{entityLabel}</span>
                        <span style={{ position: 'absolute', right: 4, bottom: 2, lineHeight: 0 }}>
                          <MadagascarPin size={22} title="Situation actuelle" />
                        </span>
                      </>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <table style={{ width: '100%', fontSize: 9, marginTop: 2 }}>
        <tbody>
          <tr>
            <td style={{ textAlign: 'left' }}>← Ressources faibles</td>
            <td style={{ textAlign: 'center' }}>Ressources moyennes</td>
            <td style={{ textAlign: 'right' }}>Ressources élevées →</td>
          </tr>
        </tbody>
      </table>

      {/* Points de comparaison précis (repris de l'ancien nuage de points) */}
      {points.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 6, fontSize: 9 }}>
          <thead>
            <tr style={{ background: '#eef2f6' }}>
              <th style={{ border: '1px solid #bbb', padding: '2px 4px', textAlign: 'left' }} colSpan={2}>{pointsTitle}</th>
              <th style={{ border: '1px solid #bbb', padding: '2px 4px', textAlign: 'right' }}>Ressources (X)</th>
              <th style={{ border: '1px solid #bbb', padding: '2px 4px', textAlign: 'right' }}>Résultats (Y)</th>
              <th style={{ border: '1px solid #bbb', padding: '2px 4px', textAlign: 'right' }}>Écart Y</th>
            </tr>
          </thead>
          <tbody>
            {points.map((p, i) => {
              const a = arrow(Number(p.y), refY);
              return (
                <tr key={`${p.name}-${i}`} style={{ background: p.isCurrent ? '#fff8b0' : '#fff', fontWeight: p.isCurrent ? 'bold' : 'normal' }}>
                  <td style={{ border: '1px solid #ddd', padding: '2px 4px', width: 16, textAlign: 'center' }}>
                    {p.isCurrent ? <MadagascarPin size={12} title={p.name} /> : '•'}
                  </td>
                  <td style={{ border: '1px solid #ddd', padding: '2px 4px' }}>{p.name}</td>
                  <td style={{ border: '1px solid #ddd', padding: '2px 4px', textAlign: 'right' }}>{Number(p.x).toFixed(1)}</td>
                  <td style={{ border: '1px solid #ddd', padding: '2px 4px', textAlign: 'right' }}>{Number(p.y).toFixed(1)}</td>
                  <td style={{ border: '1px solid #ddd', padding: '2px 4px', textAlign: 'right', color: p.isCurrent ? '#333' : a.color }}>
                    {p.isCurrent ? '—' : a.txt}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      <div style={{ marginTop: 6, fontSize: 10, border: '1px solid #888', padding: 6, background: '#fff', lineHeight: 1.45 }}>
        <div>Ressources <i>{niveauX}</i> · Résultats <i>{niveauY}</i> (X={refX.toFixed(1)} / Y={refY.toFixed(1)})</div>
        <div style={{ marginTop: 4 }}>{reco}</div>
      </div>

    </div>
  );
}

export default EfficienceGrid;
