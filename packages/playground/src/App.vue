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

    <!-- Table layout like original shanshui.html -->
    <table class="main-table">
      <tr>
        <!-- Left scroll button -->
        <td>
          <div
            class="scroll-btn scroll-btn-left"
            @click="scrollLeft"
            @mouseenter="hoveredBtn = 'left'"
            @mouseleave="hoveredBtn = null"
            :class="{ active: hoveredBtn === 'left' }"
          >
            <div class="scroll-btn-text">
              <span>‹</span>
            </div>
          </div>
        </td>

        <!-- SVG Canvas -->
        <td>
          <div ref="canvasContainer" class="svg-canvas" :style="canvasStyle"></div>
        </td>

        <!-- Right scroll button -->
        <td>
          <div
            class="scroll-btn scroll-btn-right"
            @click="scrollRight"
            @mouseenter="hoveredBtn = 'right'"
            @mouseleave="hoveredBtn = null"
            :class="{ active: hoveredBtn === 'right' }"
          >
            <div class="scroll-btn-text">
              <span>›</span>
            </div>
          </div>
        </td>
      </tr>
    </table>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { generateShanshui, getSceneStats } from './shanshui';

// State
const showSettings = ref(false);
const seedInput = ref(String(Date.now()));
const scrollStep = ref(200);
const autoScroll = ref(true); // Auto-scroll enabled by default
const hoveredBtn = ref<'left' | 'right' | null>(null);
const canvasContainer = ref<HTMLDivElement | null>(null);
const svgContent = ref('');

// Scroll state
const chunkPreloadDistance = 512;
let currentX = 0; // Current viewBox x position
let targetX = 0; // Target x position for smooth scrolling
let animationFrameId: number | null = null;

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
  currentX = 0;
  targetX = 0;
  renderScene();
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

// Smooth auto-scroll animation
function startAutoScroll() {
  if (animationFrameId !== null) return; // Already running

  const animate = () => {
    if (!autoScroll.value) {
      animationFrameId = null;
      return;
    }

    // Increment target position (slower than original's 1px per ms)
    targetX += 0.5; // 0.5px per frame at 60fps ≈ 30px/sec

    // Smooth interpolation toward target
    const smoothing = 0.1;
    currentX += (targetX - currentX) * smoothing;

    // Update view
    updateView();

    // Continue animation
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

// Manual scroll (instant jump)
function xcroll(v: number) {
  currentX += v;
  targetX = currentX; // Snap target to current
  updateView();
}

// Update the view - checks if chunks need loading
function updateView() {
  const stats = getSceneStats();
  const needsUpdate =
    stats.chunkCount === 0 ||
    currentX < stats.xmin + chunkPreloadDistance ||
    currentX + 3000 > stats.xmax - chunkPreloadDistance;

  if (needsUpdate) {
    update();
  } else {
    viewUpdate();
  }
}

function viewUpdate() {
  const svg = canvasContainer.value?.querySelector('svg');
  if (svg) {
    const zoom = 1.142;
    const viewBox = `${currentX} 0 ${3000 / zoom} ${800 / zoom}`;
    svg.setAttribute('viewBox', viewBox);
  }
}

function update() {
  if (!canvasContainer.value) return;

  const seed = parseInt(seedInput.value) || Date.now();
  const svg = generateShanshui(Math.floor(currentX), seed);

  svgContent.value = svg;
  canvasContainer.value.innerHTML = svg;

  const stats = getSceneStats();
  console.log('update - chunks:', stats.chunkCount, 'xmin:', stats.xmin, 'xmax:', stats.xmax);
}

function renderScene() {
  update();
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

  // Start auto-scroll by default
  if (autoScroll.value) {
    startAutoScroll();
  }
});

onUnmounted(() => {
  stopAutoScroll();
});
</script>

<style scoped>
.shanshui-app {
  margin: 0;
  padding: 0;
  position: relative;
}

/* Main table layout (like original shanshui.html) */
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

/* SVG Canvas */
.svg-canvas {
  width: 3000px; /* Fixed width like original */
  height: 800px;
  background-repeat: repeat;
  background-size: 256px 256px;
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
</style>
