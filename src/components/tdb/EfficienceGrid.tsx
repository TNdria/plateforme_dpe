/**
 * EfficienceGrid — reproduit la grille 3x3 (faces + moto) du TDB École
 * et l'utilise pour CISCO / ZAP / DREN. Calcule scoreX (ressources) et
 * scoreY (résultats), bin en 3 niveaux, place la moto dans la cellule.
 */
interface Props {
  entity: any;             // cisco / zap / dren / ecole bag
  niveau?: 'primaire' | 'college' | 'lycee';
  entityLabel?: string;    // CEG / CISCO / ZAP / DREN
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

export function EfficienceGrid({ entity, niveau = 'primaire', entityLabel = 'Entité' }: Props) {
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
                    border: '1px solid #888', width: '33.33%', height: 70,
                    textAlign: 'center', fontSize: 38, position: 'relative',
                    background: active ? '#fff8b0' : '#fff',
                  }}>
                    <span style={{ opacity: active ? 1 : 0.35 }}>{FACES[r][c]}</span>
                    {active && (
                      <>
                        <span style={{ position: 'absolute', top: 4, right: 6, fontSize: 9, fontWeight: 'bold', color: '#2e7d32' }}>{entityLabel}</span>
                        <span style={{ position: 'absolute', right: 4, bottom: 2, fontSize: 22 }} title="Position actuelle">🏍️</span>
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
      <div style={{ marginTop: 8, fontSize: 10, border: '1px solid #888', padding: 6, background: '#fff', lineHeight: 1.45 }}>
        <div><b>Position :</b> Ressources <i>{niveauX}</i> · Résultats <i>{niveauY}</i> (X={scoreX.toFixed(1)} / Y={scoreY.toFixed(1)})</div>
        <div style={{ marginTop: 4 }}>{reco}</div>
      </div>
    </div>
  );
}

export default EfficienceGrid;
