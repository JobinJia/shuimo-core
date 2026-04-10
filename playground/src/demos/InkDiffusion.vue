<script lang="ts" setup>
import { onMounted, onUnmounted, ref, reactive } from "vue";
import { InkDiffusionEngine } from "@jobinjia/shuimo-core";

const canvasRef = ref<HTMLCanvasElement | null>(null);
const isSupported = ref(true);
const isRunning = ref(false);
const errorMessage = ref("");

let engine: InkDiffusionEngine | null = null;
let animationId: number | null = null;
let isDrawing = false;

// 参数控制
const params = reactive({
  diffusionRate: 0.15,
  evaporationRate: 0.001,
  viscosity: 0.3,
  paperAbsorption: 0.1,
  brushSize: 15,
  brushIntensity: 0.8,
});

// 初始化引擎
async function initEngine() {
  if (!canvasRef.value) return;

  engine = new InkDiffusionEngine({
    width: canvasRef.value.width,
    height: canvasRef.value.height,
    diffusionRate: params.diffusionRate,
    evaporationRate: params.evaporationRate,
    viscosity: params.viscosity,
    paperAbsorption: params.paperAbsorption,
  });

  const success = await engine.initialize(canvasRef.value);

  if (!success) {
    isSupported.value = false;
    errorMessage.value = "WebGPU 不支持，请使用 Chrome 113+ 或 Safari 17+";
    return;
  }

  // 初始渲染
  engine.render();
}

// 开始/停止模拟
function toggleSimulation() {
  if (isRunning.value) {
    stopSimulation();
  } else {
    startSimulation();
  }
}

function startSimulation() {
  if (!engine) return;
  isRunning.value = true;

  function loop() {
    if (!engine || !isRunning.value) return;

    // 执行多步扩散以加速效果
    for (let i = 0; i < 3; i++) {
      engine.step();
    }
    engine.render();

    animationId = requestAnimationFrame(loop);
  }

  loop();
}

function stopSimulation() {
  isRunning.value = false;
  if (animationId !== null) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }
}

// 清空画布
function clearCanvas() {
  if (!engine) return;
  engine.clear();
  engine.render();
}

// 更新参数
function updateParams() {
  if (!engine) return;
  engine.setParams({
    diffusionRate: params.diffusionRate,
    evaporationRate: params.evaporationRate,
    viscosity: params.viscosity,
    paperAbsorption: params.paperAbsorption,
  });
}

// 鼠标/触摸绘制
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

function handlePointerDown(e: MouseEvent | TouchEvent) {
  isDrawing = true;
  addInkAtPosition(e);
}

function handlePointerMove(e: MouseEvent | TouchEvent) {
  if (!isDrawing) return;
  addInkAtPosition(e);
}

function handlePointerUp() {
  isDrawing = false;
}

function addInkAtPosition(e: MouseEvent | TouchEvent) {
  if (!engine) return;

  const pos = getCanvasPosition(e);
  if (!pos) return;

  engine.addInk(pos.x, pos.y, params.brushSize, params.brushIntensity);

  // 如果模拟没有运行，手动渲染
  if (!isRunning.value) {
    engine.render();
  }
}

// 添加预设墨点（演示用）
function addDemoInk() {
  if (!engine || !canvasRef.value) return;

  const cx = canvasRef.value.width / 2;
  const cy = canvasRef.value.height / 2;

  // 添加几个墨点
  engine.addInk(cx, cy, 30, 1.0);
  engine.addInk(cx - 80, cy - 50, 20, 0.7);
  engine.addInk(cx + 100, cy + 30, 25, 0.9);
  engine.addInk(cx - 50, cy + 80, 15, 0.6);

  if (!isRunning.value) {
    engine.render();
  }
}

onMounted(async () => {
  await initEngine();
});

onUnmounted(() => {
  stopSimulation();
  engine?.destroy();
});
</script>

<template>
  <div class="ink-diffusion-container">
    <h2>WebGPU 墨水扩散模拟</h2>
    <p class="description">
      使用 Compute Shader 模拟墨水在宣纸上的扩散效果。点击画布添加墨点，观察墨水的自然扩散。
    </p>

    <div v-if="!isSupported" class="error-message">
      {{ errorMessage }}
    </div>

    <div v-else class="canvas-wrapper">
      <canvas
        ref="canvasRef"
        width="800"
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
        <button @click="toggleSimulation" :class="{ active: isRunning }">
          {{ isRunning ? "暂停扩散" : "开始扩散" }}
        </button>
        <button @click="addDemoInk">添加墨点</button>
        <button @click="clearCanvas">清空画布</button>
      </div>

      <div class="params-group">
        <div class="param">
          <label>扩散速率: {{ params.diffusionRate.toFixed(2) }}</label>
          <input
            type="range"
            v-model.number="params.diffusionRate"
            min="0.01"
            max="0.5"
            step="0.01"
            @input="updateParams"
          />
        </div>

        <div class="param">
          <label>蒸发速率: {{ params.evaporationRate.toFixed(4) }}</label>
          <input
            type="range"
            v-model.number="params.evaporationRate"
            min="0"
            max="0.01"
            step="0.0001"
            @input="updateParams"
          />
        </div>

        <div class="param">
          <label>墨水粘度: {{ params.viscosity.toFixed(2) }}</label>
          <input
            type="range"
            v-model.number="params.viscosity"
            min="0"
            max="1"
            step="0.01"
            @input="updateParams"
          />
        </div>

        <div class="param">
          <label>纸张吸收: {{ params.paperAbsorption.toFixed(2) }}</label>
          <input
            type="range"
            v-model.number="params.paperAbsorption"
            min="0"
            max="0.5"
            step="0.01"
            @input="updateParams"
          />
        </div>

        <div class="param">
          <label>笔刷大小: {{ params.brushSize }}</label>
          <input type="range" v-model.number="params.brushSize" min="5" max="50" step="1" />
        </div>

        <div class="param">
          <label>笔刷浓度: {{ params.brushIntensity.toFixed(2) }}</label>
          <input
            type="range"
            v-model.number="params.brushIntensity"
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
        <li><strong>Compute Shader</strong>: 使用 WGSL 编写的扩散算法，在 GPU 上并行计算</li>
        <li><strong>双缓冲</strong>: ping-pong 缓冲技术实现流畅的迭代模拟</li>
        <li><strong>纸张纹理</strong>: 使用噪声生成纸纤维，影响墨水的各向异性扩散</li>
        <li><strong>拉普拉斯算子</strong>: 9 点模板实现平滑的扩散效果</li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.ink-diffusion-container {
  padding: 2em;
  max-width: 1000px;
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
  margin-bottom: 1em;
}

.canvas-wrapper {
  background: #f5f5f5;
  border-radius: 8px;
  padding: 1em;
  display: flex;
  justify-content: center;
}

canvas {
  background: #f5f0e8;
  border: 1px solid #ddd;
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

button {
  padding: 0.8em 1.5em;
  border: none;
  border-radius: 6px;
  background: #4a5568;
  color: white;
  cursor: pointer;
  font-size: 0.95em;
  transition: all 0.2s;
}

button:hover {
  background: #2d3748;
}

button.active {
  background: #38a169;
}

.params-group {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 1em;
}

.param {
  background: #f7fafc;
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
