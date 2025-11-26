# Shuimo Core 使用示例

## 基础示例

### 1. 使用 PRNG (伪随机数生成器)

```typescript
import { PRNG, overrideMathRandom } from '@shuimo/core';

// 创建 PRNG 实例
const prng = new PRNG();

// 设置种子以获得可重现的结果
prng.seed(12345);

// 生成随机数
const random1 = prng.next(); // 0 到 1 之间的随机数
const random2 = prng.next();

// 可选：覆盖全局 Math.random
overrideMathRandom();
Math.random(); // 现在使用我们的 PRNG
```

### 2. 使用 Perlin Noise (柏林噪声)

```typescript
import { PerlinNoise } from '@shuimo/core';

const noise = new PerlinNoise();

// 设置噪声种子
noise.noiseSeed(12345);

// 生成噪声值
const value1 = noise.noise(1.5, 2.3);        // 2D 噪声
const value2 = noise.noise(1.5, 2.3, 0.5);  // 3D 噪声

// 配置噪声细节
noise.noiseDetail(6, 0.6); // 6 个八度，衰减系数 0.6
```

### 3. 多边形工具

```typescript
import { PolyTools, type Polygon } from '@shuimo/core';

// 计算中点
const midpoint = PolyTools.midPt([10, 20], [30, 40]);
// 结果: [20, 30]

// 三角剖分
const polygon: Polygon = [
  [0, 0],
  [100, 0],
  [100, 100],
  [50, 150],
  [0, 100]
];

const triangles = PolyTools.triangulate(polygon, {
  area: 100,      // 最大三角形面积
  optimize: true  // 优化三角形质量
});
```

### 4. 绘制笔触 (Stroke)

```typescript
import { Stroke, type Polygon } from '@shuimo/core';

// 定义路径
const path: Polygon = [
  [10, 100],
  [50, 80],
  [90, 100],
  [130, 120]
];

// 生成笔触 SVG
const strokeSVG = Stroke.generate(path, {
  wid: 3,                              // 宽度
  col: 'rgba(0, 0, 0, 0.8)',          // 颜色
  noi: 0.5,                            // 噪声量 (0-1)
  fun: (x) => Math.sin(x * Math.PI),  // 宽度函数
});

// 或使用便捷函数
import { stroke } from '@shuimo/core';
const svg = stroke(path, { wid: 3 });
```

### 5. 绘制墨点 (Blob)

```typescript
import { Blob } from '@shuimo/core';

// 生成墨点
const blobSVG = Blob.generate(100, 100, {
  len: 30,                    // 长度
  wid: 15,                    // 宽度
  ang: Math.PI / 4,          // 旋转角度
  col: 'rgba(0, 0, 0, 0.7)', // 颜色
  noi: 0.8,                  // 噪声量
});

// 获取点数组而非 SVG
const points = Blob.generate(100, 100, {
  len: 30,
  wid: 15,
  ret: 1  // 返回点数组
}) as Polygon;
```

### 6. 绘制水面 (Water)

```typescript
import { Water } from '@shuimo/core';

// 生成水面波纹
const waterSVG = Water.generate(0, 200, 12345, {
  hei: 3,     // 波幅
  len: 800,   // 长度
  clu: 15,    // 波浪簇数量
});
```

### 7. 工具函数

```typescript
import {
  distance,
  mapval,
  randChoice,
  randGaussian,
  bezmh,
  poly
} from '@shuimo/core';

// 计算距离
const dist = distance([0, 0], [3, 4]); // 5

// 值域映射
const mapped = mapval(5, 0, 10, 0, 100); // 50

// 随机选择
const choice = randChoice([1, 2, 3, 4, 5]);

// 高斯分布随机数 (-1 到 1)
const gaussian = randGaussian();

// 贝塞尔曲线
const controlPoints = [[0, 0], [50, 100], [100, 0]];
const curve = bezmh(controlPoints, 1.0);

// 生成 SVG 多边形
const svgPoly = poly(curve, {
  fil: 'rgba(255, 0, 0, 0.5)',
  str: 'black',
  wid: 2
});
```

## 完整示例：绘制简单山水画

```typescript
import {
  overrideMathRandom,
  prng,
  Water,
  stroke,
  blob,
  PolyTools,
  bezmh
} from '@shuimo/core';

// 初始化随机数生成器
overrideMathRandom();
prng.seed(12345);

// 创建 SVG 容器
let svg = '<svg width="800" height="600" xmlns="http://www.w3.org/2000/svg">';
svg += '<rect width="800" height="600" fill="white"/>';

// 绘制远山轮廓
const mountainPath = bezmh([
  [50, 300],
  [200, 200],
  [350, 250],
  [500, 180],
  [650, 230],
  [750, 280]
]);
svg += stroke(mountainPath, {
  wid: 2,
  col: 'rgba(100, 100, 100, 0.3)',
  noi: 0.5
});

// 添加一些树木（用墨点表示）
for (let i = 0; i < 10; i++) {
  const x = 100 + Math.random() * 600;
  const y = 280 + Math.random() * 50;
  svg += blob(x, y, {
    len: 15 + Math.random() * 20,
    wid: 8 + Math.random() * 10,
    ang: Math.random() * Math.PI * 2,
    col: 'rgba(100, 100, 100, 0.6)',
    noi: 0.7
  });
}

// 绘制水面
svg += Water.generate(0, 450, 12345, {
  hei: 2,
  len: 800,
  clu: 12
});

// 关闭 SVG
svg += '</svg>';

// 输出或保存 SVG
console.log(svg);
// 或者在浏览器中: document.body.innerHTML = svg;
```

## TypeScript 类型支持

所有函数都有完整的 TypeScript 类型定义：

```typescript
import type {
  Point,
  Line,
  Polygon,
  TriangulateOptions,
  StrokeOptions,
  BlobOptions,
  WaterOptions,
  PolyOptions
} from '@shuimo/core';

// 使用类型
const myPolygon: Polygon = [[0, 0], [10, 0], [10, 10]];
const options: StrokeOptions = {
  wid: 3,
  col: 'black',
  noi: 0.5
};
```

## 注意事项

1. **坐标系统**: 使用 SVG 坐标系统 (左上角为原点，Y 轴向下)
2. **随机性**: 使用相同的种子可以生成相同的结果
3. **性能**: 复杂的多边形和高分辨率会影响性能
4. **浏览器兼容**: 需要支持 ES6+ 的现代浏览器

## 更多示例

更多高级示例请参考：
- `packages/playground/` - 交互式示例
- `reference-code/shanshui.html` - 原始实现参考
