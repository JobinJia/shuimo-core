import { Polygon } from "../foundation/geometry";
import { randGaussian } from "../utils/random";
import { poly } from "../utils/svg";

export interface InkBleedOptions {
  /** Scale of the base shape; drives default variance */
  len?: number;
  /** Ink color as "r,g,b" string, or array for multi-pigment cycling */
  col?: string | string[];
  /** Consecutive layers per color before cycling to the next */
  layersPerColor?: number;
  /** Number of stacked deformed copies (Hobbs: 30–100) */
  layerCount?: number;
  /** Per-layer fill alpha (Hobbs: ~0.04) */
  alpha?: number;
  /** Recursion depth for the master polygon deformation */
  masterDepth?: number;
  /** Initial displacement scale for the master deformation */
  masterVariance?: number;
  /** Recursion depth applied to each per-layer copy */
  layerDepth?: number;
  /** Initial displacement scale for per-layer deformations */
  layerVariance?: number;
  /** Multiplicative decay of variance at each recursion step */
  varianceDecay?: number;
  /** Override the starting polygon (else a regular n-gon at (x,y)) */
  basePolygon?: Polygon;
  /** Sides of the default regular polygon */
  baseSides?: number;
  /** 0 = SVG string (default), 1 = array of layered Polygons */
  ret?: 0 | 1;
}

function makeRegularPolygon(cx: number, cy: number, r: number, n: number): Polygon {
  const p: Polygon = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    p.push([cx + Math.cos(t) * r, cy + Math.sin(t) * r]);
  }
  return p;
}

function deformOnce(p: Polygon, variance: number): Polygon {
  const out: Polygon = [];
  const n = p.length;
  for (let i = 0; i < n; i++) {
    const A = p[i];
    const C = p[(i + 1) % n];
    const mx = (A[0] + C[0]) / 2;
    const my = (A[1] + C[1]) / 2;
    out.push(A, [mx + randGaussian() * variance, my + randGaussian() * variance]);
  }
  return out;
}

function deform(p: Polygon, variance: number, depth: number, decay: number): Polygon {
  let cur = p;
  let v = variance;
  for (let d = 0; d < depth; d++) {
    cur = deformOnce(cur, v);
    v *= decay;
  }
  return cur;
}

/**
 * Tyler Hobbs–style generative watercolor fill.
 * Recursively subdivides + Gaussian-displaces a polygon, then stacks
 * many low-opacity deformed copies to produce a soft ink-bleed shape.
 */
export class InkBleed {
  static generate(x: number, y: number, options: InkBleedOptions = {}): string | Polygon[] {
    const len = options.len ?? 40;
    const layersPerColor = options.layersPerColor ?? 5;
    const layerCount = options.layerCount ?? 50;
    const alpha = options.alpha ?? 0.04;
    const masterDepth = options.masterDepth ?? 7;
    const masterVariance = options.masterVariance ?? len * 0.05;
    const layerDepth = options.layerDepth ?? 4;
    const layerVariance = options.layerVariance ?? len * 0.02;
    const varianceDecay = options.varianceDecay ?? 0.8;
    const baseSides = options.baseSides ?? 8;
    const basePolygon = options.basePolygon ?? makeRegularPolygon(x, y, len / 2, baseSides);
    const ret = options.ret ?? 0;

    const rawCol = options.col ?? "20,20,20";
    const colorList = Array.isArray(rawCol) ? rawCol : [rawCol];

    const master = deform(basePolygon, masterVariance, masterDepth, varianceDecay);

    const layers: Polygon[] = [];
    for (let i = 0; i < layerCount; i++) {
      layers.push(deform(master, layerVariance, layerDepth, varianceDecay));
    }

    if (ret === 1) return layers;

    const parts: string[] = [];
    for (let i = 0; i < layers.length; i++) {
      const c = colorList[Math.floor(i / layersPerColor) % colorList.length];
      const fil = `rgba(${c},${alpha})`;
      parts.push(poly(layers[i], { fil, str: fil, wid: 0 }));
    }
    return parts.join("");
  }
}

export const inkBleed = (x: number, y: number, options?: InkBleedOptions): string | Polygon[] =>
  InkBleed.generate(x, y, options);
