import { BBS, normRand } from "../../FlowerCanvas";
import {
  PETAL_LEN,
  PETAL_HALFW,
  PETAL_CAM,
  PETAL_RINGS,
  PETAL_FORESHORTEN_MIN,
  PETAL_WIDEPOS_MIN,
  PETAL_WIDEPOS_MAX,
} from "./constants";
import { drawPetal } from "./petal";

const PI = Math.PI;
const sin = Math.sin;
const cos = Math.cos;

interface PetalSpec {
  theta: number; // azimuth around the vertical axis
  phi: number; // pitch (tilt from vertical)
  length: number;
  halfW: number;
  curl: number;
  widePos: number;
  vShift: number;
}

/**
 * One full lotus bloom as a radially-balanced 3D cup.
 *
 * Petals sit in concentric rings; within a ring they're evenly spaced in
 * azimuth (small jitter only). Each petal's 3D direction is
 *   dir = (sinφ·cosθ, cosφ, sinφ·sinθ)   // x-right, y-up, z-toward-viewer
 * projected to screen with camera elevation PETAL_CAM:
 *   upScreen = dirY·cos(cam) − dirZ·sin(cam)   (front petals lower, back higher)
 *   depth    = dirY·sin(cam) + dirZ·cos(cam)   (sort ascending → back first)
 * Width foreshortens with the projected length so end-on petals read narrower.
 * Even azimuth → symmetric silhouette (no lopsided deformation).
 */
export function drawFlower(
  ctx: CanvasRenderingContext2D,
  fx: number,
  fy: number,
  scale = 1,
  alpha = 1,
): void {
  const specs: PetalSpec[] = [];
  for (const ring of PETAL_RINGS) {
    const count = Math.floor(normRand(ring.countMin, ring.countMax + 1));
    const theta0 = BBS.next() * 2 * PI;
    for (let i = 0; i < count; i++) {
      const theta = theta0 + (i / count) * 2 * PI + (BBS.next() - 0.5) * (PI / count) * 0.5;
      specs.push({
        theta,
        phi: ring.pitch * (0.9 + 0.2 * BBS.next()),
        length: PETAL_LEN * ring.lengthScale * normRand(0.93, 1.07) * scale,
        halfW: PETAL_HALFW * ring.halfWScale * normRand(0.92, 1.08) * scale,
        curl: (BBS.next() - 0.5) * 0.4,
        widePos: normRand(PETAL_WIDEPOS_MIN, PETAL_WIDEPOS_MAX),
        vShift: ring.vShift,
      });
    }
  }

  const cosCam = cos(PETAL_CAM);
  const sinCam = sin(PETAL_CAM);
  const proj = specs.map((s) => {
    const dirX = sin(s.phi) * cos(s.theta);
    const dirY = cos(s.phi); // up
    const dirZ = sin(s.phi) * sin(s.theta); // toward viewer
    const upScreen = dirY * cosCam - dirZ * sinCam;
    const depth = dirY * sinCam + dirZ * cosCam;
    const tipX = fx + dirX * s.length;
    const tipY = fy - upScreen * s.length;
    const screenLen = Math.hypot(dirX, upScreen); // ≤ 1
    const widthScale = Math.max(PETAL_FORESHORTEN_MIN, screenLen);
    return { s, tipX, tipY, depth, widthScale };
  });

  // Back (small depth) first, front last → natural overlap.
  proj.sort((a, b) => a.depth - b.depth);

  for (const p of proj) {
    const dx = p.tipX - fx;
    const dy = p.tipY - fy;
    const length = Math.hypot(dx, dy);
    if (length < 4) continue;
    drawPetal(ctx, {
      baseX: fx,
      baseY: fy,
      angle: Math.atan2(dy, dx),
      length,
      halfW: p.s.halfW * p.widthScale,
      bend: (BBS.next() - 0.5) * 14,
      widePos: p.s.widePos,
      curl: p.s.curl,
      vShift: p.s.vShift,
      alpha: 0.95 * alpha,
      // Veins only on petals facing the viewer enough to read them.
      veins: p.widthScale > 0.6,
    });
  }
}
