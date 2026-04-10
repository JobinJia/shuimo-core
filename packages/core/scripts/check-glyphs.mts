import opentype from 'opentype.js';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const buf = readFileSync(resolve(__dirname, '../../../playground/src/assets/fonts/yishanbeizhuanti.ttf'));
const font = opentype.parse(buf.buffer as ArrayBuffer);
const upm = font.unitsPerEm;

for (const ch of ['水','墨','兰','梅','落','月','风','听','雪','乌']) {
  const g = font.charToGlyph(ch);
  const bb = g.getBoundingBox();
  console.log(ch,
    'yMin:', (bb.y1/upm).toFixed(4),
    'yMax:', (bb.y2/upm).toFixed(4),
    'height:', ((bb.y2-bb.y1)/upm).toFixed(4),
    'xMin:', (bb.x1/upm).toFixed(4),
    'xMax:', (bb.x2/upm).toFixed(4),
    'aw:', (g.advanceWidth/upm).toFixed(4));
}
console.log('ascender:', font.ascender/upm, 'descender:', font.descender/upm);
console.log('\nFor baseline: glyph yMax = top of ink above baseline');
console.log('Average yMax should be used as effective ascender for positioning');
