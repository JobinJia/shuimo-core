import { Point } from '../foundation/geometry';

/**
 * Replace NaN and undefined values with 0
 * @param value - Value or array to clean
 * @returns Cleaned value
 */
export function unNan(value: any): any {
  if (typeof value !== 'object' || value === null) {
    return value || 0;
  } else {
    return value.map(unNan);
  }
}

/**
 * Calculate Euclidean distance between two points
 * @param p0 - First point
 * @param p1 - Second point
 * @returns Distance between points
 */
export function distance(p0: Point, p1: Point): number {
  return Math.sqrt(Math.pow(p0[0] - p1[0], 2) + Math.pow(p0[1] - p1[1], 2));
}

/**
 * Map a value from one range to another
 * @param value - Value to map
 * @param istart - Input range start
 * @param istop - Input range end
 * @param ostart - Output range start
 * @param ostop - Output range end
 * @returns Mapped value
 */
export function mapval(
  value: number,
  istart: number,
  istop: number,
  ostart: number,
  ostop: number
): number {
  return ostart + (ostop - ostart) * (((value - istart) * 1.0) / (istop - istart));
}

/**
 * Normalize a noise array to loop seamlessly
 * Modifies the array in place
 * @param nslist - Array of noise values
 */
export function loopNoise(nslist: number[]): void {
  const dif = nslist[nslist.length - 1] - nslist[0];
  const bds: [number, number] = [100, -100];

  for (let i = 0; i < nslist.length; i++) {
    nslist[i] += (dif * (nslist.length - 1 - i)) / (nslist.length - 1);
    if (nslist[i] < bds[0]) bds[0] = nslist[i];
    if (nslist[i] > bds[1]) bds[1] = nslist[i];
  }

  for (let i = 0; i < nslist.length; i++) {
    nslist[i] = mapval(nslist[i], bds[0], bds[1], 0, 1);
  }
}
