const LEAFLET_CAPTURE_TARGETS = [
  ".leaflet-map-pane",
  ".leaflet-tile",
  ".leaflet-tile-container",
  ".leaflet-marker-icon",
  ".leaflet-marker-shadow",
  ".leaflet-tooltip",
  ".leaflet-popup",
  ".leaflet-zoom-animated",
  ".leaflet-pane > svg",
  ".leaflet-pane > canvas",
  ".leaflet-control-container",
  ".leaflet-top",
  ".leaflet-bottom",
  ".leaflet-left",
  ".leaflet-right",
].join(", ");

function readNumericCssValue(element: HTMLElement, property: "left" | "top") {
  const value = element.style[property] || getComputedStyle(element)[property];
  const parsed = Number.parseFloat(value || "0");
  return Number.isFinite(parsed) ? parsed : 0;
}

// jsdom et les environnements sans DOMMatrix ne peuvent pas valider cette
// conversion : on extrait la translation de la chaîne elle-même, ce qui couvre
// les formes réellement produites par Leaflet (translate3d, translate, matrix).
const TRANSLATE_3D = /translate3d\(\s*([^,%]+?)\s*,\s*([^,%]+?)\s*,\s*[^)]*\)/;
const TRANSLATE_2D = /translate\(\s*([^,%]+?)\s*(?:,\s*([^,%]+?)\s*)?\)/;
const MATRIX_2D = /matrix\(\s*[^,]+,\s*[^,]+,\s*[^,]+,\s*[^,]+,\s*([^,]+),\s*([^)]+?)\s*\)/;

function readLength(raw: string | undefined): number | null {
  if (!raw) return null;
  const value = raw.trim();
  // Un pourcentage dépend de la taille de l'élément : l'additionner à un
  // offset en pixels inventerait une position.
  if (!value || value.endsWith("%")) return null;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function getTranslation(transform: string): { dx: number; dy: number } | null {
  if (!transform || transform === "none") return null;

  const three = TRANSLATE_3D.exec(transform);
  if (three) {
    const dx = readLength(three[1]);
    const dy = readLength(three[2]);
    return dx === null || dy === null ? null : { dx, dy };
  }

  const matrix = MATRIX_2D.exec(transform);
  if (matrix) {
    const dx = readLength(matrix[1]);
    const dy = readLength(matrix[2]);
    return dx === null || dy === null ? null : { dx, dy };
  }

  const two = TRANSLATE_2D.exec(transform);
  if (two) {
    const dx = readLength(two[1]);
    const dy = two[2] === undefined ? 0 : readLength(two[2]);
    return dx === null || dy === null ? null : { dx, dy };
  }

  return null;
}

export function clampCapturePoint(
  point: { x: number; y: number },
  bounds: { width: number; height: number; leftInset?: number },
): { x: number; y: number } {
  const leftInset = Math.max(0, bounds.leftInset ?? 0);
  const maxX = Math.max(leftInset, bounds.width);
  const maxY = Math.max(0, bounds.height);

  return {
    x: Math.min(Math.max(point.x, leftInset), maxX),
    y: Math.min(Math.max(point.y, 0), maxY),
  };
}

export function flattenLeafletCaptureTransforms(root: ParentNode | null): void {
  if (!root) return;

  const nodes = root.querySelectorAll<HTMLElement>(LEAFLET_CAPTURE_TARGETS);
  nodes.forEach((element) => {
    const transform = element.style.transform || getComputedStyle(element).transform;
    const translation = getTranslation(transform);

    if (!translation) {
      return;
    }

    const { dx, dy } = translation;
    const hasTranslation = Math.abs(dx) > 1e-3 || Math.abs(dy) > 1e-3;
    if (!hasTranslation) {
      return;
    }

    const left = readNumericCssValue(element, "left") + dx;
    const top = readNumericCssValue(element, "top") + dy;

    element.style.transform = "none";
    element.style.left = `${left}px`;
    element.style.top = `${top}px`;
  });
}
