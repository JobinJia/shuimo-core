/**
 * Scan playground demos for CJK characters used in stamp `text` props.
 * Prints sorted unique chars to stdout for piping into the subsetter.
 *
 * Usage: npx tsx packages/core/scripts/audit-stamp-chars.mts
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "../../..");
const SCAN_DIRS = [resolve(ROOT, "playground/src"), resolve(ROOT, "packages/core/src/drawing")];

const CJK_RE = /[㐀-鿿豈-﫿\u{20000}-\u{2FFFF}]/gu;

function* walk(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) {
      if (name === "node_modules" || name === "dist" || name === ".git") continue;
      yield* walk(p);
    } else if (/\.(vue|ts|tsx|mts|js|mjs|json)$/.test(name)) {
      // Skip auto-generated metrics tables — they contain every CJK char in the
      // source font and would balloon the audit output.
      if (name.endsWith("-font-metrics.ts")) continue;
      yield p;
    }
  }
}

const chars = new Set<string>();
for (const dir of SCAN_DIRS) {
  for (const file of walk(dir)) {
    const content = readFileSync(file, "utf-8");
    for (const m of content.matchAll(CJK_RE)) chars.add(m[0]);
  }
}
const sorted = [...chars].sort();
process.stdout.write(sorted.join(""));
process.stderr.write(`\n${sorted.length} unique CJK chars\n`);
