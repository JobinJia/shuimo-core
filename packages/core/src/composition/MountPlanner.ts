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
const MOUNTAIN_ANCHORED: ReadonlySet<PlanTag> = new Set(["arch01", "arch02", "arch03", "arch04"]);

type AnchoredTag = "arch01" | "arch02" | "arch03" | "arch04";

/**
 * Per-anchored-tag hard caps and per-mountain placement probability. Caps are
 * enforced in both `plan()` and `fillShortfall` so visual density stays
 * readable even if upstream passes an aggressive `minCounts`. Buildings
 * (arch02/arch04) are rarer than small pavilions — they read as landmarks.
 */
const ANCHORED_CAP: Record<AnchoredTag, number> = {
  arch01: 3,
  arch02: 2,
  arch03: 1,
  arch04: 2,
};
const ANCHORED_PROB: Record<AnchoredTag, number> = {
  arch01: 0.3,
  arch02: 0.15,
  arch03: 0.12,
  arch04: 0.15,
};

/**
 * Upper y bound (inclusive) for a mount to qualify as an arch anchor. Mounts
 * with y above this are foreground bumps sitting near the waterline — the
 * mountain body is short, so a +20..+80 arch offset drops the arch below the
 * body into open water/blank space. Restricting anchors to background and
 * mid-range mountains keeps pavilions/pagodas on the mountain body.
 *
 * Mount y comes from `plan()` at `j + 300` with `j ∈ [0, yr(x) * 480)` step
 * 30, so the natural range is [300, ~600+]. 380 cuts at background+mid-range
 * (anchored arch y ends at ≤ 380 + 80 = 460, still well within the scene).
 */
const ARCH_ANCHOR_MAX_Y = 380;

/**
 * MountPlanner - Plan mountain and landscape element placement
 * Generates a plan for where to place mountains, boats, and other elements
 */
export class MountPlanner {
  /** Column width used to index `planmtx`. Shared by `plan()` and `fillShortfall()`. */
  static readonly XSTEP = 5;

  /** In-place Fisher-Yates shuffle driven by `prng` (deterministic per seed). */
  private static shuffle<T>(arr: T[]): T[] {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(prng.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /**
   * Compute an x near a mountain spine for anchored placement (±15 around
   * `mountX`). Keeps the arch visibly on the mountain rather than floating on
   * flanking water/sky.
   */
  private static anchoredX(mountX: number): number {
    return mountX + (prng.random() - 0.5) * 30;
  }

  /**
   * Compute a y offset anchored to the mountain's base y. All anchored tags
   * sit strictly below the mountain base so y-sort renders them on top of the
   * spine ink (sort is ascending — larger y draws later).
   *
   * - arch01 (pavilion): mountY+20..+80 — mid-to-lower slope, full body in front.
   * - arch02 (multi-story building): mountY+30..+80 — larger footprint, sits
   *   lower on the slope / at the foot where there's room for the mass.
   * - arch03 (pagoda): mountY+5..+40 — base hugs the spine, the ~100-150px
   *   tower extends upward past the ridge so the upper stories crown the mountain.
   * - arch04 (semi-transparent building): mountY+25..+80 — lighter than arch02
   *   but still a sizeable structure, same general band.
   */
  private static anchoredY(tag: AnchoredTag, mountY: number): number {
    if (tag === "arch01") return mountY + 20 + prng.random() * 60;
    if (tag === "arch02") return mountY + 30 + prng.random() * 50;
    if (tag === "arch04") return mountY + 25 + prng.random() * 55;
    return mountY + 5 + prng.random() * 35;
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

    // Place anchored buildings (arch01/arch02/arch03/arch04): iterate the
    // mountain list directly instead of stepping across x. Per-mount
    // probability and a hard total cap prevent the "ten pavilions lined up on
    // the horizon" failure mode that the xstep scan produced (scan density ×
    // column count stacked up arch firings even when `chaddSameTag` prevented
    // per-mount clustering). y is anchored to each mount's own y so the arch
    // sits on the mountain body, not on a fixed ground line — and buildings
    // never float on open water.
    //
    // `anchorMounts` filters out foreground bumps (y > ARCH_ANCHOR_MAX_Y).
    // Those are too short to host a +20..+80 arch offset without the arch
    // dropping below the drawn mountain body into water. See constant doc.
    const mounts = reg.filter((r) => r.tag === "mount");
    const anchorMounts = mounts.filter((m) => m.y <= ARCH_ANCHOR_MAX_Y);
    {
      const shuffled = this.shuffle(anchorMounts);
      let count = 0;
      for (const m of shuffled) {
        if (count >= ANCHORED_CAP.arch01) break;
        if (prng.random() >= ANCHORED_PROB.arch01) continue;
        const r: PlanItem = {
          tag: "arch01",
          x: this.anchoredX(m.x),
          y: this.anchoredY("arch01", m.y),
          h: 0,
        };
        if (this.chaddSameTag(reg, r, 80)) count++;
      }
    }

    // Place arch02 (multi-story buildings): anchor onto mountains, same
    // contract as arch01 — buildings belong on the mountain body, never
    // floating on open water. xstep-scan placement let arch02 spawn in
    // middle-of-lake columns (user report: seed 4678 → three-story pavilion
    // standing on water with no land in sight).
    {
      const shuffled = this.shuffle(anchorMounts);
      let count = 0;
      for (const m of shuffled) {
        if (count >= ANCHORED_CAP.arch02) break;
        if (prng.random() >= ANCHORED_PROB.arch02) continue;
        const r: PlanItem = {
          tag: "arch02",
          x: this.anchoredX(m.x),
          y: this.anchoredY("arch02", m.y),
          h: 0,
        };
        if (this.chaddSameTag(reg, r, 100)) count++;
      }
    }

    {
      const shuffled = this.shuffle(anchorMounts);
      let count = 0;
      for (const m of shuffled) {
        if (count >= ANCHORED_CAP.arch03) break;
        if (prng.random() >= ANCHORED_PROB.arch03) continue;
        const r: PlanItem = {
          tag: "arch03",
          x: this.anchoredX(m.x),
          y: this.anchoredY("arch03", m.y),
          h: 0,
        };
        if (this.chaddSameTag(reg, r, 120)) count++;
      }
    }

    // Place arch04 (semi-transparent multi-story): same anchoring contract as
    // arch02. Never free-floating on water.
    {
      const shuffled = this.shuffle(anchorMounts);
      let count = 0;
      for (const m of shuffled) {
        if (count >= ANCHORED_CAP.arch04) break;
        if (prng.random() >= ANCHORED_PROB.arch04) continue;
        const r: PlanItem = {
          tag: "arch04",
          x: this.anchoredX(m.x),
          y: this.anchoredY("arch04", m.y),
          h: 0,
        };
        if (this.chaddSameTag(reg, r, 100)) count++;
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
      nx >= blankArea.xMin && nx <= blankArea.xMax && ny >= blankArea.yMin && ny <= blankArea.yMax;
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

      const anchored = MOUNTAIN_ANCHORED.has(tag);
      // Anchored tags share a hard cap with plan(): never fill past the
      // visual-density ceiling even if minCounts asks for more.
      const cap = anchored ? ANCHORED_CAP[tag as AnchoredTag] : Infinity;
      const effectiveTarget = Math.min(target, cap);

      let count = plan.reduce((n, p) => (p.tag === tag ? n + 1 : n), 0);
      if (count >= effectiveTarget) continue;

      const missing = effectiveTarget - count;
      const maxAttempts = missing * 20;

      // Anchored tags snap onto a real mountain; pre-collect them once so we
      // don't re-filter every attempt. Same y-filter as `plan()`: reject
      // foreground bumps (y > ARCH_ANCHOR_MAX_Y) that can't host an arch
      // without dropping it into water. If the filtered pool is empty, skip
      // the tag entirely — better to miss `minCounts` than to place a
      // pavilion on open water.
      const mountItems = anchored
        ? plan.filter((p) => p.tag === "mount" && p.y <= ARCH_ANCHOR_MAX_Y)
        : [];
      if (anchored && mountItems.length === 0) continue;

      for (let attempt = 0; attempt < maxAttempts && count < effectiveTarget; attempt++) {
        let x: number;
        let y: number;
        if (anchored) {
          const anchor = mountItems[Math.floor(prng.random() * mountItems.length)];
          x = this.anchoredX(anchor.x);
          y = this.anchoredY(tag as AnchoredTag, anchor.y);
        } else {
          x = xmin + prng.random() * (xmax - xmin);
          y =
            placement.yJitter === 0
              ? placement.yBase
              : placement.yBase + prng.random() * placement.yJitter;
        }

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
