/**
 * DiagnosticPanel — porte la logique du PDF Python (tdb_pdf.py) :
 *   • diagnostic_efficience(x, y)        → tableau 3x3 + texte
 *   • interpretation_abandon(ecole, zap) → 3 paragraphes
 *   • Scatter plot Ressources (X) vs Résultats (Y) avec lignes médianes 33/66
 *
 * Rendu HTML pur (capturé tel quel par le pipeline A3 multiPagePdf).
 * Conçu pour s'intégrer dans le `printRef` des pages TDB École / ZAP / CISCO.
 */
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  LabelList,
} from 'recharts';

// ---------- Calculs portés depuis Python ----------
const getLevel = (v: number): 'minim' | 'moyen' | 'maxim' => {
  if (v < 33.33) return 'minim';
  if (v < 66.66) return 'moyen';
  return 'maxim';
};

const REMARQUE_MATRIX: Record<string, string> = {
  'minim|minim': "Faibles ressources et faibles résultats : l'école est en grande difficulté.",
  'minim|moyen': "Ressources faibles mais résultats moyens : bonne efficience malgré des moyens limités.",
  'minim|maxim': "Ressources faibles mais résultats élevés : excellente efficience, situation exceptionnelle.",
  'moyen|minim': "Ressources moyennes mais résultats faibles : problème d'efficacité pédagogique ou de gestion.",
  'moyen|moyen': "Ressources et résultats moyens : situation intermédiaire, sans point fort ni faiblesse majeure.",
  'moyen|maxim': "Ressources moyennes et résultats élevés : bonne efficience, ressources bien exploitées.",
  'maxim|minim': "Ressources élevées mais résultats faibles : inefficience marquée, problème sérieux à corriger.",
  'maxim|moyen': "Ressources élevées mais résultats moyens : efficience faible, résultats sous-optimaux.",
  'maxim|maxim': "Ressources et résultats élevés : situation idéale, à maintenir et valoriser.",
};

const DIAGNOSTIC_MATRIX: Record<string, string> = {
  'maxim|maxim':
    "L'école dispose de ressources abondantes et obtient d'excellents résultats. Gestion optimale et organisation pédagogique efficace. Situation idéale à maintenir.",
  'minim|maxim':
    "Malgré des ressources très limitées, l'école atteint des résultats remarquables. Grande efficience et engagement exceptionnel. Exemple à suivre.",
  'minim|moyen':
    "L'école obtient des résultats corrects avec peu de moyens. Bonne efficience. Un accompagnement ciblé permettrait d'aller plus loin.",
  'moyen|maxim':
    "Les moyens sont bien exploités et permettent des résultats supérieurs à la moyenne. Bonne organisation, pédagogie efficace.",
  'moyen|moyen':
    "Fonctionnement normal, ressources et résultats dans la moyenne. Efforts ciblés pour améliorer la performance.",
  'maxim|moyen':
    "Ressources importantes mais résultats moyens. Potentiel d'amélioration significatif. Analyse approfondie de la gestion recommandée.",
  'maxim|minim':
    "Ressources élevées mais résultats très faibles. Inefficience marquée. Intervention urgente nécessaire.",
  'moyen|minim':
    "Moyens corrects mais difficultés à les transformer en résultats. Probables difficultés pédagogiques. Accompagnement spécifique conseillé.",
  'minim|minim':
    "Grande difficulté : peu de ressources et très faibles résultats. Situation préoccupante. Plan d'action prioritaire à envisager.",
};

export function diagnosticEfficience(x: number, y: number) {
  const nx = getLevel(x);
  const ny = getLevel(y);
  const key = `${nx}|${ny}`;
  return {
    niveauX: nx,
    niveauY: ny,
    remarque: REMARQUE_MATRIX[key],
    diagnostic: DIAGNOSTIC_MATRIX[key],
    efficient: ny === 'maxim' || (ny === 'moyen' && nx !== 'maxim'),
  };
}

export function interpretationAbandon(ecole: number, zap: number) {
  let niveau: string;
  if (ecole < 5) niveau = "Très faible taux d'abandon : excellente rétention des élèves.";
  else if (ecole < 10) niveau = "Faible taux d'abandon : la majorité des élèves restent scolarisés.";
  else if (ecole < 20) niveau = "Taux d'abandon préoccupant : plusieurs élèves quittent l'école.";
  else niveau = "Taux d'abandon élevé : une grande partie des élèves sort prématurément.";

  let comparaison: string;
  let suggestion: string;
  if (ecole < zap * 0.9) {
    comparaison = "L'école fait nettement mieux que la moyenne de la commune (ZAP).";
    suggestion = "Poursuivre les pratiques positives (suivi parental, cantine, sensibilisation).";
  } else if (ecole <= zap * 1.1) {
    comparaison = "L'école est globalement au même niveau que la commune.";
    suggestion = "Renforcer les actions locales conjointes avec la ZAP.";
  } else {
    comparaison = "L'école est en moins bonne situation que la commune.";
    suggestion = "Identifier les causes spécifiques et mettre en place un suivi ciblé.";
  }
  return { niveau, comparaison, suggestion };
}

// ---------- Composant ----------
export interface ScatterPoint {
  nom: string;
  code: string | number;
  x: number; // 0-100 ressources
  y: number; // 0-100 résultats
  highlight?: boolean; // école courante
}

interface DiagnosticPanelProps {
  /** Score X (ressources, 0-100) de l'entité courante */
  scoreX: number;
  /** Score Y (résultats, 0-100) de l'entité courante */
  scoreY: number;
  /** Taux d'abandon ensemble — école */
  abandonEcole: number;
  /** Taux d'abandon ensemble — ZAP */
  abandonZap: number;
  /** Nuage de points (autres écoles de la ZAP), optionnel */
  scatterData?: ScatterPoint[];
  /** Titre custom */
  title?: string;
}

export function DiagnosticPanel({
  scoreX,
  scoreY,
  abandonEcole,
  abandonZap,
  scatterData = [],
  title = 'DIAGNOSTIC ET INTERPRÉTATIONS',
}: DiagnosticPanelProps) {
  const diag = diagnosticEfficience(scoreX, scoreY);
  const aban = interpretationAbandon(abandonEcole, abandonZap);

  const titreStyle: React.CSSProperties = {
    letterSpacing: '0.15em',
    textTransform: 'uppercase',
    width: '100%',
    background: '#2e7d32',
    color: '#fff',
    padding: '5px 10px',
    marginTop: '6px',
    marginBottom: '4px',
    fontWeight: 'bold',
    fontSize: '11px',
    textAlign: 'center',
  };

  const cellStyle: React.CSSProperties = {
    border: '1px solid #555',
    padding: '6px 8px',
    fontSize: '10px',
    verticalAlign: 'top',
    background: '#fff',
  };

  // Inclut l'école courante dans le scatter
  const allPoints: ScatterPoint[] = [
    ...scatterData,
    { nom: 'École courante', code: '★', x: scoreX, y: scoreY, highlight: true },
  ];

  return (
    <div style={{ marginTop: 8 }}>
      <div style={titreStyle}>{title}</div>

      <table style={{ width: '100%', borderCollapse: 'collapse' }} cellSpacing={0}>
        <tbody>
          <tr>
            {/* === Scatter plot === */}
            <td style={{ width: '45%', verticalAlign: 'top', paddingRight: 4 }}>
              <div
                style={{
                  border: '1px solid #555',
                  background: '#fff',
                  padding: 6,
                }}
              >
                <div
                  style={{
                    textAlign: 'center',
                    fontSize: 10,
                    fontWeight: 'bold',
                    marginBottom: 4,
                  }}
                >
                  Diagramme d'efficience (X = Ressources, Y = Résultats)
                </div>
                <div style={{ width: '100%', height: 320 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart margin={{ top: 10, right: 10, bottom: 30, left: 30 }}>
                      {/* Quadrants colorés */}
                      <ReferenceArea x1={0} x2={33.33} y1={66.66} y2={100} fill="#c8e6c9" fillOpacity={0.5} />
                      <ReferenceArea x1={33.33} x2={66.66} y1={66.66} y2={100} fill="#dcedc8" fillOpacity={0.5} />
                      <ReferenceArea x1={66.66} x2={100} y1={66.66} y2={100} fill="#fff9c4" fillOpacity={0.5} />
                      <ReferenceArea x1={0} x2={33.33} y1={33.33} y2={66.66} fill="#dcedc8" fillOpacity={0.5} />
                      <ReferenceArea x1={33.33} x2={66.66} y1={33.33} y2={66.66} fill="#fff9c4" fillOpacity={0.5} />
                      <ReferenceArea x1={66.66} x2={100} y1={33.33} y2={66.66} fill="#ffe0b2" fillOpacity={0.5} />
                      <ReferenceArea x1={0} x2={33.33} y1={0} y2={33.33} fill="#fff9c4" fillOpacity={0.5} />
                      <ReferenceArea x1={33.33} x2={66.66} y1={0} y2={33.33} fill="#ffe0b2" fillOpacity={0.5} />
                      <ReferenceArea x1={66.66} x2={100} y1={0} y2={33.33} fill="#ffcdd2" fillOpacity={0.5} />

                      <CartesianGrid stroke="#bbb" strokeDasharray="2 2" />
                      <XAxis
                        type="number"
                        dataKey="x"
                        domain={[0, 100]}
                        ticks={[0, 33.33, 66.66, 100]}
                        tick={{ fontSize: 9 }}
                        label={{ value: 'Ressources (%)', position: 'insideBottom', offset: -10, fontSize: 10 }}
                      />
                      <YAxis
                        type="number"
                        dataKey="y"
                        domain={[0, 100]}
                        ticks={[0, 33.33, 66.66, 100]}
                        tick={{ fontSize: 9 }}
                        label={{ value: 'Résultats (%)', angle: -90, position: 'insideLeft', fontSize: 10 }}
                      />
                      <ReferenceLine x={33.33} stroke="#666" strokeDasharray="3 3" />
                      <ReferenceLine x={66.66} stroke="#666" strokeDasharray="3 3" />
                      <ReferenceLine y={33.33} stroke="#666" strokeDasharray="3 3" />
                      <ReferenceLine y={66.66} stroke="#666" strokeDasharray="3 3" />
                      <Tooltip
                        cursor={{ strokeDasharray: '3 3' }}
                        content={({ active, payload }) => {
                          if (!active || !payload?.length) return null;
                          const p: any = payload[0].payload;
                          return (
                            <div style={{ background: '#fff', border: '1px solid #555', padding: 4, fontSize: 10 }}>
                              <div><b>{p.nom}</b></div>
                              <div>X: {p.x.toFixed(1)} · Y: {p.y.toFixed(1)}</div>
                            </div>
                          );
                        }}
                      />
                      <Scatter data={allPoints.filter(p => !p.highlight)} fill="#1976d2" />
                      <Scatter data={allPoints.filter(p => p.highlight)} fill="#d32f2f" shape="star">
                        <LabelList dataKey="code" position="top" style={{ fontSize: 10, fontWeight: 'bold', fill: '#d32f2f' }} />
                      </Scatter>
                    </ScatterChart>
                  </ResponsiveContainer>
                </div>
                <div style={{ fontSize: 9, color: '#555', marginTop: 4, lineHeight: 1.4 }}>
                  Les seuils 33% et 66% séparent les niveaux <i>minim / moyen / maxim</i>.
                  L'étoile rouge ★ représente l'école courante.
                </div>
              </div>
            </td>

            {/* === Diagnostic textuel === */}
            <td style={{ width: '55%', verticalAlign: 'top', paddingLeft: 4 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }} cellSpacing={0}>
                <tbody>
                  <tr>
                    <td style={{ ...cellStyle, background: '#f1f8e9', fontWeight: 'bold', textAlign: 'center' }}>
                      Diagnostic d'efficience
                      <span
                        style={{
                          marginLeft: 6,
                          padding: '1px 6px',
                          borderRadius: 3,
                          fontSize: 9,
                          background: diag.efficient ? '#2e7d32' : '#c62828',
                          color: '#fff',
                        }}
                      >
                        {diag.efficient ? 'EFFICIENT' : 'PEU EFFICIENT'}
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td style={cellStyle}>
                      <div style={{ marginBottom: 4 }}>
                        <b>Position :</b> Ressources <i>{diag.niveauX}</i> · Résultats <i>{diag.niveauY}</i>
                        {' '}(X = {scoreX.toFixed(1)} ; Y = {scoreY.toFixed(1)})
                      </div>
                      <div style={{ marginBottom: 4 }}>
                        <b>Constat :</b> {diag.remarque}
                      </div>
                      <div>
                        <b>Diagnostic :</b> {diag.diagnostic}
                      </div>
                    </td>
                  </tr>

                  <tr>
                    <td style={{ ...cellStyle, background: '#fff8e1', fontWeight: 'bold', textAlign: 'center' }}>
                      Interprétation du taux d'abandon
                    </td>
                  </tr>
                  <tr>
                    <td style={cellStyle}>
                      <div style={{ marginBottom: 4 }}>
                        <b>Niveau :</b> {aban.niveau}
                        {' '}(École : {abandonEcole.toFixed(1)} % · ZAP : {abandonZap.toFixed(1)} %)
                      </div>
                      <div style={{ marginBottom: 4 }}>
                        <b>Comparaison :</b> {aban.comparaison}
                      </div>
                      <div>
                        <b>Suggestion :</b> {aban.suggestion}
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
