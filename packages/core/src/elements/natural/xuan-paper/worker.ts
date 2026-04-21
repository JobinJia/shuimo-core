// Runs inside a dedicated Worker. Message protocol:
//   in:  XuanPaperWorkerRequest
//   out: XuanPaperWorkerResponse
import { renderXuanPaperToCanvas } from "./canvas-renderer";
import { buildXuanPaperScene } from "./model";
import { DEFAULT_BASE_COLOR } from "./presets";
import type { XuanPaperWorkerRequest, XuanPaperWorkerResponse } from "./worker-protocol";

export type { XuanPaperWorkerRequest, XuanPaperWorkerResponse } from "./worker-protocol";

interface WorkerScope {
  onmessage: ((event: MessageEvent<XuanPaperWorkerRequest>) => void) | null;
  postMessage: (data: XuanPaperWorkerResponse) => void;
}

const workerScope = self as unknown as WorkerScope;

workerScope.onmessage = async (event: MessageEvent<XuanPaperWorkerRequest>) => {
  const { id, options } = event.data;
  try {
    const width = options.width ?? 512;
    const height = options.height ?? 512;
    const canvas = new OffscreenCanvas(width, height);
    const scene = buildXuanPaperScene({
      ...options,
      baseColor: options.baseColor ?? DEFAULT_BASE_COLOR,
      mode: "canvas",
    });
    renderXuanPaperToCanvas(canvas, scene);
    const blob = await canvas.convertToBlob({ type: "image/png" });
    const response: XuanPaperWorkerResponse = { id, blob };
    workerScope.postMessage(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const response: XuanPaperWorkerResponse = { id, error: message };
    workerScope.postMessage(response);
  }
};
