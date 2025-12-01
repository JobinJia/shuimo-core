# Shuimo Playground

Interactive testing environment for `@shuimo/core` library.

## 功能特性

- 🎨 **实时演示** - 即时查看各种绘画效果
- 🔄 **多种示例** - Perlin噪声、贝塞尔曲线、笔刷效果、简单山水
- 📊 **渲染引擎切换** - Canvas vs SVG（开发中）
- 💾 **导出功能** - 将生成的图像导出为PNG

## 快速开始

### 启动开发服务器

从项目根目录运行：

```bash
pnpm playground
```

或者从playground目录运行：

```bash
cd packages/playground
pnpm dev
```

浏览器会自动打开 `http://localhost:3000`

## 示例说明

### 1. Perlin 噪声
展示Perlin噪声算法生成的平滑随机纹理，常用于地形生成。

### 2. 贝塞尔曲线
演示二次和三次贝塞尔曲线的绘制，用于创建平滑的路径和形状。

### 3. 笔刷效果
使用Catmull-Rom样条和笔刷参数模拟传统绘画的笔触效果。

### 4. 简单山水
结合噪声和曲线生成基础的山水画场景，包含天空、山峦和水面。

## 目录结构

```
playground/
├── src/
│   └── main.ts          # 主要逻辑和示例代码
├── public/              # 静态资源
├── index.html           # HTML入口
├── vite.config.ts       # Vite配置
└── package.json
```

## 开发提示

- 修改 `src/main.ts` 来添加新的示例
- 所有 `@shuimo/core` 的功能都可以在这里测试
- 打开浏览器控制台查看调试信息

## 构建生产版本

```bash
pnpm build
```

构建产物会生成在 `dist/` 目录。

## 预览生产版本

```bash
pnpm preview
```
