/**
 * Compare fontkit parse + glyph-extraction cost between the original 2.2MB ttf
 * and the subsetted woff2. Reports both file sizes and timings.
 */
import { readFileSync, statSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import * as fontkit from "fontkit";
import type { Font, FontCollection } from "fontkit";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "../../..");
const ORIG = resolve(ROOT, "playground/public/fonts/yishanbeizhuanti.ttf");
const SUBSET = resolve(ROOT, "playground/public/fonts/yishanbeizhuanti.demo.woff2");
const CHARS = ["水", "墨", "兰", "梅", "落", "月", "风", "听", "雪", "乌"];

const isCollection = (o: Font | FontCollection): o is FontCollection =>
  Array.isArray((o as FontCollection).fonts);

function bench(label: string, path: string) {
  const buf = readFileSync(path);
  const size = buf.length;
  const t0 = performance.now();
  const parsed = fontkit.create(buf);
  const font = isCollection(parsed) ? parsed.fonts[0] : parsed;
  if (!font) throw new Error(`${label}: failed to load`);
  const t1 = performance.now();
  let totalCmds = 0;
  for (const ch of CHARS) {
    const cp = ch.codePointAt(0)!;
    const g = font.glyphForCodePoint(cp);
    if (!g) continue;
    totalCmds += g.path.commands.length;
  }
  const t2 = performance.now();
  console.log(
    `${label.padEnd(7)}  size: ${(size / 1024).toFixed(1).padStart(8)} KB  parse: ${(t1 - t0).toFixed(1).padStart(6)}ms  glyphs: ${(t2 - t1).toFixed(1).padStart(5)}ms  totalCmds: ${totalCmds}`,
  );
}

bench("orig", ORIG);
bench("subset", SUBSET);
