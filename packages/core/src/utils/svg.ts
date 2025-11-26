import { Point, Polygon } from '../foundation/geometry';

export interface PolyOptions {
  /** X offset */
  xof?: number;
  /** Y offset */
  yof?: number;
  /** Fill color */
  fil?: string;
  /** Stroke color */
  str?: string;
  /** Stroke width */
  wid?: number;
}

/**
 * Generate an SVG polyline element from a list of points
 * @param plist - Array of points
 * @param options - Styling options
 * @returns SVG polyline string
 */
export function poly(plist: Polygon, options: PolyOptions = {}): string {
  const xof = options.xof ?? 0;
  const yof = options.yof ?? 0;
  const fil = options.fil ?? 'rgba(0,0,0,0)';
  const str = options.str ?? fil;
  const wid = options.wid ?? 0;

  let canv = "<polyline points='";
  for (let i = 0; i < plist.length; i++) {
    canv += ' ' + (plist[i][0] + xof).toFixed(1) + ',' + (plist[i][1] + yof).toFixed(1);
  }
  canv += "' style='fill:" + fil + ';stroke:' + str + ';stroke-width:' + wid + "'/>";
  return canv;
}
