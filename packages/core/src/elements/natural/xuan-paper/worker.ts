// Runs inside a dedicated Worker. Message protocol:
//   in:  XuanPaperWorkerRequest (optional `tile` field for tiled rendering)
//   out: XuanPaperWorkerResponse
import { renderXuanPaperTileToCanvas, renderXuanPaperToCanvas } from "./canvas-renderer";
import { buildXuanPaperScene } from "./model";
import { ready as wasmReady } from "./paper-tone-wasm";
import { DEFAULT_BASE_COLOR } from "./presets";
import type { XuanPaperWorkerRequest, XuanPaperWorkerResponse } from "./worker-protocol";

export type { XuanPaperWorkerRequest, XuanPaperWorkerResponse } from "./worker-protocol";

interface WorkerScope {
  onmessage: ((event: MessageEvent<XuanPaperWorkerRequest>) => void) | null;
  postMessage: (data: XuanPaperWorkerResponse) => void;
}

const workerScope = self as unknown as WorkerScope;

workerScope.onmessage = async (event: MessageEvent<XuanPaperWorkerRequest>) => {
  const { id, options, tile } = event.data;
  try {
    const t0 = performance.now();
    await wasmReady;
    const t1 = performance.now();
    const scene = buildXuanPaperScene({
      ...options,
      baseColor: options.baseColor ?? DEFAULT_BASE_COLOR,
      mode: "canvas",
    });
    const t2 = performance.now();

    let canvas: OffscreenCanvas;
    if (tile) {
      canvas = new OffscreenCanvas(tile.width, tile.height);
      renderXuanPaperTileToCanvas(canvas, scene, tile);
    } else {
      const width = options.width ?? 512;
      const height = options.height ?? 512;
      canvas = new OffscreenCanvas(width, height);
      renderXuanPaperToCanvas(canvas, scene);
    }
    const t3 = performance.now();

    const blob = await canvas.convertToBlob({ type: "image/png" });
    const t4 = performance.now();

    console.log(`[Worker] wasm:${(t1 - t0).toFixed(0)}ms scene:${(t2 - t1).toFixed(0)}ms render:${(t3 - t2).toFixed(0)}ms blob:${(t4 - t3).toFixed(0)}ms`);

    const response: XuanPaperWorkerResponse = { id, blob };
    workerScope.postMessage(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const response: XuanPaperWorkerResponse = { id, error: message };
    workerScope.postMessage(response);
  }
};
