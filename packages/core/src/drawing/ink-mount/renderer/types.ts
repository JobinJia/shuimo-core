import type { Vector2 } from "../../../foundation/geometry/Vector2";
import type { CunFaStroke, InkFill, MistRegion, MountainLayer } from "../types";

export type RenderOutput =
  | { type: "canvas"; canvas: HTMLCanvasElement | OffscreenCanvas }
  | { type: "imagebitmap"; bitmap: ImageBitmap };

export interface RenderBackend {
  clear(): void;
  drawMountainFill(layer: MountainLayer, ink: InkFill): void;
  drawCunFaStrokes(strokes: CunFaStroke[]): void;
  drawMist(regions: MistRegion[]): void;
  drawRidgeLine(points: Vector2[], opacity: number, lineWidth: number): void;
  toOutput(): RenderOutput;
}
