import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import * as fontkit from "fontkit";
import type { Font, FontCollection } from "fontkit";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FONT_PATH = resolve(__dirname, "../../../playground/src/assets/fonts/yishanbeizhuanti.ttf");
const CHARS = ["水", "墨", "兰", "梅", "落", "月", "风", "听", "雪", "乌"];

const buf = readFileSync(FONT_PATH);
const isCollection = (o: Font | FontCollection): o is FontCollection =>
  Array.isArray((o as FontCollection).fonts);

const t0 = performance.now();
const parsed = fontkit.create(buf);
const font = isCollection(parsed) ? parsed.fonts[0] : parsed;
if (!font) throw new Error("font: failed to load");
const t1 = performance.now();
const upm = font.unitsPerEm;

let totalCmds = 0;
for (const ch of CHARS) {
  const cp = ch.codePointAt(0)!;
  const g = font.glyphForCodePoint(cp);
  if (!g) continue;
  totalCmds += g.path.commands.length;
}
const t2 = performance.now();

console.log(
  `parse: ${(t1 - t0).toFixed(1)}ms, glyphs: ${(t2 - t1).toFixed(1)}ms, totalCmds: ${totalCmds}, upm: ${upm}`,
);
