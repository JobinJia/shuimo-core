import {
  loadFont,
  getBoundingBox,
  type GlyphFont,
  type NormalizedCommand,
  type BoundingBox,
} from "../../internal/glyphPath";
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
