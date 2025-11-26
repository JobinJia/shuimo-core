import { mapval } from './math';

/**
 * Randomly choose an element from an array
 * @param arr - Array to choose from
 * @returns Random element from array
 */
export function randChoice<T>(arr: T[]): T {
  return arr[Math.floor(arr.length * Math.random())];
}

/**
 * Generate a random number in a range
 * @param m - Minimum value
 * @param M - Maximum value
 * @returns Random number in range [m, M]
 */
export function normRand(m: number, M: number): number {
  return mapval(Math.random(), 0, 1, m, M);
}

/**
 * Generate a weighted random number based on a probability function
 * Uses rejection sampling
 * @param func - Probability density function (should return value between 0 and 1)
 * @returns Random value weighted by the function
 */
export function wtrand(func: (x: number) => number): number {
  const x = Math.random();
  const y = Math.random();
  if (y < func(x)) {
    return x;
  } else {
    return wtrand(func);
  }
}

/**
 * Generate a random number from a Gaussian-like distribution
 * Returns values in range [-1, 1] with concentration around 0
 * @returns Random Gaussian value
 */
export function randGaussian(): number {
  return (
    wtrand(function (x) {
      return Math.pow(Math.E, -24 * Math.pow(x - 0.5, 2));
    }) *
      2 -
    1
  );
}
