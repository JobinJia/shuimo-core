# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Shuimo-core is a TypeScript library for procedural Chinese ink painting (水墨画) generation: landscape paintings (山水画), flower-bird paintings (花鸟画), and seal stamps (印章). Output targets are SVG strings and Canvas 2D. Hot paths (noise, paper tone) run in Rust compiled to WebAssembly.

Based on [shan-shui-inf](https://github.com/LingDong-/shan-shui-inf) and [nonflowers](https://github.com/LingDong-/nonflowers) by Lingdong Huang. `reference-code/` holds the original sources and is read-only.

## Toolchain

The repo uses **vite-plus** (`vp`) for build, test, lint and format — not plain `vite`/`vitest`/`eslint`/`tsdown`.

- Format + lint: `vp check` (root `vite.config.ts` holds `fmt`/`lint` options)
- Build core: `tsc --noEmit && vp pack` (entries in `packages/core/vite.config.ts` under `pack.entry`)
- Test: `vp test` (vitest config is inline in `packages/core/vite.config.ts` under `test`; jsdom, globals on, v8 coverage). There is no `vitest.config.ts`.
- `vite`, `vite-plus`, `vitest` resolve through the pnpm `catalog:` in `pnpm-workspace.yaml` to `@voidzero-dev` builds. Do not change the catalog entries.

## Commands

```bash
pnpm install              # pnpm version from the packageManager field (corepack), Node >= 22
pnpm dev                  # playground dev server (Vue 3 + vp dev, port 3000) — never auto-start
pnpm build                # type-check + bundle @jobinjia/shuimo-core → packages/core/dist
pnpm build:playground     # build core, then the playground (playground prod mode imports core from dist)
pnpm test                 # vp test for core (watch mode); pass `-- --run` for single-run
pnpm lint                 # vp check (fmt + lint)
pnpm release              # bumpp both package.json files, build, publish to npm
pnpm deploy:prod          # scripts/deploy-prod.sh: vercel deploy + re-alias shuimo-core.vercel.app
```

Core-scoped (`pnpm --filter @jobinjia/shuimo-core <script>` or run from `packages/core/`):

```bash
pnpm --filter @jobinjia/shuimo-core exec vp test --run src/composition/MountPlanner.test.ts   # single test file
pnpm --filter @jobinjia/shuimo-core test:coverage
pnpm --filter @jobinjia/shuimo-core test:ui
pnpm --filter @jobinjia/shuimo-core bench            # *.bench.ts (e.g. stampV2/stamp-v1-vs-v2.bench.ts)
pnpm --filter @jobinjia/shuimo-core build:wasm-data  # re-embed shuimo-noise .wasm as base64 TS
pnpm --filter @jobinjia/shuimo-core build:copy-wasm  # copy .wasm files to dist/wasm (not part of `build`)
```

CI (`.github/workflows/ci.yml`): `vp check` runs with `continue-on-error` because it SIGABRTs on CI runners; tests + build run on Node 22 and 24 via `pnpm test -- --run` and `pnpm build`.

## Monorepo

pnpm workspaces: `packages/*`, `playground`, `examples/*`.

| Path            | Package                 | Notes                                                                 |
| --------------- | ----------------------- | --------------------------------------------------------------------- |
| `packages/core` | `@jobinjia/shuimo-core` | The library. ESM-only (`.mjs` / `.d.mts`), `uuid` is never bundled     |
| `playground`    | `@shuimo/playground`    | Vue 3 + Vue Router demo, one `src/demos/*.vue` per feature            |

**Playground aliasing** (`playground/vite.config.ts`): in dev mode `@jobinjia/shuimo-core` and `/stamp-v2` resolve to `packages/core/src/**` directly, so no core build is needed to see changes; in production mode they resolve to `packages/core/dist/*.mjs`. `@jobinjia/shuimo-core/wasm/*` resolves to `packages/core/wasm/harfbuzz/` in both modes.

### Public entry points

All map 1:1 to `pack.entry` in `packages/core/vite.config.ts` and `exports` in `packages/core/package.json`:

| Import path                     | Source                                                    |
| ------------------------------- | --------------------------------------------------------- |
| `.`                             | `src/index.ts` (re-exports foundation, utils, drawing, elements, composition) |
| `./foundation`                  | `src/foundation/index.ts`                                 |
| `./drawing`                     | `src/drawing/index.ts`                                    |
| `./elements`                    | `src/elements/index.ts`                                   |
| `./stamp-v2`                    | `src/drawing/stampV2/index.ts` (not re-exported from `.`) |
| `./xuan-paper/worker`           | `src/elements/natural/xuan-paper/worker.ts`               |
| `./xuan-paper/worker-protocol`  | `src/elements/natural/xuan-paper/worker-protocol.ts`      |
| `./stamp/font-worker`           | `src/drawing/internal/glyphFontWorker.ts`                 |
| `./stamp/font-worker-protocol`  | `src/drawing/internal/glyphFontWorker-protocol.ts`        |
| `./wasm/*`                      | `dist/wasm/*` (populated only by `build:copy-wasm`)       |

Adding a new entry point means editing both `pack.entry` and `exports`, plus the playground alias list if the playground should import it from source.

## Architecture (`packages/core/src/`)

Layered bottom-up; each layer imports only from layers below it. Public API is routed through each directory's `index.ts` barrel.

- **`foundation/`** — `random/` (seeded PRNG), `noise/` (Perlin, Simplex, Worley, Gabor, Fractal, plus `WasmPerlinNoise` / `wasm-noise.ts` backed by the embedded WASM engine), `geometry/` (Vector2, PolyTools).
- **`utils/`** — svg string helpers, math, bezier, random helpers.
- **`drawing/`** — rendering primitives and self-contained subsystems:
  - Stroke, Blob, Brush, Texture (皴法), InkBleed, FlowerCanvas, Goldfish, loading animations (`ShuimoLoading`, `LoadingCalligraphy`).
  - **Stamp v1**: `Stamp.ts` + `StampCanvas.ts` + `StampMetrics.ts` + `StampNoise.ts` + `StampWasm.ts`.
  - **Stamp v2**: `stampV2/` (`seal.ts` pipeline; `text/`, `layout/`, `geometry/`, `border/`, `texture/`, `render/`). v1 and v2 coexist and are both supported; `docs/stamp-v2-vs-v1.md` is the feature matrix. Both share `internal/fontSubset.ts` (harfbuzz subsetting) and the glyph-font worker channel (`internal/glyphFontWorker*.ts`, main-thread side in `internal/glyphFontClient.ts`).
  - **`ink-mount/`** — the newer ink-wash mountain system (RidgeGenerator → CunFaEngine → InkWashLayer → MistLayer, rendered through a pluggable `RenderBackend`, `Canvas2DBackend` provided). Distinct from the legacy SVG `elements/natural/Mount.ts`.
  - **`species/lotus/`** — canvas lotus, split into per-part modules (petal, leaf, stem, bud, water, splatter…).
- **`elements/`** — high-level painting components. `natural/`: Mount, Tree (tree01–tree08), Water, Cloud, Whale, XuanPaper (`xuan-paper/` has model / svg-renderer / canvas-renderer / presets / worker), and the Four Gentlemen (Bamboo, Orchid, Chrysanthemum, `winter-plum/` per-part modules). `objects/`: Arch, Man.
- **`composition/`** — `PaintingGenerator` (`generatePainting` / `generateLandscape`; `PaintingType` is currently `"landscape"` only — flower-bird elements are composed by the caller), `SceneManager` (chunk-based layout), `MountPlanner` (mountain placement).
- **`renderer/`** — empty placeholder.

### Workers

Two off-main-thread pipelines follow the same pattern: a `worker.ts` entry, a `*-protocol.ts` file with request/response types (`{ id, ... }` correlated messages), and a main-thread client that posts requests and resolves by id. Consumers construct the `Worker` themselves (`new Worker(new URL('@jobinjia/shuimo-core/stamp/font-worker', import.meta.url), { type: 'module' })`) and pass it in; the library never spawns workers on its own.

### WASM

Three Rust crates under `packages/core/wasm/` (Rust + `wasm-pack` needed only to rebuild; `pkg/` output for shuimo-noise is committed):

| Crate             | How it ships                                                                                   |
| ----------------- | ---------------------------------------------------------------------------------------------- |
| `shuimo-noise`    | Base64 in `src/foundation/noise/wasm-noise-data.ts`, sync init. Regenerate: `wasm-pack build --target web --out-dir pkg --release` in the crate dir, then `pnpm build:wasm-data`. |
| `xuan-paper-tone` | Base64 inline in `src/elements/natural/xuan-paper/paper-tone-wasm.ts`.                        |
| `harfbuzz`        | Prebuilt `harfbuzz-subset.wasm`, served as a file via the `./wasm/*` export; consumers pass its URL through `harfbuzzSubsetWasmUrl` / `configureFontSubsetWasm`. |

Rust-side caveat: `f64 as i32` saturates in Rust while JS `ToInt32` wraps, so seeds derived from large numbers (e.g. `Date.now()`) must be reduced before crossing the boundary.

## TypeScript

Root `tsconfig.json` is `strict: true` with `noUncheckedIndexedAccess` / `noUnusedLocals` / `noUnusedParameters`, but **`packages/core/tsconfig.json` overrides to `strict: false` and disables all three**. Core is type-checked against the permissive config; `*.test.ts` files are excluded from `tsc`. Target ES2020, `moduleResolution: bundler`, `@webgpu/types` included.

## Key Patterns

- **SVG is string-built**, not DOM-built. Canvas paths draw directly on the `CanvasRenderingContext2D` passed in.
- **Seeded randomness everywhere**: same seed → identical output. New generators must take a seed / PRNG, never call `Math.random`.
- **Options objects with defaults** for every generator; both a class (`Stamp`, `Cloud`) and a lowercase convenience function (`stamp`, `cloud`) are usually exported.
- **Visual parameters scale with output size** in stamp-v2 (`internal/visualScale.ts`, reference size 480) — do not hardcode pixel constants there.
- Tests are colocated `*.test.ts` next to the module; benches are `*.bench.ts`.

## Design docs

`docs/superpowers/specs/` and `docs/superpowers/plans/` hold dated design specs and implementation plans (ink-mount, lotus, winter-plum, font subsetting). Read the matching spec before changing an element's look — they list reference images and explicit out-of-scope items. `docs/font-subsetting.md` documents the stamp font subsetting scripts in `packages/core/scripts/`.

## Constraints

- 不要构建额外的用于测试的文件，删得麻烦。。Tests are minimal colocated `*.test.ts`; no scratch demo files in the repo.
- Never auto-start dev servers (`pnpm dev`, `test:ui`, etc.).
- `reference-code/`, `cloud.html`, `stamp.md`, `USAGE_EXAMPLES.md` are reference material, read-only.
- Do not commit `dist/` or bulky generated assets; `wasm/*/target/` is gitignored.
- Commit messages: conventional prefix with scope (`feat(core):`, `fix(stamp-v2):`, `chore(deps):`, `test(stamp-v2):`), imperative, lowercase, no trailing period.
