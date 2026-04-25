/**
 * Font loading + glyph-path normalization backed by fontkit.
 *
 * Encapsulates fontkit so the rest of the stamp code can stay decoupled from
 * any specific font engine. NormalizedCommand reuses the shape of opentype.js
 * Path commands ({ type, x?, y?, x1?, y1?, x2?, y2? }) so generic transforms
 * (translate, angularize, etc.) keep working without per-command-type changes.
 */

import * as fontkit from "fontkit";
import type { Font as FontkitFont, FontCollection, PathCommand } from "fontkit";

export type NormalizedCommandType = "M" | "L" | "Q" | "C" | "Z";

export interface NormalizedCommand {
  type: NormalizedCommandType;
  x?: number;
  y?: number;
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
}

/** opentype.js-style bounding box (x1/y1 = min, x2/y2 = max). */
export interface BoundingBox {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface GlyphFont {
  /** Font's design grid size in font units. */
  unitsPerEm: number;
  /** Returns advance width in font units (0 if the glyph is missing). */
  getAdvanceWidth(char: string): number;
  /**
   * Returns normalized SVG-space commands for `char` placed at `(x, y)` baseline
   * with the given pixel `fontSize`. Y is flipped to match SVG (y-down), like
   * opentype.js's `Font.getPath(...)`.
   */
  getPath(char: string, x: number, y: number, fontSize: number): NormalizedCommand[];
}

/**
 * Parse an in-memory font (ttf / otf / woff / woff2 — auto-detected by fontkit).
 * Returns null if parsing fails or the buffer is a multi-font collection without
 * a usable first font.
 */
export function loadFont(data: ArrayBuffer | Uint8Array): GlyphFont | null {
  try {
    const buffer = toFontkitBuffer(data);
    const result = fontkit.create(buffer);
    const font = pickFont(result);
    if (!font) return null;
    return wrapFont(font);
  } catch {
    return null;
  }
}

function toFontkitBuffer(data: ArrayBuffer | Uint8Array): Buffer {
  if (data instanceof Uint8Array) {
    if (typeof Buffer !== "undefined" && !(data instanceof Buffer)) {
      return Buffer.from(data.buffer, data.byteOffset, data.byteLength);
    }
    return data as unknown as Buffer;
  }
  if (typeof Buffer !== "undefined") {
    return Buffer.from(data);
  }
  return new Uint8Array(data) as unknown as Buffer;
}

function pickFont(result: FontkitFont | FontCollection): FontkitFont | null {
  if (isFontCollection(result)) {
    return result.fonts[0] ?? null;
  }
  return result;
}

function isFontCollection(obj: FontkitFont | FontCollection): obj is FontCollection {
  return Array.isArray((obj as FontCollection).fonts);
}

function wrapFont(font: FontkitFont): GlyphFont {
  return {
    unitsPerEm: font.unitsPerEm,
    getAdvanceWidth(char: string): number {
      const codePoint = char.codePointAt(0);
      if (codePoint == null) return 0;
      const glyph = font.glyphForCodePoint(codePoint);
      return glyph?.advanceWidth ?? 0;
    },
    getPath(char: string, x: number, y: number, fontSize: number): NormalizedCommand[] {
      const codePoint = char.codePointAt(0);
      if (codePoint == null) return [];
      const glyph = font.glyphForCodePoint(codePoint);
      if (!glyph) return [];
      const scale = fontSize / font.unitsPerEm;
      return convertCommands(glyph.path.commands, scale, x, y);
    },
  };
}

function convertCommands(
  commands: PathCommand[],
  scale: number,
  dx: number,
  dy: number,
): NormalizedCommand[] {
  const out: NormalizedCommand[] = [];
  for (const cmd of commands) {
    const a = cmd.args;
    switch (cmd.command) {
      case "moveTo":
        out.push({ type: "M", x: a[0] * scale + dx, y: -a[1] * scale + dy });
        break;
      case "lineTo":
        out.push({ type: "L", x: a[0] * scale + dx, y: -a[1] * scale + dy });
        break;
      case "quadraticCurveTo":
        out.push({
          type: "Q",
          x1: a[0] * scale + dx,
          y1: -a[1] * scale + dy,
          x: a[2] * scale + dx,
          y: -a[3] * scale + dy,
        });
        break;
      case "bezierCurveTo":
        out.push({
          type: "C",
          x1: a[0] * scale + dx,
          y1: -a[1] * scale + dy,
          x2: a[2] * scale + dx,
          y2: -a[3] * scale + dy,
          x: a[4] * scale + dx,
          y: -a[5] * scale + dy,
        });
        break;
      case "closePath":
        out.push({ type: "Z" });
        break;
    }
  }
  return out;
}

/**
 * Compute exact bbox of a normalized path, evaluating curve extrema (matches
 * opentype.js Path.getBoundingBox semantics — control points outside the
 * visual extent of a curve don't inflate the bbox).
 */
export function getBoundingBox(commands: NormalizedCommand[]): BoundingBox {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let startX = 0;
  let startY = 0;
  let prevX = 0;
  let prevY = 0;

  const addPoint = (x: number, y: number) => {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  };

  for (const cmd of commands) {
    switch (cmd.type) {
      case "M":
        addPoint(cmd.x!, cmd.y!);
        startX = prevX = cmd.x!;
        startY = prevY = cmd.y!;
        break;
      case "L":
        addPoint(cmd.x!, cmd.y!);
        prevX = cmd.x!;
        prevY = cmd.y!;
        break;
      case "Q":
        addQuadraticBoundsTo(prevX, prevY, cmd.x1!, cmd.y1!, cmd.x!, cmd.y!, addPoint);
        prevX = cmd.x!;
        prevY = cmd.y!;
        break;
      case "C":
        addCubicBoundsTo(
          prevX,
          prevY,
          cmd.x1!,
          cmd.y1!,
          cmd.x2!,
          cmd.y2!,
          cmd.x!,
          cmd.y!,
          addPoint,
        );
        prevX = cmd.x!;
        prevY = cmd.y!;
        break;
      case "Z":
        prevX = startX;
        prevY = startY;
        break;
    }
  }

  if (minX === Infinity) {
    return { x1: 0, y1: 0, x2: 0, y2: 0 };
  }
  return { x1: minX, y1: minY, x2: maxX, y2: maxY };
}

function addQuadraticBoundsTo(
  p0x: number,
  p0y: number,
  p1x: number,
  p1y: number,
  p2x: number,
  p2y: number,
  add: (x: number, y: number) => void,
): void {
  add(p0x, p0y);
  add(p2x, p2y);
  for (let axis = 0; axis < 2; axis++) {
    const a0 = axis === 0 ? p0x : p0y;
    const a1 = axis === 0 ? p1x : p1y;
    const a2 = axis === 0 ? p2x : p2y;
    const denom = a0 - 2 * a1 + a2;
    if (denom === 0) continue;
    const t = (a0 - a1) / denom;
    if (t > 0 && t < 1) {
      const u = 1 - t;
      add(u * u * p0x + 2 * u * t * p1x + t * t * p2x, u * u * p0y + 2 * u * t * p1y + t * t * p2y);
    }
  }
}

function addCubicBoundsTo(
  p0x: number,
  p0y: number,
  p1x: number,
  p1y: number,
  p2x: number,
  p2y: number,
  p3x: number,
  p3y: number,
  add: (x: number, y: number) => void,
): void {
  add(p0x, p0y);
  add(p3x, p3y);
  for (let axis = 0; axis < 2; axis++) {
    const a0 = axis === 0 ? p0x : p0y;
    const a1 = axis === 0 ? p1x : p1y;
    const a2 = axis === 0 ? p2x : p2y;
    const a3 = axis === 0 ? p3x : p3y;
    // B'(t) = 3(A t^2 + 2 B t + C) where A = -a0+3a1-3a2+a3, B = a0-2a1+a2, C = a1-a0
    const A = -a0 + 3 * a1 - 3 * a2 + a3;
    const B = a0 - 2 * a1 + a2;
    const C = a1 - a0;
    let ts: number[];
    if (A === 0) {
      ts = B === 0 ? [] : [-C / (2 * B)];
    } else {
      const disc = B * B - A * C;
      if (disc < 0) ts = [];
      else {
        const sq = Math.sqrt(disc);
        ts = [(-B + sq) / A, (-B - sq) / A];
      }
    }
    for (const t of ts) {
      if (t > 0 && t < 1) {
        const u = 1 - t;
        add(
          u * u * u * p0x + 3 * u * u * t * p1x + 3 * u * t * t * p2x + t * t * t * p3x,
          u * u * u * p0y + 3 * u * u * t * p1y + 3 * u * t * t * p2y + t * t * t * p3y,
        );
      }
    }
  }
}

/**
 * Serialize normalized commands to an SVG path-data string. Mirrors opentype.js
 * `Path.toPathData(precision)` formatting: integers stay integer, floats use
 * the given `precision` decimal places, and a leading minus sign acts as the
 * implicit separator between numbers (no extra space before negatives).
 */
export function commandsToSvgPathData(commands: NormalizedCommand[], precision = 2): string {
  const fmt = (v: number): string => {
    if (Math.round(v) === v) return String(Math.round(v));
    return v.toFixed(precision);
  };
  const pack = (...vals: number[]): string => {
    let s = "";
    for (let i = 0; i < vals.length; i++) {
      const v = vals[i];
      if (v >= 0 && i > 0) s += " ";
      s += fmt(v);
    }
    return s;
  };

  let out = "";
  for (const cmd of commands) {
    switch (cmd.type) {
      case "M":
        out += "M" + pack(cmd.x!, cmd.y!);
        break;
      case "L":
        out += "L" + pack(cmd.x!, cmd.y!);
        break;
      case "Q":
        out += "Q" + pack(cmd.x1!, cmd.y1!, cmd.x!, cmd.y!);
        break;
      case "C":
        out += "C" + pack(cmd.x1!, cmd.y1!, cmd.x2!, cmd.y2!, cmd.x!, cmd.y!);
        break;
      case "Z":
        out += "Z";
        break;
    }
  }
  return out;
}
