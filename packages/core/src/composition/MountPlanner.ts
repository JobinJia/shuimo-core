import { noise } from '../foundation/noise';

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
 * MountPlanner - Plan mountain and landscape element placement
 * Generates a plan for where to place mountains, boats, and other elements
 */
export class MountPlanner {
  /**
   * Check if a point is a local maximum in the noise field
   */
  private static locmax(
    x: number,
    y: number,
    f: (x: number, y: number) => number,
    r: number
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
    planmtx: number[]
  ): boolean {
    for (let k = 0; k < reg.length; k++) {
      if (Math.abs(reg[k].x - r.x) < mind) {
        return false;
      }
    }
    console.log('+');
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
    const ns = (x: number, y: number): number => {
      return Math.max(noise.noise(x * samp) - 0.55, 0) * 2;
    };
    const nns = (x: number): number => {
      return 1 - noise.noise(x * samp);
    };
    const nnns = (x: number, y: number): number => {
      return Math.max(noise.noise(x * samp * 2, 2) - 0.55, 0) * 2;
    };
    const yr = (x: number): number => {
      return noise.noise(x * 0.01, Math.PI);
    };

    const xstep = 5;
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
          const xof = i + 2 * (Math.random() - 0.5) * 500;
          const yof = j + 300;
          const r: PlanItem = { tag: 'mount', x: xof, y: yof, h: ns(i, j) };
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
          tag: 'distmount',
          x: i,
          y: 280 - Math.random() * 50,
          h: ns(i, 0),
        };
        this.chadd(reg, r, 10, planmtx);
      }
    }

    console.log([xmin, xmax]);

    // Fill empty areas with flat mountains
    for (let i = xmin; i < xmax; i += xstep) {
      if (planmtx[Math.floor(i / xstep)] === 0) {
        if (Math.random() < 0.01) {
          for (let j = 0; j < 4 * Math.random(); j++) {
            const r: PlanItem = {
              tag: 'flatmount',
              x: i + 2 * (Math.random() - 0.5) * 700,
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
      if (Math.random() < 0.2) {
        const r: PlanItem = { tag: 'boat', x: i, y: 300 + Math.random() * 390, h: 0 };
        this.chadd(reg, r, 400, planmtx);
      }
    }

    return reg;
  }
}
