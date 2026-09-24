import { buildSceneBatches } from "./batches";
import { bytesToBase64, encodePngRgb } from "./png-encode";
import { paperToneParams, renderLowFrequencyTone } from "./tone-field";
import type { DeckleOutline, GoldPathCommand, XuanPaperScene } from "./types";

const SVG_NS = "http://www.w3.org/2000/svg";

// Stride of the embedded low-frequency tone raster (1920×1080 → 120×68 px).
const TONE_RASTER_STRIDE = 16;
// Two stitched grain tiles with coprime sizes, so their sum only repeats every
// 256 × 211 px and no tile seam lines up.
const GRAIN_TILE_A = 256;
const GRAIN_TILE_B = 211;

export interface XuanPaperSVGParts {
  defs: string;
  body: string;
}

/** Round to at most two decimals ("12.5", "3", "-0.25"). */
function fmt(value: number): string {
  return String(Math.round(value * 100) / 100);
}

function rgb(color: readonly [number, number, number]): string {
  return `rgb(${color[0]},${color[1]},${color[2]})`;
}

function clampByte(value: number): number {
  return Math.min(255, Math.max(0, Math.round(value)));
}

function sampleList(values: number[], index: number): number {
  return values[Math.max(0, Math.min(values.length - 1, index))] ?? 0;
}

/**
 * Deckle outline as a closed path. Corners start where the adjacent insets
 * meet so no sliver of paper pokes out past the torn edge.
 */
function buildOutlinePathData(outline: DeckleOutline, width: number, height: number): string {
  const step = Math.max(1, Math.floor(Math.max(width, height) / 800));
  const top = (x: number) => sampleList(outline.top, Math.round(x));
  const bottom = (x: number) => sampleList(outline.bottom, Math.round(x));
  const left = (y: number) => sampleList(outline.left, Math.round(y));
  const right = (y: number) => sampleList(outline.right, Math.round(y));

  const x0 = Math.min(width / 2, left(top(0)));
  const x1 = Math.max(width / 2, width - right(top(width)));
  const y0 = Math.min(height / 2, top(left(0)));
  const y1 = Math.max(height / 2, height - bottom(left(height)));

  const parts: string[] = [`M${fmt(x0)} ${fmt(top(x0))}`];
  for (let x = Math.ceil(x0 / step) * step; x < x1; x += step) {
    parts.push(`L${x} ${fmt(top(x))}`);
  }
  parts.push(`L${fmt(width - right(y0))} ${fmt(y0)}`);
  for (let y = Math.ceil(y0 / step) * step; y < y1; y += step) {
    parts.push(`L${fmt(width - right(y))} ${y}`);
  }
  parts.push(`L${fmt(x1)} ${fmt(height - bottom(x1))}`);
  for (let x = Math.floor(x1 / step) * step; x > x0; x -= step) {
    parts.push(`L${x} ${fmt(height - bottom(x))}`);
  }
  parts.push(`L${fmt(left(y1))} ${fmt(y1)}`);
  for (let y = Math.floor(y1 / step) * step; y > y0; y -= step) {
    parts.push(`L${fmt(left(y))} ${y}`);
  }
  parts.push("Z");
  return parts.join("");
}

function goldPathData(commands: GoldPathCommand[], ox: number, oy: number): string {
  let d = "";
  for (const c of commands) {
    switch (c.type) {
      case "M":
        d += `M${fmt(c.x + ox)} ${fmt(c.y + oy)}`;
        break;
      case "L":
        d += `L${fmt(c.x + ox)} ${fmt(c.y + oy)}`;
        break;
      case "Q":
        d += `Q${fmt(c.cpx + ox)} ${fmt(c.cpy + oy)} ${fmt(c.x + ox)} ${fmt(c.y + oy)}`;
        break;
      case "Z":
        d += "Z";
        break;
    }
  }
  return d;
}

interface GrainLayer {
  id: string;
  tile: number;
  frequency: number;
  octaves: number;
  seed: number;
  /** Overlay alpha = gain × noise + offset (noise ≈ 0.5 ± 0.1). */
  gain: number;
  offset: number;
}

function grainDefs(layer: GrainLayer, tint: readonly [number, number, number]): string {
  const [r, g, b] = tint.map((c) => fmt(c / 255));
  const t = layer.tile;
  return (
    `<filter id="${layer.id}-f" x="0" y="0" width="${t}" height="${t}" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">` +
    `<feTurbulence type="fractalNoise" baseFrequency="${layer.frequency}" numOctaves="${layer.octaves}" seed="${layer.seed}" stitchTiles="stitch"/>` +
    `<feColorMatrix values="0 0 0 0 ${r} 0 0 0 0 ${g} 0 0 0 0 ${b} ${fmt(layer.gain)} 0 0 0 ${fmt(layer.offset)}"/>` +
    `</filter>` +
    `<pattern id="${layer.id}" width="${t}" height="${t}" patternUnits="userSpaceOnUse">` +
    `<rect width="${t}" height="${t}" filter="url(#${layer.id}-f)"/></pattern>`
  );
}

/**
 * Builds the paper as SVG markup split into `<defs>` content and body.
 *
 * Browser cost is kept low on purpose: the smooth tone is a ~120×68 embedded
 * raster that the browser upsamples, and the fine formation/grain comes from
 * two small stitched feTurbulence tiles used as patterns (rasterised once per
 * tile, not once per page). Fibers, particles and gold are one path per paint.
 */
export function renderXuanPaperSVGParts(scene: XuanPaperScene): XuanPaperSVGParts {
  const { width, height, seed, textureIntensity, grainDensity, baseColor } = scene.options;
  const { profile } = scene;
  const idSuffix = String(seed);
  const clipPathId = `xuan-paper-clip-${idSuffix}`;
  const outlineId = `xuan-paper-outline-${idSuffix}`;
  const p = paperToneParams(scene);
  const shortSeed = (n: number) => Math.abs(n % 100000);

  // Grain tint: the paper colour pulled toward the fibre colour.
  const tint: [number, number, number] = [
    clampByte(p.baseR - 70),
    clampByte(p.baseG - 72),
    clampByte(p.baseB - 76),
  ];
  const textureAlpha = (textureIntensity * profile.formationContrast * 0.19) / 0.3;
  const grainAlpha = (grainDensity * 0.14) / profile.grainSoftness / 0.5;
  const layers: GrainLayer[] = [];
  if (textureAlpha > 0) {
    layers.push({
      id: `xuan-paper-formation-${idSuffix}`,
      tile: GRAIN_TILE_A,
      frequency: 0.07,
      octaves: 3,
      seed: shortSeed(scene.seeds.formation),
      gain: textureAlpha * 0.9,
      offset: textureAlpha * (0.12 - 0.45),
    });
  }
  if (grainAlpha > 0) {
    layers.push({
      id: `xuan-paper-grain-${idSuffix}`,
      tile: GRAIN_TILE_B,
      frequency: 0.45,
      octaves: 2,
      seed: shortSeed(scene.seeds.detail),
      gain: grainAlpha * 0.9,
      offset: grainAlpha * (0.1 - 0.45),
    });
  }
  // Mean darkening added by the overlays (≈ mean alpha × tint distance),
  // pre-compensated in the tone raster so the sheet keeps its brightness.
  const lift = layers.reduce(
    (sum, l) => sum + Math.max(0, l.gain * 0.5 + l.offset) * (p.baseG - tint[1]),
    0,
  );

  const tone = renderLowFrequencyTone(scene, TONE_RASTER_STRIDE, lift);
  const png = bytesToBase64(encodePngRgb(tone.rgb, tone.width, tone.height));

  let defs = "";
  let body = "";
  const outline = scene.deckleOutline;
  if (outline) {
    defs += `<clipPath id="${clipPathId}"><path id="${outlineId}" d="${buildOutlinePathData(outline, width, height)}"/></clipPath>`;
    body += `<g clip-path="url(#${clipPathId})">`;
  }
  for (const layer of layers) {
    defs += grainDefs(layer, tint);
  }

  body +=
    `<image width="${tone.width * tone.stride}" height="${tone.height * tone.stride}" ` +
    `preserveAspectRatio="none" href="data:image/png;base64,${png}"/>`;
  for (const layer of layers) {
    body += `<rect width="${width}" height="${height}" fill="url(#${layer.id})"/>`;
  }

  const batches = buildSceneBatches(scene, null);

  if (batches.particles.length > 0) {
    body += `<g data-layer="particles">`;
    for (const batch of batches.particles) {
      let d = "";
      for (const q of batch.particles) {
        if (q.rx === q.ry) {
          const r = fmt(q.rx);
          const dia = fmt(q.rx * 2);
          d += `M${fmt(q.x - q.rx)} ${fmt(q.y)}a${r} ${r} 0 1 0 ${dia} 0a${r} ${r} 0 1 0 -${dia} 0`;
        } else {
          const rot = (q.rotation * Math.PI) / 180;
          const cx = q.rx * Math.cos(rot);
          const cy = q.rx * Math.sin(rot);
          const arc = `a${fmt(q.rx)} ${fmt(q.ry)} ${fmt(q.rotation)} 1 0`;
          d += `M${fmt(q.x + cx)} ${fmt(q.y + cy)}${arc} ${fmt(-2 * cx)} ${fmt(-2 * cy)}${arc} ${fmt(2 * cx)} ${fmt(2 * cy)}`;
        }
      }
      body += `<path d="${d}" fill="${rgb(batch.color)}" fill-opacity="${fmt(batch.alpha)}"/>`;
    }
    body += `</g>`;
  }

  if (batches.fibers.length > 0) {
    body += `<g data-layer="fibers" fill="none" stroke-linecap="round" stroke-linejoin="round">`;
    for (const batch of batches.fibers) {
      let d = "";
      for (const fiber of batch.fibers) {
        const pts = fiber.points;
        d += `M${fmt(pts[0]!.x)} ${fmt(pts[0]!.y)}L`;
        for (let i = 1; i < pts.length; i++) {
          d += `${i > 1 ? " " : ""}${fmt(pts[i]!.x)} ${fmt(pts[i]!.y)}`;
        }
      }
      body += `<path d="${d}" stroke="${rgb(batch.color)}" stroke-opacity="${fmt(batch.alpha)}" stroke-width="${fmt(batch.width)}"/>`;
    }
    body += `</g>`;
  }

  if (batches.gold.length > 0) {
    body += `<g data-layer="gold-flecks">`;
    for (const batch of batches.gold) {
      let d = "";
      for (const item of batch.items) {
        d += goldPathData(item.fleck.commands, item.offset.x, item.offset.y);
      }
      body += `<path d="${d}" fill="${rgb(batch.color)}" fill-opacity="${fmt(batch.alpha)}"/>`;
    }
    body += `</g>`;
  }

  if (outline) {
    body += `</g>`;
    const edge: [number, number, number] = [
      clampByte(baseColor[0] - 35),
      clampByte(baseColor[1] - 30),
      clampByte(baseColor[2] - 22),
    ];
    body += `<use href="#${outlineId}" fill="none" stroke="${rgb(edge)}" stroke-opacity="0.16" stroke-width="${fmt(0.8 + scene.options.deckleRoughness * 0.8)}"/>`;
  }

  return { defs, body };
}

export function renderXuanPaperSVGString(scene: XuanPaperScene): string {
  const { defs, body } = renderXuanPaperSVGParts(scene);
  const { width, height } = scene.options;
  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="${SVG_NS}"><defs>${defs}</defs>${body}</svg>`;
}

/**
 * DOM variant of {@link renderXuanPaperSVGString}. It parses the string output
 * so the two renderers cannot drift apart.
 */
export function renderXuanPaperSVG(scene: XuanPaperScene): SVGSVGElement {
  const markup = renderXuanPaperSVGString(scene);
  const parsed = new DOMParser().parseFromString(markup, "image/svg+xml");
  return document.importNode(parsed.documentElement, true) as unknown as SVGSVGElement;
}
