/**
 * IndicateursDetailles — affiche les résultats du module etabIndicators.ts
 * (port fidèle de docs/python-reference/etab.py).
 *
 * Visible dans le rapport TDB École avant le DiagnosticPanel.
 * Tables source attendues sous tdbData.raw : tdb_v_e1 (n-1 et n), v_sm_cepe.
 */
import type {
  AbandonResult,
  RetentionResult,
  RedoublementResult,
  CepeResult,
} from '@/utils/etabIndicators';

const titre: React.CSSProperties = {
  letterSpacing: '0.15em',
  textTransform: 'uppercase',
  width: '100%',
  background: '#1b5e20',
  color: '#fff',
  padding: '5px 10px',
  marginTop: 8,
  marginBottom: 4,
  fontWeight: 'bold',
  fontSize: 11,
  textAlign: 'center',
};

const th: React.CSSProperties = {
  border: '1px solid #555',
  padding: '3px 5px',
  fontSize: 10,
  background: '#bbbbcc',
  textAlign: 'center',
  fontWeight: 'bold',
};
const td: React.CSSProperties = {
  border: '1px solid #555',
  padding: '3px 5px',
  fontSize: 10,
  textAlign: 'right',
};
const tdL: React.CSSProperties = { ...td, textAlign: 'left', fontWeight: 'bold' as const };

const fmt = (v: number, suffix = '%') => (v < 0 ? '-' : `${v.toFixed(1)}${suffix}`);
const colorFor = (v: number, good: number, bad: number) =>
  v < 0 ? '#fff' : v <= good ? '#c8e6c9' : v >= bad ? '#ffcdd2' : '#fff9c4';

interface Props {
  abandon: AbandonResult;
  retention: RetentionResult;
  redoublement: RedoublementResult;
  cepe: CepeResult;
}

export function IndicateursDetailles({ abandon, retention, redoublement, cepe }: Props) {
  const niveaux = ['CP1', 'CP2', 'CE', 'CM1', 'CM2'];

  return (
    <div>
      <div style={titre}>INDICATEURS DÉTAILLÉS (PORT etab.py)</div>

      <table style={{ width: '100%', borderCollapse: 'collapse' }} cellSpacing={0}>
        <tbody>
          <tr>
            {/* === Abandon par transition === */}
            <td style={{ width: '25%', verticalAlign: 'top', padding: 2 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr><th style={th} colSpan={2}>Taux d'abandon par transition</th></tr>
                </thead>
                <tbody>
                  <tr><td style={tdL}>CP1 → CP2</td><td style={{ ...td, background: colorFor(abandon.txAbdcp1cp2, 5, 15) }}>{fmt(abandon.txAbdcp1cp2)}</td></tr>
                  <tr><td style={tdL}>CP2 → CE</td><td style={{ ...td, background: colorFor(abandon.txAbdcp2ce, 5, 15) }}>{fmt(abandon.txAbdcp2ce)}</td></tr>
                  <tr><td style={tdL}>CE → CM1</td><td style={{ ...td, background: colorFor(abandon.txAbdcecm1, 5, 15) }}>{fmt(abandon.txAbdcecm1)}</td></tr>
                  <tr><td style={tdL}>CM1 → CM2</td><td style={{ ...td, background: colorFor(abandon.txAbdcm1cm2, 5, 15) }}>{fmt(abandon.txAbdcm1cm2)}</td></tr>
                  <tr style={{ fontWeight: 'bold' }}>
                    <td style={{ ...tdL, background: '#eeeeee' }}>Global</td>
                    <td style={{ ...td, background: colorFor(abandon.txAbdGlobal, 5, 15), fontWeight: 'bold' }}>{fmt(abandon.txAbdGlobal)}</td>
                  </tr>
                </tbody>
              </table>
            </td>

            {/* === Rétention === */}
            <td style={{ width: '25%', verticalAlign: 'top', padding: 2 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr><th style={th} colSpan={2}>Taux de rétention</th></tr>
                </thead>
                <tbody>
                  <tr><td style={tdL}>Garçons</td><td style={{ ...td, background: colorFor(100 - retention.txRetentionGarcons, 30, 50) }}>{retention.txRetentionGarcons.toFixed(1)}%</td></tr>
                  <tr><td style={tdL}>Filles</td><td style={{ ...td, background: colorFor(100 - retention.txRetentionFilles, 30, 50) }}>{retention.txRetentionFilles.toFixed(1)}%</td></tr>
                  <tr style={{ fontWeight: 'bold' }}>
                    <td style={{ ...tdL, background: '#eeeeee' }}>Ensemble</td>
                    <td style={{ ...td, background: colorFor(100 - retention.txRetentionTotal, 30, 50), fontWeight: 'bold' }}>{retention.txRetentionTotal.toFixed(1)}%</td>
                  </tr>
                </tbody>
                <thead>
                  <tr><th style={{ ...th, background: '#dcedc8' }} colSpan={2}>Profil cohorte (ensemble)</th></tr>
                </thead>
                <tbody>
                  {niveaux.map((n, i) => (
                    <tr key={n}>
                      <td style={tdL}>{n}</td>
                      <td style={td}>{retention.profilRetEnsemble[i]?.toFixed(1) ?? 0}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </td>

            {/* === Redoublement par niveau === */}
            <td style={{ width: '25%', verticalAlign: 'top', padding: 2 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr><th style={th} colSpan={4}>% Redoublants par niveau</th></tr>
                  <tr><th style={th}>Niveau</th><th style={th}>G</th><th style={th}>F</th><th style={th}>Ens.</th></tr>
                </thead>
                <tbody>
                  {niveaux.map((n) => {
                    const r = redoublement.parNiveau[n];
                    if (!r) return null;
                    return (
                      <tr key={n}>
                        <td style={tdL}>{n}</td>
                        <td style={{ ...td, background: colorFor(r.g, 5, 15) }}>{r.g.toFixed(1)}%</td>
                        <td style={{ ...td, background: colorFor(r.f, 5, 15) }}>{r.f.toFixed(1)}%</td>
                        <td style={{ ...td, background: colorFor(r.ens, 5, 15) }}>{r.ens.toFixed(1)}%</td>
                      </tr>
                    );
                  })}
                  <tr style={{ fontWeight: 'bold' }}>
                    <td style={{ ...tdL, background: '#eeeeee' }}>Moyenne</td>
                    <td style={{ ...td, background: '#eeeeee', fontWeight: 'bold' }}>{redoublement.red_garcons.toFixed(1)}%</td>
                    <td style={{ ...td, background: '#eeeeee', fontWeight: 'bold' }}>{redoublement.red_fille.toFixed(1)}%</td>
                    <td style={{ ...td, background: '#eeeeee', fontWeight: 'bold' }}>{redoublement.red_ensemble.toFixed(1)}%</td>
                  </tr>
                </tbody>
              </table>
            </td>

            {/* === CEPE === */}
            <td style={{ width: '25%', verticalAlign: 'top', padding: 2 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr><th style={th} colSpan={3}>Résultats CEPE</th></tr>
                </thead>
                <tbody>
                  <tr><td style={tdL}>Taux admis G</td><td style={{ ...td, background: colorFor(100 - cepe.tx_admis_g, 30, 50) }} colSpan={2}>{cepe.tx_admis_g.toFixed(1)}%</td></tr>
                  <tr><td style={tdL}>Taux admis F</td><td style={{ ...td, background: colorFor(100 - cepe.tx_admis_f, 30, 50) }} colSpan={2}>{cepe.tx_admis_f.toFixed(1)}%</td></tr>
                  <tr style={{ fontWeight: 'bold' }}>
                    <td style={{ ...tdL, background: '#eeeeee' }}>Total</td>
                    <td style={{ ...td, background: colorFor(100 - cepe.tx_admis, 30, 50), fontWeight: 'bold' }} colSpan={2}>{cepe.tx_admis.toFixed(1)}%</td>
                  </tr>
                </tbody>
                <thead>
                  <tr><th style={th}>Matière</th><th style={th}>Moy.</th><th style={th}>{'> 10'}</th></tr>
                </thead>
                <tbody>
                  <tr><td style={tdL}>Maths</td><td style={td}>{cepe.sm_maths.toFixed(1)}</td><td style={td}>{cepe.sup_10_maths}</td></tr>
                  <tr><td style={tdL}>Malagasy</td><td style={td}>{cepe.sm_mlg.toFixed(1)}</td><td style={td}>{cepe.sup_10_mlg}</td></tr>
                  <tr><td style={tdL}>Français</td><td style={td}>{cepe.sm_fr.toFixed(1)}</td><td style={td}>{cepe.sup_10_fr}</td></tr>
                  <tr><td style={tdL}>SVT</td><td style={td}>{cepe.sm_svt.toFixed(1)}</td><td style={td}>{cepe.sup_10_svt}</td></tr>
                  <tr><td style={tdL}>Géo</td><td style={td}>{cepe.sm_geo.toFixed(1)}</td><td style={td}>{cepe.sup_10_geo}</td></tr>
                  <tr><td style={tdL}>TFM</td><td style={td}>{cepe.sm_tfm.toFixed(1)}</td><td style={td}>{cepe.sup_10_tfm}</td></tr>
                </tbody>
              </table>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
