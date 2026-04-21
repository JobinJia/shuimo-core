import { Vector2 } from "../../foundation/geometry/Vector2";
import { SimplexNoise } from "../../foundation/noise/SimplexNoise";
import type { InkFill, MountainLayer } from "./types";

export interface InkWashInput {
  layer: MountainLayer;
  seed: number;
  splashCount: number;
}

function seededRandom(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export function generateInkFill(input: InkWashInput): InkFill {
  const { layer, seed, splashCount } = input;
  const { depth, ridgeLine, bounds } = layer;

  const rand = seededRandom(seed);

  // Step 1: Generate gradient with 5 stops using quadratic easing
  const stopCount = 5;
  const baseOpacity = 0.05 + depth * 0.15;
  const maxOpacity = 0.4 + depth * 0.5;

  const gradient: { stop: number; opacity: number }[] = [];
  for (let i = 0; i < stopCount; i++) {
    const t = i / (stopCount - 1);
    const opacity = baseOpacity + (maxOpacity - baseOpacity) * t * t;
    gradient.push({ stop: t, opacity });
  }

  // Step 2: Generate splash regions (泼墨)
  const noise = new SimplexNoise(seed + 1000);
  const splashes: Vector2[][] = [];

  for (let s = 0; s < splashCount; s++) {
    // Pick a random position along the ridge (20%-80%)
    const t = 0.2 + rand() * 0.6;
    const ridgeIndex = Math.floor(t * (ridgeLine.length - 1));
    const ridgePoint = ridgeLine[ridgeIndex];

    // Place splash below the ridge
    const splashX = ridgePoint.x;
    const splashY = ridgePoint.y + bounds.height * (0.4 + rand() * 0.4);

    // Splash radius scaled by depth (larger for near mountains)
    const baseRadius = bounds.width * 0.04 * (0.5 + depth * 0.8);

    // Generate 12-segment closed polygon using SimplexNoise to modulate radius
    const segCount = 12;
    const polygon: Vector2[] = [];
    for (let i = 0; i < segCount; i++) {
      const angle = (i / segCount) * Math.PI * 2;
      const noiseVal = noise.noise2D(Math.cos(angle) * 2 + s * 5, Math.sin(angle) * 2 + s * 5);
      const radius = baseRadius * (0.7 + 0.5 * noiseVal);
      polygon.push(
        new Vector2(splashX + Math.cos(angle) * radius, splashY + Math.sin(angle) * radius),
      );
    }
    splashes.push(polygon);
  }

  return {
    gradient,
    splashes,
    noiseSeed: seed + 5000,
  };
}
