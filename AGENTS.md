# Repository Guidelines

## Toolchain

This repo uses **vite-plus** (`vp`) for building, testing, linting, and formatting — not plain `vite`/`vitest`/`eslint`. All configuration is in `vite.config.ts` files.

- **Format + lint**: `vp check` (not `eslint`). Root `vite.config.ts` controls this.
- **Build core**: `tsc --noEmit && vp pack` (not `tsdown` or `tsup`).
- **Test**: `vp test` (not `vitest` directly). Vitest config lives inline in `packages/core/vite.config.ts` under `defineConfig({ test: {...} })` — there is no separate `vitest.config.ts`.
- **Dev server**: `vp dev`.

Workspace deps use a `catalog:` — `vite`, `vite-plus`, and `vitest` resolve to `@voidzero-dev` packages. Do not change the catalog entries.

## Commands

```bash
pnpm install              # install all workspace deps (pnpm@10.33.0 required)
pnpm dev                  # start playground dev server (Vue 3 + Vite)
pnpm build                # type-check + bundle @jobinjia/shuimo-core
pnpm build:all            # build all packages under packages/
pnpm build:playground     # build core then playground
pnpm test                 # run vitest for core (pass -- --run for CI/single-run)
pnpm lint                 # alias for `vp check` (fmt + lint)
```

Package-scoped variants:

```bash
pnpm --filter @jobinjia/shuimo-core test:coverage
pnpm --filter @jobinjia/shuimo-core test:ui
pnpm --filter @shuimo/playground build
```

Run a single test file:

```bash
pnpm --filter @jobinjia/shuimo-core exec vp test -- --run path/to/file.test.ts
```

## Monorepo Structure (pnpm workspace)

| Path            | Package name            | Purpose                                               |
| --------------- | ----------------------- | ----------------------------------------------------- |
| `packages/core` | `@jobinjia/shuimo-core` | The library. ESM-only (`.mjs`), multiple entry points |
| `playground`    | `@shuimo/playground`    | Vue 3 + Vue Router demo app                           |

Core exports: `.` (everything), `./foundation`, `./elements`, `./drawing`, `./xuan-paper/worker`, `./xuan-paper/worker-protocol`.

## Architecture

Layered bottom-up in `packages/core/src/`:

| Directory      | Role                                                                                       |
| -------------- | ------------------------------------------------------------------------------------------ |
| `foundation/`  | Seeded PRNG, noise generators (Perlin, Simplex, Worley), Vector2, PolyTools                |
| `utils/`       | SVG helpers, math, bezier curves, random utilities                                         |
| `drawing/`     | Stroke, Blob, Brush, Texture (皴法), Stamp, Flower/FlowerCanvas                            |
| `elements/`    | Mount, Tree, Water, Cloud, Bamboo, Orchid, Chrysanthemum, WinterPlum, XuanPaper, Arch, Man |
| `composition/` | PaintingGenerator (`generateLandscape`, `generateFlowerBird`), SceneManager, MountPlanner  |
| `renderer/`    | (currently empty)                                                                          |

## TypeScript Quirks

- Root `tsconfig.json` has `strict: true`, but **`packages/core/tsconfig.json` overrides it with `strict: false`** and also disables `noUncheckedIndexedAccess`, `noUnusedLocals`, `noUnusedParameters`. The permissive config is what core builds against.
- Target: ES2020, module: ESNext, moduleResolution: bundler.
- Core `tsconfig` includes `@webgpu/types` for WebGPU shader code.

## Key Patterns

- **SVG**: String-based generation, not DOM. Export SVG markup strings.
- **Seeded randomness**: All generation uses a PRNG seeded from the painting config. Outputs are reproducible for the same seed.
- **Options objects**: Most constructors and generators accept an options object with defaults.
- **ESM only**: Output is `.mjs` / `.d.mts`. No CJS.
- **Public exports** route through `index.ts` barrel files in each directory.

## Constraints

- **Never auto-start dev servers** (playground, test UI, etc.) without asking.
- **Do not create extra test scaffolding files.** Tests should be minimal `*.test.ts` or `*.spec.ts` placed near the module being tested.
- `vp check` is known to SIGABRT on CI runners — the CI workflow uses `continue-on-error: true` for the check step.
- Reference material in `reference-code/`, `cloud.html`, root guides, and `docs/` is read-only.
- Do not commit `dist/`, temporary experiment outputs, or bulky generated assets.
- Use conventional commit prefixes (`feat:`, `fix:`, `refactor:`). Keep messages imperative.
