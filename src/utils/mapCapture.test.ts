import { describe, expect, it } from "vitest";
import {
  clampCapturePoint,
  flattenLeafletCaptureTransforms,
} from "./mapCapture";

describe("flattenLeafletCaptureTransforms", () => {
  it("applique la translation du panneau Leaflet sur left/top pour éviter le décalage à l’export", () => {
    const root = document.createElement("div");
    const pane = document.createElement("div");
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
    pane.style.transform = "scale(1.2)";
    root.appendChild(pane);

    flattenLeafletCaptureTransforms(root);

    expect(pane.style.transform).toBe("scale(1.2)");
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
