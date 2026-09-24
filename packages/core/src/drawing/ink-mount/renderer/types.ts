import type { CunFaStroke, InkFill, MistRegion, MountainLayer } from "../types";

export type RenderOutput =
  | { type: "canvas"; canvas: HTMLCanvasElement | OffscreenCanvas }
  | { type: "imagebitmap"; bitmap: ImageBitmap };

export interface RenderBackend {
  /** Clear the output. Backends drawing into a caller's context leave it untouched. */
  clear(): void;
  /**
   * Draw one mountain layer: form-following wash, cunfa texture, soft
   * silhouette mask, contour stroke and depth blur, composited as a unit.
   */
  drawMountainLayer(layer: MountainLayer, ink: InkFill, strokes: CunFaStroke[]): void;
  drawMist(regions: MistRegion[]): void;
  toOutput(): RenderOutput;
}
