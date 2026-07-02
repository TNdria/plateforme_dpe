/**
 * Ouvre une fenêtre d'impression contenant le HTML exact du TDB.
 * - Format A3 PAYSAGE (420 × 297 mm)
 * - Texte 100 % sélectionnable, SVG Recharts vectoriels (pas d'aplatissement)
 * - Aucun effet d'« aperçu papier » (pas d'ombre, pas de bordure de feuille)
 * - Le contenu occupe toute la surface utile de la page (pas de grandes marges)
 *
 * Mode 'print'   : déclenche directement la boîte d'impression du navigateur
 *                  (= « Enregistrer en PDF »). C'est la SEULE façon d'obtenir
 *                  un PDF dont le texte reste sélectionnable.
 * Mode 'preview' : ouvre la fenêtre sans imprimer.
 */
export type HtmlPdfMode = 'print' | 'preview';

// A3 paysage à 96 dpi
const A3_LANDSCAPE_WIDTH_PX = 1684;  // ≈ 420 mm
const A3_LANDSCAPE_HEIGHT_PX = 1191; // ≈ 297 mm
const A3_MARGIN_MM = 4; // marges minimales pour maximiser la surface utile

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

  // Reprend toutes les CSS du projet pour conserver le rendu exact.
  const headStyles = Array.from(
    document.querySelectorAll('link[rel="stylesheet"], style'),
  )
    .map((n) => n.outerHTML)
    .join('\n');

  const content = contentElement.cloneNode(true) as HTMLElement;

  // Verrouille la taille actuelle des SVG Recharts pour éviter qu'ils ne
  // s'effondrent dans la fenêtre d'impression.
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

  // Le TDB est conçu à 1191 px (largeur d'écran A3 portrait). En paysage
  // la largeur utile est 1684 px → on applique un scale uniforme pour que le
  // contenu remplisse toute la largeur de la page A3 paysage, sans
  // distorsion et SANS perdre la sélection du texte (transform CSS).
  const scale = A3_LANDSCAPE_WIDTH_PX / 1191;

  win.document.open();
  win.document.write(`<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  ${headStyles}
  <style>
    @page { size: A3 landscape; margin: ${A3_MARGIN_MM}mm; }
    html, body {
      margin: 0; padding: 0; background: #fff;
      width: 100%;
    }
    /* Couleurs restituées fidèlement à l'impression */
    * {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    /* Supprime tous les effets d'« aperçu papier » : ombres, bordures
       simulant une feuille, conteneurs arrondis du shell, etc. */
    .__pdf-body, .__pdf-body * {
      box-shadow: none !important;
      filter: none !important;
    }

    /* Wrapper : largeur exacte A3 paysage en px */
    .__pdf-stage {
      width: ${A3_LANDSCAPE_WIDTH_PX}px;
      margin: 0 auto;
      padding-top: 44px; /* place pour la barre d'outils à l'écran */
      background: #fff;
    }
    @media print { .__pdf-stage { padding-top: 0; } }

    /* Contenu original 1191 px mis à l'échelle pour remplir 1684 px */
    .__pdf-body {
      width: 1191px;
      transform: scale(${scale});
      transform-origin: top left;
      background: #fff;
    }
    /* Réserve la place réellement occupée après scaling */
    .__pdf-scaler {
      width: ${A3_LANDSCAPE_WIDTH_PX}px;
      /* la hauteur est ajustée en JS après mise en page */
    }
    .__pdf-body > * { width: 100% !important; max-width: 100% !important; }

    /* Évite les coupes au milieu d'un bloc */
    .card, [class*="rounded"], table, .recharts-wrapper,
    .recharts-responsive-container, .recharts-surface {
      page-break-inside: avoid; break-inside: avoid;
    }
    .recharts-responsive-container, .recharts-wrapper, .recharts-surface {
      overflow: visible !important;
    }
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
    @media print { .__pdf-toolbar { display: none !important; } }
  </style>
</head>
<body>
  <div class="__pdf-toolbar">
    <span>${title} — A3 paysage · Texte sélectionnable</span>
    <span>
      <button onclick="window.print()">Enregistrer en PDF</button>
      <button onclick="window.close()">Fermer</button>
    </span>
  </div>
  <div class="__pdf-stage">
    <div class="__pdf-scaler">
      <div class="__pdf-body">
        ${content.outerHTML}
      </div>
    </div>
  </div>
  <script>
    (function () {
      function adjustScalerHeight() {
        var body = document.querySelector('.__pdf-body');
        var scaler = document.querySelector('.__pdf-scaler');
        if (body && scaler) {
          // Hauteur réelle après scaling
          scaler.style.height = (body.getBoundingClientRect().height) + 'px';
        }
      }
      function ready() {
        adjustScalerHeight();
        ${mode === 'print' ? "setTimeout(function(){ window.focus(); window.print(); }, 600);" : ''}
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
