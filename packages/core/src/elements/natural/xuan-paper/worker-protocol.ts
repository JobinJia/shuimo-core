import type { TileRegion, XuanPaperOptions } from "./types";

export type { TileRegion } from "./types";

export interface XuanPaperWorkerRequest {
  id: number;
  options: XuanPaperOptions;
  tile?: TileRegion;
}

export type XuanPaperWorkerResponse = { id: number; blob: Blob } | { id: number; error: string };
