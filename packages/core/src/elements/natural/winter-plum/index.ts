import { prng } from "../../../foundation/random";
import {
  DEFAULTS,
  FLYING_WHITE_INTENSITY,
  type BranchPoint,
  type Composition,
  type FlyingWhitePreset,
  type PetalStyle,
} from "./constants";
import { drawTrunk } from "./trunk";
import { drawBranch } from "./branch";
import { drawFlower } from "./flower";
import { drawBud } from "./bud";

export interface WinterPlumOptions {
  /** 主干高度 */
  hei?: number;
  /** 主干宽度 */
  wid?: number;
  /** 主干数量 */
  branches?: number;
  /** 落花密度 (0-1) */
  flowerDensity?: number;
  /** 花瓣墨色 */
  flowerColor?: string;
  /** 是否含花苞 */
  withBuds?: boolean;
  /** 枝干墨色 */
  col?: string;
  /** 花瓣画法，默认圈花 */
  petalStyle?: PetalStyle;
  /** 构图走势，默认主干 S 上扬 */
  composition?: Composition;
  /** 飞白强度预设，默认强 */
  flyingWhite?: FlyingWhitePreset;
}

export interface PlumBlossomOptions {
  count?: number;
  size?: number;
  col?: string;
  petalStyle?: PetalStyle;
}

export class WinterPlum {
  static generate(
    xoff: number,
    yoff: number,
    seed: number,
    options: WinterPlumOptions = {},
  ): string {
    prng.seed(seed);

    const hei = options.hei ?? DEFAULTS.hei;
    const wid = options.wid ?? DEFAULTS.wid;
    const branchCount = Math.max(1, options.branches ?? DEFAULTS.branches);
    const density = options.flowerDensity ?? DEFAULTS.flowerDensity;
    const flowerColor = options.flowerColor ?? DEFAULTS.flowerColor;
    const withBuds = options.withBuds ?? DEFAULTS.withBuds;
    const col = options.col ?? DEFAULTS.col;
    const petalStyle = options.petalStyle ?? DEFAULTS.petalStyle;
    const composition = options.composition ?? DEFAULTS.composition;
    const fw = FLYING_WHITE_INTENSITY[options.flyingWhite ?? DEFAULTS.flyingWhite];

    let svg = "";
    const anchors: BranchPoint[] = [];

    for (let b = 0; b < branchCount; b++) {
      const tx = xoff + (prng.next() - 0.5) * wid * 2;
      const trunk = drawTrunk({
        x: tx,
        y: yoff,
        hei: hei * (0.85 + prng.next() * 0.3),
        wid,
        col,
        composition,
        flyingWhite: fw,
      });
      svg += trunk.svg;
      anchors.push(...trunk.anchors);

      for (const o of trunk.branchOrigins) {
        svg += drawBranch({
          x: o.x,
          y: o.y,
          angle: o.angle,
          length: hei * (0.3 + prng.next() * 0.25),
          width: wid * (0.35 + prng.next() * 0.2),
          col,
          flyingWhite: fw,
          depth: 3,
          anchors,
        });
      }
    }

    for (const pt of anchors) {
      if (prng.next() > density) continue;
      const ox = (prng.next() - 0.5) * 8;
      const oy = (prng.next() - 0.5) * 8;
      const isBud = withBuds && prng.next() < 0.25;
      if (isBud) {
        svg += drawBud(pt.x + ox, pt.y + oy, col, 4 + prng.next() * 3);
      } else {
        svg += drawFlower(pt.x + ox, pt.y + oy, {
          petalStyle,
          color: flowerColor,
          size: 8 + prng.next() * 6,
        });
      }
    }

    return svg;
  }

  static blossoms(
    xoff: number,
    yoff: number,
    seed: number,
    options: PlumBlossomOptions = {},
  ): string {
    prng.seed(seed);
    const count = options.count ?? 5;
    const size = options.size ?? 12;
    const col = options.col ?? DEFAULTS.flowerColor;
    const petalStyle = options.petalStyle ?? DEFAULTS.petalStyle;

    let svg = "";
    for (let i = 0; i < count; i++) {
      svg += drawFlower(xoff + (prng.next() - 0.5) * 50, yoff + (prng.next() - 0.5) * 50, {
        petalStyle,
        color: col,
        size: size * (0.7 + prng.next() * 0.6),
      });
    }
    return svg;
  }
}

export function winterPlum(
  xoff: number,
  yoff: number,
  seed: number,
  options?: WinterPlumOptions,
): string {
  return WinterPlum.generate(xoff, yoff, seed, options);
}

export function plumBlossoms(
  xoff: number,
  yoff: number,
  seed: number,
  options?: PlumBlossomOptions,
): string {
  return WinterPlum.blossoms(xoff, yoff, seed, options);
}

export { type BranchPoint, type Composition, type FlyingWhitePreset, type PetalStyle };
