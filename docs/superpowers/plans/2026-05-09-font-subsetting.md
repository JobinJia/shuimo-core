# Stamp Font Subsetting Implementation Plan (Phase 1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cut the seal-font payload from 2.2MB (`yishanbeizhuanti.ttf`) down to a subsetted woff2 (~5-15KB for the playground demo set, or ~200-400KB for a "common CJK" library default) so network/decode/parse cost drops by 10-100×, without changing visual output.

**Architecture:**
- Build-time subsetting via `subset-font` (npm, harfbuzz-wasm-backed). Pure Node script, no Python dep.
- Two outputs:
  1. `playground/src/assets/fonts/yishanbeizhuanti.demo.woff2` — minimal subset for the playground demos.
  2. (Optional, Task 6) `packages/core/dist/stamp/yishanbeizhuanti.common-cjk.woff2` — common-CJK subset shipped from the library as a separate export so consumers can opt in.
- Existing fontkit runtime path stays untouched.

**Tech Stack:**
- `subset-font` (https://github.com/papandreou/subset-font) — pure-JS facade over harfbuzz-subset WASM
- `tsx` for running TS scripts at build/dev time (already in toolchain)
- existing bench from Task 1 of the WASM plan, extended to compare original ↔ subset

**Relation to the WASM plan:** The WASM swap (`docs/superpowers/plans/2026-05-09-replace-fontkit-with-wasm.md`) is Phase 2 — pursued later, only if real-world numbers justify it after Phase 1 lands.

---

## File Structure

**Created:**
- `packages/core/scripts/subset-font.mts` — CLI: `tsx subset-font.mts <input.ttf> <chars> <output.woff2>`
- `packages/core/scripts/audit-stamp-chars.mts` — scans playground demos + tests, prints the unique CJK char set
- `playground/src/assets/fonts/yishanbeizhuanti.demo.woff2` — generated subset (committed, since it's reproducible from the audit)
- `packages/core/scripts/bench-subset.mts` — re-runs the fontkit bench against original vs subset
- `docs/font-subsetting.md` — short consumer guide

**Modified:**
- `playground/src/style.css` — `@font-face` switches from `.ttf` to `.demo.woff2`
- `playground/src/demos/StampPlayground.vue:12` — `FONT_URLS["峄山碑篆体"]` switches from `.ttf` to `.demo.woff2`
- `playground/index.html` (if it has a preload tag for the font) — update href
- `packages/core/package.json` — add `subset-font` to `devDependencies`; add `subset:demo` script

**Untouched:**
- All runtime code in `packages/core/src/` — subsetting is build-time only, library API unchanged.
- The original `yishanbeizhuanti.ttf` — kept as the source of truth in `playground/src/assets/fonts/`.

---

## Task 2: Audit stamp characters in playground

> Task 1 (bench-fontkit baseline) already complete on this branch (commit `23c6a1d`).

**Files:**
- Create: `packages/core/scripts/audit-stamp-chars.mts`

- [ ] **Step 1: Write the audit script**

```typescript
// packages/core/scripts/audit-stamp-chars.mts
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
const SCAN_DIRS = [
  resolve(ROOT, "playground/src"),
  resolve(ROOT, "packages/core/src/drawing"),
];

const CJK_RE = /[㐀-鿿豈-﫿\u{20000}-\u{2FFFF}]/gu;

function* walk(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) {
      if (name === "node_modules" || name === "dist" || name === ".git") continue;
      yield* walk(p);
    } else if (/\.(vue|ts|tsx|mts|js|mjs|json)$/.test(name)) {
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
```

- [ ] **Step 2: Run it and capture output**

```bash
npx tsx packages/core/scripts/audit-stamp-chars.mts
```

Expected stderr: `<N> unique CJK chars` where N is in the 30-80 range. stdout: the chars themselves.

> The audit intentionally over-collects (it grabs CJK from anywhere — comments, demo labels, etc.) so the subset is forgiving. That's safer than under-collecting and getting `□` boxes for one missed character.

- [ ] **Step 3: Commit**

```bash
git add packages/core/scripts/audit-stamp-chars.mts
git commit -m "$(cat <<'EOF'
chore(stamp): add CJK char audit script for font subsetting

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Subsetting CLI script

**Files:**
- Create: `packages/core/scripts/subset-font.mts`
- Modify: `packages/core/package.json`

- [ ] **Step 1: Add subset-font as a devDependency**

```bash
cd /Users/jiabinbin/myself/github/shuimo-core-fontkit-wasm && pnpm add -D -w subset-font
```

> `subset-font` lives at `https://www.npmjs.com/package/subset-font`. Latest version 2.x. If install fails (e.g. native binding issue), fall back to `pnpm add -D -w fonttools-subset` (a pure-JS shim) and switch the script accordingly. **Verify the install succeeds before continuing.**

- [ ] **Step 2: Write the subset script**

```typescript
// packages/core/scripts/subset-font.mts
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
import { readFileSync, writeFileSync, statSync } from "node:fs";
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
```

- [ ] **Step 3: Add npm script wrapper**

In `packages/core/package.json`, add to scripts:

```json
"subset:demo": "tsx scripts/audit-stamp-chars.mts | tsx scripts/subset-font.mts ../../playground/src/assets/fonts/yishanbeizhuanti.ttf @/dev/stdin ../../playground/src/assets/fonts/yishanbeizhuanti.demo.woff2"
```

> Note: piping into `@/dev/stdin` works on macOS/Linux. If running on Windows, fall back to a two-step shell: `tsx audit > /tmp/chars.txt; tsx subset-font.mts ... @/tmp/chars.txt ...`. Document this in `docs/font-subsetting.md` (Task 7).

- [ ] **Step 4: Type-check**

```bash
cd packages/core && pnpm exec tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add packages/core/scripts/subset-font.mts packages/core/package.json /Users/jiabinbin/myself/github/shuimo-core-fontkit-wasm/pnpm-lock.yaml
git commit -m "$(cat <<'EOF'
feat(stamp): add font-subset CLI script (subset-font + harfbuzz-wasm)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Generate subsetted demo font

**Files:**
- Create (binary, committed): `playground/src/assets/fonts/yishanbeizhuanti.demo.woff2`

- [ ] **Step 1: Run the pipeline**

```bash
cd /Users/jiabinbin/myself/github/shuimo-core-fontkit-wasm && pnpm --filter @jobinjia/shuimo-core run subset:demo
```

Expected output: a single line like
```
.../yishanbeizhuanti.ttf (2252.4 KB) → .../yishanbeizhuanti.demo.woff2 (8.7 KB, 0.39%) in 250ms; chars: 47
```

If the size is unexpectedly large (>50KB), the audit pulled in too many chars — investigate (likely a pasted Chinese paragraph in a `.vue` file). Tighten the regex or add a path-allowlist before continuing.

- [ ] **Step 2: Sanity-check the output font opens**

```bash
npx tsx -e "import('subset-font').then(async (s) => { const buf = require('node:fs').readFileSync('playground/src/assets/fonts/yishanbeizhuanti.demo.woff2'); console.log('woff2 size:', buf.length, 'magic:', buf.slice(0,4).toString()); })"
```

Expected: magic bytes `wOF2`. (You can also drop the file into https://wakamaifondue.com/ for a deeper inspection.)

- [ ] **Step 3: Commit**

```bash
git add playground/src/assets/fonts/yishanbeizhuanti.demo.woff2
git commit -m "$(cat <<'EOF'
feat(playground): add subsetted demo woff2 (2.2MB → ~10KB)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Wire playground to the subsetted font

**Files:**
- Modify: `playground/src/style.css` (line 2-3)
- Modify: `playground/src/demos/StampPlayground.vue:12`
- Modify: `playground/src/demos/LotusDemo.vue:129` (if it actually loads the font; verify first)

- [ ] **Step 1: Update style.css `@font-face`**

```css
@font-face {
  font-family: "峄山碑篆体";
  src: url("/fonts/yishanbeizhuanti.demo.woff2") format("woff2");
}
```

> Verify the playground's vite config maps `/fonts/...` to `playground/src/assets/fonts/...`. If it doesn't (e.g. if assets are imported via `import url from "./asset?url"` instead), the existing `.ttf` path being used here means the `/fonts/...` mapping is already in place — switching the file extension is enough.

- [ ] **Step 2: Update FONT_URLS in StampPlayground.vue**

```typescript
// playground/src/demos/StampPlayground.vue:12
const FONT_URLS: Record<string, string> = {
  峄山碑篆体: "/fonts/yishanbeizhuanti.demo.woff2",
};
```

- [ ] **Step 3: Run playground test build to confirm assets resolve**

```bash
cd /Users/jiabinbin/myself/github/shuimo-core-fontkit-wasm && pnpm --filter @shuimo/playground build 2>&1 | tail -20
```

Expected: build succeeds, the woff2 appears in `playground/dist/fonts/` (or wherever vite emits it).

- [ ] **Step 4: Run the existing test suite (in case Stamp tests load this URL)**

```bash
pnpm --filter @jobinjia/shuimo-core test
```

Expected: all tests pass. (Stamp.test.ts uses fontData from buffer, so it doesn't touch this URL — but it's worth verifying no test was implicitly relying on the .ttf URL.)

- [ ] **Step 5: Commit**

```bash
git add playground/src/style.css playground/src/demos/StampPlayground.vue
git commit -m "$(cat <<'EOF'
feat(playground): use subsetted woff2 for stamp font

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Extend bench to compare subset vs original

**Files:**
- Create: `packages/core/scripts/bench-subset.mts`

- [ ] **Step 1: Write the bench**

```typescript
// packages/core/scripts/bench-subset.mts
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
const ORIG = resolve(ROOT, "playground/src/assets/fonts/yishanbeizhuanti.ttf");
const SUBSET = resolve(ROOT, "playground/src/assets/fonts/yishanbeizhuanti.demo.woff2");
const CHARS = ["水", "墨", "兰", "梅", "落", "月", "风", "听", "雪", "乌"];

const isCollection = (o: Font | FontCollection): o is FontCollection => Array.isArray((o as FontCollection).fonts);

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
```

- [ ] **Step 2: Run it**

```bash
npx tsx packages/core/scripts/bench-subset.mts
```

Expected: subset's parse time should be roughly proportional to size reduction (small font ≈ small parse). Glyph count should match between both (since the subset includes all 10 bench chars).

- [ ] **Step 3: Commit with the numbers**

```bash
git add packages/core/scripts/bench-subset.mts
git commit -m "$(cat <<'EOF'
chore(stamp): add subset-vs-original bench

<paste the two output lines from Step 2 here>

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Document the subsetting workflow for consumers

**Files:**
- Create: `docs/font-subsetting.md`

- [ ] **Step 1: Write a short guide**

```markdown
# Subsetting a stamp font

Loading a 2-8 MB CJK seal font is the single biggest performance cost for stamp
generation. Subsetting it to just the characters you need typically cuts the
payload to a few KB.

## When to subset

- You have a fixed set of stamp captions (signatures, gallery labels, etc.) → subset to ~10-50 chars.
- You let users type free text → subset to common-CJK (~3000 chars, ~200-400 KB woff2).

## How

This repo ships two scripts under `packages/core/scripts/`:

- `audit-stamp-chars.mts` — scans your codebase for unique CJK chars. Useful as a starting set.
- `subset-font.mts` — feeds those chars (or any string) plus a source font into harfbuzz-subset (via the `subset-font` npm package), outputting a woff2.

Example:

```bash
echo "落梅听风雪兰水墨" | npx tsx scripts/subset-font.mts ./input.ttf @/dev/stdin ./output.woff2
```

## Numbers (this repo's playground)

| Font                      | Size       |
| ------------------------- | ---------- |
| `yishanbeizhuanti.ttf`    | 2.2 MB     |
| `yishanbeizhuanti.demo.woff2` (47 chars) | ~10 KB |

That's ~220× smaller, with no visual change.
```

- [ ] **Step 2: Commit**

```bash
git add docs/font-subsetting.md
git commit -m "$(cat <<'EOF'
docs: add stamp-font subsetting guide

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Manual playground verification

**Files:** none (manual)

- [ ] **Step 1: User runs `pnpm playground`**

Per CLAUDE.md (never auto-start dev servers), instruct the user:

> Run `pnpm playground` in another terminal. Open `/stamp` and `/stamp-playground` and confirm:
> 1. The seal characters render identically to before (no missing glyphs / no `□` boxes).
> 2. The font loads visibly faster on a cold reload (devtools Network tab: ~10 KB instead of 2.2 MB).

- [ ] **Step 2: Failure-mode check**

In `StampPlayground.vue`, type a character that isn't in the subset (e.g. "鼠" if not collected by the audit). Expected: stamp falls back to system font / shows the box. This is the trade-off — document it in `font-subsetting.md` if not already noted.

- [ ] **Step 3: Tag for release if happy**

```bash
cd /Users/jiabinbin/myself/github/shuimo-core-fontkit-wasm && pnpm release
```

(Optional — only if the user wants to publish.)

---

## Self-Review Notes

**Spec coverage:** Goal was 10-100× payload reduction, no visual change, no library API change. Tasks 3-5 deliver the demo path (~220×); Task 7 documents the consumer path. Task 6 produces measurable numbers.

**Phase 2 trigger:** If Phase 1 numbers are not enough (e.g. consumers using common-CJK 200KB woff2 still see laggy decode in fontkit), revisit `2026-05-09-replace-fontkit-with-wasm.md` for the WASM swap.

**Risk: subset-font install.** The package depends on a prebuilt harfbuzz wasm. If the install fails on the user's machine, the alternative is fontkit's own subsetter (`fontkit.subset()`), or invoking `pyftsubset` (Python `fonttools`). Document that fallback in Task 3 if encountered.

**Risk: missing characters.** The audit regex is `[㐀-鿿豈-﫿\u{20000}-\u{2FFFF}]` which covers most CJK but not Bopomofo, Hiragana, etc. For pure Chinese seals this is correct. If the project later needs Japanese kanji, expand the regex.
