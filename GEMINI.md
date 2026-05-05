# GEMINI.md - Shuimo Core (水墨核心库)

This document provides architectural context, development guidelines, and operational procedures for the `shuimo-core` project.

## Project Overview

`shuimo-core` is a high-performance TypeScript library for procedural Chinese landscape (山水) and flower-bird (花鸟) painting generation. It translates traditional ink painting aesthetics into digital formats (SVG, Canvas, WebGPU) using generative algorithms.

### Key Technologies

- **Language:** TypeScript (Strict mode)
- **Build Tool:** `vite-plus` / `vite` / `tsdown`
- **Package Manager:** `pnpm` (Monorepo)
- **Frameworks:** Vue 3 (Playground)
- **Testing:** Vitest (jsdom environment)
- **Rendering:** SVG (String-based), Canvas, WebGPU

## Architecture

The project follows a layered bottom-up design:

### 1. Foundation (`packages/core/src/foundation`)

- Basic building blocks: Seeded PRNG, noise generators (Perlin, Simplex, Worley).
- Geometry: `Vector2`, `PolyTools` (triangulation, transforms).

### 2. Drawing (`packages/core/src/drawing`)

- Rendering primitives: `Stroke` (variable-width), `Blob` (splatters), `Brush` (calligraphy simulation).
- Techniques: `Texture` (皴法 - CunFa), `Stamp` (seal generation), `Flower/FlowerCanvas`.

### 3. Elements (`packages/core/src/elements`)

- High-level components:
  - **Natural:** `Mount` (multiple mountain variants), `Tree`, `Water`, `Cloud`, `Bamboo`, `Orchid`, `Chrysanthemum`, `WinterPlum`, `XuanPaper`.
  - **Objects:** `Arch`, `Man`.

### 4. Composition (`packages/core/src/composition`)

- Scene orchestration: `PaintingGenerator` (`generateLandscape`, `generateFlowerBird`), `SceneManager`, `MountPlanner`.

### 5. WebGPU & Experimental

- **WebGPU:** GPU-accelerated rendering engine and per-element renderers.
- **Experimental:** Stroke animation and trajectory estimation.

## Project Structure

- `packages/core/`: The main library (`@jobinjia/shuimo-core`).
- `playground/`: A Vue 3 + Vite interactive demo application (`@shuimo/playground`).
- `docs/`: Design specifications and plans.
- `reference-code/`: Original algorithms and reference implementations.

## Building and Running

### Root Commands

- `pnpm install`: Install all dependencies.
- `pnpm dev`: Start the playground in development mode.
- `pnpm build`: Build the core library.
- `pnpm build:all`: Build all packages in the monorepo.
- `pnpm test`: Run tests for the core library.
- `pnpm lint`: Run linting/checking across the project.

### Core Package Commands (`packages/core`)

- `pnpm build`: Type-check and bundle.
- `pnpm test:ui`: Start Vitest interactive UI.
- `pnpm test:coverage`: Run tests with coverage reporting.
- `pnpm generate:font-metrics`: Update font metrics for stamps.

## Development Conventions

- **SVG Generation:** Use string-based SVG construction for performance (avoiding direct DOM manipulation).
- **Seeded Randomness:** Always use the provided PRNG/random utilities to ensure reproducible artwork from a given seed.
- **API Design:** Prefer options objects for parameters with sensible defaults.
- **ESM-Only:** The library targets ESM (`.mjs`).
- **Strict Typing:** Maintain strict TypeScript standards; avoid `any` and unnecessary casts.
- **No Side Effects:** Core library modules should be side-effect free for better tree-shaking.

## Constraints

- **Performance:** Keep the library lightweight; avoid heavy dependencies in `packages/core`.
- **Reproducibility:** Every generated piece should be recreatable via its seed and configuration.
- **Stability:** Before committing, ensure `pnpm test` and `pnpm lint` (vp check) pass.
