import { Point, Polygon, PolyTools } from '../../foundation/geometry';
import { noise } from '../../foundation/noise';
import { blob } from '../../drawing/Blob';
import { stroke } from '../../drawing/Stroke';
import { poly } from '../../utils/svg';
import { randChoice, randGaussian, normRand } from '../../utils/random';
import { loopNoise, distance } from '../../utils/math';
import { div } from '../../drawing/div';

export interface Tree01Options {
  hei?: number;
  wid?: number;
  col?: string;
  noi?: number;
}

export interface Tree02Options {
  hei?: number;
  wid?: number;
  clu?: number;
  col?: string;
  noi?: number;
}

export interface Tree03Options {
  hei?: number;
  wid?: number;
  ben?: (x: number) => number;
  col?: string;
  noi?: number;
}

export interface Tree04Options {
  hei?: number;
  wid?: number;
  col?: string;
  noi?: number;
}

export interface Tree05Options {
  hei?: number;
  wid?: number;
  col?: string;
  noi?: number;
}

export interface Tree06Options {
  hei?: number;
  wid?: number;
  col?: string;
  noi?: number;
}

export interface Tree07Options {
  hei?: number;
  wid?: number;
  ben?: (x: number) => number;
  col?: string;
  noi?: number;
}

export interface Tree08Options {
  hei?: number;
  wid?: number;
  col?: string;
  noi?: number;
}

interface BranchOptions {
  hei?: number;
  wid?: number;
  ang?: number;
  det?: number;
  ben?: number;
}

interface TwigOptions {
  dir?: number;
  sca?: number;
  wid?: number;
  ang?: number;
  lea?: [boolean, number];
}

/**
 * Parse color string to extract RGBA components
 */
function parseColor(col: string): string[] {
  if (col.includes('rgba(')) {
    return col.replace('rgba(', '').replace(')', '').split(',');
  }
  return ['100', '100', '100', '0.5'];
}

/**
 * Generate a branch structure
 */
function branch(options: BranchOptions = {}): [Polygon, Polygon] {
  const hei = options.hei ?? 300;
  const wid = options.wid ?? 6;
  const ang = options.ang ?? 0;
  const det = options.det ?? 10;
  const ben = options.ben ?? Math.PI * 0.2;

  let nx = 0;
  let ny = 0;
  const tlist: Polygon = [[nx, ny]];
  let a0 = 0;
  const g = 3;

  for (let i = 0; i < g; i++) {
    a0 += (ben / 2 + (Math.random() * ben) / 2) * randChoice([-1, 1]);
    nx += (Math.cos(a0) * hei) / g;
    ny -= (Math.sin(a0) * hei) / g;
    tlist.push([nx, ny]);
  }

  const ta = Math.atan2(tlist[tlist.length - 1][1], tlist[tlist.length - 1][0]);

  for (let i = 0; i < tlist.length; i++) {
    const a = Math.atan2(tlist[i][1], tlist[i][0]);
    const d = Math.sqrt(tlist[i][0] * tlist[i][0] + tlist[i][1] * tlist[i][1]);
    tlist[i][0] = d * Math.cos(a - ta + ang);
    tlist[i][1] = d * Math.sin(a - ta + ang);
  }

  const trlist1: Polygon = [];
  const trlist2: Polygon = [];
  const span = det;
  const tl = (tlist.length - 1) * span;
  let lx = 0;
  let ly = 0;

  for (let i = 0; i < tl; i += 1) {
    const lastp = tlist[Math.floor(i / span)];
    const nextp = tlist[Math.ceil(i / span)];
    const p = (i % span) / span;
    nx = lastp[0] * (1 - p) + nextp[0] * p;
    ny = lastp[1] * (1 - p) + nextp[1] * p;

    const angle = Math.atan2(ny - ly, nx - lx);
    const woff = ((noise.noise(i * 0.3) - 0.5) * wid * hei) / 80;

    let b = 0;
    if (p === 0) {
      b = Math.random() * wid;
    }

    const nw = wid * (((tl - i) / tl) * 0.5 + 0.5);
    trlist1.push([
      nx + Math.cos(angle + Math.PI / 2) * (nw + woff + b),
      ny + Math.sin(angle + Math.PI / 2) * (nw + woff + b),
    ]);
    trlist2.push([
      nx + Math.cos(angle - Math.PI / 2) * (nw - woff + b),
      ny + Math.sin(angle - Math.PI / 2) * (nw - woff + b),
    ]);
    lx = nx;
    ly = ny;
  }

  return [trlist1, trlist2];
}

/**
 * Generate a twig (small branch with leaves)
 */
function twig(tx: number, ty: number, dep: number, options: TwigOptions = {}): string {
  const dir = options.dir ?? 1;
  const sca = options.sca ?? 1;
  const wid = options.wid ?? 1;
  const ang = options.ang ?? 0;
  const lea = options.lea ?? [true, 12];

  let canv = '';
  const twlist: Polygon = [];
  const tl = 10;
  const hs = Math.random() * 0.5 + 0.5;

  const fun2 = (x: number, i: number) => -1 / Math.pow(i / tl + 1, 5) + 1;
  const tfun = fun2;
  const a0 = ((Math.random() * Math.PI) / 6) * dir + ang;

  for (let i = 0; i < tl; i++) {
    const mx = dir * tfun(i / tl, i) * 50 * sca * hs;
    const my = -i * 5 * sca;

    const a = Math.atan2(my, mx);
    const d = Math.pow(mx * mx + my * my, 0.5);

    const nx = Math.cos(a + a0) * d;
    const ny = Math.sin(a + a0) * d;

    twlist.push([nx + tx, ny + ty]);

    if ((i === ((tl / 3) | 0) || i === (((tl * 2) / 3) | 0)) && dep > 0) {
      canv += twig(nx + tx, ny + ty, dep - 1, {
        ang: ang,
        sca: sca * 0.8,
        wid: wid,
        dir: dir * randChoice([-1, 1]),
        lea: lea,
      });
    }

    if (i === tl - 1 && lea[0] === true) {
      for (let j = 0; j < 5; j++) {
        const dj = (j - 2.5) * 5;
        canv += blob(
          nx + tx + Math.cos(ang) * dj * wid,
          ny + ty + (Math.sin(ang) * dj - lea[1] / (dep + 1)) * wid,
          {
            wid: (6 + 3 * Math.random()) * wid,
            len: (15 + 12 * Math.random()) * wid,
            ang: ang / 2 + Math.PI / 2 + Math.PI * 0.2 * (Math.random() - 0.5),
            col: 'rgba(100,100,100,' + (0.5 + dep * 0.2).toFixed(3) + ')',
            fun: (x: number) =>
              x <= 1
                ? Math.pow(Math.sin(x * Math.PI) * x, 0.5)
                : -Math.pow(Math.sin((x - 2) * Math.PI * (x - 2)), 0.5),
          }
        );
      }
    }
  }

  canv += stroke(twlist, {
    wid: 1,
    fun: (x: number) => Math.cos((x * Math.PI) / 2),
    col: 'rgba(100,100,100,0.5)',
  });

  return canv;
}

/**
 * Add bark texture to a branch
 */
function barkify(x: number, y: number, trlist: [Polygon, Polygon]): string {
  function bark(x: number, y: number, wid: number, ang: number): string {
    const len = 10 + 10 * Math.random();
    const noi = 0.5;
    const fun = (x: number) =>
      x <= 1 ? Math.pow(Math.sin(x * Math.PI), 0.5) : -Math.pow(Math.sin((x + 1) * Math.PI), 0.5);
    const reso = 20.0;

    const lalist: [number, number][] = [];
    for (let i = 0; i < reso + 1; i++) {
      const p = (i / reso) * 2;
      const xo = len / 2 - Math.abs(p - 1) * len;
      const yo = (fun(p) * wid) / 2;
      const a = Math.atan2(yo, xo);
      const l = Math.sqrt(xo * xo + yo * yo);
      lalist.push([l, a]);
    }

    const nslist: number[] = [];
    const n0 = Math.random() * 10;
    for (let i = 0; i < reso + 1; i++) {
      nslist.push(noise.noise(i * 0.05, n0));
    }

    loopNoise(nslist);
    const brklist: Polygon = [];
    for (let i = 0; i < lalist.length; i++) {
      const ns = nslist[i] * noi + (1 - noi);
      const nx = x + Math.cos(lalist[i][1] + ang) * lalist[i][0] * ns;
      const ny = y + Math.sin(lalist[i][1] + ang) * lalist[i][0] * ns;
      brklist.push([nx, ny]);
    }

    const fr = Math.random();
    return stroke(brklist, {
      wid: 0.8,
      noi: 0,
      col: 'rgba(100,100,100,0.4)',
      out: 0,
      fun: (x: number) => Math.sin((x + fr) * Math.PI * 3),
    });
  }

  let canv = '';

  for (let i = 2; i < trlist[0].length - 1; i++) {
    const a0 = Math.atan2(
      trlist[0][i][1] - trlist[0][i - 1][1],
      trlist[0][i][0] - trlist[0][i - 1][0]
    );
    const a1 = Math.atan2(
      trlist[1][i][1] - trlist[1][i - 1][1],
      trlist[1][i][0] - trlist[1][i - 1][0]
    );
    const p = Math.random();
    const nx = trlist[0][i][0] * (1 - p) + trlist[1][i][0] * p;
    const ny = trlist[0][i][1] * (1 - p) + trlist[1][i][1] * p;

    if (Math.random() < 0.2) {
      canv += blob(nx + x, ny + y, {
        noi: 1,
        len: 15,
        wid: 6 - Math.abs(p - 0.5) * 10,
        ang: (a0 + a1) / 2,
        col: 'rgba(100,100,100,0.6)',
      });
    } else {
      canv += bark(nx + x, ny + y, 5 - Math.abs(p - 0.5) * 10, (a0 + a1) / 2);
    }

    if (Math.random() < 0.05) {
      const jl = Math.random() * 2 + 2;
      const xya = randChoice([
        [trlist[0][i][0], trlist[0][i][1], a0],
        [trlist[1][i][0], trlist[1][i][1], a1],
      ]);
      for (let j = 0; j < jl; j++) {
        canv += blob(
          xya[0] + x + Math.cos(xya[2]) * (j - jl / 2) * 4,
          xya[1] + y + Math.sin(xya[2]) * (j - jl / 2) * 4,
          {
            wid: 4,
            len: 4 + 6 * Math.random(),
            ang: a0 + Math.PI / 2,
            col: 'rgba(100,100,100,0.6)',
          }
        );
      }
    }
  }

  const trflist = trlist[0].concat(trlist[1].slice().reverse());
  const rglist: Polygon[] = [[]];
  for (let i = 0; i < trflist.length; i++) {
    if (Math.random() < 0.5) {
      rglist.push([]);
    } else {
      rglist[rglist.length - 1].push(trflist[i]);
    }
  }

  for (let i = 0; i < rglist.length; i++) {
    rglist[i] = div(rglist[i], 4);
    for (let j = 0; j < rglist[i].length; j++) {
      rglist[i][j][0] += (noise.noise(i, j * 0.1, 1) - 0.5) * (15 + 5 * randGaussian());
      rglist[i][j][1] += (noise.noise(i, j * 0.1, 2) - 0.5) * (15 + 5 * randGaussian());
    }
    canv += stroke(
      rglist[i].map((v) => [v[0] + x, v[1] + y]),
      { wid: 1.5, col: 'rgba(100,100,100,0.7)', out: 0 }
    );
  }

  return canv;
}

/**
 * Tree - Generate various types of trees for landscape paintings
 */
export class Tree {
  /**
   * Simple tree with leaves at top (tree01)
   */
  static tree01(x: number, y: number, options: Tree01Options = {}): string {
    const hei = options.hei ?? 50;
    const wid = options.wid ?? 3;
    const col = options.col ?? 'rgba(100,100,100,0.5)';
    const noi = options.noi ?? 0.5;

    const reso = 10;
    const nslist: [number, number][] = [];
    for (let i = 0; i < reso; i++) {
      nslist.push([noise.noise(i * 0.5), noise.noise(i * 0.5, 0.5)]);
    }

    const leafcol = parseColor(col);
    let canv = '';
    const line1: Polygon = [];
    const line2: Polygon = [];

    for (let i = 0; i < reso; i++) {
      const nx = x;
      const ny = y - (i * hei) / reso;

      if (i >= reso / 4) {
        for (let j = 0; j < (reso - i) / 5; j++) {
          canv += blob(
            nx + (Math.random() - 0.5) * wid * 1.2 * (reso - i),
            ny + (Math.random() - 0.5) * wid,
            {
              len: Math.random() * 20 * (reso - i) * 0.2 + 10,
              wid: Math.random() * 6 + 3,
              ang: ((Math.random() - 0.5) * Math.PI) / 6,
              col:
                'rgba(' +
                leafcol[0] +
                ',' +
                leafcol[1] +
                ',' +
                leafcol[2] +
                ',' +
                (Math.random() * 0.2 + parseFloat(leafcol[3])).toFixed(1) +
                ')',
            }
          );
        }
      }
      line1.push([nx + (nslist[i][0] - 0.5) * wid - wid / 2, ny]);
      line2.push([nx + (nslist[i][1] - 0.5) * wid + wid / 2, ny]);
    }

    canv += poly(line1, { fil: 'none', str: col, wid: 1.5 });
    canv += poly(line2, { fil: 'none', str: col, wid: 1.5 });
    return canv;
  }

  /**
   * Clustered blob tree (tree02)
   */
  static tree02(x: number, y: number, options: Tree02Options = {}): string {
    const hei = options.hei ?? 16;
    const wid = options.wid ?? 8;
    const clu = options.clu ?? 5;
    const col = options.col ?? 'rgba(100,100,100,0.5)';

    let canv = '';
    for (let i = 0; i < clu; i++) {
      canv += blob(x + randGaussian() * clu * 4, y + randGaussian() * clu * 4, {
        ang: Math.PI / 2,
        fun: (x: number) =>
          x <= 1
            ? Math.pow(Math.sin(x * Math.PI) * x, 0.5)
            : -Math.pow(Math.sin((x - 2) * Math.PI * (x - 2)), 0.5),
        wid: Math.random() * wid * 0.75 + wid * 0.5,
        len: Math.random() * hei * 0.75 + hei * 0.5,
        col: col,
      });
    }
    return canv;
  }

  /**
   * Tree with bending trunk (tree03)
   */
  static tree03(x: number, y: number, options: Tree03Options = {}): string {
    const hei = options.hei ?? 50;
    const wid = options.wid ?? 5;
    const ben = options.ben ?? ((x: number) => 0);
    const col = options.col ?? 'rgba(100,100,100,0.5)';

    const reso = 10;
    const nslist: [number, number][] = [];
    for (let i = 0; i < reso; i++) {
      nslist.push([noise.noise(i * 0.5), noise.noise(i * 0.5, 0.5)]);
    }

    const leafcol = parseColor(col);
    let canv = '';
    let blobs = '';
    const line1: Polygon = [];
    const line2: Polygon = [];

    for (let i = 0; i < reso; i++) {
      const nx = x + ben(i / reso) * 100;
      const ny = y - (i * hei) / reso;

      if (i >= reso / 5) {
        for (let j = 0; j < (reso - i) * 2; j++) {
          const shape = (x: number) => Math.log(50 * x + 1) / 3.95;
          const ox = Math.random() * wid * 2 * shape((reso - i) / reso);
          blobs += blob(nx + ox * randChoice([-1, 1]), ny + (Math.random() - 0.5) * wid * 2, {
            len: ox * 2,
            wid: Math.random() * 6 + 3,
            ang: ((Math.random() - 0.5) * Math.PI) / 6,
            col:
              'rgba(' +
              leafcol[0] +
              ',' +
              leafcol[1] +
              ',' +
              leafcol[2] +
              ',' +
              (Math.random() * 0.2 + parseFloat(leafcol[3])).toFixed(3) +
              ')',
          });
        }
      }
      line1.push([nx + (((nslist[i][0] - 0.5) * wid - wid / 2) * (reso - i)) / reso, ny]);
      line2.push([nx + (((nslist[i][1] - 0.5) * wid + wid / 2) * (reso - i)) / reso, ny]);
    }

    const lc = line1.concat(line2.reverse());
    canv += poly(lc, { fil: 'white', str: col, wid: 1.5 });
    canv += blobs;
    return canv;
  }

  /**
   * Detailed tree with branches (tree04)
   */
  static tree04(x: number, y: number, options: Tree04Options = {}): string {
    const hei = options.hei ?? 300;
    const wid = options.wid ?? 6;
    const col = options.col ?? 'rgba(100,100,100,0.5)';

    let canv = '';
    let txcanv = '';
    let twcanv = '';

    let trlist = branch({ hei: hei, wid: wid, ang: -Math.PI / 2 });
    txcanv += barkify(x, y, trlist);
    const trlistMerged = trlist[0].concat(trlist[1].reverse());

    const trmlist: Polygon = [];

    for (let i = 0; i < trlistMerged.length; i++) {
      if (
        (i >= trlistMerged.length * 0.3 &&
          i <= trlistMerged.length * 0.7 &&
          Math.random() < 0.1) ||
        i === trlistMerged.length / 2 - 1
      ) {
        const ba = Math.PI * 0.2 - Math.PI * 1.4 * (i > trlistMerged.length / 2 ? 1 : 0);
        const brlist = branch({
          hei: hei * (Math.random() + 1) * 0.3,
          wid: wid * 0.5,
          ang: ba,
        });

        brlist[0].splice(0, 1);
        brlist[1].splice(0, 1);
        const foff = (v: Point) => [v[0] + trlistMerged[i][0], v[1] + trlistMerged[i][1]] as Point;
        txcanv += barkify(x, y, [brlist[0].map(foff), brlist[1].map(foff)]);

        for (let j = 0; j < brlist[0].length; j++) {
          if (Math.random() < 0.2 || j === brlist[0].length - 1) {
            twcanv += twig(
              brlist[0][j][0] + trlistMerged[i][0] + x,
              brlist[0][j][1] + trlistMerged[i][1] + y,
              1,
              {
                wid: hei / 300,
                ang: ba > -Math.PI / 2 ? ba : ba + Math.PI,
                sca: (0.5 * hei) / 300,
                dir: ba > -Math.PI / 2 ? 1 : -1,
              }
            );
          }
        }

        const brlistMerged = brlist[0].concat(brlist[1].reverse());
        trmlist.push(
          ...brlistMerged.map((v) => [v[0] + trlistMerged[i][0], v[1] + trlistMerged[i][1]] as Point)
        );
      } else {
        trmlist.push(trlistMerged[i]);
      }
    }

    canv += poly(trmlist, { xof: x, yof: y, fil: 'white', str: col, wid: 0 });

    trmlist.splice(0, 1);
    trmlist.splice(trmlist.length - 1, 1);
    canv += stroke(
      trmlist.map((v) => [v[0] + x, v[1] + y]),
      {
        col: 'rgba(100,100,100,' + (0.4 + Math.random() * 0.1).toFixed(3) + ')',
        wid: 2.5,
        fun: (x: number) => Math.sin(1),
        noi: 0.9,
        out: 0,
      }
    );

    canv += txcanv;
    canv += twcanv;
    return canv;
  }

  /**
   * Pine-like tree (tree05)
   */
  static tree05(x: number, y: number, options: Tree05Options = {}): string {
    const hei = options.hei ?? 300;
    const wid = options.wid ?? 5;
    const col = options.col ?? 'rgba(100,100,100,0.5)';

    let canv = '';
    let txcanv = '';
    let twcanv = '';

    let trlist = branch({ hei: hei, wid: wid, ang: -Math.PI / 2, ben: 0 });
    txcanv += barkify(x, y, trlist);
    const trlistMerged = trlist[0].concat(trlist[1].reverse());

    const trmlist: Polygon = [];

    for (let i = 0; i < trlistMerged.length; i++) {
      const p = Math.abs(i - trlistMerged.length * 0.5) / (trlistMerged.length * 0.5);
      if (
        (i >= trlistMerged.length * 0.2 &&
          i <= trlistMerged.length * 0.8 &&
          i % 3 === 0 &&
          Math.random() > p) ||
        i === trlistMerged.length / 2 - 1
      ) {
        const bar = Math.random() * 0.2;
        const ba = -bar * Math.PI - (1 - bar * 2) * Math.PI * (i > trlistMerged.length / 2 ? 1 : 0);
        const brlist = branch({
          hei: hei * (0.3 * p - Math.random() * 0.05),
          wid: wid * 0.5,
          ang: ba,
          ben: 0.5,
        });

        brlist[0].splice(0, 1);
        brlist[1].splice(0, 1);
        const foff = (v: Point) => [v[0] + trlistMerged[i][0], v[1] + trlistMerged[i][1]] as Point;

        for (let j = 0; j < brlist[0].length; j++) {
          if (j % 20 === 0 || j === brlist[0].length - 1) {
            twcanv += twig(
              brlist[0][j][0] + trlistMerged[i][0] + x,
              brlist[0][j][1] + trlistMerged[i][1] + y,
              0,
              {
                wid: hei / 300,
                ang: ba > -Math.PI / 2 ? ba : ba + Math.PI,
                sca: (0.2 * hei) / 300,
                dir: ba > -Math.PI / 2 ? 1 : -1,
                lea: [true, 5],
              }
            );
          }
        }

        const brlistMerged = brlist[0].concat(brlist[1].reverse());
        trmlist.push(
          ...brlistMerged.map((v) => [v[0] + trlistMerged[i][0], v[1] + trlistMerged[i][1]] as Point)
        );
      } else {
        trmlist.push(trlistMerged[i]);
      }
    }

    canv += poly(trmlist, { xof: x, yof: y, fil: 'white', str: col, wid: 0 });

    trmlist.splice(0, 1);
    trmlist.splice(trmlist.length - 1, 1);
    canv += stroke(
      trmlist.map((v) => [v[0] + x, v[1] + y]),
      {
        col: 'rgba(100,100,100,' + (0.4 + Math.random() * 0.1).toFixed(3) + ')',
        wid: 2.5,
        fun: (x: number) => Math.sin(1),
        noi: 0.9,
        out: 0,
      }
    );

    canv += txcanv;
    canv += twcanv;
    return canv;
  }

  /**
   * Fractal branching tree (tree06)
   */
  static tree06(x: number, y: number, options: Tree06Options = {}): string {
    const hei = options.hei ?? 100;
    const wid = options.wid ?? 6;
    const col = options.col ?? 'rgba(100,100,100,0.5)';

    let canv = '';
    let txcanv = '';
    let twcanv = '';

    function fracTree(
      xoff: number,
      yoff: number,
      dep: number,
      args: { hei?: number; wid?: number; ang?: number; ben?: number } = {}
    ): Polygon {
      const hei = args.hei ?? 300;
      const wid = args.wid ?? 5;
      const ang = args.ang ?? 0;
      const ben = args.ben ?? Math.PI * 0.2;

      const trlist = branch({
        hei: hei,
        wid: wid,
        ang: ang,
        ben: ben,
        det: hei / 20,
      });
      txcanv += barkify(xoff, yoff, trlist);
      const trlistMerged = trlist[0].concat(trlist[1].reverse());

      const trmlist: Polygon = [];

      for (let i = 0; i < trlistMerged.length; i++) {
        const p = Math.abs(i - trlistMerged.length * 0.5) / (trlistMerged.length * 0.5);
        if (
          ((Math.random() < 0.025 &&
            i >= trlistMerged.length * 0.2 &&
            i <= trlistMerged.length * 0.8) ||
            i === ((trlistMerged.length / 2) | 0) - 1 ||
            i === ((trlistMerged.length / 2) | 0) + 1) &&
          dep > 0
        ) {
          const bar = 0.02 + Math.random() * 0.08;
          const ba = bar * Math.PI - bar * 2 * Math.PI * (i > trlistMerged.length / 2 ? 1 : 0);

          const brlist = fracTree(trlistMerged[i][0] + xoff, trlistMerged[i][1] + yoff, dep - 1, {
            hei: hei * (0.7 + Math.random() * 0.2),
            wid: wid * 0.6,
            ang: ang + ba,
            ben: 0.55,
          });

          for (let j = 0; j < brlist.length; j++) {
            if (Math.random() < 0.03) {
              twcanv += twig(
                brlist[j][0] + trlistMerged[i][0] + xoff,
                brlist[j][1] + trlistMerged[i][1] + yoff,
                2,
                {
                  ang: ba * (Math.random() * 0.5 + 0.75),
                  sca: 0.3,
                  dir: ba > 0 ? 1 : -1,
                  lea: [false, 0],
                }
              );
            }
          }

          trmlist.push(
            ...brlist.map((v) => [v[0] + trlistMerged[i][0], v[1] + trlistMerged[i][1]] as Point)
          );
        } else {
          trmlist.push(trlistMerged[i]);
        }
      }
      return trmlist;
    }

    const trmlist = fracTree(x, y, 3, {
      hei: hei,
      wid: wid,
      ang: -Math.PI / 2,
      ben: 0,
    });

    canv += poly(trmlist, { xof: x, yof: y, fil: 'white', str: col, wid: 0 });

    trmlist.splice(0, 1);
    trmlist.splice(trmlist.length - 1, 1);
    canv += stroke(
      trmlist.map((v) => [v[0] + x, v[1] + y]),
      {
        col: 'rgba(100,100,100,' + (0.4 + Math.random() * 0.1).toFixed(3) + ')',
        wid: 2.5,
        fun: (x: number) => Math.sin(1),
        noi: 0.9,
        out: 0,
      }
    );

    canv += txcanv;
    canv += twcanv;
    return canv;
  }

  /**
   * Triangulated textured tree (tree07)
   */
  static tree07(x: number, y: number, options: Tree07Options = {}): string {
    const hei = options.hei ?? 60;
    const wid = options.wid ?? 4;
    const ben = options.ben ?? ((x: number) => Math.sqrt(x) * 0.2);
    const col = options.col ?? 'rgba(100,100,100,1)';

    const reso = 10;
    const nslist: [number, number][] = [];
    for (let i = 0; i < reso; i++) {
      nslist.push([noise.noise(i * 0.5), noise.noise(i * 0.5, 0.5)]);
    }

    const leafcol = parseColor(col);
    let canv = '';
    const line1: Polygon = [];
    const line2: Polygon = [];
    let T: Polygon[] = [];

    for (let i = 0; i < reso; i++) {
      const nx = x + ben(i / reso) * 100;
      const ny = y - (i * hei) / reso;

      if (i >= reso / 4) {
        for (let j = 0; j < 1; j++) {
          const bpl = blob(
            nx + (Math.random() - 0.5) * wid * 1.2 * (reso - i) * 0.5,
            ny + (Math.random() - 0.5) * wid * 0.5,
            {
              len: Math.random() * 50 + 20,
              wid: Math.random() * 12 + 12,
              ang: (-Math.random() * Math.PI) / 6,
              col:
                'rgba(' +
                leafcol[0] +
                ',' +
                leafcol[1] +
                ',' +
                leafcol[2] +
                ',' +
                parseFloat(leafcol[3]).toFixed(3) +
                ')',
              fun: (x: number) =>
                x <= 1
                  ? 2.75 * x * Math.pow(1 - x, 1 / 1.8)
                  : 2.75 * (x - 2) * Math.pow(x - 1, 1 / 1.8),
              ret: 1,
            }
          ) as Polygon;

          T = T.concat(
            PolyTools.triangulate(bpl, {
              area: 50,
              convex: true,
              optimize: false,
            })
          );
        }
      }
      line1.push([nx + (nslist[i][0] - 0.5) * wid - wid / 2, ny]);
      line2.push([nx + (nslist[i][1] - 0.5) * wid + wid / 2, ny]);
    }

    T = PolyTools.triangulate(line1.concat(line2.reverse()), {
      area: 50,
      convex: true,
      optimize: true,
    }).concat(T);

    for (let k = 0; k < T.length; k++) {
      const m = PolyTools.midPt(T[k]);
      const c = (noise.noise(m[0] * 0.02, m[1] * 0.02) * 200 + 50) | 0;
      const co = 'rgba(' + c + ',' + c + ',' + c + ',0.8)';
      canv += poly(T[k], { fil: co, str: co, wid: 0 });
    }

    return canv;
  }

  /**
   * Delicate branching tree (tree08)
   */
  static tree08(x: number, y: number, options: Tree08Options = {}): string {
    const hei = options.hei ?? 80;
    const wid = options.wid ?? 1;
    const col = options.col ?? 'rgba(100,100,100,0.5)';

    let canv = '';
    let txcanv = '';
    let twcanv = '';

    const ang = normRand(-1, 1) * Math.PI * 0.2;

    let trlist = branch({
      hei: hei,
      wid: wid,
      ang: -Math.PI / 2 + ang,
      ben: Math.PI * 0.2,
      det: hei / 20,
    });

    const trlistMerged = trlist[0].concat(trlist[1].reverse());

    function fracTree(
      xoff: number,
      yoff: number,
      dep: number,
      args: { ang?: number; len?: number; ben?: number } = {}
    ): string {
      const ang = args.ang ?? -Math.PI / 2;
      const len = args.len ?? 15;
      const ben = args.ben ?? 0;

      const fun =
        dep === 0 ? (x: number) => Math.cos(0.5 * Math.PI * x) : (x: number) => 1;
      const spt: Point = [xoff, yoff];
      const ept: Point = [xoff + Math.cos(ang) * len, yoff + Math.sin(ang) * len];

      let trmlist: Polygon = [
        [xoff, yoff],
        [xoff + len, yoff],
      ];

      const bfun = randChoice([
        (x: number) => Math.sin(x * Math.PI),
        (x: number) => -Math.sin(x * Math.PI),
      ]);

      trmlist = div(trmlist, 10);

      for (let i = 0; i < trmlist.length; i++) {
        trmlist[i][1] += bfun(i / trmlist.length) * 2;
      }

      for (let i = 0; i < trmlist.length; i++) {
        const d = distance(trmlist[i], spt);
        const a = Math.atan2(trmlist[i][1] - spt[1], trmlist[i][0] - spt[0]);
        trmlist[i][0] = spt[0] + d * Math.cos(a + ang);
        trmlist[i][1] = spt[1] + d * Math.sin(a + ang);
      }

      let tcanv = '';
      tcanv += stroke(trmlist, {
        fun: fun,
        wid: 0.8,
        col: 'rgba(100,100,100,0.5)',
      });

      if (dep !== 0) {
        const nben = ben + randChoice([-1, 1]) * Math.PI * 0.001 * dep * dep;
        if (Math.random() < 0.5) {
          tcanv += fracTree(ept[0], ept[1], dep - 1, {
            ang: ang + ben + Math.PI * randChoice([normRand(-1, 0.5), normRand(0.5, 1)]) * 0.2,
            len: len * normRand(0.8, 0.9),
            ben: nben,
          });
          tcanv += fracTree(ept[0], ept[1], dep - 1, {
            ang: ang + ben + Math.PI * randChoice([normRand(-1, -0.5), normRand(0.5, 1)]) * 0.2,
            len: len * normRand(0.8, 0.9),
            ben: nben,
          });
        } else {
          tcanv += fracTree(ept[0], ept[1], dep - 1, {
            ang: ang + ben,
            len: len * normRand(0.8, 0.9),
            ben: nben,
          });
        }
      }
      return tcanv;
    }

    for (let i = 0; i < trlistMerged.length; i++) {
      if (Math.random() < 0.2) {
        twcanv += fracTree(
          x + trlistMerged[i][0],
          y + trlistMerged[i][1],
          Math.floor(4 * Math.random()),
          {
            ang: -Math.PI / 2 - ang * Math.random(),
          }
        );
      } else if (i === Math.floor(trlistMerged.length / 2)) {
        twcanv += fracTree(x + trlistMerged[i][0], y + trlistMerged[i][1], 3, {
          ang: -Math.PI / 2 + ang,
        });
      }
    }

    canv += poly(trlistMerged, { xof: x, yof: y, fil: 'white', str: col, wid: 0 });

    canv += stroke(
      trlistMerged.map((v) => [v[0] + x, v[1] + y]),
      {
        col: 'rgba(100,100,100,' + (0.6 + Math.random() * 0.1).toFixed(3) + ')',
        wid: 2.5,
        fun: (x: number) => Math.sin(1),
        noi: 0.9,
        out: 0,
      }
    );

    canv += txcanv;
    canv += twcanv;
    return canv;
  }
}
