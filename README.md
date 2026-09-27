# shuimo-core (水墨核心库)

Procedural Chinese ink painting (水墨画) generation in TypeScript: landscape paintings (山水画), ink-wash mountains, flower paintings (花卉) and seal stamps (印章). Output is SVG strings or Canvas 2D; hot paths (noise, xuan paper tone) run in Rust compiled to WebAssembly. Every generator is seeded: the same seed gives the same picture.

What changed between versions: [CHANGELOG.md](./CHANGELOG.md). Upgrading from 2.x: see [Migrating from 2.x](./CHANGELOG.md#migrating-from-2x).

## Based on

- [shan-shui-inf](https://github.com/LingDong-/shan-shui-inf) by Lingdong Huang
- [nonflowers](https://github.com/LingDong-/nonflowers) by Lingdong Huang

## Quick Start

```bash
pnpm add @jobinjia/shuimo-core
```

```typescript
import { generateLandscape } from "@jobinjia/shuimo-core";

const { svg } = generateLandscape({ width: 1600, height: 800, seed: 42 });
document.body.innerHTML = svg;
```

The package is ESM-only and requires Node >= 22 for tooling. Generators that return a canvas need a DOM (browser, or a canvas shim in Node).

## Entry Points

| Import                                             | Description                                                     |
| -------------------------------------------------- | --------------------------------------------------------------- |
| `@jobinjia/shuimo-core`                            | Everything below except stamp v2 and the workers                |
| `@jobinjia/shuimo-core/foundation`                 | PRNG, noise, geometry                                           |
| `@jobinjia/shuimo-core/drawing`                    | Strokes, brush, texture, stamp v1, flower canvas, ink mountains |
| `@jobinjia/shuimo-core/elements`                   | Mountains, trees, water, clouds, four gentlemen, xuan paper     |
| `@jobinjia/shuimo-core/stamp-v2`                   | Seal stamp v2 (recommended for new code)                        |
| `@jobinjia/shuimo-core/xuan-paper/worker`          | Web Worker entry that renders xuan paper off the main thread    |
| `@jobinjia/shuimo-core/xuan-paper/worker-protocol` | Request / response types for that worker                        |
| `@jobinjia/shuimo-core/stamp/font-worker`          | Web Worker entry that decodes seal fonts off the main thread    |
| `@jobinjia/shuimo-core/stamp/font-worker-protocol` | Request / response types for that worker                        |

The library never spawns workers itself: construct them with `new Worker(new URL("<entry>", import.meta.url), { type: "module" })` and pass them in.

---

## Landscape Painting (山水画)

### `generatePainting(options)` / `generateLandscape(options)`

```typescript
import { generatePainting, generateLandscape } from "@jobinjia/shuimo-core";

const result = generatePainting({ type: "landscape", width: 1600, height: 800, seed: 42 });
// generateLandscape(options) is the same with type fixed to "landscape".
```

| Param              | Type                                                 | Default      | Description                                                              |
| ------------------ | ---------------------------------------------------- | ------------ | ------------------------------------------------------------------------ |
| `type`             | `"landscape"`                                        | —            | Painting type (required for `generatePainting`)                          |
| `width`            | `number`                                             | `1200`       | Canvas width (px)                                                        |
| `height`           | `number`                                             | `800`        | Canvas height (px); the whole composition is laid out in this height     |
| `seed`             | `number`                                             | `Date.now()` | Deterministic seed                                                       |
| `onXuanPaper`      | `boolean`                                            | `true`       | Draw on a xuan paper (宣纸) background                                   |
| `xuanPaperOptions` | `PaintingXuanPaperOptions`                           | `{}`         | Paper colour, texture, aging and gold flecks                             |
| `transparent`      | `boolean`                                            | `false`      | Omit the root `mix-blend-mode: multiply` (apply your own blend)          |
| `blankPosition`    | `"topLeft" \| "top" \| … \| "bottomRight" \| "none"` | `"none"`     | Where to leave blank space (留白)                                        |
| `detail`           | `number`                                             | `1`          | Ink texture density; lower is faster                                     |
| `minCounts`        | `Partial<Record<PlanTag, number>>`                   | —            | Guarantee a minimum number of elements per tag                           |
| `renderElements`   | `Partial<Record<PlanTag, boolean>>`                  | all `true`   | Set a tag to `false` to skip it; the rest of the painting stays the same |
| `placement`        | `LandscapePlacementOptions`                          | —            | Tuning for guaranteed water bands / boats                                |

**Returns** `{ svg: string, width: number, height: number, seed: number }`.

---

## Seal Stamp (印章)

There are two stamp engines. **Stamp v2** (`./stamp-v2`) renders real glyph outlines from a font file and adds hand-carved variation, rim wear and ink texture; use it for new code. **Stamp v1** (`generateStamp`) renders text with a CSS font family and stays available for existing users. [docs/stamp-v2-vs-v1.md](./docs/stamp-v2-vs-v1.md) compares them.

### Stamp v2 — `generateSealAsync(options)` / `generateSeal(options)`

```typescript
import { generateSealAsync } from "@jobinjia/shuimo-core/stamp-v2";

const seal = await generateSealAsync({
  text: ["受命", "于天"], // one string per column, right to left
  size: 240,
  mode: "yin", // yin 阴章 (white text on red) / yang 阳章
  shape: { kind: "rect" },
  seed: 7,
  font: "/fonts/seal-script.woff2", // URL, ArrayBuffer or Uint8Array; required
});
container.innerHTML = seal.svg!;
```

You supply the font (woff2 / ttf / otf); the library ships none. `generateSeal` is the synchronous variant and needs `font` as an `ArrayBuffer` / `Uint8Array`.

| Option            | Type                                                                                                        | Default              | Description                                                                                                                                                                     |
| ----------------- | ----------------------------------------------------------------------------------------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `text`            | `string \| string[]`                                                                                        | —                    | Characters; an array gives one column per entry                                                                                                                                 |
| `size`            | `number`                                                                                                    | —                    | Output size (px); texture effects scale with it                                                                                                                                 |
| `mode`            | `"yin" \| "yang"`                                                                                           | `"yang"`             | 阴章 / 阳章                                                                                                                                                                     |
| `shape`           | `{ kind: "auto" \| "square" \| "rect" \| "circle" \| "ellipse" \| "polygon", … }`                           | `{ kind: "square" }` | Outline; `rect` / `ellipse` take `aspect`, `polygon` takes `sides`                                                                                                              |
| `seed`            | `number`                                                                                                    | `Date.now()`         | Deterministic seed                                                                                                                                                              |
| `script`          | `"xiaozhuan" \| "dazhuan" \| "jinwen" \| "jiudiezhuan" \| "custom"`                                         | —                    | Seal-script geometry style (reshapes glyphs; does not switch fonts)                                                                                                             |
| `font`            | `string \| ArrayBuffer \| Uint8Array`                                                                       | —                    | Font URL or bytes                                                                                                                                                               |
| `fontWorker`      | `Worker`                                                                                                    | —                    | Decode the font in the `./stamp/font-worker` worker                                                                                                                             |
| `fontFallbackUrl` | `string`                                                                                                    | —                    | TTF/OTF used to fill characters missing from `font` (needs `harfbuzzSubsetWasmUrl`)                                                                                             |
| `layout`          | `{ gap, rowGap, columnGap, padding, offsetX, offsetY, stretch, cellHeightMode, shortColumn, variation, … }` | —                    | Glyph layout. `shortColumn: "spread"` (default) stretches a shorter column to fill; `"top"` keeps the 2.x layout. `variation` 0–2 (default 1) is per-seed hand-carved variation |
| `border`          | `{ thickness, corner, cornerRadius, roughness }`                                                            | `roughness: 0.25`    | Rim; `corner` is `"none" \| "round" \| "stone"`, `roughness` 0–1 wears the rim (heaviest at the corners)                                                                        |
| `notch`           | `{ strategy: "auto" \| "manual" \| "none", … }`                                                             | —                    | Break in the rim (留缺)                                                                                                                                                         |
| `ink`             | `{ color, density, bleed, grain, aging }`                                                                   | —                    | Seal paste colour and texture                                                                                                                                                   |
| `carving`         | `{ intensity, breakage }`                                                                                   | —                    | Knife-edge strength and chipping                                                                                                                                                |
| `pressing`        | `{ rotate, pressure, partialLoss, offset }`                                                                 | —                    | How the seal was pressed                                                                                                                                                        |

**Returns** `SealResult`: `{ svg, width, height, seed, layers }`, where `layers` holds the background, text and border markup separately.

Parsed fonts are cached per font source. Call `clearSealFontCache()` to release them.

### Stamp v1 — `generateStamp(options)` / `generateStampAsync(options)`

```typescript
import { generateStamp } from "@jobinjia/shuimo-core";

const svg = generateStamp({ text: ["受命", "于天"], type: "yang", seed: 7 });
```

| Param                 | Type                                                         | Default      | Description                                           |
| --------------------- | ------------------------------------------------------------ | ------------ | ----------------------------------------------------- |
| `text`                | `string[]`                                                   | —            | Columns, read right to left                           |
| `type`                | `"yin" \| "yang"`                                            | `"yin"`      | 阴章 / 阳章                                           |
| `shape`               | `"auto" \| "square" \| "rectangle" \| "circle" \| "ellipse"` | `"auto"`     | Outline                                               |
| `color`               | `string`                                                     | `"#C8102E"`  | Seal colour                                           |
| `fontFamily`          | `string`                                                     | —            | CSS font family                                       |
| `fontSize`            | `number`                                                     | `70`         | Font size (px); most spacing options scale with it    |
| `offsetX` / `offsetY` | `number`                                                     | `0`          | Text offset (-1 to 1)                                 |
| `noiseAmount`         | `number`                                                     | `12/70`      | Rim irregularity (× fontSize); `noiseAmountPx` for px |
| `borderPoints`        | `number`                                                     | `24/70`      | Rim point count (× fontSize)                          |
| `cornerRadius`        | `number`                                                     | `15/70`      | Corner rounding (× fontSize)                          |
| `borderWidth`         | `number`                                                     | `1/70`       | Rim width (× fontSize, yang only)                     |
| `textCarving`         | `"normal" \| "strong" \| "stone-cut"`                        | `"normal"`   | Carving style                                         |
| `seed`                | `number`                                                     | `Date.now()` | Deterministic seed                                    |

Most ratio options have an absolute `…Px` counterpart. `generateStampAsync` accepts `fontUrl` / `fontData` and measures real glyph boxes for exact centering. `measureStampText(options)` returns the layout without drawing.

### Font subsetting and `harfbuzz-subset.wasm`

`fontFallbackUrl` (stamp v2) and `subsetFontBuffer` use harfbuzz compiled to WebAssembly. Point them at `harfbuzz-subset.wasm` from the `harfbuzzjs` package (add `harfbuzzjs` to your own dependencies so your bundler can resolve it):

```typescript
import { configureFontSubsetWasm } from "@jobinjia/shuimo-core";
import harfbuzzSubsetWasmUrl from "harfbuzzjs/dist/harfbuzz-subset.wasm?url"; // Vite

configureFontSubsetWasm(harfbuzzSubsetWasmUrl);
```

[docs/font-subsetting.md](./docs/font-subsetting.md) covers the build-time subsetting scripts.

---

## Flowers (花卉)

### `generateFlowerCanvas(options)`

```typescript
import { generateFlowerCanvas } from "@jobinjia/shuimo-core";

const canvas = generateFlowerCanvas({ seed: 42, type: "herbal", width: 600, height: 600 });
const lotus = generateFlowerCanvas({ seed: 42, species: "lotus", width: 600, height: 600 });
```

| Param        | Type                              | Default    | Description                                  |
| ------------ | --------------------------------- | ---------- | -------------------------------------------- |
| `seed`       | `number \| string`                | random     | Deterministic seed                           |
| `type`       | `"woody" \| "herbal" \| "random"` | `"random"` | Plant type                                   |
| `species`    | `"lotus"`                         | —          | Dedicated species pipeline; overrides `type` |
| `width`      | `number`                          | `600`      | Canvas width                                 |
| `height`     | `number`                          | `600`      | Canvas height                                |
| `background` | `"none" \| "paper" \| string`     | `"none"`   | No background, xuan paper, or a CSS colour   |
| `fast`       | `boolean`                         | `false`    | Skip the bounds scan and rounded border      |

**Returns** `HTMLCanvasElement`.

### Four Gentlemen (四君子)

All take `(x, y, seed, options?)` and return an SVG string:

- `bamboo`, `bambooLeaves`
- `orchid`, `orchidLeaves`
- `winterPlum`, `plumBlossoms`
- `chrysanthemum`, `chrysanthemumFlower`

---

## Ink-Wash Mountains (`InkMount`)

A layered ink-wash mountain renderer (ridge generation → cunfa texture → ink wash → mist) drawn through a pluggable `RenderBackend`; `Canvas2DBackend` is included.

```typescript
import { InkMount } from "@jobinjia/shuimo-core";

const ctx = canvas.getContext("2d")!;
ctx.fillStyle = "#f3ecdc"; // InkMount does not clear a context you pass in
ctx.fillRect(0, 0, canvas.width, canvas.height);

InkMount.generate({ width: canvas.width, height: canvas.height, seed: 42, layers: 5, ctx });

// When the view goes away:
InkMount.dispose(); // release pooled canvases
```

| Option    | Type                            | Default                      | Description                                               |
| --------- | ------------------------------- | ---------------------------- | --------------------------------------------------------- |
| `width`   | `number`                        | —                            | Output width                                              |
| `height`  | `number`                        | —                            | Output height                                             |
| `seed`    | `number`                        | —                            | Deterministic seed                                        |
| `layers`  | `number`                        | `height / 120`, clamped 2–10 | Number of mountain ranges, far to near                    |
| `quality` | `"draft" \| "normal" \| "high"` | `"normal"`                   | Detail preset                                             |
| `ridge`   | `Partial<RidgeOptions>`         | —                            | `peakCount`, `sharpness`, `subRidgeCount`, `noiseOctaves` |
| `cunfa`   | `Partial<CunFaOptions>`         | —                            | `density`, `lengthRange`, `pressureCurve`                 |
| `mist`    | `Partial<MistOptions>`          | —                            | `opacity`, `frequency`, `coverage`                        |
| `ctx`     | `CanvasRenderingContext2D`      | —                            | Draw into your canvas; otherwise a canvas is created      |
| `onLayer` | `(layer, index) => void`        | —                            | Called for each generated layer                           |

**Returns** `RenderOutput`: `{ type: "canvas", canvas }` or `{ type: "imagebitmap", bitmap }`.

For custom rendering, `InkMount.generateScene(options)` returns the data (`layers`, `fills`, `strokes`, `mists`) and `InkMount.renderScene(scene, backend)` draws it with any object implementing `RenderBackend` (`clear`, `drawMountainLayer`, `drawMist`, `toOutput`). The building blocks `generateRidge`, `generateCunFaStrokes`, `generateInkFill` and `generateMist` are exported too.

---

## Xuan Paper (宣纸)

```typescript
import { xuanPaper, xuanPaperSVG } from "@jobinjia/shuimo-core";

const canvas = xuanPaper({ width: 1920, height: 1080, seed: 7, goldFlecks: true });
const svg = xuanPaperSVG({ width: 1920, height: 1080, seed: 7 });
```

Options include `baseColor`, `fiberDensity`, `fiberScale`, `textureIntensity`, `grainDensity`, `age`, `deckleEdge`, `deckleRoughness`, `goldFlecks`, `goldDensity`, `goldSize`, `goldColor`, `goldClustering` and `goldDistribution`. `XuanPaperColors` and `GoldFleckColors` hold preset colours. `XuanPaper.generateDataURL()` and `XuanPaper.createPattern()` are also available.

### Rendering in a worker

```typescript
import type {
  XuanPaperWorkerRequest,
  XuanPaperWorkerResponse,
} from "@jobinjia/shuimo-core/xuan-paper/worker-protocol";

const worker = new Worker(new URL("@jobinjia/shuimo-core/xuan-paper/worker", import.meta.url), {
  type: "module",
});

worker.onmessage = (e: MessageEvent<XuanPaperWorkerResponse>) => {
  if ("bitmap" in e.data) ctx.drawImage(e.data.bitmap, 0, 0);
  else console.error(e.data.error);
};

const request: XuanPaperWorkerRequest = { id: 1, options: { width: 1920, height: 1080, seed: 7 } };
worker.postMessage(request);
```

The response carries a transferred `ImageBitmap`. Add `tile: { x, y, width, height }` to the request to render one region, e.g. to split a large sheet across several workers.

---

## Foundation — Noise, Random, Geometry

```typescript
import {
  noise,
  prng,
  PerlinNoise,
  WorleyNoise,
  SimplexNoise,
  GaborNoise,
  fractalNoise,
} from "@jobinjia/shuimo-core/foundation";

prng.seed(42);
prng.random(); // [0, 1)

noise.noise(x, y, z); // Perlin noise [0, 1]; WASM-backed, synchronous init
noise.noiseSeed(42);
noise.reset(); // rebuild the table from the current PRNG state
fractalNoise(x, y, { octaves: 4 });
```

`WasmNoise` / `initWasmNoiseEngine()` expose the Rust engine directly for batch sampling (`perlin2dBatch`, `worley2d`, `gabor2d`). Geometry: `Vector2`, `PolyTools`, and the `Point` / `Line` / `Polygon` types.

---

## Drawing Primitives

| Function                                 | Returns    | Options                                                                                        |
| ---------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------- |
| `stroke(pts, options)`                   | SVG string | `xof`, `yof`, `wid`, `col`, `noi`, `out`, `fun`, `filter`                                      |
| `blob(x, y, options)`                    | SVG string | `len`, `wid`, `ang`, `col`, `noi`, `ret`, `fun`                                                |
| `texture(ptlist, options)`               | SVG string | `xof`, `yof`, `tex`, `wid`, `len`, `sha`, `ret`, `noi`, `col`, `dis` (皴法)                    |
| `brushStroke(pts, options)` / `brushDot` | SVG string | `width`, `color`, `pressure`, `inkStart`, `inkEnd`, `noise`, `flyingWhite`, `angle`, `texture` |
| `inkBleed(x, y, options)`                | SVG string | Ink bleeding on paper                                                                          |

## Landscape Elements

| Element   | Call                                                                                         | Notes                                                                                                     |
| --------- | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Mountains | `Mount.mountain(x, y, seed, opts)`, `Mount.flatMount`, `Mount.distMount`, `Mount.mistyMount` | Options `hei`, `wid`, `tex`, `veg`, `col`, `ret`, `layers`                                                |
| Trees     | `Tree.tree01(x, y, opts)` … `Tree.tree08`                                                    | Options `hei`, `wid`, `col`, `noi`                                                                        |
| Water     | `water(x, y, seed, opts)` / `Water.generate`                                                 | Options `hei`, `len`, `clu`                                                                               |
| Clouds    | `cloud(x, y, seed, opts)` / `Cloud.generate`                                                 | Returns a canvas; options `width`, `height`, `size`, `color`, `octaves`, `frequency`, `threshold`, `mode` |
| Others    | `Arch`, `Man`, `whale`                                                                       | Buildings, figures, whale                                                                                 |

---

## WASM

Three Rust crates live in `packages/core/wasm/`:

| Crate             | Used for                      | How it ships                                                                                     |
| ----------------- | ----------------------------- | ------------------------------------------------------------------------------------------------ |
| `shuimo-noise`    | Perlin / Worley / Gabor noise | Base64-embedded, synchronous init, no fetch                                                      |
| `xuan-paper-tone` | Xuan paper tone field         | Base64-embedded                                                                                  |
| `harfbuzz`        | Font subsetting               | Prebuilt `harfbuzz-subset.wasm`; see [Font subsetting](#font-subsetting-and-harfbuzz-subsetwasm) |

Rust and `wasm-pack` are only needed to rebuild them.

---

## Development

Requires Node >= 22 and pnpm (version pinned by `packageManager`, use corepack). Build, test, lint and format run through [vite-plus](https://github.com/voidzero-dev) (`vp`).

```bash
pnpm install
pnpm dev                # playground dev server (Vue 3, port 3000)
pnpm build              # type-check + bundle @jobinjia/shuimo-core → packages/core/dist
pnpm test -- --run      # unit tests (vitest + jsdom)
pnpm lint               # vp check (format + lint)
```

Regenerate the embedded noise WASM:

```bash
cd packages/core/wasm/shuimo-noise
wasm-pack build --target web --out-dir pkg --release
pnpm --filter @jobinjia/shuimo-core build:wasm-data
```

### Monorepo

```
packages/core/   @jobinjia/shuimo-core — the library
playground/      @shuimo/playground   — Vue 3 demo app, one page per feature
```

## License

MIT
