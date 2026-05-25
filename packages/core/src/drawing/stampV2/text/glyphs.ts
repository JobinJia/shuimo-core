import {
  loadFont,
  getBoundingBox,
  type GlyphFont,
  type NormalizedCommand,
  type BoundingBox,
} from "../../internal/glyphPath";
import { loadGlyphFontViaWorker } from "../../internal/glyphFontClient";
import { subsetFontBuffer } from "../../internal/fontSubset";
import type { SealOptions } from "../types";
import type { LayoutCell } from "../layout/grid";

export interface CellGlyph {
  index: number;
  char: string;
  cell: LayoutCell;
  commands: NormalizedCommand[];
  bbox: BoundingBox;
}

export async function resolveFont(input: ArrayBuffer | Uint8Array | string): Promise<GlyphFont> {
  if (typeof input === "string") {
    const buf = await fetch(input).then((r) => r.arrayBuffer());
    const f = loadFont(buf);
    if (!f) throw new Error(`Failed to load font from "${input}"`);
    return f;
  }
  const f = loadFont(input);
  if (!f) throw new Error("Failed to load font buffer");
  return f;
}

export function resolveFontSync(input: ArrayBuffer | Uint8Array): GlyphFont {
  const f = loadFont(input);
  if (!f) throw new Error("Failed to load font buffer");
  return f;
}

// --- Worker / fallback font infrastructure -------------------------------
//
// Mirrors V1 (`Stamp.ts` loadGlyphFont / loadFallbackSubsetFont). V2 keeps
// its own caches so it can ship independently of V1 — but the underlying
// worker protocol, fontkit loader, and harfbuzz-subset wasm are shared via
// `internal/`, so the runtime cost is paid once.

const FONT_CACHE = new Map<string, Promise<GlyphFont | null>>();
const FALLBACK_FONT_CACHE = new Map<string, Promise<GlyphFont | null>>();
const RAW_FONT_BUFFER_CACHE = new Map<string, Promise<ArrayBuffer>>();

/** Unique chars across all text columns (set-deduplicated, insertion-order). */
export function collectStampChars(text: string | string[] | undefined): string[] {
  if (!text) return [];
  const lines = Array.isArray(text) ? text : [text];
  if (lines.length === 0) return [];
  const set = new Set<string>();
  for (const line of lines) {
    for (const ch of Array.from(line)) set.add(ch);
  }
  return Array.from(set);
}

function workerCacheKey(opts: SealOptions, chars: string[]): string {
  const sortedChars = [...chars].sort().join("");
  const fontKey = typeof opts.font === "string" ? opts.font : "<data>";
  return `${fontKey}::${sortedChars}`;
}

async function fetchFontBuffer(url: string): Promise<ArrayBuffer> {
  if (typeof fetch === "undefined") {
    throw new Error(`stamp-v2: fetch is unavailable, cannot load ${url}`);
  }
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`stamp-v2: failed to fetch ${url} (status ${response.status})`);
  }
  return response.arrayBuffer();
}

function loadRawFontBuffer(url: string): Promise<ArrayBuffer> {
  let cached = RAW_FONT_BUFFER_CACHE.get(url);
  if (cached) return cached;
  cached = fetchFontBuffer(url);
  // Drop the cached entry on failure so retries don't lock on a rejected promise.
  cached.catch(() => RAW_FONT_BUFFER_CACHE.delete(url));
  RAW_FONT_BUFFER_CACHE.set(url, cached);
  return cached;
}

/**
 * Resolve the primary font for a seal, picking the worker path when one is
 * provided. Returns null only when neither `font` nor `fontData` is set; the
 * sync `generateSeal` path bypasses this (no worker / fetch possible).
 */
export async function resolveFontForSeal(opts: SealOptions): Promise<GlyphFont> {
  const chars = collectStampChars(opts.text);

  // Worker path — preferred when set (off-main-thread woff2 decode).
  if (opts.fontWorker && (typeof opts.font === "string" || opts.fontData) && chars.length > 0) {
    const cacheKey = workerCacheKey(opts, chars);
    let cached = FONT_CACHE.get(cacheKey);
    if (!cached) {
      cached = (async () => {
        try {
          return await loadGlyphFontViaWorker(opts.fontWorker!, {
            fontUrl: typeof opts.font === "string" ? opts.font : undefined,
            fontData: opts.fontData instanceof Uint8Array
              ? opts.fontData.buffer.slice(
                  opts.fontData.byteOffset,
                  opts.fontData.byteOffset + opts.fontData.byteLength,
                ) as ArrayBuffer
              : opts.fontData,
            chars,
          });
        } catch {
          return null;
        }
      })();
      FONT_CACHE.set(cacheKey, cached);
    }
    const font = await cached;
    if (font) return font;
    // Worker failed → fall through to main-thread.
  }

  // Pre-fetched buffer — fastest main-thread path.
  if (opts.fontData) {
    const f = loadFont(opts.fontData);
    if (!f) throw new Error("stamp-v2: failed to load fontData buffer");
    return f;
  }

  // URL or buffer via existing resolveFont.
  if (!opts.font) {
    throw new Error("stamp-v2: generateSealAsync requires options.font or options.fontData");
  }
  return resolveFont(opts.font);
}

/** Chars whose `font.getPath(...)` returns 0 commands (missing in the font subset). */
export function findMissingChars(font: GlyphFont, text: string | string[] | undefined): string[] {
  const chars = collectStampChars(text);
  if (chars.length === 0) return [];
  const missing: string[] = [];
  for (const ch of chars) {
    // fontSize=1 is fine — we only care whether commands come back.
    const commands = font.getPath(ch, 0, 0, 1);
    if (commands.length === 0) missing.push(ch);
  }
  return missing;
}

/**
 * Fetch `fontFallbackUrl`, subset it through harfbuzz to just `missing`
 * chars, and load via the worker (if provided) or fontkit. Returns null
 * if anything in the chain fails — callers fall back to the primary font
 * unchanged.
 */
export async function loadFallbackSubsetFont(
  opts: SealOptions,
  missing: string[],
): Promise<GlyphFont | null> {
  if (!opts.fontFallbackUrl) return null;
  if (missing.length === 0) return null;

  const subsetKey = `${opts.fontFallbackUrl}::${[...missing].sort().join("")}`;
  const cached = FALLBACK_FONT_CACHE.get(subsetKey);
  if (cached) return cached;

  const promise = (async (): Promise<GlyphFont | null> => {
    try {
      const fullBuffer = await loadRawFontBuffer(opts.fontFallbackUrl!);
      const miniBuffer = await subsetFontBuffer(fullBuffer, missing, {
        wasmUrl: opts.harfbuzzSubsetWasmUrl,
      });
      if (opts.fontWorker) {
        return await loadGlyphFontViaWorker(opts.fontWorker, {
          fontData: miniBuffer,
          chars: missing,
        });
      }
      return loadFont(miniBuffer);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn(
        `stamp-v2: fallback font load failed for ${opts.fontFallbackUrl}:`,
        err instanceof Error ? err.message : err,
      );
      return null;
    }
  })();

  FALLBACK_FONT_CACHE.set(subsetKey, promise);
  return promise;
}

/**
 * Compose two fonts so chars present in `primary` keep its styling while
 * missing ones fall through to `fallback`. Improves on V1's wholesale-swap
 * behaviour, which loses primary glyphs whenever any single char is missing.
 *
 * `unitsPerEm` follows the primary so layout math (`fitGlyphInCell`,
 * inscribed-rect calc) stays anchored to the primary's metrics; fallback
 * `getPath` rescales internally to whatever `fontSize` is requested.
 */
export function compositeFont(primary: GlyphFont, fallback: GlyphFont): GlyphFont {
  return {
    unitsPerEm: primary.unitsPerEm,
    getAdvanceWidth(char: string): number {
      const primaryWidth = primary.getAdvanceWidth(char);
      if (primaryWidth > 0) return primaryWidth;
      const fb = fallback.getAdvanceWidth(char);
      // Rescale fallback advance into primary's em space.
      return (fb * primary.unitsPerEm) / fallback.unitsPerEm;
    },
    getPath(char: string, x: number, y: number, fontSize: number): NormalizedCommand[] {
      const primaryCmds = primary.getPath(char, x, y, fontSize);
      if (primaryCmds.length > 0) return primaryCmds;
      return fallback.getPath(char, x, y, fontSize);
    },
  };
}

export interface FitOptions {
  /** Cell-fraction margin around the glyph; default 0.02. */
  padding?: number;
  /**
   * Non-uniform scale to fill BOTH cell dimensions independently. Traditional
   * 篆刻 squashes glyphs to fill their cell — set true for that authentic
   * "九叠篆-ish" stamped look. Default false (preserves aspect).
   * Ignored when `fontSize` is provided.
   */
  stretch?: boolean;
  /**
   * If provided, all glyphs are rendered at this fontkit em scale and only
   * translated to the cell center. Skips the per-glyph aspect-fit scaling
   * that otherwise causes glyphs with shorter ink heights to be enlarged
   * more than their neighbors (producing visibly inconsistent stroke
   * weights across columns). Callers compute the shared fontSize once for
   * the whole seal so every glyph carries the same em → user-space ratio.
   */
  fontSize?: number;
}

/**
 * Fit `char` inside `cell`. Centered; scaled (uniformly by default, or
 * non-uniformly when `stretch=true`) to leave the requested margin.
 */
export function fitGlyphInCell(
  font: GlyphFont,
  cell: LayoutCell,
  opts: FitOptions = {},
): CellGlyph {
  if (opts.fontSize !== undefined) {
    return placeAtFontSize(font, cell, opts.fontSize);
  }

  const padding = opts.padding ?? 0.02;
  const stretch = opts.stretch ?? false;
  const targetW = cell.w * (1 - padding * 2);
  const targetH = cell.h * (1 - padding * 2);

  const baseline = 100;
  const probe = font.getPath(cell.char, 0, 0, baseline);
  if (probe.length === 0) {
    return emptyCell(cell);
  }
  const pbb = getBoundingBox(probe);
  const pw = pbb.x2 - pbb.x1;
  const ph = pbb.y2 - pbb.y1;
  if (pw <= 0 || ph <= 0) return emptyCell(cell);

  const scaleXraw = targetW / pw;
  const scaleYraw = targetH / ph;
  const uniform = Math.min(scaleXraw, scaleYraw);
  const sx = stretch ? scaleXraw : uniform;
  const sy = stretch ? scaleYraw : uniform;

  const targetCx = cell.x + cell.w / 2;
  const targetCy = cell.y + cell.h / 2;
  const srcCx = (pbb.x1 + pbb.x2) / 2;
  const srcCy = (pbb.y1 + pbb.y2) / 2;
  const dx = targetCx - srcCx * sx;
  const dy = targetCy - srcCy * sy;

  const transformed = probe.map((c) => affineCmd(c, sx, sy, dx, dy));
  return {
    index: cell.index,
    char: cell.char,
    cell,
    commands: transformed,
    bbox: {
      x1: pbb.x1 * sx + dx,
      y1: pbb.y1 * sy + dy,
      x2: pbb.x2 * sx + dx,
      y2: pbb.y2 * sy + dy,
    },
  };
}

function placeAtFontSize(font: GlyphFont, cell: LayoutCell, fontSize: number): CellGlyph {
  const probe = font.getPath(cell.char, 0, 0, fontSize);
  if (probe.length === 0) return emptyCell(cell);
  const pbb = getBoundingBox(probe);
  const pw = pbb.x2 - pbb.x1;
  const ph = pbb.y2 - pbb.y1;
  if (pw <= 0 || ph <= 0) return emptyCell(cell);

  const targetCx = cell.x + cell.w / 2;
  const targetCy = cell.y + cell.h / 2;
  const srcCx = (pbb.x1 + pbb.x2) / 2;
  const srcCy = (pbb.y1 + pbb.y2) / 2;
  const dx = targetCx - srcCx;
  const dy = targetCy - srcCy;

  const transformed = probe.map((c) => affineCmd(c, 1, 1, dx, dy));
  return {
    index: cell.index,
    char: cell.char,
    cell,
    commands: transformed,
    bbox: {
      x1: pbb.x1 + dx,
      y1: pbb.y1 + dy,
      x2: pbb.x2 + dx,
      y2: pbb.y2 + dy,
    },
  };
}

function emptyCell(cell: LayoutCell): CellGlyph {
  return {
    index: cell.index,
    char: cell.char,
    cell,
    commands: [],
    bbox: { x1: 0, y1: 0, x2: 0, y2: 0 },
  };
}

function affineCmd(c: NormalizedCommand, sx: number, sy: number, dx: number, dy: number): NormalizedCommand {
  const out: NormalizedCommand = { type: c.type };
  if (c.x != null) out.x = c.x * sx + dx;
  if (c.y != null) out.y = c.y * sy + dy;
  if (c.x1 != null) out.x1 = c.x1 * sx + dx;
  if (c.y1 != null) out.y1 = c.y1 * sy + dy;
  if (c.x2 != null) out.x2 = c.x2 * sx + dx;
  if (c.y2 != null) out.y2 = c.y2 * sy + dy;
  return out;
}
