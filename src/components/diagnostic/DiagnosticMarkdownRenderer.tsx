import { useMemo } from 'react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { cn } from '@/lib/utils';

interface DiagnosticMarkdownRendererProps {
  content: string;
}

const CHART_COLORS = ['#3b82f6', '#f97316', '#10b981', '#8b5cf6', '#ef4444', '#06b6d4', '#f59e0b', '#ec4899'];

interface ChartData {
  type: 'bar' | 'line' | 'pie';
  title: string;
  data: any[];
  dataKeys?: string[];
  colors?: string[];
  labels?: string[];
}

const parseChartBlock = (jsonStr: string): ChartData | null => {
  try {
    const parsed = JSON.parse(jsonStr);
    if (parsed.type && parsed.data) return parsed;
    return null;
  } catch {
    return null;
  }
};

const ChartRenderer = ({ chart }: { chart: ChartData }) => {
  const colors = chart.colors || CHART_COLORS;

  if (chart.type === 'pie') {
    return (
      <div className="my-4 p-4 bg-card border border-border rounded-lg">
        <h4 className="text-sm font-semibold text-foreground mb-3 text-center">{chart.title}</h4>
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie data={chart.data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}>
              {chart.data.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
    );
  }

  const dataKeys = chart.dataKeys || Object.keys(chart.data[0] || {}).filter(k => k !== 'name');

  if (chart.type === 'line') {
    return (
      <div className="my-4 p-4 bg-card border border-border rounded-lg">
        <h4 className="text-sm font-semibold text-foreground mb-3 text-center">{chart.title}</h4>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={chart.data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend />
            {dataKeys.map((key, i) => (
              <Line key={key} type="monotone" dataKey={key} stroke={colors[i % colors.length]} strokeWidth={2} name={chart.labels?.[i] || key} dot={{ r: 4 }} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  }

  // Default: bar chart
  return (
    <div className="my-4 p-4 bg-card border border-border rounded-lg">
      <h4 className="text-sm font-semibold text-foreground mb-3 text-center">{chart.title}</h4>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={chart.data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip />
          <Legend />
          {dataKeys.map((key, i) => (
            <Bar key={key} dataKey={key} fill={colors[i % colors.length]} name={chart.labels?.[i] || key} radius={[4, 4, 0, 0]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

const MarkdownTable = ({ headerRow, rows }: { headerRow: string[]; rows: string[][] }) => {
  return (
    <div className="my-4 overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-muted/60">
            {headerRow.map((cell, i) => (
              <th key={i} className="border border-border px-3 py-2 text-left font-semibold text-foreground text-xs">{cell.trim()}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} className={cn('hover:bg-muted/30 transition-colors', ri % 2 === 0 ? 'bg-background' : 'bg-muted/20')}>
              {row.map((cell, ci) => (
                <td key={ci} className="border border-border/50 px-3 py-1.5 text-foreground/85 text-xs">{cell.trim()}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const InlineFormatted = ({ text }: { text: string }) => {
  // Handle bold, italic, inline code
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**'))
          return <strong key={i} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>;
        if (part.startsWith('*') && part.endsWith('*'))
          return <em key={i}>{part.slice(1, -1)}</em>;
        if (part.startsWith('`') && part.endsWith('`'))
          return <code key={i} className="px-1 py-0.5 bg-muted rounded text-xs font-mono">{part.slice(1, -1)}</code>;
        return <span key={i}>{part}</span>;
      })}
    </>
  );
};

type ParsedBlock =
  | { type: 'heading'; level: 1 | 2 | 3 | 4; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'list-item'; text: string; indent: number }
  | { type: 'table'; header: string[]; rows: string[][] }
  | { type: 'chart'; data: ChartData }
  | { type: 'hr' }
  | { type: 'empty' };

const parseMarkdown = (content: string): ParsedBlock[] => {
  const lines = content.split('\n');
  const blocks: ParsedBlock[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Chart block
    if (line.trim() === '```chart') {
      let jsonStr = '';
      i++;
      while (i < lines.length && lines[i].trim() !== '```') {
        jsonStr += lines[i] + '\n';
        i++;
      }
      i++; // skip closing ```
      const chart = parseChartBlock(jsonStr);
      if (chart) blocks.push({ type: 'chart', data: chart });
      continue;
    }

    // Skip other code blocks
    if (line.trim().startsWith('```')) {
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) i++;
      i++;
      continue;
    }

    // HR
    if (/^---+$/.test(line.trim())) {
      blocks.push({ type: 'hr' });
      i++;
      continue;
    }

    // Headings
    const headingMatch = line.match(/^(#{1,4})\s+(.+)/);
    if (headingMatch) {
      blocks.push({ type: 'heading', level: headingMatch[1].length as 1 | 2 | 3 | 4, text: headingMatch[2] });
      i++;
      continue;
    }

    // Table detection
    if (line.includes('|') && i + 1 < lines.length && /\|[\s-]+\|/.test(lines[i + 1])) {
      const parseCells = (l: string) => l.split('|').slice(1, -1).map(c => c.trim());
      const header = parseCells(line);
      i += 2; // skip header and separator
      const rows: string[][] = [];
      while (i < lines.length && lines[i].includes('|') && !lines[i].match(/^#{1,4}\s/)) {
        const cells = parseCells(lines[i]);
        if (cells.length > 0) rows.push(cells);
        i++;
      }
      blocks.push({ type: 'table', header, rows });
      continue;
    }

    // List items
    if (/^\s*[-*]\s+/.test(line)) {
      const indent = line.search(/\S/);
      const text = line.replace(/^\s*[-*]\s+/, '');
      blocks.push({ type: 'list-item', text, indent });
      i++;
      continue;
    }

    // Empty line
    if (!line.trim()) {
      blocks.push({ type: 'empty' });
      i++;
      continue;
    }

    // Paragraph
    blocks.push({ type: 'paragraph', text: line });
    i++;
  }

  return blocks;
};

const DiagnosticMarkdownRenderer = ({ content }: DiagnosticMarkdownRendererProps) => {
  const blocks = useMemo(() => parseMarkdown(content), [content]);

  return (
    <div className="space-y-0">
      {blocks.map((block, idx) => {
        switch (block.type) {
          case 'heading':
            if (block.level === 1)
              return <h1 key={idx} className="text-xl font-bold mt-8 mb-3 text-primary border-b-2 border-primary/20 pb-2"><InlineFormatted text={block.text} /></h1>;
            if (block.level === 2)
              return <h2 key={idx} className="text-lg font-bold mt-6 mb-2 text-primary border-b border-border/50 pb-1"><InlineFormatted text={block.text} /></h2>;
            if (block.level === 3)
              return <h3 key={idx} className="text-base font-semibold mt-4 mb-2 text-foreground"><InlineFormatted text={block.text} /></h3>;
            return <h4 key={idx} className="text-sm font-semibold mt-3 mb-1 text-foreground/90"><InlineFormatted text={block.text} /></h4>;

          case 'paragraph':
            return <p key={idx} className="my-1.5 text-foreground/85 leading-relaxed text-sm"><InlineFormatted text={block.text} /></p>;

          case 'list-item':
            return (
              <div key={idx} className="flex gap-2 my-0.5" style={{ paddingLeft: `${Math.max(block.indent, 1) * 8}px` }}>
                <span className="text-primary mt-1.5 text-xs">•</span>
                <p className="text-foreground/85 text-sm leading-relaxed"><InlineFormatted text={block.text} /></p>
              </div>
            );

          case 'table':
            return <MarkdownTable key={idx} headerRow={block.header} rows={block.rows} />;

          case 'chart':
            return <ChartRenderer key={idx} chart={block.data} />;

          case 'hr':
            return <hr key={idx} className="my-6 border-border" />;

          case 'empty':
            return null;

          default:
            return null;
        }
      })}
    </div>
  );
};

export default DiagnosticMarkdownRenderer;
