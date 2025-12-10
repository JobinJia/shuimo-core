<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { PaintingGenerator, type BlankPosition, type PaintingType, overrideMathRandom } from '@shuimo/core'

// Override Math.random for reproducible results
overrideMathRandom()

// Form state
const paintingType = ref<PaintingType>('landscape')
const width = ref(1400)
const height = ref(800)
const onXuanPaper = ref(true)
const blankPosition = ref<BlankPosition>('none')
const seed = ref(String(Date.now()))

// Flower options
const flowerType = ref<'woody' | 'herbal' | 'random'>('random')

// Xuan paper options
const xuanPaperAge = ref(0)
const xuanPaperGoldFlecks = ref(false)

// Canvas container
const canvasContainer = ref<HTMLDivElement | null>(null)

// Blank position options
const blankPositionOptions: { value: BlankPosition; label: string }[] = [
  { value: 'none', label: '无留白' },
  { value: 'topLeft', label: '左上' },
  { value: 'top', label: '上方' },
  { value: 'topRight', label: '右上' },
  { value: 'left', label: '左侧' },
  { value: 'center', label: '中心' },
  { value: 'right', label: '右侧' },
  { value: 'bottomLeft', label: '左下' },
  { value: 'bottom', label: '下方' },
  { value: 'bottomRight', label: '右下' },
]

function render() {
  if (!canvasContainer.value) return

  const seedNum = Number.parseInt(seed.value) || Date.now()

  const result = PaintingGenerator.generate({
    type: paintingType.value,
    width: width.value,
    height: height.value,
    onXuanPaper: onXuanPaper.value,
    blankPosition: blankPosition.value,
    seed: seedNum,
    // Flower options
    flowerType: flowerType.value,
    // Xuan paper options
    xuanPaperOptions: {
      age: xuanPaperAge.value,
      goldFlecks: xuanPaperGoldFlecks.value,
    },
  })

  canvasContainer.value.innerHTML = result.svg
}

function randomSeed() {
  seed.value = String(Date.now())
  render()
}

function downloadSVG() {
  if (!canvasContainer.value) return

  const svgContent = canvasContainer.value.innerHTML
  const blob = new Blob([svgContent], { type: 'image/svg+xml' })
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.download = `shuimo-${paintingType.value}-${seed.value}.svg`
  link.click()

  URL.revokeObjectURL(url)
}

onMounted(() => {
  render()
})
</script>

<template>
  <div class="painting-demo">
    <div class="sidebar-controls">
      <h3>画作生成器</h3>

      <!-- Basic Settings -->
      <div class="control-section">
        <h4>基本设置</h4>

        <div class="control-row">
          <label>画作类型</label>
          <select v-model="paintingType">
            <option value="landscape">山水画</option>
            <option value="flowerBird">花鸟画</option>
          </select>
        </div>

        <div class="control-row">
          <label>宽度</label>
          <input v-model.number="width" type="number" min="400" max="2000" step="100">
        </div>

        <div class="control-row">
          <label>高度</label>
          <input v-model.number="height" type="number" min="300" max="1500" step="100">
        </div>

        <div class="control-row">
          <label>随机种子</label>
          <input v-model="seed" type="text">
        </div>
      </div>

      <!-- Paper Settings -->
      <div class="control-section">
        <h4>宣纸设置</h4>

        <div class="control-row checkbox">
          <label>
            <input v-model="onXuanPaper" type="checkbox">
            使用宣纸背景
          </label>
        </div>

        <template v-if="onXuanPaper">
          <div class="control-row">
            <label>陈旧程度</label>
            <input v-model.number="xuanPaperAge" type="range" min="0" max="1" step="0.1">
            <span class="value">{{ xuanPaperAge.toFixed(1) }}</span>
          </div>

          <div class="control-row checkbox">
            <label>
              <input v-model="xuanPaperGoldFlecks" type="checkbox">
              洒金效果
            </label>
          </div>
        </template>
      </div>

      <!-- Composition Settings -->
      <div class="control-section">
        <h4>构图设置（留白）</h4>

        <div class="control-row">
          <label>留白位置</label>
          <select v-model="blankPosition">
            <option
              v-for="opt in blankPositionOptions"
              :key="opt.value"
              :value="opt.value"
            >
              {{ opt.label }}
            </option>
          </select>
        </div>

        <!-- Blank position visual hint -->
        <div class="blank-hint">
          <div
            class="blank-grid"
            :class="`blank-${blankPosition}`"
          >
            <div v-for="i in 9" :key="i" class="blank-cell" />
          </div>
          <p class="hint-text">浅色区域不生成元素</p>
        </div>
      </div>

      <!-- Flower Options -->
      <div v-if="paintingType === 'flowerBird'" class="control-section">
        <h4>花鸟画设置</h4>

        <div class="control-row">
          <label>花卉类型</label>
          <select v-model="flowerType">
            <option value="random">随机</option>
            <option value="woody">木本</option>
            <option value="herbal">草本</option>
          </select>
        </div>
      </div>

      <!-- Actions -->
      <div class="control-section actions">
        <button class="btn-primary" @click="render">
          生成画作
        </button>
        <button @click="randomSeed">
          随机种子
        </button>
        <button @click="downloadSVG">
          下载 SVG
        </button>
      </div>
    </div>

    <div class="canvas-area">
      <div ref="canvasContainer" class="canvas-container" />
    </div>
  </div>
</template>

<style scoped>
.painting-demo {
  display: flex;
  height: 100%;
  width: 100%;
}

.sidebar-controls {
  width: 280px;
  background: #fff;
  border-right: 1px solid #ddd;
  padding: 16px;
  overflow-y: auto;
  flex-shrink: 0;
}

.sidebar-controls h3 {
  margin: 0 0 16px;
  font-size: 18px;
  color: #333;
  padding-bottom: 12px;
  border-bottom: 2px solid #3498db;
}

.control-section {
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid #eee;
}

.control-section:last-child {
  border-bottom: none;
}

.control-section h4 {
  margin: 0 0 12px;
  font-size: 14px;
  color: #666;
  font-weight: 600;
}

.control-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}

.control-row label {
  flex-shrink: 0;
  width: 80px;
  font-size: 13px;
  color: #555;
}

.control-row.checkbox label {
  width: auto;
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
}

.control-row input[type="text"],
.control-row input[type="number"],
.control-row select {
  flex: 1;
  padding: 6px 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 13px;
}

.control-row input[type="range"] {
  flex: 1;
}

.control-row .value {
  width: 40px;
  text-align: right;
  font-size: 12px;
  color: #888;
}

.blank-hint {
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.hint-text {
  margin: 0;
  font-size: 11px;
  color: #999;
}

.blank-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 2px;
  width: 90px;
  height: 60px;
  background: #ddd;
  padding: 2px;
  border-radius: 4px;
}

.blank-cell {
  background: #666;
  border-radius: 2px;
  transition: background 0.2s;
}

/* Blank position highlighting */
.blank-none .blank-cell {
  background: #666;
}

.blank-topLeft .blank-cell:nth-child(1),
.blank-topLeft .blank-cell:nth-child(2),
.blank-topLeft .blank-cell:nth-child(4) {
  background: #f5f5dc;
}

.blank-top .blank-cell:nth-child(1),
.blank-top .blank-cell:nth-child(2),
.blank-top .blank-cell:nth-child(3) {
  background: #f5f5dc;
}

.blank-topRight .blank-cell:nth-child(2),
.blank-topRight .blank-cell:nth-child(3),
.blank-topRight .blank-cell:nth-child(6) {
  background: #f5f5dc;
}

.blank-left .blank-cell:nth-child(1),
.blank-left .blank-cell:nth-child(4),
.blank-left .blank-cell:nth-child(7) {
  background: #f5f5dc;
}

.blank-center .blank-cell:nth-child(5) {
  background: #f5f5dc;
}

.blank-right .blank-cell:nth-child(3),
.blank-right .blank-cell:nth-child(6),
.blank-right .blank-cell:nth-child(9) {
  background: #f5f5dc;
}

.blank-bottomLeft .blank-cell:nth-child(4),
.blank-bottomLeft .blank-cell:nth-child(7),
.blank-bottomLeft .blank-cell:nth-child(8) {
  background: #f5f5dc;
}

.blank-bottom .blank-cell:nth-child(7),
.blank-bottom .blank-cell:nth-child(8),
.blank-bottom .blank-cell:nth-child(9) {
  background: #f5f5dc;
}

.blank-bottomRight .blank-cell:nth-child(6),
.blank-bottomRight .blank-cell:nth-child(8),
.blank-bottomRight .blank-cell:nth-child(9) {
  background: #f5f5dc;
}

.actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.actions button {
  padding: 10px 16px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: #fff;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}

.actions button:hover {
  background: #f5f5f5;
}

.actions .btn-primary {
  background: #3498db;
  color: #fff;
  border-color: #3498db;
}

.actions .btn-primary:hover {
  background: #2980b9;
}

.canvas-area {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #e5e5e5;
  padding: 20px;
  overflow: auto;
}

.canvas-container {
  background: #fff;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  border-radius: 4px;
}

.canvas-container :deep(svg) {
  display: block;
}
</style>
