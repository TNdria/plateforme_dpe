/**
 * Ouvre une fenêtre d'impression contenant le HTML du TDB.
 * Le texte reste sélectionnable et les graphiques SVG restent vectoriels
 * (contrairement à html2canvas qui rasterise tout en image).
 *
 * Mode 'print'   : déclenche la boîte de dialogue d'impression (Enregistrer en PDF).
 * Mode 'preview' : ouvre la fenêtre sans déclencher l'impression
 *                  (l'utilisateur peut zoomer / lire / imprimer manuellement).
 */
export type HtmlPdfMode = 'print' | 'preview';

export const openHtmlPdf = (
  contentElement: HTMLElement,
  title: string,
  mode: HtmlPdfMode = 'print',
) => {
  const win = window.open('', '_blank', 'width=1200,height=900');
  if (!win) {
    alert('Veuillez autoriser les fenêtres popup pour générer le PDF.');
    return;
  }

  // Récupérer toutes les feuilles de styles de l'app pour conserver le rendu
  const headStyles = Array.from(
    document.querySelectorAll('link[rel="stylesheet"], style'),
  )
    .map((n) => n.outerHTML)
    .join('\n');

  const content = contentElement.cloneNode(true) as HTMLElement;

  // Nettoyer interactivité (boutons, inputs) pour un rendu propre
  content.querySelectorAll('button, input, [role="tab"]').forEach((el) => {
    (el as HTMLElement).style.display = (el as HTMLElement).style.display || '';
  });

  win.document.open();
  win.document.write(`<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  ${headStyles}
  <style>
    @page { size: A3 portrait; margin: 8mm; }
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    html, body { margin: 0; padding: 0; background: #fff; }
    body { font-family: Verdana, Arial, sans-serif; font-size: 10px; color: #111; }
    .recharts-responsive-container { width: 100% !important; }
    /* Cacher les overlays / tooltips éventuels */
    [data-radix-popper-content-wrapper], [role="tooltip"] { display: none !important; }
    /* Évite les coupes au milieu des cartes */
    .card, [class*="rounded"], table { page-break-inside: avoid; break-inside: avoid; }
    table { border-collapse: collapse; width: 100%; }
    td, th { border: 1px solid #555; padding: 2px 4px; font-size: 10px; }
    /* Bandeau d'actions */
    .__pdf-toolbar {
      position: fixed; top: 0; left: 0; right: 0; z-index: 9999;
      background: #1f2937; color: #fff; padding: 8px 12px;
      display: flex; gap: 8px; align-items: center; justify-content: space-between;
      font-family: system-ui, sans-serif; font-size: 13px;
    }
    .__pdf-toolbar button {
      background: #fff; color: #1f2937; border: 0; padding: 6px 12px;
      border-radius: 6px; cursor: pointer; font-weight: 600;
    }
    .__pdf-toolbar button:hover { background: #e5e7eb; }
    .__pdf-body { padding-top: 48px; }
    @media print {
      .__pdf-toolbar { display: none !important; }
      .__pdf-body { padding-top: 0; }
    }
  </style>
</head>
<body>
  <div class="__pdf-toolbar">
    <span>${title}</span>
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
        ${mode === 'print' ? 'setTimeout(function(){ window.focus(); window.print(); }, 600);' : ''}
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
