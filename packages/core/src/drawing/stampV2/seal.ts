import { PRNG } from "../../foundation/random/prng";
import type { SealOptions, SealResult, SealShape, SealMode } from "./types";
import { layoutGrid, type ContentArea } from "./layout/grid";
import {
  resolveFontSync,
  fitGlyphInCell,
  resolveFontForSeal,
  findMissingChars,
  loadFallbackSubsetFont,
  compositeFont,
} from "./text/glyphs";
import { angularizeCommands } from "./text/angularize";
import { getScriptProfile } from "./text/scriptProfiles";
import { buildBorder, borderPolygon, type BorderRings } from "./border/shape";
import { erodeBorder } from "./border/erosion";
// Geometric carving removed — SVG textFilter handles 刀刻 via erode + edge
// displacement, which preserves stroke width (V1 approach).
import { inkFilterDefs, borderFilterDefs, textFilterDefs } from "./texture/inkFilter";
import { flattenCommands, type Ring } from "./geometry/flatten";
import type { MultiPolygon } from "./geometry/boolean";
import { renderSvg, type RenderCell } from "./render/svg";
import { getBoundingBox, type GlyphFont } from "../internal/glyphPath";

const DEFAULT_INK_COLOR = "#c1272d";
// Per-stage PRNG salts so each derived stream is independent + reproducible.
const SALT_SHAPE = 0x5ea1;
const SALT_CARVE = 0x5acafe;
const SALT_EROSION = 0xe70510;

export function generateSeal(options: SealOptions): SealResult {
  const buf = options.font;
  if (!buf) {
    throw new Error("generateSeal requires options.font (ArrayBuffer or Uint8Array)");
  }
  if (typeof buf === "string") {
    throw new Error(
      "generateSeal received a font URL; use generateSealAsync, or pre-fetch the buffer first.",
    );
  }
  const font = resolveFontSync(buf);
  return pipeline(font, options);
}

export async function generateSealAsync(options: SealOptions): Promise<SealResult> {
  if (!options.font && !options.fontData) {
    throw new Error("generateSealAsync requires options.font or options.fontData");
  }
  const primary = await resolveFontForSeal(options);
  // Fallback subset path — only kicks in when the caller supplied
  // `fontFallbackUrl` AND the primary actually lacks some chars. We compose
  // (primary preferred, fallback for missing) instead of V1's wholesale
  // swap so the primary's styling survives.
  let font = primary;
  if (options.fontFallbackUrl) {
    const missing = findMissingChars(primary, options.text);
    if (missing.length > 0) {
      const fallback = await loadFallbackSubsetFont(options, missing);
      if (fallback) font = compositeFont(primary, fallback);
    }
  }
  return pipeline(font, options);
}

function pipeline(font: GlyphFont, options: SealOptions): SealResult {
  const size = options.size;
  if (!(size > 0)) throw new Error("SealOptions.size must be > 0");
  // Normalize text to string[] (column array) per V1 convention.
  // Flat string → single column: "水墨" becomes ["水墨"] (1 col, 2 rows).
  const textInput: string[] = Array.isArray(options.text) ? options.text : [options.text];
  if (textInput.length === 0 || textInput.every((s) => s.length === 0)) {
    throw new Error("SealOptions.text must be non-empty");
  }

  const shape: SealShape = options.shape ?? { kind: "square" };
  const mode: SealMode = options.mode ?? "yang";
  const seed = options.seed ?? Date.now();
  const inkColor = options.ink?.color ?? DEFAULT_INK_COLOR;
  const direction = options.layout?.direction ?? defaultDirection(shape);
  const padding = options.layout?.padding ?? size * 0.04;
  const borderThickness = options.border?.thickness ?? Math.max(2, size * 0.025);

  // Compute text grid dimensions FIRST so the seal can size to fit the text
  // (like V1) rather than forcing text into a fixed square.
  const numCols = textInput.length;
  const maxRows = Math.max(...textInput.map((c) => Array.from(c).length));
  const sharedGap = options.layout?.gap ?? size * 0.01;
  const rowGap = options.layout?.rowGap ?? sharedGap;
  const columnGap = options.layout?.columnGap ?? sharedGap;

  // Derive actual seal dimensions from text grid. `size` = seal height.
  // Each column width is sized to its widest glyph's ink aspect (CJK 篆体
  // glyphs are tall-thin, so em-square cells leave horizontal padding that
  // reads as a column gap even when the user sets gap=0). Row height is the
  // shared `cellH` derived from the available inner height.
  const innerH = size - borderThickness * 2 - padding * 2;
  const cellH = Math.max(1, (innerH - rowGap * (maxRows - 1)) / Math.max(1, maxRows));

  // First pass: probe every glyph at a reference fontSize and capture its
  // ink bbox. We use these to derive (a) a SHARED em-scale (`sealFontSize`)
  // so every glyph carries the same stroke weight, and (b) per-column ink
  // widths so columns hug their widest member.
  // Using one shared scale matters: when each glyph was scaled independently
  // to its own cell, characters with shorter ink-heights got blown up more
  // → strokes ended up visibly thicker than their neighbors' (the
  // "one column thin, one column bold" bug).
  const PROBE_SIZE = 100;
  type GlyphMetric = { ch: string; pw: number; ph: number };
  const glyphMetricsByCol: GlyphMetric[][] = textInput.map((line) => {
    const out: GlyphMetric[] = [];
    for (const ch of Array.from(line)) {
      const probe = font.getPath(ch, 0, 0, PROBE_SIZE);
      if (probe.length === 0) continue;
      const bb = getBoundingBox(probe);
      const pw = bb.x2 - bb.x1;
      const ph = bb.y2 - bb.y1;
      if (pw > 0 && ph > 0) out.push({ ch, pw, ph });
    }
    return out;
  });
  const allMetrics = glyphMetricsByCol.flat();
  // Choose fontSize so the tallest glyph occupies 96% of cellH; shorter
  // glyphs leave proportionally more vertical padding in their cell.
  const globalMaxPh = allMetrics.length > 0 ? Math.max(...allMetrics.map((g) => g.ph)) : PROBE_SIZE;
  const sealFontSize = (cellH * 0.96 * PROBE_SIZE) / globalMaxPh;
  const scale = sealFontSize / PROBE_SIZE;

  const columnWidths = glyphMetricsByCol.map((metrics) => {
    if (metrics.length === 0) return cellH; // sane fallback
    const maxInkW = Math.max(...metrics.map((g) => g.pw)) * scale;
    // Keep 4% horizontal padding around the widest glyph (matches the 4%
    // shared with vertical padding via globalMaxPh).
    return Math.max(1, maxInkW / 0.96);
  });
  const textInnerW = columnWidths.reduce((s, w) => s + w, 0) + (numCols - 1) * columnGap;
  const textInnerH = innerH;
  const textFitW = textInnerW + borderThickness * 2 + padding * 2;
  const textFitH = textInnerH + borderThickness * 2 + padding * 2;

  // Decide actual seal dimensions per shape kind. Border functions are now
  // pure outline emitters that take {width, height} — so seal.ts is in
  // charge of producing the right outer box for each shape:
  //   - square / circle: force equal sides (max of text-fit dimensions and
  //     the user's size knob, so a tall text grid stays square)
  //   - rect / ellipse: use shape.aspect to drive the width; user-input
  //     `size` is the height; expand if text doesn't fit
  //   - auto: hug the text (legacy adaptive rect behaviour)
  let sealW: number;
  let sealH: number;
  switch (shape.kind) {
    case "square":
    case "circle": {
      const side = Math.max(textFitW, textFitH, size);
      sealW = side;
      sealH = side;
      break;
    }
    case "rect":
    case "ellipse": {
      if (shape.aspect == null) {
        // No aspect given → hug the text grid (same outer dims as `auto`).
        // Lets callers say "long-form shape, but you pick the proportions
        // from the text" without forcing them to compute aspect themselves.
        sealW = textFitW;
        sealH = size;
      } else {
        const aspect = Math.max(0.1, shape.aspect);
        sealH = size;
        const aspectW = sealH * aspect;
        sealW = Math.max(aspectW, textFitW);
      }
      break;
    }
    case "polygon": {
      // Polygon is shape-forced: caller chose `sides`, so respect the user
      // size and pad as needed for text fit. aspect (when set) stretches into
      // an oval-ish polygon.
      const aspect = shape.aspect ?? 1;
      sealH = Math.max(size, textFitH);
      const aspectW = sealH * aspect;
      sealW = Math.max(aspectW, textFitW);
      break;
    }
    case "auto":
    default: {
      sealW = textFitW;
      sealH = size;
      break;
    }
  }

  const cornerMode = options.border?.corner ?? "round";
  const defaultCornerRadius = cornerMode === "none" ? 0 : Math.min(sealW, sealH) * 0.04;
  const cornerRadius = cornerMode === "none" ? 0 : (options.border?.cornerRadius ?? defaultCornerRadius);

  const border = buildBorder(shape, {
    width: sealW,
    height: sealH,
    thickness: borderThickness,
    cornerRadius,
    prng: stagePrng(seed, SALT_SHAPE),
  });
  const box = { width: sealW, height: sealH };

  // Shapes that lock the outer dimensions (square / circle, or rect / ellipse
  // with an explicit aspect) re-flow the inner grid so every cell consumes
  // its fair share of innerW × innerH and the glyphs grow to fill the cell.
  // Without this re-flow the cells stay sized to glyph-hug widths from the
  // initial pass and a single-character square ends up with a small glyph
  // floating in a much bigger frame.
  const shapeForcesDims =
    shape.kind === "square" ||
    shape.kind === "circle" ||
    shape.kind === "polygon" ||
    ((shape.kind === "rect" || shape.kind === "ellipse") && shape.aspect != null);

  // Resolve script profile (篆体) — gives us default angularize params and
  // a stretch hint. `carving.intensity` from options still wins as the final
  // override; the script profile is just a baseline.
  const scriptProfile = getScriptProfile(options.script);

  // Stretch decision resolved BEFORE layout so the inscribed-rect shrink
  // (anti-clip for curved shapes) can be gated on it. With stretch on the
  // user explicitly asked for "fill the cell to the shape edge" — they
  // want the corner clip to kick in, not a pre-emptive shrink.
  // Precedence: explicit `layout.stretch` always wins; otherwise stretch
  // when the script asks for it (jiudiezhuan) OR the shape forces full-
  // cell dimensions. An `autoStretch: false` script (xiaozhuan/dazhuan/
  // jinwen/custom) must NOT cancel a square's shape-forced fill, which is
  // what an earlier `??` chain did — leaving glyphs floating in the cell.
  const stretchGlyphs = options.layout?.stretch
    ?? (Boolean(scriptProfile?.autoStretch) || shapeForcesDims);

  let layoutColumnWidths = columnWidths;
  let layoutCellH = cellH;
  let layoutFontSize = sealFontSize;
  let layoutAreaW = textInnerW;
  let layoutAreaH = textInnerH;

  // For curved borders (circle / ellipse), the rectangular cell grid can't
  // reach the full inner area without clipping at the corners. Anchor the
  // text region to the inscribed rectangle of the inner ellipse, expanded
  // by an overflow factor:
  //   - stretch OFF: factor=1.08 — text fits inside almost cleanly, tiny
  //     corner spill only.
  //   - stretch ON : factor=1.25 — text is noticeably larger and reads as
  //     "filled", at the cost of a manageable amount of corner clipping
  //     (much less than letting cells take innerW × innerH directly).
  // The clip layer (render/svg.ts) trims whatever still pokes out so the
  // visual stays inside the border.
  const innerWActual = sealW - borderThickness * 2 - padding * 2;
  const innerHActual = sealH - borderThickness * 2 - padding * 2;
  let textRegionW = innerWActual;
  let textRegionH = innerHActual;
  const isCurvedShape = shape.kind === "circle" || shape.kind === "ellipse";
  if (isCurvedShape) {
    const a = innerWActual / 2;
    const b = innerHActual / 2;
    const grAspect = textInnerW > 0 && textInnerH > 0 ? textInnerW / textInnerH : a / b;
    // Largest aspect-matched rect inscribed in ellipse (a, b):
    //   (W/2)²/a² + (H/2)²/b² = 1 with W = grAspect·H
    //   ⇒ H = 2 / √(grAspect²/a² + 1/b²)
    const denom = (grAspect * grAspect) / (a * a) + 1 / (b * b);
    const inscH = denom > 0 ? 2 / Math.sqrt(denom) : innerHActual;
    const inscW = grAspect * inscH;
    const OVERFLOW = stretchGlyphs ? 1.25 : 1.08;
    textRegionW = Math.min(innerWActual, inscW * OVERFLOW);
    textRegionH = Math.min(innerHActual, inscH * OVERFLOW);
  }

  if (shapeForcesDims) {
    const filledCellW = Math.max(
      1,
      (textRegionW - columnGap * Math.max(0, numCols - 1)) / Math.max(1, numCols),
    );
    const filledCellH = Math.max(
      1,
      (textRegionH - rowGap * Math.max(0, maxRows - 1)) / Math.max(1, maxRows),
    );
    // Pick a single fontSize that uniform-fits every glyph into its cell —
    // limited by whichever axis is tightest per glyph, then the smallest of
    // those across all glyphs so no glyph overflows.
    let bestScale = Infinity;
    for (const g of allMetrics) {
      const sW = (filledCellW * 0.96) / g.pw;
      const sH = (filledCellH * 0.96) / g.ph;
      const s = Math.min(sW, sH);
      if (s < bestScale) bestScale = s;
    }
    if (Number.isFinite(bestScale) && bestScale > 0) {
      layoutFontSize = bestScale * PROBE_SIZE;
    }
    layoutCellH = filledCellH;
    layoutColumnWidths = new Array(numCols).fill(filledCellW);
    layoutAreaW = textRegionW;
    layoutAreaH = textRegionH;
  } else if (shape.kind === "ellipse") {
    // Adaptive ellipse — text was hug-sized but should track the inscribed
    // rect (with the stretch-tuned overflow factor) so curved-border clip
    // doesn't eat too much. Circle is always shape-forced so never reaches
    // here; only ellipse without aspect can.
    const scaleFactor = Math.min(textRegionW / textInnerW, textRegionH / textInnerH, 1);
    if (scaleFactor < 1 && scaleFactor > 0) {
      layoutCellH = cellH * scaleFactor;
      layoutFontSize = sealFontSize * scaleFactor;
      layoutColumnWidths = columnWidths.map((w) => w * scaleFactor);
      layoutAreaW = layoutColumnWidths.reduce((s, w) => s + w, 0) + columnGap * Math.max(0, numCols - 1);
      layoutAreaH = layoutCellH * maxRows + rowGap * Math.max(0, maxRows - 1);
    }
  }

  const area: ContentArea = {
    x: (sealW - layoutAreaW) / 2,
    y: (sealH - layoutAreaH) / 2,
    w: layoutAreaW,
    h: layoutAreaH,
  };

  // Apply offsetX / offsetY (v1 spec section 六) to shift the content area
  // within the border. -1 = flush right/top, 0 = center, +1 = flush left/bottom.
  const offsetX = options.layout?.offsetX ?? 0;
  const offsetY = options.layout?.offsetY ?? 0;
  const shiftedArea = { ...area };
  if (offsetX !== 0 || offsetY !== 0) {
    const hSpace = area.w * 0.1;
    const vSpace = area.h * 0.1;
    shiftedArea.x = area.x + ((offsetX + 1) / 2 - 0.5) * hSpace;
    shiftedArea.y = area.y + ((offsetY + 1) / 2 - 0.5) * vSpace;
  }

  // layoutColumns indexes columnWidths by visual position (left→right),
  // but `columnWidths` here mirrors textInput order (text[0] = right column
  // per the ttb-rtl 篆刻 convention). Reverse so the leftmost visual cell
  // gets the width measured for the leftmost text column.
  const columnWidthsVisual = layoutColumnWidths.slice().reverse();
  const layoutCells = layoutGrid({
    text: textInput,
    area: shiftedArea,
    direction,
    columns: options.layout?.columns,
    gap: sharedGap,
    rowGap,
    columnGap,
    columnWidths: columnWidthsVisual,
  });

  // Carving intensity precedence: explicit `carving.intensity` wins; else
  // fall back to the script profile's baseline; else 0 (no angularize).
  const carvingIntensity =
    options.carving?.intensity ?? scriptProfile?.intensity ?? 0;

  // Angularize glyph commands BEFORE layout flattening, so both the smooth
  // SVG path and the flattened ring set carry the same chunky/jittered
  // geometry. Without this, V2 strokes stay laser-cut-smooth and no SVG
  // filter can recover the stone-cut texture (verified empirically — see
  // angularize.ts comment).
  // `stretchGlyphs` was decided up-front (so the inscribed-rect shrink for
  // curved shapes could honour it). 九叠篆-style stretch = each glyph fills
  // its uniform cell non-uniformly; otherwise uniform em scaling keeps
  // stroke weight consistent across glyphs.
  const fitOpts = stretchGlyphs
    ? { padding: 0.02, stretch: true } as const
    : { padding: 0.02, stretch: false, fontSize: layoutFontSize } as const;
  const glyphCells = layoutCells.map((c) => {
    const fitted = fitGlyphInCell(font, c, fitOpts);
    if (carvingIntensity <= 0) return fitted;
    return {
      ...fitted,
      commands: angularizeCommands(fitted.commands, {
        intensity: carvingIntensity,
        // Script profile drives angularize shape; missing → angularize uses BASE_*
        grid: scriptProfile?.grid,
        jitter: scriptProfile?.jitter,
        pull: scriptProfile?.pull,
        seed,
        columnIndex: c.index,
        charIndex: 0,
      }),
    };
  });

  const baseBorderPoly = borderPolygon(border);

  const renderCells: RenderCell[] = glyphCells.map((g) => {
    const flat = flattenCommands(g.commands, { tolerance: 0.5 });
    return {
      index: g.index,
      char: g.char,
      rings: flat,
      commands: g.commands,
      cx: g.cell.x + g.cell.w / 2,
      cy: g.cell.y + g.cell.h / 2,
      cellX: g.cell.x,
      cellY: g.cell.y,
      cellW: g.cell.w,
      cellH: g.cell.h,
      fontSize: layoutCellH * 0.88,
    };
  });

  const roughness = options.border?.roughness ?? 0;
  const erosionInput: MultiPolygon =
    mode === "yin" ? baseBorderPoly.map((p) => [p[0]]) : baseBorderPoly;
  const erodedBorderPoly =
    roughness > 0
      ? erodeBorder(border, erosionInput, { roughness }, stagePrng(seed, SALT_EROSION))
      : erosionInput;

  // Build SVG filter definitions. Filter intensities are linked to the
  // existing knobs so users don't get a third axis to tune:
  //   ink.bleed → 阴章 body filter (印泥 cloud + edge displacement)
  //              → 阳章 border filter (just edge displacement)
  //   carving.intensity → 阳章 text filter (刀刻)
  // Per-config unique slug so multiple seals in the same document don't
  // collide on filter / clipPath IDs. The gallery used to hit one shared
  // `stampv2-42-text` filter across tiles, so every tile rendered the
  // first tile's clip/filter. Hash every input that distinguishes one
  // visual output from another (text, shape variant fields, mode, size,
  // script) so same options → same slug and different options → different
  // slug — keeping the "deterministic SVG for same seed" contract while
  // avoiding the multi-seal collision.
  const shapeWithAll = shape as {
    aspect?: number;
    sides?: number;
    orientation?: string;
  };
  const shapeKey = [
    shape.kind,
    shapeWithAll.aspect ?? "",
    shapeWithAll.sides ?? "",
    shapeWithAll.orientation ?? "",
  ].join(":");
  const suffixKey = `${seed}|${textInput.join("\x1f")}|${shapeKey}|${options.script ?? ""}|${mode}|${size}`;
  let suffixHash = 5381;
  for (let i = 0; i < suffixKey.length; i++) {
    suffixHash = ((suffixHash << 5) + suffixHash + suffixKey.charCodeAt(i)) | 0;
  }
  const uniqueSuffix = Math.abs(suffixHash).toString(36);
  const filterId = `stampv2-${(seed | 0) >>> 0}-${uniqueSuffix}`;
  const bodyFilterIntensity = clamp01(options.ink?.bleed ?? 0);
  const textFilterIntensity = clamp01(carvingIntensity);
  let filterDefs = "";
  let bodyFilterId: string | null = null;
  let textFilterId: string | null = null;
  if (mode === "yin") {
    if (bodyFilterIntensity > 0) {
      bodyFilterId = `${filterId}-ink`;
      filterDefs += inkFilterDefs({
        id: bodyFilterId,
        seed,
        intensity: bodyFilterIntensity,
        size: Math.max(box.width, box.height),
      });
    }
  } else {
    if (bodyFilterIntensity > 0) {
      bodyFilterId = `${filterId}-border`;
      filterDefs += borderFilterDefs({
        id: bodyFilterId,
        seed,
        intensity: bodyFilterIntensity,
        thickness: borderThickness,
      });
    }
    if (textFilterIntensity > 0) {
      textFilterId = `${filterId}-text`;
      filterDefs += textFilterDefs({
        id: textFilterId,
        seed,
        intensity: textFilterIntensity,
        size: Math.max(box.width, box.height),
      });
    }
  }

  const r = renderSvg({
    width: box.width,
    height: box.height,
    mode,
    cells: renderCells,
    borderPoly: erodedBorderPoly,
    // Clip uses the smooth (pre-erosion) polygon so glyphs aren't chopped
    // along the noisy inner ring when border.roughness > 0. The visible
    // border ink still rides on the eroded version.
    clipPoly: baseBorderPoly,
    inkColor,
    glyphStrokeWidth: 0,
    filterDefs,
    bodyFilterId,
    textFilterId,
    clipPerCell: stretchGlyphs,
    idPrefix: filterId,
  });

  return {
    svg: r.svg,
    width: box.width,
    height: box.height,
    seed,
    layers: r.layers,
  };
}

function stagePrng(baseSeed: number, salt: number): PRNG {
  const p = new PRNG();
  p.seed(baseSeed ^ salt);
  return p;
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function defaultDirection(shape: SealShape): "ttb-rtl" | "circular" {
  return shape.kind === "circle" || shape.kind === "ellipse" ? "circular" : "ttb-rtl";
}

function contentArea(
  shape: SealShape,
  border: BorderRings,
  box: { width: number; height: number },
  padding: number,
): ContentArea {
  const t = border.thickness;
  if (shape.kind === "circle" || shape.kind === "ellipse") {
    const rx = box.width / 2 - t;
    const ry = box.height / 2 - t;
    const sx = rx * Math.SQRT1_2;
    const sy = ry * Math.SQRT1_2;
    return {
      x: box.width / 2 - sx + padding,
      y: box.height / 2 - sy + padding,
      w: sx * 2 - padding * 2,
      h: sy * 2 - padding * 2,
    };
  }
  return {
    x: t + padding,
    y: t + padding,
    w: box.width - 2 * (t + padding),
    h: box.height - 2 * (t + padding),
  };
}

export class Seal {
  private opts: SealOptions;
  constructor(opts: SealOptions) {
    this.opts = opts;
  }
  render(): SealResult {
    return generateSeal(this.opts);
  }
  async renderAsync(): Promise<SealResult> {
    return generateSealAsync(this.opts);
  }
  update(patch: Partial<SealOptions>): SealResult {
    this.opts = { ...this.opts, ...patch };
    return this.render();
  }
}
