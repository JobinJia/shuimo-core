# Changelog

All notable changes to `@jobinjia/shuimo-core`. Releases before 3.0.0 are recorded in the git history only.

## 3.0.2 — 2026-09-28

### Fixed

- The published package now contains the WebAssembly files behind the `./wasm/*` export (`harfbuzz-subset.wasm`, `shuimo_noise.js`, `shuimo_noise_bg.wasm`). Earlier releases declared the export but shipped no files.
- The npm package page has a README.

No code changes; output is identical to 3.0.1.

## 3.0.1 — 2026-09-27

### Performance

- `generateFlowerCanvas` (woody / herbal): the per-pixel filter passes now visit only inked pixels inside the content box and reuse the bounds from the previous pass instead of re-scanning the whole 1200×1200 layer. Average generation 2589 ms → 250 ms in Node. Output is pixel-identical.

## 3.0.0 — 2026-09-27

A major release: several public interfaces changed, and most generators produce different output for the same seed. See [Migrating from 2.x](#migrating-from-2x) below.

### Breaking changes

**Ink mountains (`InkMount`)**

- `RenderBackend` replaces `drawMountainFill`, `drawCunFaStrokes` and `drawRidgeLine` with a single `drawMountainLayer(layer, ink, strokes)`. Custom backends must implement it.
- `MountainLayer.silhouette: Vector2[]` is now required. `generateRidge` fills it in; hand-built layers must supply it.
- `InkFill.gradient` stops are reversed: stop 0 is now the silhouette edge and opacity falls off with the stop.
- `Canvas2DBackend.clear()` no longer clears a canvas passed in through `ctx`, so the caller's background (e.g. paper) stays underneath. Clear it yourself if you relied on the old behaviour.

**Xuan paper worker (`./xuan-paper/worker`)**

- The response is now `{ id, bitmap: ImageBitmap, tile? }` (bitmap transferred, zero-copy) instead of `{ id, blob: Blob }`. Draw it with `drawImage`, or hand it to a `bitmaprenderer` context.
- `XuanPaperWorkerRequest.options` is optional, and a `tile?: TileRegion` field renders one region of the sheet.

**Stamp v2 (`./stamp-v2`)**

- `border.roughness` defaults to `0.25` (was `0`). Pass `0` for the old clean rim.
- New `layout.shortColumn`, default `"spread"`: a column with fewer characters is stretched (up to 1.3×) to fill the height. Pass `"top"` for the 2.x layout.
- New `layout.variation` (0–2), default `1`: per-seed hand-carved variation of each glyph. Pass `0` to turn it off.

**Landscape SVG structure** (only matters if you parse the output)

- The `data-shuimo-layer="underlay"` group is gone. Water is emitted as `data-shuimo-element="water" data-shuimo-layer="base"` inside the terrain base.
- Polylines carry `class=` attributes backed by a `<style>` block instead of inline `style=`.
- Whole numbers in point lists are written without a trailing `.0`.

### Added

- `InkMount.dispose()` releases pooled scratch canvases and cached mask paths; call it when the hosting view unmounts.
- `clearSealFontCache()` and the `GlyphProbe` type in `./stamp-v2`.
- `MountPlanner.plan(…)` accepts canvas size options; used by `generatePainting` so the plan fits a fixed-size canvas.

### Changed output for the same seed

**Landscape (`generatePainting` / `generateLandscape`)**

- Water is visible: ripples sit in front of each mountain's foot instead of underneath it.
- Ink tone follows distance: five depth tiers, paler far away and darker up close.
- Mist bands in the paper colour between mountain ranges.
- On Xuan paper, the occlusion masks behind mountains use the paper tone instead of pure white, so mountains no longer look cut out of white card.
- Distant mountains are a single outline fading with a gradient instead of a triangle mesh.
- Composition fills the canvas width: no more empty right third, mountains stay on the canvas, distant ranges and foreground banks spread across the width.
- Each plan item draws from its own random stream, so hiding an element with `renderElements` no longer changes the others.

**Stamp v2** — per-seed glyph offset, tilt and warp; rim wear heaviest at the corners with occasional chips; uneven ink pressing; a wider carving edge that stays visible at small sizes.

**Xuan paper** — about 2.5× more tone contrast with dithering (no more banding); fibers are short dashes instead of long streamlines; threshold "foxing" spots replaced by smooth patina stains; the SVG version embeds a low-resolution raster plus tiled noise.

**Ink mountains** — the ridge contour and cunfa texture strokes are drawn again, following the deformed silhouette (they were disabled in 2.x); depth blur between layers; mist patches spread across each gap.

**Lotus (`generateFlowerCanvas({ species: "lotus" })`)** — the reflection repaints the same plants instead of re-rolling a different pond; leaf veins and outlines removed; ink splatter moved to the foot of the leaf cluster.

### Fixed

- The same seed produced a different landscape depending on what had been generated earlier in the process (the noise table was never rebuilt).
- Ink mountains were not deterministic (two stray `Math.random()` calls).
- 3–6 mountains per landscape were generated entirely off-canvas, and the right side of the painting was often empty.
- Worley `edgeNoise2D` divided by `cellSize` twice (differs only when `cellSize ≠ 1`).
- Stamp v2 carving edge vanished at 1× (erode radius rounded down to 0).
- Ink-mount cunfa generator mishandled non-integer seeds.

### Performance

- Stamp v2 caches parsed fonts: repeated seals no longer re-decode the font (a woff2 CJK font costs ~90 ms to decode). Use `clearSealFontCache()` to free it.
- Glyph path serialization inlined (about 20% of a seal's CPU), byte-identical output; shared with stamp v1.
- Stamp v2 SVG filter regions trimmed to what the effects actually need.
- Ink mountains reuse pooled offscreen canvases (about 7.7 MB less allocation per regeneration at 1200×800).
- Faster SVG point formatting, blob outlines, strokes and noise setup in the landscape pipeline; the xuan paper worker returns a bitmap instead of encoding a PNG.

### Migrating from 2.x

- **Custom ink-mount backend:** implement `drawMountainLayer(layer, ink, strokes)` in place of the three removed methods, and read `layer.silhouette`.
- **Ink mountains drawn onto your own canvas:** it is no longer cleared for you. Paint or clear the background before calling `InkMount.generate({ ctx })`, and call `InkMount.dispose()` when done.
- **Xuan paper worker consumers:** read `e.data.bitmap` instead of `e.data.blob`. For a data URL or Blob, draw the bitmap onto a canvas and call `convertToBlob` / `toDataURL`.
- **Keep the 2.x seal look:**

  ```ts
  generateSealAsync({
    // ...
    border: { roughness: 0 },
    layout: { shortColumn: "top", variation: 0 },
  });
  ```

- **Cached output:** anything you cached by seed (paper textures, landscape SVGs, seals) will not match 3.x output. Invalidate those caches when upgrading.
