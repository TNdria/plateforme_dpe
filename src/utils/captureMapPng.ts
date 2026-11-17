const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

const waitForMapAssets = async (map: HTMLElement) => {
  const tiles = Array.from(map.querySelectorAll<HTMLImageElement>("img.leaflet-tile"));
  const pendingTiles = tiles.filter((tile) => !tile.complete).map(
    (tile) => new Promise<void>((resolve) => {
      tile.addEventListener("load", () => resolve(), { once: true });
      tile.addEventListener("error", () => resolve(), { once: true });
    }),
  );

  await Promise.race([
    Promise.all([
      document.fonts?.ready ?? Promise.resolve(),
      Promise.all(pendingTiles),
    ]),
    wait(4000),
  ]);
  await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
};

const waitForLeafletToSettle = async (map: HTMLElement) => {
  const deadline = Date.now() + 1500;
  while (
    (map.classList.contains("leaflet-zoom-anim") || map.classList.contains("leaflet-pan-anim")) &&
    Date.now() < deadline
  ) {
    await wait(40);
  }
  await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
};

const canvasToBlob = (canvas: HTMLCanvasElement) =>
  new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("PNG vide"))), "image/png");
  });

/** Capture la surface Leaflet seule, attend les tuiles et télécharge un PNG net. */
export async function captureMapPng(root: HTMLElement | null, filename: string): Promise<void> {
  const map = root?.matches(".leaflet-container")
    ? root
    : root?.querySelector<HTMLElement>(".leaflet-container");
  if (!map) throw new Error("Carte introuvable pour la capture");

  await waitForMapAssets(map);
  await waitForLeafletToSettle(map);
  // clientWidth/clientHeight sont les dimensions de mise en page de Leaflet,
  // indépendantes des transformations temporaires appliquées à ses couches.
  const width = map.clientWidth;
  const height = map.clientHeight;
  if (!width || !height) throw new Error("La carte n'a pas de dimensions visibles");

  const scale = Math.min(
    2,
    4096 / width,
    4096 / height,
    Math.sqrt(16_000_000 / (width * height)),
  );
  const { default: html2canvas } = await import("html2canvas");
  const canvas = await html2canvas(map, {
    backgroundColor: "#f8fafc",
    useCORS: true,
    allowTaint: false,
    imageTimeout: 12000,
    logging: false,
    scale,
    width,
    height,
    windowWidth: document.documentElement.clientWidth || window.innerWidth,
    windowHeight: document.documentElement.clientHeight || window.innerHeight,
    scrollX: window.scrollX,
    scrollY: window.scrollY,
    foreignObjectRendering: true,
    onclone: (clonedDocument) => {
      // Supprime les transitions dans le clone sans toucher aux transforms
      // Leaflet, qui placent précisément les tuiles et les polygones.
      const style = clonedDocument.createElement("style");
      style.textContent = `
        .leaflet-container *, .leaflet-container *::before, .leaflet-container *::after {
          transition: none !important;
          animation: none !important;
        }
      `;
      clonedDocument.head.appendChild(style);
    },
    ignoreElements: (element) =>
      element.hasAttribute("data-map-capture-ignore") ||
      element.matches(".leaflet-popup-pane, .leaflet-tooltip-pane, .leaflet-control-zoom, .leaflet-control-layers"),
  });

  const blob = await canvasToBlob(canvas);
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}
