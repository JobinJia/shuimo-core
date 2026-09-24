// Runs inside a dedicated Worker. Message protocol:
//   in:  XuanPaperWorkerRequest (prebuilt `scene` or `options`, optional `tile`)
//   out: XuanPaperWorkerResponse (transferred ImageBitmap)
import { renderXuanPaperTileToCanvas, renderXuanPaperToCanvas } from "./canvas-renderer";
import { buildXuanPaperScene } from "./model";
import { ready as wasmReady } from "./paper-tone-wasm";
import { DEFAULT_BASE_COLOR } from "./presets";
import type { XuanPaperWorkerRequest, XuanPaperWorkerResponse } from "./worker-protocol";

export type { XuanPaperWorkerRequest, XuanPaperWorkerResponse } from "./worker-protocol";

interface WorkerScope {
  onmessage: ((event: MessageEvent<XuanPaperWorkerRequest>) => void) | null;
  postMessage: (data: XuanPaperWorkerResponse, transfer?: Transferable[]) => void;
}

const workerScope = self as unknown as WorkerScope;

workerScope.onmessage = async (event: MessageEvent<XuanPaperWorkerRequest>) => {
  const { id, options, scene: prebuilt, tile } = event.data;
  try {
    await wasmReady;
    const scene =
      prebuilt ??
      buildXuanPaperScene({
        ...options,
        baseColor: options?.baseColor ?? DEFAULT_BASE_COLOR,
        mode: "canvas",
      });

    const canvas = new OffscreenCanvas(1, 1);
    if (tile) {
      renderXuanPaperTileToCanvas(canvas, scene, tile);
    } else {
      renderXuanPaperToCanvas(canvas, scene);
    }

    // Hand the pixels over as a transferable bitmap instead of encoding a PNG.
    const bitmap = canvas.transferToImageBitmap();
    const response: XuanPaperWorkerResponse = tile ? { id, bitmap, tile } : { id, bitmap };
    workerScope.postMessage(response, [bitmap]);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const response: XuanPaperWorkerResponse = { id, error: message };
    workerScope.postMessage(response);
  }
};
