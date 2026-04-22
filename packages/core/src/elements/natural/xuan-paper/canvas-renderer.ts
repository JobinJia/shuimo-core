import { PerlinNoise } from "../../../foundation/noise";
import { applyPaperToneWasm } from "./paper-tone-wasm";
import type { GoldPathCommand, TileRegion, XuanPaperScene } from "./types";

export type XuanPaperCanvas = HTMLCanvasElement | OffscreenCanvas;

// Shared subset of 2D contexts used by the renderer. Matches both
// CanvasRenderingContext2D and OffscreenCanvasRenderingContext2D so the
// pipeline works on the main thread and inside workers without branching.
type XuanPaperContext2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function drawCommands(
  ctx: XuanPaperContext2D,
  commands: GoldPathCommand[],
  offsetX: number,
  offsetY: number,
): void {
  ctx.beginPath();

  for (const command of commands) {
    switch (command.type) {
      case "M":
        ctx.moveTo(command.x + offsetX, command.y + offsetY);
        break;
      case "L":
        ctx.lineTo(command.x + offsetX, command.y + offsetY);
        break;
      case "Q":
        ctx.quadraticCurveTo(
          command.cpx + offsetX,
          command.cpy + offsetY,
          command.x + offsetX,
          command.y + offsetY,
        );
        break;
      case "Z":
        ctx.closePath();
        break;
    }
  }
}

function applyPaperTone(ctx: XuanPaperContext2D, scene: XuanPaperScene): void {
  const { width, height, textureIntensity, grainDensity, age } = scene.options;
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  const t0 = typeof performance !== "undefined" ? performance.now() : 0;
  if (applyPaperToneWasm(data, scene, null)) {
    if (t0) console.log(`[XuanPaper] WASM paperTone ${width}×${height} ${(performance.now() - t0).toFixed(0)}ms`);
    ctx.putImageData(imageData, 0, 0);
    return;
  }

  const toneNoise = new PerlinNoise();
  toneNoise.noiseSeed(scene.seeds.tone);
  toneNoise.noiseDetail(4, 0.5);

  const formationNoise = new PerlinNoise();
  formationNoise.noiseSeed(scene.seeds.formation);
  formationNoise.noiseDetail(3, 0.55);

  const detailNoise = new PerlinNoise();
  detailNoise.noiseSeed(scene.seeds.detail);
  detailNoise.noiseDetail(5, 0.48);

  const agingNoise = new PerlinNoise();
  agingNoise.noiseSeed(scene.seeds.aging);
  agingNoise.noiseDetail(4, 0.52);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = (y * width + x) * 4;

      const fiberFormation =
        formationNoise.noise(x * 0.018, y * 0.018) * 0.58 +
        formationNoise.noise(x * 0.07 + 20, y * 0.07 + 20) * 0.26 +
        formationNoise.noise(x * 0.22 + 40, y * 0.22 + 40) * 0.16;
      const microGrain = detailNoise.noise(x * 0.55, y * 0.55) - 0.5;
      const toneWave = toneNoise.noise(x * 0.004, y * 0.004) - 0.5;

      const textureBoost = textureIntensity * 34 * scene.profile.formationContrast;
      const grainBoost = (grainDensity * 12) / scene.profile.grainSoftness;
      const absorbencyBoost = scene.profile.absorbency * 5.5;
      const variation =
        (fiberFormation - 0.5) * textureBoost +
        microGrain * grainBoost +
        toneWave * absorbencyBoost;

      const warmth = scene.profile.warmth * 5 + age * 6 * scene.profile.patinaStrength;
      const r = data[index] ?? 0;
      const g = data[index + 1] ?? 0;
      const b = data[index + 2] ?? 0;

      data[index] = clamp(r + variation + warmth * 0.8, 0, 255);
      data[index + 1] = clamp(g + variation + warmth * 0.4, 0, 255);
      data[index + 2] = clamp(b + variation - warmth, 0, 255);

      if (age > 0) {
        const patina = agingNoise.noise(x * 0.01, y * 0.01);
        const foxing = agingNoise.noise(x * 0.08 + 120, y * 0.08 + 60);
        const patinaAmount = age * scene.profile.patinaStrength * Math.max(0, patina - 0.42);

        data[index] = clamp(data[index]! + patinaAmount * 10, 0, 255);
        data[index + 1] = clamp(data[index + 1]! + patinaAmount * 5, 0, 255);
        data[index + 2] = clamp(data[index + 2]! - patinaAmount * 14, 0, 255);

        if (foxing > 0.87) {
          const stain = (foxing - 0.87) * age * 160;
          data[index] = clamp(data[index]! - stain * 0.6, 0, 255);
          data[index + 1] = clamp(data[index + 1]! - stain * 0.85, 0, 255);
          data[index + 2] = clamp(data[index + 2]! - stain * 0.35, 0, 255);
        }
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);
}

function drawFibers(ctx: XuanPaperContext2D, scene: XuanPaperScene): void {
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  for (const fiber of scene.fibers) {
    const firstPoint = fiber.points[0];
    if (!firstPoint) {
      continue;
    }

    ctx.beginPath();
    ctx.moveTo(firstPoint.x, firstPoint.y);

    for (let index = 1; index < fiber.points.length; index++) {
      const point = fiber.points[index]!;
      ctx.lineTo(point.x, point.y);
    }

    ctx.strokeStyle = `rgba(${fiber.color[0]}, ${fiber.color[1]}, ${fiber.color[2]}, ${fiber.alpha})`;
    ctx.lineWidth = fiber.width;
    ctx.stroke();
  }

  ctx.restore();
}

function drawParticles(ctx: XuanPaperContext2D, scene: XuanPaperScene): void {
  ctx.save();

  for (const particle of scene.particles) {
    ctx.save();
    ctx.translate(particle.x, particle.y);
    ctx.rotate((particle.rotation * Math.PI) / 180);
    ctx.scale(particle.rx, particle.ry);
    ctx.beginPath();
    ctx.arc(0, 0, 1, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${particle.color[0]}, ${particle.color[1]}, ${particle.color[2]}, ${particle.alpha})`;
    ctx.fill();
    ctx.restore();
  }

  ctx.restore();
}

function drawGoldFlecks(ctx: XuanPaperContext2D, scene: XuanPaperScene): void {
  if (!scene.options.goldFlecks) {
    return;
  }

  ctx.save();

  for (const fleck of scene.goldFlecks) {
    ctx.fillStyle = `rgba(${fleck.color[0]}, ${fleck.color[1]}, ${fleck.color[2]}, ${fleck.alpha})`;

    for (const copy of fleck.copies) {
      drawCommands(ctx, fleck.commands, copy.x, copy.y);
      ctx.fill();
    }
  }

  ctx.restore();
}

function applyDeckleEdge(ctx: XuanPaperContext2D, scene: XuanPaperScene): void {
  const outline = scene.deckleOutline;
  if (!outline) {
    return;
  }

  const { width, height, deckleRoughness } = scene.options;
  ctx.save();
  ctx.globalCompositeOperation = "destination-out";

  for (let x = 0; x <= width; x++) {
    const topInset = outline.top[x] ?? 0;
    const bottomInset = outline.bottom[x] ?? 0;

    if (topInset > 0) {
      const topGradient = ctx.createLinearGradient(x, 0, x, topInset);
      topGradient.addColorStop(0, "rgba(0,0,0,1)");
      topGradient.addColorStop(0.52, `rgba(0,0,0,${0.58 * deckleRoughness})`);
      topGradient.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = topGradient;
      ctx.fillRect(x, 0, 1, topInset);
    }

    if (bottomInset > 0) {
      const bottomGradient = ctx.createLinearGradient(x, height, x, height - bottomInset);
      bottomGradient.addColorStop(0, "rgba(0,0,0,1)");
      bottomGradient.addColorStop(0.52, `rgba(0,0,0,${0.58 * deckleRoughness})`);
      bottomGradient.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = bottomGradient;
      ctx.fillRect(x, height - bottomInset, 1, bottomInset);
    }
  }

  for (let y = 0; y <= height; y++) {
    const leftInset = outline.left[y] ?? 0;
    const rightInset = outline.right[y] ?? 0;

    if (leftInset > 0) {
      const leftGradient = ctx.createLinearGradient(0, y, leftInset, y);
      leftGradient.addColorStop(0, "rgba(0,0,0,1)");
      leftGradient.addColorStop(0.52, `rgba(0,0,0,${0.58 * deckleRoughness})`);
      leftGradient.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = leftGradient;
      ctx.fillRect(0, y, leftInset, 1);
    }

    if (rightInset > 0) {
      const rightGradient = ctx.createLinearGradient(width, y, width - rightInset, y);
      rightGradient.addColorStop(0, "rgba(0,0,0,1)");
      rightGradient.addColorStop(0.52, `rgba(0,0,0,${0.58 * deckleRoughness})`);
      rightGradient.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = rightGradient;
      ctx.fillRect(width - rightInset, y, rightInset, 1);
    }
  }

  ctx.restore();
}

export function renderXuanPaperToCanvas(canvas: XuanPaperCanvas, scene: XuanPaperScene): void {
  canvas.width = scene.options.width;
  canvas.height = scene.options.height;

  const ctx = canvas.getContext("2d") as XuanPaperContext2D | null;
  if (!ctx) {
    throw new Error("2D canvas context is not available");
  }

  ctx.fillStyle = `rgb(${scene.options.baseColor[0]}, ${scene.options.baseColor[1]}, ${scene.options.baseColor[2]})`;
  ctx.fillRect(0, 0, scene.options.width, scene.options.height);

  applyPaperTone(ctx, scene);
  drawFibers(ctx, scene);
  drawParticles(ctx, scene);
  drawGoldFlecks(ctx, scene);
  applyDeckleEdge(ctx, scene);
}

export function renderXuanPaperCanvas(scene: XuanPaperScene): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  renderXuanPaperToCanvas(canvas, scene);
  return canvas;
}

// ---------------------------------------------------------------------------
// Tiled rendering — split the heavy per-pixel work across multiple Workers
// ---------------------------------------------------------------------------

function applyPaperToneTile(ctx: XuanPaperContext2D, scene: XuanPaperScene, tile: TileRegion): void {
  const { textureIntensity, grainDensity, age } = scene.options;
  const imageData = ctx.getImageData(0, 0, tile.width, tile.height);
  const data = imageData.data;

  const t0 = typeof performance !== "undefined" ? performance.now() : 0;
  if (applyPaperToneWasm(data, scene, tile)) {
    if (t0) console.log(`[XuanPaper] WASM tile ${tile.width}×${tile.height} @(${tile.x},${tile.y}) ${(performance.now() - t0).toFixed(0)}ms`);
    ctx.putImageData(imageData, 0, 0);
    return;
  }

  const toneNoise = new PerlinNoise();
  toneNoise.noiseSeed(scene.seeds.tone);
  toneNoise.noiseDetail(4, 0.5);

  const formationNoise = new PerlinNoise();
  formationNoise.noiseSeed(scene.seeds.formation);
  formationNoise.noiseDetail(3, 0.55);

  const detailNoise = new PerlinNoise();
  detailNoise.noiseSeed(scene.seeds.detail);
  detailNoise.noiseDetail(5, 0.48);

  const agingNoise = new PerlinNoise();
  agingNoise.noiseSeed(scene.seeds.aging);
  agingNoise.noiseDetail(4, 0.52);

  const textureBoost = textureIntensity * 34 * scene.profile.formationContrast;
  const grainBoost = (grainDensity * 12) / scene.profile.grainSoftness;
  const absorbencyBoost = scene.profile.absorbency * 5.5;
  const warmth = scene.profile.warmth * 5 + age * 6 * scene.profile.patinaStrength;

  for (let ly = 0; ly < tile.height; ly++) {
    const gy = tile.y + ly;
    for (let lx = 0; lx < tile.width; lx++) {
      const gx = tile.x + lx;
      const index = (ly * tile.width + lx) * 4;

      const fiberFormation =
        formationNoise.noise(gx * 0.018, gy * 0.018) * 0.58 +
        formationNoise.noise(gx * 0.07 + 20, gy * 0.07 + 20) * 0.26 +
        formationNoise.noise(gx * 0.22 + 40, gy * 0.22 + 40) * 0.16;
      const microGrain = detailNoise.noise(gx * 0.55, gy * 0.55) - 0.5;
      const toneWave = toneNoise.noise(gx * 0.004, gy * 0.004) - 0.5;

      const variation =
        (fiberFormation - 0.5) * textureBoost +
        microGrain * grainBoost +
        toneWave * absorbencyBoost;

      const r = data[index] ?? 0;
      const g = data[index + 1] ?? 0;
      const b = data[index + 2] ?? 0;

      data[index] = clamp(r + variation + warmth * 0.8, 0, 255);
      data[index + 1] = clamp(g + variation + warmth * 0.4, 0, 255);
      data[index + 2] = clamp(b + variation - warmth, 0, 255);

      if (age > 0) {
        const patina = agingNoise.noise(gx * 0.01, gy * 0.01);
        const foxing = agingNoise.noise(gx * 0.08 + 120, gy * 0.08 + 60);
        const patinaAmount = age * scene.profile.patinaStrength * Math.max(0, patina - 0.42);

        data[index] = clamp(data[index]! + patinaAmount * 10, 0, 255);
        data[index + 1] = clamp(data[index + 1]! + patinaAmount * 5, 0, 255);
        data[index + 2] = clamp(data[index + 2]! - patinaAmount * 14, 0, 255);

        if (foxing > 0.87) {
          const stain = (foxing - 0.87) * age * 160;
          data[index] = clamp(data[index]! - stain * 0.6, 0, 255);
          data[index + 1] = clamp(data[index + 1]! - stain * 0.85, 0, 255);
          data[index + 2] = clamp(data[index + 2]! - stain * 0.35, 0, 255);
        }
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);
}

function applyDeckleEdgeTile(ctx: XuanPaperContext2D, scene: XuanPaperScene, tile: TileRegion): void {
  const outline = scene.deckleOutline;
  if (!outline) {
    return;
  }

  const { width: fullW, height: fullH, deckleRoughness } = scene.options;
  ctx.save();
  ctx.globalCompositeOperation = "destination-out";

  if (tile.y === 0) {
    for (let lx = 0; lx < tile.width; lx++) {
      const inset = outline.top[tile.x + lx] ?? 0;
      if (inset > 0) {
        const g = ctx.createLinearGradient(lx, 0, lx, inset);
        g.addColorStop(0, "rgba(0,0,0,1)");
        g.addColorStop(0.52, `rgba(0,0,0,${0.58 * deckleRoughness})`);
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g;
        ctx.fillRect(lx, 0, 1, inset);
      }
    }
  }

  if (tile.y + tile.height >= fullH) {
    const localBottom = fullH - tile.y;
    for (let lx = 0; lx < tile.width; lx++) {
      const inset = outline.bottom[tile.x + lx] ?? 0;
      if (inset > 0) {
        const g = ctx.createLinearGradient(lx, localBottom, lx, localBottom - inset);
        g.addColorStop(0, "rgba(0,0,0,1)");
        g.addColorStop(0.52, `rgba(0,0,0,${0.58 * deckleRoughness})`);
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g;
        ctx.fillRect(lx, localBottom - inset, 1, inset);
      }
    }
  }

  if (tile.x === 0) {
    for (let ly = 0; ly < tile.height; ly++) {
      const inset = outline.left[tile.y + ly] ?? 0;
      if (inset > 0) {
        const g = ctx.createLinearGradient(0, ly, inset, ly);
        g.addColorStop(0, "rgba(0,0,0,1)");
        g.addColorStop(0.52, `rgba(0,0,0,${0.58 * deckleRoughness})`);
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g;
        ctx.fillRect(0, ly, inset, 1);
      }
    }
  }

  if (tile.x + tile.width >= fullW) {
    const localRight = fullW - tile.x;
    for (let ly = 0; ly < tile.height; ly++) {
      const inset = outline.right[tile.y + ly] ?? 0;
      if (inset > 0) {
        const g = ctx.createLinearGradient(localRight, ly, localRight - inset, ly);
        g.addColorStop(0, "rgba(0,0,0,1)");
        g.addColorStop(0.52, `rgba(0,0,0,${0.58 * deckleRoughness})`);
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g;
        ctx.fillRect(localRight - inset, ly, inset, 1);
      }
    }
  }

  ctx.restore();
}

export function renderXuanPaperTileToCanvas(canvas: XuanPaperCanvas, scene: XuanPaperScene, tile: TileRegion): void {
  canvas.width = tile.width;
  canvas.height = tile.height;

  const ctx = canvas.getContext("2d") as XuanPaperContext2D | null;
  if (!ctx) {
    throw new Error("2D canvas context is not available");
  }

  ctx.fillStyle = `rgb(${scene.options.baseColor[0]}, ${scene.options.baseColor[1]}, ${scene.options.baseColor[2]})`;
  ctx.fillRect(0, 0, tile.width, tile.height);

  applyPaperToneTile(ctx, scene, tile);

  ctx.save();
  ctx.translate(-tile.x, -tile.y);
  drawFibers(ctx, scene);
  drawParticles(ctx, scene);
  drawGoldFlecks(ctx, scene);
  ctx.restore();

  applyDeckleEdgeTile(ctx, scene, tile);
}
