import { noise } from "../foundation/noise";
import { prng } from "../foundation/random";

/**
 * Tag identifying the element class of a plan item.
 */
export type PlanTag =
  | "mount"
  | "flatmount"
  | "distmount"
  | "water"
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

export interface ExplicitWaterBandOptions {
  /**
   * Explicit water/boat anchor y range in canvas coordinates.
   *
   * Used only when callers request `minCounts.water` / `minCounts.boat`.
   * Defaults to a proportional mid/foreground water band, away from the
   * canvas edge.
   */
  yRange?: readonly [number, number];
}

export interface LandscapePlacementOptions {
  /**
   * Controls the explicit water band used by fillShortfall water/boat anchors.
   */
  explicitWaterBand?: ExplicitWaterBandOptions;
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
  water: { yBase: 0, yJitter: 0, mind: 320 },
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

/** Default water band used only when a caller explicitly asks for water/boats. */
const BOAT_WATER_MIN_Y_RATIO = 0.38;
const BOAT_WATER_MAX_Y_RATIO = 0.52;
const EXPLICIT_WATER_LEN = 360;
const EXPLICIT_WATER_HALF_LEN = EXPLICIT_WATER_LEN / 2;

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
    threshold: number = 0.3,
  ): boolean {
    const z0 = f(x, y);
    if (z0 <= threshold) {
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
    if (this.hasSameTagConflict(reg, r, mind)) return false;
    reg.push(r);
    return true;
  }

  private static hasSameTagConflict(reg: PlanItem[], r: PlanItem, mind: number): boolean {
    return reg.some((p) => p.tag === r.tag && Math.abs(p.x - r.x) < mind);
  }

  private static landHalfWidth(item: PlanItem): number | null {
    if (item.tag === "flatmount") return 760;
    if (item.tag === "mount") return 520;
    return null;
  }

  private static landVerticalClearance(item: PlanItem): number {
    if (item.tag === "flatmount") return 60;
    if (item.tag === "mount") return 140;
    return 0;
  }

  private static isBoatOnLand(lands: PlanItem[], bx: number, by?: number): boolean {
    return this.boatLandCollisionScore(lands, bx, by) > 0;
  }

  private static boatLandCollisionScore(lands: PlanItem[], bx: number, by?: number): number {
    let score = 0;
    for (const m of lands) {
      const halfWid = this.landHalfWidth(m);
      if (halfWid === null) continue;
      if (by !== undefined) {
        if (by <= m.y) continue;
        if (by > m.y + this.landVerticalClearance(m)) continue;
      }
      const overlap = halfWid - Math.abs(m.x - bx);
      if (overlap <= 0) continue;
      score += overlap / halfWid;
    }
    return score;
  }

  private static defaultWaterYRange(height: number): [number, number] {
    return [height * BOAT_WATER_MIN_Y_RATIO, height * BOAT_WATER_MAX_Y_RATIO];
  }

  private static waterYRange(
    height: number,
    placement?: LandscapePlacementOptions,
  ): [number, number] {
    const yRange = placement?.explicitWaterBand?.yRange;
    if (!yRange) return this.defaultWaterYRange(height);
    return yRange[0] <= yRange[1] ? [yRange[0], yRange[1]] : [yRange[1], yRange[0]];
  }

  private static explicitWaterY(height: number, placement?: LandscapePlacementOptions): number {
    const [yMin, yMax] = this.waterYRange(height, placement);
    if (yMax <= yMin) return yMin;
    return yMin + prng.random() * (yMax - yMin);
  }

  private static isWater(item: PlanItem): boolean {
    return item.tag === "water";
  }

  private static boatWaterAnchor(plan: PlanItem[]): PlanItem | null {
    const waters = plan.filter((p) => this.isWater(p));
    if (waters.length === 0) return null;
    return waters[Math.floor(prng.random() * waters.length)];
  }

  private static boatCandidateOnWater(waterItem: PlanItem, plan: PlanItem[]): PlanItem {
    const halfLen = waterItem.h > 0 ? waterItem.h / 2 : EXPLICIT_WATER_HALF_LEN;
    const offsets = [
      (prng.random() - 0.5) * halfLen,
      0,
      -halfLen * 0.4,
      halfLen * 0.4,
      -halfLen * 0.2,
      halfLen * 0.2,
      -halfLen * 0.49,
      halfLen * 0.49,
    ];
    // y jitter so boats don't all sit on the same horizontal line.
    // Water ripples have ~18px vertical spread; ±12px keeps boats
    // visibly anchored to the water surface.
    const yJitter = (prng.random() - 0.5) * 24;
    let best: PlanItem | null = null;
    let bestScore = Infinity;
    for (const offset of offsets) {
      const item: PlanItem = {
        tag: "boat",
        x: waterItem.x + offset,
        y: waterItem.y + yJitter,
        h: 0,
      };
      const score = this.boatLandCollisionScore(plan, item.x, item.y);
      if (score === 0) return item;
      if (score < bestScore) {
        best = item;
        bestScore = score;
      }
    }
    return best ?? { tag: "boat", x: waterItem.x, y: waterItem.y + yJitter, h: 0 };
  }

  private static isBoatOnWater(boat: PlanItem, waterItem: PlanItem): boolean {
    if (!this.isWater(waterItem)) return false;
    const halfLen = waterItem.h > 0 ? waterItem.h / 2 : EXPLICIT_WATER_HALF_LEN;
    return Math.abs(boat.x - waterItem.x) <= halfLen && Math.abs(boat.y - waterItem.y) <= 15;
  }

  /**
   * Generate a plan for landscape elements in a given x range
   * @param xmin - Minimum x coordinate
   * @param xmax - Maximum x coordinate
   * @param planmtx - Planning matrix (modified in place)
   * @param landRegistry - Optional cross-chunk accumulator of placed
   *   `mount` / `flatmount` / `boat` items. Mutated in place: every land and
   *   boat placed in this chunk is appended so subsequent chunks can see it.
   *   Used in two directions:
   *     - boat placement reads it to reject anchors inside a prior land's
   *       footprint (mountain centered in chunk N seen by chunk N+1's boats).
   *     - mountain & flatmount placement reads it to skip a candidate that
   *       would land on a prior chunk's boat (the chunk N+1 mountain whose
   *       jittered x falls back into chunk N where a boat already sits).
   *   Without this both-ways check, fishermen still appear on the ridge at
   *   chunk seams. SceneManager calls plan() per cwid=512 chunk but mountains
   *   can be 600+ wide and flatmounts up to 1000, so cross-chunk overlap is
   *   common. Defaults to an empty array; callers that don't need
   *   cross-chunk coherence (e.g. PaintingGenerator with a single full-width
   *   plan) can omit it.
   * @returns Array of planned items
   */
  static plan(
    xmin: number,
    xmax: number,
    planmtx: number[],
    landRegistry: PlanItem[] = [],
  ): PlanItem[] {
    const reg: PlanItem[] = [];
    const samp = 0.03;

    // Use fewer octaves during planning — locmax only needs low-frequency terrain.
    // Save/restore to avoid affecting downstream render passes.
    noise.noiseDetail(2, 0.5);

    // Noise functions for different purposes.
    // ns is defined later with an adaptive bias; yr is used immediately.
    const yr = (x: number): number => {
      return noise.noise(x * 0.01, Math.PI);
    };

    const xstep = MountPlanner.XSTEP;
    const mwid = 200;

    // Reject lands that would land on a boat already placed in an earlier
    // chunk. Within a single chunk's plan(), mountains are placed before
    // boats so `reg` has no boats yet — only `landRegistry` matters here.
    // Same fisherman-vs-mountain-body thresholds as boat placement, applied
    // in reverse: keep the new land far enough from the existing boat that
    // its body wouldn't engulf the figure.
    const wouldCoverBoat = (lx: number, lhalfWid: number): boolean =>
      landRegistry.some((p) => p.tag === "boat" && Math.abs(p.x - lx) < lhalfWid);

    // Initialize planning matrix and measure noise distributions.
    //
    // Both yr(x) and ns(x) are backed by the same Perlin lookup table, and
    // that table is re-randomised each page load (lazy-init from prng).
    // Different tables produce different average noise levels, which causes
    // the 4–34 mountain density swing. We measure the raw noise baseline
    // and adapt the ns bias so the same fraction of noise values exceed it
    // regardless of the table.
    let totalYr = 0;
    let noiseSum = 0;
    let noiseCount = 0;
    let columnCount = 0;
    for (let i = xmin; i < xmax; i += xstep) {
      const i1 = Math.floor(i / xstep);
      planmtx[i1] = planmtx[i1] || 0;
      totalYr += Math.max(0, yr(i));
      const raw = noise.noise(i * samp);
      noiseSum += raw;
      noiseCount++;
      columnCount++;
    }

    // Normalise yr — stabilise candidate pool size across seeds.
    const targetAvgYr = 0.5;
    const actualAvgYr = columnCount > 0 ? totalYr / columnCount : 0;
    const yrScale = actualAvgYr > 0.01 ? targetAvgYr / actualAvgYr : 1.0;
    const clampedYrScale = Math.max(0.5, Math.min(2.0, yrScale));

    // Adapt the ns bias so the same fraction of raw noise values sit above
    // it regardless of the perlin table.  noiseAvg varies ~0.45–0.55 across
    // tables; the bias tracks it so ns is positive for the same upper tail.
    const noiseAvg = noiseCount > 0 ? noiseSum / noiseCount : 0.5;
    const nsBias = 0.55 + (noiseAvg - 0.5);
    const clampedNsBias = Math.max(0.35, Math.min(0.7, nsBias));
    const ns = (x: number, _y: number): number => {
      return Math.max(noise.noise(x * samp) - clampedNsBias, 0) * 2;
    };

    // Place mountains at local maxima — left-to-right scan preserves the
    // natural spatial distribution of the noise field so mountains aren't
    // clustered in a single noise-rich region.
    for (let i = xmin; i < xmax; i += xstep) {
      const yRange = Math.min(1.0, yr(i) * clampedYrScale) * 480;
      for (let j = 0; j < yRange; j += 30) {
        if (this.locmax(i, j, ns, 2)) {
          const xof = i + 2 * (prng.random() - 0.5) * 500;
          const yof = j + 300;
          if (wouldCoverBoat(xof, 350)) continue;
          const r: PlanItem = { tag: "mount", x: xof, y: yof, h: ns(i, j) };
          const res = this.chadd(reg, r, 10, planmtx);
          if (res) {
            for (let k = Math.floor((xof - mwid) / xstep); k < (xof + mwid) / xstep; k++) {
              planmtx[k] += 1;
            }
          }
        }
      }
    }

    // If the natural scan produced too many mountains (some noise tables
    // generate unusually many peaks), trim from the densest x-regions
    // first, removing weaker peaks within each cluster.  This preserves
    // spatial spread while keeping density within bounds.
    const mountTargetMax = Math.max(10, Math.min(32, Math.round((xmax - xmin) / 42)));
    {
      const mountIndices: number[] = [];
      for (let i = 0; i < reg.length; i++) {
        if (reg[i].tag === "mount") mountIndices.push(i);
      }
      const excess = mountIndices.length - mountTargetMax;
      if (excess > 0) {
        // Score each mount: (neighbour count within 150px, noise strength).
        // Sort by crowded-ness desc, then strength asc — weakest in
        // densest areas go first.
        interface TrimCandidate {
          idx: number;
          crowd: number;
          h: number;
        }
        const scored: TrimCandidate[] = mountIndices.map((idx) => {
          const m = reg[idx];
          let crowd = 0;
          for (const otherIdx of mountIndices) {
            if (otherIdx === idx) continue;
            if (Math.abs(reg[otherIdx].x - m.x) < 150) crowd++;
          }
          return { idx, crowd, h: m.h };
        });
        scored.sort((a, b) => b.crowd - a.crowd || a.h - b.h);

        const removeSet = new Set(scored.slice(0, excess).map((s) => s.idx));
        // Remove in reverse index order so splice indices stay valid.
        const sortedRemove = [...removeSet].sort((a, b) => b - a);
        for (const idx of sortedRemove) {
          const item = reg[idx];
          for (let k = Math.floor((item.x - mwid) / xstep); k < (item.x + mwid) / xstep; k++) {
            if (planmtx[k] > 0) planmtx[k] -= 1;
          }
          reg.splice(idx, 1);
        }
      }
    }

    // If the natural scan produced too few mountains (some noise tables
    // have very few strong peaks), fill gaps with a second pass at a
    // lowered threshold.  Weaken the threshold progressively until the
    // target is met or we run out of relaxation.
    const mountTargetMin = Math.max(6, Math.round((xmax - xmin) / 100));
    {
      let mountCount = reg.reduce((n, r) => (r.tag === "mount" ? n + 1 : n), 0);
      const fillThresholds = [0.2, 0.15, 0.1, 0.05];
      for (const fillThresh of fillThresholds) {
        if (mountCount >= mountTargetMin) break;
        for (let i = xmin; i < xmax; i += xstep) {
          if (mountCount >= mountTargetMin) break;
          const yRange = Math.min(1.0, yr(i) * clampedYrScale) * 480;
          for (let j = 0; j < yRange; j += 30) {
            if (mountCount >= mountTargetMin) break;
            if (!this.locmax(i, j, ns, 2, fillThresh)) continue;
            const xof = i + 2 * (prng.random() - 0.5) * 500;
            const yof = j + 300;
            if (wouldCoverBoat(xof, 350)) continue;
            const r: PlanItem = { tag: "mount", x: xof, y: yof, h: ns(i, j) };
            if (this.chadd(reg, r, 10, planmtx)) {
              for (let k = Math.floor((xof - mwid) / xstep); k < (xof + mwid) / xstep; k++) {
                planmtx[k] += 1;
              }
              mountCount++;
            }
          }
        }
      }
    }

    // Place distant mountains periodically (separate pass — no longer inside
    // the mountain-placement loop).
    for (let i = xmin; i < xmax; i += xstep) {
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
            const fx = i + 2 * (prng.random() - 0.5) * 700;
            if (wouldCoverBoat(fx, 550)) continue;
            const r: PlanItem = {
              tag: "flatmount",
              x: fx,
              y: 700 - j * 50,
              h: ns(i, j),
            };
            this.chadd(reg, r, 10, planmtx);
          }
        }
      }
    }

    // Do not auto-place fishing boats in procedural terrain chunks. This
    // planner has no real water-mask data; sampling boats from generic x/y
    // ranges repeatedly produced fishermen on mountain ridges. Boats are only
    // added by fillShortfall(), where the caller provides canvas height and
    // the boat can be anchored to a deliberate water band.

    // Accumulate this chunk's lands AND boats so subsequent chunks can see
    // them. Lands are checked by the next chunk's boat placement; boats are
    // checked by the next chunk's mountain placement (mountains in chunk N+1
    // can land back in chunk N because the noise-driven xof has ±500 jitter).
    // No-op when caller passes the default empty array.
    for (const item of reg) {
      if (item.tag === "mount" || item.tag === "flatmount" || item.tag === "boat") {
        landRegistry.push(item);
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

    noise.noiseDetail(4, 0.5);
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
      placement?: LandscapePlacementOptions;
    },
  ): PlanItem[] {
    const { xmin, xmax, planmtx, minCounts, blankArea, width, height, placement } = ctx;

    for (const [key, rawTarget] of Object.entries(minCounts)) {
      const tag = key as PlanTag;
      const target = rawTarget ?? 0;
      const tagPlacement = TAG_PLACEMENT[tag];
      if (!tagPlacement || target <= 0) continue;

      if (tag === "water") {
        let count = plan.reduce((n, p) => (p.tag === "water" ? n + 1 : n), 0);
        let fallbackWater: PlanItem | null = null;
        let fallbackScore = Infinity;
        const rememberFallbackWater = (x: number, y: number): void => {
          const item: PlanItem = { tag: "water", x, y, h: EXPLICIT_WATER_LEN };
          if (blankArea && this.isInBlankArea(x, y, width, height, blankArea)) return;
          if (this.hasSameTagConflict(plan, item, TAG_PLACEMENT.water.mind)) return;
          const score = this.boatLandCollisionScore(plan, x, y);
          if (score < fallbackScore) {
            fallbackWater = item;
            fallbackScore = score;
          }
        };
        const tryAddWater = (x: number, y: number): boolean => {
          rememberFallbackWater(x, y);
          if (blankArea && this.isInBlankArea(x, y, width, height, blankArea)) return false;
          if (this.isBoatOnLand(plan, x, y)) return false;
          const item: PlanItem = { tag: "water", x, y, h: EXPLICIT_WATER_LEN };
          return this.chaddSameTag(plan, item, TAG_PLACEMENT.water.mind);
        };

        const maxAttempts = (target - count) * 80;
        for (let attempt = 0; attempt < maxAttempts && count < target; attempt++) {
          const x = xmin + prng.random() * (xmax - xmin);
          const y = this.explicitWaterY(height, placement);
          if (tryAddWater(x, y)) count++;
        }

        if (count < target) {
          const [yMin, yMax] = this.waterYRange(height, placement);
          const yRatios = [0.5, 0.25, 0.75, 0, 1];
          const xStep = Math.max(80, Math.min(EXPLICIT_WATER_HALF_LEN, (xmax - xmin) / 32));
          for (const yRatio of yRatios) {
            if (count >= target) break;
            const y = yMin + (yMax - yMin) * yRatio;
            for (let x = xmin + xStep / 2; x < xmax && count < target; x += xStep) {
              if (tryAddWater(x, y)) count++;
            }
          }
        }

        if (count < target && fallbackWater) {
          plan.push(fallbackWater);
          count++;
        }
        continue;
      }

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
            tagPlacement.yJitter === 0
              ? tagPlacement.yBase
              : tagPlacement.yBase + prng.random() * tagPlacement.yJitter;

          if (tag === "boat") {
            let anchor = this.boatWaterAnchor(plan);
            if (!anchor) {
              MountPlanner.fillShortfall(plan, {
                xmin,
                xmax,
                planmtx,
                minCounts: { water: 1 },
                blankArea,
                width,
                height,
                placement,
              });
              anchor = this.boatWaterAnchor(plan);
            }
            if (!anchor) continue;
            const itemProbe = this.boatCandidateOnWater(anchor, plan);
            if (!this.isBoatOnWater(itemProbe, anchor)) continue;
            x = itemProbe.x;
            y = itemProbe.y;
          }
        }

        if (blankArea && this.isInBlankArea(x, y, width, height, blankArea)) {
          continue;
        }

        const item: PlanItem = { tag, x, y, h: 0 };
        const added =
          anchored || tag === "boat"
            ? this.chaddSameTag(plan, item, tagPlacement.mind)
            : this.chadd(plan, item, tagPlacement.mind, planmtx);
        if (added) {
          count++;
        }
      }

      if (tag === "boat" && count < effectiveTarget) {
        const anchors = plan.filter((p) => this.isWater(p));
        for (const anchor of anchors) {
          if (count >= effectiveTarget) break;
          const item = this.boatCandidateOnWater(anchor, plan);
          if (!this.isBoatOnWater(item, anchor)) continue;
          if (this.chaddSameTag(plan, item, tagPlacement.mind)) count++;
        }
      }
    }

    return plan;
  }
}
