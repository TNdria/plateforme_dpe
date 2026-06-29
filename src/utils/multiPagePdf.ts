import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

/**
 * Generates a multi-page A3 portrait PDF that faithfully reproduces the on-screen
 * dashboard visualization. Each section is captured at very high DPI on a fixed
 * virtual viewport (matching the on-screen A3 width of 1191px) so colors, charts,
 * tables and gradients render exactly as the user sees them — but sharper.
 *
 * Key quality choices:
 * - scale 3 (≈ 300 DPI on A3) for crisp text and chart strokes.
 * - foreignObjectRendering=false → more reliable cross-browser SVG capture.
 * - Recharts SVGs are pre-sized so they never collapse during off-screen capture.
 * - Slices preserve a small overlap-free top margin so cut elements never appear blurry.
 */
export const generateMultiPagePdf = async (
  sections: HTMLElement[],
  fileName: string,
  options?: {
    orientation?: 'portrait' | 'landscape';
    format?: 'a3' | 'a4';
    scale?: number;
    windowWidth?: number;
    addLogos?: boolean;
    title?: string;
    subtitle?: string;
    onProgress?: (current: number, total: number) => void;
    /** When true, return the PDF as a Blob URL instead of triggering a download. */
    returnBlobUrl?: boolean;
  }
): Promise<string | void> => {
  const {
    orientation = 'portrait',
    format = 'a3',
    scale = 3,
    windowWidth = 1191, // matches the on-screen TDB max-width
    title,
    subtitle,
    onProgress,
    returnBlobUrl = false,
  } = options || {};

  const pdf = new jsPDF({ orientation, unit: 'mm', format });
  const pageW = orientation === 'portrait' ? (format === 'a3' ? 297 : 210) : (format === 'a3' ? 420 : 297);
  const pageH = orientation === 'portrait' ? (format === 'a3' ? 420 : 297) : (format === 'a3' ? 297 : 210);
  const margin = 8;
  const headerH = title ? 10 : 0;
  const footerH = 7;
  const usableW = pageW - margin * 2;
  const usableH = pageH - margin * 2 - footerH - headerH;
  const contentTop = margin + headerH;

  // First pass: compute total pages so the footer can show "Page X / Y"
  // We render sequentially and count slices.
  const renderedPages: {
    imgData: string;
    imgW: number;
    imgH: number;
    x: number;
    y: number;
    sectionIndex: number;
  }[] = [];

  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    if (!section) continue;

    onProgress?.(i + 1, sections.length);

    // Force the section to be visible & laid out at the canonical A3 width
    // so off-screen tabs render correctly.
    const orig = {
      display: section.style.display,
      visibility: section.style.visibility,
      height: section.style.height,
      overflow: section.style.overflow,
      width: section.style.width,
      maxWidth: section.style.maxWidth,
      position: section.style.position,
      left: section.style.left,
    };
    section.style.display = 'block';
    section.style.visibility = 'visible';
    section.style.height = 'auto';
    section.style.overflow = 'visible';
    section.style.width = `${windowWidth}px`;
    section.style.maxWidth = `${windowWidth}px`;

    // Walk up ancestors and force any hidden/collapsed parent (e.g. inactive
    // Radix TabsContent with `data-[state=inactive]:hidden`) to render so
    // html2canvas captures actual content instead of an empty box.
    const ancestorRestore: Array<() => void> = [];
    let parent: HTMLElement | null = section.parentElement;
    while (parent && parent !== document.body) {
      const cs = window.getComputedStyle(parent);
      if (cs.display === 'none' || cs.visibility === 'hidden') {
        const oDisp = parent.style.display;
        const oVis = parent.style.visibility;
        parent.style.display = 'block';
        parent.style.visibility = 'visible';
        const captured = parent;
        ancestorRestore.push(() => {
          captured.style.display = oDisp;
          captured.style.visibility = oVis;
        });
      }
      parent = parent.parentElement;
    }

    // Lock recharts SVGs to their current rendered size to prevent collapsing
    // during the capture (a common source of "ugly PDF" issues).
    const svgs = section.querySelectorAll('svg');
    const svgRestore: Array<() => void> = [];
    svgs.forEach((svg) => {
      const rect = svg.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        const oW = svg.getAttribute('width');
        const oH = svg.getAttribute('height');
        svg.setAttribute('width', String(rect.width));
        svg.setAttribute('height', String(rect.height));
        svgRestore.push(() => {
          if (oW === null) svg.removeAttribute('width'); else svg.setAttribute('width', oW);
          if (oH === null) svg.removeAttribute('height'); else svg.setAttribute('height', oH);
        });
      }
    });

    // Wait for layout / charts / fonts to settle
    if ((document as any).fonts?.ready) {
      try { await (document as any).fonts.ready; } catch {}
    }
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
    await new Promise((resolve) => setTimeout(resolve, 450));

    const canvas = await html2canvas(section, {
      scale,
      useCORS: true,
      allowTaint: true,
      logging: false,
      backgroundColor: '#ffffff',
      windowWidth,
      windowHeight: Math.max(section.scrollHeight, section.offsetHeight),
      imageTimeout: 0,
      foreignObjectRendering: false,
      removeContainer: true,
      onclone: (clonedDoc) => {
        // Force a clean white background and ensure print-color-adjust on the clone
        const root = clonedDoc.documentElement;
        root.style.background = '#ffffff';
        const style = clonedDoc.createElement('style');
        style.textContent = `
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .recharts-wrapper, .recharts-surface { overflow: visible !important; }
        `;
        clonedDoc.head.appendChild(style);
      },
    });

    // Restore section styles
    section.style.display = orig.display;
    section.style.visibility = orig.visibility;
    section.style.height = orig.height;
    section.style.overflow = orig.overflow;
    section.style.width = orig.width;
    section.style.maxWidth = orig.maxWidth;
    section.style.position = orig.position;
    section.style.left = orig.left;
    svgRestore.forEach((fn) => fn());
    ancestorRestore.forEach((fn) => fn());

    // Fit uniformly inside the A3 usable area, then upscale to fill the page
    // vertically (so each A3 page is well filled top→bottom, left→right).
    const widthRatio = usableW / canvas.width;
    const heightRatio = usableH / canvas.height;
    const fitRatio = Math.min(widthRatio, heightRatio);
    const fullImgHmm = canvas.height * widthRatio;

    if (fullImgHmm <= usableH) {
      // Content shorter than a page → scale up to fill the A3 page entirely
      const finalW = canvas.width * fitRatio;
      const finalH = canvas.height * fitRatio;
      const imgData = canvas.toDataURL('image/png');
      renderedPages.push({
        imgData,
        imgW: finalW,
        imgH: finalH,
        x: margin + (usableW - finalW) / 2,
        y: contentTop + (usableH - finalH) / 2,
        sectionIndex: i,
      });
    } else {
      // Slice the tall canvas into A3-page-sized chunks (preserving sharpness)
      const sliceHpx = Math.floor(usableH / widthRatio);
      let yPx = 0;
      while (yPx < canvas.height) {
        const remaining = canvas.height - yPx;
        const thisSliceHpx = Math.min(sliceHpx, remaining);
        const sliceCanvas = document.createElement('canvas');
        sliceCanvas.width = canvas.width;
        sliceCanvas.height = thisSliceHpx;
        const ctx = sliceCanvas.getContext('2d');
        if (!ctx) break;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
        ctx.drawImage(canvas, 0, yPx, canvas.width, thisSliceHpx, 0, 0, canvas.width, thisSliceHpx);
        const sliceData = sliceCanvas.toDataURL('image/png');
        renderedPages.push({
          imgData: sliceData,
          imgW: usableW,
          imgH: thisSliceHpx * widthRatio,
          x: margin,
          y: contentTop,
          sectionIndex: i,
        });
        yPx += thisSliceHpx;
      }
    }
  }

  const totalPages = renderedPages.length;
  if (totalPages === 0) {
    throw new Error('Aucune page générée');
  }

  renderedPages.forEach((pg, idx) => {
    if (idx > 0) pdf.addPage();
    pdf.setFillColor(255, 255, 255);
    pdf.rect(0, 0, pageW, pageH, 'F');

    // Optional document header band
    if (title) {
      pdf.setFillColor(51, 122, 183);
      pdf.rect(0, 0, pageW, headerH, 'F');
      pdf.setTextColor(255, 255, 255);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(11);
      pdf.text(title, margin, headerH - 3.5);
      if (subtitle) {
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(9);
        pdf.text(subtitle, pageW - margin, headerH - 3.5, { align: 'right' });
      }
      pdf.setTextColor(0, 0, 0);
    }

    // Subtle content frame for a "printed report" feel
    pdf.setDrawColor(220, 226, 235);
    pdf.setLineWidth(0.25);
    pdf.rect(margin - 1.2, pg.y - 1.2, usableW + 2.4, pg.imgH + 2.4);

    // Use 'SLOW' compression — outputs sharp PNGs (no blur)
    pdf.addImage(pg.imgData, 'PNG', pg.x, pg.y, pg.imgW, pg.imgH, undefined, 'SLOW');

    // Footer
    pdf.setDrawColor(220, 226, 235);
    pdf.setLineWidth(0.2);
    pdf.line(margin, pageH - footerH + 1, pageW - margin, pageH - footerH + 1);
    pdf.setFontSize(8);
    pdf.setTextColor(120, 120, 120);
    pdf.setFont('helvetica', 'normal');
    const dateStr = new Date().toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' });
    pdf.text(`Généré le ${dateStr}`, margin, pageH - 2.5);
    pdf.text(`Page ${idx + 1} / ${totalPages}`, pageW / 2, pageH - 2.5, { align: 'center' });
    pdf.text('DPE — Tableau de Bord', pageW - margin, pageH - 2.5, { align: 'right' });
    pdf.setTextColor(0, 0, 0);
  });

  if (returnBlobUrl) {
    const blob = pdf.output('blob');
    return URL.createObjectURL(blob);
  }
  pdf.save(fileName);
};