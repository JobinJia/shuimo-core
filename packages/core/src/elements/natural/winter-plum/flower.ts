import { prng } from "../../../foundation/random";
import { Brush } from "../../../drawing/Brush";
import { blob } from "../../../drawing/Blob";
import type { PetalStyle } from "./constants";

export interface FlowerOptions {
  petalStyle: PetalStyle;
  /** 花瓣墨色 */
  color: string;
  size: number;
}

/** 把 rgba() 颜色按 factor 加深（用于花蕊） */
function darken(color: string, factor: number): string {
  const m = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (!m) return color;
  const r = Math.floor(Number(m[1]) * factor);
  const g = Math.floor(Number(m[2]) * factor);
  const b = Math.floor(Number(m[3]) * factor);
  const a = m[4] ? Number(m[4]) : 1;
  return `rgba(${r},${g},${b},${a})`;
}

/** 圈花：留白瓣 + 淡墨轮廓 + 放射深点蕊 */
function drawQuanhua(x: number, y: number, col: string, size: number): string {
  const petalCount = 5;
  const rx = size * 0.62;
  const ry = size * 0.74;
  const stamenCol = darken(col, 0.4);
  let svg = "";

  for (let i = 0; i < petalCount; i++) {
    const a = (i / petalCount) * Math.PI * 2 - Math.PI / 2 + (prng.next() - 0.5) * 0.18;
    const cx = x + Math.cos(a) * size * 0.5;
    const cy = y + Math.sin(a) * size * 0.5;
    const deg = (a * 180) / Math.PI + 90;
    const dash = (rx + ry) * 1.6; // 留小缺口，像手写的圈
    svg +=
      `<ellipse cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" rx="${rx.toFixed(2)}" ry="${ry.toFixed(2)}" ` +
      `transform="rotate(${deg.toFixed(2)} ${cx.toFixed(2)} ${cy.toFixed(2)})" ` +
      `fill="none" stroke="${col}" stroke-width="${(size * 0.13).toFixed(2)}" ` +
      `stroke-linecap="round" stroke-dasharray="${dash.toFixed(1)} ${(dash * 0.18).toFixed(1)}"/>`;
  }

  const stamenCount = 6 + Math.floor(prng.next() * 4);
  for (let i = 0; i < stamenCount; i++) {
    const a = prng.next() * Math.PI * 2;
    const len = size * (0.32 + prng.next() * 0.34);
    const ex = x + Math.cos(a) * len;
    const ey = y + Math.sin(a) * len;
    svg +=
      `<line x1="${x.toFixed(2)}" y1="${y.toFixed(2)}" x2="${ex.toFixed(2)}" y2="${ey.toFixed(2)}" ` +
      `stroke="${stamenCol}" stroke-width="${(size * 0.05).toFixed(2)}" stroke-linecap="round"/>`;
    svg += Brush.dot(ex, ey, { width: size * 0.13, color: stamenCol, noise: 0.6 });
  }
  svg += Brush.dot(x, y, { width: size * 0.18, color: stamenCol, noise: 0.5 });
  return svg;
}

/** 点厾：实心墨瓣 + 简化蕊 */
function drawDiancuo(x: number, y: number, col: string, size: number): string {
  const petalCount = 5;
  const stamenCol = darken(col, 0.35);
  let svg = "";

  for (let i = 0; i < petalCount; i++) {
    const a = (i / petalCount) * Math.PI * 2 - Math.PI / 2 + (prng.next() - 0.5) * 0.2;
    const cx = x + Math.cos(a) * size * 0.5;
    const cy = y + Math.sin(a) * size * 0.5;
    svg += blob(cx, cy, { len: size * 0.95, wid: size * 0.62, ang: a, col, ret: 0 }) as string;
  }

  const stamenCount = 4 + Math.floor(prng.next() * 3);
  for (let i = 0; i < stamenCount; i++) {
    const a = prng.next() * Math.PI * 2;
    const d = size * (0.15 + prng.next() * 0.25);
    svg += Brush.dot(x + Math.cos(a) * d, y + Math.sin(a) * d, {
      width: size * 0.1,
      color: stamenCol,
      noise: 0.6,
    });
  }
  svg += Brush.dot(x, y, { width: size * 0.16, color: stamenCol, noise: 0.5 });
  return svg;
}

export function drawFlower(x: number, y: number, opts: FlowerOptions): string {
  return opts.petalStyle === "diancuo"
    ? drawDiancuo(x, y, opts.color, opts.size)
    : drawQuanhua(x, y, opts.color, opts.size);
}
