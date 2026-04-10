<script lang="ts" setup>
import { onMounted, onUnmounted, ref, computed } from "vue";
import { GPUSceneManager } from "@jobinjia/shuimo-core";

const canvasRef = ref<HTMLCanvasElement | null>(null);
const canvasWrapperRef = ref<HTMLDivElement | null>(null);
const isSupported = ref(true);
const errorMessage = ref("");
const showSettings = ref(false);
const seedInput = ref(String(Date.now()));
const scrollStep = ref(200);
const autoScroll = ref(true);
const hoveredBtn = ref<"left" | "right" | null>(null);

let sceneManager: GPUSceneManager | null = null;
let animationFrameId: number | null = null;
let targetX = 0;
let smoothX = 0; // 平滑位置（用于实际渲染）

// Initialize
async function init() {
  if (!canvasRef.value) return;

  sceneManager = new GPUSceneManager(3000, 800, 512);
  const success = await sceneManager.initialize(canvasRef.value);

  if (!success) {
    isSupported.value = false;
    errorMessage.value = "WebGPU not supported. Please use Chrome 113+ or Safari 17+";
    return;
  }

  // Set initial seed
  sceneManager.setSeed(Number.parseInt(seedInput.value) || Date.now());

  // Initial update and render
  sceneManager.update();
  sceneManager.render();

  // Start auto-scroll if enabled
  if (autoScroll.value) {
    startAutoScroll();
  }
}

function regenerateWithSeed() {
  const seed = seedInput.value || String(Date.now());
  seedInput.value = seed;
  targetX = 0;
  smoothX = 0;

  if (sceneManager) {
    sceneManager.setSeed(Number.parseInt(seed));
    sceneManager.setViewportX(0);
    sceneManager.update();
    sceneManager.render();
  }
}

function scrollLeft() {
  xcroll(-scrollStep.value);
}

function scrollRight() {
  xcroll(scrollStep.value);
}

function toggleAutoScroll() {
  if (autoScroll.value) {
    startAutoScroll();
  } else {
    stopAutoScroll();
  }
}

function startAutoScroll() {
  if (animationFrameId !== null) return;

  const animate = () => {
    if (!autoScroll.value) {
      animationFrameId = null;
      return;
    }

    // 每帧增加目标位置
    targetX += 1.2;

    // 平滑插值（缓动效果）
    smoothX += (targetX - smoothX) * 0.1;

    // 更新视口位置
    if (sceneManager) {
      sceneManager.setViewportX(smoothX);

      // 检查是否需要加载新 chunks
      if (sceneManager.needUpdate()) {
        sceneManager.update();
      }

      // 每帧都渲染（使用缓冲区，性能开销小）
      sceneManager.render();
    }

    animationFrameId = requestAnimationFrame(animate);
  };

  animationFrameId = requestAnimationFrame(animate);
}

function stopAutoScroll() {
  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
}

function xcroll(v: number) {
  targetX += v;
  smoothX = targetX; // 手动滚动时直接跳转

  if (sceneManager) {
    sceneManager.setViewportX(smoothX);
    if (sceneManager.needUpdate()) {
      sceneManager.update();
    }
    sceneManager.render();
  }
}

function toggleSettings() {
  showSettings.value = !showSettings.value;
}

function downloadImage() {
  if (!canvasRef.value) return;

  const link = document.createElement("a");
  link.download = `webgpu-shanshui-${Date.now()}.png`;
  link.href = canvasRef.value.toDataURL("image/png");
  link.click();
}

// Generate paper texture for background
function generateBackgroundTexture(): string {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d")!;

  for (let i = 0; i < 256; i++) {
    for (let j = 0; j < 256; j++) {
      const c = 245 + Math.random() * 10 - Math.random() * 20;
      const r = Math.floor(c);
      const g = Math.floor(c * 0.95);
      const b = Math.floor(c * 0.85);
      ctx.fillStyle = `rgb(${r},${g},${b})`;

      ctx.fillRect(i * 2, j * 2, 2, 2);
      ctx.fillRect(512 - i * 2, j * 2, 2, 2);
      ctx.fillRect(i * 2, 512 - j * 2, 2, 2);
      ctx.fillRect(512 - i * 2, 512 - j * 2, 2, 2);
    }
  }

  return canvas.toDataURL("image/png");
}

const canvasStyle = computed(() => ({
  backgroundImage: `url(${generateBackgroundTexture()})`,
}));

onMounted(async () => {
  seedInput.value = String(Date.now());
  await init();
});

onUnmounted(() => {
  stopAutoScroll();
  sceneManager?.destroy();
});
</script>

<template>
  <div class="webgpu-scroll-app">
    <!-- Settings Panel -->
    <div class="settings-panel">
      <button class="settings-btn" title="Settings" @click="toggleSettings">
        {{ showSettings ? "X" : "=" }}
      </button>

      <div v-if="showSettings" class="settings-menu">
        <!-- Seed Control -->
        <div class="setting-group">
          <label>SEED</label>
          <div class="input-group">
            <input
              v-model="seedInput"
              type="text"
              placeholder="Random seed"
              @keyup.enter="regenerateWithSeed"
            />
            <button @click="regenerateWithSeed">Generate</button>
          </div>
        </div>

        <!-- View Control -->
        <div class="setting-group">
          <label>VIEW</label>
          <div class="input-group">
            <button title="Scroll left" @click="scrollLeft">&lt;</button>
            <input
              v-model.number="scrollStep"
              type="number"
              min="0"
              max="1000"
              step="50"
              title="Scroll step"
            />
            <button title="Scroll right" @click="scrollRight">&gt;</button>
          </div>
          <div class="checkbox-group">
            <label>
              <input v-model="autoScroll" type="checkbox" @change="toggleAutoScroll" />
              Auto-scroll
            </label>
          </div>
        </div>

        <!-- Save Control -->
        <div class="setting-group">
          <label>SAVE</label>
          <button class="download-btn" @click="downloadImage">Download as PNG</button>
        </div>
      </div>
    </div>

    <!-- Error message -->
    <div v-if="!isSupported" class="error-message">
      {{ errorMessage }}
    </div>

    <!-- Main content -->
    <template v-else>
      <table class="main-table">
        <tbody>
          <tr>
            <!-- Left scroll button -->
            <td>
              <div
                class="scroll-btn scroll-btn-left"
                :class="{ active: hoveredBtn === 'left' }"
                @click="scrollLeft"
                @mouseenter="hoveredBtn = 'left'"
                @mouseleave="hoveredBtn = null"
              >
                <div class="scroll-btn-text">
                  <span>&lt;</span>
                </div>
              </div>
            </td>

            <!-- Canvas -->
            <td>
              <div class="canvas-viewport">
                <div ref="canvasWrapperRef" class="canvas-wrapper" :style="canvasStyle">
                  <canvas ref="canvasRef" width="3000" height="800" />
                </div>
              </div>
            </td>

            <!-- Right scroll button -->
            <td>
              <div
                class="scroll-btn scroll-btn-right"
                :class="{ active: hoveredBtn === 'right' }"
                @click="scrollRight"
                @mouseenter="hoveredBtn = 'right'"
                @mouseleave="hoveredBtn = null"
              >
                <div class="scroll-btn-text">
                  <span>&gt;</span>
                </div>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <div class="info-bar">
        <span class="tech-badge">WebGPU</span>
        <span class="tech-info">GPU-accelerated infinite scrolling landscape</span>
      </div>
    </template>
  </div>
</template>

<style scoped>
.webgpu-scroll-app {
  margin: 0;
  padding: 0;
  position: relative;
  background: #f8f6f0;
}

.main-table {
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
  border-collapse: collapse;
  width: auto;
}

/* Settings Panel */
.settings-panel {
  position: fixed;
  z-index: 1000;
  left: 40px;
  top: 3px;
}

.settings-btn {
  width: 32px;
  height: 32px;
  color: rgba(0, 0, 0, 0.4);
  border: 1px solid rgba(0, 0, 0, 0.4);
  background-color: rgba(255, 255, 255, 0.9);
  text-align: center;
  cursor: pointer;
  font-size: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.settings-btn:hover {
  background-color: rgba(0, 0, 0, 0.1);
}

.settings-menu {
  margin-top: 4px;
  background-color: rgba(255, 255, 255, 0.95);
  border: 1px solid rgba(0, 0, 0, 0.4);
  padding: 12px;
  min-width: 200px;
}

.setting-group {
  margin-bottom: 12px;
}

.setting-group:last-child {
  margin-bottom: 0;
}

.setting-group label {
  display: block;
  font-family: monospace;
  font-size: 12px;
  margin-bottom: 4px;
  color: rgba(0, 0, 0, 0.7);
}

.input-group {
  display: flex;
  gap: 4px;
}

.input-group input[type="text"],
.input-group input[type="number"] {
  flex: 1;
  padding: 4px 8px;
  border: 1px solid rgba(0, 0, 0, 0.3);
  font-size: 12px;
}

.input-group button {
  padding: 4px 12px;
  border: 1px solid rgba(0, 0, 0, 0.3);
  background-color: white;
  cursor: pointer;
  font-size: 12px;
}

.input-group button:hover {
  background-color: rgba(0, 0, 0, 0.05);
}

.checkbox-group {
  margin-top: 4px;
}

.checkbox-group label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-family: monospace;
  font-size: 12px;
  cursor: pointer;
}

.download-btn {
  width: 100%;
  padding: 6px 12px;
  border: 1px solid rgba(0, 0, 0, 0.3);
  background-color: white;
  cursor: pointer;
  font-size: 12px;
}

.download-btn:hover {
  background-color: rgba(0, 0, 0, 0.05);
}

/* Canvas viewport - 固定视口，隐藏溢出 */
.canvas-viewport {
  width: 3000px;
  height: 800px;
  overflow: hidden;
  position: relative;
}

/* Canvas wrapper - 画布容器 */
.canvas-wrapper {
  width: 3000px;
  height: 800px;
  background-repeat: repeat;
  background-size: 256px 256px;
  display: flex;
  align-items: center;
  justify-content: center;
}

canvas {
  display: block;
}

/* Scroll Buttons */
.scroll-btn {
  width: 32px;
  text-align: center;
  color: rgba(0, 0, 0, 0.4);
  display: table;
  cursor: pointer;
  border: 1px solid rgba(0, 0, 0, 0.4);
  background-color: rgba(0, 0, 0, 0);
  height: 800px;
  user-select: none;
}

.scroll-btn.active {
  background-color: rgba(0, 0, 0, 0.1);
}

.scroll-btn-text {
  vertical-align: middle;
  display: table-cell;
}

.scroll-btn span {
  font-size: 32px;
  line-height: 1;
}

/* Error message */
.error-message {
  background: #fee;
  color: #c00;
  padding: 2em;
  margin: 1em;
  border-radius: 8px;
  text-align: center;
}

/* Info bar */
.info-bar {
  padding: 8px 16px;
  background: rgba(0, 0, 0, 0.02);
  border-top: 1px solid rgba(0, 0, 0, 0.1);
  display: flex;
  align-items: center;
  gap: 12px;
}

.tech-badge {
  background: #2d3748;
  color: white;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
}

.tech-info {
  color: #666;
  font-size: 12px;
}
</style>
