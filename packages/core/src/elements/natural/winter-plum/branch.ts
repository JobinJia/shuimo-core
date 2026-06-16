import type { Polygon } from "../../../foundation/geometry";
import { noise } from "../../../foundation/noise";
import { prng } from "../../../foundation/random";
import { Brush } from "../../../drawing/Brush";
import type { BranchPoint } from "./constants";

export interface BranchOptions {
  x: number;
  y: number;
  angle: number;
  length: number;
  width: number;
  col: string;
  /** 0-1 飞白强度 */
  flyingWhite: number;
  depth: number;
  /** 花/苞锚点，原地追加 */
  anchors: BranchPoint[];
}

export function drawBranch(opts: BranchOptions): string {
  const { x, y, angle, length, width, col, flyingWhite, depth, anchors } = opts;
  if (depth <= 0 || length < 14 || width < 0.8) return "";

  const points: Polygon = [];
  const steps = Math.max(8, Math.floor(length / 6));
  const n0 = prng.next() * 100;
  const bend = (prng.next() - 0.5) * 0.5;
  const perp = angle + Math.PI / 2;

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const curve = Math.sin(t * Math.PI) * bend * length * 0.25;
    const gnarl = (noise.noise(t * 4, n0) - 0.5) * width;
    const px = x + Math.cos(angle) * length * t + Math.cos(perp) * (curve + gnarl);
    const py = y + Math.sin(angle) * length * t + Math.sin(perp) * (curve + gnarl);
    points.push([px, py]);
    if (i > 0 && i % 2 === 0) {
      anchors.push({ x: px, y: py, angle, depth });
    }
  }

  let svg = Brush.stroke(points, {
    width,
    color: col,
    pressure: (t: number) => Math.max(0.15, 1 - t * 0.8),
    inkStart: 0.85,
    inkEnd: 0.4,
    noise: 0.5,
    flyingWhite: flyingWhite * 0.6,
  });

  // 子枝向上挑
  const subCount = depth > 1 ? 1 + Math.floor(prng.next() * 2) : 0;
  for (let i = 0; i < subCount; i++) {
    const t = 0.4 + prng.next() * 0.5;
    const idx = Math.floor(t * (points.length - 1));
    const pt = points[idx];
    const tiltUp = -Math.PI / 2;
    const subAngle = angle * 0.4 + tiltUp * 0.6 + (prng.next() - 0.5) * (Math.PI / 3);
    svg += drawBranch({
      x: pt[0],
      y: pt[1],
      angle: subAngle,
      length: length * (0.45 + prng.next() * 0.3),
      width: width * (0.5 + prng.next() * 0.25),
      col,
      flyingWhite,
      depth: depth - 1,
      anchors,
    });
  }
  return svg;
}
