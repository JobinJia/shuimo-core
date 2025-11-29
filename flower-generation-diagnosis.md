# 花朵生成差异诊断报告

## 问题描述
SVG 版本生成的花朵与原版 Canvas 版本**完全不同**,即使使用相同的 seed。

## 核心原因分析

### 1. 随机数消费顺序问题 🔴 **关键问题**

原版 Canvas 实现的执行流程:
```javascript
// reference-code/flowers/main.js
SEED = (`${(new Date()).getTime()}`)
Math.seed(SEED)  // Line 98 - 设置种子

// Line 1206-1212: makeBG() 调用
function makeBG() {
  setTimeout(_makeBG, 10)
  function _makeBG() {
    BGCANV = paper({ col: PAPER_COL0, tex: 10, spr: 0 })  // ⚠️ 消费 ~4096 个随机数
    // ...
  }
}

// Line 1215: generate() 调用
function generate() {
  CTX = Layer.empty()
  // ...
  let ppr = paper({ col: PAPER_COL1 })  // Line 1220 - ⚠️ 再次消费 ~4096 个随机数
  // ...
  if (Math.random() <= 0.5) {  // Line 1226 - 决定植物类型
    woody({ ctx: CTX, xof: 300, yof: 550 })
  }
  else {
    herbal({ ctx: CTX, xof: 300, yof: 600 })
  }
}

// Line 1303-1317: 初始化流程
function load() {
  makeBG()        // ⚠️ 先调用,消费随机数
  setTimeout(_load, 100)
  function _load() {
    generate()    // ⚠️ 后调用
    // ...
  }
}
```

**原版的随机数消费顺序:**
1. `Math.seed(SEED)` - 初始化 PRNG,预热消费 10 个随机数
2. `makeBG()` → `paper({ tex: 10, spr: 0 })` - 初始化 Noise (4096 次) + 生成纹理 (~数千次)
3. `generate()` → `paper({ tex: 20, spr: 1 })` - 再次消费 ~数千次随机数
4. `Math.random() <= 0.5` - 决定植物类型
5. `woody()` 或 `herbal()` → `genParams()` - 生成参数

### 2. SVG 版本的问题

当前 SVG 实现:
```typescript
// packages/core/src/drawing/Flower.ts
export function generateFlower(options: FlowerOptions = {}): SVGSVGElement {
  installGlobalPRNG()
  resetNoise()

  if (seed !== undefined) {
    seedPRNG(seed)
  }

  // 🔴 问题 1: 立即调用 createPaperPattern 来模拟 makeBG()
  // 但这会消费随机数,影响后续的植物类型决定
  createPaperPattern('temp-bg-pattern', { ... })

  // 🔴 问题 2: 如果 background === 'paper',再次调用 createPaperPattern
  // 这又消费了一批随机数

  // 🔴 问题 3: 植物类型决定时,随机数序列位置已经不同
  const randomValue = Math.random()  // ⚠️ 这个值与原版不同!
  plantType = randomValue <= 0.5 ? 'woody' : 'herbal'

  // 🔴 问题 4: genParams() 开始时,PRNG 状态已经完全偏离
  const layer = plantType === 'woody'
    ? woody({ xof: 300, yof: 550 })
    : herbal({ xof: 300, yof: 600 })
}
```

### 3. Noise 初始化问题

原版:
```javascript
// Noise 是惰性初始化的
this.noise = function (x, y, z) {
  if (perlin == null) {  // ⚠️ 第一次调用时才初始化
    perlin = Array.from({ length: PERLIN_SIZE + 1 })
    for (let i = 0; i < PERLIN_SIZE + 1; i++) {
      perlin[i] = Math.random()  // 消费 4096 次
    }
  }
  // ...
}
```

SVG 版本:
```typescript
// FlowerNoise.ts
noise(x: number, y: number = 0, z: number = 0): number {
  if (this.perlin == null) {  // ⚠️ 同样是惰性初始化
    this.perlin = Array.from({ length: this.PERLIN_SIZE + 1 })
    for (let i = 0; i < this.PERLIN_SIZE + 1; i++) {
      this.perlin[i] = Math.random()  // 消费 4096 次
    }
  }
  // ...
}
```

问题:虽然逻辑相同,但调用时机不同!

### 4. paper() 函数的随机数消费

原版 `paper()` 函数:
```javascript
function paper(args) {
  let reso = 512
  for (let i = 0; i < reso / 2 + 1; i++) {
    for (let j = 0; j < reso / 2 + 1; j++) {
      let c = (255 - Noise.noise(i * 0.1, j * 0.1) * tex * 0.5)
      c -= Math.random() * tex  // ⚠️ 每个像素消费 1 次
      // ...
      if (Noise.noise(...) * Math.random() * spr > 0.7
        || Math.random() < 0.005 * spr) {  // ⚠️ 每个像素再消费 1-2 次
        // ...
      }
    }
  }
}
```

计算:
- `reso / 2 + 1 = 257`
- 循环次数: `257 * 257 = 66,049` 次
- 每次循环可能消费 2-3 个随机数
- 总消费: **约 130,000 - 200,000 次随机数调用**

加上 Noise 初始化的 4096 次,第一次调用 `paper()` 消费约 **134,096 - 204,096** 次随机数!

## 问题总结

| 步骤 | 原版顺序 | SVG 版本顺序 | 随机数消费 |
|------|----------|--------------|-----------|
| 1. 设置种子 | `Math.seed(SEED)` | `seedPRNG(seed)` | 10 次预热 |
| 2. 背景纹理 | `makeBG()` → `paper()` | `createPaperPattern('temp-bg')` | ~134,096 次 |
| 3. 前景纸张 | `paper()` 在 generate() | `createPaperPattern()` (可选) | ~134,096 次 |
| 4. 决定类型 | `Math.random() <= 0.5` | `Math.random() <= 0.5` | 1 次 |
| 5. 生成参数 | `genParams()` | `genParams()` | ~50-100 次 |

**关键差异:**
- SVG 版本在决定植物类型前,已经消费了不同数量的随机数
- `resetNoise()` 的时机可能导致 Noise 初始化在不同位置
- 背景生成的调用顺序和次数不完全匹配

## 解决方案

需要做到:
1. **完全匹配原版的调用顺序**
2. **确保每个步骤消费相同数量的随机数**
3. **植物类型决定时,PRNG 必须在完全相同的状态**

### 推荐修复步骤:

1. 去除所有"模拟"代码,直接按原版顺序执行
2. 确保 `paper()` 在相同时机被调用相同次数
3. 添加详细的随机数消费计数器用于调试
4. 验证每个关键点的 PRNG 状态是否匹配

## 验证方法

在原版和 SVG 版本中,在关键点添加日志:
```javascript
console.log('After seed:', [Math.random(), Math.random(), Math.random()])
// 然后重新设置种子
Math.seed(SEED)

console.log('After makeBG:', [Math.random(), Math.random(), Math.random()])
Math.seed(SEED)
// ... 依此类推
```

如果所有关键点的随机数序列都匹配,生成的花朵才会相同。
