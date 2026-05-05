import { beforeEach, describe, expect, it } from "vite-plus/test";
import { MountPlanner, type BlankArea, type PlanItem } from "./MountPlanner";
import { prng } from "../foundation/random";
import { noise } from "../foundation/noise";

// Perlin noise lazy-inits its internal table on first call, consuming prng
// state. Warm it up once so tests observe deterministic seed → output mapping.
noise.noise(0, 0);

describe("MountPlanner.plan (backward compat)", () => {
  it("produces identical output for a fixed seed when called without new args", () => {
    prng.seed(42);
    const planmtx1: number[] = [];
    const plan1 = MountPlanner.plan(0, 1200, planmtx1);

    prng.seed(42);
    const planmtx2: number[] = [];
    const plan2 = MountPlanner.plan(0, 1200, planmtx2);

    expect(plan2).toEqual(plan1);
    expect(plan1.length).toBeGreaterThan(0);
    expect(planmtx2).toEqual(planmtx1);
  });
});

describe("MountPlanner.fillShortfall", () => {
  beforeEach(() => {
    prng.seed(7);
  });

  it("fills shortfall when initial plan has fewer than requested count of a tag", () => {
    const plan: PlanItem[] = [];
    const planmtx: number[] = [];

    MountPlanner.fillShortfall(plan, {
      xmin: 0,
      xmax: 1200,
      planmtx,
      minCounts: { mount: 3 },
      width: 1200,
      height: 800,
    });

    const mountCount = plan.filter((p) => p.tag === "mount").length;
    expect(mountCount).toBeGreaterThanOrEqual(3);
  });

  it("respects chadd minimum-distance constraint between filled items of same tag", () => {
    const plan: PlanItem[] = [];
    const planmtx: number[] = [];

    MountPlanner.fillShortfall(plan, {
      xmin: 0,
      xmax: 1200,
      planmtx,
      minCounts: { mount: 3 },
      width: 1200,
      height: 800,
    });

    const mounts = plan.filter((p) => p.tag === "mount");
    for (let i = 0; i < mounts.length; i++) {
      for (let j = i + 1; j < mounts.length; j++) {
        expect(Math.abs(mounts[i].x - mounts[j].x)).toBeGreaterThanOrEqual(10);
      }
    }
  });

  it("does not place filled items inside the blank area", () => {
    const plan: PlanItem[] = [];
    const planmtx: number[] = [];
    // Right blank area — xMin=0.6..1.1 of normalized width
    const blankArea: BlankArea = {
      xMin: 0.6,
      xMax: 1.1,
      yMin: 0.1,
      yMax: 0.9,
      margin: 0.08,
    };
    const width = 1200;
    const height = 800;

    MountPlanner.fillShortfall(plan, {
      xmin: 0,
      xmax: width,
      planmtx,
      minCounts: { mount: 5 },
      blankArea,
      width,
      height,
    });

    for (const item of plan) {
      const nx = item.x / width;
      const ny = item.y / height;
      const inCore =
        nx >= blankArea.xMin &&
        nx <= blankArea.xMax &&
        ny >= blankArea.yMin &&
        ny <= blankArea.yMax;
      expect(inCore).toBe(false);
    }
  });

  it("does not loop forever when mind is too restrictive to satisfy minCounts", () => {
    const plan: PlanItem[] = [];
    const planmtx: number[] = [];
    // Ask for 100 towers with mind=500 in a 1000-wide canvas — cannot fit.
    const start = Date.now();
    MountPlanner.fillShortfall(plan, {
      xmin: 0,
      xmax: 1000,
      planmtx,
      minCounts: { tower: 100 },
      width: 1000,
      height: 800,
    });
    const elapsed = Date.now() - start;

    // Completes quickly (no infinite loop) and caps at the physically feasible count.
    expect(elapsed).toBeLessThan(1000);
    const towerCount = plan.filter((p) => p.tag === "tower").length;
    expect(towerCount).toBeLessThan(100);
  });

  it("is backward-compatible: calling it with an empty minCounts mutates nothing", () => {
    const plan: PlanItem[] = [
      { tag: "mount", x: 100, y: 300, h: 0.5 },
      { tag: "boat", x: 500, y: 500, h: 0 },
    ];
    const snapshot = JSON.parse(JSON.stringify(plan));
    MountPlanner.fillShortfall(plan, {
      xmin: 0,
      xmax: 1200,
      planmtx: [],
      minCounts: {},
      width: 1200,
      height: 800,
    });
    expect(plan).toEqual(snapshot);
  });

  it("anchors fillShortfall arch03 onto an existing mount (within jitter radius)", () => {
    const plan: PlanItem[] = [
      { tag: "mount", x: 400, y: 300, h: 0.5 },
      { tag: "mount", x: 900, y: 300, h: 0.5 },
    ];
    const planmtx: number[] = [];

    MountPlanner.fillShortfall(plan, {
      xmin: 0,
      xmax: 1200,
      planmtx,
      minCounts: { arch03: 1 },
      width: 1200,
      height: 800,
    });

    const archs = plan.filter((p) => p.tag === "arch03");
    expect(archs.length).toBeGreaterThanOrEqual(1);
    for (const a of archs) {
      const nearest = Math.min(Math.abs(a.x - 400), Math.abs(a.x - 900));
      // ±30 jitter radius leaves a small margin for float math.
      expect(nearest).toBeLessThanOrEqual(35);
    }
  });

  it("skips anchored tags when no mounts exist (rather than looping on dead ground)", () => {
    const plan: PlanItem[] = [];
    const planmtx: number[] = [];

    MountPlanner.fillShortfall(plan, {
      xmin: 0,
      xmax: 1200,
      planmtx,
      minCounts: { arch01: 3 },
      width: 1200,
      height: 800,
    });

    expect(plan.filter((p) => p.tag === "arch01").length).toBe(0);
  });

  it("only anchors arch01 to mounts with y <= 380 (filters out shallow foreground bumps)", () => {
    // Mixed pool: a tall background mountain at y=320 and a shallow foreground
    // bump at y=540. Before the y-filter fix, fillShortfall sampled from both,
    // and an anchor on the y=540 bump produced arch01.y = 560..620 — which is
    // below the bump's drawn body, i.e. floating on water/blank space. The
    // arch must only snap onto the deep mountain.
    const plan: PlanItem[] = [
      { tag: "mount", x: 400, y: 320, h: 0.5 },
      { tag: "mount", x: 900, y: 540, h: 0.5 },
    ];
    const planmtx: number[] = [];

    MountPlanner.fillShortfall(plan, {
      xmin: 0,
      xmax: 1200,
      planmtx,
      minCounts: { arch01: 3 },
      width: 1200,
      height: 800,
    });

    const arch01s = plan.filter((p) => p.tag === "arch01");
    expect(arch01s.length).toBeGreaterThanOrEqual(1);
    for (const a of arch01s) {
      // Must snap onto mount A at x=400, never mount B at x=900.
      expect(Math.abs(a.x - 400)).toBeLessThanOrEqual(35);
    }
  });

  it("skips anchored tags when every mount is too shallow (y > 380) rather than placing on water", () => {
    // All mounts are foreground bumps. There is no valid anchor, so
    // fillShortfall must refuse to place — better to miss the minCount than
    // to draw a pavilion on open water.
    const plan: PlanItem[] = [
      { tag: "mount", x: 400, y: 540, h: 0.5 },
      { tag: "mount", x: 900, y: 520, h: 0.5 },
    ];
    const planmtx: number[] = [];

    MountPlanner.fillShortfall(plan, {
      xmin: 0,
      xmax: 1200,
      planmtx,
      minCounts: { arch01: 3, arch02: 2, arch03: 1, arch04: 2 },
      width: 1200,
      height: 800,
    });

    expect(plan.filter((p) => p.tag === "arch01").length).toBe(0);
    expect(plan.filter((p) => p.tag === "arch02").length).toBe(0);
    expect(plan.filter((p) => p.tag === "arch03").length).toBe(0);
    expect(plan.filter((p) => p.tag === "arch04").length).toBe(0);
  });
});

describe("MountPlanner.plan anchored buildings", () => {
  it("places every arch01 / arch02 / arch03 / arch04 within ±35px of the nearest mount spine", () => {
    prng.seed(123);
    const planmtx: number[] = [];
    const plan = MountPlanner.plan(0, 2400, planmtx);

    const mounts = plan.filter((p) => p.tag === "mount");
    // Sanity: plan() on this seed must yield some mountains for the test to be
    // meaningful. If this ever fires, pick another seed.
    expect(mounts.length).toBeGreaterThan(0);

    const anchored = plan.filter(
      (p) => p.tag === "arch01" || p.tag === "arch02" || p.tag === "arch03" || p.tag === "arch04",
    );
    for (const a of anchored) {
      const nearest = mounts.reduce((best, m) => Math.min(best, Math.abs(m.x - a.x)), Infinity);
      expect(nearest).toBeLessThanOrEqual(35);
    }
  });

  it("caps arch01 count at 3 per plan across several seeds", () => {
    for (const seed of [42, 123, 58049, 7]) {
      prng.seed(seed);
      const planmtx: number[] = [];
      const plan = MountPlanner.plan(0, 2400, planmtx);
      const arch01s = plan.filter((p) => p.tag === "arch01");
      expect(arch01s.length).toBeLessThanOrEqual(3);
    }
  });

  it("caps arch02 count at 2 per plan across several seeds", () => {
    for (const seed of [42, 123, 58049, 7]) {
      prng.seed(seed);
      const planmtx: number[] = [];
      const plan = MountPlanner.plan(0, 2400, planmtx);
      const arch02s = plan.filter((p) => p.tag === "arch02");
      expect(arch02s.length).toBeLessThanOrEqual(2);
    }
  });

  it("caps arch03 count at 1 per plan across several seeds", () => {
    for (const seed of [42, 123, 58049, 7]) {
      prng.seed(seed);
      const planmtx: number[] = [];
      const plan = MountPlanner.plan(0, 2400, planmtx);
      const arch03s = plan.filter((p) => p.tag === "arch03");
      expect(arch03s.length).toBeLessThanOrEqual(1);
    }
  });

  it("caps arch04 count at 2 per plan across several seeds", () => {
    for (const seed of [42, 123, 58049, 7]) {
      prng.seed(seed);
      const planmtx: number[] = [];
      const plan = MountPlanner.plan(0, 2400, planmtx);
      const arch04s = plan.filter((p) => p.tag === "arch04");
      expect(arch04s.length).toBeLessThanOrEqual(2);
    }
  });

  it("places every arch03 strictly below its anchoring mount.y with dy ∈ [5, 40] (so y-sort draws pagoda on top of the spine)", () => {
    // arch03 must render after the mount in y-sort so the pagoda body isn't
    // overpainted by mountain ink. Sort is ascending → larger y draws last →
    // arch03.y must be strictly greater than the anchoring mount.y. Range cap
    // (40px) keeps the base visually attached to the spine.
    for (const seed of [42, 123, 52362, 58049, 91724, 7]) {
      prng.seed(seed);
      const planmtx: number[] = [];
      const plan = MountPlanner.plan(0, 2400, planmtx);
      const mounts = plan.filter((p) => p.tag === "mount");
      expect(mounts.length).toBeGreaterThan(0);

      const arch03s = plan.filter((p) => p.tag === "arch03");
      for (const a of arch03s) {
        const anchoring = mounts.filter((m) => Math.abs(m.x - a.x) <= 35);
        // The anchor was within ±15 of some mount when emitted; that mount
        // must still be present and dy must be in the new tight range.
        const onSpine = anchoring.some((m) => {
          const dy = a.y - m.y;
          return dy >= 5 && dy <= 40;
        });
        expect(onSpine).toBe(true);
      }
    }
  });

  it("places every arch02 strictly below its anchoring mount.y with dy ∈ [30, 80]", () => {
    // Same y-sort invariant as arch03: buildings must render after the
    // mountain so the structure isn't overpainted. arch02 sits lower on the
    // slope (mountY+30..+80) because it has a larger footprint that wants
    // flatter ground.
    for (const seed of [42, 123, 52362, 58049, 91724, 7]) {
      prng.seed(seed);
      const planmtx: number[] = [];
      const plan = MountPlanner.plan(0, 2400, planmtx);
      const mounts = plan.filter((p) => p.tag === "mount");
      expect(mounts.length).toBeGreaterThan(0);

      const arch02s = plan.filter((p) => p.tag === "arch02");
      for (const a of arch02s) {
        const anchoring = mounts.filter((m) => Math.abs(m.x - a.x) <= 35);
        const onSpine = anchoring.some((m) => {
          const dy = a.y - m.y;
          return dy >= 30 && dy <= 80;
        });
        expect(onSpine).toBe(true);
      }
    }
  });

  it("places every arch04 strictly below its anchoring mount.y with dy ∈ [25, 80]", () => {
    // Same contract as arch02 — semi-transparent multi-story, slightly
    // lighter footprint so it hugs the slope a touch higher (mountY+25..+80).
    for (const seed of [42, 123, 52362, 58049, 91724, 7]) {
      prng.seed(seed);
      const planmtx: number[] = [];
      const plan = MountPlanner.plan(0, 2400, planmtx);
      const mounts = plan.filter((p) => p.tag === "mount");
      expect(mounts.length).toBeGreaterThan(0);

      const arch04s = plan.filter((p) => p.tag === "arch04");
      for (const a of arch04s) {
        const anchoring = mounts.filter((m) => Math.abs(m.x - a.x) <= 35);
        const onSpine = anchoring.some((m) => {
          const dy = a.y - m.y;
          return dy >= 25 && dy <= 80;
        });
        expect(onSpine).toBe(true);
      }
    }
  });

  it("does not auto-place fishing boats in terrain chunks without an explicit water mask", () => {
    // Auto boat placement repeatedly produced fishermen on mountain ridges
    // because plan() knows land footprints but not real water polygons. Keep
    // default terrain chunks boat-free until a real water mask exists.
    for (const seed of [42, 123, 4678, 52362, 58049, 91724, 7]) {
      prng.seed(seed);
      const planmtx: number[] = [];
      const plan = MountPlanner.plan(0, 4800, planmtx);
      expect(plan.some((p) => p.tag === "boat")).toBe(false);
    }
  });

  it("fills explicit water regions outside visible foreground land collisions", () => {
    prng.seed(11);
    const plan: PlanItem[] = [
      { tag: "mount", x: 600, y: 700, h: 0.5 },
      { tag: "flatmount", x: 2300, y: 740, h: 0.4 },
    ];

    MountPlanner.fillShortfall(plan, {
      xmin: 0,
      xmax: 3000,
      planmtx: [],
      minCounts: { water: 1 },
      width: 3000,
      height: 800,
    });

    const waters = plan.filter((p) => p.tag === "water");
    expect(waters.length).toBe(1);
    for (const w of waters) {
      expect(w.y).toBeGreaterThanOrEqual(304);
      expect(w.y).toBeLessThanOrEqual(416);
      expect(w.h).toBe(360);
      if (w.y > 700 && w.y <= 840) expect(Math.abs(w.x - 600)).toBeGreaterThanOrEqual(520);
      if (w.y > 740 && w.y <= 800) expect(Math.abs(w.x - 2300)).toBeGreaterThanOrEqual(760);
    }
  });

  it("respects explicit water-band yRange when filling water shortfall", () => {
    prng.seed(19);
    const plan: PlanItem[] = [];

    MountPlanner.fillShortfall(plan, {
      xmin: 0,
      xmax: 3000,
      planmtx: [],
      minCounts: { water: 2 },
      width: 3000,
      height: 800,
      placement: {
        explicitWaterBand: {
          yRange: [620, 660],
        },
      },
    });

    const waters = plan.filter((p) => p.tag === "water");
    expect(waters.length).toBe(2);
    for (const w of waters) {
      expect(w.y).toBeGreaterThanOrEqual(620);
      expect(w.y).toBeLessThanOrEqual(660);
    }
  });

  it("fills boat shortfall by anchoring boats to explicit water regions only", () => {
    prng.seed(11);
    const plan: PlanItem[] = [
      { tag: "mount", x: 600, y: 700, h: 0.5 },
      { tag: "flatmount", x: 2300, y: 740, h: 0.4 },
    ];

    MountPlanner.fillShortfall(plan, {
      xmin: 0,
      xmax: 3000,
      planmtx: [],
      minCounts: { boat: 1 },
      width: 3000,
      height: 800,
    });

    const waters = plan.filter((p) => p.tag === "water");
    const boats = plan.filter((p) => p.tag === "boat");
    expect(waters.length).toBeGreaterThanOrEqual(1);
    expect(boats.length).toBe(1);
    for (const b of boats) {
      const waterAnchor = waters.some((w) => Math.abs(b.x - w.x) <= w.h / 2 && b.y === w.y);
      expect(waterAnchor).toBe(true);
      expect(b.y).toBeGreaterThanOrEqual(304);
      expect(b.y).toBeLessThanOrEqual(416);
      if (b.y > 700 && b.y <= 840) expect(Math.abs(b.x - 600)).toBeGreaterThanOrEqual(520);
      if (b.y > 740 && b.y <= 800) expect(Math.abs(b.x - 2300)).toBeGreaterThanOrEqual(760);
    }
  });

  it("preserves the boat-on-water invariant across chunk boundaries when caller threads landRegistry", () => {
    // SceneManager loads chunks of cwid=512, but mountains can be 600+ wide
    // and flatmounts up to 1000 — both can span chunk seams. Without
    // landRegistry, a boat in chunk N+1 doesn't see chunk N's mountain and
    // can land squarely on it. With landRegistry threaded through every
    // plan() call, the cross-chunk view is consistent.
    //
    // The user-visible bug is "fisherman on the ridge", which only manifests
    // when the boat is rendered ON TOP of the land (boat.y > land.y in the
    // ascending y-sort SceneManager uses). The reverse case (land drawn on
    // top, boat hidden behind) is wasteful but not visually wrong, so this
    // test asserts only the visible invariant.
    for (const seed of [0, 42, 123, 4678]) {
      prng.seed(seed);
      const planmtx: number[] = [];
      const landRegistry: PlanItem[] = [];
      const all: PlanItem[] = [];
      // Walk 12 contiguous 512-wide chunks (~6 viewport widths) the way
      // SceneManager.chunkLoader does.
      for (let c = 0; c < 12; c++) {
        const chunkPlan = MountPlanner.plan(c * 512, (c + 1) * 512, planmtx, landRegistry);
        all.push(...chunkPlan);
      }

      const boats = all.filter((p) => p.tag === "boat");
      const lands = all.filter((p) => p.tag === "mount" || p.tag === "flatmount");
      for (const b of boats) {
        for (const m of lands) {
          if (b.y <= m.y) continue; // boat hidden behind land — not the user-visible bug
          const halfWid = m.tag === "flatmount" ? 760 : 520;
          expect(Math.abs(m.x - b.x)).toBeGreaterThanOrEqual(halfWid);
        }
      }
    }
  });

  it("only anchors arch01..04 to mounts with y <= 380 (background/mid-range mountains, never shallow foreground bumps)", () => {
    // Anchored buildings must snap to mountains tall enough to host them.
    // A mount at y=540 is a foreground bump whose drawn body sits near the
    // waterline — a pavilion offset of +20..+80 would fall below the body
    // into open water. Pick background mountains only.
    for (const seed of [42, 123, 52362, 58049, 91724, 7]) {
      prng.seed(seed);
      const planmtx: number[] = [];
      const plan = MountPlanner.plan(0, 2400, planmtx);
      const mounts = plan.filter((p) => p.tag === "mount");

      const anchored = plan.filter(
        (p) => p.tag === "arch01" || p.tag === "arch02" || p.tag === "arch03" || p.tag === "arch04",
      );
      for (const a of anchored) {
        // Must be a background/mid-range mountain (y <= 380) within the
        // anchor x-range that's actually hosting this arch.
        const hostedBy = mounts.some((m) => Math.abs(m.x - a.x) <= 35 && m.y <= 380);
        expect(hostedBy).toBe(true);
      }
    }
  });

  it("places arch01 / arch03 y within [-40, +80] of some mount.y within its x-anchor range (on the mountain body, not on a fixed horizon)", () => {
    // With mount spacing as tight as ~10px and an x-jitter of ±15, "nearest
    // mount by x" can shift onto a neighbor of the anchoring mount. The
    // visually meaningful invariant is: there exists a mount within the
    // anchor x-range (≤35px) whose y is in [-40, +80] of the arch's y.
    for (const seed of [42, 123, 58049, 7]) {
      prng.seed(seed);
      const planmtx: number[] = [];
      const plan = MountPlanner.plan(0, 2400, planmtx);
      const mounts = plan.filter((p) => p.tag === "mount");
      expect(mounts.length).toBeGreaterThan(0);

      const anchored = plan.filter((p) => p.tag === "arch01" || p.tag === "arch03");
      for (const a of anchored) {
        const onMountainBody = mounts.some((m) => {
          if (Math.abs(m.x - a.x) > 35) return false;
          const dy = a.y - m.y;
          return dy >= -40 && dy <= 80;
        });
        expect(onMountainBody).toBe(true);
      }
    }
  });
});
