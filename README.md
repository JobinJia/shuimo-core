# shuimo-core (水墨核心库)

Procedural Chinese ink painting (水墨画) generation in TypeScript. Generates traditional landscape paintings (山水画), flower-bird paintings (花鸟画), and seal stamps (印章) using generative algorithms. Outputs to SVG, Canvas, and WebGPU.

WASM-accelerated noise engine (Rust → WebAssembly) for 3-5× faster Perlin/Worley/Gabor computation.

## Based on

- [shan-shui-inf](https://github.com/LingDong-/shan-shui-inf) by Lingdong Huang
- [nonflowers](https://github.com/LingDong-/nonflowers) by Lingdong Huang

## Quick Start

```bash
pnpm add @jobinjia/shuimo-core
```

```typescript
import { generateLandscape } from '@jobinjia/shuimo-core';

const { svg } = generateLandscape({ seed: 42 });
document.body.innerHTML = svg;
```

## Entry Points

| Entry | Import | Description |
|---|---|---|
| `.` | `@jobinjia/shuimo-core` | Everything |
| `./foundation` | `@jobinjia/shuimo-core/foundation` | PRNG, noise, geometry |
| `./drawing` | `@jobinjia/shuimo-core/drawing` | Stroke, brush, stamp, flower, texture |
| `./elements` | `@jobinjia/shuimo-core/elements` | Mountains, trees, water, clouds, bamboo |

---

## API Reference

### Composition — Landscape & Flower-Bird Painting

#### `generatePainting(options)`

One-call painting generator.

```typescript
import { generatePainting } from '@jobinjia/shuimo-core';
```

| Param | Type | Default | Description |
|---|---|---|---|
| `type` | `"landscape" \| "flowerBird"` | — | Painting type |
| `width` | `number` | `3000` | Canvas width (px) |
| `height` | `number` | `800` | Canvas height (px) |
| `seed` | `number` | random | Deterministic seed |
| `onXuanPaper` | `boolean` | `true` | Xuan paper (宣纸) background |
| `transparent` | `boolean` | `false` | Omit multiply blend mode |
| `blankPosition` | `"topLeft" \| "top" \| ... \| "none"` | — | Blank space (留白) position |
| `detail` | `number` | `1` | Ink texture multiplier |
| `flowerType` | `"woody" \| "herbal" \| "random"` | `"random"` | Flower type (flowerBird) |

**Returns** `{ svg: string, width: number, height: number, seed: number }`

#### `generateLandscape(options)` / `generateFlowerBird(options)`

Shorthand for `generatePainting({ type: "landscape", ... })`.

---

### Stamp (印章)

#### `generateStamp(options)`

```typescript
import { generateStamp } from '@jobinjia/shuimo-core';
```

| Param | Type | Default | Description |
|---|---|---|---|
| `text` | `string[]` | — | Text lines (right-to-left vertical columns) |
| `type` | `"yin" \| "yang"` | `"yang"` | Yin (红底白字) / Yang (白底红字) |
| `shape` | `"auto" \| "square" \| "rectangle" \| "circle" \| "ellipse"` | `"auto"` | Border shape |
| `color` | `string` | `"#C8102E"` | Ink color |
| `fontSize` | `number` | `70` | Font size (px) |
| `fontFamily` | `string` | `"serif"` | Font family |
| `fontWeight` | `string \| number` | `"normal"` | Font weight |
| `offsetX` / `offsetY` | `number` | `0` | Text offset (-1 to 1) |
| `noiseAmount` | `number` | `0.15` | Border distortion (× fontSize) |
| `noiseAmountPx` | `number` | — | Absolute noise (px, overrides ratio) |
| `borderPoints` | `number` | `0.4` | Edge point count (× fontSize) |
| `cornerRadius` | `number` | `15/70` | Corner rounding (× fontSize) |
| `borderScale` / `borderScaleX` / `borderScaleY` | `number` | `1.0` | Border scale |
| `borderWidth` | `number` | `4` | Border stroke width (yang only) |
| `textCarving` | `"normal" \| "strong" \| "stone-cut"` | `"normal"` | Carving effect |
| `seed` | `number` | `Date.now()` | Deterministic seed |

**Returns** SVG string.

#### `generateStampAsync(options)`

Async variant — measures glyph bounding boxes for pixel-perfect centering. Same options plus `fontUrl`.

**Returns** `Promise<string>` (SVG).

#### `measureStampText(options)`

Measure text layout without generating the stamp.

**Returns** `StampTextMetrics` (column widths, heights, bounding boxes).

---

### Flower (花鸟)

#### `generateFlower(options)`

```typescript
import { generateFlower } from '@jobinjia/shuimo-core';
```

| Param | Type | Default | Description |
|---|---|---|---|
| `seed` | `number \| string` | random | Deterministic seed |
| `type` | `"woody" \| "herbal" \| "random"` | `"random"` | Plant type |
| `width` | `number` | `600` | SVG width |
| `height` | `number` | `600` | SVG height |
| `background` | `"none" \| "paper" \| string` | `"none"` | Background |
| `fast` | `boolean` | `false` | Skip getBBox() — 5× faster |

**Returns** `SVGSVGElement`

#### `generateFlowerCanvas(options)`

Canvas-based flower. Same options + `background`.

**Returns** `HTMLCanvasElement`

---

### Foundation — Noise, Random, Geometry

#### Noise

```typescript
import { noise, PerlinNoise, WorleyNoise, fractalNoise } from '@jobinjia/shuimo-core/foundation';
```

- `noise.noise(x, y, z?)` — Perlin noise `[0, 1]`
- `noise.reset()` — force table reinit from current PRNG state
- `noise.noiseSeed(seed)` — seed for reproducibility
- `noise.noiseDetail(octaves, falloff)` — configure detail
- `fractalNoise(x, y, opts)` — fBm noise (multi-octave)

#### WASM Noise (`WasmNoise`)

```typescript
import { initWasmNoiseEngine, WasmNoise } from '@jobinjia/shuimo-core/foundation';

await initWasmNoiseEngine(); // load WASM module
const wn = new WasmNoise({ perlinSeed: 1234 });
wn.perlin2d(x, y);                          // single sample
wn.perlin2dBatch(xs, ys, out);             // batch Float64Array
wn.worley2d(x, y);                          // Voronoi noise
wn.gabor2d(seed, x, y, kernelRadius);       // fiber texture
```

**Note:** The global `noise` instance is already WASM-backed (sync init, no async required). `WasmNoise` is for explicit batch-mode usage.

#### PRNG

```typescript
import { prng } from '@jobinjia/shuimo-core/foundation';
prng.seed(42);
prng.random(); // [0, 1)
```

#### Geometry

- `Vector2` — 2D vector math
- `PolyTools` — polygon triangulation, transforms
- Types: `Point`, `Line`, `Polygon`

---

### Drawing — Primitives

#### `stroke(pts, options)`

Variable-width line rendering.

| Param | Type | Default | Description |
|---|---|---|---|
| `pts` | `Polygon` | — | Control points |
| `col` | `string` | `"black"` | Color |
| `wid` | `number \| (x: number) => number` | `1.5` | Width (constant or function) |
| `noi` | `number` | `1` | Noise amount |
| `xof` / `yof` | `number` | `0` | Offset |

**Returns** SVG `<polyline>` string.

#### `blob(pts, options)`

Ink splatter. Options: `xof`, `yof`, `col`, `ang`, `wid`, `noi`.

#### `brushStroke(pts, options)` / `brushDot(x, y, options)`

Calligraphy brush simulation. Options: `width`, `color`, `pressure`, `inkStart`, `inkEnd`, `noise`, `flyingWhite`, `angle`, `texture`.

#### `texture(ptlist, options)`

Surface texture (皴法 techniques).

| Param | Type | Default | Description |
|---|---|---|---|
| `ptlist` | `Polygon[]` | — | Surface layers |
| `tex` | `number` | `200` | Stroke count |
| `wid` | `number` | `1.5` | Stroke width |
| `sha` | `number` | `0` | Shadow width (0 = off) |
| `col` | `(progress, depth) => string` | gray | Color function |
| `xof` / `yof` | `number` | `0` | Offset |

**Returns** SVG string.

---

### Elements — Natural Scenery

#### `Mount` — Mountains

```typescript
import { Mount } from '@jobinjia/shuimo-core/elements';
```

- `Mount.mountain(x, y, seed, options)` — rounded mountain
- `Mount.flatMount(x, y, seed, options)` — flat-topped mountain
- `Mount.distMount(x, y, seed, options)` — distant triangulated mountain
- `Mount.mistyMount(x, y, seed, options)` — mist-shrouded mountain

Options: `hei`, `wid`, `tex` (texture detail), `veg` (vegetation), `col`.

#### `Tree`

- `Tree.tree01(x, y, options)` through `Tree.tree08(x, y, options)`
- 8 distinct tree styles (simple → fractal → triangulated)
- Options: `hei`, `wid`, `col`, `noi`

#### `Water`

```typescript
Water.generate(xoff, yoff, seed, options)
```

Options: `hei`, `wid`, `clu` (cluster count), `len`.

#### `Cloud`

```typescript
Cloud.generate(xoff, yoff, seed, options)
// or convenience: cloud(xoff, yoff, seed, options)
```

Options: `width`, `height`, `size`, `color`, `octaves` (default 4), `frequency`, `threshold`, `mode` (`"particles"` | `"continuous"`), `seed`.

**Returns** `HTMLCanvasElement`.

#### Four Gentlemen (四君子)

- `Bamboo` — `bamboo(x, y, options)`, `bambooLeaves(x, y, options)`
- `Orchid` — `orchid(x, y, options)`, `orchidLeaves(x, y, options)`
- `WinterPlum` — `winterPlum(x, y, options)`, `plumBlossoms(x, y, options)`
- `Chrysanthemum` — `chrysanthemum(x, y, options)`, `chrysanthemumFlower(x, y, options)`

All accept `SeedOptions` (seed + derived noise/random).

#### Xuan Paper (宣纸)

```typescript
import { xuanPaper, xuanPaperSVG } from '@jobinjia/shuimo-core/elements';
```

Generates paper background with fiber texture, aging, and optional gold flecks.

---

## WASM Acceleration

The noise engine is implemented in Rust and compiled to WebAssembly:

```
wasm/shuimo-noise/  (70 KB)
├── perlin.rs        — 4-octave Perlin with LUT cosine optimization
├── worley.rs        — Worley/Voronoi noise
├── gabor.rs         — Anisotropic Gabor fiber texture
├── stamp.rs         — Stamp border path generation
└── lib.rs           — wasm-bindgen batch API
```

Build: `cd wasm/shuimo-noise && wasm-pack build --target web --out-dir pkg --release`

The WASM binary is embedded as base64 in the noise chunk (sync init, zero fetch overhead).

---

## Development

### Prerequisites

- Node.js >= 18
- pnpm >= 8
- Rust + wasm-pack (for WASM rebuilds)

### Install

```bash
pnpm install
```

### Commands

```bash
pnpm build          # Type-check + bundle
pnpm test           # Run all tests (vitest + jsdom)
pnpm lint           # ESLint + formatting check
pnpm dev            # Watch mode
pnpm playground     # Start playground dev server (port 3000)
```

### Regenerate WASM

```bash
cd packages/core/wasm/shuimo-noise
wasm-pack build --target web --out-dir pkg --release
node ../../scripts/encode-wasm.mjs   # update base64 data
```

### Monorepo Structure

```
packages/core/     — @jobinjia/shuimo-core (the library)
playground/        — @jobinjia/shuimo-playground (Vue 3 demo app)
```

## License

MIT
