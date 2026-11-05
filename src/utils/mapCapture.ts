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

function getTransformMatrix(transform: string) {
  if (!transform || transform === "none" || typeof DOMMatrixReadOnly === "undefined") {
    return null;
  }

  try {
    return new DOMMatrixReadOnly(transform);
  } catch {
    return null;
  }
}

export function flattenLeafletCaptureTransforms(root: ParentNode | null): void {
  if (!root) return;

  const nodes = root.querySelectorAll<HTMLElement>(LEAFLET_CAPTURE_TARGETS);
  nodes.forEach((element) => {
    const transform = element.style.transform || getComputedStyle(element).transform;
    const matrix = getTransformMatrix(transform);

    if (!matrix) {
      return;
    }

    const hasTranslation = Math.abs(matrix.m41) > 1e-3 || Math.abs(matrix.m42) > 1e-3;
    if (!hasTranslation) {
      return;
    }

    const left = readNumericCssValue(element, "left") + matrix.m41;
    const top = readNumericCssValue(element, "top") + matrix.m42;

    element.style.transform = "none";
    element.style.left = `${left}px`;
    element.style.top = `${top}px`;
  });
}
