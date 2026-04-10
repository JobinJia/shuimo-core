<script lang="ts" setup>
import { onMounted, onUnmounted, ref, reactive } from "vue";
import { ShuimoEngine, TreeType } from "@shuimo/core";
import type { PathPoint } from "@shuimo/core";

const canvasRef = ref<HTMLCanvasElement | null>(null);
const isSupported = ref(true);
const errorMessage = ref("");

let engine: ShuimoEngine | null = null;

// 当前模式
const currentMode = ref<"stroke" | "mount" | "water" | "tree" | "blob" | "texture">("stroke");

// 绘制状态
let isDrawing = false;
let currentPath: PathPoint[] = [];
let lastPoint: { x: number; y: number; time: number } | null = null;

// 笔触参数
const strokeParams = reactive({
  width: 8,
  noiseAmount: 0.3,
  softness: 0.3,
  inkDensity: 0.9,
  color: [0.1, 0.1, 0.12, 1.0] as [number, number, number, number],
});

// 山峰参数
const mountParams = reactive({
  height: 200,
  width: 400,
  layers: 3,
  inkDensity: 0.8,
});

// 水面参数
const waterParams = reactive({
  length: 600,
  clusters: 15,
  density: 5,
  inkDensity: 0.5,
});

// 树木参数
const treeParams = reactive({
  height: 150,
  width: 80,
  type: TreeType.Simple,
  leafDensity: 0.6,
  inkDensity: 0.85,
});

// 墨点参数
const blobParams = reactive({
  length: 30,
  width: 20,
  noiseAmount: 0.5,
  softness: 0.3,
});

// 纹理参数
const textureParams = reactive({
  lineCount: 100,
  strokeWidth: 1.5,
  inkDensity: 0.6,
  noiseAmount: 0.5,
});

// 初始化
async function init() {
  if (!canvasRef.value) return;

  engine = new ShuimoEngine();
  const success = await engine.initialize(canvasRef.value);

  if (!success) {
    isSupported.value = false;
    errorMessage.value = "WebGPU 不支持，请使用 Chrome 113+ 或 Safari 17+";
    return;
  }
}

// 清空画布
function clearCanvas() {
  engine?.clear();
}

// 获取画布坐标
function getCanvasPosition(e: MouseEvent | TouchEvent): { x: number; y: number } | null {
  if (!canvasRef.value) return null;

  const rect = canvasRef.value.getBoundingClientRect();
  const scaleX = canvasRef.value.width / rect.width;
  const scaleY = canvasRef.value.height / rect.height;

  let clientX: number, clientY: number;

  if ("touches" in e) {
    if (e.touches.length === 0) return null;
    clientX = e.touches[0].clientX;
    clientY = e.touches[0].clientY;
  } else {
    clientX = e.clientX;
    clientY = e.clientY;
  }

  return {
    x: (clientX - rect.left) * scaleX,
    y: (clientY - rect.top) * scaleY,
  };
}

// 计算速度
function calculateVelocity(
  current: { x: number; y: number },
  last: { x: number; y: number; time: number },
): number {
  const dx = current.x - last.x;
  const dy = current.y - last.y;
  const dt = (Date.now() - last.time) / 1000;
  if (dt === 0) return 0;
  const speed = Math.sqrt(dx * dx + dy * dy) / dt;
  return Math.min(speed / 1000, 1);
}

// 鼠标/触摸事件
function handlePointerDown(e: MouseEvent | TouchEvent) {
  const pos = getCanvasPosition(e);
  if (!pos) return;

  if (currentMode.value === "stroke") {
    isDrawing = true;
    currentPath = [];
    lastPoint = null;
    currentPath.push({ x: pos.x, y: pos.y, pressure: 1, velocity: 0 });
    lastPoint = { x: pos.x, y: pos.y, time: Date.now() };
  } else if (currentMode.value === "mount") {
    engine?.drawMount(pos.x, pos.y, {
      height: mountParams.height,
      width: mountParams.width,
      layers: mountParams.layers,
      inkDensity: mountParams.inkDensity,
    });
  } else if (currentMode.value === "water") {
    engine?.drawWater(pos.x, pos.y, {
      length: waterParams.length,
      clusters: waterParams.clusters,
      density: waterParams.density,
      inkDensity: waterParams.inkDensity,
    });
  } else if (currentMode.value === "tree") {
    engine?.drawTree(pos.x, pos.y, {
      height: treeParams.height,
      width: treeParams.width,
      type: treeParams.type,
      leafDensity: treeParams.leafDensity,
      inkDensity: treeParams.inkDensity,
    });
  } else if (currentMode.value === "blob") {
    engine?.drawBlob(pos.x, pos.y, {
      length: blobParams.length,
      width: blobParams.width,
      angle: Math.random() * Math.PI,
      noiseAmount: blobParams.noiseAmount,
      softness: blobParams.softness,
    });
  } else if (currentMode.value === "texture") {
    engine?.drawTexture(
      {
        x: pos.x - 50,
        y: pos.y - 50,
        width: 100,
        height: 100,
      },
      {
        lineCount: textureParams.lineCount,
        strokeWidth: textureParams.strokeWidth,
        inkDensity: textureParams.inkDensity,
        noiseAmount: textureParams.noiseAmount,
      },
    );
  }
}

function handlePointerMove(e: MouseEvent | TouchEvent) {
  if (!isDrawing || currentMode.value !== "stroke") return;

  const pos = getCanvasPosition(e);
  if (!pos) return;

  let velocity = 0;
  if (lastPoint) {
    velocity = calculateVelocity(pos, lastPoint);
  }

  const pressure = 1 - velocity * 0.5;

  currentPath.push({ x: pos.x, y: pos.y, pressure, velocity });
  lastPoint = { x: pos.x, y: pos.y, time: Date.now() };

  if (currentPath.length >= 2) {
    engine?.drawStroke(currentPath, {
      width: strokeParams.width,
      color: strokeParams.color,
      noiseAmount: strokeParams.noiseAmount,
      softness: strokeParams.softness,
      inkDensity: strokeParams.inkDensity,
    });
  }
}

function handlePointerUp() {
  if (!isDrawing || currentMode.value !== "stroke") return;
  isDrawing = false;

  if (currentPath.length >= 2) {
    engine?.drawStroke(currentPath, {
      width: strokeParams.width,
      color: strokeParams.color,
      noiseAmount: strokeParams.noiseAmount,
      softness: strokeParams.softness,
      inkDensity: strokeParams.inkDensity,
    });
  }

  currentPath = [];
}

// 绘制示例场景
function drawDemoScene() {
  clearCanvas();

  if (!engine) return;
  const w = engine.width;
  const h = engine.height;

  // 远山
  setTimeout(() => {
    engine?.drawMount(w * 0.7, h * 0.45, {
      height: 180,
      width: 400,
      layers: 3,
      inkDensity: 0.4,
    });
  }, 50);

  // 近山
  setTimeout(() => {
    engine?.drawMount(w * 0.3, h * 0.55, {
      height: 220,
      width: 350,
      layers: 2,
      inkDensity: 0.7,
    });
  }, 100);

  // 水面
  setTimeout(() => {
    engine?.drawWater(w * 0.5, h * 0.75, {
      length: 700,
      clusters: 20,
      density: 6,
      inkDensity: 0.4,
    });
  }, 150);

  // 树
  setTimeout(() => {
    engine?.drawTree(w * 0.15, h * 0.7, {
      height: 120,
      width: 60,
      leafDensity: 0.7,
      inkDensity: 0.8,
    });
  }, 200);

  setTimeout(() => {
    engine?.drawTree(w * 0.85, h * 0.65, {
      height: 100,
      width: 50,
      leafDensity: 0.5,
      inkDensity: 0.6,
    });
  }, 250);
}

onMounted(async () => {
  await init();
});

onUnmounted(() => {
  engine?.destroy();
});
</script>

<template>
  <div class="webgpu-shanshui-container">
    <h2>WebGPU 水墨山水</h2>
    <p class="description">使用 GPU 加速渲染的水墨山水画。选择模式后在画布上绘制。</p>

    <div v-if="!isSupported" class="error-message">
      {{ errorMessage }}
    </div>

    <template v-else>
      <div class="mode-selector">
        <button :class="{ active: currentMode === 'stroke' }" @click="currentMode = 'stroke'">
          笔触
        </button>
        <button :class="{ active: currentMode === 'mount' }" @click="currentMode = 'mount'">
          山峰
        </button>
        <button :class="{ active: currentMode === 'water' }" @click="currentMode = 'water'">
          水面
        </button>
        <button :class="{ active: currentMode === 'tree' }" @click="currentMode = 'tree'">
          树木
        </button>
        <button :class="{ active: currentMode === 'blob' }" @click="currentMode = 'blob'">
          墨点
        </button>
        <button :class="{ active: currentMode === 'texture' }" @click="currentMode = 'texture'">
          纹理
        </button>
      </div>

      <div class="canvas-wrapper">
        <canvas
          ref="canvasRef"
          width="1000"
          height="600"
          @mousedown="handlePointerDown"
          @mousemove="handlePointerMove"
          @mouseup="handlePointerUp"
          @mouseleave="handlePointerUp"
          @touchstart.prevent="handlePointerDown"
          @touchmove.prevent="handlePointerMove"
          @touchend="handlePointerUp"
        />
      </div>

      <div class="controls">
        <div class="button-group">
          <button @click="clearCanvas">清空画布</button>
          <button @click="drawDemoScene">演示场景</button>
        </div>

        <!-- 笔触参数 -->
        <div v-if="currentMode === 'stroke'" class="params-group">
          <h3>笔触参数</h3>
          <div class="param">
            <label>笔宽: {{ strokeParams.width }}</label>
            <input type="range" v-model.number="strokeParams.width" min="1" max="30" step="1" />
          </div>
          <div class="param">
            <label>噪声: {{ strokeParams.noiseAmount.toFixed(2) }}</label>
            <input
              type="range"
              v-model.number="strokeParams.noiseAmount"
              min="0"
              max="1"
              step="0.05"
            />
          </div>
          <div class="param">
            <label>柔和度: {{ strokeParams.softness.toFixed(2) }}</label>
            <input
              type="range"
              v-model.number="strokeParams.softness"
              min="0"
              max="1"
              step="0.05"
            />
          </div>
          <div class="param">
            <label>浓度: {{ strokeParams.inkDensity.toFixed(2) }}</label>
            <input
              type="range"
              v-model.number="strokeParams.inkDensity"
              min="0.1"
              max="1"
              step="0.05"
            />
          </div>
        </div>

        <!-- 山峰参数 -->
        <div v-if="currentMode === 'mount'" class="params-group">
          <h3>山峰参数（点击画布添加）</h3>
          <div class="param">
            <label>高度: {{ mountParams.height }}</label>
            <input type="range" v-model.number="mountParams.height" min="50" max="400" step="10" />
          </div>
          <div class="param">
            <label>宽度: {{ mountParams.width }}</label>
            <input type="range" v-model.number="mountParams.width" min="100" max="800" step="20" />
          </div>
          <div class="param">
            <label>层数: {{ mountParams.layers }}</label>
            <input type="range" v-model.number="mountParams.layers" min="1" max="5" step="1" />
          </div>
          <div class="param">
            <label>浓度: {{ mountParams.inkDensity.toFixed(2) }}</label>
            <input
              type="range"
              v-model.number="mountParams.inkDensity"
              min="0.1"
              max="1"
              step="0.05"
            />
          </div>
        </div>

        <!-- 水面参数 -->
        <div v-if="currentMode === 'water'" class="params-group">
          <h3>水面参数（点击画布添加）</h3>
          <div class="param">
            <label>长度: {{ waterParams.length }}</label>
            <input
              type="range"
              v-model.number="waterParams.length"
              min="100"
              max="1000"
              step="50"
            />
          </div>
          <div class="param">
            <label>波簇: {{ waterParams.clusters }}</label>
            <input type="range" v-model.number="waterParams.clusters" min="5" max="30" step="1" />
          </div>
          <div class="param">
            <label>浓度: {{ waterParams.inkDensity.toFixed(2) }}</label>
            <input
              type="range"
              v-model.number="waterParams.inkDensity"
              min="0.1"
              max="1"
              step="0.05"
            />
          </div>
        </div>

        <!-- 树木参数 -->
        <div v-if="currentMode === 'tree'" class="params-group">
          <h3>树木参数（点击画布添加）</h3>
          <div class="param">
            <label>高度: {{ treeParams.height }}</label>
            <input type="range" v-model.number="treeParams.height" min="50" max="300" step="10" />
          </div>
          <div class="param">
            <label>宽度: {{ treeParams.width }}</label>
            <input type="range" v-model.number="treeParams.width" min="30" max="150" step="5" />
          </div>
          <div class="param">
            <label>叶密度: {{ treeParams.leafDensity.toFixed(2) }}</label>
            <input
              type="range"
              v-model.number="treeParams.leafDensity"
              min="0.1"
              max="1"
              step="0.05"
            />
          </div>
        </div>

        <!-- 墨点参数 -->
        <div v-if="currentMode === 'blob'" class="params-group">
          <h3>墨点参数（点击画布添加）</h3>
          <div class="param">
            <label>长度: {{ blobParams.length }}</label>
            <input type="range" v-model.number="blobParams.length" min="10" max="80" step="5" />
          </div>
          <div class="param">
            <label>宽度: {{ blobParams.width }}</label>
            <input type="range" v-model.number="blobParams.width" min="10" max="60" step="5" />
          </div>
          <div class="param">
            <label>噪声: {{ blobParams.noiseAmount.toFixed(2) }}</label>
            <input
              type="range"
              v-model.number="blobParams.noiseAmount"
              min="0"
              max="1"
              step="0.05"
            />
          </div>
        </div>

        <!-- 纹理参数 -->
        <div v-if="currentMode === 'texture'" class="params-group">
          <h3>纹理参数（点击画布添加）</h3>
          <div class="param">
            <label>线数: {{ textureParams.lineCount }}</label>
            <input
              type="range"
              v-model.number="textureParams.lineCount"
              min="20"
              max="300"
              step="10"
            />
          </div>
          <div class="param">
            <label>笔宽: {{ textureParams.strokeWidth.toFixed(1) }}</label>
            <input
              type="range"
              v-model.number="textureParams.strokeWidth"
              min="0.5"
              max="4"
              step="0.1"
            />
          </div>
          <div class="param">
            <label>浓度: {{ textureParams.inkDensity.toFixed(2) }}</label>
            <input
              type="range"
              v-model.number="textureParams.inkDensity"
              min="0.1"
              max="1"
              step="0.05"
            />
          </div>
        </div>
      </div>

      <div class="info">
        <h3>技术说明</h3>
        <ul>
          <li><strong>WebGPU</strong>: 使用现代 GPU API 进行高性能渲染</li>
          <li><strong>笔触</strong>: 可变宽度 + 压力感应 + 噪声变形</li>
          <li><strong>墨点</strong>: Fragment Shader 实现的有机形状</li>
          <li><strong>组合绘制</strong>: 山峰、树木等由基础图元组合而成</li>
        </ul>
      </div>
    </template>
  </div>
</template>

<style scoped>
.webgpu-shanshui-container {
  padding: 2em;
  max-width: 1200px;
  margin: 0 auto;
}

h2 {
  font-family: "楷体", serif;
  color: #333;
  margin-bottom: 0.5em;
}

.description {
  color: #666;
  margin-bottom: 1.5em;
}

.error-message {
  background: #fee;
  color: #c00;
  padding: 1em;
  border-radius: 8px;
}

.mode-selector {
  display: flex;
  gap: 0.5em;
  margin-bottom: 1em;
  flex-wrap: wrap;
}

.mode-selector button {
  padding: 0.6em 1.2em;
  border: 2px solid #4a5568;
  border-radius: 6px;
  background: white;
  color: #4a5568;
  cursor: pointer;
  font-size: 0.9em;
  transition: all 0.2s;
}

.mode-selector button:hover {
  background: #f7fafc;
}

.mode-selector button.active {
  background: #4a5568;
  color: white;
}

.canvas-wrapper {
  background: #e8e4dc;
  border-radius: 8px;
  padding: 1em;
  display: flex;
  justify-content: center;
}

canvas {
  background: #f5f0e8;
  border: 1px solid #d0c8b8;
  border-radius: 4px;
  cursor: crosshair;
  max-width: 100%;
  height: auto;
}

.controls {
  margin-top: 1.5em;
}

.button-group {
  display: flex;
  gap: 1em;
  margin-bottom: 1.5em;
}

.button-group button {
  padding: 0.8em 1.5em;
  border: none;
  border-radius: 6px;
  background: #4a5568;
  color: white;
  cursor: pointer;
  font-size: 0.95em;
  transition: all 0.2s;
}

.button-group button:hover {
  background: #2d3748;
}

.params-group {
  background: #f7fafc;
  padding: 1.5em;
  border-radius: 8px;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 1em;
}

.params-group h3 {
  grid-column: 1 / -1;
  margin: 0 0 0.5em 0;
  font-size: 1em;
  color: #2d3748;
}

.param {
  background: white;
  padding: 1em;
  border-radius: 6px;
}

.param label {
  display: block;
  font-size: 0.85em;
  color: #4a5568;
  margin-bottom: 0.5em;
}

.param input[type="range"] {
  width: 100%;
}

.info {
  margin-top: 2em;
  padding: 1.5em;
  background: #f7fafc;
  border-radius: 8px;
}

.info h3 {
  font-size: 1em;
  color: #2d3748;
  margin-bottom: 0.8em;
}

.info ul {
  margin: 0;
  padding-left: 1.5em;
}

.info li {
  color: #4a5568;
  font-size: 0.9em;
  margin-bottom: 0.5em;
}
</style>
