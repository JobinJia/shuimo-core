# Repository Guidelines

## Project Structure & Module Organization

This repository is a `pnpm` workspace centered on `packages/core` and `playground`. `packages/core/src` is the publishable TypeScript library: `foundation` holds math/noise primitives, `drawing` contains brush and flower generators, `elements` defines scene objects, `composition` handles layout logic, and `webgpu` contains GPU renderers and WGSL shaders. `playground/src` is the Vue + Vite demo app for manual verification. Keep reference material in `reference-code/`, `cloud.html`, and root guides as read-only support assets.

## Build, Test, and Development Commands

- `pnpm install`: install all workspace dependencies.
- `pnpm build`: type-check and build `@shuimo/core`.
- `pnpm build:all`: build every package under `packages/`.
- `pnpm playground`: start the local demo app.
- `pnpm build:playground`: build the library first, then the playground bundle.
- `pnpm test`: run Vitest for `@shuimo/core`.
- `pnpm lint`: run ESLint across the repo.

Use package-scoped scripts for deeper checks, for example `pnpm --filter @shuimo/core test:coverage` or `pnpm --filter @shuimo/playground preview`.

## Coding Style & Naming Conventions

Use TypeScript ES modules and keep public exports routed through local `index.ts` files. Follow existing naming patterns: `PascalCase` for classes and major primitives such as `Mount.ts`, `camelCase` for functions and helpers, and kebab-case only for non-code assets. Linting is driven by `eslint.config.ts` with `@jobinjia/eslint-config`. Do not reformat unrelated files; the codebase currently mixes semicolon styles, so match the surrounding file.

## Testing Guidelines

Vitest is configured in `packages/core/vitest.config.ts` with `jsdom` and V8 coverage reporters (`text`, `json`, `html`). There are currently no committed test files, so new behavior changes should add focused `*.test.ts` or `*.spec.ts` coverage near the changed module. Prefer deterministic tests for seeded generation, geometry helpers, and render output shape. Run `pnpm test` before opening a PR.

## Commit & Pull Request Guidelines

Recent commits use concise conventional prefixes such as `feat:`, `fix:`, and `refactor:`. Keep messages imperative and specific, for example `feat: add generate image demo`. PRs should describe scope, affected package(s), validation commands, and screenshots or GIFs for playground-visible changes. If behavior changes touch automation, mention related workflows in `.github/workflows/`.

## Security & Configuration Tips

Target Node.js `>=18` and `pnpm >=10` from the workspace config. Do not commit `dist/`, temporary experiment outputs, or bulky generated assets. Put static demo assets in `playground/public/` and keep third-party reference files clearly separated from source code.
