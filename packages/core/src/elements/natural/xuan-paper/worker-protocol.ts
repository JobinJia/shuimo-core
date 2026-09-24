import type { TileRegion, XuanPaperOptions, XuanPaperScene } from "./types";

export type { TileRegion } from "./types";

/**
 * Render request. Pass either `scene` (built once on the main thread with
 * `buildXuanPaperScene` and shared by every tile worker, so N workers do not
 * each rebuild it) or `options` (the worker builds the scene itself).
 * `tile` renders only that region of the sheet.
 */
export interface XuanPaperWorkerRequest {
  id: number;
  options?: XuanPaperOptions;
  scene?: XuanPaperScene;
  tile?: TileRegion;
}

/**
 * `bitmap` is transferred (zero-copy); draw it with `drawImage` at the tile
 * origin, or use `transferFromImageBitmap` on a bitmaprenderer context.
 */
export type XuanPaperWorkerResponse =
  | { id: number; bitmap: ImageBitmap; tile?: TileRegion }
  | { id: number; error: string };
