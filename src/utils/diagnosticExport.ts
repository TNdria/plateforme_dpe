import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, BorderStyle, AlignmentType, ImageRun } from 'docx';
import { saveAs } from 'file-saver';
import { toast } from 'sonner';

interface DiagnosticResult {
  diagnostic: string;
  drenName: string;
  ciscoName: string;
  annee: string;
  generatedAt: string;
}

// Parse markdown content into blocks for export
interface TextBlock { type: 'heading' | 'paragraph' | 'list-item'; text: string; level?: number }
interface TableBlock { type: 'table'; header: string[]; rows: string[][] }
interface ChartBlock { type: 'chart'; title: string; chartType: string; data: any[]; dataKeys?: string[]; labels?: string[] }
type ExportBlock = TextBlock | TableBlock | ChartBlock;

const parseForExport = (content: string): ExportBlock[] => {
  const lines = content.split('\n');
  const blocks: ExportBlock[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Chart blocks
    if (line.trim() === '```chart') {
      i++;
      let jsonStr = '';
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        jsonStr += lines[i] + '\n';
        i++;
      }
      i++;
      try {
        const chartData = JSON.parse(jsonStr);
        blocks.push({
          type: 'chart',
          title: chartData.title || 'Graphique',
          chartType: chartData.type || 'bar',
          data: chartData.data || [],
          dataKeys: chartData.dataKeys,
          labels: chartData.labels,
        });
      } catch (e) {}
      continue;
    }

    // Skip other code blocks
    if (line.trim().startsWith('```') && line.trim() !== '```chart') {
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) i++;
      i++;
      continue;
    }

    // Table
    if (line.includes('|') && i + 1 < lines.length && /\|[\s-]+\|/.test(lines[i + 1])) {
      const parseCells = (l: string) => l.split('|').slice(1, -1).map(c => c.trim());
      const header = parseCells(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].includes('|') && !lines[i].match(/^#{1,4}\s/)) {
        rows.push(parseCells(lines[i]));
        i++;
      }
      blocks.push({ type: 'table', header, rows });
      continue;
    }

    // Headings
    const hMatch = line.match(/^(#{1,4})\s+(.+)/);
    if (hMatch) {
      blocks.push({ type: 'heading', text: hMatch[2], level: hMatch[1].length });
      i++; continue;
    }

    // List
    if (/^\s*[-*]\s+/.test(line)) {
      blocks.push({ type: 'list-item', text: line.replace(/^\s*[-*]\s+/, '') });
      i++; continue;
    }

    // Paragraph
    const clean = line.replace(/\*\*/g, '').trim();
    if (clean) blocks.push({ type: 'paragraph', text: clean });
    i++;
  }
  return blocks;
};

// ======= CHART RENDERING TO CANVAS =======
const CHART_COLORS = ['#3b82f6', '#f97316', '#10b981', '#8b5cf6', '#ef4444', '#06b6d4', '#f59e0b', '#ec4899'];

const renderChartToCanvas = (chart: ChartBlock, width = 500, height = 280): HTMLCanvasElement => {
  const canvas = document.createElement('canvas');
  canvas.width = width * 2; // retina
  canvas.height = height * 2;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(2, 2);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  
  const colors = CHART_COLORS;
  const padding = { top: 40, right: 20, bottom: 50, left: 60 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;
  
  // Title
  ctx.fillStyle = '#1e293b';
  ctx.font = 'bold 13px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(chart.title, width / 2, 22);
  
  if (chart.chartType === 'pie') {
    const cx = width / 2;
    const cy = height / 2 + 10;
    const radius = Math.min(chartW, chartH) / 2 - 20;
    const total = chart.data.reduce((s, d) => s + (Number(d.value) || 0), 0);
    let startAngle = -Math.PI / 2;
    
    chart.data.forEach((d, i) => {
      const val = Number(d.value) || 0;
      const sliceAngle = (val / total) * Math.PI * 2;
      
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radius, startAngle, startAngle + sliceAngle);
      ctx.closePath();
      ctx.fillStyle = colors[i % colors.length];
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();
      
      // Label
      const midAngle = startAngle + sliceAngle / 2;
      const labelR = radius * 0.7;
      const lx = cx + Math.cos(midAngle) * labelR;
      const ly = cy + Math.sin(midAngle) * labelR;
      const pctStr = total > 0 ? `${((val / total) * 100).toFixed(0)}%` : '';
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 11px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(pctStr, lx, ly + 4);
      
      startAngle += sliceAngle;
    });
    
    // Legend
    const legendY = height - 18;
    let legendX = 20;
    ctx.font = '10px Arial';
    chart.data.forEach((d, i) => {
      ctx.fillStyle = colors[i % colors.length];
      ctx.fillRect(legendX, legendY - 8, 10, 10);
      ctx.fillStyle = '#333';
      ctx.textAlign = 'left';
      ctx.fillText(`${d.name}`, legendX + 14, legendY);
      legendX += ctx.measureText(`${d.name}`).width + 28;
    });
    
    return canvas;
  }
  
  // Bar/Line chart
  const dataKeys = chart.dataKeys || Object.keys(chart.data[0] || {}).filter(k => k !== 'name');
  const labels = chart.labels || dataKeys;
  
  // Find min/max
  let maxVal = 0;
  chart.data.forEach(d => dataKeys.forEach(k => { maxVal = Math.max(maxVal, Number(d[k]) || 0); }));
  maxVal = Math.ceil(maxVal * 1.15);
  if (maxVal === 0) maxVal = 100;
  
  // Grid
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 0.5;
  const gridLines = 5;
  for (let g = 0; g <= gridLines; g++) {
    const gy = padding.top + chartH - (g / gridLines) * chartH;
    ctx.beginPath();
    ctx.moveTo(padding.left, gy);
    ctx.lineTo(padding.left + chartW, gy);
    ctx.stroke();
    
    ctx.fillStyle = '#64748b';
    ctx.font = '10px Arial';
    ctx.textAlign = 'right';
    ctx.fillText(String(Math.round((g / gridLines) * maxVal)), padding.left - 5, gy + 3);
  }
  
  // Axes
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padding.left, padding.top);
  ctx.lineTo(padding.left, padding.top + chartH);
  ctx.lineTo(padding.left + chartW, padding.top + chartH);
  ctx.stroke();
  
  const barGroupW = chartW / chart.data.length;
  const barW = (barGroupW * 0.7) / dataKeys.length;
  
  if (chart.chartType === 'line') {
    // Line chart
    dataKeys.forEach((key, ki) => {
      ctx.strokeStyle = colors[ki % colors.length];
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      chart.data.forEach((d, di) => {
        const x = padding.left + di * barGroupW + barGroupW / 2;
        const val = Number(d[key]) || 0;
        const y = padding.top + chartH - (val / maxVal) * chartH;
        if (di === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
      
      // Dots
      chart.data.forEach((d, di) => {
        const x = padding.left + di * barGroupW + barGroupW / 2;
        const val = Number(d[key]) || 0;
        const y = padding.top + chartH - (val / maxVal) * chartH;
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fillStyle = colors[ki % colors.length];
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      });
    });
  } else {
    // Bar chart
    chart.data.forEach((d, di) => {
      dataKeys.forEach((key, ki) => {
        const val = Number(d[key]) || 0;
        const barH = (val / maxVal) * chartH;
        const x = padding.left + di * barGroupW + (barGroupW * 0.15) + ki * barW;
        const y = padding.top + chartH - barH;
        
        ctx.fillStyle = colors[ki % colors.length];
        // Rounded top
        const r = Math.min(3, barW / 2);
        ctx.beginPath();
        ctx.moveTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.lineTo(x + barW - r, y);
        ctx.quadraticCurveTo(x + barW, y, x + barW, y + r);
        ctx.lineTo(x + barW, padding.top + chartH);
        ctx.lineTo(x, padding.top + chartH);
        ctx.closePath();
        ctx.fill();
      });
    });
  }
  
  // X labels
  ctx.fillStyle = '#475569';
  ctx.font = '10px Arial';
  ctx.textAlign = 'center';
  chart.data.forEach((d, di) => {
    const x = padding.left + di * barGroupW + barGroupW / 2;
    const label = String(d.name || '');
    // Truncate long labels
    const truncated = label.length > 12 ? label.substring(0, 11) + '…' : label;
    ctx.fillText(truncated, x, padding.top + chartH + 16);
  });
  
  // Legend
  const legendY = height - 10;
  let legendX = padding.left;
  ctx.font = '10px Arial';
  labels.forEach((label, i) => {
    ctx.fillStyle = colors[i % colors.length];
    ctx.fillRect(legendX, legendY - 8, 10, 10);
    ctx.fillStyle = '#333';
    ctx.textAlign = 'left';
    ctx.fillText(label, legendX + 14, legendY);
    legendX += ctx.measureText(label).width + 28;
  });
  
  return canvas;
};

// ======= PDF EXPORT =======
export const exportDiagnosticToPDF = (result: DiagnosticResult) => {
  const pdf = new jsPDF();
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 18;
  const maxW = pageW - 2 * margin;
  let y = margin;

  const checkPage = (needed: number) => {
    if (y + needed > pageH - margin) { pdf.addPage(); y = margin; }
  };

  // ===== TITLE PAGE =====
  // Decorative header bar
  pdf.setFillColor(51, 122, 183);
  pdf.rect(0, 0, pageW, 35, 'F');
  pdf.setFillColor(41, 98, 150);
  pdf.rect(0, 35, pageW, 3, 'F');
  
  pdf.setFontSize(22);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(255, 255, 255);
  pdf.text('DIAGNOSTIC DU SYSTÈME ÉDUCATIF', pageW / 2, 18, { align: 'center' });
  pdf.setFontSize(12);
  pdf.text('Ministère de l\'Éducation Nationale', pageW / 2, 28, { align: 'center' });
  
  pdf.setTextColor(0, 0, 0);
  y = 55;
  
  // Info box
  pdf.setDrawColor(51, 122, 183);
  pdf.setLineWidth(0.5);
  pdf.roundedRect(margin, y, maxW, 30, 3, 3, 'S');
  pdf.setFillColor(240, 247, 255);
  pdf.roundedRect(margin + 0.5, y + 0.5, maxW - 1, 29, 3, 3, 'F');
  
  pdf.setFontSize(14);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(51, 122, 183);
  pdf.text(result.drenName ? `DREN : ${result.drenName}` : 'Niveau National', pageW / 2, y + 10, { align: 'center' });
  if (result.ciscoName) {
    pdf.text(`CISCO : ${result.ciscoName}`, pageW / 2, y + 18, { align: 'center' });
  }
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(100, 100, 100);
  pdf.text(`Année scolaire : ${result.annee}  |  Généré le : ${new Date(result.generatedAt).toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`, pageW / 2, y + 26, { align: 'center' });
  
  pdf.setTextColor(0, 0, 0);
  y += 45;

  const blocks = parseForExport(result.diagnostic);

  const renderTable = (tBlock: TableBlock) => {
    const cols = tBlock.header.length;
    if (cols === 0) return;
    const colW = maxW / cols;
    const rowH = 6;

    checkPage(rowH * 2 + 4);
    y += 3;

    // Header
    pdf.setFillColor(51, 122, 183);
    pdf.rect(margin, y - 4, maxW, rowH + 2, 'F');
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(255, 255, 255);
    tBlock.header.forEach((cell, ci) => {
      pdf.text(cell.substring(0, 30), margin + ci * colW + 2, y, { maxWidth: colW - 4 });
    });
    pdf.setTextColor(0, 0, 0);
    y += rowH;

    // Rows
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7.5);
    tBlock.rows.forEach((row, ri) => {
      checkPage(rowH + 2);
      if (ri % 2 === 0) {
        pdf.setFillColor(245, 245, 250);
        pdf.rect(margin, y - 3.5, maxW, rowH, 'F');
      }
      row.forEach((cell, ci) => {
        if (ci < cols) {
          pdf.text(cell.substring(0, 35), margin + ci * colW + 2, y, { maxWidth: colW - 4 });
        }
      });
      y += rowH - 1;
    });

    // Border
    const totalRows = tBlock.rows.length + 1;
    const tableStartY = y - (tBlock.rows.length * (rowH - 1)) - rowH + 0.5;
    const tableH = totalRows * (rowH - 0.5) + 4;
    pdf.setDrawColor(100, 100, 120);
    pdf.setLineWidth(0.3);
    pdf.rect(margin, tableStartY - 1, maxW, tableH);
    for (let ci = 1; ci < cols; ci++) {
      pdf.line(margin + ci * colW, tableStartY - 1, margin + ci * colW, tableStartY - 1 + tableH);
    }
    for (let ri = 0; ri <= tBlock.rows.length; ri++) {
      const ly = tableStartY - 1 + (ri + 1) * (rowH - 0.5) + 2;
      if (ly < tableStartY - 1 + tableH) {
        pdf.line(margin, ly, margin + maxW, ly);
      }
    }
    y += 4;
  };

  const renderChartInPDF = (chart: ChartBlock) => {
    const chartCanvas = renderChartToCanvas(chart, 480, 260);
    const imgData = chartCanvas.toDataURL('image/png');
    const imgW = maxW - 10;
    const imgH = (260 / 480) * imgW;
    
    checkPage(imgH + 16);
    y += 4;
    
    // Chart title
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(51, 122, 183);
    pdf.text(chart.title, pageW / 2, y, { align: 'center' });
    pdf.setTextColor(0, 0, 0);
    y += 6;
    
    // Chart container with border
    pdf.setDrawColor(200, 210, 230);
    pdf.setLineWidth(0.3);
    pdf.roundedRect(margin + 5, y - 2, imgW, imgH + 4, 2, 2, 'S');
    
    pdf.addImage(imgData, 'PNG', margin + 5, y, imgW, imgH);
    y += imgH + 8;
  };

  for (const block of blocks) {
    if (block.type === 'heading') {
      const fontSize = block.level === 1 ? 16 : block.level === 2 ? 13 : 11;
      checkPage(fontSize + 8);
      y += block.level === 1 ? 10 : block.level === 2 ? 7 : 4;
      
      if (block.level! <= 2) {
        // Blue banner for headings
        const bannerH = fontSize / 2 + 6;
        pdf.setFillColor(51, 122, 183);
        pdf.roundedRect(margin, y - fontSize / 2 - 2, maxW, bannerH, 1.5, 1.5, 'F');
        pdf.setFontSize(fontSize);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(255, 255, 255);
        const wrapped = pdf.splitTextToSize(block.text, maxW - 8);
        for (const wl of wrapped) { checkPage(fontSize / 2 + 2); pdf.text(wl, margin + 4, y); y += fontSize / 2 + 2; }
        pdf.setTextColor(0, 0, 0);
        y += 3;
      } else {
        // Subtle left border for H3/H4
        pdf.setFillColor(51, 122, 183);
        pdf.rect(margin, y - fontSize / 2 - 1, 3, fontSize / 2 + 4, 'F');
        pdf.setFontSize(fontSize);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(30, 41, 59);
        const wrapped = pdf.splitTextToSize(block.text, maxW - 10);
        for (const wl of wrapped) { checkPage(fontSize / 2 + 2); pdf.text(wl, margin + 6, y); y += fontSize / 2 + 2; }
        pdf.setTextColor(0, 0, 0);
        y += 2;
      }
    } else if (block.type === 'list-item') {
      pdf.setFontSize(9.5);
      pdf.setFont('helvetica', 'normal');
      // Blue bullet
      pdf.setFillColor(51, 122, 183);
      checkPage(5);
      pdf.circle(margin + 6, y - 1.2, 1.2, 'F');
      const wrapped = pdf.splitTextToSize(block.text, maxW - 12);
      for (const wl of wrapped) { checkPage(5); pdf.text(wl, margin + 10, y); y += 4.5; }
    } else if (block.type === 'paragraph') {
      pdf.setFontSize(9.5);
      pdf.setFont('helvetica', 'normal');
      const wrapped = pdf.splitTextToSize(block.text, maxW);
      for (const wl of wrapped) { checkPage(5); pdf.text(wl, margin, y); y += 4.5; }
      y += 1;
    } else if (block.type === 'table') {
      renderTable(block as TableBlock);
    } else if (block.type === 'chart') {
      renderChartInPDF(block as ChartBlock);
    }
  }

  // Footer on each page
  const totalPages = pdf.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    pdf.setPage(p);
    pdf.setFontSize(7);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(150, 150, 150);
    pdf.text(`Diagnostic éducatif — ${result.drenName || 'National'} — ${result.annee}`, margin, pageH - 6);
    pdf.text(`Page ${p}/${totalPages}`, pageW - margin, pageH - 6, { align: 'right' });
    // Bottom line
    pdf.setDrawColor(51, 122, 183);
    pdf.setLineWidth(0.5);
    pdf.line(margin, pageH - 10, pageW - margin, pageH - 10);
  }

  pdf.save(`diagnostic_${result.drenName || 'national'}_${new Date().toISOString().split('T')[0]}.pdf`);
  toast.success('PDF exporté avec succès');
};

// ======= DOCX EXPORT =======
export const exportDiagnosticToDocx = async (result: DiagnosticResult) => {
  const blocks = parseForExport(result.diagnostic);
  const children: (Paragraph | Table)[] = [];

  // Title
  children.push(new Paragraph({ text: 'DIAGNOSTIC DU SYSTÈME ÉDUCATIF', heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER }));
  children.push(new Paragraph({
    children: [new TextRun({ text: 'Ministère de l\'Éducation Nationale', italics: true, size: 22, color: '337AB7' })],
    alignment: AlignmentType.CENTER,
  }));
  children.push(new Paragraph({
    children: [new TextRun({ text: result.drenName ? `DREN: ${result.drenName}${result.ciscoName ? ` — CISCO: ${result.ciscoName}` : ''}` : 'Niveau National', bold: true, size: 26 })],
    alignment: AlignmentType.CENTER,
    spacing: { before: 200 },
  }));
  children.push(new Paragraph({
    children: [new TextRun({ text: `Année scolaire: ${result.annee} | Généré le: ${new Date(result.generatedAt).toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`, size: 18, color: '666666' })],
    alignment: AlignmentType.CENTER,
    spacing: { after: 400 },
  }));

  // Separator
  children.push(new Paragraph({
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '337AB7' } },
    spacing: { after: 300 },
  }));

  const borderStyle = { style: BorderStyle.SINGLE, size: 1, color: '333333' };
  const cellBorders = { top: borderStyle, bottom: borderStyle, left: borderStyle, right: borderStyle };

  const buildDocxTable = (header: string[], rows: string[][], title?: string) => {
    if (title) {
      children.push(new Paragraph({
        children: [new TextRun({ text: `📊 ${title}`, bold: true, size: 22, color: '337AB7' })],
        spacing: { before: 200, after: 100 },
      }));
    }

    const headerRow = new TableRow({
      children: header.map(cell => new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text: cell, bold: true, size: 16, color: 'FFFFFF' })] })],
        borders: cellBorders,
        shading: { fill: '337AB7' },
      })),
      tableHeader: true,
    });
    const dataRows = rows.map((row, ri) => new TableRow({
      children: row.map(cell => new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text: cell, size: 18 })] })],
        borders: cellBorders,
        shading: ri % 2 === 0 ? { fill: 'F5F5FA' } : undefined,
      })),
    }));

    children.push(new Table({
      rows: [headerRow, ...dataRows],
      width: { size: 100, type: WidthType.PERCENTAGE },
    }));
    children.push(new Paragraph({ text: '', spacing: { after: 200 } }));
  };

  const addChartAsImage = async (chart: ChartBlock) => {
    try {
      const canvas = renderChartToCanvas(chart, 520, 280);
      const dataUrl = canvas.toDataURL('image/png');
      const base64 = dataUrl.split(',')[1];
      const byteChars = atob(base64);
      const byteArr = new Uint8Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) byteArr[i] = byteChars.charCodeAt(i);

      children.push(new Paragraph({
        children: [new TextRun({ text: chart.title, bold: true, size: 22, color: '337AB7' })],
        spacing: { before: 200, after: 100 },
        alignment: AlignmentType.CENTER,
      }));

      children.push(new Paragraph({
        children: [new ImageRun({
          data: byteArr,
          transformation: { width: 520, height: 280 },
          type: 'png',
        })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
      }));
    } catch (e) {
      // Fallback to table if image fails
      const tableVersion = chartToTable(chart);
      buildDocxTable(tableVersion.header, tableVersion.rows, chart.title);
    }
  };

  for (const block of blocks) {
    if (block.type === 'heading') {
      const level = block.level === 1 ? HeadingLevel.HEADING_1
                  : block.level === 2 ? HeadingLevel.HEADING_2
                  : HeadingLevel.HEADING_3;
      children.push(new Paragraph({ text: block.text, heading: level, spacing: { before: block.level === 1 ? 400 : 200, after: 100 } }));
    } else if (block.type === 'list-item') {
      children.push(new Paragraph({
        children: [new TextRun({ text: `• ${block.text}`, size: 20 })],
        spacing: { after: 60 },
        indent: { left: 360 },
      }));
    } else if (block.type === 'paragraph') {
      const parts = block.text.split(/(\*\*[^*]+\*\*)/g);
      const runs = parts.map(p => {
        if (p.startsWith('**') && p.endsWith('**'))
          return new TextRun({ text: p.slice(2, -2), bold: true, size: 20 });
        return new TextRun({ text: p, size: 20 });
      });
      children.push(new Paragraph({ children: runs, spacing: { after: 80 } }));
    } else if (block.type === 'table') {
      const tBlock = block as TableBlock;
      buildDocxTable(tBlock.header, tBlock.rows);
    } else if (block.type === 'chart') {
      await addChartAsImage(block as ChartBlock);
    }
  }

  const doc = new Document({ sections: [{ properties: { page: { margin: { top: 1000, right: 1000, bottom: 1000, left: 1000 } } }, children }] });
  const blob = await Packer.toBlob(doc);
  saveAs(blob, `diagnostic_${result.drenName || 'national'}_${new Date().toISOString().split('T')[0]}.docx`);
  toast.success('DOCX exporté avec succès');
};

// Helper: chart to table (fallback)
const chartToTable = (chart: ChartBlock): TableBlock => {
  if (chart.chartType === 'pie') {
    return { type: 'table', header: ['Catégorie', 'Valeur'], rows: chart.data.map(d => [d.name || '', String(d.value || 0)]) };
  }
  const keys = chart.dataKeys || Object.keys(chart.data[0] || {}).filter(k => k !== 'name');
  const labels = chart.labels || keys;
  return { type: 'table', header: ['', ...labels], rows: chart.data.map(d => [d.name || '', ...keys.map(k => String(d[k] ?? '-'))]) };
};
