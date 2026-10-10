/**
 * GoulotBars — goulots d'étranglement : une barre horizontale par indicateur,
 * ramenée sur 100 %, sans comparaison. Valeur toujours lisible.
 */
export interface GoulotItem { name: string; value: number }

export function GoulotBars({ items, title = "Analyse des goulots d'étranglement" }: { items: GoulotItem[]; title?: string }) {
  return (
    <div style={{ border: '1px solid #000', padding: 10 }}>
      <h4 style={{ textAlign: 'center', fontSize: 12, fontWeight: 'bold', marginBottom: 10 }}>{title}</h4>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
        <tbody>
          {items.map((it) => {
            const v = Math.max(0, Math.min(100, Number(it.value) || 0));
            return (
              <tr key={it.name}>
                <td style={{ width: '32%', padding: '4px 8px 4px 0', textAlign: 'right', verticalAlign: 'middle', whiteSpace: 'pre-line' }}>{it.name.replace(/\n/g, ' ')}</td>
                <td style={{ padding: '4px 0', verticalAlign: 'middle' }}>
                  <div style={{ position: 'relative', height: 18, background: '#eef2f6', border: '1px solid #ccd' }}>
                    <div style={{ width: `${v}%`, height: '100%', background: '#337ab7' }} />
                    <span style={{ position: 'absolute', top: 1, left: v > 88 ? undefined : `calc(${v}% + 4px)`, right: v > 88 ? 4 : undefined, fontWeight: 'bold', color: v > 88 ? '#fff' : '#111' }}>
                      {v.toFixed(1)} %
                    </span>
                  </div>
                </td>
              </tr>
            );
          })}
          <tr>
            <td />
            <td style={{ fontSize: 9, color: '#555' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>0 %</span><span>50 %</span><span>100 %</span></div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export default GoulotBars;

const r = (n: any, d: any) => { const a = Number(n), b = Number(d); return b > 0 && isFinite(a) ? a / b : 0; };

/** Indicateurs de goulot calculés sur une entité (école/ZAP/CISCO), ramenés sur 100 %. */
export function buildGoulotItems(e: any, examKey: 'cepe' | 'bepc' | 'bac' = 'cepe', lastK = 't5'): GoulotItem[] {
  if (!e) return [];
  const nbr = e.ressources?.nbr_eleve;
  const NORME_REM = 45; // norme : 1 salle / 1 enseignant pour 45 élèves
  const lot = (Number(e.manuels?.malagasy || 0) + Number(e.manuels?.maths || 0) + Number(e.manuels?.francais || 0)) / 3;
  return [
    { name: "Salles de classe (réf. 1 salle / 45 élèves)", value: r(Number(e.sections?.nbr_sdc || 0) * NORME_REM, nbr) * 100 },
    { name: "Enseignants (réf. 1 enseignant / 45 élèves)", value: r(Number(e.personnel?.pers_en_classe || 0) * NORME_REM, nbr) * 100 },
    { name: "Places assises par élève", value: r(e.places?.places_assises, nbr) * 100 },
    { name: "Lots de manuels (Mlg, Maths, Frs) par élève", value: r(lot, nbr) * 100 },
    { name: "Taux de rétention", value: r(e.ressources?.[`eff_${lastK}`], e.ressources?.eff_t1) * 100 },
    { name: `Pourcentage des admis au ${examKey.toUpperCase()}`, value: r(Number(e[examKey]?.admis_g || 0) + Number(e[examKey]?.admis_f || 0), Number(e[examKey]?.nbr_g || 0) + Number(e[examKey]?.nbr_f || 0)) * 100 },
  ];
}

/** % sans diplôme pédagogique, plafonné à 100 % (dénominateur = max(enseignants en classe, sans diplôme)). */
export function pctSansDiplome(p: any): string {
  const s = Number(p?.sans_diplome_ped), t = Number(p?.pers_en_classe);
  if (!isFinite(s) || !(t > 0)) return '-';
  return `${Math.min((s / Math.max(t, s)) * 100, 100).toFixed(1)}%`;
}
