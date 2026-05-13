import { Polygon, PolyTools } from "../../foundation/geometry";
import { noise, SimplexNoise, WorleyNoise } from "../../foundation/noise";
import { prng } from "../../foundation/random";
import { stroke } from "../../drawing/Stroke";
import { texture } from "../../drawing/Texture";
import { poly } from "../../utils/svg";
import { randChoice, normRand } from "../../utils/random";
import { loopNoise } from "../../utils/math";
import { div } from "../../drawing/div";
import { Tree } from "./Tree";
import { Arch } from "../objects/Arch";

export interface MountainOptions {
  hei?: number;
  wid?: number;
  tex?: number;
  veg?: boolean;
  ret?: number;
  col?: string | ((x: number) => string);
  layers?: boolean;
}

export interface FlatMountOptions {
  hei?: number;
  wid?: number;
  tex?: number;
  cho?: number;
  ret?: number;
  layers?: boolean;
}

export interface RockOptions {
  hei?: number;
  wid?: number;
  tex?: number;
  ret?: number;
  sha?: number;
}

export interface DistMountOptions {
  hei?: number;
  len?: number;
  seg?: number;
}

export interface MistyMountOptions {
  hei?: number;
  len?: number;
  layers?: number;
  /** 只渲染滤镜叠加层，用于调试对照 */
  filterOnly?: boolean;
}

interface FootOptions {
  xof?: number;
  yof?: number;
  ret?: number;
}

interface Bounds {
  xmin: number;
  xmax: number;
  ymin: number;
  ymax: number;
}

export interface LayeredMountSVG {
  base: string;
  overlay: string;
}

/**
 * Generate foot of mountain (internal helper)
 */
function foot(ptlist: Polygon[], options: FootOptions = {}): string | Polygon[] {
  const xof = options.xof ?? 0;
  const yof = options.yof ?? 0;
  const ret = options.ret ?? 0;

  const ftlist: Polygon[] = [];
  const span = 10;
  let ni = 0;

  for (let i = 0; i < ptlist.length - 2; i += 1) {
    if (i === ni) {
      ni = Math.min(ni + randChoice([1, 2]), ptlist.length - 1);

      ftlist.push([]);
      ftlist.push([]);

      for (let j = 0; j < Math.min(ptlist[i].length / 8, 10); j++) {
        ftlist[ftlist.length - 2].push([
          ptlist[i][j][0] + noise.noise(j * 0.1, i) * 10,
          ptlist[i][j][1],
        ]);
        ftlist[ftlist.length - 1].push([
          ptlist[i][ptlist[i].length - 1 - j][0] - noise.noise(j * 0.1, i) * 10,
          ptlist[i][ptlist[i].length - 1 - j][1],
        ]);
      }

      ftlist[ftlist.length - 2] = ftlist[ftlist.length - 2].reverse();
      ftlist[ftlist.length - 1] = ftlist[ftlist.length - 1].reverse();

      for (let j = 0; j < span; j++) {
        const p = j / span;
        const x1 = ptlist[i][0][0] * (1 - p) + ptlist[ni][0][0] * p;
        let y1 = ptlist[i][0][1] * (1 - p) + ptlist[ni][0][1] * p;

        const x2 =
          ptlist[i][ptlist[i].length - 1][0] * (1 - p) + ptlist[ni][ptlist[i].length - 1][0] * p;
        let y2 =
          ptlist[i][ptlist[i].length - 1][1] * (1 - p) + ptlist[ni][ptlist[i].length - 1][1] * p;

        const vib = -1.7 * (p - 1) * Math.pow(p, 1 / 5);
        y1 += vib * 5 + noise.noise(xof * 0.05, i) * 5;
        y2 += vib * 5 + noise.noise(xof * 0.05, i) * 5;

        ftlist[ftlist.length - 2].push([x1, y1]);
        ftlist[ftlist.length - 1].push([x2, y2]);
      }
    }
  }

  let canv = "";
  for (let i = 0; i < ftlist.length; i++) {
    canv += poly(ftlist[i], {
      xof: xof,
      yof: yof,
      fil: "white",
      str: "none",
    });
  }

  for (let j = 0; j < ftlist.length; j++) {
    canv += stroke(ftlist[j], {
      xof,
      yof,
      col: "rgba(100,100,100," + (0.1 + prng.random() * 0.1).toFixed(3) + ")",
      wid: 1,
    });
  }

  return ret ? ftlist : canv;
}

/**
 * Mount - Generate mountain landscapes
 */
export class Mount {
  /**
   * Generate a main mountain with vegetation
   */
  static mountain(
    xoff: number,
    yoff: number,
    seed: number,
    options: MountainOptions = {},
  ): string | [Polygon[]] | LayeredMountSVG {
    const hei = options.hei ?? 100 + prng.random() * 400;
    const wid = options.wid ?? 400 + prng.random() * 200;
    const tex = options.tex ?? 200;
    const veg = options.veg ?? true;
    const ret = options.ret ?? 0;
    const col = options.col;

    seed = seed ?? 0;

    let base = "";
    let overlay = "";

    const ptlist: Polygon[] = [];
    const h = hei;
    const w = wid;
    const reso = [10, 50];

    let hoff = 0;
    for (let j = 0; j < reso[0]; j++) {
      hoff += (prng.random() * yoff) / 100;
      ptlist.push([]);
      for (let i = 0; i < reso[1]; i++) {
        const x = (i / reso[1] - 0.5) * Math.PI;
        let y = Math.cos(x);
        y *= noise.noise(x + 10, j * 0.15, seed);
        const p = 1 - j / reso[0];
        ptlist[ptlist.length - 1].push([(x / Math.PI) * w * p, -y * h * p + hoff]);
      }
    }

    function vegetate(
      treeFunc: (x: number, y: number) => string,
      growthRule: (i: number, j: number) => boolean,
      proofRule: (neighbors: number[], veglist: Polygon, i: number) => boolean,
    ): void {
      const veglist: Polygon = [];
      for (let i = 0; i < ptlist.length; i += 1) {
        for (let j = 0; j < ptlist[i].length; j += 1) {
          if (growthRule(i, j)) {
            veglist.push([ptlist[i][j][0], ptlist[i][j][1]]);
          }
        }
      }

      // Build spatial hash by x-coordinate to avoid O(n²) distance checks
      const BUCKET = 60;
      const buckets = new Map<number, number[]>();
      for (let i = 0; i < veglist.length; i++) {
        const k = Math.floor(veglist[i][0] / BUCKET);
        if (!buckets.has(k)) buckets.set(k, []);
        buckets.get(k)!.push(i);
      }

      for (let i = 0; i < veglist.length; i++) {
        const bx = Math.floor(veglist[i][0] / BUCKET);
        const neighbors: number[] = [];
        for (let db = -1; db <= 1; db++) {
          const b = buckets.get(bx + db);
          if (b) neighbors.push(...b);
        }
        if (proofRule(neighbors, veglist, i)) {
          overlay += treeFunc(veglist[i][0], veglist[i][1]);
        }
      }
    }

    // RIM
    vegetate(
      (x, y) =>
        Tree.tree02(x + xoff, y + yoff - 5, {
          col:
            "rgba(100,100,100," +
            (noise.noise(0.01 * x, 0.01 * y) * 0.5 * 0.3 + 0.5).toFixed(3) +
            ")",
          clu: 2,
        }),
      (i, j) => {
        const ns = noise.noise(j * 0.1, seed);
        return i === 0 && ns * ns * ns < 0.1 && Math.abs(ptlist[i][j][1]) / h > 0.2;
      },
      (_neighbors, _veglist, _i) => true,
    );

    // WHITE BG
    base += poly(ptlist[0].concat([[0, reso[0] * 4]]), {
      xof: xoff,
      yof: yoff,
      fil: "white",
      str: "none",
    });

    // OUTLINE
    base += stroke(ptlist[0], {
      xof: xoff,
      yof: yoff,
      col: "rgba(100,100,100,0.3)",
      noi: 1,
      wid: 3,
    });

    base += foot(ptlist, { xof: xoff, yof: yoff }) as string;
    base += texture(ptlist, {
      xof: xoff,
      yof: yoff,
      tex: tex,
      sha: randChoice([0, 0, 0, 0, 5]),
      col: (progress: number, layerDepth: number) => {
        // If user provided a custom color string, use it
        if (typeof col === "string") {
          return col;
        }
        // If user provided a custom color function, use it
        if (typeof col === "function") {
          return col(progress);
        }
        // Default gradient: darker at bottom (layerDepth=1), lighter at top (layerDepth=0)
        // Exponential curve for more natural gradient
        // layerDepth^2 creates stronger contrast at the bottom
        const depthFactor = Math.pow(layerDepth, 1.5);
        // Base opacity ranges from 0.05 at top to 0.6 at bottom
        const baseOpacity = 0.05 + depthFactor * 0.55;
        // Add some randomness for natural variation
        const opacity = baseOpacity + prng.random() * 0.15;
        return `rgba(100,100,100,${opacity.toFixed(3)})`;
      },
    }) as string;

    // TOP
    vegetate(
      (x, y) =>
        Tree.tree02(x + xoff, y + yoff, {
          col:
            "rgba(100,100,100," +
            (noise.noise(0.01 * x, 0.01 * y) * 0.5 * 0.3 + 0.5).toFixed(3) +
            ")",
        }),
      (i, j) => {
        const ns = noise.noise(i * 0.1, j * 0.1, seed + 2);
        return ns * ns * ns < 0.1 && Math.abs(ptlist[i][j][1]) / h > 0.5;
      },
      (_neighbors, _veglist, _i) => true,
    );

    if (veg) {
      // MIDDLE
      vegetate(
        (x, y) => {
          let ht = ((h + y) / h) * 70;
          ht = ht * 0.3 + prng.random() * ht * 0.7;
          return Tree.tree01(x + xoff, y + yoff, {
            hei: ht,
            wid: prng.random() * 3 + 1,
            col:
              "rgba(100,100,100," +
              (noise.noise(0.01 * x, 0.01 * y) * 0.5 * 0.3 + 0.3).toFixed(3) +
              ")",
          });
        },
        (i, j) => {
          const ns = noise.noise(i * 0.2, j * 0.05, seed);
          return j % 2 && ns * ns * ns * ns < 0.012 && Math.abs(ptlist[i][j][1]) / h < 0.3;
        },
        (neighbors, veglist, i) => {
          let counter = 0;
          const xi = veglist[i][0];
          const yi = veglist[i][1];
          for (const j of neighbors) {
            if (i !== j && (xi - veglist[j][0]) ** 2 + (yi - veglist[j][1]) ** 2 < 900) {
              counter++;
            }
            if (counter > 2) return true;
          }
          return false;
        },
      );

      // BOTTOM
      vegetate(
        (x, y) => {
          let ht = ((h + y) / h) * 120;
          ht = ht * 0.5 + prng.random() * ht * 0.5;
          const bc = prng.random() * 0.1;
          const bp = 1;
          return Tree.tree03(x + xoff, y + yoff, {
            hei: ht,
            ben: (x: number) => Math.pow(x * bc, bp),
            col:
              "rgba(100,100,100," +
              (noise.noise(0.01 * x, 0.01 * y) * 0.5 * 0.3 + 0.3).toFixed(3) +
              ")",
          });
        },
        (i, j) => {
          const ns = noise.noise(i * 0.2, j * 0.05, seed);
          return (j === 0 || j === ptlist[i].length - 1) && ns * ns * ns * ns < 0.012;
        },
        (_neighbors, _veglist, _i) => true,
      );

      // BOTT ARCH
      vegetate(
        (x, y) => {
          const tt = randChoice([0, 0, 1, 1, 1, 2]);
          if (tt === 1) {
            return Arch.arch02(x + xoff, y + yoff, seed, {
              wid: normRand(40, 70),
              sto: randChoice([1, 2, 2, 3]),
              rot: prng.random(),
              sty: randChoice([1, 2, 3]),
            });
          } else if (tt === 2) {
            return Arch.arch04(x + xoff, y + yoff, seed, {
              sto: randChoice([1, 1, 1, 2, 2]),
            });
          } else {
            return "";
          }
        },
        (i, j) => {
          const ns = noise.noise(i * 0.2, j * 0.05, seed + 10);
          return (
            i !== 0 &&
            (j === 1 || j === ptlist[i].length - 2) &&
            ns * ns * ns * ns < 0.008
          );
        },
        (_neighbors, _veglist, _i) => true,
      );

      // TOP ARCH
      vegetate(
        (x, y) =>
          Arch.arch03(x + xoff, y + yoff, seed, {
            sto: randChoice([5, 7]),
            wid: 40 + prng.random() * 20,
          }),
        (i, j) =>
          i === 1 &&
          Math.abs(j - ptlist[i].length / 2) < 1 &&
          prng.random() < 0.02,
        (_neighbors, _veglist, _i) => true,
      );

      // TRANSM
      vegetate(
        (x, y) => Arch.transmissionTower01(x + xoff, y + yoff, seed),
        (i, j) => {
          const ns = noise.noise(i * 0.2, j * 0.05, seed + 20 * Math.PI);
          return (
            i % 2 === 0 &&
            (j === 1 || j === ptlist[i].length - 2) &&
            ns * ns * ns * ns < 0.002
          );
        },
        (_neighbors, _veglist, _i) => true,
      );

      // BOTT ROCK
      vegetate(
        (x, y) =>
          Mount.rock(x + xoff, y + yoff, seed, {
            wid: 20 + prng.random() * 20,
            hei: 20 + prng.random() * 20,
            sha: 2,
          }),
        (i, j) =>
          (j === 0 || j === ptlist[i].length - 1) && prng.random() < 0.1,
        (_neighbors, _veglist, _i) => true,
      );
    }

    if (ret === 0) {
      return options.layers ? { base, overlay } : base + overlay;
    } else {
      return [ptlist];
    }
  }

  /**
   * Generate a flat-topped mountain
   */
  static flatMount(
    xoff: number,
    yoff: number,
    seed: number,
    options: FlatMountOptions = {},
  ): string | LayeredMountSVG {
    const hei = options.hei ?? 40 + prng.random() * 400;
    const wid = options.wid ?? 400 + prng.random() * 200;
    const tex = options.tex ?? 80;
    const cho = options.cho ?? 0.5;

    seed = seed ?? 0;

    let base = "";
    let overlay = "";
    const ptlist: Polygon[] = [];
    const reso = [5, 50];
    let hoff = 0;
    const flat: Polygon[] = [];

    for (let j = 0; j < reso[0]; j++) {
      hoff += (prng.random() * yoff) / 100;
      ptlist.push([]);
      flat.push([]);
      for (let i = 0; i < reso[1]; i++) {
        const x = (i / reso[1] - 0.5) * Math.PI;
        let y = Math.cos(x * 2) + 1;
        y *= noise.noise(x + 10, j * 0.1, seed);
        const p = 1 - (j / reso[0]) * 0.6;
        const nx = (x / Math.PI) * wid * p;
        let ny = -y * hei * p + hoff;
        const h = 100;

        if (ny < -h * cho + hoff) {
          ny = -h * cho + hoff;
          if (flat[flat.length - 1].length % 2 === 0) {
            flat[flat.length - 1].push([nx, ny]);
          }
        } else {
          if (flat[flat.length - 1].length % 2 === 1) {
            flat[flat.length - 1].push(
              ptlist[ptlist.length - 1][ptlist[ptlist.length - 1].length - 1],
            );
          }
        }

        ptlist[ptlist.length - 1].push([nx, ny]);
      }
    }

    // WHITE BG
    base += poly(ptlist[0].concat([[0, reso[0] * 4]]), {
      xof: xoff,
      yof: yoff,
      fil: "white",
      str: "none",
    });

    // OUTLINE
    base += stroke(ptlist[0], {
      xof: xoff,
      yof: yoff,
      col: "rgba(100,100,100,0.3)",
      noi: 1,
      wid: 3,
    });

    base += texture(ptlist, {
      xof: xoff,
      yof: yoff,
      tex: tex,
      wid: 2,
      dis: () => {
        if (prng.random() > 0.5) {
          return 0.1 + 0.4 * prng.random();
        } else {
          return 0.9 - 0.4 * prng.random();
        }
      },
    }) as string;

    let grlist1: Polygon = [];
    let grlist2: Polygon = [];
    for (let i = 0; i < flat.length; i += 2) {
      if (flat[i].length >= 2) {
        grlist1.push(flat[i][0]);
        grlist2.push(flat[i][flat[i].length - 1]);
      }
    }

    if (grlist1.length === 0) {
      return options.layers ? { base, overlay } : base;
    }

    const wb = [grlist1[0][0], grlist2[0][0]];
    for (let i = 0; i < 3; i++) {
      const p = 0.8 - i * 0.2;
      grlist1.unshift([wb[0] * p, grlist1[0][1] - 5]);
      grlist2.unshift([wb[1] * p, grlist2[0][1] - 5]);
    }

    const wb2 = [grlist1[grlist1.length - 1][0], grlist2[grlist2.length - 1][0]];
    for (let i = 0; i < 3; i++) {
      const p = 0.6 - i * i * 0.1;
      grlist1.push([wb2[0] * p, grlist1[grlist1.length - 1][1] + 1]);
      grlist2.push([wb2[1] * p, grlist2[grlist2.length - 1][1] + 1]);
    }

    const d = 5;
    grlist1 = div(grlist1, d);
    grlist2 = div(grlist2, d);

    const grlist = grlist1.reverse().concat(grlist2.concat([grlist1[0]]));
    for (let i = 0; i < grlist.length; i++) {
      const v = (1 - Math.abs((i % d) - d / 2) / (d / 2)) * 0.12;
      grlist[i][0] *= 1 - v + noise.noise(grlist[i][1] * 0.5) * v;
    }

    base += poly(grlist, {
      xof: xoff,
      yof: yoff,
      str: "none",
      fil: "white",
      wid: 2,
    });

    base += stroke(grlist, {
      xof: xoff,
      yof: yoff,
      wid: 3,
      col: "rgba(100,100,100,0.2)",
    });

    function bound(plist: Polygon): Bounds {
      let xmin: number | undefined;
      let xmax: number | undefined;
      let ymin: number | undefined;
      let ymax: number | undefined;

      for (let i = 0; i < plist.length; i++) {
        if (xmin === undefined || plist[i][0] < xmin) {
          xmin = plist[i][0];
        }
        if (xmax === undefined || plist[i][0] > xmax) {
          xmax = plist[i][0];
        }
        if (ymin === undefined || plist[i][1] < ymin) {
          ymin = plist[i][1];
        }
        if (ymax === undefined || plist[i][1] > ymax) {
          ymax = plist[i][1];
        }
      }

      return { xmin: xmin!, xmax: xmax!, ymin: ymin!, ymax: ymax! };
    }

    overlay += Mount.flatDec(xoff, yoff, bound(grlist));

    return options.layers ? { base, overlay } : base + overlay;
  }

  /**
   * Add decorations to flat mountain
   */
  static flatDec(xoff: number, yoff: number, grbd: Bounds): string {
    let canv = "";

    const tt = randChoice([0, 0, 1, 2, 3, 4]);

    // Background rocks
    for (let j = 0; j < prng.random() * 5; j++) {
      canv += Mount.rock(
        xoff + normRand(grbd.xmin, grbd.xmax),
        yoff + (grbd.ymin + grbd.ymax) / 2 + normRand(-10, 10) + 10,
        prng.random() * 100,
        {
          wid: 10 + prng.random() * 20,
          hei: 10 + prng.random() * 20,
          sha: 2,
        },
      );
    }

    // Tree clusters
    for (let j = 0; j < randChoice([0, 0, 1, 2]); j++) {
      const xr = xoff + normRand(grbd.xmin, grbd.xmax);
      const yr = yoff + (grbd.ymin + grbd.ymax) / 2 + normRand(-5, 5) + 20;
      for (let k = 0; k < 2 + prng.random() * 3; k++) {
        canv += Tree.tree08(xr + Math.min(Math.max(normRand(-30, 30), grbd.xmin), grbd.xmax), yr, {
          hei: 60 + prng.random() * 40,
        });
      }
    }

    // Type-specific decorations
    if (tt === 0) {
      for (let j = 0; j < prng.random() * 3; j++) {
        canv += Mount.rock(
          xoff + normRand(grbd.xmin, grbd.xmax),
          yoff + (grbd.ymin + grbd.ymax) / 2 + normRand(-5, 5) + 20,
          prng.random() * 100,
          {
            wid: 50 + prng.random() * 20,
            hei: 40 + prng.random() * 20,
            sha: 5,
          },
        );
      }
    } else if (tt === 1) {
      const pmin = prng.random() * 0.5;
      const pmax = prng.random() * 0.5 + 0.5;
      const xmin = grbd.xmin * (1 - pmin) + grbd.xmax * pmin;
      const xmax = grbd.xmin * (1 - pmax) + grbd.xmax * pmax;
      for (let i = xmin; i < xmax; i += 30) {
        canv += Tree.tree05(
          xoff + i + 20 * normRand(-1, 1),
          yoff + (grbd.ymin + grbd.ymax) / 2 + 20,
          {
            hei: 100 + prng.random() * 200,
          },
        );
      }
      for (let j = 0; j < prng.random() * 4; j++) {
        canv += Mount.rock(
          xoff + normRand(grbd.xmin, grbd.xmax),
          yoff + (grbd.ymin + grbd.ymax) / 2 + normRand(-5, 5) + 20,
          prng.random() * 100,
          {
            wid: 50 + prng.random() * 20,
            hei: 40 + prng.random() * 20,
            sha: 5,
          },
        );
      }
    } else if (tt === 2) {
      for (let i = 0; i < randChoice([1, 1, 1, 1, 2, 2, 3]); i++) {
        const xr = normRand(grbd.xmin, grbd.xmax);
        const yr = (grbd.ymin + grbd.ymax) / 2;
        canv += Tree.tree04(xoff + xr, yoff + yr + 20, {});
        for (let j = 0; j < prng.random() * 2; j++) {
          canv += Mount.rock(
            xoff + Math.max(grbd.xmin, Math.min(grbd.xmax, xr + normRand(-50, 50))),
            yoff + yr + normRand(-5, 5) + 20,
            j * i * prng.random() * 100,
            {
              wid: 50 + prng.random() * 20,
              hei: 40 + prng.random() * 20,
              sha: 5,
            },
          );
        }
      }
    } else if (tt === 3) {
      for (let i = 0; i < randChoice([1, 1, 1, 1, 2, 2, 3]); i++) {
        canv += Tree.tree06(
          xoff + normRand(grbd.xmin, grbd.xmax),
          yoff + (grbd.ymin + grbd.ymax) / 2,
          {
            hei: 60 + prng.random() * 60,
          },
        );
      }
    } else if (tt === 4) {
      const pmin = prng.random() * 0.5;
      const pmax = prng.random() * 0.5 + 0.5;
      const xmin = grbd.xmin * (1 - pmin) + grbd.xmax * pmin;
      const xmax = grbd.xmin * (1 - pmax) + grbd.xmax * pmax;
      for (let i = xmin; i < xmax; i += 20) {
        canv += Tree.tree07(
          xoff + i + 20 * normRand(-1, 1),
          yoff + (grbd.ymin + grbd.ymax) / 2 + normRand(-1, 1) + 0,
          { hei: normRand(40, 80) },
        );
      }
    }

    // Small trees
    for (let i = 0; i < 50 * prng.random(); i++) {
      canv += Tree.tree02(
        xoff + normRand(grbd.xmin, grbd.xmax),
        yoff + normRand(grbd.ymin, grbd.ymax),
      );
    }

    // Note: Architecture would require Arch class implementation
    // Skipping Arch.arch01 call

    return canv;
  }

  /**
   * Generate distant mountain silhouette
   */
  static distMount(
    xoff: number,
    yoff: number,
    seed: number,
    options: DistMountOptions = {},
  ): string {
    const hei = options.hei ?? 300;
    const len = options.len ?? 2000;
    const seg = options.seg ?? 5;

    seed = seed ?? 0;
    let canv = "";
    const span = 10;

    const ptlist: Polygon[] = [];

    for (let i = 0; i < len / span / seg; i++) {
      ptlist.push([]);
      for (let j = 0; j < seg + 1; j++) {
        const tran = (k: number) => [
          xoff + k * span,
          yoff -
            hei *
              noise.noise(k * 0.05, seed) *
              Math.pow(Math.sin((Math.PI * k) / (len / span)), 0.5),
        ];
        ptlist[ptlist.length - 1].push(tran(i * seg + j) as [number, number]);
      }
      for (let j = 0; j < seg / 2 + 1; j++) {
        const tran = (k: number) => [
          xoff + k * span,
          yoff +
            24 *
              noise.noise(k * 0.05, 2, seed) *
              Math.pow(Math.sin((Math.PI * k) / (len / span)), 1),
        ];
        ptlist[ptlist.length - 1].unshift(tran(i * seg + j * 2) as [number, number]);
      }
    }

    for (let i = 0; i < ptlist.length; i++) {
      const getCol = (x: number, y: number) => {
        const c = (noise.noise(x * 0.02, y * 0.02, yoff) * 55 + 200) | 0;
        return "rgb(" + c + "," + c + "," + c + ")";
      };

      canv += poly(ptlist[i], {
        fil: getCol(ptlist[i][ptlist[i].length - 1][0], ptlist[i][ptlist[i].length - 1][1]),
        str: "none",
        wid: 1,
      });

      const T = PolyTools.triangulate(ptlist[i], {
        area: 100,
        convex: true,
        optimize: false,
      });

      for (let k = 0; k < T.length; k++) {
        const m = PolyTools.midPt(T[k]);
        const co = getCol(m[0], m[1]);
        canv += poly(T[k], { fil: co, str: co, wid: 1 });
      }
    }

    return canv;
  }

  /**
   * Generate misty mountain with soft gradients and halo effects
   * Uses Simplex Noise to create natural mountain contours
   */
  static mistyMount(
    xoff: number,
    yoff: number,
    seed: number,
    options: MistyMountOptions = {},
  ): string {
    const hei = options.hei ?? 200;
    const len = options.len ?? 2000;
    const layers = options.layers ?? 3;
    const filterOnly = options.filterOnly ?? false;

    seed = seed ?? 0;
    let canv = "";

    // Create Simplex Noise instance with seed
    const simplex = new SimplexNoise(seed);
    // Create Worley Noise instance for ink particle distribution
    const worley = new WorleyNoise(seed + 999);

    // Add SVG filter definitions for ink wash effect (模拟 Kuwahara Filter + 水墨扩散)
    const filterId = `ink-wash-${prng.random().toString(36).substr(2, 9)}`;
    const particleFilterId = `ink-particle-${prng.random().toString(36).substr(2, 9)}`;

    const blobFilterId = `ink-blob-${prng.random().toString(36).substr(2, 9)}`;

    canv += `<defs>
      <!-- Main ink wash filter for mountain body (大墨块离散效果) -->
      <filter id="${filterId}" x="-100%" y="-100%" width="300%" height="300%">
        <!-- Step 1: Low frequency noise for large ink blobs -->
        <feTurbulence type="fractalNoise" baseFrequency="0.005 0.003" numOctaves="3" seed="${seed}" result="blobNoise" />

        <!-- Step 2: Large displacement for scattered ink effect -->
        <feDisplacementMap in="SourceGraphic" in2="blobNoise" scale="40" xChannelSelector="R" yChannelSelector="G" result="displaced" />

        <!-- Step 3: Heavy blur for soft, diffuse edges -->
        <feGaussianBlur in="displaced" stdDeviation="15" result="blurred" />

        <!-- Step 4: Create mask to break into discrete blobs -->
        <feTurbulence type="turbulence" baseFrequency="0.008 0.006" numOctaves="2" seed="${seed + 50}" result="maskNoise" />
        <feComponentTransfer in="maskNoise" result="blobMask">
          <feFuncA type="discrete" tableValues="0 0 0.3 0.6 0.8 1" />
        </feComponentTransfer>
        <feComposite operator="in" in="blurred" in2="blobMask" result="masked" />

        <!-- Step 5: Extra blur for transparent fade at edges -->
        <feGaussianBlur in="masked" stdDeviation="8" result="final" />
      </filter>

      <!-- Particle filter for ink dots (墨粒滤镜) -->
      <filter id="${particleFilterId}" x="-50%" y="-50%" width="200%" height="200%">
        <!-- Generate organic noise for particle edges -->
        <feTurbulence type="turbulence" baseFrequency="0.08" numOctaves="3" seed="${seed + 100}" result="particleNoise" />

        <!-- Create irregular particle edges (墨粒边缘不规则) - INCREASED -->
        <feDisplacementMap in="SourceGraphic" in2="particleNoise" scale="3.5" result="displaced" />

        <!-- Blur for soft ink bleeding - INCREASED -->
        <feGaussianBlur in="displaced" stdDeviation="1.8" result="blurred" />

        <!-- Add texture - ENHANCED -->
        <feComponentTransfer in="particleNoise" result="textureMask">
          <feFuncA type="linear" slope="1.4" intercept="-0.15" />
        </feComponentTransfer>
        <feComposite operator="in" in="blurred" in2="textureMask" />
      </filter>

      <!-- Blob filter for ink wash blobs (墨块滤镜 - 毛边效果) -->
      <filter id="${blobFilterId}" x="-50%" y="-50%" width="200%" height="200%">
        <!-- 高频噪声用于边缘毛糙 -->
        <feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves="3" seed="${seed + 200}" result="roughNoise" />

        <!-- 边缘扰动，产生毛边 -->
        <feDisplacementMap in="SourceGraphic" in2="roughNoise" scale="5" xChannelSelector="R" yChannelSelector="G" result="roughEdge" />

        <!-- 轻微模糊，柔化但不糊掉 -->
        <feGaussianBlur in="roughEdge" stdDeviation="1.5" result="final" />
      </filter>
    </defs>`;

    // Generate mountain layers from back to front
    for (let layer = 0; layer < layers; layer++) {
      const layerDepth = layer / layers; // 0 = far, 1 = near
      const layerSeed = seed + layer * 100;

      // Assume canvas height is approximately len/2 (e.g., 1400 -> 700)
      const canvasHeight = len / 2;

      // Vertical offset for each layer: far mountains higher, near mountains lower
      // Far mountains (layerDepth=0) pushed up, near mountains (layerDepth=1) at bottom
      const layerVerticalOffset = -(1 - layerDepth) * hei * 1.5; // Far: -270, Near: 0

      // Bottom 1/4 of canvas: from (3/4 * canvasHeight) to canvasHeight
      // For len=1400, canvasHeight=700, bottom 1/4 is from y=525 to y=700
      const bottomQuarterTop = canvasHeight * 0.75 + layerVerticalOffset;
      const bottomQuarterBottom = canvasHeight + layerVerticalOffset;
      const quarterRange = bottomQuarterBottom - bottomQuarterTop;

      // Random starting point at left edge (within bottom 1/4)
      // Map noise [-1, 1] to [0, 1] for position within bottom quarter
      const leftHeightFactor = (noise.noise(layerSeed, 0.1, 0.2) + 1) / 2;
      const startY = bottomQuarterTop + quarterRange * leftHeightFactor;

      // Random ending point at right edge (within bottom 1/4)
      const rightHeightFactor = (noise.noise(layerSeed, 0.3, 0.4) + 1) / 2;
      const endY = bottomQuarterTop + quarterRange * rightHeightFactor;

      // Generate mountain ridge using FBM (linear interpolation baseline)
      const ridgeLine: Polygon = [];
      const resolution = 200;

      for (let i = 0; i <= resolution; i++) {
        const t = i / resolution; // Progress from 0 to 1
        const x = xoff - len / 2 + t * len; // From left edge to right edge

        // Linear interpolation between start and end points (baseline)
        const baselineY = startY * (1 - t) + endY * t;

        // Use Simplex Noise with multiple octaves for rich detail
        let noiseValue = 0;
        let amplitude = 1.0;
        let frequency = 2.0;
        let maxValue = 0;

        // Combine 6 octaves of Simplex Noise
        for (let octave = 0; octave < 6; octave++) {
          noiseValue += simplex.noise2D(t * frequency, layerSeed + octave) * amplitude;
          maxValue += amplitude;
          amplitude *= 0.5; // Persistence: each octave has half the amplitude
          frequency *= 2.0; // Lacunarity: each octave has double the frequency
        }

        // Normalize to [-1, 1]
        noiseValue = noiseValue / maxValue;

        // Scale by height parameter with increased amplitude
        // Mountain peaks go upward (negative Y), so subtract noise value
        // Far mountains: less dramatic (1.5x), Near mountains: more dramatic (3.5x)
        const amplitudeScale = 1.5 + layerDepth * 2.0; // 1.5 to 3.5
        const mountainY = baselineY - Math.abs(noiseValue) * hei * amplitudeScale;

        ridgeLine.push([x, mountainY]);
      }

      // Create closed mountain polygon
      const mountainPoly: Polygon = [];
      const baseY = canvasHeight; // Extend to canvas bottom

      // Start from bottom left
      mountainPoly.push([ridgeLine[0][0], baseY]);

      // Add the entire ridge line
      for (const pt of ridgeLine) {
        mountainPoly.push(pt);
      }

      // Close to bottom right
      mountainPoly.push([ridgeLine[ridgeLine.length - 1][0], baseY]);

      // Calculate opacity and color based on layer depth
      // Far mountains (layerDepth=0) are lighter, near mountains (layerDepth=1) are darker
      // Increased opacity to compensate for texture filter lightening effect

      // Color gradation: ink cyan-blue tone (墨青色) - traditional Chinese ink wash
      // Far: (50, 65, 80) light ink cyan
      // Near: (15, 20, 30) deep ink cyan, almost black
      const r = Math.round(50 - layerDepth * 35); // 50 to 15
      const g = Math.round(65 - layerDepth * 45); // 65 to 20
      const b = Math.round(80 - layerDepth * 50); // 80 to 30

      // Render all layers to create depth effect
      // First: Draw opaque background to block mountains behind (occlusion effect)
      // canv += poly(mountainPoly, {
      //   fil: '#f5f5dc', // Beige background color (matches canvas background)
      //   str: 'none',
      // });

      // Second: 山体深色底 + 噪声淡化效果
      if (!filterOnly) {
        const textureFilterId = `texture-${layer}-${layerSeed}`;
        const gradientId = `mount-gradient-${layer}-${prng.random().toString(36).substr(2, 9)}`;

        // 噪声滤镜：让部分区域变淡
        canv += `<defs>
          <linearGradient id="${gradientId}" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="rgba(13, 29, 25, 1)" />
            <stop offset="60%" stop-color="rgba(13, 29, 25, 0.6)" />
            <stop offset="100%" stop-color="rgba(13, 29, 25, 0.15)" />
          </linearGradient>
          <filter id="${textureFilterId}" x="0%" y="0%" width="100%" height="100%">
            <!-- 生成斑驳噪声 -->
            <feTurbulence type="fractalNoise" baseFrequency="0.004" numOctaves="3" seed="${Math.floor(seed % 10000)}" result="noise" />
            <!-- 把噪声转成透明度遮罩 -->
            <feColorMatrix in="noise" type="matrix" values="
              0 0 0 0 0
              0 0 0 0 0
              0 0 0 0 0
              0.3 0.3 0.3 0 0.3
            " result="alphaMask" />
            <!-- 用噪声遮罩裁剪原图（只影响透明度） -->
            <feComposite in="SourceGraphic" in2="alphaMask" operator="in" />
          </filter>
        </defs>`;

        // 绘制山体（深色底 + 噪声淡化）
        const texturePointsStr = mountainPoly
          .map((p) => `${p[0].toFixed(2)},${p[1].toFixed(2)}`)
          .join(" ");
        canv += `<polygon
          points="${texturePointsStr}"
          fill="url(#${gradientId})"
          filter="url(#${textureFilterId})"
        />`;
      }

      // Draw ridge outline with varying detail based on depth
      if (!filterOnly) {
        if (layerDepth > 0.6) {
          // Near mountains: NO outline (空白，无轮廓线)
          // Skip drawing outline for near mountains to create depth contrast
        } else {
          // Far mountains: darker stroke for depth (浓墨) - crisp outline without blur
          canv += stroke(ridgeLine, {
            col: "rgba(20, 20, 20, 0.9)",
            wid: 4,
            noi: 1,
          });
        }
      }

      // ===== Ink Particle Effect (皴法) using Worley Noise =====
      // Generate ink particles along the mountain surface
      // Near mountains have denser, larger particles; far mountains have sparse, smaller particles

      const amplitudeScale = 1.5 + layerDepth * 2.0; // 1.5 to 3.5 (same as ridgeLine generation)

      if (filterOnly) continue; // 只渲染滤镜层时跳过皴法

      const particleDensity = 0.3 + layerDepth * 0.7;
      const particleSize = 0.8 + layerDepth * 1.7;
      const particleCount = Math.floor(len * particleDensity * 0.2);

      for (let p = 0; p < particleCount; p++) {
        // Random position along the mountain width
        const t = prng.random();
        const x = xoff - len / 2 + t * len;

        // Use Worley noise to determine if particle should appear at this location
        // Lower Worley values = closer to cell center = place particle
        const worleyValue = worley.noise2D(x * 0.008, layerSeed * 0.01, {
          cellSize: 40 + layerDepth * 60, // Far: larger cells (sparse), Near: smaller cells (dense)
          jitter: 0.9,
        });

        // Only place particle if Worley value is below threshold
        // Lower threshold = fewer particles, higher = more particles
        const threshold = 0.45 + layerDepth * 0.25; // Increased from 0.35-0.5 to 0.45-0.7
        if (worleyValue > threshold) continue;

        // Find corresponding Y position on the ridge line
        const ridgeIndex = Math.floor(t * resolution);
        const baseY = ridgeLine[ridgeIndex]?.[1] ?? canvasHeight;

        // Offset Y position using another Worley noise layer for vertical distribution
        // Particles should cluster more near ridges and peaks
        const verticalNoise = worley.noise2D(x * 0.012, (layerSeed + 50) * 0.01, {
          cellSize: 30,
          jitter: 0.8,
        });

        // Vertical offset: particles distributed from ridge down to base
        // Use inverted Worley noise to cluster near peaks (low values)
        const maxVerticalOffset = hei * amplitudeScale * 0.6; // Particles spread down from ridge
        const verticalOffset = (1 - verticalNoise) * maxVerticalOffset * prng.random();
        const y = baseY + verticalOffset;

        // Particle size with variation
        const baseSize = particleSize * (0.6 + prng.random() * 0.8);

        // Particle opacity based on layer depth and Worley noise
        // Near mountains: darker particles, far mountains: lighter particles
        const baseOpacity = 0.15 + layerDepth * 0.25; // 0.15 to 0.4
        const opacity = baseOpacity * (0.5 + worleyValue);

        // Particle color: inherit from mountain color but slightly darker
        const particleR = Math.max(0, r - 10);
        const particleG = Math.max(0, g - 15);
        const particleB = Math.max(0, b - 10);

        // Draw ink particle as small circle with soft edges
        canv +=
          `<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="${baseSize.toFixed(2)}" ` +
          `fill="rgba(${particleR}, ${particleG}, ${particleB}, ${opacity.toFixed(3)})" ` +
          `filter="url(#${particleFilterId})" />`;
      }

      // ===== Vertical Texture Strokes (皴法) using Noise Mask =====
      // Add vertical strokes to simulate traditional Chinese painting texture
      // Denser and darker near ridges, lighter towards base

      if (layerDepth > 0.4) {
        // Only apply texture strokes to mid and near layers for performance
        const strokeDensity = 0.4 + layerDepth * 0.6; // 0.4 to 1.0
        const strokeCount = Math.floor(len * strokeDensity * 0.08);

        for (let s = 0; s < strokeCount; s++) {
          const t = prng.random();
          const x = xoff - len / 2 + t * len;

          // Use Worley noise to determine stroke placement
          const worleyValue = worley.noise2D(x * 0.015, layerSeed * 0.015, {
            cellSize: 30 + (1 - layerDepth) * 40,
            jitter: 0.85,
          });

          // Only place stroke if Worley value suggests it
          if (worleyValue > 0.4) continue;

          // Find ridge position
          const ridgeIndex = Math.floor(t * resolution);
          const ridgeY = ridgeLine[ridgeIndex]?.[1] ?? canvasHeight;

          // Stroke extends from ridge downward
          // Length controlled by Simplex noise
          const lengthNoise = simplex.noise2D(x * 0.02, layerSeed * 0.02);
          const strokeLength = hei * amplitudeScale * (0.2 + Math.abs(lengthNoise) * 0.5);

          // Start position: slightly below ridge (using noise for variation)
          const startOffset = hei * 0.1 * prng.random();
          const startY = ridgeY + startOffset;
          const endY = ridgeY + strokeLength;

          // Opacity based on distance from ridge (darker near ridge)
          // Use Simplex noise to create natural variation
          const opacityNoise = simplex.noise2D(x * 0.025, (layerSeed + 200) * 0.025);
          const baseStrokeOpacity = 0.12 + layerDepth * 0.18; // 0.12 to 0.3
          const strokeOpacity = baseStrokeOpacity * (0.6 + Math.abs(opacityNoise) * 0.4);

          // Stroke width with variation
          const strokeWidth = (0.5 + prng.random() * 1.0) * (1 + layerDepth * 0.5);

          // Color: slightly darker than mountain base
          const strokeR = Math.max(0, r - 15);
          const strokeG = Math.max(0, g - 20);
          const strokeB = Math.max(0, b - 15);

          // Draw vertical texture stroke
          canv +=
            `<line x1="${x.toFixed(2)}" y1="${startY.toFixed(2)}" ` +
            `x2="${x.toFixed(2)}" y2="${endY.toFixed(2)}" ` +
            `stroke="rgba(${strokeR}, ${strokeG}, ${strokeB}, ${strokeOpacity.toFixed(3)})" ` +
            `stroke-width="${strokeWidth.toFixed(2)}" ` +
            `stroke-linecap="round" ` +
            `filter="url(#${particleFilterId})" />`;
        }
      }
    }

    return canv;
  }

  /**
   * Generate a rock
   */
  static rock(xoff: number, yoff: number, seed: number, options: RockOptions = {}): string {
    const hei = options.hei ?? 80;
    const wid = options.wid ?? 100;
    const tex = options.tex ?? 40;
    const sha = options.sha ?? 10;

    seed = seed ?? 0;

    let canv = "";

    const reso = [10, 50];
    const ptlist: Polygon[] = [];

    for (let i = 0; i < reso[0]; i++) {
      ptlist.push([]);

      const nslist: number[] = [];
      for (let j = 0; j < reso[1]; j++) {
        nslist.push(noise.noise(i, j * 0.2, seed));
      }
      loopNoise(nslist);

      for (let j = 0; j < reso[1]; j++) {
        const a = (j / reso[1]) * Math.PI * 2 - Math.PI / 2;
        let l =
          (wid * hei) / Math.sqrt(Math.pow(hei * Math.cos(a), 2) + Math.pow(wid * Math.sin(a), 2));

        l *= 0.7 + 0.3 * nslist[j];

        const p = 1 - i / reso[0];

        let nx = Math.cos(a) * l * p;
        let ny = -Math.sin(a) * l * p;

        if (Math.PI < a || a < 0) {
          ny *= 0.2;
        }

        ny += hei * (i / reso[0]) * 0.2;

        ptlist[ptlist.length - 1].push([nx, ny]);
      }
    }

    // WHITE BG
    canv += poly(ptlist[0].concat([[0, 0]]), {
      xof: xoff,
      yof: yoff,
      fil: "white",
      str: "none",
    });

    // OUTLINE
    canv += stroke(
      ptlist[0].map((x) => [x[0] + xoff, x[1] + yoff]),
      { col: "rgba(100,100,100,0.3)", noi: 1, wid: 3 },
    );

    canv += texture(ptlist, {
      xof: xoff,
      yof: yoff,
      tex: tex,
      wid: 3,
      sha: sha,
      col: (_progress: number, _layerDepth: number) =>
        "rgba(180,180,180," + (0.3 + prng.random() * 0.3).toFixed(3) + ")",
      dis: () => {
        if (prng.random() > 0.5) {
          return 0.15 + 0.15 * prng.random();
        } else {
          return 0.85 - 0.15 * prng.random();
        }
      },
    }) as string;

    return canv;
  }
}
