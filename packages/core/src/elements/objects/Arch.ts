import { Polygon } from '../../foundation/geometry';
import { noise } from '../../foundation/noise';
import { randChoice, normRand, wtrand } from '../../utils/random';
import { stroke } from '../../drawing/Stroke';
import { texture } from '../../drawing/Texture';
import { div } from '../../drawing/div';
import { poly } from '../../utils/svg';
import { Man } from './Man';

export interface HutOptions {
  /** Height of hut */
  hei?: number;
  /** Width of hut */
  wid?: number;
  /** Texture density */
  tex?: number;
}

export interface BoxOptions {
  /** Height of box */
  hei?: number;
  /** Width of box */
  wid?: number;
  /** Rotation parameter (0-1) */
  rot?: number;
  /** Perspective depth */
  per?: number;
  /** Whether to draw transparent side */
  tra?: boolean;
  /** Whether to draw bottom */
  bot?: boolean;
  /** Line weight */
  wei?: number;
  /** Decoration function */
  dec?: (params: {
    pul: number[];
    pur: number[];
    pdl: number[];
    pdr: number[];
  }) => Polygon[];
}

export interface RailOptions {
  /** Height of rail */
  hei?: number;
  /** Width of rail */
  wid?: number;
  /** Rotation parameter (0-1) */
  rot?: number;
  /** Perspective depth */
  per?: number;
  /** Number of segments */
  seg?: number;
  /** Line weight */
  wei?: number;
  /** Whether to draw transparent side */
  tra?: boolean;
  /** Whether to draw front side */
  fro?: boolean;
}

export interface RoofOptions {
  /** Height of roof */
  hei?: number;
  /** Width of roof */
  wid?: number;
  /** Rotation parameter (0-1) */
  rot?: number;
  /** Perspective depth */
  per?: number;
  /** Corner extension */
  cor?: number;
  /** Line weight */
  wei?: number;
  /** Placard [enabled, text] */
  pla?: [number, string];
}

export interface PagroofOptions {
  /** Height of pagoda roof */
  hei?: number;
  /** Width of pagoda roof */
  wid?: number;
  /** Rotation parameter (0-1) */
  rot?: number;
  /** Perspective depth */
  per?: number;
  /** Corner extension */
  cor?: number;
  /** Number of sides */
  sid?: number;
  /** Line weight */
  wei?: number;
}

export interface Arch01Options {
  /** Height of arch */
  hei?: number;
  /** Width of arch */
  wid?: number;
  /** Rotation parameter (0-1) */
  rot?: number;
  /** Perspective depth */
  per?: number;
}

export interface Arch02Options {
  /** Height of each story */
  hei?: number;
  /** Width of arch */
  wid?: number;
  /** Rotation parameter (0-1) */
  rot?: number;
  /** Perspective depth */
  per?: number;
  /** Number of stories */
  sto?: number;
  /** Decoration style (1-3) */
  sty?: number;
  /** Whether to add rail */
  rai?: boolean;
}

export interface Arch03Options {
  /** Height of each story */
  hei?: number;
  /** Width of arch */
  wid?: number;
  /** Rotation parameter (0-1) */
  rot?: number;
  /** Perspective depth */
  per?: number;
  /** Number of stories */
  sto?: number;
}

export interface Arch04Options {
  /** Height of each story */
  hei?: number;
  /** Width of arch */
  wid?: number;
  /** Rotation parameter (0-1) */
  rot?: number;
  /** Perspective depth */
  per?: number;
  /** Number of stories */
  sto?: number;
}

export interface Boat01Options {
  /** Length of boat */
  len?: number;
  /** Scale factor */
  sca?: number;
  /** Whether to flip horizontally */
  fli?: boolean;
}

export interface TransmissionTower01Options {
  /** Height of tower */
  hei?: number;
  /** Width of tower */
  wid?: number;
}

/**
 * Arch - Generate architectural structures
 * Creates various building types and structures
 */
export class Arch {
  /**
   * Flip points horizontally around an axis
   */
  private static flip(ptlist: Polygon[], axis: number = 0): Polygon[] {
    for (let i = 0; i < ptlist.length; i++) {
      if (ptlist[i].length > 0) {
        if (typeof ptlist[i][0] === 'object') {
          for (let j = 0; j < ptlist[i].length; j++) {
            ptlist[i][j][0] = axis - (ptlist[i][j][0] - axis);
          }
        } else {
          (ptlist[i] as any)[0] = axis - ((ptlist[i] as any)[0] - axis);
        }
      }
    }
    return ptlist;
  }

  /**
   * Generate a hut structure
   */
  private static hut(xoff: number, yoff: number, options: HutOptions = {}): string {
    const hei = options.hei ?? 40;
    const wid = options.wid ?? 180;
    const tex = options.tex ?? 300;

    const reso: [number, number] = [10, 10];
    const ptlist: Polygon[] = [];

    for (let i = 0; i < reso[0]; i++) {
      ptlist.push([]);
      const heir = hei + hei * 0.2 * Math.random();
      for (let j = 0; j < reso[1]; j++) {
        const nx = wid * (i / (reso[0] - 1) - 0.5) * Math.pow(j / (reso[1] - 1), 0.7);
        const ny = heir * (j / (reso[1] - 1));
        ptlist[ptlist.length - 1].push([nx, ny]);
      }
    }

    let canv = '';
    canv += poly(
      ptlist[0].slice(0, -1).concat(ptlist[ptlist.length - 1].slice(0, -1).reverse()),
      {
        xof: xoff,
        yof: yoff,
        fil: 'white',
        str: 'none',
      }
    );
    canv += poly(ptlist[0], {
      xof: xoff,
      yof: yoff,
      fil: 'none',
      str: 'rgba(100,100,100,0.3)',
      wid: 2,
    });
    canv += poly(ptlist[ptlist.length - 1], {
      xof: xoff,
      yof: yoff,
      fil: 'none',
      str: 'rgba(100,100,100,0.3)',
      wid: 2,
    });

    canv += texture(ptlist, {
      xof: xoff,
      yof: yoff,
      tex: tex,
      wid: 1,
      len: 0.25,
      col: (x: number) => 'rgba(120,120,120,' + (0.3 + Math.random() * 0.3).toFixed(3) + ')',
      dis: () => wtrand((a) => a * a),
      noi: (x: number) => 5,
    });

    return canv;
  }

  /**
   * Generate a box structure
   */
  private static box(xoff: number, yoff: number, options: BoxOptions = {}): string {
    const hei = options.hei ?? 20;
    const wid = options.wid ?? 120;
    const rot = options.rot ?? 0.7;
    const per = options.per ?? 4;
    const tra = options.tra ?? true;
    const bot = options.bot ?? true;
    const wei = options.wei ?? 3;
    const dec = options.dec ?? ((a: any) => []);

    const mid = -wid * 0.5 + wid * rot;
    const bmid = -wid * 0.5 + wid * (1 - rot);
    const ptlist: Polygon[] = [];

    ptlist.push(
      div(
        [
          [-wid * 0.5, -hei],
          [-wid * 0.5, 0],
        ],
        5
      )
    );
    ptlist.push(
      div(
        [
          [wid * 0.5, -hei],
          [wid * 0.5, 0],
        ],
        5
      )
    );
    if (bot) {
      ptlist.push(
        div(
          [
            [-wid * 0.5, 0],
            [mid, per],
          ],
          5
        )
      );
      ptlist.push(
        div(
          [
            [wid * 0.5, 0],
            [mid, per],
          ],
          5
        )
      );
    }
    ptlist.push(
      div(
        [
          [mid, -hei],
          [mid, per],
        ],
        5
      )
    );
    if (tra) {
      if (bot) {
        ptlist.push(
          div(
            [
              [-wid * 0.5, 0],
              [bmid, -per],
            ],
            5
          )
        );
        ptlist.push(
          div(
            [
              [wid * 0.5, 0],
              [bmid, -per],
            ],
            5
          )
        );
      }
      ptlist.push(
        div(
          [
            [bmid, -hei],
            [bmid, -per],
          ],
          5
        )
      );
    }

    const surf = (rot < 0.5 ? 1 : 0) * 2 - 1;
    const decorations = dec({
      pul: [surf * wid * 0.5, -hei],
      pur: [mid, -hei + per],
      pdl: [surf * wid * 0.5, 0],
      pdr: [mid, per],
    });
    for (const decoration of decorations) {
      ptlist.push(decoration);
    }

    const polist: Polygon = [
      [-wid * 0.5, -hei],
      [wid * 0.5, -hei],
      [wid * 0.5, 0],
      [mid, per],
      [-wid * 0.5, 0],
    ];

    let canv = '';
    if (!tra) {
      canv += poly(polist, {
        xof: xoff,
        yof: yoff,
        str: 'none',
        fil: 'white',
      });
    }

    for (let i = 0; i < ptlist.length; i++) {
      canv += stroke(
        ptlist[i].map((x) => [x[0] + xoff, x[1] + yoff]),
        {
          col: 'rgba(100,100,100,0.4)',
          noi: 1,
          wid: wei,
          fun: (x: number) => 1,
        }
      );
    }
    return canv;
  }

  /**
   * Generate decorative patterns
   */
  private static deco(
    style: number,
    params: {
      pul?: number[];
      pur?: number[];
      pdl?: number[];
      pdr?: number[];
      hsp?: [number, number];
      vsp?: [number, number];
    } = {}
  ): Polygon[] {
    const pul = params.pul ?? [0, 0];
    const pur = params.pur ?? [0, 100];
    const pdl = params.pdl ?? [100, 0];
    const pdr = params.pdr ?? [100, 100];
    const hsp = params.hsp ?? [1, 3];
    const vsp = params.vsp ?? [1, 2];

    const plist: Polygon[] = [];
    const dl = div([pul, pdl], vsp[1]);
    const dr = div([pur, pdr], vsp[1]);
    const du = div([pul, pur], hsp[1]);
    const dd = div([pdl, pdr], hsp[1]);

    if (style === 1) {
      // -| |-
      const mlu = du[hsp[0]];
      const mru = du[du.length - 1 - hsp[0]];
      const mld = dd[hsp[0]];
      const mrd = dd[du.length - 1 - hsp[0]];

      for (let i = vsp[0]; i < dl.length - vsp[0]; i += vsp[0]) {
        const mml = div([mlu, mld], vsp[1])[i];
        const mmr = div([mru, mrd], vsp[1])[i];
        const ml = dl[i];
        const mr = dr[i];
        plist.push(div([mml, ml], 5));
        plist.push(div([mmr, mr], 5));
      }
      plist.push(div([mlu, mld], 5));
      plist.push(div([mru, mrd], 5));
    } else if (style === 2) {
      // ||||
      for (let i = hsp[0]; i < du.length - hsp[0]; i += hsp[0]) {
        const mu = du[i];
        const md = dd[i];
        plist.push(div([mu, md], 5));
      }
    } else if (style === 3) {
      // |##|
      const mlu = du[hsp[0]];
      const mru = du[du.length - 1 - hsp[0]];
      const mld = dd[hsp[0]];
      const mrd = dd[du.length - 1 - hsp[0]];

      for (let i = vsp[0]; i < dl.length - vsp[0]; i += vsp[0]) {
        const mml = div([mlu, mld], vsp[1])[i];
        const mmr = div([mru, mrd], vsp[1])[i];
        const mmu = div([mlu, mru], vsp[1])[i];
        const mmd = div([mld, mrd], vsp[1])[i];

        const ml = dl[i];
        const mr = dr[i];
        plist.push(div([mml, mmr], 5));
        plist.push(div([mmu, mmd], 5));
      }
      plist.push(div([mlu, mld], 5));
      plist.push(div([mru, mrd], 5));
    }
    return plist;
  }

  /**
   * Generate railings
   */
  private static rail(xoff: number, yoff: number, seed: number, options: RailOptions = {}): string {
    const hei = options.hei ?? 20;
    const wid = options.wid ?? 180;
    const rot = options.rot ?? 0.7;
    const per = options.per ?? 4;
    const seg = options.seg ?? 4;
    const wei = options.wei ?? 1;
    const tra = options.tra ?? true;
    const fro = options.fro ?? true;

    const mid = -wid * 0.5 + wid * rot;
    const bmid = -wid * 0.5 + wid * (1 - rot);
    const ptlist: Polygon[] = [];

    if (fro) {
      ptlist.push(
        div(
          [
            [-wid * 0.5, 0],
            [mid, per],
          ],
          seg
        )
      );
      ptlist.push(
        div(
          [
            [mid, per],
            [wid * 0.5, 0],
          ],
          seg
        )
      );
    }
    if (tra) {
      ptlist.push(
        div(
          [
            [-wid * 0.5, 0],
            [bmid, -per],
          ],
          seg
        )
      );
      ptlist.push(
        div(
          [
            [bmid, -per],
            [wid * 0.5, 0],
          ],
          seg
        )
      );
    }
    if (fro) {
      ptlist.push(
        div(
          [
            [-wid * 0.5, -hei],
            [mid, -hei + per],
          ],
          seg
        )
      );
      ptlist.push(
        div(
          [
            [mid, -hei + per],
            [wid * 0.5, -hei],
          ],
          seg
        )
      );
    }
    if (tra) {
      ptlist.push(
        div(
          [
            [-wid * 0.5, -hei],
            [bmid, -hei - per],
          ],
          seg
        )
      );
      ptlist.push(
        div(
          [
            [bmid, -hei - per],
            [wid * 0.5, -hei],
          ],
          seg
        )
      );
    }

    if (tra) {
      const open = Math.floor(Math.random() * ptlist.length);
      ptlist[open] = ptlist[open].slice(0, -1);
      ptlist[(open + ptlist.length) % ptlist.length] = ptlist[
        (open + ptlist.length) % ptlist.length
      ].slice(0, -1);
    }

    let canv = '';

    for (let i = 0; i < ptlist.length / 2; i++) {
      for (let j = 0; j < ptlist[i].length; j++) {
        ptlist[i][j][1] += (noise.noise(i, j * 0.5, seed) - 0.5) * hei;
        ptlist[(ptlist.length / 2 + i) % ptlist.length][
          j % ptlist[(ptlist.length / 2 + i) % ptlist.length].length
        ][1] += (noise.noise(i + 0.5, j * 0.5, seed) - 0.5) * hei;
        const ln = div(
          [
            ptlist[i][j],
            ptlist[(ptlist.length / 2 + i) % ptlist.length][
              j % ptlist[(ptlist.length / 2 + i) % ptlist.length].length
            ],
          ],
          2
        );
        ln[0][0] += (Math.random() - 0.5) * hei * 0.5;
        canv += poly(ln, {
          xof: xoff,
          yof: yoff,
          fil: 'none',
          str: 'rgba(100,100,100,0.5)',
          wid: 2,
        });
      }
    }

    for (let i = 0; i < ptlist.length; i++) {
      canv += stroke(
        ptlist[i].map((x) => [x[0] + xoff, x[1] + yoff]),
        {
          col: 'rgba(100,100,100,0.5)',
          noi: 0.5,
          wid: wei,
          fun: (x: number) => 1,
        }
      );
    }
    return canv;
  }

  /**
   * Generate a roof structure
   */
  private static roof(xoff: number, yoff: number, options: RoofOptions = {}): string {
    const hei = options.hei ?? 20;
    const wid = options.wid ?? 120;
    const rot = options.rot ?? 0.7;
    const per = options.per ?? 4;
    const cor = options.cor ?? 5;
    const wei = options.wei ?? 3;
    const pla = options.pla ?? [0, ''];

    const opf = (ptlist: Polygon): Polygon => {
      if (rot < 0.5) {
        return this.flip([ptlist])[0];
      } else {
        return ptlist;
      }
    };

    const rrot = rot < 0.5 ? 1 - rot : rot;
    const mid = -wid * 0.5 + wid * rrot;
    const bmid = -wid * 0.5 + wid * (1 - rrot);
    const quat = (mid + wid * 0.5) * 0.5 - mid;

    const ptlist: Polygon[] = [];
    ptlist.push(
      div(
        opf([
          [-wid * 0.5 + quat, -hei - per / 2],
          [-wid * 0.5 + quat * 0.5, -hei / 2 - per / 4],
          [-wid * 0.5 - cor, 0],
        ]),
        5
      )
    );
    ptlist.push(
      div(
        opf([
          [mid + quat, -hei],
          [(mid + quat + wid * 0.5) / 2, -hei / 2],
          [wid * 0.5 + cor, 0],
        ]),
        5
      )
    );
    ptlist.push(
      div(
        opf([
          [mid + quat, -hei],
          [mid + quat / 2, -hei / 2 + per / 2],
          [mid + cor, per],
        ]),
        5
      )
    );
    ptlist.push(
      div(
        opf([
          [-wid * 0.5 - cor, 0],
          [mid + cor, per],
        ]),
        5
      )
    );
    ptlist.push(
      div(
        opf([
          [wid * 0.5 + cor, 0],
          [mid + cor, per],
        ]),
        5
      )
    );
    ptlist.push(
      div(
        opf([
          [-wid * 0.5 + quat, -hei - per / 2],
          [mid + quat, -hei],
        ]),
        5
      )
    );

    let canv = '';

    const polist = opf([
      [-wid * 0.5, 0],
      [-wid * 0.5 + quat, -hei - per / 2],
      [mid + quat, -hei],
      [wid * 0.5, 0],
      [mid, per],
    ]);
    canv += poly(polist, { xof: xoff, yof: yoff, str: 'none', fil: 'white' });

    for (let i = 0; i < ptlist.length; i++) {
      canv += stroke(
        ptlist[i].map((x) => [x[0] + xoff, x[1] + yoff]),
        {
          col: 'rgba(100,100,100,0.4)',
          noi: 1,
          wid: wei,
          fun: (x: number) => 1,
        }
      );
    }

    if (pla[0] === 1) {
      const pp = opf([
        [mid + quat / 2, -hei / 2 + per / 2],
        [-wid * 0.5 + quat * 0.5, -hei / 2 - per / 4],
      ]);
      let finalPp = pp;
      if (pp[0][0] > pp[1][0]) {
        finalPp = [pp[1], pp[0]];
      }
      const mp = [(finalPp[0][0] + finalPp[1][0]) / 2, (finalPp[0][1] + finalPp[1][1]) / 2];
      const a = Math.atan2(finalPp[1][1] - finalPp[0][1], finalPp[1][0] - finalPp[0][0]);
      const adeg = (a * 180) / Math.PI;
      canv +=
        "<text font-size='" +
        hei * 0.6 +
        "' font-family='Verdana'" +
        " style='fill:rgba(100,100,100,0.9)'" +
        " text-anchor='middle' transform='translate(" +
        (mp[0] + xoff) +
        ',' +
        (mp[1] + yoff) +
        ') rotate(' +
        adeg +
        ")'>" +
        pla[1] +
        '</text>';
    }
    return canv;
  }

  /**
   * Generate a pagoda-style roof
   */
  private static pagroof(xoff: number, yoff: number, options: PagroofOptions = {}): string {
    const hei = options.hei ?? 20;
    const wid = options.wid ?? 120;
    const rot = options.rot ?? 0.7;
    const per = options.per ?? 4;
    const cor = options.cor ?? 10;
    const sid = options.sid ?? 4;
    const wei = options.wei ?? 3;

    const ptlist: [number[], number[]][] = [];
    const polist: Polygon = [[0, -hei]];
    let canv = '';

    for (let i = 0; i < sid; i++) {
      const fx = wid * ((i * 1.0) / (sid - 1) - 0.5);
      const fy = per * (1 - Math.abs((i * 1.0) / (sid - 1) - 0.5) * 2);
      const fxx = (wid + cor) * ((i * 1.0) / (sid - 1) - 0.5);
      if (i > 0) {
        ptlist.push([ptlist[ptlist.length - 1][2], [fxx, fy]]);
      }
      ptlist.push([
        [0, -hei],
        [fx * 0.5, (-hei + fy) * 0.5],
        [fxx, fy],
      ]);
      polist.push([fxx, fy]);
    }

    canv += poly(polist, { xof: xoff, yof: yoff, str: 'none', fil: 'white' });
    for (let i = 0; i < ptlist.length; i++) {
      canv += stroke(
        div(ptlist[i], 5).map((x) => [x[0] + xoff, x[1] + yoff]),
        {
          col: 'rgba(100,100,100,0.4)',
          noi: 1,
          wid: wei,
          fun: (x: number) => 1,
        }
      );
    }

    return canv;
  }

  /**
   * Generate arch01 - a bridge with hut
   */
  static arch01(xoff: number, yoff: number, seed: number, options: Arch01Options = {}): string {
    const hei = options.hei ?? 70;
    const wid = options.wid ?? 180;
    const rot = options.rot ?? 0.7;
    const per = options.per ?? 5;

    const p = 0.4 + Math.random() * 0.2;
    const h0 = hei * p;
    const h1 = hei * (1 - p);

    let canv = '';
    canv += this.hut(xoff, yoff - hei, { hei: h0, wid: wid });
    canv += this.box(xoff, yoff, {
      hei: h1,
      wid: (wid * 2) / 3,
      per: per,
      bot: false,
    });

    canv += this.rail(xoff, yoff, seed, {
      tra: true,
      fro: false,
      hei: 10,
      wid: wid,
      per: per * 2,
      seg: (3 + Math.random() * 3) | 0,
    });

    const mcnt = randChoice([0, 1, 1, 2]);
    if (mcnt === 1) {
      canv += Man.man(xoff + normRand(-wid / 3, wid / 3), yoff, {
        fli: randChoice([true, false]),
        sca: 0.42,
      });
    } else if (mcnt === 2) {
      canv += Man.man(xoff + normRand(-wid / 4, -wid / 5), yoff, {
        fli: false,
        sca: 0.42,
      });
      canv += Man.man(xoff + normRand(wid / 5, wid / 4), yoff, {
        fli: true,
        sca: 0.42,
      });
    }

    canv += this.rail(xoff, yoff, seed, {
      tra: false,
      fro: true,
      hei: 10,
      wid: wid,
      per: per * 2,
      seg: (3 + Math.random() * 3) | 0,
    });

    return canv;
  }

  /**
   * Generate arch02 - a multi-story building
   */
  static arch02(xoff: number, yoff: number, seed: number, options: Arch02Options = {}): string {
    const hei = options.hei ?? 10;
    const wid = options.wid ?? 50;
    const rot = options.rot ?? 0.3;
    const per = options.per ?? 5;
    const sto = options.sto ?? 3;
    const sty = options.sty ?? 1;
    const rai = options.rai ?? false;

    let canv = '';
    let hoff = 0;

    for (let i = 0; i < sto; i++) {
      canv += this.box(xoff, yoff - hoff, {
        tra: false,
        hei: hei,
        wid: wid * Math.pow(0.85, i),
        rot: rot,
        wei: 1.5,
        per: per,
        dec: (a) =>
          this.deco(sty, {
            ...a,
            hsp: [[], [1, 5], [1, 5], [1, 4]][sty] as [number, number],
            vsp: [[], [1, 2], [1, 2], [1, 3]][sty] as [number, number],
          }),
      });

      canv += rai
        ? this.rail(xoff, yoff - hoff, i * 0.2, {
            wid: wid * Math.pow(0.85, i) * 1.1,
            hei: hei / 2,
            per: per,
            rot: rot,
            wei: 0.5,
            tra: false,
          })
        : '';

      let pla: [number, string] | undefined = undefined;
      if (sto === 1 && Math.random() < 1 / 3) {
        pla = [1, 'Pizza Hut'];
      }

      canv += this.roof(xoff, yoff - hoff - hei, {
        hei: hei,
        wid: wid * Math.pow(0.9, i),
        rot: rot,
        wei: 1.5,
        per: per,
        pla: pla,
      });

      hoff += hei * 1.5;
    }
    return canv;
  }

  /**
   * Generate arch03 - a pagoda-style building
   */
  static arch03(xoff: number, yoff: number, seed: number, options: Arch03Options = {}): string {
    const hei = options.hei ?? 10;
    const wid = options.wid ?? 50;
    const rot = options.rot ?? 0.7;
    const per = options.per ?? 5;
    const sto = options.sto ?? 7;

    let canv = '';
    let hoff = 0;

    for (let i = 0; i < sto; i++) {
      canv += this.box(xoff, yoff - hoff, {
        tra: false,
        hei: hei,
        wid: wid * Math.pow(0.85, i),
        rot: rot,
        wei: 1.5,
        per: per / 2,
        dec: (a) => this.deco(1, { ...a, hsp: [1, 4], vsp: [1, 2] }),
      });

      canv += this.rail(xoff, yoff - hoff, i * 0.2, {
        seg: 5,
        wid: wid * Math.pow(0.85, i) * 1.1,
        hei: hei / 2,
        per: per / 2,
        rot: rot,
        wei: 0.5,
        tra: false,
      });

      canv += this.pagroof(xoff, yoff - hoff - hei, {
        hei: hei * 1.5,
        wid: wid * Math.pow(0.9, i),
        rot: rot,
        wei: 1.5,
        per: per,
      });

      hoff += hei * 1.5;
    }
    return canv;
  }

  /**
   * Generate arch04 - a transparent multi-story building
   */
  static arch04(xoff: number, yoff: number, seed: number, options: Arch04Options = {}): string {
    const hei = options.hei ?? 15;
    const wid = options.wid ?? 30;
    const rot = options.rot ?? 0.7;
    const per = options.per ?? 5;
    const sto = options.sto ?? 2;

    let canv = '';
    let hoff = 0;

    for (let i = 0; i < sto; i++) {
      canv += this.box(xoff, yoff - hoff, {
        tra: true,
        hei: hei,
        wid: wid * Math.pow(0.85, i),
        rot: rot,
        wei: 1.5,
        per: per / 2,
        dec: (a) => [],
      });

      canv += this.rail(xoff, yoff - hoff, i * 0.2, {
        seg: 3,
        wid: wid * Math.pow(0.85, i) * 1.2,
        hei: hei / 3,
        per: per / 2,
        rot: rot,
        wei: 0.5,
        tra: true,
      });

      canv += this.pagroof(xoff, yoff - hoff - hei, {
        hei: hei * 1,
        wid: wid * Math.pow(0.9, i),
        rot: rot,
        wei: 1.5,
        per: per,
      });

      hoff += hei * 1.2;
    }
    return canv;
  }

  /**
   * Generate boat01 - a simple boat with person
   */
  static boat01(xoff: number, yoff: number, seed: number, options: Boat01Options = {}): string {
    const len = options.len ?? 120;
    const sca = options.sca ?? 1;
    const fli = options.fli ?? false;

    let canv = '';
    const dir = fli ? -1 : 1;

    canv += Man.man(xoff + 20 * sca * dir, yoff, {
      ite: Man.stick01,
      hat: Man.hat02,
      sca: 0.5 * sca,
      fli: !fli,
      len: [0, 30, 20, 30, 10, 30, 30, 30, 30],
    });

    const plist1: Polygon = [];
    const plist2: Polygon = [];
    const fun1 = (x: number) => Math.pow(Math.sin(x * Math.PI), 0.5) * 7 * sca;
    const fun2 = (x: number) => Math.pow(Math.sin(x * Math.PI), 0.5) * 10 * sca;

    for (let i = 0; i < len * sca; i += 5 * sca) {
      plist1.push([i * dir, fun1(i / len)]);
      plist2.push([i * dir, fun2(i / len)]);
    }

    const plist = plist1.concat(plist2.reverse());
    canv += poly(plist, { xof: xoff, yof: yoff, fil: 'white' });
    canv += stroke(
      plist.map((v) => [xoff + v[0], yoff + v[1]]),
      {
        wid: 1,
        fun: (x: number) => Math.sin(x * Math.PI * 2),
        col: 'rgba(100,100,100,0.4)',
      }
    );

    return canv;
  }

  /**
   * Generate transmissionTower01 - an electricity transmission tower
   */
  static transmissionTower01(
    xoff: number,
    yoff: number,
    seed: number,
    options: TransmissionTower01Options = {}
  ): string {
    const hei = options.hei ?? 100;
    const wid = options.wid ?? 20;

    let canv = '';
    const toGlobal = (v: number[]): number[] => [v[0] + xoff, v[1] + yoff];

    const quickstroke = (pl: number[][] | number[][][]): string =>
      stroke(div(pl as any, 5).map(toGlobal), {
        wid: 1,
        fun: (x: number) => 0.5,
        col: 'rgba(100,100,100,0.4)',
      });

    const p00: number[] = [-wid * 0.05, -hei];
    const p01: number[] = [wid * 0.05, -hei];

    const p10: number[] = [-wid * 0.1, -hei * 0.9];
    const p11: number[] = [wid * 0.1, -hei * 0.9];

    const p20: number[] = [-wid * 0.2, -hei * 0.5];
    const p21: number[] = [wid * 0.2, -hei * 0.5];

    const p30: number[] = [-wid * 0.5, 0];
    const p31: number[] = [wid * 0.5, 0];

    const bch: [number, number][] = [
      [0.7, -0.85],
      [1, -0.675],
      [0.7, -0.5],
    ];

    for (let i = 0; i < bch.length; i++) {
      canv += quickstroke([
        [-bch[i][0] * wid, bch[i][1] * hei],
        [bch[i][0] * wid, bch[i][1] * hei],
      ]);
      canv += quickstroke([
        [-bch[i][0] * wid, bch[i][1] * hei],
        [0, (bch[i][1] - 0.05) * hei],
      ]);
      canv += quickstroke([
        [bch[i][0] * wid, bch[i][1] * hei],
        [0, (bch[i][1] - 0.05) * hei],
      ]);

      canv += quickstroke([
        [-bch[i][0] * wid, bch[i][1] * hei],
        [-bch[i][0] * wid, (bch[i][1] + 0.1) * hei],
      ]);
      canv += quickstroke([
        [bch[i][0] * wid, bch[i][1] * hei],
        [bch[i][0] * wid, (bch[i][1] + 0.1) * hei],
      ]);
    }

    const l10 = div([p00, p10, p20, p30], 5);
    const l11 = div([p01, p11, p21, p31], 5);

    for (let i = 0; i < l10.length - 1; i++) {
      canv += quickstroke([l10[i], l11[i + 1]]);
      canv += quickstroke([l11[i], l10[i + 1]]);
    }

    canv += quickstroke([p00, p01]);
    canv += quickstroke([p10, p11]);
    canv += quickstroke([p20, p21]);
    canv += quickstroke([p00, p10, p20, p30]);
    canv += quickstroke([p01, p11, p21, p31]);

    return canv;
  }
}
