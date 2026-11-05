import DisparityIcon from '@/components/score/DisparityIcon';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ScatterChart, Scatter, ReferenceLine, LabelList } from 'recharts';
import {
  NIVEAU_LABELS, NiveauDren, Secteur, val, div, effectif, tauxRedoublement, tauxPromotion, tauxAbandon,
  cycleRate, retentionProfile, parite, disparite, ciscoEfficience,
} from '@/utils/tdbDrenNiveaux';

const nf = (v: number | null | undefined, digits = 0, suffix = '') =>
  v === null || v === undefined || !Number.isFinite(v) ? '—' : `${new Intl.NumberFormat('fr-FR', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(v)}${suffix}`;
const pc = (v: number | null) => nf(v, 1, ' %');

const st = {
  titre: { letterSpacing: '0.2em', textTransform: 'uppercase' as const, background: '#337ab7', color: '#fff', padding: '6px 10px', margin: '8px 0', fontWeight: 'bold', fontSize: '12px' },
  td: { padding: '3px 5px', fontSize: '11px', border: '1px solid #333' },
  th: { padding: '3px', fontSize: '11px', border: '1px solid #333', background: '#bbbbcc', textAlign: 'center' as const, fontWeight: 'bold' as const },
};
const Cell = ({ v, left }: { v: string; left?: boolean }) => (
  <td style={{ ...st.td, textAlign: left ? 'left' : 'right', ...(v === '—' ? { background: '#7CB5EC' } : {}) }}>{v}</td>
);
const Table = ({ head, rows }: { head: string[]; rows: (string | JSX.Element)[][] }) => (
  <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 8 }}>
    <thead><tr>{head.map((h, i) => <th key={i} style={st.th}>{h}</th>)}</tr></thead>
    <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => typeof c === 'string' ? <Cell key={j} v={c} left={j === 0} /> : <td key={j} style={{ ...st.td, textAlign: 'center' }}>{c}</td>)}</tr>)}</tbody>
  </table>
);

export function DrenNiveauTdb({ data, codeDren }: { data: any; codeDren: string }) {
  const niv = data.niveau as NiveauDren;
  const L = NIVEAU_LABELS[niv];
  const g = data.grades as number;
  const D = data.dren, M = data.mada, Dn = data.dren_next, Mn = data.mada_next;
  const pd = data.pop_dren || {}, pm = data.pop_mada || {};
  const S: Secteur[] = ['0', '1', 'ens'];
  const v = (k: string, s: Secteur, src = D) => val(src, k, s);
  const eff = (s: Secteur, src = D) => effectif(src, s, g);
  const effF = (s: Secteur, src = D) => effectif(src, s, g, 'f');
  const popTotal = (p: any) => (p[`p${g}`] ?? null) as number | null;
  const popFirst = (p: any) => (niv === 'presco' ? p.p2 : p.p0) ?? null;
  const popLast = (p: any) => (p[`p${g - 1}`] ?? null) as number | null;
  const anneeDisplay = `${data.annee - 1} - ${data.annee}`;

  // --- Couverture
  const entrants = (src: any, k: number) => {
    const e = effectif(src, 'ens', g, undefined, k), r = val(src, `red${k}_g`, 'ens'), r2 = val(src, `red${k}_f`, 'ens');
    return e === null || r === null || r2 === null ? null : e - r - r2;
  };
  const couverture: [string, number | null, number | null, string][] = niv === 'presco' ? [
    ['Taux d’inscription 5 ans (GS / population de 5 ans)', div(effectif(D, 'ens', g, undefined, 3), pd.p2), div(effectif(M, 'ens', g, undefined, 3), pm.p2), ' %'],
    ['Taux de préscolarisation de 3 à 5 ans', div(eff('ens'), pd.p3), div(eff('ens', M), pm.p3), ' %'],
    ['Taux de préscolarisation privé (part du privé)', div(eff('1'), eff('ens')), div(eff('1', M), eff('ens', M)), ' %'],
    ['Parité filles / garçons', parite(effF('ens'), effectif(D, 'ens', g, 'g')), parite(effF('ens', M), effectif(M, 'ens', g, 'g')), ''],
  ] : [
    [`TBA en ${L.grades[0]} (%)`, div(entrants(D, 1), popFirst(pd)), div(entrants(M, 1), popFirst(pm)), ' %'],
    ['TBS (%)', div(eff('ens'), popTotal(pd)), div(eff('ens', M), popTotal(pm)), ' %'],
    ['Taux d’achèvement', div(entrants(D, g), popLast(pd)), div(entrants(M, g), popLast(pm)), ' %'],
    ['Parité filles / garçons', parite(effF('ens'), effectif(D, 'ens', g, 'g')), parite(effF('ens', M), effectif(M, 'ens', g, 'g')), ''],
  ];
  const profil = retentionProfile(D, '0', g).map((x, i) => ({ niveau: L.grades[i], DREN: x, MADA: retentionProfile(M, '0', g)[i] }));

  // --- Flux
  const fluxTable = (kind: 'red' | 'promo' | 'aband') => {
    const rate = (src: any, nx: any, s: Secteur, k?: number, gender?: 'g' | 'f') =>
      kind === 'red' ? tauxRedoublement(src, s, g, k, gender)
        : k ? (kind === 'promo' ? tauxPromotion(src, nx, s, k, gender) : tauxAbandon(src, nx, s, k, gender))
          : cycleRate(src, nx, s, g, kind === 'promo' ? 'promotion' : 'abandon', gender);
    const levels = kind === 'red' ? L.grades : L.grades.slice(0, -1);
    const line = (label: string, k?: number, gender?: 'g' | 'f') => [label, ...S.map((s) => pc(rate(D, Dn, s, k, gender))), pc(rate(M, Mn, 'ens', k, gender))];
    const rows: (string | JSX.Element)[][] = [...levels.map((l, i) => line(l, i + 1)), line('Ensemble'), line('Garçons', undefined, 'g'), line('Filles', undefined, 'f')];
    const side = disparite(rate(D, Dn, 'ens', undefined, 'f'), rate(D, Dn, 'ens', undefined, 'g'), kind === 'promo');
    rows.push(['Disparité aux dépens des', <span key="d" style={{ display: 'inline-block' }}>{side ? <DisparityIcon kind={side === 'F' ? 'f' : 'g'} /> : '—'}</span>, '', '', '']);
    return <Table head={['Niveau', 'Public', 'Privé', 'Ensemble', 'MADA']} rows={rows} />;
  };

  // --- Ressources
  const rr = (label: string, f: (s: Secteur, src: any) => number | null, digits = 1, suffix = '') =>
    [label, ...S.map((s) => nf(f(s, D), digits, suffix)), nf(f('ens', M), digits, suffix)];
  const ressources = [
    rr(niv === 'presco' ? 'Enfants par éducateur en classe' : 'Élèves par enseignant en classe', (s, x) => div(effectif(x, s, g), val(x, 'ens_classe', s), 1), 0),
    rr(niv === 'presco' ? 'Éducateurs attestés / diplôme pédagogique' : 'Enseignants ayant un diplôme pédagogique', (s, x) => div(val(x, 'qualifies', s), val(x, 'ens', s)), 1, ' %'),
    rr('Élèves par section', (s, x) => div(effectif(x, s, g), val(x, 'sections', s), 1), 0),
    rr('Élèves par salle', (s, x) => div(effectif(x, s, g), val(x, 'salles', s), 1), 0),
    rr('Rapport section par salle', (s, x) => div(val(x, 'sections', s), val(x, 'salles', s), 1)),
    rr('Élèves par place assise', (s, x) => div(effectif(x, s, g), val(x, 'places', s), 1)),
    rr('Élèves par latrine', (s, x) => div(effectif(x, s, g), val(x, 'latrines', s), 1), 0),
    rr('Filles par latrine pour filles', (s, x) => div(effectif(x, s, g, 'f'), val(x, 'latrines_f', s), 1), 0),
    rr('Établissements avec latrine pour filles', (s, x) => div(val(x, 'etab_latrine_f', s), val(x, 'etab', s)), 1, ' %'),
    rr('Établissements avec électricité', (s, x) => div(val(x, 'elec', s), val(x, 'etab', s)), 1, ' %'),
    rr('Établissements avec point d’eau', (s, x) => div(val(x, 'eau', s), val(x, 'etab', s)), 1, ' %'),
    ...(niv === 'presco' ? [rr('EPP ayant des CAP', (s, x) => div(val(x, 'avec_primaire', s), val(x, 'etab', s)), 1, ' %')] : []),
    ...(niv === 'college' ? [rr('Élèves vivant à moins de 5 km', (s, x) => div(val(x, 'eleve_proche', s), effectif(x, s, g)), 1, ' %')] : []),
  ];

  // --- Goulots (public)
  const goulots = [
    ...(niv === 'presco' ? [{ ind: 'EPP ayant des CAP', d: div(v('avec_primaire', '0'), v('etab', '0')), m: div(v('avec_primaire', '0', M), v('etab', '0', M)) }] : []),
    { ind: couverture[0][0].split(' (')[0], d: couverture[0][1], m: couverture[0][2] },
    { ind: niv === 'presco' ? 'Éducateurs attestés' : 'Enseignants qualifiés', d: div(v('qualifies', '0'), v('ens', '0')), m: div(v('qualifies', '0', M), v('ens', '0', M)) },
    ...(niv !== 'presco' ? [{ ind: 'Taux de rétention', d: profil[g - 1]?.DREN ?? null, m: profil[g - 1]?.MADA ?? null }] : []),
    ...(niv === 'college' ? [{ ind: 'Élèves à moins de 5 km', d: div(v('eleve_proche', '0'), effectif(D, '0', g)), m: div(v('eleve_proche', '0', M), effectif(M, '0', g)) }] : []),
    { ind: 'Établissements avec électricité', d: div(v('elec', '0'), v('etab', '0')), m: div(v('elec', '0', M), v('etab', '0', M)) },
    { ind: 'Établissements avec point d’eau', d: div(v('eau', '0'), v('etab', '0')), m: div(v('eau', '0', M), v('etab', '0', M)) },
  ].map((x) => ({ ind: x.ind, DREN: x.d === null ? null : Math.min(100, x.d), MADA: x.m === null ? null : Math.min(100, x.m) }));
  const faibles = goulots.filter((x) => x.DREN !== null && x.MADA !== null && x.DREN < x.MADA);
  const eff2 = ciscoEfficience(data.ciscos || []);

  // --- Examen
  const ex = (o: any, k: string) => (o && o[k] !== undefined && o[k] !== null ? Number(o[k]) : null);
  const bd = data.bepc_dren || {}, bm = data.bepc_mada || {};
  const matieres: [string, string][] = [['Malagasy', 'mlg'], ['Français', 'frs'], ['Anglais', 'ang'], ['Mathématiques', 'math'], ['Physique-Chimie', 'phys'], ['SVT', 'svt'], ['Histoire-Géo', 'hg']];

  return (
    <div style={{ width: '100%', maxWidth: 1191, margin: '0 auto', font: '12px verdana', background: '#fff', padding: 10 }}>
      <div style={{ border: '2px solid #000', padding: 15 }}>
        <div style={{ textAlign: 'center' }}>
          <b style={{ fontSize: 14 }}>Ministère de l'Éducation Nationale</b><br />
          <b style={{ fontSize: 13 }}>TABLEAU DE BORD {L.titre} DE LA DREN : {anneeDisplay}</b><br />
          <span>DREN : <b>{data.names?.DREN}</b> &nbsp; Code : <b>{codeDren}</b></span>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginTop: 6, fontSize: 11 }}>
            <span style={{ background: '#7CB5EC', padding: '2px 8px' }}>Données non disponibles</span>
            <span style={{ background: '#ffff00', padding: '2px 8px' }}>Données à vérifier</span>
            <span style={{ background: 'rgba(255,0,0,.75)', color: '#fff', padding: '2px 8px' }}>Attention</span>
          </div>
        </div>

        <div style={st.titre}>Données générales</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          <Table head={['', 'Valeur']} rows={[['Nombre de CISCO', nf(data.nb_cisco)], ['Nombre de ZAP', nf(data.nb_zap)]]} />
          <Table head={['', 'Ensemble', 'Public']} rows={[
            [`Nombre de ${L.etab} fonctionnels`, nf(v('etab', 'ens')), nf(v('etab', '0'))],
            ['Nombre de salles', nf(v('salles', 'ens')), nf(v('salles', '0'))],
            ['Nombre de sections', nf(v('sections', 'ens')), nf(v('sections', '0'))],
            ['Nombre de places assises', nf(v('places', 'ens')), nf(v('places', '0'))],
            [niv === 'presco' ? 'Effectif des enfants' : 'Effectif des élèves', nf(eff('ens')), nf(eff('0'))],
            ['Dont filles', nf(effF('ens')), nf(effF('0'))],
          ]} />
          <Table head={['', 'Ensemble', 'Public']} rows={[
            [niv === 'presco' ? 'Éducateurs en classe' : 'Enseignants en classe', nf(v('ens_classe', 'ens')), nf(v('ens_classe', '0'))],
            ['dont Fonctionnaires', nf(v('fonct', 'ens')), nf(v('fonct', '0'))],
            ['dont FRAM subventionnés', nf(v('fram_sub', 'ens')), nf(v('fram_sub', '0'))],
            ['dont FRAM non subventionnés', nf(v('fram_non_sub', 'ens')), nf(v('fram_non_sub', '0'))],
            ['Non en classe', nf((v('ens', 'ens') ?? NaN) - (v('ens_classe', 'ens') ?? NaN)), nf((v('ens', '0') ?? NaN) - (v('ens_classe', '0') ?? NaN))],
          ]} />
        </div>

        <div style={st.titre}>Résultats scolaires</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Table head={['Couverture', 'Votre DREN', 'MADA']} rows={couverture.map(([l, a, b, u]) => [l, nf(a, u ? 1 : 2, u), nf(b, u ? 1 : 2, u)])} />
          {niv !== 'presco' && (
            <div style={{ height: 200 }}>
              <b style={{ fontSize: 11 }}>Profil de rétention (pseudo-longitudinal, public)</b>
              <ResponsiveContainer width="100%" height="90%">
                <BarChart data={profil}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="niveau" tick={{ fontSize: 10 }} /><YAxis domain={[0, 100]} tick={{ fontSize: 10 }} /><Tooltip /><Legend />
                  <Bar dataKey="DREN" name="Profil régional" fill="#337ab7"><LabelList dataKey="DREN" position="top" formatter={(x: number) => nf(x, 1)} fontSize={9} /></Bar>
                  <Bar dataKey="MADA" name="Profil national" fill="#e74c3c" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {niv === 'college' && (
          <>
            <b style={{ fontSize: 11 }}>RÉSULTAT AU BEPC (public)</b>
            <Table head={['Matières', 'SM DREN', '% ≥10 DREN', 'SM MADA', '% ≥10 MADA']} rows={[
              ...matieres.map(([l, k]) => [l, nf(ex(bd, `sm_${k}`), 1), pc(div(ex(bd, `${k}_sup10`), ex(bd, 'total_candidats'))), nf(ex(bm, `sm_${k}`), 1), pc(div(ex(bm, `${k}_sup10`), ex(bm, 'total_candidats')))]),
              ['Pourcentage des admis au BEPC', '', pc(ex(bd, 'tx_admis')), '', pc(ex(bm, 'tx_admis'))],
              ['dont Garçons', '', pc(ex(bd, 'tx_admis_g')), '', pc(ex(bm, 'tx_admis_g'))],
              ['dont Filles', '', pc(ex(bd, 'tx_admis_f')), '', pc(ex(bm, 'tx_admis_f'))],
            ]} />
          </>
        )}
        {niv === 'lycee' && (
          <Table head={['BACC (séries A, C, D)', 'Votre DREN', 'MADA']} rows={[['Pourcentage des admis au BACC', '—', '—']]} />
        )}

        {niv !== 'presco' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <div><b style={{ fontSize: 11 }}>Pourcentage de redoublants</b>{fluxTable('red')}</div>
            <div><b style={{ fontSize: 11 }}>Taux de promotion</b>{fluxTable('promo')}</div>
            <div><b style={{ fontSize: 11 }}>Taux d'abandon</b>{fluxTable('aband')}</div>
          </div>
        )}

        <div style={st.titre}>Ressources</div>
        <Table head={['Autres ressources', 'Public', 'Privé', 'Ensemble', 'MADA']} rows={ressources} />

        <div style={st.titre}>Goulots d'étranglement (public)</div>
        <div style={{ height: 60 + goulots.length * 34 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart layout="vertical" data={goulots} margin={{ left: 20, right: 30 }}>
              <CartesianGrid strokeDasharray="3 3" /><XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} />
              <YAxis type="category" dataKey="ind" width={260} tick={{ fontSize: 10 }} /><Tooltip formatter={(x: number) => nf(x, 1, ' %')} /><Legend />
              <Bar dataKey="DREN" fill="#337ab7"><LabelList dataKey="DREN" position="right" formatter={(x: number) => nf(x, 1)} fontSize={9} /></Bar>
              <Bar dataKey="MADA" fill="#e74c3c" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {niv !== 'presco' && (
          <>
            <div style={st.titre}>Efficience (public)</div>
            <div style={{ display: 'grid', gridTemplateColumns: '55% 45%', gap: 10 }}>
              <div style={{ height: 300 }}>
                {eff2.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 0 }}>
                      <CartesianGrid /><XAxis type="number" dataKey="ressources" name="Ressources" domain={[0, 100]} label={{ value: 'Ressources', position: 'bottom', fontSize: 10 }} tick={{ fontSize: 10 }} />
                      <YAxis type="number" dataKey="resultats" name="Résultats" domain={[0, 100]} label={{ value: 'Résultats', angle: -90, position: 'insideLeft', fontSize: 10 }} tick={{ fontSize: 10 }} />
                      <ReferenceLine x={50} stroke="#999" /><ReferenceLine y={50} stroke="#999" /><Tooltip />
                      <Scatter data={eff2} fill="#337ab7"><LabelList dataKey="name" position="top" fontSize={9} /></Scatter>
                    </ScatterChart>
                  </ResponsiveContainer>
                ) : <div style={{ background: '#7CB5EC', padding: 10 }}>Données des CISCO non disponibles</div>}
              </div>
              <div style={{ border: '1px solid #333', padding: 8, fontSize: 11 }}>
                <b>Remarque(s) et diagnostic(s)</b>
                {faibles.length ? <ul style={{ paddingLeft: 16 }}>{faibles.map((f) => <li key={f.ind}>{f.ind} : {nf(f.DREN, 1)} % contre {nf(f.MADA, 1)} % au niveau national</li>)}</ul>
                  : <p>Les indicateurs disponibles de votre DREN sont au niveau ou au-dessus de la moyenne nationale.</p>}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
