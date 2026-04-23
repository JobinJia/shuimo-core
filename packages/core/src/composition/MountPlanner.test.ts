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
});

describe("MountPlanner.plan anchored buildings", () => {
  it("places every arch01 / arch03 within ±35px of the nearest mount spine", () => {
    prng.seed(123);
    const planmtx: number[] = [];
    const plan = MountPlanner.plan(0, 2400, planmtx);

    const mounts = plan.filter((p) => p.tag === "mount");
    // Sanity: plan() on this seed must yield some mountains for the test to be
    // meaningful. If this ever fires, pick another seed.
    expect(mounts.length).toBeGreaterThan(0);

    const anchored = plan.filter((p) => p.tag === "arch01" || p.tag === "arch03");
    for (const a of anchored) {
      const nearest = mounts.reduce(
        (best, m) => Math.min(best, Math.abs(m.x - a.x)),
        Infinity,
      );
      expect(nearest).toBeLessThanOrEqual(35);
    }
  });
});
