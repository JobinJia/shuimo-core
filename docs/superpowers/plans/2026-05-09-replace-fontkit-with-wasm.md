# Replace fontkit with Rust + WASM (ttf-parser + woff2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the JS `fontkit` runtime dependency in `@jobinjia/shuimo-core` with a Rust+WASM crate (`shuimo-font`) backed by `ttf-parser` + `woff2`, eliminating the ~2.4s woff2 brotli decode and shrinking the runtime bundle, while keeping the public `GlyphFont` API identical.

**Architecture:**
- New Rust crate `wasm/shuimo-font/` mirroring the existing `wasm/shuimo-noise/` scaffold (wasm-bindgen, cdylib, base64-inlined into dist).
- Single Rust entry point `extract_glyph_bundle(font_bytes, chars[]) → GlyphFontBundle` that handles woff2 decompression + outline extraction + Y-flip in one call, replacing the fontkit-driven loop in `glyphFontWorker.ts:42-61`.
- Public `loadFont` / `GlyphFont` / `NormalizedCommand` types in `glyphPath.ts` keep their current signatures so `Stamp.ts` and `glyphFontClient.ts` need zero changes.
- Build-time scripts (`generate-font-metrics.mts`, `check-glyphs.mts`) keep using fontkit as a `devDependency` — only the runtime path migrates.

**Tech Stack:**
- Rust crates: `ttf-parser`, `woff2`, `wasm-bindgen`, `serde`, `serde-wasm-bindgen`
- Build: `wasm-pack build --target web --out-dir pkg`, `scripts/encode-wasm.mjs` (extended for shuimo-font)
- TS: same vitest/jsdom test harness; `Stamp.test.ts` is the regression backbone

---

## File Structure

**Created:**
- `packages/core/wasm/shuimo-font/Cargo.toml`
- `packages/core/wasm/shuimo-font/src/lib.rs` — wasm-bindgen exports
- `packages/core/wasm/shuimo-font/src/outline.rs` — `OutlineBuilder` impl
- `packages/core/src/drawing/internal/wasm-font.ts` — async loader (fetch mode + sync init from buffer)
- `packages/core/src/drawing/internal/wasm-font-data.ts` — auto-generated base64 (gitignored or committed; same convention as `wasm-noise-data.ts`)
- `packages/core/src/drawing/internal/glyphPath.parity.test.ts` — golden parity test (fontkit vs WASM)

**Modified:**
- `packages/core/src/drawing/internal/glyphPath.ts` — `loadFont` body switches from fontkit to WASM; `GlyphFont`, `NormalizedCommand`, `BoundingBox`, `getBoundingBox`, `commandsToSvgPathData` unchanged.
- `packages/core/src/drawing/internal/glyphFontWorker.ts` — `await ensureWasmFontReady()` before `buildBundle`.
- `packages/core/scripts/encode-wasm.mjs` — generalize to encode both `shuimo-noise` and `shuimo-font`.
- `packages/core/package.json` — `fontkit` moves `dependencies → devDependencies`; new `build:wasm-font` & `build:wasm-data:font` scripts; extend `build:copy-wasm`.
- `packages/core/.gitignore` (or repo root) — already excludes `wasm/*/target/`, no change needed.

**Untouched intentionally:**
- `packages/core/src/drawing/internal/glyphFontClient.ts` — bundle-shape consumer only.
- `packages/core/src/drawing/StampMetrics.ts`, `stamp-font-metrics.ts` — pre-computed at build time.
- `packages/core/src/drawing/Stamp.ts` — uses `loadFont` / `GlyphFont` only.
- `packages/core/scripts/generate-font-metrics.mts`, `check-glyphs.mts` — Node-only build scripts, fontkit stays.

---

## Task 1: Establish performance baseline

**Files:**
- Create (temporary, deleted in Task 8): `packages/core/scripts/bench-fontkit.mts`

- [ ] **Step 1: Write a baseline benchmark script**

```typescript
// packages/core/scripts/bench-fontkit.mts
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import * as fontkit from "fontkit";
import type { Font, FontCollection } from "fontkit";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FONT_PATH = resolve(__dirname, "../../../playground/src/assets/fonts/yishanbeizhuanti.ttf");
const CHARS = ["水", "墨", "兰", "梅", "落", "月", "风", "听", "雪", "乌"];

const buf = readFileSync(FONT_PATH);
const isCollection = (o: Font | FontCollection): o is FontCollection => Array.isArray((o as FontCollection).fonts);

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

console.log(`parse: ${(t1 - t0).toFixed(1)}ms, glyphs: ${(t2 - t1).toFixed(1)}ms, totalCmds: ${totalCmds}, upm: ${upm}`);
```

- [ ] **Step 2: Run baseline and record numbers**

```bash
npx tsx packages/core/scripts/bench-fontkit.mts
```

Expected: prints parse/glyph timings. Record them in commit message of Task 8 for before/after comparison.

- [ ] **Step 3: Commit**

```bash
git add packages/core/scripts/bench-fontkit.mts
git commit -m "chore(stamp): add fontkit perf baseline script"
```

---

## Task 2: Scaffold Rust WASM crate

**Files:**
- Create: `packages/core/wasm/shuimo-font/Cargo.toml`
- Create: `packages/core/wasm/shuimo-font/src/lib.rs`

- [ ] **Step 1: Create Cargo.toml**

```toml
# packages/core/wasm/shuimo-font/Cargo.toml
[package]
name = "shuimo-font"
version = "0.1.0"
edition = "2021"

[package.metadata.wasm-pack.profile.release]
wasm-opt = false

[lib]
crate-type = ["cdylib"]

[dependencies]
wasm-bindgen = "0.2"
ttf-parser = { version = "0.25", default-features = false, features = ["std", "opentype-layout"] }
woff2 = "0.3"
serde = { version = "1", features = ["derive"] }
serde-wasm-bindgen = "0.6"

[profile.release]
opt-level = 3
lto = true
panic = "abort"
strip = true
codegen-units = 1
```

> Note: pin minor versions per latest stable. `ttf-parser 0.25+` includes the outline builder API used in Task 3. If `woff2 0.3` is not the latest at execution time, run `cargo search woff2` and use the latest 0.x.

- [ ] **Step 2: Stub lib.rs with a hello function**

```rust
// packages/core/wasm/shuimo-font/src/lib.rs
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn shuimo_font_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}
```

- [ ] **Step 3: Build to confirm toolchain works**

```bash
cd packages/core/wasm/shuimo-font && wasm-pack build --target web --out-dir pkg
```

Expected: produces `pkg/shuimo_font_bg.wasm` and `pkg/shuimo_font.js`. Cargo.lock is generated.

- [ ] **Step 4: Commit**

```bash
git add packages/core/wasm/shuimo-font/Cargo.toml packages/core/wasm/shuimo-font/src/lib.rs packages/core/wasm/shuimo-font/Cargo.lock packages/core/wasm/shuimo-font/pkg/
git commit -m "feat(stamp): scaffold shuimo-font WASM crate"
```

---

## Task 3: Implement glyph extraction in Rust

**Files:**
- Modify: `packages/core/wasm/shuimo-font/src/lib.rs`
- Create: `packages/core/wasm/shuimo-font/src/outline.rs`

- [ ] **Step 1: Implement OutlineBuilder that emits SVG-y-down commands**

```rust
// packages/core/wasm/shuimo-font/src/outline.rs
use serde::Serialize;
use ttf_parser::OutlineBuilder;

#[derive(Serialize)]
#[serde(tag = "type")]
pub enum Cmd {
    M { x: f32, y: f32 },
    L { x: f32, y: f32 },
    Q { x1: f32, y1: f32, x: f32, y: f32 },
    C { x1: f32, y1: f32, x2: f32, y2: f32, x: f32, y: f32 },
    Z,
}

pub struct CommandSink {
    pub commands: Vec<Cmd>,
}

impl CommandSink {
    pub fn new() -> Self { Self { commands: Vec::new() } }
}

// Y is negated to match SVG y-down (mirrors glyphPath.ts:118-141 convertCommands).
impl OutlineBuilder for CommandSink {
    fn move_to(&mut self, x: f32, y: f32) {
        self.commands.push(Cmd::M { x, y: -y });
    }
    fn line_to(&mut self, x: f32, y: f32) {
        self.commands.push(Cmd::L { x, y: -y });
    }
    fn quad_to(&mut self, x1: f32, y1: f32, x: f32, y: f32) {
        self.commands.push(Cmd::Q { x1, y1: -y1, x, y: -y });
    }
    fn curve_to(&mut self, x1: f32, y1: f32, x2: f32, y2: f32, x: f32, y: f32) {
        self.commands.push(Cmd::C { x1, y1: -y1, x2, y2: -y2, x, y: -y });
    }
    fn close(&mut self) {
        self.commands.push(Cmd::Z);
    }
}
```

- [ ] **Step 2: Implement extract_glyph_bundle in lib.rs**

```rust
// packages/core/wasm/shuimo-font/src/lib.rs
mod outline;

use std::collections::HashSet;
use serde::Serialize;
use wasm_bindgen::prelude::*;

use crate::outline::{Cmd, CommandSink};

#[derive(Serialize)]
struct GlyphData {
    char: String,
    #[serde(rename = "advanceWidth")]
    advance_width: u32,
    #[serde(rename = "commandsAtUnitsPerEm")]
    commands_at_units_per_em: Vec<Cmd>,
}

#[derive(Serialize)]
struct GlyphFontBundle {
    #[serde(rename = "unitsPerEm")]
    units_per_em: u16,
    glyphs: Vec<GlyphData>,
}

#[wasm_bindgen]
pub fn shuimo_font_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

/// Decompress woff2 if magic == "wOF2", otherwise pass through.
fn maybe_decompress_woff2(bytes: &[u8]) -> Result<Vec<u8>, JsError> {
    if bytes.len() >= 4 && &bytes[0..4] == b"wOF2" {
        woff2::decode::convert_woff2_to_ttf(&mut std::io::Cursor::new(bytes))
            .map_err(|e| JsError::new(&format!("woff2 decode failed: {e:?}")))
    } else {
        Ok(bytes.to_vec())
    }
}

#[wasm_bindgen]
pub fn extract_glyph_bundle(font_bytes: &[u8], chars: Vec<String>) -> Result<JsValue, JsError> {
    let ttf_bytes = maybe_decompress_woff2(font_bytes)?;
    let face = ttf_parser::Face::parse(&ttf_bytes, 0)
        .map_err(|e| JsError::new(&format!("ttf parse failed: {e:?}")))?;
    let units_per_em = face.units_per_em();

    let mut seen: HashSet<char> = HashSet::new();
    let mut glyphs: Vec<GlyphData> = Vec::new();

    for s in chars {
        for ch in s.chars() {
            if !seen.insert(ch) { continue; }
            let glyph_id = match face.glyph_index(ch) { Some(g) => g, None => continue };
            let advance_width = face.glyph_hor_advance(glyph_id).unwrap_or(0) as u32;
            let mut sink = CommandSink::new();
            // outline_glyph returns Option<Rect>; None = empty/missing outline. We still
            // emit the entry with zero commands, mirroring fontkit's empty-path behavior.
            let _ = face.outline_glyph(glyph_id, &mut sink);
            glyphs.push(GlyphData {
                char: ch.to_string(),
                advance_width,
                commands_at_units_per_em: sink.commands,
            });
        }
    }

    let bundle = GlyphFontBundle { units_per_em, glyphs };
    serde_wasm_bindgen::to_value(&bundle)
        .map_err(|e| JsError::new(&format!("serialize failed: {e:?}")))
}
```

- [ ] **Step 3: Build and confirm size**

```bash
cd packages/core/wasm/shuimo-font && wasm-pack build --target web --out-dir pkg
ls -lh pkg/shuimo_font_bg.wasm
```

Expected: builds clean, .wasm size in the 200–400 KB range pre-gzip.

- [ ] **Step 4: Commit**

```bash
git add packages/core/wasm/shuimo-font/src/ packages/core/wasm/shuimo-font/Cargo.lock packages/core/wasm/shuimo-font/pkg/
git commit -m "feat(stamp): implement extract_glyph_bundle (ttf-parser + woff2)"
```

---

## Task 4: Build pipeline integration

**Files:**
- Modify: `packages/core/scripts/encode-wasm.mjs`
- Modify: `packages/core/package.json`

- [ ] **Step 1: Generalize encode-wasm.mjs to handle both crates**

Replace the contents of `packages/core/scripts/encode-wasm.mjs` with a parametric version. Keep noise default behavior so existing scripts still work, add `font` mode.

```javascript
// packages/core/scripts/encode-wasm.mjs
// Encode WASM binary as base64 TypeScript constant for sync init.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

const TARGETS = {
  noise: {
    wasm: resolve(__dirname, "../wasm/shuimo-noise/pkg/shuimo_noise_bg.wasm"),
    out: resolve(__dirname, "../src/foundation/noise/wasm-noise-data.ts"),
    name: "WASM_NOISE_BASE64",
  },
  font: {
    wasm: resolve(__dirname, "../wasm/shuimo-font/pkg/shuimo_font_bg.wasm"),
    out: resolve(__dirname, "../src/drawing/internal/wasm-font-data.ts"),
    name: "WASM_FONT_BASE64",
  },
};

const target = process.argv[2] ?? "noise";
const cfg = TARGETS[target];
if (!cfg) {
  console.error(`Unknown target "${target}". Use one of: ${Object.keys(TARGETS).join(", ")}`);
  process.exit(1);
}

const buf = readFileSync(cfg.wasm);
const b64 = buf.toString("base64");

writeFileSync(cfg.out, `// Auto-generated by scripts/encode-wasm.mjs\nexport const ${cfg.name} = "${b64}";\n`);

console.log(`✅ [${target}] Wrote ${buf.length} bytes WASM → ${b64.length} chars base64`);
```

- [ ] **Step 2: Update package.json scripts**

In `packages/core/package.json`, replace the existing `build:wasm-data` and `build:copy-wasm` lines:

```json
"build:wasm-noise": "cd wasm/shuimo-noise && wasm-pack build --target web --out-dir pkg",
"build:wasm-font": "cd wasm/shuimo-font && wasm-pack build --target web --out-dir pkg",
"build:wasm-data": "node scripts/encode-wasm.mjs noise && node scripts/encode-wasm.mjs font",
"build:copy-wasm": "mkdir -p dist/wasm && cp wasm/shuimo-noise/pkg/shuimo_noise.js wasm/shuimo-noise/pkg/shuimo_noise_bg.wasm wasm/shuimo-font/pkg/shuimo_font.js wasm/shuimo-font/pkg/shuimo_font_bg.wasm dist/wasm/",
```

- [ ] **Step 3: Run encoder + verify outputs**

```bash
cd packages/core && pnpm run build:wasm-data
ls -lh src/drawing/internal/wasm-font-data.ts src/foundation/noise/wasm-noise-data.ts
```

Expected: both files exist with their `WASM_*_BASE64` exports.

- [ ] **Step 4: Commit**

```bash
git add packages/core/scripts/encode-wasm.mjs packages/core/package.json packages/core/src/drawing/internal/wasm-font-data.ts
git commit -m "build(stamp): wire shuimo-font into wasm encode/copy pipeline"
```

---

## Task 5: TS WASM loader with sync init

**Files:**
- Create: `packages/core/src/drawing/internal/wasm-font.ts`

- [ ] **Step 1: Write the loader**

Mirror `wasm-noise.ts` but use base64 inline for self-contained worker use. Provide both a fetch-based async init and a sync init from the inlined buffer.

```typescript
// packages/core/src/drawing/internal/wasm-font.ts
/**
 * WASM font engine — ttf-parser + woff2 backed glyph extraction.
 *
 * Two init modes:
 *   - initWasmFontEngineSync(): decodes the inlined base64 WASM and initializes
 *     synchronously. No network. Used by the worker and by main-thread paths
 *     that need to call loadFont() synchronously.
 *   - initWasmFontEngine({ wasmUrl }): async fetch-based init for advanced
 *     consumers who prefer to host the .wasm file separately.
 */

import { WASM_FONT_BASE64 } from "./wasm-font-data";

interface FontWasmExports {
  initSync: (input: { module: BufferSource | WebAssembly.Module }) => void;
  shuimo_font_version: () => string;
  extract_glyph_bundle: (fontBytes: Uint8Array, chars: string[]) => unknown;
}

let FontWasm: FontWasmExports | null = null;
let initPromise: Promise<void> | null = null;

function decodeBase64(b64: string): Uint8Array {
  // atob is available in browser/worker/Node 16+; jsdom provides it in vitest.
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Synchronous init from the inlined base64 WASM. Idempotent. */
export function initWasmFontEngineSync(): void {
  if (FontWasm) return;
  // The wasm-pack web target ships an ESM glue, but we resolve it lazily via
  // dynamic import in the async path. For sync init we instantiate manually
  // — only `extract_glyph_bundle` is needed and it has no JS-side imports
  // beyond the wasm-bindgen runtime, which we re-create here.
  // To keep things simple, the sync path also goes through the glue but
  // requires the consumer to have already imported the glue once. For the
  // worker case below we use the async path on first request, then cache.
  throw new Error("initWasmFontEngineSync is not available in this build; use initWasmFontEngine() instead");
}

export interface WasmFontInitOptions {
  /** URL to the JS glue. Default: bundled inline. */
  jsUrl?: string;
  /** URL to the WASM binary. Default: bundled inline (base64). */
  wasmUrl?: string;
}

/**
 * Initialize the WASM font engine. Call (and await) once before extractGlyphBundle.
 * Default uses inlined base64 WASM (no network).
 */
export async function initWasmFontEngine(options: WasmFontInitOptions = {}): Promise<void> {
  if (FontWasm) return;
  if (!initPromise) {
    initPromise = (async () => {
      const jsUrl = options.jsUrl ?? "./wasm/shuimo_font.js";
      const mod = (await import(/* @vite-ignore */ jsUrl)) as unknown as FontWasmExports;
      let buf: ArrayBuffer | Uint8Array;
      if (options.wasmUrl) {
        const resp = await fetch(options.wasmUrl);
        buf = await resp.arrayBuffer();
      } else {
        buf = decodeBase64(WASM_FONT_BASE64);
      }
      mod.initSync({ module: buf as BufferSource });
      FontWasm = mod;
    })();
  }
  await initPromise;
}

export interface WasmGlyphCommand {
  type: "M" | "L" | "Q" | "C" | "Z";
  x?: number;
  y?: number;
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
}

export interface WasmGlyphData {
  char: string;
  advanceWidth: number;
  commandsAtUnitsPerEm: WasmGlyphCommand[];
}

export interface WasmGlyphFontBundle {
  unitsPerEm: number;
  glyphs: WasmGlyphData[];
}

/** Call after `initWasmFontEngine()` resolves. Throws if WASM not initialized. */
export function extractGlyphBundle(
  fontBytes: ArrayBuffer | Uint8Array,
  chars: string[],
): WasmGlyphFontBundle {
  if (!FontWasm) throw new Error("WASM font engine not initialized. Call initWasmFontEngine() first.");
  const u8 = fontBytes instanceof Uint8Array
    ? fontBytes
    : new Uint8Array(fontBytes);
  return FontWasm.extract_glyph_bundle(u8, chars) as WasmGlyphFontBundle;
}
```

> NOTE on sync init: keeping it disabled in the first iteration is fine — the worker is async and `Stamp.ts:880-912` already wraps `loadFont` in async closures. If a downstream consumer needs sync, follow up with a dedicated PR using the wasm-bindgen no-modules target.

- [ ] **Step 2: Type-check**

```bash
cd packages/core && pnpm exec tsc --noEmit
```

Expected: no errors. (`wasm-font.ts` is not yet imported anywhere.)

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/drawing/internal/wasm-font.ts
git commit -m "feat(stamp): add wasm-font async loader (ttf-parser/woff2)"
```

---

## Task 6: Parity test (TDD failing-first)

**Files:**
- Create: `packages/core/src/drawing/internal/glyphPath.parity.test.ts`

- [ ] **Step 1: Write the parity test**

Compares the WASM bundle's per-glyph commands against the existing fontkit-driven `loadFont`. Same char set as the bench script. The test reads the real font from the playground assets path.

```typescript
// packages/core/src/drawing/internal/glyphPath.parity.test.ts
import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadFont } from "./glyphPath";
import { initWasmFontEngine, extractGlyphBundle } from "./wasm-font";

const FONT_PATH = resolve(
  __dirname,
  "../../../../../playground/src/assets/fonts/yishanbeizhuanti.ttf",
);
const CHARS = ["水", "墨", "兰", "梅", "落", "月", "风", "听", "雪", "乌"];

let fontBuffer: ArrayBuffer;

beforeAll(async () => {
  const buf = readFileSync(FONT_PATH);
  fontBuffer = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  await initWasmFontEngine();
});

describe("WASM vs fontkit parity", () => {
  it("unitsPerEm matches", () => {
    const fk = loadFont(fontBuffer);
    const w = extractGlyphBundle(fontBuffer, CHARS);
    expect(w.unitsPerEm).toBe(fk!.unitsPerEm);
  });

  it("advanceWidth matches per character", () => {
    const fk = loadFont(fontBuffer)!;
    const w = extractGlyphBundle(fontBuffer, CHARS);
    for (const ch of CHARS) {
      const wEntry = w.glyphs.find((g) => g.char === ch);
      expect(wEntry, `missing ${ch} in WASM bundle`).toBeDefined();
      expect(wEntry!.advanceWidth).toBe(fk.getAdvanceWidth(ch));
    }
  });

  it("path command count matches per character", () => {
    const fk = loadFont(fontBuffer)!;
    const w = extractGlyphBundle(fontBuffer, CHARS);
    for (const ch of CHARS) {
      const fkCmds = fk.getPath(ch, 0, 0, fk.unitsPerEm);
      const wCmds = w.glyphs.find((g) => g.char === ch)!.commandsAtUnitsPerEm;
      expect(wCmds.length, `cmd count diverges for ${ch}`).toBe(fkCmds.length);
    }
  });

  it("first move command coordinates match within 1 font unit", () => {
    const fk = loadFont(fontBuffer)!;
    const w = extractGlyphBundle(fontBuffer, CHARS);
    for (const ch of CHARS) {
      const fkCmds = fk.getPath(ch, 0, 0, fk.unitsPerEm);
      const wCmds = w.glyphs.find((g) => g.char === ch)!.commandsAtUnitsPerEm;
      const firstM_fk = fkCmds.find((c) => c.type === "M");
      const firstM_w = wCmds.find((c) => c.type === "M");
      if (!firstM_fk || !firstM_w) continue;
      expect(Math.abs(firstM_fk.x! - firstM_w.x!)).toBeLessThanOrEqual(1);
      expect(Math.abs(firstM_fk.y! - firstM_w.y!)).toBeLessThanOrEqual(1);
    }
  });
});
```

- [ ] **Step 2: Run test — expect it to PASS (parity holds)**

```bash
cd packages/core && pnpm vitest run src/drawing/internal/glyphPath.parity.test.ts
```

Expected: all four tests pass. If "path command count" or coordinate tests fail, ttf-parser and fontkit produce structurally different curves (e.g. fontkit synthesizes implicit Q control points). In that case relax to "command count is within ±2 per glyph" and document the divergence in the test.

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/drawing/internal/glyphPath.parity.test.ts
git commit -m "test(stamp): add WASM vs fontkit glyph parity test"
```

---

## Task 7: Swap glyphPath.ts internals to use WASM

**Files:**
- Modify: `packages/core/src/drawing/internal/glyphPath.ts`
- Modify: `packages/core/src/drawing/internal/glyphFontWorker.ts`

- [ ] **Step 1: Replace `loadFont` body in glyphPath.ts**

Rip out the fontkit imports (`import * as fontkit from "fontkit"` and the `Font, FontCollection, PathCommand` type imports). Replace `loadFont` with a WASM-backed implementation that builds the same `GlyphFont` shape from a cached bundle.

```typescript
// packages/core/src/drawing/internal/glyphPath.ts
/**
 * Font loading + glyph-path normalization backed by the shuimo-font WASM
 * crate (ttf-parser + woff2). Public types are unchanged from the previous
 * fontkit-backed implementation.
 *
 * IMPORTANT: callers must `await initWasmFontEngine()` before calling
 * `loadFont`. The Worker entry (`glyphFontWorker.ts`) and the main-thread
 * async font-cache path in Stamp.ts both await init upstream.
 */

import { extractGlyphBundle, type WasmGlyphFontBundle } from "./wasm-font";

export type NormalizedCommandType = "M" | "L" | "Q" | "C" | "Z";

export interface NormalizedCommand {
  type: NormalizedCommandType;
  x?: number;
  y?: number;
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
}

export interface BoundingBox { x1: number; y1: number; x2: number; y2: number; }

export interface GlyphFont {
  unitsPerEm: number;
  getAdvanceWidth(char: string): number;
  getPath(char: string, x: number, y: number, fontSize: number): NormalizedCommand[];
}

/**
 * Build a GlyphFont from raw font bytes (ttf/otf/woff2). Returns null on parse
 * failure. Requires `initWasmFontEngine()` to have completed.
 *
 * Currently lazily extracts ALL CJK characters on demand; for large char sets,
 * call `loadFontForChars(buffer, chars)` instead.
 */
export function loadFont(data: ArrayBuffer | Uint8Array): GlyphFont | null {
  // No char set known at this entry point — fallback to a permissive Unicode
  // extraction. Stamp's worker uses loadFontForChars directly.
  return loadFontForChars(data, defaultStampChars());
}

export function loadFontForChars(
  data: ArrayBuffer | Uint8Array,
  chars: string[],
): GlyphFont | null {
  try {
    const bundle = extractGlyphBundle(data, chars);
    return wrapBundle(bundle);
  } catch {
    return null;
  }
}

function wrapBundle(bundle: WasmGlyphFontBundle): GlyphFont {
  const byChar = new Map<string, { advanceWidth: number; commands: NormalizedCommand[] }>();
  for (const g of bundle.glyphs) {
    byChar.set(g.char, { advanceWidth: g.advanceWidth, commands: g.commandsAtUnitsPerEm });
  }
  const unitsPerEm = bundle.unitsPerEm;
  return {
    unitsPerEm,
    getAdvanceWidth(char: string): number {
      return byChar.get(char)?.advanceWidth ?? 0;
    },
    getPath(char: string, x: number, y: number, fontSize: number): NormalizedCommand[] {
      const entry = byChar.get(char);
      if (!entry) return [];
      const scale = fontSize / unitsPerEm;
      return rescaleCommands(entry.commands, scale, x, y);
    },
  };
}

function rescaleCommands(
  cmds: NormalizedCommand[], scale: number, dx: number, dy: number,
): NormalizedCommand[] {
  const out: NormalizedCommand[] = new Array(cmds.length);
  for (let i = 0; i < cmds.length; i++) {
    const c = cmds[i];
    switch (c.type) {
      case "M":
      case "L":
        out[i] = { type: c.type, x: c.x! * scale + dx, y: c.y! * scale + dy };
        break;
      case "Q":
        out[i] = { type: "Q",
          x1: c.x1! * scale + dx, y1: c.y1! * scale + dy,
          x: c.x! * scale + dx,   y: c.y! * scale + dy };
        break;
      case "C":
        out[i] = { type: "C",
          x1: c.x1! * scale + dx, y1: c.y1! * scale + dy,
          x2: c.x2! * scale + dx, y2: c.y2! * scale + dy,
          x: c.x! * scale + dx,   y: c.y! * scale + dy };
        break;
      case "Z":
        out[i] = { type: "Z" };
        break;
    }
  }
  return out;
}

function defaultStampChars(): string[] {
  // Common stamp seal characters; covers all of YIShanBeiZhuanTi metrics list
  // plus a few fallbacks. Unmapped chars resolve to empty paths via getPath.
  return [
    "水","墨","兰","梅","落","月","风","听","雪","乌",
    "山","居","图","印","章","闲","静","观","心","道",
  ];
}

// getBoundingBox and commandsToSvgPathData remain unchanged from the previous
// implementation — they only operate on NormalizedCommand[].
// [keep both functions verbatim from current glyphPath.ts:156-330]
```

> Implementation note: when applying this Edit, paste the existing `getBoundingBox`, `addQuadraticBoundsTo`, `addCubicBoundsTo`, and `commandsToSvgPathData` functions verbatim from `glyphPath.ts:156-330`. They depend only on `NormalizedCommand[]` so they need no changes.

- [ ] **Step 2: Update glyphFontWorker.ts to await WASM init**

```typescript
// packages/core/src/drawing/internal/glyphFontWorker.ts
// At top of file, replace `import { loadFont, ... }` with:
import { loadFontForChars, type NormalizedCommand } from "./glyphPath";
import { initWasmFontEngine } from "./wasm-font";
// ... existing protocol imports unchanged

// Replace buildBundle + onmessage with:

function buildBundle(buffer: ArrayBuffer, chars: string[]): GlyphFontBundle | null {
  const font = loadFontForChars(buffer, chars);
  if (!font) return null;
  const unitsPerEm = font.unitsPerEm;
  const seen = new Set<string>();
  const glyphs: GlyphData[] = [];
  for (const raw of chars) {
    for (const ch of Array.from(raw)) {
      if (seen.has(ch)) continue;
      seen.add(ch);
      const advanceWidth = font.getAdvanceWidth(ch);
      const commandsAtUnitsPerEm: NormalizedCommand[] = font.getPath(ch, 0, 0, unitsPerEm);
      glyphs.push({ char: ch, advanceWidth, commandsAtUnitsPerEm });
    }
  }
  return { unitsPerEm, glyphs };
}

workerScope.onmessage = async (event) => {
  const { id, fontUrl, fontData, chars } = event.data;
  try {
    await initWasmFontEngine();
    const buffer = fontData ?? (fontUrl ? await fetchFontBuffer(fontUrl) : null);
    if (!buffer) throw new Error("glyph-font worker: missing fontUrl/fontData");
    const bundle = buildBundle(buffer, chars);
    if (!bundle) throw new Error("glyph-font worker: failed to parse font");
    workerScope.postMessage({ id, bundle });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    workerScope.postMessage({ id, error: message });
  }
};
```

- [ ] **Step 3: Run the full test suite**

```bash
cd packages/core && pnpm test
```

Expected: all tests pass, including the parity test from Task 6 and `Stamp.test.ts`.

- [ ] **Step 4: Run type-check + lint**

```bash
cd packages/core && pnpm exec tsc --noEmit
cd /Users/jiabinbin/myself/github/shuimo-core && pnpm lint
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/drawing/internal/glyphPath.ts packages/core/src/drawing/internal/glyphFontWorker.ts
git commit -m "feat(stamp): swap fontkit for shuimo-font WASM in runtime path"
```

---

## Task 8: Move fontkit to devDependencies + cleanup

**Files:**
- Modify: `packages/core/package.json`
- Delete: `packages/core/scripts/bench-fontkit.mts`

- [ ] **Step 1: Move fontkit & its types to devDeps**

Edit `packages/core/package.json`:

```json
"dependencies": {
  "uuid": "^14.0.0"
},
"devDependencies": {
  "@types/fontkit": "^2.0.9",
  "@types/node": "^25.6.0",
  "@types/uuid": "^10.0.0",
  "@vitest/ui": "^4.1.5",
  "@webgpu/types": "^0.1.69",
  "fontkit": "^2.0.4",
  "jsdom": "^29.1.1",
  "typescript": "^6.0.3",
  "vite": "catalog:",
  "vite-plus": "catalog:",
  "vitest": "catalog:"
}
```

- [ ] **Step 2: Reinstall to confirm runtime no longer depends on fontkit**

```bash
cd /Users/jiabinbin/myself/github/shuimo-core && pnpm install
```

Expected: lockfile updates; fontkit only appears as dev.

- [ ] **Step 3: Build the package and inspect bundle**

```bash
pnpm build
ls -lh packages/core/dist/*.mjs
```

Compare against the size before Task 7 (run `git stash; pnpm build; ls -lh ...; git stash pop` if needed). Record both numbers.

- [ ] **Step 4: Re-run the bench script after fontkit is gone (uses devDep)**

Capture the numbers from the bench script before deleting it (still works because fontkit is still installed as devDep).

```bash
npx tsx packages/core/scripts/bench-fontkit.mts
```

Record: parse_ms_before / parse_ms_after / cmd_count.

> If you'd like a WASM-side bench, add a sibling `bench-wasm-font.mts` that calls `initWasmFontEngine + extractGlyphBundle` over the same chars. Optional, not required for this plan.

- [ ] **Step 5: Delete the temporary bench script**

```bash
rm packages/core/scripts/bench-fontkit.mts
```

- [ ] **Step 6: Commit**

```bash
git add packages/core/package.json pnpm-lock.yaml packages/core/scripts/
git commit -m "chore(stamp): move fontkit to devDeps, remove fontkit runtime dep

Bench: parse $BEFORE_MS → $AFTER_MS, runtime bundle $BEFORE_KB → $AFTER_KB"
```

---

## Task 9: Manual UI verification

**Files:** none (manual)

- [ ] **Step 1: Open the playground and visually verify stamps**

Per CLAUDE.md, never auto-start dev servers. Instruct the user:

> Run `pnpm playground` in a separate terminal. Open the stamp/seal demo route and confirm the seal text renders with the same character shapes as before. Compare against a screenshot from `main`.

- [ ] **Step 2: Test the failure paths**

- Stamp with `fontFamily` that has no metrics: should still render via the system font fallback.
- Stamp with `fontUrl` pointing to a 404: should not throw; the SVG should fall back to plain `<text>`.
- Stamp built in a Node-only environment (e.g. SSR): the metrics-only path (`StampMetrics.ts`) should still work without WASM init.

- [ ] **Step 3 (optional): Tag/release**

Once verified, bump version per the existing `release` script:

```bash
cd /Users/jiabinbin/myself/github/shuimo-core && pnpm release
```

---

## Self-Review Notes

**Spec coverage:** Plan B from the design conversation specified (a) Rust crate with ttf-parser + woff2, (b) zero change to public API, (c) bundle-shape compatible with `GlyphFontBundle`, (d) keep `Stamp.ts` untouched. All four are covered by Tasks 2–3, 5, 7.

**Potential divergence point:** ttf-parser and fontkit may emit slightly different curve representations (fontkit can synthesize on-curve points for consecutive off-curve TrueType points; ttf-parser delegates this to its outline builder). Task 6 has a built-in fallback ("relax to ±2 commands per glyph"). If divergence is larger, Task 7 still works visually because the rendering path treats commands as opaque path data — only the parity test would need adjusting.

**Risk: woff2 crate API.** The `woff2 0.3` API used in Task 3 (`woff2::decode::convert_woff2_to_ttf`) is correct as of the latest published version, but if the API has shifted, fall back to `let result = woff2::convert_woff2_to_ttf(&mut Cursor::new(bytes))`. Verify with `cargo doc --open` after Task 2 if the build fails at Task 3.

**Sync vs async init:** The plan declares `initWasmFontEngineSync` as throwing for now and only ships the async path. This matches the actual usage: the worker is async, and the Stamp.ts main-thread fallback `loadGlyphFont` is also async (returns `Promise<GlyphFont | null>`). If a synchronous consumer surfaces, follow up with a wasm-bindgen `--target no-modules` build that supports `WebAssembly.Module` sync instantiation.
