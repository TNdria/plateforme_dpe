import { describe, expect, it } from "vitest";
import {
  clampCapturePoint,
  flattenLeafletCaptureTransforms,
} from "./mapCapture";

describe("flattenLeafletCaptureTransforms", () => {
  it("applique la translation du panneau Leaflet sur left/top pour éviter le décalage à l’export", () => {
    const root = document.createElement("div");
    const pane = document.createElement("div");
    pane.className = "leaflet-map-pane";
    pane.style.position = "absolute";
    pane.style.left = "12px";
    pane.style.top = "34px";
    pane.style.transform = "translate3d(10px, 20px, 0px)";
    root.appendChild(pane);

    flattenLeafletCaptureTransforms(root);

    expect(pane.style.transform).toBe("none");
    expect(pane.style.left).toBe("22px");
    expect(pane.style.top).toBe("54px");
  });

  it("ignore les transformations de mise à l’échelle qui ne sont pas des translations", () => {
    const root = document.createElement("div");
    const pane = document.createElement("div");
    pane.className = "leaflet-map-pane";
    pane.style.transform = "scale(1.2)";
    root.appendChild(pane);

    flattenLeafletCaptureTransforms(root);

    expect(pane.style.transform).toBe("scale(1.2)");
  });

  it("lit la translation d'une matrice et laisse les éléments hors Leaflet intacts", () => {
    const root = document.createElement("div");
    const tile = document.createElement("div");
    tile.className = "leaflet-tile";
    tile.style.left = "0px";
    tile.style.top = "0px";
    tile.style.transform = "matrix(1, 0, 0, 1, -30, 45)";
    const other = document.createElement("div");
    other.style.transform = "translate3d(5px, 5px, 0px)";
    root.append(tile, other);

    flattenLeafletCaptureTransforms(root);

    expect(tile.style.transform).toBe("none");
    expect(tile.style.left).toBe("-30px");
    expect(tile.style.top).toBe("45px");
    expect(other.style.transform).toBe("translate3d(5px, 5px, 0px)");
  });
});

describe("clampCapturePoint", () => {
  it("laisse la sélection aller jusqu’à la bordure droite avec la légende tout en gardant le panneau gauche hors de portée", () => {
    expect(
      clampCapturePoint({ x: 1400, y: 420 }, { width: 1200, height: 800, leftInset: 260 }),
    ).toEqual({ x: 1200, y: 420 });

    expect(
      clampCapturePoint({ x: 80, y: 50 }, { width: 1200, height: 800, leftInset: 260 }),
    ).toEqual({ x: 260, y: 50 });
  });
});
