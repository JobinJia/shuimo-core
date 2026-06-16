import type { Polygon } from "../../../foundation/geometry";
import { noise } from "../../../foundation/noise";
import { prng } from "../../../foundation/random";
import { Brush } from "../../../drawing/Brush";
import type { BranchPoint, Composition } from "./constants";

export interface TrunkOptions {
  x: number;
  y: number;
  hei: number;
  wid: number;
  col: string;
  composition: Composition;
  /** 0-1 飞白强度 */
  flyingWhite: number;
}

export interface TrunkResult {
  svg: string;
  anchors: BranchPoint[];
  /** 新枝起点 */
  branchOrigins: { x: number; y: number; angle: number }[];
}

export function drawTrunk(opts: TrunkOptions): TrunkResult {
  const { x, y, hei, wid, col, composition, flyingWhite } = opts;
  const points: Polygon = [];
  const anchors: BranchPoint[] = [];
  const branchOrigins: { x: number; y: number; angle: number }[] = [];

  const steps = Math.max(24, Math.floor(hei / 8));
  const n0 = prng.next() * 100;

  // 主生长方向（数学角，-PI/2 向上；SVG y 向下，sin 取负即向上）
  const baseAngle = composition === "diagonal" ? -Math.PI / 4 : -Math.PI / 2;
  // S 形摆幅（占高比例）
  const sway = (composition === "diagonal" ? 0.1 : 0.16) * hei;
  const swayDir = prng.next() < 0.5 ? 1 : -1;
  const perp = baseAngle + Math.PI / 2;
  const stepBucket = Math.max(1, Math.floor(steps / 4));

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const along = hei * t;
    const sCurve = Math.sin(t * Math.PI * 1.2) * sway * swayDir;
    const gnarl = (noise.noise(t * 3, n0) - 0.5) * wid * 2.2;
    const px = x + Math.cos(baseAngle) * along + Math.cos(perp) * (sCurve + gnarl);
    const py = y + Math.sin(baseAngle) * along + Math.sin(perp) * (sCurve + gnarl);
    points.push([px, py]);

    // 上 2/3 段生新枝起点
    if (i > steps * 0.3 && i % stepBucket === 0) {
      const dir =
        baseAngle + (prng.next() < 0.5 ? 1 : -1) * (Math.PI / 4 + (prng.next() * Math.PI) / 6);
      branchOrigins.push({ x: px, y: py, angle: dir });
    }
    if (i > 0 && i % 4 === 0) {
      anchors.push({ x: px, y: py, angle: baseAngle, depth: 3 });
    }
  }

  // 湿墨核（不飞白，略窄，托底）
  const core = Brush.stroke(points, {
    width: wid * 0.92,
    color: col,
    pressure: (t: number) => 1 - t * 0.55,
    inkStart: 1,
    inkEnd: 0.7,
    noise: 0.35,
    flyingWhite: 0,
  });
  // 表层（飞白枯笔）
  const surface = Brush.stroke(points, {
    width: wid,
    color: col,
    pressure: (t: number) => 1 - t * 0.55,
    inkStart: 0.9,
    inkEnd: 0.45,
    noise: 0.55,
    flyingWhite,
    texture: 6,
  });

  return { svg: core + surface, anchors, branchOrigins };
}
