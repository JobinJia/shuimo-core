# @jobinjia/shuimo-core

Procedural Chinese ink painting (水墨画) in TypeScript: landscape paintings (山水画), ink-wash mountains, flower paintings and seal stamps (印章). Output is SVG strings or Canvas 2D; noise and xuan paper tone run in Rust/WebAssembly. Every generator is seeded.

- Full documentation: [github.com/JobinJia/shuimo-core](https://github.com/JobinJia/shuimo-core#readme)
- Changes and migration notes: [CHANGELOG.md](https://github.com/JobinJia/shuimo-core/blob/main/CHANGELOG.md)

## Install

```bash
pnpm add @jobinjia/shuimo-core
```

ESM-only.

## Examples

Landscape painting:

```typescript
import { generateLandscape } from "@jobinjia/shuimo-core";

const { svg } = generateLandscape({ width: 1600, height: 800, seed: 42 });
document.body.innerHTML = svg;
```

Seal stamp (bring your own seal-script font):

```typescript
import { generateSealAsync } from "@jobinjia/shuimo-core/stamp-v2";

const seal = await generateSealAsync({
  text: ["受命", "于天"],
  size: 240,
  mode: "yin",
  shape: { kind: "rect" },
  seed: 7,
  font: "/fonts/seal-script.woff2",
});
```

Flower and lotus:

```typescript
import { generateFlowerCanvas } from "@jobinjia/shuimo-core";

document.body.append(generateFlowerCanvas({ seed: 42, species: "lotus" }));
```

Ink-wash mountains:

```typescript
import { InkMount } from "@jobinjia/shuimo-core";

InkMount.generate({ width: 1200, height: 800, seed: 42, ctx: canvas.getContext("2d")! });
```

Xuan paper:

```typescript
import { xuanPaper } from "@jobinjia/shuimo-core";

document.body.append(xuanPaper({ width: 1920, height: 1080, seed: 7 }));
```

## Entry points

`@jobinjia/shuimo-core`, `/foundation`, `/drawing`, `/elements`, `/stamp-v2`, `/xuan-paper/worker`, `/xuan-paper/worker-protocol`, `/stamp/font-worker`, `/stamp/font-worker-protocol`.

## License

MIT
