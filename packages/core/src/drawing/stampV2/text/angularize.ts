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
 * does not follow intensity (modulating it visibly destabilizes glyph
 * identity) but does follow `lengthScale`. At intensity=0 the function
 * returns the input unchanged.
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
  /**
   * Seal size / REF_SIZE (see `internal/visualScale.ts`). Scales the
   * user-unit quantities — grid, jitter and control-point slack — so the
   * carving reads the same at 180 px and 480 px. `intensity` and `pull` are
   * unitless and are NOT scaled. Default 1.
   * @since 3.0.0 (previously callers pre-multiplied `intensity` by the
   * length scale, which also weakened `pull` on small seals and left the
   * grid size-blind).
   */
  lengthScale?: number;
}

export const BASE_GRID = 1.4;
export const BASE_JITTER = 0.9;
export const BASE_PULL = 0.42;
const CONTROL_SLACK_REF = 8;
/**
 * @since 3.0.0 jitter amplitudes (BASE_JITTER and the script profiles') are
 * multiplied by this so the per-seed chisel wobble is actually visible;
 * at 1.0 seeds only moved coordinates by ~0.3 px on a 480 px seal.
 */
const JITTER_GAIN = 1.6;

export function angularizeCommands(
  commands: NormalizedCommand[],
  opts: AngularizeOptions,
): NormalizedCommand[] {
  const intensity = clamp01(opts.intensity ?? 0);
  if (intensity <= 0 || commands.length === 0) return commands;

  const ls = opts.lengthScale != null && opts.lengthScale > 0 ? opts.lengthScale : 1;
  // Keep the grid above ~0.35 user units so tiny seals still quantize.
  const grid = Math.max(0.35, (opts.grid ?? BASE_GRID) * ls);
  const jitter = (opts.jitter ?? BASE_JITTER) * JITTER_GAIN * intensity * ls;
  const pull = (opts.pull ?? BASE_PULL) * intensity;
  const CONTROL_SLACK = CONTROL_SLACK_REF * ls;
  const seed = opts.seed | 0;
  const columnIndex = opts.columnIndex ?? 0;
  const charIndex = opts.charIndex ?? 0;

  // Plain loop, scalar previous point, no per-command closures — this runs
  // for every coordinate of every glyph.
  let prevX = 0;
  let prevY = 0;
  const out: NormalizedCommand[] = new Array(commands.length);
  for (let commandIndex = 0; commandIndex < commands.length; commandIndex++) {
    const command = commands[commandIndex];
    const next: NormalizedCommand = { ...command };
    const localSeed = seed + columnIndex * 131 + charIndex * 17 + commandIndex * 7;

    if (typeof next.x === "number") next.x = moveCoord(next.x, grid, jitter, localSeed, commandIndex, 11);
    if (typeof next.y === "number") next.y = moveCoord(next.y, grid, jitter, localSeed, commandIndex, 23);

    if (typeof next.x1 === "number" && typeof next.x === "number") {
      const pulled = prevX + (next.x1 - prevX) * pull;
      next.x1 = clamp(
        moveCoord(pulled, grid, jitter, localSeed, commandIndex, 31),
        Math.min(prevX, next.x) - CONTROL_SLACK,
        Math.max(prevX, next.x) + CONTROL_SLACK,
      );
    }
    if (typeof next.y1 === "number" && typeof next.y === "number") {
      const pulled = prevY + (next.y1 - prevY) * pull;
      next.y1 = clamp(
        moveCoord(pulled, grid, jitter, localSeed, commandIndex, 41),
        Math.min(prevY, next.y) - CONTROL_SLACK,
        Math.max(prevY, next.y) + CONTROL_SLACK,
      );
    }
    if (typeof next.x2 === "number" && typeof next.x === "number") {
      const pulled = next.x + (next.x2 - next.x) * pull;
      next.x2 = clamp(
        moveCoord(pulled, grid, jitter, localSeed, commandIndex, 53),
        Math.min(prevX, next.x) - CONTROL_SLACK,
        Math.max(prevX, next.x) + CONTROL_SLACK,
      );
    }
    if (typeof next.y2 === "number" && typeof next.y === "number") {
      const pulled = next.y + (next.y2 - next.y) * pull;
      next.y2 = clamp(
        moveCoord(pulled, grid, jitter, localSeed, commandIndex, 67),
        Math.min(prevY, next.y) - CONTROL_SLACK,
        Math.max(prevY, next.y) + CONTROL_SLACK,
      );
    }

    if (typeof next.x === "number" && typeof next.y === "number") {
      prevX = next.x;
      prevY = next.y;
    }

    out[commandIndex] = next;
  }
  return out;
}

function moveCoord(
  value: number,
  grid: number,
  jitter: number,
  localSeed: number,
  commandIndex: number,
  axisSalt: number,
): number {
  const stepped = quantize(value, grid);
  const delta = (hashNoise(localSeed, commandIndex, axisSalt) - 0.5) * jitter;
  return stepped + delta;
}

/**
 * Integer hash → [0, 1). @since 3.0.0 replaces the `fract(sin(x) * 43758)`
 * hash, which lost precision (and correlated) for large seeds such as
 * `Date.now()` and cost a `Math.sin` per coordinate.
 */
function hashNoise(seed: number, index: number, salt: number): number {
  let h = Math.imul((seed | 0) ^ 0x9e3779b9, 0x85ebca6b);
  h = Math.imul(h ^ (index + 0x632be5ab) ^ (h >>> 13), 0xc2b2ae35);
  h = Math.imul(h ^ Math.imul(salt, 0x27d4eb2f) ^ (h >>> 16), 0x165667b1);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
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
