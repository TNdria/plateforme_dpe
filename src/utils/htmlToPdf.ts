/**
 * Ouvre une fenêtre d'impression contenant le HTML exact du TDB.
 * - Format A3 portrait (297 × 420 mm)
 * - Texte 100 % sélectionnable
 * - SVG (Recharts) restent vectoriels (pas d'aplatissement html2canvas)
 * - Aucune feuille de style supplémentaire n'altère l'apparence : le rendu
 *   imprimé est strictement identique au visuel à l'écran (mêmes bordures,
 *   mêmes polices, mêmes couleurs, mêmes tailles que celles définies inline).
 *
 * Mode 'print'   : déclenche la boîte d'impression (« Enregistrer en PDF »).
 * Mode 'preview' : ouvre la fenêtre sans imprimer (l'utilisateur lit/zoom).
 */
export type HtmlPdfMode = 'print' | 'preview';

// Largeur visuelle A3 portrait à 96 dpi (≈ 297 mm) / hauteur ≈ 420 mm.
const A3_PORTRAIT_WIDTH_PX = 1191;
const A3_PORTRAIT_HEIGHT_PX = 1684;
// Marge interne A3 (≈ 6 mm)
const A3_MARGIN_MM = 6;
const A3_USABLE_HEIGHT_PX = A3_PORTRAIT_HEIGHT_PX - Math.round((A3_MARGIN_MM * 2) * 96 / 25.4);

export const openHtmlPdf = (
  contentElement: HTMLElement,
  title: string,
  mode: HtmlPdfMode = 'print',
) => {
  const win = window.open('', '_blank', 'width=1240,height=900');
  if (!win) {
    alert('Veuillez autoriser les fenêtres popup pour générer le PDF.');
    return;
  }

  // Reprend toutes les CSS du projet (Tailwind, shadcn, etc.) pour que les
  // classes utilisées dans le TDB conservent leur rendu d'origine.
  const headStyles = Array.from(
    document.querySelectorAll('link[rel="stylesheet"], style'),
  )
    .map((n) => n.outerHTML)
    .join('\n');

  const content = contentElement.cloneNode(true) as HTMLElement;

  // Inline les dimensions actuelles des SVG Recharts pour qu'ils ne
  // « s'effondrent » pas dans la fenêtre d'impression.
  const srcSvgs = contentElement.querySelectorAll('svg');
  const cloneSvgs = content.querySelectorAll('svg');
  srcSvgs.forEach((svg, i) => {
    const target = cloneSvgs[i] as SVGElement | undefined;
    if (!target) return;
    const r = svg.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) {
      target.setAttribute('width', String(Math.round(r.width)));
      target.setAttribute('height', String(Math.round(r.height)));
    }
  });

  win.document.open();
  win.document.write(`<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  ${headStyles}
  <style>
    /* A3 portrait, marges minimales pour coller à la maquette */
    @page { size: A3 portrait; margin: 6mm; }
    html, body { margin: 0; padding: 0; background: #fff; }
    /* Force la restitution exacte des couleurs (fonds bleus, jaunes, rouges, etc.) */
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    /* Conteneur à la largeur exacte d'une A3 portrait : ce que l'on voit à
       l'écran est ce qui sera imprimé, sans aucune transformation. */
    .__pdf-body {
      width: ${A3_PORTRAIT_WIDTH_PX}px;
      margin: 0 auto;
      padding-top: 44px;
      min-height: ${A3_USABLE_HEIGHT_PX}px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      gap: 10px;
    }
    .__pdf-body > * { width: 100% !important; max-width: 100% !important; }
    /* Permet aux blocs de s'étirer verticalement pour remplir la page A3 */
    .__pdf-body > * { flex: 0 0 auto; }
    /* Évite les coupes au milieu d'une carte / d'un tableau */
    .card, [class*="rounded"], table, .recharts-wrapper { page-break-inside: avoid; break-inside: avoid; }
    .recharts-responsive-container, .recharts-wrapper, .recharts-surface {
      width: 100% !important; overflow: visible !important;
    }
    /* Tooltips Radix éventuels */
    [data-radix-popper-content-wrapper], [role="tooltip"] { display: none !important; }

    /* Barre d'actions (cachée à l'impression) */
    .__pdf-toolbar {
      position: fixed; top: 0; left: 0; right: 0; z-index: 9999;
      background: #1f2937; color: #fff; padding: 8px 12px;
      display: flex; gap: 8px; align-items: center; justify-content: space-between;
      font-family: system-ui, -apple-system, sans-serif; font-size: 13px;
    }
    .__pdf-toolbar button {
      background: #fff; color: #1f2937; border: 0; padding: 6px 12px;
      border-radius: 6px; cursor: pointer; font-weight: 600;
    }
    .__pdf-toolbar button:hover { background: #e5e7eb; }
    @media print {
      @page { size: A3 portrait; margin: ${A3_MARGIN_MM}mm; }
      .__pdf-toolbar { display: none !important; }
      .__pdf-body {
        padding-top: 0;
        width: 100%;
        min-height: calc(100vh - ${A3_MARGIN_MM * 2}mm);
      }
    }
  </style>
</head>
<body>
  <div class="__pdf-toolbar">
    <span>${title} — A3 portrait</span>
    <span>
      <button onclick="window.print()">Imprimer / Enregistrer en PDF</button>
      <button onclick="window.close()">Fermer</button>
    </span>
  </div>
  <div class="__pdf-body">
    ${content.outerHTML}
  </div>
  <script>
    (function () {
      function ready() {
        ${mode === 'print' ? 'setTimeout(function(){ window.focus(); window.print(); }, 700);' : ''}
      }
      var imgs = document.querySelectorAll('img');
      if (imgs.length === 0) { ready(); return; }
      var loaded = 0;
      function tick(){ loaded++; if (loaded >= imgs.length) ready(); }
      imgs.forEach(function(img){
        if (img.complete) tick();
        else { img.onload = tick; img.onerror = tick; }
      });
    })();
  </script>
</body>
</html>`);
  win.document.close();
};
