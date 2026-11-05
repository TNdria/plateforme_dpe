import { buildDiagnostic, type DiagnosticInput } from '@/utils/tdbDiagnostic';

const bold = (t: string) => t.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!)).replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
const box: React.CSSProperties = { border: '1px solid #000', padding: 10, fontSize: 10, lineHeight: 1.4, marginTop: 8 };
const h: React.CSSProperties = { fontSize: 11, fontWeight: 'bold', textDecoration: 'underline', margin: '6px 0 4px' };

export function TDBDiagnosticReport(props: DiagnosticInput & { showDiagnostic?: boolean }) {
  const r = buildDiagnostic(props);
  const showDiag = props.showDiagnostic !== false;
  const list = (items: string[]) => <ul style={{ margin: 0, paddingLeft: 16 }}>{items.map((t, i) => <li key={i} dangerouslySetInnerHTML={{ __html: bold(t) }} />)}</ul>;
  const g = r.goulots;
  return (
    <div style={box} data-testid="tdb-diagnostic">
      {showDiag && <><h4 style={h}>Diagnostic de votre {props.entityLabel}</h4>{list(r.diagnostic)}</>}
      {g && <>
        <h4 style={h}>Rapport des goulots d’étranglement</h4>
        {list([
          `**Critiques (< 50 %)** : ${g.critical.length ? g.critical.map(x => x.label).join(', ') : 'aucun'}.`,
          `**À surveiller (50–75 %)** : ${g.warning.length ? g.warning.map(x => x.label).join(', ') : 'aucun'}.`,
          `**Satisfaisants (> 75 %)** : ${g.good.length ? g.good.map(x => x.label).join(', ') : 'aucun'}.`,
          ...(g.missing.length ? [`**Non disponibles** : ${g.missing.map(x => x.label).join(', ')}.`] : []),
        ])}
      </>}
      <h4 style={h}>Recommandations</h4>
      {list(r.recommandations)}
    </div>
  );
}
export default TDBDiagnosticReport;
