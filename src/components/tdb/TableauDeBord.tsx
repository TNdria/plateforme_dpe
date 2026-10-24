import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import DisparityIcon from '@/components/score/DisparityIcon';
import { EfficienceGrid } from './EfficienceGrid';
import logoMen from '@/assets/logoMen.jpg';
import {
  buildDrenReport,
  formatDrenValue,
  type DrenReportModel,
  type ExamBlock,
  type GoulotItem,
  type IndicatorMeta,
  type ReportCell,
  type ReportLevel,
  type ReportTable,
} from '@/utils/tdbDrenReportModel';

interface Props {
  data: any;
  niveau: ReportLevel;
  codeDren?: string;
}

const LEGEND = [
  { color: '#7EB6EA', label: 'Données non disponibles' },
  { color: '#FFFF00', label: 'Données à vérifier' },
  { color: '#FF0000', label: 'Attention', light: true },
];

function Banner({ children }: { children: React.ReactNode }) {
  return <div className="tdb-banner">{children}</div>;
}

function Legend() {
  return (
    <div className="tdb-legend">
      {LEGEND.map((item) => (
        <span key={item.label}>
          <i style={{ background: item.color }} />
          {item.label}
        </span>
      ))}
    </div>
  );
}

function Header({ report }: { report: DrenReportModel }) {
  return (
    <header className="tdb-head">
      <div className="tdb-head-left">
        <img src={logoMen} alt="Ministère de l’Éducation Nationale" />
        <strong>Ministère de l’Éducation Nationale</strong>
      </div>
      <div className="tdb-head-title">
        TABLEAU DE BORD {report.title} {report.anneeLabel}
      </div>
      <div className="tdb-head-right">
        <div>DREN : <b>{report.drenName || '—'}</b></div>
        <div>CODE : <b>{report.drenCode || '—'}</b></div>
      </div>
    </header>
  );
}

function cellClass(cell: ReportCell) {
  return `tdb-cell tdb-cell-${cell.status}${cell.icon !== undefined ? ' tdb-cell-icon' : ''}`;
}

function Cell({ cell, onClick }: { cell: ReportCell; onClick?: (meta?: IndicatorMeta) => void }) {
  if (cell.icon !== undefined) {
    return (
      <td className={cellClass(cell)} colSpan={cell.span} onClick={() => onClick?.(cell.meta)}>
        {cell.icon ? <DisparityIcon kind={cell.icon} size={18} /> : <span className="tdb-dash">—</span>}
      </td>
    );
  }
  return (
    <td
      className={cellClass(cell)}
      colSpan={cell.span}
      onClick={() => onClick?.(cell.meta)}
      title={cell.meta?.label}
    >
      {cell.display}
    </td>
  );
}

function DataTable({ table, onMeta, dense }: { table: ReportTable; onMeta: (meta?: IndicatorMeta) => void; dense?: boolean }) {
  return (
    <div className="tdb-table-block">
      {table.title && <div className="tdb-table-title">{table.title}</div>}
      <table className={`tdb-table tdb-table-c${table.columns.length}${dense ? ' tdb-table-dense' : ''}`}>
        <thead>
          <tr>
            {table.columns.map((column, i) => (
              <th key={`${column}-${i}`}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, ri) => (
            <tr key={`${row.label}-${ri}`} className={row.bold ? 'tdb-row-bold' : undefined}>
              <th scope="row" className={`tdb-row-label${row.indent ? ' tdb-indent' : ''}`}>
                {row.meta ? (
                  <button type="button" className="tdb-label" onClick={() => onMeta(row.meta)} title="Voir la fiche de l’indicateur">
                    {row.label}
                  </button>
                ) : (
                  row.label
                )}
              </th>
              {row.cells.map((cell, ci) => (
                <Cell key={ci} cell={cell} onClick={onMeta} />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {table.note && <div className="tdb-note">{table.note}</div>}
    </div>
  );
}

function ExamTable({ block, onMeta }: { block: ExamBlock; onMeta: (meta?: IndicatorMeta) => void }) {
  const total = 1 + block.groups.slice(1).reduce((sum, group) => sum + group.span, 0);
  return (
    <div className="tdb-table-block tdb-exam">
      <div className="tdb-table-title">{block.title}</div>
      <table className={`tdb-table tdb-table-dense tdb-table-c${block.subColumns.length}`}>
        <thead>
          <tr>
            {block.groups.map((group, i) => (
              <th key={`g${i}`} colSpan={group.span} className={group.label ? 'tdb-group-head' : ''}>
                {group.label}
              </th>
            ))}
          </tr>
          <tr>
            {block.subColumns.map((column, i) => (
              <th key={`s${i}`}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {block.subjectRows.map((row, ri) => (
            <tr key={`${row.label}-${ri}`} className={row.bold ? 'tdb-row-bold' : undefined}>
              <th scope="row" className="tdb-row-label">
                <button type="button" className="tdb-label" onClick={() => onMeta(row.meta)}>{row.label}</button>
              </th>
              {row.cells.map((cell, ci) => <Cell key={ci} cell={cell} onClick={onMeta} />)}
            </tr>
          ))}
          {block.admissionTitle && block.admissionRows.length > 0 && (
            <tr className="tdb-subhead">
              <th colSpan={total} scope="rowgroup">{block.admissionTitle}</th>
            </tr>
          )}
          {block.admissionRows.map((row, ri) => (
            <tr key={`a${ri}`} className={row.bold ? 'tdb-row-bold' : undefined}>
              <th scope="row" className="tdb-row-label">{row.label}</th>
              {row.cells.map((cell, ci) => <Cell key={ci} cell={cell} onClick={onMeta} />)}
            </tr>
          ))}
        </tbody>
      </table>
      {block.note && <div className="tdb-note">{block.note}</div>}
    </div>
  );
}

function RetentionChart({ model }: { model: DrenReportModel }) {
  if (model.profile.length === 0) return null;
  const W = 360, H = 172;
  const plot = { x: 30, y: 14, w: 318, h: 128 };
  const px = (i: number) => plot.x + (model.profile.length === 1 ? plot.w / 2 : (i / (model.profile.length - 1)) * plot.w);
  const py = (v: number) => plot.y + plot.h - Math.max(0, Math.min(100, v)) / 100 * plot.h;
  const path = (key: 'dren' | 'mada') => model.profile
    .map((p, i) => {
      const value = p[key];
      return value === null ? null : `${i === 0 || model.profile[i - 1][key] === null ? 'M' : 'L'} ${px(i)} ${py(value)}`;
    })
    .filter(Boolean)
    .join(' ');
  return (
    <div className="tdb-chart-box">
      <div className="tdb-chart-head">
        <b>{model.profileTitle}</b>
        <div className="tdb-chart-legend-inline">
          <span><i className="tdb-dot" />Profil Régional</span>
          <span><i className="tdb-arrow" />Profil National</span>
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="tdb-svg" role="img" aria-label="Profil de rétention régional et national">
        {[0, 25, 50, 75, 100].map((v) => (
          <g key={v}>
            <line x1={plot.x} x2={plot.x + plot.w} y1={py(v)} y2={py(v)} className="tdb-grid" />
            <text x={plot.x - 5} y={py(v) + 3} textAnchor="end" className="tdb-axis">{v}</text>
          </g>
        ))}
        <defs>
          <marker id="tdb-arrow-head" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
            <path d="M0,0 L7,3.5 L0,7 z" fill="#111" />
          </marker>
        </defs>
        <path d={path('mada')} fill="none" stroke="#111" strokeWidth="1.4" strokeDasharray="4 3" markerEnd="url(#tdb-arrow-head)" />
        <path d={path('dren')} fill="none" stroke="#1f6fb2" strokeWidth="1.6" />
        {model.profile.map((p, i) => (
          <g key={p.label}>
            {p.mada !== null && <circle cx={px(i)} cy={py(p.mada)} r="2.2" fill="#111" />}
            {p.dren !== null && <circle cx={px(i)} cy={py(p.dren)} r="2.4" fill="#1f6fb2" />}
            {p.dren !== null && <text x={px(i)} y={py(p.dren) - 6} textAnchor="middle" className="tdb-value">{formatDrenValue(p.dren, '', 1)}</text>}
            <text x={px(i)} y={plot.y + plot.h + 14} textAnchor="middle" className="tdb-axis">{p.label}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}

function GoulotBars({ items, onMeta }: { items: GoulotItem[]; onMeta: (meta?: IndicatorMeta) => void }) {
  return (
    <div className="tdb-goulots">
      <table className="tdb-goulot-table">
        <tbody>
          {items.map((item) => {
            const over = item.raw !== null && item.raw > 100;
            // La piste va de 0 à 100 % : un ratio (élèves par salle, salles pour
            // 1 000 enfants…) n'y a pas d'échelle et ne doit pas dessiner de barre.
            const onPercentScale = item.meta.unit === '%';
            const width = item.value === null ? 0 : item.value;
            return (
              <tr key={item.label}>
                <th scope="row">
                  <button type="button" className="tdb-label" onClick={() => onMeta(item.meta)} title="Voir la fiche de l’indicateur">
                    {item.label}
                  </button>
                </th>
                <td className="tdb-goulot-track-cell">
                  <div className="tdb-goulot-track">
                    {onPercentScale && item.value !== null && <div className="tdb-goulot-bar" style={{ width: `${width}%` }} />}
                  </div>
                </td>
                <td className={`tdb-goulot-value${item.value === null ? ' tdb-goulot-missing' : ''}`}>
                  {item.value === null ? '—' : over ? '' : formatDrenValue(item.raw, item.meta.unit === '%' ? '%' : '', item.meta.digits ?? 1)}
                </td>
              </tr>
            );
          })}
          <tr className="tdb-goulot-axis">
            <td />
            <td>
              <div className="tdb-ticks">
                {[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map((tick) => <span key={tick}>{tick}</span>)}
              </div>
            </td>
            <td />
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function EfficienceMatrix({ model, onMeta }: { model: DrenReportModel; onMeta: (meta?: IndicatorMeta) => void }) {
  const effort = model.efficiency;
  if (!effort) return null;
  return (
    <div className="tdb-efficience">
      <EfficienceGrid
        entity={effort}
        scope="dren"
        entityLabel="Votre DREN"
        points={effort.points}
        siblingsLabel="CISCO"
        showNotes={false}
        onCurrentLabelClick={() => onMeta(model.bottlenecks[0]?.meta)}
      />
    </div>
  );
}

function Diagnosis({ model }: { model: DrenReportModel }) {
  if (!model.efficiency) return null;
  return (
    <div className="tdb-diagnosis">
      <h4>Remarque(s) et Diagnostique(s)</h4>
      {model.efficiency.remarks.map((text, i) => <p key={i}>{text}</p>)}
      <p className="tdb-diagnosis-score">
        Ressources : {formatDrenValue(model.efficiency.x, ' %')} · Résultats : {formatDrenValue(model.efficiency.y, ' %')}
      </p>
    </div>
  );
}

function Fiche({ meta, onClose }: { meta: IndicatorMeta | null; onClose: () => void }) {
  if (!meta) return null;
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{meta?.label}</DialogTitle>
          <DialogDescription>Fiche indicateur — {meta?.code}</DialogDescription>
        </DialogHeader>
        {meta && (
          <dl className="tdb-fiche">
            <dt>Définition</dt><dd>{meta.definition}</dd>
            <dt>Formule</dt><dd>{meta.formula}</dd>
            <dt>Données nécessaires</dt><dd>{meta.dataNeeded}</dd>
            <dt>Source</dt><dd>{meta.source}</dd>
            <dt>Stratégie de collecte</dt><dd>{meta.collect}</dd>
            <dt>Responsable</dt><dd>{meta.owner}</dd>
            <dt>Deadline</dt><dd>{meta.deadline}</dd>
            <dt>Sens</dt><dd>{meta.sense === 'lower' ? 'Plus bas = mieux' : meta.sense === 'higher' ? 'Plus haut = mieux' : 'Neutre'}</dd>
          </dl>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function TableauDeBord({ data, niveau, codeDren }: Props) {
  const report = useMemo(() => {
    const model = buildDrenReport(data, niveau);
    if (codeDren) model.drenCode = codeDren;
    return model;
  }, [data, niveau, codeDren]);
  const [fiche, setFiche] = useState<IndicatorMeta | null>(null);
  const openFiche = (meta?: IndicatorMeta) => { if (meta) setFiche(meta); };

  const lycee = niveau === 'lycee';
  const examPage1 = lycee ? report.exams.slice(0, 4) : report.exams;
  const examPage2 = lycee ? report.exams.slice(4) : [];

  const generalPage = (
    <>
      <Banner>DONNÉES GÉNÉRALES</Banner>
      <div className="tdb-cols-3">
        {report.general.map((table, i) => <DataTable key={i} table={table} onMeta={openFiche} dense />)}
      </div>
    </>
  );

  const resultsPage = (
    <>
      <Banner>RÉSULTATS SCOLAIRES</Banner>
      <div className={niveau === 'presco' ? '' : 'tdb-cols-2'}>
        <DataTable table={report.coverage} onMeta={openFiche} />
        {niveau !== 'presco' && <RetentionChart model={report} />}
      </div>
      {examPage1.length > 0 && (
        <div className={examPage1.length > 1 ? 'tdb-cols-2' : ''}>
          {examPage1.map((block, i) => <ExamTable key={i} block={block} onMeta={openFiche} />)}
        </div>
      )}
      {!lycee && report.ueas.length > 0 && (
        <div className="tdb-cols-2">
          {report.ueas.map((block, i) => <ExamTable key={`u${i}`} block={block} onMeta={openFiche} />)}
        </div>
      )}
      {!lycee && report.flows.length > 0 && (
        <div className="tdb-cols-3">
          {report.flows.map((table, i) => <DataTable key={`f${i}`} table={table} onMeta={openFiche} dense />)}
        </div>
      )}
    </>
  );

  const resultsPage2 = lycee ? (
    <>
      <Banner>RÉSULTATS SCOLAIRES (SUITE)</Banner>
      <div className="tdb-cols-2">
        {examPage2.map((block, i) => <ExamTable key={i} block={block} onMeta={openFiche} />)}
      </div>
      <div className="tdb-cols-3">
        {report.flows.map((table, i) => <DataTable key={`f${i}`} table={table} onMeta={openFiche} dense />)}
      </div>
    </>
  ) : null;

  const resourcesPage = (
    <>
      <Banner>RESSOURCES</Banner>
      <div className="tdb-cols-2">
        <div>
          <DataTable table={report.human} onMeta={openFiche} />
          {report.manuals && <DataTable table={report.manuals} onMeta={openFiche} />}
        </div>
        <div>
          {report.finance && <DataTable table={report.finance} onMeta={openFiche} />}
          <DataTable table={report.other} onMeta={openFiche} />
        </div>
      </div>
    </>
  );

  const goulotsPage = (
    <>
      <Banner>ANALYSE DES GOULOTS D’ÉTRANGLEMENT (PUBLIC)</Banner>
      <GoulotBars items={report.bottlenecks} onMeta={openFiche} />
    </>
  );

  const efficiencePage = report.efficiency ? (
    <>
      <Banner>EFFICIENCE (PUBLIC)</Banner>
      <div className="tdb-cols-55-45">
        <EfficienceMatrix model={report} onMeta={openFiche} />
        <Diagnosis model={report} />
      </div>
    </>
  ) : null;

  return (
    <div className="tdb-report">
      <div className="tdb-sheet tdb-sheet-continuous">
        <Header report={report} />
        <Legend />
        {generalPage}
        {resultsPage}
        {resultsPage2}
        {report.notes.map((note, i) => <p key={i} className="tdb-note">{note}</p>)}
        {resourcesPage}
        <div className={report.efficiency ? 'tdb-cols-55-45 tdb-bottom' : 'tdb-bottom'}>
          <div>{goulotsPage}</div>
          {report.efficiency && (
            <div>
              <Banner>EFFICIENCE (PUBLIC)</Banner>
              <EfficienceMatrix model={report} onMeta={openFiche} />
              <Diagnosis model={report} />
            </div>
          )}
          </div>
      </div>

      <Fiche meta={fiche} onClose={() => setFiche(null)} />
    </div>
  );
}


export default TableauDeBord;
