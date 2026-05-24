import type { MultiPolygon } from "../geometry/boolean";
import type { Ring } from "../geometry/flatten";
import type { SealMode } from "../types";

import { commandsToSvgPathData, type NormalizedCommand } from "../../internal/glyphPath";

export interface RenderCell {
  index: number;
  char: string;
  rings: Ring[];
  /** Original Bezier commands for smooth SVG rendering (filter-friendly). */
  commands?: NormalizedCommand[];
  cx: number;
  cy: number;
  /** Cell origin + size in user units — needed to emit per-cell clipPaths. */
  cellX?: number;
  cellY?: number;
  cellW?: number;
  cellH?: number;
  fontSize: number;
}

export interface RenderSvgInput {
  width: number;
  height: number;
  mode: SealMode;
  cells: RenderCell[];
  borderPoly: MultiPolygon;
  inkColor: string;
  glyphStrokeWidth?: number;
  filterDefs?: string;
  bodyFilterId?: string | null;
  textFilterId?: string | null;
  /**
   * Emit a `<clipPath>` per cell and render each glyph inside it. Used in
   * stretch mode so any sub-pixel overflow (angularize jitter, displacement
   * filter scatter at the stroke rim) is clipped to the glyph's cell instead
   * of bleeding into the neighbour. Adds one `<clipPath>` per glyph to defs.
   */
  clipPerCell?: boolean;
}

export interface RenderSvgOutput {
  svg: string;
  layers: { background: string; text: string; border: string };
}

export function renderSvg(input: RenderSvgInput): RenderSvgOutput {
  const { width, height, mode, cells, borderPoly, inkColor, glyphStrokeWidth = 0, filterDefs, bodyFilterId, textFilterId, clipPerCell = false } = input;

  // Prefer original Bezier commands for rendering (smooth edges → SVG filters
  // produce visible carving). Fall back to flattened rings if commands absent.
  const hasCommands = cells.some((c) => c.commands && c.commands.length > 0);
  const perCellPath = (c: RenderCell): string => {
    if (hasCommands && c.commands && c.commands.length > 0) {
      return commandsToSvgPathData(c.commands, 2);
    }
    return ringsToPath(c.rings);
  };
  const glyphPathCombined = hasCommands
    ? cells.map((c) => c.commands ? commandsToSvgPathData(c.commands, 2) : "").filter(Boolean).join(" ")
    : ringsToPath(cells.flatMap((c) => c.rings));

  const canClip =
    clipPerCell &&
    cells.every((c) =>
      typeof c.cellX === "number" &&
      typeof c.cellY === "number" &&
      typeof c.cellW === "number" &&
      typeof c.cellH === "number"
    );

  const strokeAttr = glyphStrokeWidth > 0
    ? ` stroke="${inkColor}" stroke-width="${fmt(glyphStrokeWidth)}" stroke-linejoin="round" paint-order="stroke fill"`
    : "";

  let background = "";
  let text = "";
  let border = "";
  let extraDefs = "";

  if (mode === "yang") {
    const borderPath = multiPolygonToPath(borderPoly);
    const borderFilterAttr = bodyFilterId ? ` filter="url(#${bodyFilterId})"` : "";
    const textFilterAttr = textFilterId ? ` filter="url(#${textFilterId})"` : "";
    border = `<path d="${borderPath}" fill="${inkColor}" fill-rule="evenodd"${borderFilterAttr}/>`;
    if (canClip) {
      const clipBase = `stampv2-clip-${stableHash(cells)}`;
      const clipDefs: string[] = [];
      const paths: string[] = [];
      cells.forEach((c, i) => {
        const d = perCellPath(c);
        if (!d) return;
        const clipId = `${clipBase}-${i}`;
        clipDefs.push(
          `<clipPath id="${clipId}"><rect x="${fmt(c.cellX!)}" y="${fmt(c.cellY!)}" width="${fmt(c.cellW!)}" height="${fmt(c.cellH!)}"/></clipPath>`,
        );
        paths.push(
          `<g clip-path="url(#${clipId})"><path d="${d}" fill="${inkColor}"${strokeAttr} fill-rule="evenodd"${textFilterAttr}/></g>`,
        );
      });
      extraDefs = clipDefs.join("");
      text = paths.join("");
    } else {
      text = glyphPathCombined
        ? `<path d="${glyphPathCombined}" fill="${inkColor}"${strokeAttr} fill-rule="evenodd"${textFilterAttr}/>`
        : "";
    }
  } else {
    const bodyRings: Ring[] = borderPoly.flatMap((p) => (p[0] ? [p[0]] : []));
    const bodyPath = ringsToPath(bodyRings);
    const parts = [bodyPath, glyphPathCombined].filter(Boolean).join(" ");
    const bodyFilterAttr = bodyFilterId ? ` filter="url(#${bodyFilterId})"` : "";
    background = parts
      ? `<path d="${parts}" fill="${inkColor}"${strokeAttr} fill-rule="evenodd"${bodyFilterAttr}/>`
      : "";
  }

  const allDefs = [filterDefs, extraDefs].filter(Boolean).join("");
  const defs = allDefs ? `<defs>${allDefs}</defs>` : "";
  const inner = `${defs}${background}${text}${border}`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${fmt(width)} ${fmt(height)}" width="${fmt(width)}" height="${fmt(height)}">${inner}</svg>`;
  return { svg, layers: { background, text, border } };
}

function stableHash(cells: RenderCell[]): string {
  let h = 5381;
  for (const c of cells) {
    h = ((h << 5) + h + c.index) | 0;
  }
  return Math.abs(h).toString(36);
}

function multiPolygonToPath(poly: MultiPolygon): string {
  const parts: string[] = [];
  for (const polygon of poly) {
    for (const ring of polygon) {
      const r = ringToPath(ring);
      if (r) parts.push(r);
    }
  }
  return parts.join(" ");
}

function ringsToPath(rings: Ring[]): string {
  if (rings.length === 0) return "";
  const parts: string[] = [];
  for (const r of rings) {
    const s = ringToPath(r);
    if (s) parts.push(s);
  }
  return parts.join(" ");
}

function ringToPath(ring: Ring): string {
  if (ring.length === 0) return "";
  let s = `M${fmt(ring[0][0])} ${fmt(ring[0][1])}`;
  for (let i = 1; i < ring.length; i++) {
    s += `L${fmt(ring[i][0])} ${fmt(ring[i][1])}`;
  }
  s += "Z";
  return s;
}

function fmt(v: number): string {
  if (Math.round(v) === v) return String(Math.round(v));
  return v.toFixed(2);
}
