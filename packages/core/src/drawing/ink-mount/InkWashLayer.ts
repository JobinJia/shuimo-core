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

  // Opacity profile down the body (0 = silhouette edge, 1 = canvas
  // bottom). The renderer samples it per column relative to the local
  // edge height, so the wash follows the mountain's form instead of
  // horizontal bands. Near layers keep more body so they occlude the far
  // ones; every layer thins toward its foot where mist takes over.
  const stopCount = 5;
  const topOpacity = 0.9 + depth * 0.08;
  const footOpacity = 0.1 + depth * 0.22;

  const gradient: { stop: number; opacity: number }[] = [];
  for (let i = 0; i < stopCount; i++) {
    const t = i / (stopCount - 1);
    // Mild ease-out: the ink thins steadily down the body.
    const k = t * (1.4 - 0.4 * t);
    gradient.push({ stop: t, opacity: topOpacity + (footOpacity - topOpacity) * k });
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
