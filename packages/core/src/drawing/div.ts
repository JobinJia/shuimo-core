import { Polygon } from '../foundation/geometry';

/**
 * Subdivide a polyline by interpolating between points
 * Creates a smoother polyline with more points
 *
 * @param plist - Array of points to subdivide
 * @param reso - Resolution (number of interpolated points between each pair)
 * @returns Subdivided polyline
 */
export function div(plist: Polygon, reso: number): Polygon {
  const tl = (plist.length - 1) * reso;
  let lx = 0;
  let ly = 0;
  const rlist: Polygon = [];

  for (let i = 0; i < tl; i += 1) {
    const lastp = plist[Math.floor(i / reso)];
    const nextp = plist[Math.ceil(i / reso)];
    const p = (i % reso) / reso;
    const nx = lastp[0] * (1 - p) + nextp[0] * p;
    const ny = lastp[1] * (1 - p) + nextp[1] * p;

    const ang = Math.atan2(ny - ly, nx - lx);

    rlist.push([nx, ny]);
    lx = nx;
    ly = ny;
  }

  if (plist.length > 0) {
    rlist.push(plist[plist.length - 1]);
  }

  return rlist;
}
