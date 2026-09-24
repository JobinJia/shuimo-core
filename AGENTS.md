# Repository Guidelines

Procedural Chinese ink painting (水墨画) library: landscapes (山水画), flower-bird paintings (花鸟画), seal stamps (印章). Output targets are SVG strings and Canvas 2D; hot paths (noise, paper tone) run in Rust compiled to WebAssembly. Based on shan-shui-inf / nonflowers by Lingdong Huang — originals live in `reference-code/` (read-only).

## Toolchain

This repo uses **vite-plus** (`vp`) for building, testing, linting, and formatting — not plain `vite`/`vitest`/`eslint`. All configuration is in `vite.config.ts` files.

- **Format + lint**: `vp check` (not `eslint`). Root `vite.config.ts` controls this.
- **Build core**: `tsc --noEmit && vp pack` (not `tsdown` or `tsup`). Entries live in `packages/core/vite.config.ts` under `pack.entry`; `uuid` is never bundled.
- **Test**: `vp test` (not `vitest` directly). Vitest config lives inline in `packages/core/vite.config.ts` under `defineConfig({ test: {...} })` — there is no separate `vitest.config.ts`.
- **Dev server**: `vp dev`.

Workspace deps use a `catalog:` — `vite`, `vite-plus`, and `vitest` resolve to `@voidzero-dev` packages. Do not change the catalog entries.

## Commands

```bash
pnpm install              # pnpm per root packageManager field (corepack), Node >= 22
pnpm dev                  # start playground dev server (Vue 3 + Vite, port 3000) — never auto-start
pnpm build                # type-check + bundle @jobinjia/shuimo-core
pnpm build:watch          # watch-mode rebuild of core
pnpm build:all            # build all packages under packages/
pnpm build:playground     # build core then playground (playground prod imports core from dist)
pnpm test                 # run vitest for core (watch mode; pass -- --run for CI/single-run)
pnpm lint                 # alias for `vp check` (fmt + lint)
pnpm release              # bumpp both package.json files, build, publish to npm
pnpm deploy:prod          # scripts/deploy-prod.sh: vercel deploy + re-alias
```

Package-scoped variants:

```bash
pnpm --filter @jobinjia/shuimo-core test:coverage
pnpm --filter @jobinjia/shuimo-core test:ui
pnpm --filter @jobinjia/shuimo-core bench            # *.bench.ts (e.g. stampV2/stamp-v1-vs-v2.bench.ts)
pnpm --filter @jobinjia/shuimo-core build:wasm-data  # re-embed shuimo-noise .wasm as base64 TS
pnpm --filter @jobinjia/shuimo-core build:copy-wasm  # copy .wasm files to dist/wasm (not part of `build`)
pnpm --filter @shuimo/playground build
```

Run a single test file:

```bash
pnpm --filter @jobinjia/shuimo-core exec vp test --run src/composition/MountPlanner.test.ts
```

CI (`.github/workflows/ci.yml`): `vp check` runs with `continue-on-error` (known SIGABRT on CI runners); tests + build run on Node 22 and 24 via `pnpm test -- --run` and `pnpm build`.

## Monorepo Structure (pnpm workspace)

Workspace globs: `packages/*`, `playground`, `examples/*` (examples dir not yet created).

| Path            | Package name            | Purpose                                               |
| --------------- | ----------------------- | ----------------------------------------------------- |
| `packages/core` | `@jobinjia/shuimo-core` | The library. ESM-only (`.mjs`), multiple entry points |
| `playground`    | `@shuimo/playground`    | Vue 3 + Vue Router demo app, one `src/demos/*.vue` per feature |

Core exports (1:1 with `pack.entry` + `exports` in `packages/core/package.json`): `.` (everything), `./foundation`, `./elements`, `./drawing`, `./stamp-v2` (not re-exported from `.`), `./xuan-paper/worker`, `./xuan-paper/worker-protocol`, `./stamp/font-worker`, `./stamp/font-worker-protocol`, `./wasm/*` (populated only by `build:copy-wasm`). Adding an entry point means editing both `pack.entry` and `exports`, plus the playground alias list if the playground should import it from source.

**Playground aliasing** (`playground/vite.config.ts`): dev mode resolves `@jobinjia/shuimo-core` and `/stamp-v2` to `packages/core/src/**` directly (no core build needed to see changes); prod mode resolves to `packages/core/dist/*.mjs`. `@jobinjia/shuimo-core/wasm/*` resolves to `packages/core/wasm/harfbuzz/` in both modes.

## Architecture

Layered bottom-up in `packages/core/src/`; each layer imports only from layers below. Public API routes through each directory's `index.ts` barrel.

| Directory      | Role                                                                                       |
| -------------- | ------------------------------------------------------------------------------------------ |
| `foundation/`  | `random/` seeded PRNG, `noise/` (Perlin, Simplex, Worley, Gabor, Fractal + WASM-backed `WasmPerlinNoise`), `geometry/` (Vector2, PolyTools) |
| `utils/`       | SVG string helpers, math, bezier curves, random utilities                                   |
| `drawing/`     | Primitives (Stroke, Blob, Brush, Texture 皴法, InkBleed) + subsystems: **stamp v1** (`Stamp*` family), **stamp v2** (`stampV2/`: seal pipeline with `text/`, `layout/`, `geometry/`, `border/`, `texture/`, `render/`), **`ink-mount/`** (ink-wash mountain system: RidgeGenerator → CunFaEngine → InkWashLayer → MistLayer over a pluggable `RenderBackend`; distinct from legacy SVG `elements/natural/Mount.ts`), **`species/lotus/`** (canvas lotus, per-part modules), plus FlowerCanvas, Goldfish, loading animations (`ShuimoLoading`, `LoadingCalligraphy`) |
| `elements/`    | High-level components. `natural/`: Mount, Tree (tree01–tree08), Water, Cloud, Whale, XuanPaper (`xuan-paper/` model/renderers/presets/worker), Bamboo, Orchid, Chrysanthemum, `winter-plum/`. `objects/`: Arch, Man |
| `composition/` | PaintingGenerator (`generatePainting` / `generateLandscape`; `PaintingType` is `"landscape"` only — flower-bird is composed by the caller), SceneManager (chunk-based layout), MountPlanner |
| `renderer/`    | (currently empty)                                                                          |

Stamp v1 and v2 coexist and are both supported; `docs/stamp-v2-vs-v1.md` is the feature matrix. Both share `internal/fontSubset.ts` (harfbuzz subsetting) and the glyph-font worker channel (`internal/glyphFontWorker*.ts` + `internal/glyphFontClient.ts`).

### Workers

Two off-main-thread pipelines (xuan-paper, stamp font) follow one pattern: a `worker.ts` entry, a `*-protocol.ts` with `{ id, ... }`-correlated request/response types, and a main-thread client resolving by id. **The library never spawns workers itself** — consumers construct the `Worker` and pass it in.

### WASM (`packages/core/wasm/`)

Three Rust crates (Rust + `wasm-pack` needed only to rebuild; shuimo-noise `pkg/` output is committed, `*/target/` gitignored):

- `shuimo-noise` — base64-embedded in `src/foundation/noise/wasm-noise-data.ts`, sync init. Rebuild: `wasm-pack build --target web --out-dir pkg --release`, then `pnpm build:wasm-data`.
- `xuan-paper-tone` — base64 inline in `src/elements/natural/xuan-paper/paper-tone-wasm.ts`.
- `harfbuzz` — prebuilt `harfbuzz-subset.wasm` served via `./wasm/*`; consumers pass its URL (`harfbuzzSubsetWasmUrl` / `configureFontSubsetWasm`).

Rust caveat: `f64 as i32` saturates in Rust while JS `ToInt32` wraps — reduce large seeds (e.g. `Date.now()`) before crossing the boundary.

## TypeScript Quirks

- Root `tsconfig.json` has `strict: true`, but **`packages/core/tsconfig.json` overrides it with `strict: false`** and also disables `noUncheckedIndexedAccess`, `noUnusedLocals`, `noUnusedParameters`. The permissive config is what core builds against; `*.test.ts` files are excluded from `tsc`.
- Target: ES2020, module: ESNext, moduleResolution: bundler.
- Core `tsconfig` includes `@webgpu/types` for WebGPU shader code.

## Key Patterns

- **SVG**: String-based generation, not DOM. Canvas paths draw directly on the passed `CanvasRenderingContext2D`.
- **Seeded randomness**: All generation uses a PRNG seeded from the painting config. New generators must take a seed/PRNG and never call `Math.random` — same seed → identical output.
- **Options objects**: Most constructors and generators accept an options object with defaults; usually both a class (`Stamp`, `Cloud`) and a lowercase convenience function (`stamp`, `cloud`) are exported.
- **Visual parameters scale with output size** in stamp-v2 (`internal/visualScale.ts`, reference size 480) — do not hardcode pixel constants there.
- **ESM only**: Output is `.mjs` / `.d.mts`. No CJS.
- **Public exports** route through `index.ts` barrel files in each directory.
- Tests are colocated `*.test.ts` next to the module; benches are `*.bench.ts`.

## Design Docs

`docs/superpowers/specs/` and `docs/superpowers/plans/` hold dated design specs and implementation plans (ink-mount, lotus, winter-plum, font subsetting). **Read the matching spec before changing an element's look** — they list reference images and out-of-scope items. `docs/font-subsetting.md` documents the stamp font subsetting scripts in `packages/core/scripts/`; `docs/stamp-v2-vs-v1.md` is the stamp v1/v2 feature matrix.

## Constraints

- **Never auto-start dev servers** (playground, test UI, etc.) without asking.
- **Do not create extra test scaffolding files.** Tests are minimal colocated `*.test.ts`; no scratch demo files in the repo.
- `vp check` is known to SIGABRT on CI runners — the CI workflow uses `continue-on-error: true` for the check step.
- Reference material in `reference-code/`, `cloud.html`, `stamp.md`, `USAGE_EXAMPLES.md`, and root guides is read-only. (`docs/` is maintained project documentation — read the specs there before changing an element's look.)
- Do not commit `dist/`, temporary experiment outputs, or bulky generated assets; `wasm/*/target/` is gitignored.
- Commit messages: conventional prefix **with scope** (`feat(core):`, `fix(stamp-v2):`, `chore(deps):`, `test(stamp-v2):`), imperative, lowercase, no trailing period.
