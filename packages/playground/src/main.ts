/**
 * Shuimo Playground - Main Entry
 *
 * Interactive testing environment for @shuimo/core
 */

import {
  CanvasRenderer,
  PerlinNoise,
  quadraticBezier,
  cubicBezier,
  catmullRomSpline,
  randomRange,
  randomGaussian,
  Mountain,
  Tree,
  Water,
  RenderContext,
  ColorSchemeType,
  COLOR_SCHEMES,
  TreeType,
  SeasonType,
  WaterType,
  InfiniteScene,
  type Vec2,
  type IRenderer
} from '@shuimo/core';

// Get DOM elements
const canvas = document.getElementById('canvas') as HTMLCanvasElement;
const rendererTypeSelect = document.getElementById('renderer-type') as HTMLSelectElement;
const demoInfiniteBtn = document.getElementById('demo-infinite') as HTMLButtonElement;
const demoShanshuiBtn = document.getElementById('demo-shanshui') as HTMLButtonElement;
const demoNoiseBtn = document.getElementById('demo-noise') as HTMLButtonElement;
const demoBezierBtn = document.getElementById('demo-bezier') as HTMLButtonElement;
const demoBrushBtn = document.getElementById('demo-brush') as HTMLButtonElement;
const demoLandscapeBtn = document.getElementById('demo-landscape') as HTMLButtonElement;
const demoMountainBtn = document.getElementById('demo-mountain') as HTMLButtonElement;
const demoTreeBtn = document.getElementById('demo-tree') as HTMLButtonElement;
const demoWaterBtn = document.getElementById('demo-water') as HTMLButtonElement;
const scrollLeftBtn = document.getElementById('scroll-left') as HTMLButtonElement;
const scrollRightBtn = document.getElementById('scroll-right') as HTMLButtonElement;
const scrollResetBtn = document.getElementById('scroll-reset') as HTMLButtonElement;
const clearBtn = document.getElementById('clear') as HTMLButtonElement;
const exportBtn = document.getElementById('export') as HTMLButtonElement;

// Initialize renderer
let renderer: IRenderer = new CanvasRenderer(canvas);

// Infinite scene instance (global)
let infiniteScene: InfiniteScene | null = null;

// Update renderer when type changes
rendererTypeSelect.addEventListener('change', () => {
  const type = rendererTypeSelect.value;
  if (type === 'canvas') {
    renderer = new CanvasRenderer(canvas);
  } else {
    // SVG renderer would require different DOM element
    alert('SVG renderer requires different setup - coming soon!');
  }
  renderer.clear();
  infiniteScene = null; // Reset infinite scene when changing renderer
});

/**
 * Demo -1: Infinite Scrolling Shanshui (无限滚动山水)
 * Uses InfiniteScene for chunk-based infinite scrolling landscape
 */
function demoInfiniteScroll() {
  renderer.clear();

  const width = canvas.width;
  const height = canvas.height;

  console.log('[Playground] Initializing InfiniteScene...');

  // Create infinite scene
  infiniteScene = new InfiniteScene({
    width,
    height,
    chunkWidth: 512,
    seed: Date.now(),
    planner: {
      sampleRate: 0.03,
      xStep: 5,
      mountainWidth: 200,
      enableDistantMounts: true,
      distantMountInterval: 1000,
      enableFlatMounts: false, // Disable for now (not implemented yet)
      flatMountProbability: 0.01,
      enableBoats: false, // Disable for now (not implemented yet)
      boatProbability: 0.2,
      enableTrees: false, // Disable for now to focus on mountains
    },
  });

  // Initial render
  renderInfiniteScene();

  console.log('✓ Infinite Scrolling Shanshui initialized');
  console.log('  Use ◀ 向左 / 向右 ▶ buttons to scroll');

  const stats = infiniteScene.getStats();
  console.log(`  Loaded chunks: ${stats.chunkCount}`);
  console.log(`  X range: ${stats.xmin} to ${stats.xmax}`);
}

/**
 * Render the current infinite scene
 */
function renderInfiniteScene() {
  if (!infiniteScene) {
    console.warn('[Playground] No infinite scene to render');
    return;
  }

  renderer.clear();

  // Draw sky gradient background
  const width = canvas.width;
  const height = canvas.height;

  for (let y = 0; y < height * 0.6; y += 4) {
    const t = y / (height * 0.6);
    renderer.drawPolygon(
      [
        { x: 0, y },
        { x: width, y },
        { x: width, y: y + 4 },
        { x: 0, y: y + 4 }
      ],
      {
        fillColor: {
          r: Math.floor(235 - t * 25),
          g: Math.floor(245 - t * 30),
          b: Math.floor(250 - t * 20),
          a: 1
        },
        strokeColor: undefined
      }
    );
  }

  // Render infinite scene
  const context = new RenderContext(renderer);
  infiniteScene.render(context);

  const stats = infiniteScene.getStats();
  console.log(`[Render] Chunks: ${stats.chunkCount}, Viewport: ${stats.viewport.x}`);
}

/**
 * Scroll infinite scene left
 */
function scrollInfiniteLeft() {
  if (!infiniteScene) {
    alert('请先启动"无限滚动山水"演示!');
    return;
  }

  const viewport = infiniteScene.getViewport();
  infiniteScene.setViewportX(viewport.x - 200);
  renderInfiniteScene();
}

/**
 * Scroll infinite scene right
 */
function scrollInfiniteRight() {
  if (!infiniteScene) {
    alert('请先启动"无限滚动山水"演示!');
    return;
  }

  const viewport = infiniteScene.getViewport();
  infiniteScene.setViewportX(viewport.x + 200);
  renderInfiniteScene();
}

/**
 * Reset infinite scene viewport
 */
function scrollInfiniteReset() {
  if (!infiniteScene) {
    alert('请先启动"无限滚动山水"演示!');
    return;
  }

  infiniteScene.setViewportX(0);
  renderInfiniteScene();
}

/**
 * Demo 0: Complete Shanshui Painting (完整山水画)
 * Combines Mountain, Tree, and Water elements into a traditional Chinese landscape
 */
function demoCompleteShanshui() {
  infiniteScene = null; // Clear infinite scene when switching demos
  renderer.clear();

  const width = canvas.width;
  const height = canvas.height;
  const context = new RenderContext(renderer);

  // 1. Sky gradient (天空渐变)
  for (let y = 0; y < height * 0.6; y += 4) {
    const t = y / (height * 0.6);
    renderer.drawPolygon(
      [
        { x: 0, y },
        { x: width, y },
        { x: width, y: y + 4 },
        { x: 0, y: y + 4 }
      ],
      {
        fillColor: {
          r: Math.floor(235 - t * 25),
          g: Math.floor(245 - t * 30),
          b: Math.floor(250 - t * 20),
          a: 1
        },
        strokeColor: undefined
      }
    );
  }

  // 2. Distant mountains (远山 - 蓝色雾气)
  const distantMountain = new Mountain({
    position: { x: 0, y: height * 0.55 },
    width: width,
    height: height * 0.25,
    layerCount: 3,
    complexity: 0.5,
    seed: 11111,
    colorScheme: {
      type: ColorSchemeType.BLUE_MIST,
      ...COLOR_SCHEMES[ColorSchemeType.BLUE_MIST]
    }
  });
  distantMountain.render(context);

  // 3. Mid-ground mountains (中景山 - 传统墨色)
  const midMountain = new Mountain({
    position: { x: width * 0.2, y: height * 0.45 },
    width: width * 0.6,
    height: height * 0.35,
    layerCount: 4,
    complexity: 0.7,
    seed: 22222,
    colorScheme: {
      type: ColorSchemeType.TRADITIONAL_INK,
      ...COLOR_SCHEMES[ColorSchemeType.TRADITIONAL_INK]
    }
  });
  midMountain.render(context);

  // 4. Trees on the shore (岸边的树木)
  // Left pine tree (左侧松树)
  const leftPine = new Tree({
    position: { x: 100, y: height * 0.78 },
    height: 180,
    treeType: TreeType.PINE,
    season: SeasonType.SUMMER,
    seed: 33333,
    branchWidth: 6
  });
  leftPine.render(context);

  // Center willow tree (中间柳树)
  const centerWillow = new Tree({
    position: { x: width * 0.65, y: height * 0.75 },
    height: 200,
    treeType: TreeType.WILLOW,
    season: SeasonType.SPRING,
    seed: 44444,
    branchWidth: 5
  });
  centerWillow.render(context);

  // Right maple tree (右侧枫树)
  const rightMaple = new Tree({
    position: { x: width * 0.85, y: height * 0.78 },
    height: 160,
    treeType: TreeType.MAPLE,
    season: SeasonType.AUTUMN,
    seed: 55555,
    branchWidth: 6
  });
  rightMaple.render(context);

  // 5. Water (水面)
  const water = new Water({
    position: { x: 0, y: height * 0.8 },
    width: width,
    waterType: WaterType.STILL,
    waveCount: 3,
    waveAmplitude: 6,
    seed: 66666
  });
  water.render(context);

  // 6. Foreground rocks/ground (前景地面)
  const groundColor = { r: 90, g: 75, b: 60, a: 0.6 };
  renderer.drawPolygon(
    [
      { x: 0, y: height * 0.75 },
      { x: 150, y: height * 0.78 },
      { x: 200, y: height * 0.82 },
      { x: 0, y: height * 0.85 }
    ],
    {
      fillColor: groundColor,
      strokeColor: undefined
    }
  );

  renderer.drawPolygon(
    [
      { x: width * 0.6, y: height * 0.76 },
      { x: width * 0.9, y: height * 0.78 },
      { x: width, y: height * 0.8 },
      { x: width, y: height * 0.82 },
      { x: width * 0.7, y: height * 0.85 }
    ],
    {
      fillColor: groundColor,
      strokeColor: undefined
    }
  );

  console.log('✓ Complete Shanshui painting rendered');
}

/**
 * Demo 1: Perlin Noise Visualization
 */
function demoPerlinNoise() {
  renderer.clear();

  const noise = new PerlinNoise(Date.now());
  const width = canvas.width;
  const height = canvas.height;
  const scale = 0.01;

  // Draw noise field as grayscale rectangles
  const cellSize = 4;
  for (let x = 0; x < width; x += cellSize) {
    for (let y = 0; y < height; y += cellSize) {
      const noiseValue = noise.noise2D(x * scale, y * scale);
      const brightness = Math.floor((noiseValue + 1) * 127.5); // Map [-1,1] to [0,255]

      renderer.drawPolygon(
        [
          { x, y },
          { x: x + cellSize, y },
          { x: x + cellSize, y: y + cellSize },
          { x, y: y + cellSize }
        ],
        {
          fillColor: { r: brightness, g: brightness, b: brightness, a: 1 },
          strokeColor: undefined
        }
      );
    }
  }

  console.log('✓ Perlin Noise demo rendered');
}

/**
 * Demo 2: Bézier Curves
 */
function demoBezierCurves() {
  renderer.clear();

  const width = canvas.width;
  const height = canvas.height;

  // Draw multiple quadratic Bézier curves
  for (let i = 0; i < 5; i++) {
    const y = (height / 6) * (i + 1);
    const p0: Vec2 = { x: 50, y };
    const p1: Vec2 = { x: width / 2, y: y + randomRange(-100, 100) };
    const p2: Vec2 = { x: width - 50, y };

    const points: Vec2[] = [];
    for (let t = 0; t <= 1; t += 0.02) {
      points.push(quadraticBezier(p0, p1, p2, t));
    }

    renderer.drawPath(points, {
      strokeColor: { r: 70 + i * 30, g: 130, b: 180, a: 0.8 },
      strokeWidth: 2,
      lineCap: 'round'
    });

    // Draw control points
    renderer.drawCircle(p0, 4, { fillColor: { r: 255, g: 100, b: 100, a: 1 } });
    renderer.drawCircle(p1, 4, { fillColor: { r: 100, g: 255, b: 100, a: 1 } });
    renderer.drawCircle(p2, 4, { fillColor: { r: 255, g: 100, b: 100, a: 1 } });
  }

  // Draw a cubic Bézier curve
  const p0: Vec2 = { x: 100, y: height - 100 };
  const p1: Vec2 = { x: 300, y: height - 300 };
  const p2: Vec2 = { x: 500, y: height - 300 };
  const p3: Vec2 = { x: 700, y: height - 100 };

  const cubicPoints: Vec2[] = [];
  for (let t = 0; t <= 1; t += 0.01) {
    cubicPoints.push(cubicBezier(p0, p1, p2, p3, t));
  }

  renderer.drawPath(cubicPoints, {
    strokeColor: { r: 255, g: 100, b: 100, a: 0.9 },
    strokeWidth: 3,
    lineCap: 'round'
  });

  console.log('✓ Bézier Curves demo rendered');
}

/**
 * Demo 3: Brush Strokes
 */
function demoBrushStrokes() {
  renderer.clear();

  const width = canvas.width;
  const height = canvas.height;

  // Create smooth strokes using Catmull-Rom spline
  for (let i = 0; i < 8; i++) {
    const controlPoints: Vec2[] = [];
    const numPoints = 5 + Math.floor(Math.random() * 5);

    for (let j = 0; j < numPoints; j++) {
      controlPoints.push({
        x: (width / numPoints) * j + randomGaussian(0, 30),
        y: height / 2 + randomGaussian(0, 150)
      });
    }

    const smoothPoints = catmullRomSpline(controlPoints, 0, 20);

    renderer.stroke(smoothPoints, {
      strokeColor: {
        r: 20 + randomRange(0, 60),
        g: 20 + randomRange(0, 60),
        b: 20 + randomRange(0, 60),
        a: 0.3 + Math.random() * 0.3
      },
      strokeWidth: 1 + Math.random() * 4,
      lineCap: 'round',
      lineJoin: 'round'
    }, {
      pressure: 0.5 + Math.random() * 0.5,
      wetness: Math.random()
    });
  }

  console.log('✓ Brush Strokes demo rendered');
}

/**
 * Demo 4: Simple Landscape
 */
function demoSimpleLandscape() {
  renderer.clear();

  const width = canvas.width;
  const height = canvas.height;
  const noise = new PerlinNoise(Date.now());

  // Sky gradient (using small rectangles)
  for (let y = 0; y < height / 2; y += 4) {
    const t = y / (height / 2);
    renderer.drawPolygon(
      [
        { x: 0, y },
        { x: width, y },
        { x: width, y: y + 4 },
        { x: 0, y: y + 4 }
      ],
      {
        fillColor: {
          r: Math.floor(200 + t * 55),
          g: Math.floor(220 + t * 35),
          b: Math.floor(240 + t * 15),
          a: 1
        },
        strokeColor: undefined
      }
    );
  }

  // Mountains (multiple layers)
  const layers = [
    { yBase: height * 0.7, color: { r: 80, g: 100, b: 120 }, opacity: 0.3 },
    { yBase: height * 0.75, color: { r: 60, g: 80, b: 100 }, opacity: 0.5 },
    { yBase: height * 0.8, color: { r: 40, g: 60, b: 80 }, opacity: 0.8 }
  ];

  layers.forEach((layer, layerIndex) => {
    const points: Vec2[] = [];
    points.push({ x: 0, y: height });

    for (let x = 0; x <= width; x += 20) {
      const noiseValue = noise.noise2D(x * 0.003, layerIndex);
      const y = layer.yBase + noiseValue * 100 - layerIndex * 20;
      points.push({ x, y });
    }

    points.push({ x: width, y: height });

    renderer.drawPolygon(points, {
      fillColor: { ...layer.color, a: layer.opacity },
      strokeColor: undefined
    });
  });

  // Water (bottom part with slight waves)
  const waterPoints: Vec2[] = [];
  waterPoints.push({ x: 0, y: height });

  for (let x = 0; x <= width; x += 10) {
    const noiseValue = noise.noise2D(x * 0.01, 100);
    const y = height * 0.85 + noiseValue * 5;
    waterPoints.push({ x, y });
  }

  waterPoints.push({ x: width, y: height });

  renderer.drawPolygon(waterPoints, {
    fillColor: { r: 180, g: 200, b: 220, a: 0.5 },
    strokeColor: undefined
  });

  console.log('✓ Simple Landscape demo rendered');
}

/**
 * Demo 5: Mountain Element
 */
function demoMountainElement() {
  renderer.clear();

  const width = canvas.width;
  const height = canvas.height;

  // Background mountain with blue mist
  const bgMountain = new Mountain({
    position: { x: 0, y: height * 0.6 },
    width: width,
    height: height * 0.4,
    layerCount: 3,
    complexity: 0.6,
    seed: 12345,
    colorScheme: {
      type: ColorSchemeType.BLUE_MIST,
      ...COLOR_SCHEMES[ColorSchemeType.BLUE_MIST]
    }
  });

  // Foreground mountain with traditional ink
  const fgMountain = new Mountain({
    position: { x: 0, y: height * 0.3 },
    width: width * 0.6,
    height: height * 0.3,
    layerCount: 4,
    complexity: 0.8,
    seed: 54321,
    colorScheme: {
      type: ColorSchemeType.TRADITIONAL_INK,
      ...COLOR_SCHEMES[ColorSchemeType.TRADITIONAL_INK]
    }
  });

  const context = new RenderContext(renderer);
  bgMountain.render(context);
  fgMountain.render(context);

  console.log('✓ Mountain Element demo rendered');
}

/**
 * Demo 6: Tree Element
 */
function demoTreeElement() {
  renderer.clear();

  const width = canvas.width;
  const height = canvas.height;
  const context = new RenderContext(renderer);

  // Background gradient (sky)
  for (let y = 0; y < height; y += 4) {
    const t = y / height;
    renderer.drawPolygon(
      [
        { x: 0, y },
        { x: width, y },
        { x: width, y: y + 4 },
        { x: 0, y: y + 4 }
      ],
      {
        fillColor: {
          r: Math.floor(230 - t * 40),
          g: Math.floor(240 - t * 30),
          b: Math.floor(250 - t * 20),
          a: 1
        },
        strokeColor: undefined
      }
    );
  }

  // Pine tree in winter (left)
  const pineTree = new Tree({
    position: { x: 150, y: height - 50 },
    height: 200,
    treeType: TreeType.PINE,
    season: SeasonType.WINTER,
    seed: 12345,
    branchWidth: 8
  });

  // Willow tree in spring (center)
  const willowTree = new Tree({
    position: { x: 400, y: height - 50 },
    height: 250,
    treeType: TreeType.WILLOW,
    season: SeasonType.SPRING,
    seed: 54321,
    branchWidth: 6
  });

  // Maple tree in autumn (right)
  const mapleTree = new Tree({
    position: { x: 650, y: height - 50 },
    height: 220,
    treeType: TreeType.MAPLE,
    season: SeasonType.AUTUMN,
    seed: 98765,
    branchWidth: 7
  });

  pineTree.render(context);
  willowTree.render(context);
  mapleTree.render(context);

  console.log('✓ Tree Element demo rendered');
}

/**
 * Demo 7: Water Element
 */
function demoWaterElement() {
  renderer.clear();

  const width = canvas.width;
  const height = canvas.height;
  const context = new RenderContext(renderer);

  // Sky gradient
  for (let y = 0; y < height * 0.6; y += 4) {
    const t = y / (height * 0.6);
    renderer.drawPolygon(
      [
        { x: 0, y },
        { x: width, y },
        { x: width, y: y + 4 },
        { x: 0, y: y + 4 }
      ],
      {
        fillColor: {
          r: Math.floor(200 + t * 55),
          g: Math.floor(220 + t * 35),
          b: Math.floor(240 + t * 15),
          a: 1
        },
        strokeColor: undefined
      }
    );
  }

  // Distant mountain
  const mountain = new Mountain({
    position: { x: 0, y: height * 0.5 },
    width: width,
    height: height * 0.3,
    layerCount: 3,
    complexity: 0.5,
    seed: 11111,
    colorScheme: {
      type: ColorSchemeType.BLUE_MIST,
      ...COLOR_SCHEMES[ColorSchemeType.BLUE_MIST]
    }
  });
  mountain.render(context);

  // Still water (top)
  const stillWater = new Water({
    position: { x: 50, y: height * 0.65 },
    width: 700,
    waterType: WaterType.STILL,
    waveCount: 2,
    waveAmplitude: 5,
    seed: 22222
  });

  // Flowing water (middle)
  const flowingWater = new Water({
    position: { x: 50, y: height * 0.75 },
    width: 700,
    waterType: WaterType.FLOWING,
    waveCount: 4,
    waveAmplitude: 8,
    seed: 33333
  });

  // Rippled water (bottom)
  const rippledWater = new Water({
    position: { x: 50, y: height * 0.85 },
    width: 700,
    waterType: WaterType.RIPPLED,
    waveCount: 6,
    waveAmplitude: 12,
    seed: 44444
  });

  stillWater.render(context);
  flowingWater.render(context);
  rippledWater.render(context);

  console.log('✓ Water Element demo rendered');
}

/**
 * Clear canvas
 */
function clear() {
  renderer.clear();
  console.log('✓ Canvas cleared');
}

/**
 * Export canvas as image
 */
async function exportImage() {
  try {
    const dataUrl = await renderer.export('data-url');

    // Create download link
    const link = document.createElement('a');
    link.download = `shuimo-${Date.now()}.png`;
    link.href = dataUrl as string;
    link.click();

    console.log('✓ Image exported');
  } catch (error) {
    console.error('Export failed:', error);
    alert('导出失败，请查看控制台');
  }
}

// Event listeners
demoInfiniteBtn.addEventListener('click', demoInfiniteScroll);
demoShanshuiBtn.addEventListener('click', demoCompleteShanshui);
demoNoiseBtn.addEventListener('click', demoPerlinNoise);
demoBezierBtn.addEventListener('click', demoBezierCurves);
demoBrushBtn.addEventListener('click', demoBrushStrokes);
demoLandscapeBtn.addEventListener('click', demoSimpleLandscape);
demoMountainBtn.addEventListener('click', demoMountainElement);
demoTreeBtn.addEventListener('click', demoTreeElement);
demoWaterBtn.addEventListener('click', demoWaterElement);
scrollLeftBtn.addEventListener('click', scrollInfiniteLeft);
scrollRightBtn.addEventListener('click', scrollInfiniteRight);
scrollResetBtn.addEventListener('click', scrollInfiniteReset);
clearBtn.addEventListener('click', clear);
exportBtn.addEventListener('click', exportImage);

// Initial demo - show the infinite scrolling shanshui on load
console.log('🎨 Shuimo Playground loaded');
console.log('Rendering initial infinite scrolling shanshui...');
demoInfiniteScroll();
