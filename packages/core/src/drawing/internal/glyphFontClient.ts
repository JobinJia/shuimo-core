/**
 * Main-thread client for the stamp glyph-font worker.
 *
 * Sends a request to the worker, waits for the precomputed glyph bundle,
 * and exposes a `GlyphFont` surface backed by that bundle so the rest of
 * Stamp.ts (measureStampTextWithGlyphFont, buildVerticalGlyphPath) keeps
 * working unchanged.
 */

import type { GlyphFont, NormalizedCommand } from "./glyphPath";
import type {
  GlyphFontBundle,
  GlyphFontWorkerRequest,
  GlyphFontWorkerResponse,
} from "./glyphFontWorker-protocol";

let nextRequestId = 1;

interface PendingRequest {
  resolve: (bundle: GlyphFontBundle) => void;
  reject: (err: Error) => void;
}

const pending = new WeakMap<Worker, Map<number, PendingRequest>>();

function getPendingMap(worker: Worker): Map<number, PendingRequest> {
  let map = pending.get(worker);
  if (!map) {
    map = new Map();
    pending.set(worker, map);
    worker.addEventListener("message", (event: MessageEvent<GlyphFontWorkerResponse>) => {
      const { id } = event.data;
      const pendingMap = pending.get(worker);
      const entry = pendingMap?.get(id);
      if (!entry) return;
      pendingMap!.delete(id);
      if ("error" in event.data) {
        entry.reject(new Error(event.data.error));
      } else {
        entry.resolve(event.data.bundle);
      }
    });
    worker.addEventListener("error", (event: ErrorEvent) => {
      const pendingMap = pending.get(worker);
      if (!pendingMap) return;
      const message = event.message || "glyph-font worker error";
      for (const entry of pendingMap.values()) {
        entry.reject(new Error(message));
      }
      pendingMap.clear();
    });
  }
  return map;
}

export interface GlyphFontWorkerInput {
  fontUrl?: string;
  fontData?: ArrayBuffer;
  chars: string[];
}

/**
 * Send a request to a stamp glyph-font worker and resolve to a `GlyphFont`
 * whose `getPath` / `getAdvanceWidth` are backed by the worker's precomputed
 * bundle. Only chars present in `input.chars` are fully supported; missing
 * chars resolve to empty paths and zero advance width (mirroring the
 * fontkit-backed behavior for unmappable glyphs).
 */
export function loadGlyphFontViaWorker(
  worker: Worker,
  input: GlyphFontWorkerInput,
): Promise<GlyphFont> {
  return new Promise<GlyphFont>((resolve, reject) => {
    const id = nextRequestId++;
    const requestMap = getPendingMap(worker);
    requestMap.set(id, {
      resolve: (bundle) => resolve(makeGlyphFontFromBundle(bundle)),
      reject,
    });
    const transfers: Transferable[] = [];
    const fontDataPayload = input.fontData
      ? // Slice so the buffer we transfer is exclusively ours; do not steal a
        // caller-owned buffer that may be reused for other workers.
        input.fontData.slice(0)
      : undefined;
    if (fontDataPayload) transfers.push(fontDataPayload);
    const request: GlyphFontWorkerRequest = {
      id,
      fontUrl: input.fontUrl,
      fontData: fontDataPayload,
      chars: input.chars,
    };
    try {
      worker.postMessage(request, transfers);
    } catch (err) {
      requestMap.delete(id);
      reject(err instanceof Error ? err : new Error(String(err)));
    }
  });
}

/**
 * Build a `GlyphFont` from a worker-supplied bundle. Coordinates are
 * pre-rendered at fontSize = unitsPerEm and already in SVG y-down space, so
 * rescaling here is a single multiply per number plus a translate.
 */
function makeGlyphFontFromBundle(bundle: GlyphFontBundle): GlyphFont {
  const byChar = new Map<string, { advanceWidth: number; commands: NormalizedCommand[] }>();
  for (const glyph of bundle.glyphs) {
    byChar.set(glyph.char, {
      advanceWidth: glyph.advanceWidth,
      commands: glyph.commandsAtUnitsPerEm,
    });
  }
  const unitsPerEm = bundle.unitsPerEm;
  return {
    unitsPerEm,
    getAdvanceWidth(char: string): number {
      return byChar.get(char)?.advanceWidth ?? 0;
    },
    getPath(char: string, x: number, y: number, fontSize: number): NormalizedCommand[] {
      const entry = byChar.get(char);
      if (!entry) return [];
      const scale = fontSize / unitsPerEm;
      return rescaleCommands(entry.commands, scale, x, y);
    },
  };
}

function rescaleCommands(
  commands: NormalizedCommand[],
  scale: number,
  dx: number,
  dy: number,
): NormalizedCommand[] {
  const out: NormalizedCommand[] = new Array(commands.length);
  for (let i = 0; i < commands.length; i++) {
    const cmd = commands[i];
    switch (cmd.type) {
      case "M":
      case "L":
        out[i] = { type: cmd.type, x: cmd.x! * scale + dx, y: cmd.y! * scale + dy };
        break;
      case "Q":
        out[i] = {
          type: "Q",
          x1: cmd.x1! * scale + dx,
          y1: cmd.y1! * scale + dy,
          x: cmd.x! * scale + dx,
          y: cmd.y! * scale + dy,
        };
        break;
      case "C":
        out[i] = {
          type: "C",
          x1: cmd.x1! * scale + dx,
          y1: cmd.y1! * scale + dy,
          x2: cmd.x2! * scale + dx,
          y2: cmd.y2! * scale + dy,
          x: cmd.x! * scale + dx,
          y: cmd.y! * scale + dy,
        };
        break;
      case "Z":
        out[i] = { type: "Z" };
        break;
    }
  }
  return out;
}
