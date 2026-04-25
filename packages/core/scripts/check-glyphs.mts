import * as fontkit from "fontkit";
import type { Font, FontCollection } from "fontkit";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const buf = readFileSync(
  resolve(__dirname, "../../../playground/src/assets/fonts/yishanbeizhuanti.ttf"),
);
const parsed = fontkit.create(buf);
const isCollection = (obj: Font | FontCollection): obj is FontCollection =>
  Array.isArray((obj as FontCollection).fonts);
const font = isCollection(parsed) ? parsed.fonts[0] : parsed;
if (!font) throw new Error("font: failed to load");

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
  const cp = ch.codePointAt(0);
  if (cp == null) continue;
  const g = font.glyphForCodePoint(cp);
  const bb = g.bbox;
  metrics.push({
    aw: (g.advanceWidth / upm).toFixed(4),
    height: ((bb.maxY - bb.minY) / upm).toFixed(4),
    xMax: (bb.maxX / upm).toFixed(4),
    xMin: (bb.minX / upm).toFixed(4),
    yMax: (bb.maxY / upm).toFixed(4),
    yMin: (bb.minY / upm).toFixed(4),
  });
}

void metrics;
void font.ascent;
void font.descent;
