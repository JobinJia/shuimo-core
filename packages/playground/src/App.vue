<template>
  <div id="app" class="shanshui-app">
    <!-- Settings Panel -->
    <div class="settings-panel">
      <button class="settings-btn" @click="toggleSettings" title="Settings">
        {{ showSettings ? '✕' : '☰' }}
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
            <button @click="scrollLeft" title="Scroll left">&lt;</button>
            <input
              v-model.number="scrollStep"
              type="number"
              min="0"
              max="1000"
              step="50"
              title="Scroll step"
            />
            <button @click="scrollRight" title="Scroll right">&gt;</button>
          </div>
          <div class="checkbox-group">
            <label>
              <input
                v-model="autoScroll"
                type="checkbox"
                @change="toggleAutoScroll"
              />
              Auto-scroll
            </label>
          </div>
        </div>

        <!-- Save Control -->
        <div class="setting-group">
          <label>SAVE</label>
          <button @click="downloadSVG" class="download-btn">
            Download as .SVG
          </button>
        </div>
      </div>
    </div>

    <!-- Source Code Link -->
    <a
      href="https://github.com/LingDong-/shan-shui-inf"
      target="_blank"
      class="source-btn"
      title="Fork me on Github!"
    >
      &lt;/&gt;
    </a>

    <!-- Main Canvas Area -->
    <div class="canvas-container">
      <!-- Left scroll button -->
      <div
        class="scroll-btn scroll-btn-left"
        @click="scrollLeft"
        @mouseenter="hoveredBtn = 'left'"
        @mouseleave="hoveredBtn = null"
        :class="{ active: hoveredBtn === 'left' }"
      >
        <span>‹</span>
      </div>

      <!-- SVG Canvas -->
      <div ref="canvasContainer" class="svg-canvas" :style="canvasStyle"></div>

      <!-- Right scroll button -->
      <div
        class="scroll-btn scroll-btn-right"
        @click="scrollRight"
        @mouseenter="hoveredBtn = 'right'"
        @mouseleave="hoveredBtn = null"
        :class="{ active: hoveredBtn === 'right' }"
      >
        <span>›</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { generateShanshui } from './shanshui';

// State
const showSettings = ref(false);
const seedInput = ref(String(Date.now()));
const scrollStep = ref(200);
const autoScroll = ref(false);
const hoveredBtn = ref<'left' | 'right' | null>(null);
const canvasContainer = ref<HTMLDivElement | null>(null);
const currentX = ref(0);
const svgContent = ref('');
let autoScrollTimer: number | null = null;

// Computed
const canvasStyle = computed(() => ({
  backgroundImage: `url(${generateBackgroundTexture()})`
}));

// Methods
function toggleSettings() {
  showSettings.value = !showSettings.value;
}

function regenerateWithSeed() {
  const seed = seedInput.value || String(Date.now());
  seedInput.value = seed;
  currentX.value = 0;
  renderScene();
}

function scrollLeft() {
  currentX.value -= scrollStep.value;
  renderScene();
}

function scrollRight() {
  currentX.value += scrollStep.value;
  renderScene();
}

function toggleAutoScroll() {
  if (autoScroll.value) {
    startAutoScroll();
  } else {
    stopAutoScroll();
  }
}

function startAutoScroll() {
  if (autoScrollTimer) return;
  autoScrollTimer = window.setInterval(() => {
    scrollRight();
  }, 2000);
}

function stopAutoScroll() {
  if (autoScrollTimer) {
    clearInterval(autoScrollTimer);
    autoScrollTimer = null;
  }
}

function renderScene() {
  if (!canvasContainer.value) return;

  const seed = parseInt(seedInput.value) || Date.now();
  const svg = generateShanshui(currentX.value, seed);
  svgContent.value = svg;
  canvasContainer.value.innerHTML = svg;
}

function downloadSVG() {
  const svg = svgContent.value;
  const blob = new Blob([svg], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `shanshui-${Date.now()}.svg`;
  link.click();
  URL.revokeObjectURL(url);
}

function generateBackgroundTexture(): string {
  // Generate a simple paper-like texture
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

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

  return canvas.toDataURL('image/png');
}

// Lifecycle
onMounted(() => {
  seedInput.value = String(Date.now());
  renderScene();
});

onUnmounted(() => {
  stopAutoScroll();
});
</script>

<style scoped>
.shanshui-app {
  margin: 0;
  padding: 0;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  position: relative;
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

/* Source Button */
.source-btn {
  position: fixed;
  z-index: 1000;
  left: 77px;
  top: 3px;
  width: 32px;
  height: 32px;
  color: rgba(0, 0, 0, 0.4);
  border: 1px solid rgba(0, 0, 0, 0.4);
  background-color: rgba(255, 255, 255, 0.9);
  text-align: center;
  cursor: pointer;
  text-decoration: none;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
}

.source-btn:hover {
  background-color: rgba(0, 0, 0, 0.1);
}

/* Canvas Container */
.canvas-container {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  position: relative;
}

.svg-canvas {
  flex: 1;
  height: 100%;
  background-repeat: repeat;
  background-size: 256px 256px;
  overflow: hidden;
}

/* Scroll Buttons */
.scroll-btn {
  width: 32px;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(0, 0, 0, 0.4);
  border: 1px solid rgba(0, 0, 0, 0.4);
  background-color: rgba(255, 255, 255, 0.0);
  cursor: pointer;
  user-select: none;
  transition: background-color 0.2s;
}

.scroll-btn.active {
  background-color: rgba(0, 0, 0, 0.1);
}

.scroll-btn span {
  font-size: 32px;
  line-height: 1;
}

.scroll-btn-left {
  border-right: none;
}

.scroll-btn-right {
  border-left: none;
}
</style>
