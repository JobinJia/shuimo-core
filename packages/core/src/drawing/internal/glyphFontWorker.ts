/**
 * Stamp glyph-font worker.
 *
 * Runs inside a dedicated Worker. Listens for `GlyphFontWorkerRequest`,
 * parses the supplied font (woff2 brotli decode happens here, off the main
 * thread), and returns precomputed glyph commands + metrics for the requested
 * characters via `GlyphFontWorkerResponse`.
 *
 * The main thread never touches fontkit when this worker is in use, so the
 * ~2.4s tinf_inflate cost on a 1.2MB woff2 no longer blocks the UI.
 */

import { loadFont, type NormalizedCommand } from "./glyphPath";
import type {
  GlyphData,
  GlyphFontBundle,
  GlyphFontWorkerRequest,
  GlyphFontWorkerResponse,
} from "./glyphFontWorker-protocol";

export type {
  GlyphFontBundle,
  GlyphFontWorkerRequest,
  GlyphFontWorkerResponse,
} from "./glyphFontWorker-protocol";

interface WorkerScope {
  onmessage: ((event: MessageEvent<GlyphFontWorkerRequest>) => void) | null;
  postMessage: (data: GlyphFontWorkerResponse) => void;
}

const workerScope = self as unknown as WorkerScope;

async function fetchFontBuffer(url: string): Promise<ArrayBuffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch font ${url}: ${response.status}`);
  }
  return response.arrayBuffer();
}

function buildBundle(buffer: ArrayBuffer, chars: string[]): GlyphFontBundle | null {
  const font = loadFont(buffer);
  if (!font) return null;
  const unitsPerEm = font.unitsPerEm;
  const seen = new Set<string>();
  const glyphs: GlyphData[] = [];
  for (const raw of chars) {
    // chars may arrive as multi-character strings; walk code points.
    for (const ch of Array.from(raw)) {
      if (seen.has(ch)) continue;
      seen.add(ch);
      const advanceWidth = font.getAdvanceWidth(ch);
      // Render at fontSize = unitsPerEm so rescale on the main thread is a
      // single multiply per coordinate (no re-parsing needed).
      const commandsAtUnitsPerEm: NormalizedCommand[] = font.getPath(ch, 0, 0, unitsPerEm);
      glyphs.push({ char: ch, advanceWidth, commandsAtUnitsPerEm });
    }
  }
  return { unitsPerEm, glyphs };
}

workerScope.onmessage = async (event: MessageEvent<GlyphFontWorkerRequest>) => {
  const { id, fontUrl, fontData, chars } = event.data;
  try {
    const buffer = fontData ?? (fontUrl ? await fetchFontBuffer(fontUrl) : null);
    if (!buffer) throw new Error("glyph-font worker: missing fontUrl/fontData");
    const bundle = buildBundle(buffer, chars);
    if (!bundle) throw new Error("glyph-font worker: failed to parse font");
    const response: GlyphFontWorkerResponse = { id, bundle };
    workerScope.postMessage(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const response: GlyphFontWorkerResponse = { id, error: message };
    workerScope.postMessage(response);
  }
};
