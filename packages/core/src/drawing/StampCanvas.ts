import { createStampNoise } from "./StampNoise";
import {
  loadFont,
  getBoundingBox,
  type GlyphFont,
  type NormalizedCommand,
} from "./internal/glyphPath";
import { loadGlyphFontViaWorker } from "./internal/glyphFontClient";

export interface CanvasStampOptions {
  text: string[];
  type?: "yin" | "yang";
  fontSize?: number;
  color?: string;
  textColor?: string;
  fontFamily?: string;
  fontWeight?: string | number;
  fontUrl?: string;
  fontData?: ArrayBuffer;
  fontWorker?: Worker;
  cornerRadius?: number;
  borderBandWidth?: number;
  /** 阳章边框线宽，默认 fontSize / 70。仅阳章生效。 */
  borderWidth?: number;
  paddingX?: number;
  paddingY?: number;
  columnSpacing?: number;
  characterSpacing?: number;
  seed?: number;
  scale?: number;
  edgeErosion?: number;
  inkDensity?: number;
}

interface CharMetrics {
  ch: string;
  inkW: number;
  inkH: number;
  bearingX: number;
  bearingY: number;
}

interface MeasuredLayout {
  width: number;
  height: number;
  columns: { chars: CharMetrics[]; x: number; charYs: number[] }[];
}

function measureChars(ctx: CanvasRenderingContext2D, text: string[]): CharMetrics[][] {
  return text.map((col) =>
    col.split("").map((ch) => {
      const m = ctx.measureText(ch);
      return {
        ch,
        inkW: m.actualBoundingBoxLeft + m.actualBoundingBoxRight,
        inkH: m.actualBoundingBoxAscent + m.actualBoundingBoxDescent,
        bearingX: m.actualBoundingBoxLeft,
        bearingY: m.actualBoundingBoxAscent,
      };
    }),
  );
}

function measureGlyphChars(font: GlyphFont, text: string[], fontSize: number): CharMetrics[][] {
  return text.map((col) =>
    Array.from(col).map((ch) => {
      const commands = font.getPath(ch, 0, 0, fontSize);
      const bbox = getBoundingBox(commands);
      return {
        ch,
        inkW: Math.max(1, bbox.x2 - bbox.x1),
        inkH: Math.max(1, bbox.y2 - bbox.y1),
        bearingX: -bbox.x1,
        bearingY: -bbox.y1,
      };
    }),
  );
}

function computeMeasuredLayout(
  measured: CharMetrics[][],
  fontSize: number,
  borderBand: number,
  padX: number,
  padY: number,
  colGap: number,
  charGap: number,
): MeasuredLayout {
  const cellW = Math.max(...measured.map((col) => Math.max(...col.map((c) => c.inkW))));
  const cellH = Math.max(...measured.flat().map((c) => c.inkH));
  const maxChars = Math.max(...measured.map((col) => col.length));

  const contentW = measured.length * cellW + (measured.length - 1) * colGap;
  const contentH = maxChars * cellH + (maxChars - 1) * charGap;
  const totalPadX = padX + borderBand;
  const totalPadY = padY + borderBand;
  const width = contentW + totalPadX * 2;
  const height = contentH + totalPadY * 2;

  const numCols = measured.length;
  const columns = measured.map((col, i) => {
    const colX = totalPadX + (numCols - 1 - i) * (cellW + colGap) + cellW / 2;
    const colH_actual = col.length * cellH + (col.length - 1) * charGap;
    const offsetY = (contentH - colH_actual) / 2;
    const charYs = col.map((_, ci) => totalPadY + offsetY + ci * (cellH + charGap) + cellH / 2);
    return { chars: col, x: colX, charYs };
  });

  return { width, height, columns };
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

function distToRoundedRect(px: number, py: number, w: number, h: number, r: number): number {
  const cx = w / 2;
  const cy = h / 2;
  const dx = Math.abs(px - cx) - (cx - r);
  const dy = Math.abs(py - cy) - (cy - r);
  const outside = Math.sqrt(Math.max(dx, 0) ** 2 + Math.max(dy, 0) ** 2);
  const inside = Math.min(Math.max(dx, dy), 0);
  return outside + inside - r;
}

function commandsToPath2D(commands: NormalizedCommand[]): Path2D {
  const path = new Path2D();
  for (const cmd of commands) {
    switch (cmd.type) {
      case "M":
        path.moveTo(cmd.x!, cmd.y!);
        break;
      case "L":
        path.lineTo(cmd.x!, cmd.y!);
        break;
      case "Q":
        path.quadraticCurveTo(cmd.x1!, cmd.y1!, cmd.x!, cmd.y!);
        break;
      case "C":
        path.bezierCurveTo(cmd.x1!, cmd.y1!, cmd.x2!, cmd.y2!, cmd.x!, cmd.y!);
        break;
      case "Z":
        path.closePath();
        break;
    }
  }
  return path;
}

const CANVAS_FONT_CACHE = new Map<string, Promise<GlyphFont | null>>();

async function loadCanvasFont(options: CanvasStampOptions): Promise<GlyphFont | null> {
  const chars = [...new Set(options.text.join("").split(""))];
  if (chars.length === 0) return null;

  if (options.fontWorker && (options.fontUrl || options.fontData)) {
    const key = `${options.fontUrl ?? "<data>"}::${[...chars].sort().join("")}`;
    const cached = CANVAS_FONT_CACHE.get(key);
    if (cached) return cached;
    const promise = loadGlyphFontViaWorker(options.fontWorker, {
      fontUrl: options.fontUrl,
      fontData: options.fontData,
      chars,
    }).catch(() => null);
    CANVAS_FONT_CACHE.set(key, promise);
    return promise;
  }

  if (options.fontData) return loadFont(options.fontData);

  if (options.fontUrl) {
    const cached = CANVAS_FONT_CACHE.get(options.fontUrl);
    if (cached) return cached;
    const promise = (async (): Promise<GlyphFont | null> => {
      try {
        const res = await fetch(options.fontUrl!);
        if (!res.ok) return null;
        return loadFont(await res.arrayBuffer());
      } catch {
        return null;
      }
    })();
    CANVAS_FONT_CACHE.set(options.fontUrl, promise);
    return promise;
  }

  return null;
}

function renderCanvasStamp(options: CanvasStampOptions, font: GlyphFont | null): HTMLCanvasElement {
  const {
    text,
    type = "yin",
    fontSize = 70,
    color = "#C8102E",
    textColor: textColorOpt,
    fontFamily = "serif",
    fontWeight = "normal",
    cornerRadius = 6,
    borderBandWidth = 2,
    borderWidth = fontSize / 70,
    paddingX = 0,
    paddingY = 0,
    columnSpacing = 1,
    characterSpacing = 1,
    seed = Date.now(),
    scale = 2,
    edgeErosion = 0.35,
    inkDensity = 0.97,
  } = options;

  const isYang = type === "yang";
  const effectiveBorderBandWidth =
    isYang && options.borderBandWidth === undefined ? 0 : borderBandWidth;

  const textColor = textColorOpt || (isYang ? color : "#FFFFFF");
  const quotedFont = fontFamily.includes(",") ? fontFamily : `"${fontFamily}"`;
  const fontSpec = `${fontWeight} ${fontSize}px ${quotedFont}`;

  let measured: CharMetrics[][];
  if (font) {
    measured = measureGlyphChars(font, text, fontSize);
  } else {
    const measureCanvas = document.createElement("canvas");
    measureCanvas.width = 1;
    measureCanvas.height = 1;
    const measureCtx = measureCanvas.getContext("2d")!;
    measureCtx.font = fontSpec;
    measured = measureChars(measureCtx, text);
  }

  const layout = computeMeasuredLayout(
    measured,
    fontSize,
    effectiveBorderBandWidth,
    paddingX,
    paddingY,
    columnSpacing,
    characterSpacing,
  );
  const { width, height } = layout;

  const cssW = Math.ceil(width);
  const cssH = Math.ceil(height);
  const canvas = document.createElement("canvas");
  canvas.width = cssW * scale;
  canvas.height = cssH * scale;
  canvas.style.width = `${cssW}px`;
  canvas.style.height = `${cssH}px`;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(scale, scale);

  const stampColor = isYang ? "#FFFFFF" : color;
  const noise = createStampNoise(seed);
  const r = Math.min(cornerRadius, Math.min(width, height) / 2);

  ctx.fillStyle = stampColor;
  drawRoundedRect(ctx, 0, 0, width, height, r);
  ctx.fill();

  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const { data } = imgData;
  const pw = canvas.width;
  const ph = canvas.height;
  const erosionBand = effectiveBorderBandWidth * 1.2;
  const erosionMultiplier = isYang ? 6.0 : 2.5;

  for (let py = 0; py < ph; py++) {
    for (let px = 0; px < pw; px++) {
      const idx = (py * pw + px) * 4;
      if (data[idx + 3] === 0) continue;

      const wx = px / scale;
      const wy = py / scale;
      const dist = -distToRoundedRect(wx, wy, width, height, r);

      if (dist < erosionBand) {
        const edgeFactor = Math.max(0, 1 - dist / erosionBand);
        const n1 = noise.noise2D(wx * 0.04, wy * 0.04);
        const n2 = noise.noise2D(wx * 0.09 + 50, wy * 0.09 + 50);
        const combined = n1 * 0.55 + n2 * 0.45;
        const threshold = 1 - edgeErosion * erosionMultiplier * edgeFactor;

        if (combined > threshold) {
          data[idx + 3] = 0;
          continue;
        }

        if (dist < 0.8) {
          data[idx + 3] = Math.round(data[idx + 3] * Math.min(1, dist / 0.8));
        }
      }

      if (data[idx + 3] > 0) {
        const grain = (noise.noise2D(wx * 0.4 + 200, wy * 0.4 + 200) + 1) / 2;
        const blotch = (noise.noise2D(wx * 0.08 + 300, wy * 0.08 + 300) + 1) / 2;
        const tex = grain * blotch;
        const cutoff = (1 - inkDensity) * 1.5;
        if (tex < cutoff) {
          data[idx + 3] = 0;
        } else if (tex < cutoff + 0.05) {
          data[idx + 3] = Math.round(data[idx + 3] * ((tex - cutoff) / 0.05));
        }
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);

  // --- Yang border stroke ---
  if (isYang) {
    const borderCanvas = document.createElement("canvas");
    borderCanvas.width = canvas.width;
    borderCanvas.height = canvas.height;
    const borderCtx = borderCanvas.getContext("2d")!;
    borderCtx.scale(scale, scale);

    borderCtx.strokeStyle = color;
    borderCtx.lineWidth = borderWidth;
    const bw = borderWidth / 2;
    drawRoundedRect(
      borderCtx,
      bw,
      bw,
      width - borderWidth,
      height - borderWidth,
      Math.max(0, r - bw),
    );
    borderCtx.stroke();

    const borderImgData = borderCtx.getImageData(0, 0, canvas.width, canvas.height);
    const bData = borderImgData.data;

    for (let by = 0; by < ph; by++) {
      for (let bx = 0; bx < pw; bx++) {
        const idx = (by * pw + bx) * 4;
        if (bData[idx + 3] === 0) continue;

        const wx = bx / scale;
        const wy = by / scale;

        const n1 = noise.noise2D(wx * 0.06 + 700, wy * 0.06 + 700);
        const n2 = noise.noise2D(wx * 0.12 + 800, wy * 0.12 + 800);
        const combined = n1 * 0.5 + n2 * 0.5;

        if (combined > 1 - edgeErosion * 1.5) {
          bData[idx + 3] = 0;
          continue;
        }

        const grain = (noise.noise2D(wx * 0.5 + 900, wy * 0.5 + 900) + 1) / 2;
        const cutoff = (1 - inkDensity) * 1.2;
        if (grain < cutoff) {
          bData[idx + 3] = 0;
        }
      }
    }

    borderCtx.putImageData(borderImgData, 0, 0);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(borderCanvas, 0, 0);
    ctx.restore();
  }

  // --- Text rendering with carving ---
  const textCanvas = document.createElement("canvas");
  textCanvas.width = canvas.width;
  textCanvas.height = canvas.height;
  const textCtx = textCanvas.getContext("2d")!;
  textCtx.scale(scale, scale);
  textCtx.fillStyle = textColor;

  if (font) {
    for (const col of layout.columns) {
      for (let ci = 0; ci < col.chars.length; ci++) {
        const cm = col.chars[ci];
        const drawX = col.x - cm.inkW / 2 + cm.bearingX;
        const drawY = col.charYs[ci] - cm.inkH / 2 + cm.bearingY;
        const commands = font.getPath(cm.ch, drawX, drawY, fontSize);
        const path = commandsToPath2D(commands);
        textCtx.fill(path);
      }
    }
  } else {
    textCtx.font = fontSpec;
    textCtx.textAlign = "left";
    textCtx.textBaseline = "alphabetic";
    for (const col of layout.columns) {
      for (let ci = 0; ci < col.chars.length; ci++) {
        const cm = col.chars[ci];
        const drawX = col.x - cm.inkW / 2 + cm.bearingX;
        const drawY = col.charYs[ci] - cm.inkH / 2 + cm.bearingY;
        textCtx.fillText(cm.ch, drawX, drawY);
      }
    }
  }

  // Text edge carving
  const textImgData = textCtx.getImageData(0, 0, canvas.width, canvas.height);
  const tData = textImgData.data;
  const tTotal = canvas.width * canvas.height;
  const alphaMask = new Uint8Array(tTotal);
  for (let i = 0; i < tTotal; i++) {
    alphaMask[i] = tData[i * 4 + 3];
  }

  const edgeBand = Math.max(2, Math.ceil(fontSize * 0.012 * scale));

  for (let ty = 0; ty < ph; ty++) {
    for (let tx = 0; tx < pw; tx++) {
      const ti = ty * pw + tx;
      if (alphaMask[ti] === 0) continue;

      let minDistSq = (edgeBand + 1) * (edgeBand + 1);
      for (let dy = -edgeBand; dy <= edgeBand; dy++) {
        const ny = ty + dy;
        for (let dx = -edgeBand; dx <= edgeBand; dx++) {
          const dSq = dx * dx + dy * dy;
          if (dSq >= minDistSq) continue;
          const nx = tx + dx;
          if (nx < 0 || nx >= pw || ny < 0 || ny >= ph || alphaMask[ny * pw + nx] === 0) {
            minDistSq = dSq;
          }
        }
      }

      if (minDistSq > edgeBand * edgeBand) continue;

      const edgeT = Math.sqrt(minDistSq) / edgeBand;
      const twx = tx / scale;
      const twy = ty / scale;
      const chip = noise.noise2D(twx * 0.12 + 500, twy * 0.12 + 500);
      const grainN = noise.noise2D(twx * 0.35 + 600, twy * 0.35 + 600);

      if (chip > edgeT + 0.4 || grainN > edgeT * 1.5 + 0.55) {
        tData[ti * 4 + 3] = 0;
      }
    }
  }

  textCtx.putImageData(textImgData, 0, 0);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(textCanvas, 0, 0);
  ctx.restore();

  return canvas;
}

export function generateCanvasStamp(options: CanvasStampOptions): HTMLCanvasElement {
  return renderCanvasStamp(options, null);
}

export async function generateCanvasStampAsync(
  options: CanvasStampOptions,
): Promise<HTMLCanvasElement> {
  const font = await loadCanvasFont(options);
  return renderCanvasStamp(options, font);
}
