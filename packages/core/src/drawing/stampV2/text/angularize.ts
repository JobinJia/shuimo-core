import type { NormalizedCommand } from "../../internal/glyphPath";

/**
 * Port of V1 `angularizeGlyphPath` (Stamp.ts) — converts smooth Bezier glyph
 * commands into a chunky, jittered, quantized form that reads as "carved into
 * stone" rather than "laser-cut from a vector font."
 *
 * Without this step, no amount of SVG-filter post-processing can produce the
 * stone-cut look on V2 glyphs — feMorphology/feDisplacementMap can only
 * perturb edges within the existing antialiased band, which is too narrow on
 * smooth Bezier strokes to read as breakage. V1's apparent "filter magic" is
 * actually baked into the path geometry here.
 *
 * Three coupled effects per command:
 *   - Quantize each coordinate to a grid (snap to integer-ish positions)
 *   - Add bounded random jitter (controlled isotropic noise)
 *   - Pull Bezier control points toward 42% along the segment, then clamp
 *     within ±8 user units of the segment hull — straightens smooth curves
 *     into more angular polylines without letting them flip past their hull
 *
 * `intensity` linearly scales the jitter amplitude and pull amount; grid
 * stays fixed (modulating it visibly destabilizes glyph identity). At
 * intensity=0 the function returns the input unchanged.
 */
export interface AngularizeOptions {
  /** 0-1; 0 = no-op, 1 = V1 stone-cut defaults. */
  intensity?: number;
  /** Hash seed; same seed + cell index = stable jitter across renders. */
  seed: number;
  /** Cell / column index — perturbs the hash so identical glyphs diverge. */
  columnIndex?: number;
  /** Char index inside its column — further hash perturbation. */
  charIndex?: number;
  /**
   * Override the quantize grid (user units). V2 default 1.4 matches V1
   * stone-cut. Higher grids = blockier glyph forms (九叠篆 uses smaller
   * grid for tighter steps; 金文 uses larger grid for rounded reads).
   */
  grid?: number;
  /**
   * Override the jitter amplitude scale (V2 default 0.9). Multiplied by
   * intensity at runtime — passing this overrides the BASE_JITTER constant
   * but intensity scaling still applies.
   */
  jitter?: number;
  /**
   * Override the Bezier control-point pull (0..1). V2 default 0.42 (V1
   * stone-cut). Larger pull straightens curves more aggressively — useful
   * for the 高度角化 look of 九叠篆.
   */
  pull?: number;
}

export const BASE_GRID = 1.4;
export const BASE_JITTER = 0.9;
export const BASE_PULL = 0.42;
const CONTROL_SLACK = 8;

export function angularizeCommands(
  commands: NormalizedCommand[],
  opts: AngularizeOptions,
): NormalizedCommand[] {
  const intensity = clamp01(opts.intensity ?? 0);
  if (intensity <= 0 || commands.length === 0) return commands;

  const grid = opts.grid ?? BASE_GRID;
  const jitter = (opts.jitter ?? BASE_JITTER) * intensity;
  const pull = (opts.pull ?? BASE_PULL) * intensity;
  const seed = opts.seed | 0;
  const columnIndex = opts.columnIndex ?? 0;
  const charIndex = opts.charIndex ?? 0;

  let previousPoint = { x: 0, y: 0 };

  return commands.map((command, commandIndex) => {
    const next: NormalizedCommand = { ...command };
    const localSeed = seed + columnIndex * 131 + charIndex * 17 + commandIndex * 7;

    const moveCoord = (value: number, axisSalt: number) => {
      const stepped = quantize(value, grid);
      const delta = (hashNoise(localSeed, commandIndex, axisSalt) - 0.5) * jitter;
      return stepped + delta;
    };

    if (typeof next.x === "number") next.x = moveCoord(next.x, 11);
    if (typeof next.y === "number") next.y = moveCoord(next.y, 23);

    if (typeof next.x1 === "number" && typeof next.x === "number") {
      const pulled = previousPoint.x + (next.x1 - previousPoint.x) * pull;
      next.x1 = clamp(
        moveCoord(pulled, 31),
        Math.min(previousPoint.x, next.x) - CONTROL_SLACK,
        Math.max(previousPoint.x, next.x) + CONTROL_SLACK,
      );
    }
    if (typeof next.y1 === "number" && typeof next.y === "number") {
      const pulled = previousPoint.y + (next.y1 - previousPoint.y) * pull;
      next.y1 = clamp(
        moveCoord(pulled, 41),
        Math.min(previousPoint.y, next.y) - CONTROL_SLACK,
        Math.max(previousPoint.y, next.y) + CONTROL_SLACK,
      );
    }
    if (typeof next.x2 === "number" && typeof next.x === "number") {
      const pulled = next.x + (next.x2 - next.x) * pull;
      next.x2 = clamp(
        moveCoord(pulled, 53),
        Math.min(previousPoint.x, next.x) - CONTROL_SLACK,
        Math.max(previousPoint.x, next.x) + CONTROL_SLACK,
      );
    }
    if (typeof next.y2 === "number" && typeof next.y === "number") {
      const pulled = next.y + (next.y2 - next.y) * pull;
      next.y2 = clamp(
        moveCoord(pulled, 67),
        Math.min(previousPoint.y, next.y) - CONTROL_SLACK,
        Math.max(previousPoint.y, next.y) + CONTROL_SLACK,
      );
    }

    if (typeof next.x === "number" && typeof next.y === "number") {
      previousPoint = { x: next.x, y: next.y };
    }

    return next;
  });
}

function hashNoise(seed: number, index: number, salt: number): number {
  const value = Math.sin(seed * 12.9898 + index * 78.233 + salt * 37.719) * 43758.5453;
  return value - Math.floor(value);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function quantize(value: number, step: number): number {
  return Math.round(value / step) * step;
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
