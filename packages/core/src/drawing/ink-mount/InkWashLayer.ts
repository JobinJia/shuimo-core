import { Vector2 } from "../../foundation/geometry/Vector2";
import type { InkFill, MountainLayer } from "./types";

export interface InkWashInput {
  layer: MountainLayer;
  seed: number;
  /**
   * @deprecated The mountain silhouette itself now carries the watercolor
   * edge-bleed (Hobbs deform applied in the renderer), so separate splash
   * regions are no longer rendered. Kept in the input for API stability;
   * the value is ignored.
   */
  splashCount: number;
}

export function generateInkFill(input: InkWashInput): InkFill {
  const { layer, seed } = input;
  const { depth } = layer;

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

  // Splash regions intentionally empty — the watercolor effect is now applied
  // to the mountain silhouette itself via a Hobbs-deformed soft mask in the
  // Canvas2D backend, not as separate dark blobs inside the mountain.
  const splashes: Vector2[][] = [];

  return {
    gradient,
    splashes,
    noiseSeed: seed + 5000,
  };
}
