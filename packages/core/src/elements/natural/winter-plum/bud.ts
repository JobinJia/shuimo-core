import { prng } from "../../../foundation/random";
import { Brush } from "../../../drawing/Brush";

/** 枝头深墨圆苞 + 小萼点 */
export function drawBud(x: number, y: number, col: string, size = 5): string {
  const r = size * (0.8 + prng.next() * 0.5);
  let svg = Brush.dot(x, y, { width: r, color: col, noise: 0.5 });
  const a = -Math.PI / 2 + (prng.next() - 0.5) * 0.6;
  svg += Brush.dot(x + Math.cos(a) * r * 0.6, y + Math.sin(a) * r * 0.6, {
    width: r * 0.5,
    color: col,
    noise: 0.6,
  });
  return svg;
}
