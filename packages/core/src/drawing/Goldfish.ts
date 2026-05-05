import { noise } from "../foundation/noise";
import { prng } from "../foundation/random";

export interface GoldfishCanvasOptions {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  seed?: string | number;
  count?: number;
  paperColor?: string;
  inkColor?: string;
}

interface FishPose {
  x: number;
  y: number;
  size: number;
  angle: number;
  bodyAlpha: number;
  tailSpread: number;
  curvature: number;
  isBlack: boolean;
}

const TAU = Math.PI * 2;

function rand(min: number, max: number): number {
  return min + (max - min) * prng.random();
}

/**
 * Draws a soft ink dab.
 */
function inkDab(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  r: number,
  g: number,
  b: number,
  alpha: number,
) {
  if (radius <= 0) return;
  const grad = ctx.createRadialGradient(x, y, 0, x, y, radius);
  grad.addColorStop(0, `rgba(${r},${g},${b},${alpha})`);
  grad.addColorStop(0.6, `rgba(${r},${g},${b},${alpha * 0.3})`);
  grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, TAU);
  ctx.fill();
}

/**
 * Draws a wet ink stroke using fewer, larger dabs for better visibility and performance.
 */
function wetStroke(
  ctx: CanvasRenderingContext2D,
  points: [number, number][],
  baseRadius: number,
  r: number,
  g: number,
  b: number,
  alpha: number,
  taper = true,
) {
  const n0 = prng.random() * 10;
  for (let i = 0; i < points.length; i++) {
    const t = i / (points.length - 1);
    const radFactor = taper ? Math.sin(t * Math.PI * 0.9 + 0.1) : 1.0;
    const ns = noise.noise(i * 0.2, n0, 0);
    const radius = baseRadius * radFactor * (0.7 + 0.6 * ns);
    const currentAlpha = alpha * (0.8 + 0.4 * ns);
    inkDab(ctx, points[i][0], points[i][1], radius, r, g, b, currentAlpha);
  }
}

function drawTail(ctx: CanvasRenderingContext2D, pose: FishPose, r: number, g: number, b: number) {
  const { size, tailSpread: spread } = pose;
  const n0 = prng.random() * 100;

  ctx.save();
  ctx.globalCompositeOperation = "multiply";

  const lobes = 4;
  for (let l = 0; l < lobes; l++) {
    const lobeAngle = (l / (lobes - 1) - 0.5) * spread;
    const length = size * rand(1.6, 2.4);
    const points: [number, number][] = [];

    const baseX = -size * 0.2;
    const baseY = 0;

    for (let i = 0; i < 12; i++) {
      const t = i / 11;
      const angle = lobeAngle + (noise.noise(t * 0.4, l, n0) - 0.5) * 0.6;
      const dist = t * length;
      const x = baseX - Math.cos(angle) * dist;
      const y = baseY + Math.sin(angle) * dist + Math.sin(t * 3 + n0) * size * 0.1;
      points.push([x, y]);
    }

    // Tail wash - very light
    wetStroke(ctx, points, size * 0.28, r, g, b, 0.06, true);

    // Fine lines in tail
    ctx.beginPath();
    ctx.moveTo(baseX, baseY);
    for (const [px, py] of points) ctx.lineTo(px, py);
    ctx.strokeStyle = `rgba(${r},${g},${b},0.12)`;
    ctx.lineWidth = rand(0.5, 1.2);
    ctx.stroke();
  }

  ctx.restore();
}

function drawFish(ctx: CanvasRenderingContext2D, pose: FishPose, inkColor: string) {
  // Use pose color or inkColor
  let r = 30,
    g = 30,
    b = 28;
  const match = inkColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (match) {
    r = parseInt(match[1]);
    g = parseInt(match[2]);
    b = parseInt(match[3]);
  }

  if (pose.isBlack) {
    r = Math.max(0, r - 20);
    g = Math.max(0, g - 20);
    b = Math.max(0, b - 20);
  } else {
    // Reddish/Orange goldfish style if not black
    r = 180;
    g = 60;
    b = 40;
  }

  ctx.save();
  ctx.translate(pose.x, pose.y);
  ctx.rotate(pose.angle);

  // Swimming curve
  const curve = pose.curvature * 0.3;
  ctx.transform(1, curve, 0, 1, 0, 0);

  // 1. Tail (Behind body)
  drawTail(ctx, pose, r, g, b);

  // 2. Body
  const bodyLen = pose.size * 0.9;
  const bodyPts: [number, number][] = [];
  for (let i = 0; i < 10; i++) {
    bodyPts.push([pose.size * 0.4 - (i / 9) * bodyLen, 0]);
  }

  // Flesh wash
  wetStroke(ctx, bodyPts, pose.size * 0.42, r, g, b, 0.15, true);

  // Back / Spine (Darker)
  const backR = Math.max(0, r - 40),
    backG = Math.max(0, g - 40),
    backB = Math.max(0, b - 40);
  wetStroke(ctx, bodyPts.slice(0, 7), pose.size * 0.22, backR, backG, backB, 0.35, true);

  // 3. Head & Eyes
  const headX = pose.size * 0.35;
  inkDab(ctx, headX, 0, pose.size * 0.35, backR, backG, backB, 0.4);

  // Big bulging eyes
  for (const s of [1, -1] as const) {
    const ex = headX + pose.size * 0.12,
      ey = s * pose.size * 0.25,
      er = pose.size * 0.12;
    // Eye socket
    inkDab(ctx, ex, ey, er * 1.5, r, g, b, 0.2);
    // Pupil
    ctx.fillStyle = "rgba(10, 10, 10, 0.95)";
    ctx.beginPath();
    ctx.arc(ex, ey, er * 0.5, 0, TAU);
    ctx.fill();
    // Highlight
    ctx.fillStyle = "white";
    ctx.beginPath();
    ctx.arc(ex + er * 0.15, ey - er * 0.15, er * 0.15, 0, TAU);
    ctx.fill();
  }

  // 4. Fins
  // Pectorals
  for (const s of [1, -1] as const) {
    const fx = pose.size * 0.05,
      fy = s * pose.size * 0.2;
    const fpts: [number, number][] = [];
    for (let i = 0; i < 6; i++) {
      const a = s * (Math.PI / 2 + (i / 5) * 0.8);
      fpts.push([fx + Math.cos(a) * pose.size * 0.5, fy + Math.sin(a) * pose.size * 0.5]);
    }
    wetStroke(ctx, fpts, pose.size * 0.1, r, g, b, 0.15);
  }

  // Dorsal
  const dpts: [number, number][] = [];
  for (let i = 0; i < 8; i++) {
    const t = i / 7;
    dpts.push([pose.size * (0.1 - t * 0.4), -pose.size * (0.2 + Math.sin(t * Math.PI) * 0.2)]);
  }
  wetStroke(ctx, dpts, pose.size * 0.15, r, g, b, 0.12);

  ctx.restore();
}

function createFish(width: number, height: number, index: number, count: number): FishPose {
  const phase = (index / Math.max(count, 1)) * TAU + rand(0, TAU);
  const rx = width * 0.22,
    ry = height * 0.18;

  return {
    x: width * 0.5 + Math.cos(phase) * rx + rand(-50, 50),
    y: height * 0.5 + Math.sin(phase) * ry + rand(-50, 50),
    size: rand(80, 120),
    angle: phase + Math.PI / 2 + rand(-0.3, 0.3),
    bodyAlpha: rand(0.7, 0.9),
    tailSpread: rand(1.0, 1.6),
    curvature: rand(-1, 1),
    isBlack: index % 2 === 0, // Mix black and red fish
  };
}

export function generateGoldfishCanvas(options: GoldfishCanvasOptions): void {
  const {
    ctx,
    width,
    height,
    seed = "goldfish",
    count = 1,
    paperColor = "#fbf4e3",
    inkColor = "rgba(35, 35, 32, 0.95)",
  } = options;

  prng.seed(seed);
  ctx.clearRect(0, 0, width, height);

  // Background
  ctx.fillStyle = paperColor;
  ctx.fillRect(0, 0, width, height);

  // Grain
  ctx.save();
  ctx.globalCompositeOperation = "multiply";
  for (let i = 0; i < 800; i++) {
    ctx.fillStyle = `rgba(160, 140, 120, ${rand(0.02, 0.05)})`;
    ctx.fillRect(rand(0, width), rand(0, height), rand(1, 2), rand(1, 2));
  }
  ctx.restore();

  // Fish
  const fish = Array.from({ length: count }, (_, i) => createFish(width, height, i, count));
  fish.sort((a, b) => a.y - b.y);
  fish.forEach((p) => drawFish(ctx, p, inkColor));
}

export class Goldfish {
  static generate(options: GoldfishCanvasOptions): void {
    generateGoldfishCanvas(options);
  }
}
