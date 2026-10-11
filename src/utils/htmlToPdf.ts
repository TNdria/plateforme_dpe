/**
 * Export PDF des TDB via l'impression native du navigateur.
 * - Texte 100 % natif : sélectionnable, copiable, recherchable (Ctrl+F)
 * - Graphiques Recharts conservés en SVG vectoriel
 * - Formats A4 / A3, portrait / paysage, choisis dans la barre d'outils
 * - Le contenu occupe toute la largeur utile (marges réduites à 5 mm)
 * - Une page par défaut, avec redistribution sur toute la largeur utile
 *
 * La mise à l'échelle utilise CSS `zoom` (et non `transform`) : le contenu
 * garde une vraie taille de mise en page, donc la pagination, les sauts de
 * page et la répétition des en-têtes de tableaux fonctionnent.
 */
export type HtmlPdfMode = 'print' | 'preview';

const MARGIN_MM = 5;

export const openHtmlPdf = (
  contentElement: HTMLElement,
  title: string,
  mode: HtmlPdfMode = 'print',
) => {
  const win = window.open('', '_blank', 'width=1400,height=900');
  if (!win) {
    alert('Veuillez autoriser les fenêtres popup pour générer le PDF.');
    return;
  }

  const headStyles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
    .map((n) => n.outerHTML)
    .join('\n');

  const content = contentElement.cloneNode(true) as HTMLElement;

  // Fige la taille des SVG pour qu'ils ne s'effondrent pas hors de l'écran.
  const srcSvgs = contentElement.querySelectorAll('svg');
  const cloneSvgs = content.querySelectorAll('svg');
  srcSvgs.forEach((svg, i) => {
    const target = cloneSvgs[i] as SVGElement | undefined;
    if (!target) return;
    const r = svg.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) {
      target.setAttribute('width', String(Math.round(r.width)));
      target.setAttribute('height', String(Math.round(r.height)));
      if (!target.getAttribute('viewBox')) {
        target.setAttribute('viewBox', `0 0 ${Math.round(r.width)} ${Math.round(r.height)}`);
      }
    }
  });

  // Largeur réelle du TDB à l'écran = largeur de mise en page de référence.
  const contentWidth = Math.round(contentElement.scrollWidth || contentElement.getBoundingClientRect().width) || 1191;

  win.document.open();
  win.document.write(`<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  ${headStyles}
  <style id="__page-style">@page { size: A3 portrait; margin: ${MARGIN_MM}mm; }</style>
  <style>
    html, body { margin: 0; padding: 0; background: #e5e7eb; }
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    .__pdf-body, .__pdf-body * { box-shadow: none !important; filter: none !important; }

    .__pdf-stage { margin: 56px auto 24px; background: #fff; overflow: hidden; }
     .__pdf-body { width: ${contentWidth}px; background: #fff; display: flow-root; }
    .__pdf-body > * { width: 100% !important; max-width: 100% !important; margin-left: 0 !important; margin-right: 0 !important; }
    .__pdf-body [class*="max-w-"], .__pdf-body .mx-auto { max-width: none !important; }

    /* Pagination */
    .__pdf-body table { border-collapse: collapse; }
    .__pdf-body thead { display: table-header-group; }
    .__pdf-body tfoot { display: table-footer-group; }
    .__pdf-body tr, .__pdf-body img, .__pdf-body svg,
    .__pdf-body .recharts-wrapper, .__pdf-body .recharts-responsive-container { break-inside: avoid; page-break-inside: avoid; }
    .__pdf-body h1, .__pdf-body h2, .__pdf-body h3, .__pdf-body h4 { break-after: avoid; page-break-after: avoid; }
    .__pdf-body td, .__pdf-body th { overflow-wrap: anywhere; }
    .recharts-responsive-container, .recharts-wrapper, .recharts-surface { overflow: visible !important; }
    [data-radix-popper-content-wrapper], [role="tooltip"] { display: none !important; }

    .__pdf-toolbar {
      position: fixed; top: 0; left: 0; right: 0; z-index: 9999;
      background: #1f2937; color: #fff; padding: 8px 12px;
      display: flex; gap: 12px; align-items: center; justify-content: space-between; flex-wrap: wrap;
      font-family: system-ui, -apple-system, sans-serif; font-size: 13px;
    }
    .__pdf-toolbar label { display: inline-flex; gap: 6px; align-items: center; }
    .__pdf-toolbar select { padding: 4px 6px; border-radius: 6px; border: 0; color: #111827; }
    .__pdf-toolbar button {
      background: #fff; color: #1f2937; border: 0; padding: 6px 12px;
      border-radius: 6px; cursor: pointer; font-weight: 600;
    }
    .__pdf-toolbar button.primary { background: #2563eb; color: #fff; }
    @media print {
      html, body { background: #fff; }
      .__pdf-toolbar { display: none !important; }
       .__pdf-stage { margin: 0 !important; overflow: visible !important; }
       .__pdf-stage[data-one="true"] { break-inside: avoid; page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="__pdf-toolbar">
    <strong>${title}</strong>
    <span style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">
      <label>Format
        <select id="__fmt"><option value="A4">A4</option><option value="A3">A3</option></select>
      </label>
      <label>Orientation
        <select id="__ori"><option value="portrait">Portrait</option><option value="landscape">Paysage</option></select>
      </label>
      <label><input type="checkbox" id="__one"> Tenir sur une page</label>
      <span id="__info" style="opacity:.75"></span>
      <button class="primary" onclick="window.print()">Enregistrer en PDF</button>
      <button onclick="window.close()">Fermer</button>
    </span>
  </div>
  <div class="__pdf-stage"><div class="__pdf-body">${content.outerHTML}</div></div>
  <script>
    (function () {
      var SIZES = { A4: [210, 297], A3: [297, 420] };
      var MARGIN = ${MARGIN_MM};
      var MM = 96 / 25.4;
      var BASE_W = ${contentWidth};
      var fmt = document.getElementById('__fmt');
      var ori = document.getElementById('__ori');
      var one = document.getElementById('__one');
      var info = document.getElementById('__info');
      try {
        var saved = JSON.parse(localStorage.getItem('tdb_pdf_opts') || '{}');
        fmt.value = saved.fmt || 'A3';
        ori.value = saved.ori || 'portrait';
         one.checked = true;
      } catch (e) { fmt.value = 'A3'; ori.value = 'portrait'; one.checked = true; }

      function fit() {
        var s = SIZES[fmt.value] || SIZES.A3;
        var wMm = ori.value === 'landscape' ? s[1] : s[0];
        var hMm = ori.value === 'landscape' ? s[0] : s[1];
        document.getElementById('__page-style').textContent =
          '@page { size: ' + fmt.value + ' ' + ori.value + '; margin: ' + MARGIN + 'mm; }';
        var pageW = Math.floor((wMm - MARGIN * 2) * MM);
        var pageH = Math.floor((hMm - MARGIN * 2) * MM);
        var body = document.querySelector('.__pdf-body');
        var stage = document.querySelector('.__pdf-stage');
        body.style.zoom = 1;
         body.style.width = BASE_W + 'px';
        var natH = body.scrollHeight || 1;
         var z = pageW / BASE_W;
         if (one.checked) {
           // Réduit la hauteur sans laisser une bande vide à droite : la largeur
           // de mise en page augmente avant le zoom, les tableaux se redistribuent.
           var safeH = pageH - 2;
           z = Math.min(z, safeH / natH);
           for (var i = 0; i < 12; i++) {
             body.style.width = (pageW / z) + 'px';
             natH = body.scrollHeight || 1;
             if (natH * z <= safeH) break;
             z = Math.min(z, safeH / natH);
           }
           body.style.width = (pageW / z) + 'px';
           natH = body.scrollHeight || 1;
         }
        body.style.zoom = z;
         if (one.checked) {
           // Le rendu final peut dépasser scrollHeight (arrondis CSS / SVG).
           // Contrôle la hauteur réellement imprimée, pas une estimation.
           for (var j = 0; j < 12; j++) {
             var renderedH = body.getBoundingClientRect().height;
             if (renderedH <= pageH - 2) break;
             z *= (pageH - 3) / renderedH;
             body.style.width = (pageW / z) + 'px';
             body.style.zoom = z;
           }
         }
        stage.style.width = pageW + 'px';
         stage.dataset.one = String(one.checked);
        var pages = Math.max(1, Math.ceil((natH * z) / pageH - 0.01));
         stage.style.height = one.checked ? (pageH - 1) + 'px' : 'auto';
        info.textContent = fmt.value + ' ' + (ori.value === 'landscape' ? 'paysage' : 'portrait') +
          ' · ' + (one.checked ? '1 page' : pages + ' page(s)') + ' · échelle ' + Math.round(z * 100) + '%';
        try { localStorage.setItem('tdb_pdf_opts', JSON.stringify({ fmt: fmt.value, ori: ori.value, one: one.checked })); } catch (e) {}
      }
      fmt.onchange = ori.onchange = one.onchange = fit;
      window.addEventListener('beforeprint', fit);

      function ready() {
        fit();
        setTimeout(fit, 400);
        ${mode === 'print' ? "setTimeout(function(){ window.focus(); window.print(); }, 900);" : ''}
      }
      var imgs = document.querySelectorAll('img');
      if (imgs.length === 0) { setTimeout(ready, 300); return; }
      var loaded = 0;
      function tick(){ loaded++; if (loaded >= imgs.length) setTimeout(ready, 300); }
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
