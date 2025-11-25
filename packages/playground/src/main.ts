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
  type Vec2,
  type IRenderer
} from '@shuimo/core';

// Get DOM elements
const canvas = document.getElementById('canvas') as HTMLCanvasElement;
const rendererTypeSelect = document.getElementById('renderer-type') as HTMLSelectElement;
const demoNoiseBtn = document.getElementById('demo-noise') as HTMLButtonElement;
const demoBezierBtn = document.getElementById('demo-bezier') as HTMLButtonElement;
const demoBrushBtn = document.getElementById('demo-brush') as HTMLButtonElement;
const demoLandscapeBtn = document.getElementById('demo-landscape') as HTMLButtonElement;
const clearBtn = document.getElementById('clear') as HTMLButtonElement;
const exportBtn = document.getElementById('export') as HTMLButtonElement;

// Initialize renderer
let renderer: IRenderer = new CanvasRenderer(canvas);

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
});

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
demoNoiseBtn.addEventListener('click', demoPerlinNoise);
demoBezierBtn.addEventListener('click', demoBezierCurves);
demoBrushBtn.addEventListener('click', demoBrushStrokes);
demoLandscapeBtn.addEventListener('click', demoSimpleLandscape);
clearBtn.addEventListener('click', clear);
exportBtn.addEventListener('click', exportImage);

// Initial demo
console.log('🎨 Shuimo Playground loaded');
console.log('Click buttons to run demos');
