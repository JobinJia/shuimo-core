import type { XuanPaperOptions } from "./types";

export interface XuanPaperWorkerRequest {
  id: number;
  options: XuanPaperOptions;
}

export type XuanPaperWorkerResponse = { id: number; blob: Blob } | { id: number; error: string };
