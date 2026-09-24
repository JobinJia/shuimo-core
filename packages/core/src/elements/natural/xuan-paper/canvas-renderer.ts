import { buildSceneBatches } from "./batches";
import { renderPaperToneWasm } from "./paper-tone-wasm";
import { renderPaperToneJS } from "./tone-field";
import type { GoldPathCommand, PaperPoint, TileRegion, XuanPaperScene } from "./types";

export type XuanPaperCanvas = HTMLCanvasElement | OffscreenCanvas;

// Shared subset of 2D contexts used by the renderer. Matches both
// CanvasRenderingContext2D and OffscreenCanvasRenderingContext2D so the
// pipeline works on the main thread and inside workers without branching.
type XuanPaperContext2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

function rgba(color: [number, number, number], alpha: number): string {
  return `rgba(${color[0]},${color[1]},${color[2]},${alpha})`;
}

function addGoldCommands(path: Path2D, commands: GoldPathCommand[], offset: PaperPoint): void {
  const ox = offset.x;
  const oy = offset.y;
  for (const command of commands) {
    switch (command.type) {
      case "M":
        path.moveTo(command.x + ox, command.y + oy);
        break;
      case "L":
        path.lineTo(command.x + ox, command.y + oy);
        break;
      case "Q":
        path.quadraticCurveTo(command.cpx + ox, command.cpy + oy, command.x + ox, command.y + oy);
        break;
      case "Z":
        path.closePath();
        break;
    }
  }
}

/**
 * Paints the tone pass (base colour, formation, grain, ageing, deckle alpha)
 * with a single putImageData. The WASM path renders straight into WASM memory
 * and the ImageData wraps that memory, so no pixel buffer is copied in JS.
 */
function paintTone(ctx: XuanPaperContext2D, scene: XuanPaperScene, tile: TileRegion | null): void {
  const w = tile ? tile.width : scene.options.width;
  const h = tile ? tile.height : scene.options.height;
  const pixels = renderPaperToneWasm(scene, tile) ?? renderPaperToneJS(scene, tile);
  ctx.putImageData(new ImageData(pixels as Uint8ClampedArray<ArrayBuffer>, w, h), 0, 0);
}

/**
 * Draws fibers, particles and gold flecks, one path per paint group, culled
 * to `tile`. The context must already be translated so that sheet
 * coordinates map onto the canvas.
 */
function drawSceneLayers(
  ctx: XuanPaperContext2D,
  scene: XuanPaperScene,
  tile: TileRegion | null,
): void {
  const batches = buildSceneBatches(scene, tile);

  ctx.save();
  // The deckle is baked into the tone alpha; source-atop keeps every layer
  // inside the torn outline exactly as erasing afterwards would.
  if (scene.deckleOutline) {
    ctx.globalCompositeOperation = "source-atop";
  }

  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const batch of batches.fibers) {
    const path = new Path2D();
    for (const fiber of batch.fibers) {
      const pts = fiber.points;
      path.moveTo(pts[0]!.x, pts[0]!.y);
      for (let i = 1; i < pts.length; i++) {
        path.lineTo(pts[i]!.x, pts[i]!.y);
      }
    }
    ctx.strokeStyle = rgba(batch.color, batch.alpha);
    ctx.lineWidth = batch.width;
    ctx.stroke(path);
  }

  for (const batch of batches.particles) {
    const path = new Path2D();
    for (const p of batch.particles) {
      if (p.rx === p.ry) {
        path.moveTo(p.x + p.rx, p.y);
        path.arc(p.x, p.y, p.rx, 0, Math.PI * 2);
      } else {
        const rot = (p.rotation * Math.PI) / 180;
        path.moveTo(p.x + p.rx * Math.cos(rot), p.y + p.rx * Math.sin(rot));
        path.ellipse(p.x, p.y, p.rx, p.ry, rot, 0, Math.PI * 2);
      }
    }
    ctx.fillStyle = rgba(batch.color, batch.alpha);
    ctx.fill(path);
  }

  for (const batch of batches.gold) {
    const path = new Path2D();
    for (const item of batch.items) {
      addGoldCommands(path, item.fleck.commands, item.offset);
    }
    ctx.fillStyle = rgba(batch.color, batch.alpha);
    ctx.fill(path);
  }

  ctx.restore();
}

function getContext(canvas: XuanPaperCanvas): XuanPaperContext2D {
  const ctx = canvas.getContext("2d") as XuanPaperContext2D | null;
  if (!ctx) {
    throw new Error("2D canvas context is not available");
  }
  return ctx;
}

export function renderXuanPaperToCanvas(canvas: XuanPaperCanvas, scene: XuanPaperScene): void {
  canvas.width = scene.options.width;
  canvas.height = scene.options.height;
  const ctx = getContext(canvas);
  paintTone(ctx, scene, null);
  drawSceneLayers(ctx, scene, null);
}

export function renderXuanPaperCanvas(scene: XuanPaperScene): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  renderXuanPaperToCanvas(canvas, scene);
  return canvas;
}

// ---------------------------------------------------------------------------
// Tiled rendering — split the sheet across multiple Workers. Tone grids are
// aligned to global pixel coordinates, so tiles line up without seams.
// ---------------------------------------------------------------------------

export function renderXuanPaperTileToCanvas(
  canvas: XuanPaperCanvas,
  scene: XuanPaperScene,
  tile: TileRegion,
): void {
  canvas.width = tile.width;
  canvas.height = tile.height;
  const ctx = getContext(canvas);
  paintTone(ctx, scene, tile);
  ctx.save();
  ctx.translate(-tile.x, -tile.y);
  drawSceneLayers(ctx, scene, tile);
  ctx.restore();
}
