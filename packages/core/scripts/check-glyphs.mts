import opentype from "opentype.js";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const buf = readFileSync(
  resolve(__dirname, "../../../playground/src/assets/fonts/yishanbeizhuanti.ttf"),
);
const font = opentype.parse(buf.buffer as ArrayBuffer);
const upm = font.unitsPerEm;
const metrics: Array<{
  aw: string;
  height: string;
  xMax: string;
  xMin: string;
  yMax: string;
  yMin: string;
}> = [];

for (const ch of ["水", "墨", "兰", "梅", "落", "月", "风", "听", "雪", "乌"]) {
  const g = font.charToGlyph(ch);
  const bb = g.getBoundingBox();
  metrics.push({
    aw: (g.advanceWidth / upm).toFixed(4),
    height: ((bb.y2 - bb.y1) / upm).toFixed(4),
    xMax: (bb.x2 / upm).toFixed(4),
    xMin: (bb.x1 / upm).toFixed(4),
    yMax: (bb.y2 / upm).toFixed(4),
    yMin: (bb.y1 / upm).toFixed(4),
  });
}

void metrics;
void font.ascender;
void font.descender;
