# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Shuimo-core is a TypeScript library for procedural Chinese ink painting (水墨画) generation. It produces traditional landscape paintings (山水画) and flower-bird paintings (花鸟画) using generative algorithms, rendering to SVG, Canvas, and WebGPU.

Based on: [shanshui](https://github.com/LingDong-/shan-shui-inf) and [nonflowers](https://github.com/LingDong-/nonflowers).

## Commands

```bash
pnpm install          # Install dependencies
pnpm build            # Type-check (tsc --noEmit) + bundle core with tsdown
pnpm test             # Run vitest for core package
pnpm lint             # ESLint across all packages
pnpm playground       # Start playground dev server (Vue 3 + Vite, port 3000)
```

Core package scripts (run from `packages/core/`):
```bash
pnpm test:ui          # Vitest interactive UI
pnpm test:coverage    # Vitest with v8 coverage
```

## Monorepo Structure

pnpm workspaces with two packages:
- **`packages/core`** (`@shuimo/core`) — the library, ESM-only, bundled with tsdown
- **`playground`** (`@shuimo/playground`) — Vue 3 + Vue Router demo app consuming the core

Core exports four entry points: `.` (everything), `./foundation`, `./elements`, `./drawing`.

## Architecture

Layered bottom-up design — each layer builds on the one below:

**Foundation** (`foundation/`) — Primitives: seeded PRNG, noise generators (Perlin, Simplex, Worley), geometry (Vector2, PolyTools for polygon triangulation/transforms).

**Drawing** (`drawing/`) — Rendering primitives: Stroke (variable-width lines), Blob (ink splatters), Brush (calligraphy simulation with pressure), Texture (皴法 techniques), Stamp (seal generation), Flower/FlowerCanvas (procedural flowers).

**Elements** (`elements/`) — High-level painting components. Natural: Mount (multiple mountain variants), Tree, Water, Cloud, Bamboo, Orchid, Chrysanthemum, WinterPlum, XuanPaper. Objects: Arch, Man.

**Composition** (`composition/`) — Scene orchestration: PaintingGenerator (unified API — `generatePainting()`, `generateLandscape()`, `generateFlowerBird()`), SceneManager (chunk-based scene layout), MountPlanner (mountain placement).

**WebGPU** (`webgpu/`) — GPU-accelerated rendering: ShuimoEngine, per-element renderers (StrokeRenderer, MountRenderer, TreeRenderer, etc.).

**Experimental** (`experimental/`) — Stroke animation (trajectory estimation, brush footprint generation, animation playback). Exported as `Experimental` namespace.

## Key Patterns

- **SVG generation**: String-based SVG construction, not DOM-based
- **Seeded randomness**: PRNG ensures reproducible outputs for the same seed
- **Options objects**: Most APIs accept an options object with sensible defaults
- **Strict TypeScript**: `strict: true`, target ES2020, module resolution `bundler`
- **ESLint**: Uses `@jobinjia/eslint-config`

## Important Constraints

- 不要构建额外的用于测试的文件，删得麻烦。。
- Never auto-start dev servers
