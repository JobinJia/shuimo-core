import { Polygon, PolyTools } from '../../foundation/geometry';
import { noise, SimplexNoise, WorleyNoise } from '../../foundation/noise';
import { stroke } from '../../drawing/Stroke';
import { texture } from '../../drawing/Texture';
import { poly } from '../../utils/svg';
import { randChoice, normRand } from '../../utils/random';
import { loopNoise } from '../../utils/math';
import { div } from '../../drawing/div';
import { Tree } from './Tree';

export interface MountainOptions {
  hei?: number;
  wid?: number;
  tex?: number;
  veg?: boolean;
  ret?: number;
  col?: string | ((x: number) => string);
}

export interface FlatMountOptions {
  hei?: number;
  wid?: number;
  tex?: number;
  cho?: number;
  ret?: number;
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

        const x2 = ptlist[i][ptlist[i].length - 1][0] * (1 - p) + ptlist[ni][ptlist[i].length - 1][0] * p;
        let y2 = ptlist[i][ptlist[i].length - 1][1] * (1 - p) + ptlist[ni][ptlist[i].length - 1][1] * p;

        const vib = -1.7 * (p - 1) * Math.pow(p, 1 / 5);
        y1 += vib * 5 + noise.noise(xof * 0.05, i) * 5;
        y2 += vib * 5 + noise.noise(xof * 0.05, i) * 5;

        ftlist[ftlist.length - 2].push([x1, y1]);
        ftlist[ftlist.length - 1].push([x2, y2]);
      }
    }
  }

  let canv = '';
  for (let i = 0; i < ftlist.length; i++) {
    canv += poly(ftlist[i], {
      xof: xof,
      yof: yof,
      fil: 'white',
      str: 'none',
    });
  }

  for (let j = 0; j < ftlist.length; j++) {
    canv += stroke(
      ftlist[j].map((x) => [x[0] + xof, x[1] + yof]),
      {
        col: 'rgba(100,100,100,' + (0.1 + Math.random() * 0.1).toFixed(3) + ')',
        wid: 1,
      }
    );
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
  static mountain(xoff: number, yoff: number, seed: number, options: MountainOptions = {}): string | [Polygon[]] {
    const hei = options.hei ?? 100 + Math.random() * 400;
    const wid = options.wid ?? 400 + Math.random() * 200;
    const tex = options.tex ?? 200;
    const veg = options.veg ?? true;
    const ret = options.ret ?? 0;
    const col = options.col;

    seed = seed ?? 0;

    let canv = '';

    const ptlist: Polygon[] = [];
    const h = hei;
    const w = wid;
    const reso = [10, 50];

    let hoff = 0;
    for (let j = 0; j < reso[0]; j++) {
      hoff += (Math.random() * yoff) / 100;
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
      proofRule: (veglist: Polygon, i: number) => boolean
    ): void {
      const veglist: Polygon = [];
      for (let i = 0; i < ptlist.length; i += 1) {
        for (let j = 0; j < ptlist[i].length; j += 1) {
          if (growthRule(i, j)) {
            veglist.push([ptlist[i][j][0], ptlist[i][j][1]]);
          }
        }
      }
      for (let i = 0; i < veglist.length; i++) {
        if (proofRule(veglist, i)) {
          canv += treeFunc(veglist[i][0], veglist[i][1]);
        }
      }
    }

    // RIM
    vegetate(
      (x, y) =>
        Tree.tree02(x + xoff, y + yoff - 5, {
          col: 'rgba(100,100,100,' + (noise.noise(0.01 * x, 0.01 * y) * 0.5 * 0.3 + 0.5).toFixed(3) + ')',
          clu: 2,
        }),
      (i, j) => {
        const ns = noise.noise(j * 0.1, seed);
        return i === 0 && ns * ns * ns < 0.1 && Math.abs(ptlist[i][j][1]) / h > 0.2;
      },
      (veglist, i) => true
    );

    // WHITE BG
    canv += poly(ptlist[0].concat([[0, reso[0] * 4]]), {
      xof: xoff,
      yof: yoff,
      fil: 'white',
      str: 'none',
    });

    // OUTLINE
    canv += stroke(
      ptlist[0].map((x) => [x[0] + xoff, x[1] + yoff]),
      { col: 'rgba(100,100,100,0.3)', noi: 1, wid: 3 }
    );

    canv += foot(ptlist, { xof: xoff, yof: yoff }) as string;
    canv += texture(ptlist, {
      xof: xoff,
      yof: yoff,
      tex: tex,
      sha: randChoice([0, 0, 0, 0, 5]),
      col: (progress: number, layerDepth: number) => {
        // If user provided a custom color string, use it
        if (typeof col === 'string') {
          return col;
        }
        // If user provided a custom color function, use it
        if (typeof col === 'function') {
          return col(progress);
        }
        // Default gradient: darker at bottom (layerDepth=1), lighter at top (layerDepth=0)
        // Exponential curve for more natural gradient
        // layerDepth^2 creates stronger contrast at the bottom
        const depthFactor = Math.pow(layerDepth, 1.5);
        // Base opacity ranges from 0.05 at top to 0.6 at bottom
        const baseOpacity = 0.05 + depthFactor * 0.55;
        // Add some randomness for natural variation
        const opacity = baseOpacity + Math.random() * 0.15;
        return `rgba(100,100,100,${opacity.toFixed(3)})`;
      },
    }) as string;

    // TOP
    vegetate(
      (x, y) =>
        Tree.tree02(x + xoff, y + yoff, {
          col: 'rgba(100,100,100,' + (noise.noise(0.01 * x, 0.01 * y) * 0.5 * 0.3 + 0.5).toFixed(3) + ')',
        }),
      (i, j) => {
        const ns = noise.noise(i * 0.1, j * 0.1, seed + 2);
        return ns * ns * ns < 0.1 && Math.abs(ptlist[i][j][1]) / h > 0.5;
      },
      (veglist, i) => true
    );

    if (veg) {
      // MIDDLE
      vegetate(
        (x, y) => {
          let ht = ((h + y) / h) * 70;
          ht = ht * 0.3 + Math.random() * ht * 0.7;
          return Tree.tree01(x + xoff, y + yoff, {
            hei: ht,
            wid: Math.random() * 3 + 1,
            col: 'rgba(100,100,100,' + (noise.noise(0.01 * x, 0.01 * y) * 0.5 * 0.3 + 0.3).toFixed(3) + ')',
          });
        },
        (i, j) => {
          const ns = noise.noise(i * 0.2, j * 0.05, seed);
          return j % 2 && ns * ns * ns * ns < 0.012 && Math.abs(ptlist[i][j][1]) / h < 0.3;
        },
        (veglist, i) => {
          let counter = 0;
          for (let j = 0; j < veglist.length; j++) {
            if (
              i !== j &&
              Math.pow(veglist[i][0] - veglist[j][0], 2) + Math.pow(veglist[i][1] - veglist[j][1], 2) <
                30 * 30
            ) {
              counter++;
            }
            if (counter > 2) {
              return true;
            }
          }
          return false;
        }
      );

      // BOTTOM
      vegetate(
        (x, y) => {
          let ht = ((h + y) / h) * 120;
          ht = ht * 0.5 + Math.random() * ht * 0.5;
          const bc = Math.random() * 0.1;
          const bp = 1;
          return Tree.tree03(x + xoff, y + yoff, {
            hei: ht,
            ben: (x: number) => Math.pow(x * bc, bp),
            col: 'rgba(100,100,100,' + (noise.noise(0.01 * x, 0.01 * y) * 0.5 * 0.3 + 0.3).toFixed(3) + ')',
          });
        },
        (i, j) => {
          const ns = noise.noise(i * 0.2, j * 0.05, seed);
          return (j === 0 || j === ptlist[i].length - 1) && ns * ns * ns * ns < 0.012;
        },
        (veglist, i) => true
      );
    }

    // Note: Architecture and rock decorations would require Arch class to be implemented
    // Skipping those parts for now as they depend on Arch class

    if (ret === 0) {
      return canv;
    } else {
      return [ptlist];
    }
  }

  /**
   * Generate a flat-topped mountain
   */
  static flatMount(xoff: number, yoff: number, seed: number, options: FlatMountOptions = {}): string {
    const hei = options.hei ?? 40 + Math.random() * 400;
    const wid = options.wid ?? 400 + Math.random() * 200;
    const tex = options.tex ?? 80;
    const cho = options.cho ?? 0.5;
    const ret = options.ret ?? 0;

    seed = seed ?? 0;

    let canv = '';
    const ptlist: Polygon[] = [];
    const reso = [5, 50];
    let hoff = 0;
    const flat: Polygon[] = [];

    for (let j = 0; j < reso[0]; j++) {
      hoff += (Math.random() * yoff) / 100;
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
            flat[flat.length - 1].push(ptlist[ptlist.length - 1][ptlist[ptlist.length - 1].length - 1]);
          }
        }

        ptlist[ptlist.length - 1].push([nx, ny]);
      }
    }

    // WHITE BG
    canv += poly(ptlist[0].concat([[0, reso[0] * 4]]), {
      xof: xoff,
      yof: yoff,
      fil: 'white',
      str: 'none',
    });

    // OUTLINE
    canv += stroke(
      ptlist[0].map((x) => [x[0] + xoff, x[1] + yoff]),
      { col: 'rgba(100,100,100,0.3)', noi: 1, wid: 3 }
    );

    canv += texture(ptlist, {
      xof: xoff,
      yof: yoff,
      tex: tex,
      wid: 2,
      dis: () => {
        if (Math.random() > 0.5) {
          return 0.1 + 0.4 * Math.random();
        } else {
          return 0.9 - 0.4 * Math.random();
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
      return canv;
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

    canv += poly(grlist, {
      xof: xoff,
      yof: yoff,
      str: 'none',
      fil: 'white',
      wid: 2,
    });

    canv += stroke(
      grlist.map((x) => [x[0] + xoff, x[1] + yoff]),
      {
        wid: 3,
        col: 'rgba(100,100,100,0.2)',
      }
    );

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

    canv += Mount.flatDec(xoff, yoff, bound(grlist));

    return canv;
  }

  /**
   * Add decorations to flat mountain
   */
  static flatDec(xoff: number, yoff: number, grbd: Bounds): string {
    let canv = '';

    const tt = randChoice([0, 0, 1, 2, 3, 4]);

    // Background rocks
    for (let j = 0; j < Math.random() * 5; j++) {
      canv += Mount.rock(
        xoff + normRand(grbd.xmin, grbd.xmax),
        yoff + (grbd.ymin + grbd.ymax) / 2 + normRand(-10, 10) + 10,
        Math.random() * 100,
        {
          wid: 10 + Math.random() * 20,
          hei: 10 + Math.random() * 20,
          sha: 2,
        }
      );
    }

    // Tree clusters
    for (let j = 0; j < randChoice([0, 0, 1, 2]); j++) {
      const xr = xoff + normRand(grbd.xmin, grbd.xmax);
      const yr = yoff + (grbd.ymin + grbd.ymax) / 2 + normRand(-5, 5) + 20;
      for (let k = 0; k < 2 + Math.random() * 3; k++) {
        canv += Tree.tree08(xr + Math.min(Math.max(normRand(-30, 30), grbd.xmin), grbd.xmax), yr, {
          hei: 60 + Math.random() * 40,
        });
      }
    }

    // Type-specific decorations
    if (tt === 0) {
      for (let j = 0; j < Math.random() * 3; j++) {
        canv += Mount.rock(
          xoff + normRand(grbd.xmin, grbd.xmax),
          yoff + (grbd.ymin + grbd.ymax) / 2 + normRand(-5, 5) + 20,
          Math.random() * 100,
          {
            wid: 50 + Math.random() * 20,
            hei: 40 + Math.random() * 20,
            sha: 5,
          }
        );
      }
    } else if (tt === 1) {
      const pmin = Math.random() * 0.5;
      const pmax = Math.random() * 0.5 + 0.5;
      const xmin = grbd.xmin * (1 - pmin) + grbd.xmax * pmin;
      const xmax = grbd.xmin * (1 - pmax) + grbd.xmax * pmax;
      for (let i = xmin; i < xmax; i += 30) {
        canv += Tree.tree05(xoff + i + 20 * normRand(-1, 1), yoff + (grbd.ymin + grbd.ymax) / 2 + 20, {
          hei: 100 + Math.random() * 200,
        });
      }
      for (let j = 0; j < Math.random() * 4; j++) {
        canv += Mount.rock(
          xoff + normRand(grbd.xmin, grbd.xmax),
          yoff + (grbd.ymin + grbd.ymax) / 2 + normRand(-5, 5) + 20,
          Math.random() * 100,
          {
            wid: 50 + Math.random() * 20,
            hei: 40 + Math.random() * 20,
            sha: 5,
          }
        );
      }
    } else if (tt === 2) {
      for (let i = 0; i < randChoice([1, 1, 1, 1, 2, 2, 3]); i++) {
        const xr = normRand(grbd.xmin, grbd.xmax);
        const yr = (grbd.ymin + grbd.ymax) / 2;
        canv += Tree.tree04(xoff + xr, yoff + yr + 20, {});
        for (let j = 0; j < Math.random() * 2; j++) {
          canv += Mount.rock(
            xoff + Math.max(grbd.xmin, Math.min(grbd.xmax, xr + normRand(-50, 50))),
            yoff + yr + normRand(-5, 5) + 20,
            j * i * Math.random() * 100,
            {
              wid: 50 + Math.random() * 20,
              hei: 40 + Math.random() * 20,
              sha: 5,
            }
          );
        }
      }
    } else if (tt === 3) {
      for (let i = 0; i < randChoice([1, 1, 1, 1, 2, 2, 3]); i++) {
        canv += Tree.tree06(xoff + normRand(grbd.xmin, grbd.xmax), yoff + (grbd.ymin + grbd.ymax) / 2, {
          hei: 60 + Math.random() * 60,
        });
      }
    } else if (tt === 4) {
      const pmin = Math.random() * 0.5;
      const pmax = Math.random() * 0.5 + 0.5;
      const xmin = grbd.xmin * (1 - pmin) + grbd.xmax * pmin;
      const xmax = grbd.xmin * (1 - pmax) + grbd.xmax * pmax;
      for (let i = xmin; i < xmax; i += 20) {
        canv += Tree.tree07(
          xoff + i + 20 * normRand(-1, 1),
          yoff + (grbd.ymin + grbd.ymax) / 2 + normRand(-1, 1) + 0,
          { hei: normRand(40, 80) }
        );
      }
    }

    // Small trees
    for (let i = 0; i < 50 * Math.random(); i++) {
      canv += Tree.tree02(xoff + normRand(grbd.xmin, grbd.xmax), yoff + normRand(grbd.ymin, grbd.ymax));
    }

    // Note: Architecture would require Arch class implementation
    // Skipping Arch.arch01 call

    return canv;
  }

  /**
   * Generate distant mountain silhouette
   */
  static distMount(xoff: number, yoff: number, seed: number, options: DistMountOptions = {}): string {
    const hei = options.hei ?? 300;
    const len = options.len ?? 2000;
    const seg = options.seg ?? 5;

    seed = seed ?? 0;
    let canv = '';
    const span = 10;

    const ptlist: Polygon[] = [];

    for (let i = 0; i < len / span / seg; i++) {
      ptlist.push([]);
      for (let j = 0; j < seg + 1; j++) {
        const tran = (k: number) => [
          xoff + k * span,
          yoff - hei * noise.noise(k * 0.05, seed) * Math.pow(Math.sin((Math.PI * k) / (len / span)), 0.5),
        ];
        ptlist[ptlist.length - 1].push(tran(i * seg + j) as [number, number]);
      }
      for (let j = 0; j < seg / 2 + 1; j++) {
        const tran = (k: number) => [
          xoff + k * span,
          yoff + 24 * noise.noise(k * 0.05, 2, seed) * Math.pow(Math.sin((Math.PI * k) / (len / span)), 1),
        ];
        ptlist[ptlist.length - 1].unshift(tran(i * seg + j * 2) as [number, number]);
      }
    }

    for (let i = 0; i < ptlist.length; i++) {
      const getCol = (x: number, y: number) => {
        const c = (noise.noise(x * 0.02, y * 0.02, yoff) * 55 + 200) | 0;
        return 'rgb(' + c + ',' + c + ',' + c + ')';
      };

      canv += poly(ptlist[i], {
        fil: getCol(ptlist[i][ptlist[i].length - 1][0], ptlist[i][ptlist[i].length - 1][1]),
        str: 'none',
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
  static mistyMount(xoff: number, yoff: number, seed: number, options: MistyMountOptions = {}): string {
    const hei = options.hei ?? 200;
    const len = options.len ?? 2000;
    const layers = options.layers ?? 3;

    seed = seed ?? 0;
    let canv = '';

    // Create Simplex Noise instance with seed
    const simplex = new SimplexNoise(seed);
    // Create Worley Noise instance for ink particle distribution
    const worley = new WorleyNoise(seed + 999);

    // Add SVG filter definitions for ink wash effect (模拟 Kuwahara Filter + 水墨扩散)
    const filterId = `ink-wash-${Math.random().toString(36).substr(2, 9)}`;
    const particleFilterId = `ink-particle-${Math.random().toString(36).substr(2, 9)}`;

    canv += `<defs>
      <!-- Main ink wash filter for mountain body (皴法效果) -->
      <filter id="${filterId}" x="-100%" y="-100%" width="300%" height="300%">
        <!-- Step 1: Generate brush texture noise -->
        <feTurbulence type="fractalNoise" baseFrequency="0.025 0.015" numOctaves="4" seed="${seed}" result="brushNoise" />

        <!-- Step 2: Create displacement map for ink bleeding effect (水墨渗透) - INCREASED -->
        <feDisplacementMap in="SourceGraphic" in2="brushNoise" scale="12" xChannelSelector="R" yChannelSelector="G" result="displaced" />

        <!-- Step 3: Multi-layer blur to simulate Kuwahara smoothing - INCREASED -->
        <!-- Layer 1: Heavy blur for base wash -->
        <feGaussianBlur in="displaced" stdDeviation="5" result="blur1" />
        <!-- Layer 2: Medium blur for mid-tone -->
        <feGaussianBlur in="displaced" stdDeviation="2.5" result="blur2" />
        <!-- Layer 3: Light blur for detail retention -->
        <feGaussianBlur in="displaced" stdDeviation="1" result="blur3" />

        <!-- Step 4: Combine blur layers with different weights (模拟 Kuwahara 的分区平滑) -->
        <feBlend in="blur1" in2="blur2" mode="multiply" result="combined1" />
        <feBlend in="combined1" in2="blur3" mode="screen" result="combined2" />

        <!-- Step 5: Add texture grain using turbulence -->
        <feComponentTransfer in="brushNoise" result="grainMask">
          <feFuncA type="linear" slope="1.0" intercept="-0.15" />
        </feComponentTransfer>
        <feComposite operator="in" in="combined2" in2="grainMask" result="textured" />

        <!-- Step 6: Morphology for edge enhancement (保持边缘) - INCREASED -->
        <feMorphology operator="dilate" radius="0.5" in="textured" result="dilated" />
        <feMorphology operator="erode" radius="0.5" in="dilated" result="eroded" />

        <!-- Step 7: Enhance contrast (增加墨色浓度) - SIGNIFICANTLY INCREASED -->
        <feColorMatrix in="eroded" type="matrix" values="
          1.5 0   0   0 -0.25
          0   1.5 0   0 -0.25
          0   0   1.5 0 -0.25
          0   0   0   1.2 0
        " result="contrasted" />

        <!-- Step 8: Final soft blur for natural ink diffusion - INCREASED -->
        <feGaussianBlur in="contrasted" stdDeviation="1.2" result="final" />
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

      // Generate mountain ridge using FBM
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
          amplitude *= 0.5;  // Persistence: each octave has half the amplitude
          frequency *= 2.0;  // Lacunarity: each octave has double the frequency
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
      const fillOpacity = 0.5 + layerDepth * 0.45; // 0.5 to 0.95
      const strokeBaseOpacity = 0.2 + layerDepth * 0.45; // 0.2 to 0.65

      // Color gradation: ink cyan-blue tone (墨青色) - traditional Chinese ink wash
      // Far: (50, 65, 80) light ink cyan
      // Near: (15, 20, 30) deep ink cyan, almost black
      const r = Math.round(50 - layerDepth * 35);   // 50 to 15
      const g = Math.round(65 - layerDepth * 45);   // 65 to 20
      const b = Math.round(80 - layerDepth * 50);   // 80 to 30

      // Render all layers to create depth effect
      // First: Draw opaque background to block mountains behind (occlusion effect)
      canv += poly(mountainPoly, {
        fil: '#f5f5dc', // Beige background color (matches canvas background)
        str: 'none',
      });

      // Second: Draw semi-transparent mountain body with brush texture and depth-based color
      canv += poly(mountainPoly, {
        fil: `rgba(${r}, ${g}, ${b}, ${fillOpacity.toFixed(3)})`,
        str: 'none',
        filter: `url(#${filterId})`,
      });

      // Draw ridge outline with varying detail based on depth
      if (layerDepth > 0.6) {
        // Near mountains: NO outline (空白，无轮廓线)
        // Skip drawing outline for near mountains to create depth contrast
      } else {
        // Far mountains: darker stroke for depth (浓墨) - crisp outline without blur
        canv += stroke(ridgeLine, {
          col: `rgba(50, 50, 50, ${(strokeBaseOpacity * 1.5).toFixed(3)})`,
          wid: 2, // Reduced from 20 to 2 for crisp outline
          noi: 0, // Removed noise for sharp edge
        });
      }

      // ===== Ink Particle Effect (皴法) using Worley Noise =====
      // Generate ink particles along the mountain surface
      // Near mountains have denser, larger particles; far mountains have sparse, smaller particles

      const amplitudeScale = 1.5 + layerDepth * 2.0; // 1.5 to 3.5 (same as ridgeLine generation)
      const particleDensity = 0.5 + layerDepth * 1.0; // Increased from 0.3-1.0 to 0.5-1.5
      const particleSize = 0.8 + layerDepth * 1.7; // 0.8 to 2.5
      const particleCount = Math.floor(len * particleDensity * 0.35); // Increased from 0.15 to 0.35

      for (let p = 0; p < particleCount; p++) {
        // Random position along the mountain width
        const t = Math.random();
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
        const verticalOffset = (1 - verticalNoise) * maxVerticalOffset * Math.random();
        const y = baseY + verticalOffset;

        // Particle size with variation
        const baseSize = particleSize * (0.6 + Math.random() * 0.8);

        // Particle opacity based on layer depth and Worley noise
        // Near mountains: darker particles, far mountains: lighter particles
        const baseOpacity = 0.15 + layerDepth * 0.25; // 0.15 to 0.4
        const opacity = baseOpacity * (0.5 + worleyValue);

        // Particle color: inherit from mountain color but slightly darker
        const particleR = Math.max(0, r - 10);
        const particleG = Math.max(0, g - 15);
        const particleB = Math.max(0, b - 10);

        // Draw ink particle as small circle with soft edges
        canv += `<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="${baseSize.toFixed(2)}" ` +
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
          const t = Math.random();
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
          const startOffset = hei * 0.1 * Math.random();
          const startY = ridgeY + startOffset;
          const endY = ridgeY + strokeLength;

          // Opacity based on distance from ridge (darker near ridge)
          // Use Simplex noise to create natural variation
          const opacityNoise = simplex.noise2D(x * 0.025, (layerSeed + 200) * 0.025);
          const baseStrokeOpacity = 0.12 + layerDepth * 0.18; // 0.12 to 0.3
          const strokeOpacity = baseStrokeOpacity * (0.6 + Math.abs(opacityNoise) * 0.4);

          // Stroke width with variation
          const strokeWidth = (0.5 + Math.random() * 1.0) * (1 + layerDepth * 0.5);

          // Color: slightly darker than mountain base
          const strokeR = Math.max(0, r - 15);
          const strokeG = Math.max(0, g - 20);
          const strokeB = Math.max(0, b - 15);

          // Draw vertical texture stroke
          canv += `<line x1="${x.toFixed(2)}" y1="${startY.toFixed(2)}" ` +
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
    const ret = options.ret ?? 0;
    const sha = options.sha ?? 10;

    seed = seed ?? 0;

    let canv = '';

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
        let l = (wid * hei) / Math.sqrt(Math.pow(hei * Math.cos(a), 2) + Math.pow(wid * Math.sin(a), 2));

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
      fil: 'white',
      str: 'none',
    });

    // OUTLINE
    canv += stroke(
      ptlist[0].map((x) => [x[0] + xoff, x[1] + yoff]),
      { col: 'rgba(100,100,100,0.3)', noi: 1, wid: 3 }
    );

    canv += texture(ptlist, {
      xof: xoff,
      yof: yoff,
      tex: tex,
      wid: 3,
      sha: sha,
      col: (progress: number, layerDepth: number) => 'rgba(180,180,180,' + (0.3 + Math.random() * 0.3).toFixed(3) + ')',
      dis: () => {
        if (Math.random() > 0.5) {
          return 0.15 + 0.15 * Math.random();
        } else {
          return 0.85 - 0.15 * Math.random();
        }
      },
    }) as string;

    return canv;
  }
}
