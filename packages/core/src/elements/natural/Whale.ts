import { Polygon } from "../../foundation/geometry";
import { noise } from "../../foundation/noise";
import { prng } from "../../foundation/random";
import { stroke } from "../../drawing/Stroke";
import { blob } from "../../drawing/Blob";

export interface WhaleOptions {
  /** Body length */
  len?: number;
  /** Body height */
  hei?: number;
  /** Ink color */
  col?: string;
  /** Number of ink wash layers (1-4) */
  washLayers?: number;
}

/**
 * Whale - Generate Chinese ink painting style whale (墨鲸)
 *
 * Uses layered ink washes, expressive brush strokes and organic
 * curves to create a traditional ink painting whale.
 *
 * The whale swims to the right, with tail at left and head at right.
 */
export class Whale {
  static generate(xoff: number, yoff: number, seed: number, options: WhaleOptions = {}): string {
    prng.seed(seed);

    const len = options.len ?? 200;
    const hei = options.hei ?? 80;
    const col = options.col ?? "rgba(30,30,28,0.85)";
    const washLayers = Math.min(Math.max(options.washLayers ?? 3, 1), 4);

    let svg = "";
    const n0 = prng.random() * 100;

    // Phase 1: Body wash layers (浓淡 - varying ink density)
    // Multiple broad strokes overlapping to create the body mass
    for (let layer = 0; layer < washLayers; layer++) {
      const alpha = 0.08 + layer * 0.1 + prng.random() * 0.04;
      const layerWid = hei * 0.55 * (1 - layer * 0.18);
      const steps = 24;

      const bodyOutline: Polygon = [];

      // Top half (back) - from tail to head
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const x = t * len;
        // Back curve: rises slightly, peaks near head (humpback shape)
        const backHeight =
          -hei * 0.42 -
          Math.sin(t * Math.PI * 0.6) * hei * 0.18 * noise.noise(t * 3 + layer * 0.7, n0);
        bodyOutline.push([x, backHeight + (prng.random() - 0.5) * hei * 0.06]);
      }

      // Bottom half (belly) - from head back to tail (reversed)
      for (let i = steps; i >= 0; i--) {
        const t = i / steps;
        const x = t * len;
        // Belly curve: fuller than back, gentle drooping
        const bellyHeight =
          hei * 0.38 +
          Math.sin(t * Math.PI * 0.55) * hei * 0.22 * noise.noise(t * 3 + layer * 0.7 + 1, n0);
        bodyOutline.push([x, bellyHeight + (prng.random() - 0.5) * hei * 0.06]);
      }

      bodyOutline.push(bodyOutline[0]);

      const a = alpha.toFixed(3);
      const layerCol = col.replace(/[\d.]+\)$/, `${a})`);
      svg += stroke(
        bodyOutline.map(([x, y]) => [x + xoff, y + yoff]),
        {
          col: layerCol,
          wid: layerWid,
          noi: 0.25 + layer * 0.08,
        },
      );
    }

    // Phase 2: Dorsal spine (背脊) - bold dark stroke from tail to head
    {
      const spine: Polygon = [];
      const steps = 28;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const x = t * len;
        const y =
          -hei * 0.43 - Math.sin(t * Math.PI * 0.6) * hei * 0.16 * noise.noise(t * 3 + 10, n0);
        spine.push([x + xoff, y + yoff]);
      }
      svg += stroke(spine, {
        col: col,
        wid: hei * 0.12,
        noi: 0.2,
      });
    }

    // Phase 3: Belly line (腹线) - lighter stroke
    {
      const belly: Polygon = [];
      const steps = 28;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const x = t * len;
        const y =
          hei * 0.36 + Math.sin(t * Math.PI * 0.55) * hei * 0.18 * noise.noise(t * 3 + 15, n0);
        belly.push([x + xoff, y + yoff]);
      }
      svg += stroke(belly, {
        col: col.replace(/[\d.]+\)$/, "0.45)"),
        wid: hei * 0.08,
        noi: 0.3,
      });
    }

    // Phase 4: Tail flukes (尾鳍) - expressive brush strokes
    {
      const tailBaseX = xoff + len * 0.05;
      const tailBaseY = yoff;
      const tailLen = hei * 0.8;

      // Upper fluke - sweeping curve upward
      const upperFluke: Polygon = [];
      const flukeSteps = 14;
      for (let i = 0; i <= flukeSteps; i++) {
        const t = i / flukeSteps;
        const angle = -Math.PI * 0.25 - t * Math.PI * 0.35;
        const dist =
          t * tailLen + Math.sin(t * Math.PI) * tailLen * 0.15 * noise.noise(i * 0.6 + 20, n0);
        upperFluke.push([tailBaseX + Math.cos(angle) * dist, tailBaseY + Math.sin(angle) * dist]);
      }
      svg += stroke(upperFluke, {
        col: col,
        wid: hei * 0.09,
        noi: 0.3,
      });

      // Lower fluke - sweeping curve downward
      const lowerFluke: Polygon = [];
      for (let i = 0; i <= flukeSteps; i++) {
        const t = i / flukeSteps;
        const angle = Math.PI * 0.15 + t * Math.PI * 0.35;
        const dist =
          t * tailLen * 0.9 +
          Math.sin(t * Math.PI) * tailLen * 0.12 * noise.noise(i * 0.6 + 25, n0);
        lowerFluke.push([tailBaseX + Math.cos(angle) * dist, tailBaseY + Math.sin(angle) * dist]);
      }
      svg += stroke(lowerFluke, {
        col: col,
        wid: hei * 0.08,
        noi: 0.3,
      });
    }

    // Phase 5: Pectoral fin (胸鳍) - small curved stroke on the body
    {
      const finX = xoff + len * 0.45;
      const finY = yoff + hei * 0.25;
      const fin: Polygon = [];
      const fsteps = 10;
      for (let i = 0; i <= fsteps; i++) {
        const t = i / fsteps;
        const a = Math.PI * 0.5 + t * Math.PI * 0.25;
        const d = hei * 0.2 * (1 - t * 0.5) * (1 + noise.noise(i * 0.8, n0) * 0.2);
        fin.push([finX + Math.cos(a) * d, finY + Math.sin(a) * d]);
      }
      svg += stroke(fin, {
        col: col.replace(/[\d.]+\)$/, "0.6)"),
        wid: hei * 0.05,
        noi: 0.3,
      });
    }

    // Phase 6: Dorsal fin (背鳍) - small hump on top
    {
      const dfinX = xoff + len * 0.6;
      const dfinY = yoff - hei * 0.35;
      const dfin: Polygon = [];
      const dsteps = 8;
      for (let i = 0; i <= dsteps; i++) {
        const t = i / dsteps;
        const a = -Math.PI * 0.3 - t * Math.PI * 0.3;
        const d = hei * 0.12 * (1 + noise.noise(i * 0.7, n0 + 1) * 0.3);
        dfin.push([dfinX + Math.cos(a) * d, dfinY + Math.sin(a) * d]);
      }
      svg += stroke(dfin, {
        col: col,
        wid: hei * 0.04,
        noi: 0.2,
      });
    }

    // Phase 7: Eye (眼睛) - bold ink dot
    {
      const eyeX = xoff + len * 0.78;
      const eyeY = yoff - hei * 0.18;
      const eyeBlob = blob(eyeX, eyeY, {
        len: hei * 0.06,
        wid: hei * 0.04,
        col: "rgba(10,10,10,0.9)",
        noi: 0.3,
        ang: prng.random() * Math.PI,
      });
      if (typeof eyeBlob === "string") svg += eyeBlob;
    }

    // Phase 8: Blowhole spout (喷水) - misty vertical strokes
    {
      const spoutX = xoff + len * 0.7;
      const spoutY = yoff - hei * 0.38;
      const spoutCount = 5 + Math.floor(prng.random() * 4);

      for (let s = 0; s < spoutCount; s++) {
        const sx = spoutX + (prng.random() - 0.5) * hei * 0.15;
        const spout: Polygon = [];
        const ssteps = 10;
        const spoutHeight = hei * (0.4 + prng.random() * 0.6);
        const spoutSpread = (prng.random() - 0.5) * hei * 0.15;

        for (let i = 0; i <= ssteps; i++) {
          const t = i / ssteps;
          const y = spoutY - t * spoutHeight;
          const xSpread =
            Math.sin(t * Math.PI) * spoutSpread * (1 + noise.noise(i * 0.4 + s, n0) * 0.5);
          spout.push([sx + xSpread, y]);
        }

        const spoutAlpha = (0.15 + prng.random() * 0.2).toFixed(3);
        svg += stroke(spout, {
          col: col.replace(/[\d.]+\)$/, `${spoutAlpha})`),
          wid: hei * 0.03,
          noi: 0.4,
        });
      }
    }

    // Phase 9: Ink splatter accents (墨点) around the body edge
    {
      const splatCount = Math.floor(6 + prng.random() * 4);
      for (let i = 0; i < splatCount; i++) {
        const t = prng.random();
        const sx = xoff + t * len * 0.9;
        const sy = yoff + (prng.random() - 0.4) * hei * 0.7;
        const blb = blob(sx, sy, {
          len: hei * (0.03 + prng.random() * 0.06),
          wid: hei * (0.02 + prng.random() * 0.04),
          col: col.replace(/[\d.]+\)$/, `${(0.08 + prng.random() * 0.2).toFixed(3)})`),
          noi: 0.4,
          ang: prng.random() * Math.PI,
        });
        if (typeof blb === "string") svg += blb;
      }
    }

    return svg;
  }
}

export function whale(xoff: number, yoff: number, seed: number, options?: WhaleOptions): string {
  return Whale.generate(xoff, yoff, seed, options);
}
