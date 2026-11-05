import { describe, expect, it } from "vitest";
import { flattenLeafletCaptureTransforms } from "./mapCapture";

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
