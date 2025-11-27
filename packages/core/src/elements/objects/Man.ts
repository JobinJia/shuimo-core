import { Polygon } from '../../foundation/geometry';
import { noise } from '../../foundation/noise';
import { normRand } from '../../utils/random';
import { stroke } from '../../drawing/Stroke';
import { div } from '../../drawing/div';
import { poly } from '../../utils/svg';
import { bezmh } from '../../utils/bezier';

export interface HatOptions {
  /** Whether to flip horizontally */
  fli?: boolean;
}

export interface StickOptions {
  /** Whether to flip horizontally */
  fli?: boolean;
}

export interface ManOptions {
  /** Scale factor */
  sca?: number;
  /** Hat drawing function */
  hat?: (p0: number[], p1: number[], options: HatOptions) => string;
  /** Item drawing function (e.g., stick) */
  ite?: (p0: number[], p1: number[], options: StickOptions) => string;
  /** Whether to flip horizontally */
  fli?: boolean;
  /** Angles for each body part */
  ang?: number[];
  /** Lengths for each body part */
  len?: number[];
}

/**
 * Man - Generate human figures
 * Creates simple human figures with customizable poses and accessories
 */
export class Man {
  /**
   * Expand a polyline into a shape with width
   */
  private static expand(
    ptlist: Polygon,
    wfun: (x: number) => number
  ): [Polygon, Polygon] {
    const vtxlist0: Polygon = [];
    const vtxlist1: Polygon = [];

    for (let i = 1; i < ptlist.length - 1; i++) {
      const w = wfun(i / ptlist.length);
      const a1 = Math.atan2(
        ptlist[i][1] - ptlist[i - 1][1],
        ptlist[i][0] - ptlist[i - 1][0]
      );
      const a2 = Math.atan2(
        ptlist[i][1] - ptlist[i + 1][1],
        ptlist[i][0] - ptlist[i + 1][0]
      );
      let a = (a1 + a2) / 2;
      if (a < a2) {
        a += Math.PI;
      }
      vtxlist0.push([ptlist[i][0] + w * Math.cos(a), ptlist[i][1] + w * Math.sin(a)]);
      vtxlist1.push([ptlist[i][0] - w * Math.cos(a), ptlist[i][1] - w * Math.sin(a)]);
    }

    const l = ptlist.length - 1;
    const a0 =
      Math.atan2(ptlist[1][1] - ptlist[0][1], ptlist[1][0] - ptlist[0][0]) - Math.PI / 2;
    const a1 =
      Math.atan2(ptlist[l][1] - ptlist[l - 1][1], ptlist[l][0] - ptlist[l - 1][0]) -
      Math.PI / 2;
    const w0 = wfun(0);
    const w1 = wfun(1);
    vtxlist0.unshift([ptlist[0][0] + w0 * Math.cos(a0), ptlist[0][1] + w0 * Math.sin(a0)]);
    vtxlist1.unshift([ptlist[0][0] - w0 * Math.cos(a0), ptlist[0][1] - w0 * Math.sin(a0)]);
    vtxlist0.push([ptlist[l][0] + w1 * Math.cos(a1), ptlist[l][1] + w1 * Math.sin(a1)]);
    vtxlist1.push([ptlist[l][0] - w1 * Math.cos(a1), ptlist[l][1] + w1 * Math.sin(a1)]);

    return [vtxlist0, vtxlist1];
  }

  /**
   * Transform and rotate a polygon from local to global coordinates
   */
  private static tranpoly(p0: number[], p1: number[], ptlist: Polygon): Polygon {
    const plist = ptlist.map((v) => [-v[0], v[1]]);
    const ang = Math.atan2(p1[1] - p0[1], p1[0] - p0[0]) - Math.PI / 2;
    const scl = Math.sqrt((p1[0] - p0[0]) ** 2 + (p1[1] - p0[1]) ** 2);
    const qlist: Polygon = plist.map((v) => {
      const d = Math.sqrt(v[0] ** 2 + v[1] ** 2);
      const a = Math.atan2(v[1], v[0]);
      return [p0[0] + d * scl * Math.cos(ang + a), p0[1] + d * scl * Math.sin(ang + a)] as [number, number];
    });
    return qlist;
  }

  /**
   * Flip points horizontally
   */
  private static flipper(plist: Polygon): Polygon {
    return plist.map((v) => [-v[0], v[1]]);
  }

  /**
   * Generate hat01 - a traditional conical hat
   */
  static hat01(p0: number[], p1: number[], options: HatOptions = {}): string {
    const fli = options.fli ?? false;

    let canv = '';
    const seed = Math.random();
    const f = fli ? (x: Polygon) => Man.flipper(x) : (x: Polygon) => x;

    canv += poly(
      Man.tranpoly(
        p0,
        p1,
        f([
          [-0.3, 0.5],
          [0.3, 0.8],
          [0.2, 1],
          [0, 1.1],
          [-0.3, 1.15],
          [-0.55, 1],
          [-0.65, 0.5],
        ])
      ),
      { fil: 'rgba(100,100,100,0.8)' }
    );

    const qlist1: Polygon = [];
    for (let i = 0; i < 10; i++) {
      qlist1.push([-0.3 - noise.noise(i * 0.2, seed) * i * 0.1, 0.5 - i * 0.3]);
    }
    canv += poly(Man.tranpoly(p0, p1, f(qlist1)), {
      str: 'rgba(100,100,100,0.8)',
      wid: 1,
    });

    return canv;
  }

  /**
   * Generate hat02 - a wide-brimmed hat
   */
  static hat02(p0: number[], p1: number[], options: HatOptions = {}): string {
    const fli = options.fli ?? false;

    let canv = '';
    const f = fli ? (x: Polygon) => Man.flipper(x) : (x: Polygon) => x;

    canv += poly(
      Man.tranpoly(
        p0,
        p1,
        f([
          [-0.3, 0.5],
          [-1.1, 0.5],
          [-1.2, 0.6],
          [-1.1, 0.7],
          [-0.3, 0.8],
          [0.3, 0.8],
          [1.0, 0.7],
          [1.3, 0.6],
          [1.2, 0.5],
          [0.3, 0.5],
        ])
      ),
      { fil: 'rgba(100,100,100,0.8)' }
    );

    return canv;
  }

  /**
   * Generate stick01 - a walking stick
   */
  static stick01(p0: number[], p1: number[], options: StickOptions = {}): string {
    const fli = options.fli ?? false;

    let canv = '';
    const seed = Math.random();
    const f = fli ? (x: Polygon) => Man.flipper(x) : (x: Polygon) => x;

    const qlist1: Polygon = [];
    const l = 12;
    for (let i = 0; i < l; i++) {
      qlist1.push([
        -noise.noise(i * 0.1, seed) * 0.1 * Math.sin((i / l) * Math.PI) * 5,
        0 + i * 0.3,
      ]);
    }
    canv += poly(Man.tranpoly(p0, p1, f(qlist1)), {
      str: 'rgba(100,100,100,0.5)',
      wid: 1,
    });

    return canv;
  }

  /**
   * Generate a human figure
   * Body part indices:
   *      2 (head)
   *    1/ (neck)
   * 7/  | \_ 6 (right arm)
   * 8| 0 \ 5 (right hand)
   *   (torso) /3 (left leg)
   *     4 (left foot)
   */
  static man(xoff: number, yoff: number, options: ManOptions = {}): string {
    const sca = options.sca ?? 0.5;
    const hat = options.hat ?? Man.hat01;
    const ite = options.ite ?? (() => '');
    const fli = options.fli ?? true;
    const ang =
      options.ang ??
      [
        0,
        -Math.PI / 2,
        normRand(0, 0),
        (Math.PI / 4) * Math.random(),
        ((Math.PI * 3) / 4) * Math.random(),
        (Math.PI * 3) / 4,
        -Math.PI / 4,
        (-Math.PI * 3) / 4 - (Math.PI / 4) * Math.random(),
        -Math.PI / 4,
      ];
    const len = (options.len ?? [0, 30, 20, 30, 30, 30, 30, 30, 30]).map((v) => v * sca);

    let canv = '';

    // Skeleton structure tree
    const sct: any = {
      0: { 1: { 2: {}, 5: { 6: {} }, 7: { 8: {} } }, 3: { 4: {} } },
    };

    const toGlobal = (v: number[]): [number, number] => [(fli ? -1 : 1) * v[0] + xoff, v[1] + yoff];

    // Get parent chain for a body part
    function gpar(sct: any, ind: number): number[] | false {
      const keys = Object.keys(sct);
      for (let i = 0; i < keys.length; i++) {
        if (parseInt(keys[i]) === ind) {
          return [ind];
        } else {
          const r = gpar(sct[keys[i]], ind);
          if (r !== false) {
            return [parseFloat(keys[i])].concat(r);
          }
        }
      }
      return false;
    }

    // Get cumulative rotation for a body part
    function grot(sct: any, ind: number): number {
      const par = gpar(sct, ind) as number[];
      let rot = 0;
      for (let i = 0; i < par.length; i++) {
        rot += ang[par[i]];
      }
      return rot;
    }

    // Get global position for a body part
    function gpos(sct: any, ind: number): number[] {
      const par = gpar(sct, ind) as number[];
      const pos: number[] = [0, 0];
      for (let i = 0; i < par.length; i++) {
        const a = grot(sct, par[i]);
        pos[0] += len[par[i]] * Math.cos(a);
        pos[1] += len[par[i]] * Math.sin(a);
      }
      return pos;
    }

    // Calculate all joint positions
    const pts: Polygon = [];
    for (let i = 0; i < ang.length; i++) {
      const pos = gpos(sct, i);
      pts.push([pos[0], pos[1]] as [number, number]);
    }

    // Adjust yoff so feet touch ground
    yoff -= pts[4][1];

    // Function to draw clothing/body parts
    const cloth = (plist: Polygon, fun: (x: number) => number): string => {
      let canv = '';
      const tlist = bezmh(plist, 2);
      const [tlist1, tlist2] = Man.expand(tlist, fun);
      canv += poly(tlist1.concat(tlist2.reverse()).map(toGlobal), {
        fil: 'white',
      });
      canv += stroke(tlist1.map(toGlobal), {
        wid: 1,
        col: 'rgba(100,100,100,0.5)',
      });
      canv += stroke(tlist2.map(toGlobal), {
        wid: 1,
        col: 'rgba(100,100,100,0.6)',
      });
      return canv;
    };

    // Width functions for different body parts
    const fsleeve = (x: number) =>
      sca * 8 * (Math.sin(0.5 * x * Math.PI) * Math.pow(Math.sin(x * Math.PI), 0.1) + (1 - x) * 0.4);
    const fbody = (x: number) =>
      sca * 11 * (Math.sin(0.5 * x * Math.PI) * Math.pow(Math.sin(x * Math.PI), 0.1) + (1 - x) * 0.5);
    const fhead = (x: number) =>
      sca * 7 * Math.pow(0.25 - Math.pow(x - 0.5, 2), 0.3);

    // Draw item (e.g., walking stick)
    canv += ite(toGlobal(pts[8]), toGlobal(pts[6]), { fli: fli });

    // Draw body parts
    canv += cloth([pts[1], pts[7], pts[8]] as Polygon, fsleeve); // Left sleeve
    canv += cloth([pts[1], pts[0], pts[3], pts[4]] as Polygon, fbody); // Body
    canv += cloth([pts[1], pts[5], pts[6]] as Polygon, fsleeve); // Right sleeve
    canv += cloth([pts[1], pts[2]] as Polygon, fhead); // Head

    // Draw hair
    const hlist = bezmh([pts[1], pts[2]] as Polygon, 2);
    const [hlist1, hlist2] = Man.expand(hlist, fhead);
    hlist1.splice(0, Math.floor(hlist1.length * 0.1));
    hlist2.splice(0, Math.floor(hlist2.length * 0.95));
    canv += poly(hlist1.concat(hlist2.reverse()).map(toGlobal), {
      fil: 'rgba(100,100,100,0.6)',
    });

    // Draw hat
    canv += hat(toGlobal(pts[1]), toGlobal(pts[2]), { fli: fli });

    return canv;
  }
}
