// Groups scene elements that share a paint (colour, alpha, stroke width) so
// each renderer issues one path per group instead of one per element, and
// culls elements that fall outside the region being rendered.
import type {
  FiberStroke,
  GoldFleck,
  GrainParticle,
  PaperPoint,
  TileRegion,
  XuanPaperScene,
} from "./types";

export interface FiberBatch {
  color: [number, number, number];
  alpha: number;
  width: number;
  fibers: FiberStroke[];
}

export interface ParticleBatch {
  color: [number, number, number];
  alpha: number;
  particles: GrainParticle[];
}

export interface GoldBatch {
  color: [number, number, number];
  alpha: number;
  /** Each fleck paired with the wrap offset to draw it at. */
  items: Array<{ fleck: GoldFleck; offset: PaperPoint }>;
}

export interface SceneBatches {
  fibers: FiberBatch[];
  particles: ParticleBatch[];
  gold: GoldBatch[];
}

/** Quantise to `step` so near-identical paints share a batch. */
function q(value: number, step: number): number {
  return Math.round(value / step) * step;
}

function paintKey(color: [number, number, number], alpha: number, extra = 0): string {
  return `${color[0]},${color[1]},${color[2]},${alpha},${extra}`;
}

interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

function visibleRect(scene: XuanPaperScene, tile: TileRegion | null): Rect {
  const margin = 2;
  if (tile) {
    return {
      x0: tile.x - margin,
      y0: tile.y - margin,
      x1: tile.x + tile.width + margin,
      y1: tile.y + tile.height + margin,
    };
  }
  return {
    x0: -margin,
    y0: -margin,
    x1: scene.options.width + margin,
    y1: scene.options.height + margin,
  };
}

function fiberVisible(fiber: FiberStroke, r: Rect): boolean {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const p of fiber.points) {
    if (p.x < x0) x0 = p.x;
    if (p.x > x1) x1 = p.x;
    if (p.y < y0) y0 = p.y;
    if (p.y > y1) y1 = p.y;
  }
  const pad = fiber.width;
  return x1 + pad >= r.x0 && x0 - pad <= r.x1 && y1 + pad >= r.y0 && y0 - pad <= r.y1;
}

function goldBounds(fleck: GoldFleck): Rect {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const c of fleck.commands) {
    if (c.type === "Z") continue;
    if (c.x < x0) x0 = c.x;
    if (c.x > x1) x1 = c.x;
    if (c.y < y0) y0 = c.y;
    if (c.y > y1) y1 = c.y;
    if (c.type === "Q") {
      if (c.cpx < x0) x0 = c.cpx;
      if (c.cpx > x1) x1 = c.cpx;
      if (c.cpy < y0) y0 = c.cpy;
      if (c.cpy > y1) y1 = c.cpy;
    }
  }
  return { x0, y0, x1, y1 };
}

/**
 * Groups the scene's fibers, particles and gold flecks by paint, keeping only
 * elements that intersect `tile` (or the sheet when `tile` is null). Group
 * order follows first appearance, so output is deterministic.
 */
export function buildSceneBatches(scene: XuanPaperScene, tile: TileRegion | null): SceneBatches {
  const rect = visibleRect(scene, tile);

  const fiberMap = new Map<string, FiberBatch>();
  for (const fiber of scene.fibers) {
    if (fiber.points.length < 2 || !fiberVisible(fiber, rect)) continue;
    const alpha = q(fiber.alpha, 0.02);
    const width = q(fiber.width, 0.1);
    const key = paintKey(fiber.color, alpha, width);
    let batch = fiberMap.get(key);
    if (!batch) {
      batch = { color: fiber.color, alpha, width, fibers: [] };
      fiberMap.set(key, batch);
    }
    batch.fibers.push(fiber);
  }

  const particleMap = new Map<string, ParticleBatch>();
  for (const particle of scene.particles) {
    const r = Math.max(particle.rx, particle.ry);
    if (
      particle.x + r < rect.x0 ||
      particle.x - r > rect.x1 ||
      particle.y + r < rect.y0 ||
      particle.y - r > rect.y1
    ) {
      continue;
    }
    const alpha = q(particle.alpha, 0.01);
    const key = paintKey(particle.color, alpha);
    let batch = particleMap.get(key);
    if (!batch) {
      batch = { color: particle.color, alpha, particles: [] };
      particleMap.set(key, batch);
    }
    batch.particles.push(particle);
  }

  const goldMap = new Map<string, GoldBatch>();
  if (scene.options.goldFlecks) {
    for (const fleck of scene.goldFlecks) {
      const b = goldBounds(fleck);
      for (const offset of fleck.copies) {
        if (
          b.x1 + offset.x < rect.x0 ||
          b.x0 + offset.x > rect.x1 ||
          b.y1 + offset.y < rect.y0 ||
          b.y0 + offset.y > rect.y1
        ) {
          continue;
        }
        const alpha = q(fleck.alpha, 0.01);
        const key = paintKey(fleck.color, alpha);
        let batch = goldMap.get(key);
        if (!batch) {
          batch = { color: fleck.color, alpha, items: [] };
          goldMap.set(key, batch);
        }
        batch.items.push({ fleck, offset });
      }
    }
  }

  return {
    fibers: [...fiberMap.values()],
    particles: [...particleMap.values()],
    gold: [...goldMap.values()],
  };
}
