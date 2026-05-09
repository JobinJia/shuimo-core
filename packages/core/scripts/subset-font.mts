/**
 * CLI: subset a TTF/OTF/WOFF2 font down to the given character set.
 *
 * Usage:
 *   npx tsx packages/core/scripts/subset-font.mts <input> <chars-or-@file> <output.woff2>
 *
 * Examples:
 *   tsx subset-font.mts ./y.ttf "落梅听风雪" ./y.subset.woff2
 *   tsx subset-font.mts ./y.ttf @./chars.txt ./y.subset.woff2
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import subsetFont from "subset-font";

async function main() {
  const [input, charsArg, output] = process.argv.slice(2);
  if (!input || !charsArg || !output) {
    console.error("Usage: tsx subset-font.mts <input> <chars-or-@file> <output.woff2>");
    process.exit(1);
  }

  const chars = charsArg.startsWith("@")
    ? readFileSync(charsArg.slice(1), "utf-8").trim()
    : charsArg;

  const buf = readFileSync(resolve(input));
  const inputSize = buf.length;
  const t0 = performance.now();
  const out = await subsetFont(buf, chars, { targetFormat: "woff2" });
  const t1 = performance.now();
  writeFileSync(resolve(output), out);

  const ratio = (out.length / inputSize) * 100;
  console.log(
    `${input} (${(inputSize / 1024).toFixed(1)} KB) → ${output} (${(out.length / 1024).toFixed(1)} KB, ${ratio.toFixed(2)}%) in ${(t1 - t0).toFixed(0)}ms; chars: ${[...new Set(chars)].length}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
