import { noise } from "../foundation/noise";
import { prng } from "../foundation/random";

/**
 * Tag identifying the element class of a plan item.
 */
export type PlanTag =
  | "mount"
  | "flatmount"
  | "distmount"
  | "boat"
  | "arch01"
  | "arch02"
  | "arch03"
  | "arch04"
  | "tower";

export interface PlanItem {
  /** Element type tag */
  tag: string;
  /** X position */
  x: number;
  /** Y position */
  y: number;
  /** Height/intensity parameter */
  h: number;
}

/**
 * Rectangular region (in normalized 0..1 coordinates) that should remain
 * empty during composition. Consumed by `filterPlanByBlankArea` and by
 * `MountPlanner.fillShortfall` to reject placements that would land in it.
 */
export interface BlankArea {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  /** Extra margin band where elements are probabilistically rejected. */
  margin: number;
}

/** Per-tag natural placement ranges matching the constants used in `plan()`. */
interface TagPlacement {
  yBase: number;
  yJitter: number;
  mind: number;
}

const TAG_PLACEMENT: Record<PlanTag, TagPlacement> = {
  mount: { yBase: 300, yJitter: 0, mind: 10 },
  flatmount: { yBase: 550, yJitter: 150, mind: 10 },
  distmount: { yBase: 230, yJitter: 50, mind: 10 },
  boat: { yBase: 300, yJitter: 390, mind: 400 },
  arch01: { yBase: 680, yJitter: 50, mind: 80 },
  arch02: { yBase: 700, yJitter: 30, mind: 200 },
  arch03: { yBase: 620, yJitter: 80, mind: 120 },
  arch04: { yBase: 690, yJitter: 40, mind: 250 },
  tower: { yBase: 720, yJitter: 30, mind: 500 },
};

/** Tags that must be snapped onto the nearest real mountain spine. */
const MOUNTAIN_ANCHORED: ReadonlySet<PlanTag> = new Set(["arch01", "arch03"]);

/**
 * MountPlanner - Plan mountain and landscape element placement
 * Generates a plan for where to place mountains, boats, and other elements
 */
export class MountPlanner {
  /** Column width used to index `planmtx`. Shared by `plan()` and `fillShortfall()`. */
  static readonly XSTEP = 5;

  /**
   * Return the x coordinate of the `mount` item closest to `x`, or null if
   * `reg` contains no mountains. Anchored tags (arch01/arch03) use this to
   * snap onto a real mountain spine instead of relying on the wider
   * `planmtx > 0` halo (which includes the ±mwid(200) influence band and
   * produced the "building floating on water" visual bug).
   */
  private static nearestMountX(x: number, reg: PlanItem[]): number | null {
    let best: number | null = null;
    let bestD = Infinity;
    for (const item of reg) {
      if (item.tag !== "mount") continue;
      const d = Math.abs(item.x - x);
      if (d < bestD) {
        bestD = d;
        best = item.x;
      }
    }
    return best;
  }

  /**
   * Check if a point is a local maximum in the noise field
   */
  private static locmax(
    x: number,
    y: number,
    f: (x: number, y: number) => number,
    r: number,
  ): boolean {
    const z0 = f(x, y);
    if (z0 <= 0.3) {
      return false;
    }
    for (let i = x - r; i < x + r; i++) {
      for (let j = y - r; j < y + r; j++) {
        if (f(i, j) > z0) {
          return false;
        }
      }
    }
    return true;
  }

  /**
   * Check if an item can be added (minimum distance constraint)
   */
  private static chadd(
    reg: PlanItem[],
    r: PlanItem,
    mind: number = 10,
    _planmtx: number[],
  ): boolean {
    for (let k = 0; k < reg.length; k++) {
      if (Math.abs(reg[k].x - r.x) < mind) {
        return false;
      }
    }
    console.log("+");
    reg.push(r);
    return true;
  }

  /**
   * Variant of `chadd` that only enforces min distance against items of the
   * same tag. Anchored placements (arch01/arch03) sit within ±30 of a mount
   * by design — the generic `chadd` would then reject every candidate for
   * being too close to its own anchor. Same-tag checks still prevent two
   * buildings of the same type from clustering on one spine.
   */
  private static chaddSameTag(reg: PlanItem[], r: PlanItem, mind: number): boolean {
    for (const p of reg) {
      if (p.tag !== r.tag) continue;
      if (Math.abs(p.x - r.x) < mind) return false;
    }
    reg.push(r);
    return true;
  }

  /**
   * Generate a plan for landscape elements in a given x range
   * @param xmin - Minimum x coordinate
   * @param xmax - Maximum x coordinate
   * @param planmtx - Planning matrix (modified in place)
   * @returns Array of planned items
   */
  static plan(xmin: number, xmax: number, planmtx: number[]): PlanItem[] {
    const reg: PlanItem[] = [];
    const samp = 0.03;

    // Noise functions for different purposes
    const ns = (x: number, _y: number): number => {
      return Math.max(noise.noise(x * samp) - 0.55, 0) * 2;
    };
    const yr = (x: number): number => {
      return noise.noise(x * 0.01, Math.PI);
    };

    const xstep = MountPlanner.XSTEP;
    const mwid = 200;

    // Initialize planning matrix
    for (let i = xmin; i < xmax; i += xstep) {
      const i1 = Math.floor(i / xstep);
      planmtx[i1] = planmtx[i1] || 0;
    }

    // Place mountains at local maxima
    for (let i = xmin; i < xmax; i += xstep) {
      for (let j = 0; j < yr(i) * 480; j += 30) {
        if (this.locmax(i, j, ns, 2)) {
          const xof = i + 2 * (prng.random() - 0.5) * 500;
          const yof = j + 300;
          const r: PlanItem = { tag: "mount", x: xof, y: yof, h: ns(i, j) };
          const res = this.chadd(reg, r, 10, planmtx);
          if (res) {
            for (let k = Math.floor((xof - mwid) / xstep); k < (xof + mwid) / xstep; k++) {
              planmtx[k] += 1;
            }
          }
        }
      }

      // Place distant mountains periodically
      if (Math.abs(i) % 1000 < Math.max(1, xstep - 1)) {
        const r: PlanItem = {
          tag: "distmount",
          x: i,
          y: 280 - prng.random() * 50,
          h: ns(i, 0),
        };
        this.chadd(reg, r, 10, planmtx);
      }
    }

    console.log([xmin, xmax]);

    // Fill empty areas with flat mountains
    for (let i = xmin; i < xmax; i += xstep) {
      if (planmtx[Math.floor(i / xstep)] === 0) {
        if (prng.random() < 0.01) {
          for (let j = 0; j < 4 * prng.random(); j++) {
            const r: PlanItem = {
              tag: "flatmount",
              x: i + 2 * (prng.random() - 0.5) * 700,
              y: 700 - j * 50,
              h: ns(i, j),
            };
            this.chadd(reg, r, 10, planmtx);
          }
        }
      }
    }

    // Place boats
    for (let i = xmin; i < xmax; i += xstep) {
      if (prng.random() < 0.2) {
        const r: PlanItem = { tag: "boat", x: i, y: 300 + prng.random() * 390, h: 0 };
        this.chadd(reg, r, 400, planmtx);
      }
    }

    // Place arch buildings (arch01 - simple house).
    // Snap onto the nearest real mountain spine (not the wider planmtx halo)
    // so the house sits visibly on the mountain instead of drifting onto water.
    for (let i = xmin; i < xmax; i += xstep) {
      const mtxIdx = Math.floor(i / xstep);
      if ((planmtx[mtxIdx] ?? 0) > 0 && prng.random() < 0.05) {
        const anchor = this.nearestMountX(i, reg);
        if (anchor === null) continue;
        const jx = anchor + (prng.random() - 0.5) * 60;
        const r: PlanItem = {
          tag: "arch01",
          x: jx,
          y: 680 + prng.random() * 50, // Near bottom of scene (ground level)
          h: 0,
        };
        this.chaddSameTag(reg, r, 80);
      }
    }

    // Place arch02 buildings (multi-story buildings)
    for (let i = xmin; i < xmax; i += xstep) {
      if (prng.random() < 0.02) {
        const r: PlanItem = {
          tag: "arch02",
          x: i + (prng.random() - 0.5) * 100,
          y: 700 + prng.random() * 30, // Ground level
          h: 0,
        };
        this.chadd(reg, r, 200, planmtx);
      }
    }

    // Place arch03 pagodas (on scenic spots - can be on higher ground).
    // Also snapped onto the nearest mountain spine, same as arch01.
    for (let i = xmin; i < xmax; i += xstep) {
      const mtxIdx = Math.floor(i / xstep);
      if ((planmtx[mtxIdx] ?? 0) > 0 && prng.random() < 0.015) {
        const anchor = this.nearestMountX(i, reg);
        if (anchor === null) continue;
        const jx = anchor + (prng.random() - 0.5) * 60;
        const r: PlanItem = {
          tag: "arch03",
          x: jx,
          y: 620 + prng.random() * 80, // Slightly elevated
          h: 0,
        };
        this.chaddSameTag(reg, r, 120);
      }
    }

    // Place arch04 buildings (transparent multi-story)
    for (let i = xmin; i < xmax; i += xstep) {
      if (prng.random() < 0.015) {
        const r: PlanItem = {
          tag: "arch04",
          x: i + (prng.random() - 0.5) * 100,
          y: 690 + prng.random() * 40, // Ground level
          h: 0,
        };
        this.chadd(reg, r, 250, planmtx);
      }
    }

    // Place transmission towers (rare, industrial element)
    for (let i = xmin; i < xmax; i += xstep) {
      if (prng.random() < 0.005) {
        const r: PlanItem = {
          tag: "tower",
          x: i,
          y: 720 + prng.random() * 30, // Ground level
          h: 0,
        };
        this.chadd(reg, r, 500, planmtx);
      }
    }

    return reg;
  }

  /**
   * Test whether a pixel coordinate falls inside a normalized blank area.
   * The margin band around the core is rejected probabilistically, so that
   * edges fade rather than hard-cut.
   */
  static isInBlankArea(
    x: number,
    y: number,
    width: number,
    height: number,
    blankArea: BlankArea | null,
  ): boolean {
    if (!blankArea) return false;

    const nx = x / width;
    const ny = y / height;

    const inCore =
      nx >= blankArea.xMin &&
      nx <= blankArea.xMax &&
      ny >= blankArea.yMin &&
      ny <= blankArea.yMax;
    if (inCore) return true;

    const margin = blankArea.margin;
    const inMargin =
      nx >= blankArea.xMin - margin &&
      nx <= blankArea.xMax + margin &&
      ny >= blankArea.yMin - margin &&
      ny <= blankArea.yMax + margin;
    if (!inMargin) return false;

    const distX = Math.max(0, blankArea.xMin - nx, nx - blankArea.xMax);
    const distY = Math.max(0, blankArea.yMin - ny, ny - blankArea.yMax);
    const dist = Math.sqrt(distX * distX + distY * distY);
    const probability = 1 - dist / margin;
    return prng.random() < probability * 0.8;
  }

  /**
   * Ensure each tag named in `minCounts` appears at least the requested
   * number of times in `plan`. Shortfalls are filled by sampling jittered
   * positions in the tag's natural range; each candidate must survive both
   * the blank-area rejection and the same `chadd` minimum-distance check
   * used by `plan()`. Attempts are capped so unsatisfiable requests return
   * rather than looping forever.
   *
   * Mutates `plan` in place and returns the same array for chainability.
   */
  static fillShortfall(
    plan: PlanItem[],
    ctx: {
      xmin: number;
      xmax: number;
      planmtx: number[];
      minCounts: Partial<Record<PlanTag, number>>;
      blankArea?: BlankArea | null;
      width: number;
      height: number;
    },
  ): PlanItem[] {
    const { xmin, xmax, planmtx, minCounts, blankArea, width, height } = ctx;

    for (const [key, rawTarget] of Object.entries(minCounts)) {
      const tag = key as PlanTag;
      const target = rawTarget ?? 0;
      const placement = TAG_PLACEMENT[tag];
      if (!placement || target <= 0) continue;

      let count = plan.reduce((n, p) => (p.tag === tag ? n + 1 : n), 0);
      if (count >= target) continue;

      const missing = target - count;
      const maxAttempts = missing * 20;

      const anchored = MOUNTAIN_ANCHORED.has(tag);
      // Anchored tags snap onto a real mountain; pre-collect them once so we
      // don't re-filter every attempt.
      const mountItems = anchored ? plan.filter((p) => p.tag === "mount") : [];
      if (anchored && mountItems.length === 0) continue;

      for (let attempt = 0; attempt < maxAttempts && count < target; attempt++) {
        let x: number;
        if (anchored) {
          const anchor = mountItems[Math.floor(prng.random() * mountItems.length)];
          x = anchor.x + (prng.random() - 0.5) * 60;
        } else {
          x = xmin + prng.random() * (xmax - xmin);
        }
        const y =
          placement.yJitter === 0
            ? placement.yBase
            : placement.yBase + prng.random() * placement.yJitter;

        if (blankArea && this.isInBlankArea(x, y, width, height, blankArea)) {
          continue;
        }

        const item: PlanItem = { tag, x, y, h: 0 };
        const added = anchored
          ? this.chaddSameTag(plan, item, placement.mind)
          : this.chadd(plan, item, placement.mind, planmtx);
        if (added) {
          count++;
        }
      }
    }

    return plan;
  }
}
