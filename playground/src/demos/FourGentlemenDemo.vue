<script setup lang="ts">
import { onMounted, ref } from 'vue'
import {
  Bamboo,
  Orchid,
  WinterPlum,
  Chrysanthemum,
  prng
} from '@shuimo/core'

// Element types
type ElementType = 'bamboo' | 'orchid' | 'winterPlum' | 'chrysanthemum'

// State
const selectedElement = ref<ElementType>('bamboo')
const seedInput = ref(String(Date.now()))
const canvasContainer = ref<HTMLDivElement | null>(null)

// Element configurations for the menu
const elements = [
  { id: 'bamboo' as ElementType, name: 'Bamboo', chinese: '竹' },
  { id: 'orchid' as ElementType, name: 'Orchid', chinese: '兰' },
  { id: 'winterPlum' as ElementType, name: 'Winter Plum', chinese: '梅' },
  { id: 'chrysanthemum' as ElementType, name: 'Chrysanthemum', chinese: '菊' },
]

// Generate element with appropriate sizing
function generateElement(type: ElementType, seed: number): string {
  prng.seed(seed)

  let width = 600
  let height = 600
  let content = ''

  switch (type) {
    case 'bamboo':
      width = 500
      height = 600
      content = Bamboo.generate(150, 550, seed, {
        hei: 450,
        wid: 10,
        seg: 6,
        leaves: true,
        leafDensity: 0.7,
        bend: 0.25,
        stalks: 3,
        col: 'rgba(50,70,50,0.85)'
      })
      break

    case 'orchid':
      width = 500
      height = 500
      content = Orchid.generate(250, 400, seed, {
        leafCount: 6,
        leafLength: 180,
        hasFlower: true,
        flowerCount: 2,
        col: 'rgba(45,65,45,0.85)',
        flowerCol: 'rgba(100,80,100,0.8)'
      })
      break

    case 'winterPlum':
      width = 600
      height = 550
      content = WinterPlum.generate(100, 500, seed, {
        hei: 350,
        wid: 12,
        branches: 2,
        flowerDensity: 0.5,
        flowerColor: 'rgba(200,170,120,0.85)',
        withBuds: true,
        col: 'rgba(60,45,35,0.9)'
      })
      break

    case 'chrysanthemum':
      width = 450
      height = 550
      content = Chrysanthemum.generate(225, 200, seed, {
        size: 80,
        petalLayers: 5,
        petalCount: 14,
        withStem: true,
        withLeaves: true,
        col: 'rgba(200,180,80,0.85)',
        stemCol: 'rgba(50,70,45,0.85)'
      })
      break
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <rect width="${width}" height="${height}" fill="#f8f6f0"/>
    ${content}
  </svg>`
}

function renderElement() {
  if (!canvasContainer.value) return

  const seed = Number.parseInt(seedInput.value) || Date.now()
  const svg = generateElement(selectedElement.value, seed)
  canvasContainer.value.innerHTML = svg
}

function selectElement(type: ElementType) {
  selectedElement.value = type
  renderElement()
}

function regenerateWithSeed() {
  renderElement()
}

function randomSeed() {
  seedInput.value = String(Date.now())
  renderElement()
}

function downloadSVG() {
  if (!canvasContainer.value) return

  const svgElement = canvasContainer.value.querySelector('svg')
  if (!svgElement) return

  const serializer = new XMLSerializer()
  const svgString = serializer.serializeToString(svgElement)
  const blob = new Blob([svgString], { type: 'image/svg+xml' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${selectedElement.value}-${Date.now()}.svg`
  link.click()
  URL.revokeObjectURL(url)
}

onMounted(() => {
  seedInput.value = String(Date.now())
  renderElement()
})
</script>

<template>
  <div class="four-gentlemen-demo">
    <div class="sidebar">
      <div class="sidebar-header">
        <h3>Four Gentlemen</h3>
        <p class="subtitle">梅兰竹菊 - The Four Noble Plants</p>
      </div>

      <div class="controls">
        <div class="control-group">
          <label>Seed</label>
          <div class="input-group">
            <input
              v-model="seedInput"
              type="text"
              placeholder="Seed"
              @keyup.enter="regenerateWithSeed"
            >
            <button @click="randomSeed" title="Random seed">
              🎲
            </button>
          </div>
        </div>

        <div class="control-group">
          <button class="regenerate-btn" @click="randomSeed">
            🔄 Regenerate
          </button>
        </div>

        <div class="control-group">
          <button class="download-btn" @click="downloadSVG">
            Download SVG
          </button>
        </div>
      </div>

      <div class="element-menu">
        <div class="category-name">
          Select Element
        </div>
        <div class="element-list">
          <button
            v-for="element in elements"
            :key="element.id"
            class="element-btn"
            :class="{ active: selectedElement === element.id }"
            @click="selectElement(element.id)"
          >
            <span class="chinese">{{ element.chinese }}</span>
            <span class="english">{{ element.name }}</span>
          </button>
        </div>
      </div>

      <div class="info-panel">
        <div class="info-title">About Four Gentlemen</div>
        <p class="info-text">
          The Four Gentlemen (四君子) represent the four seasons and noble qualities
          in traditional Chinese painting:
        </p>
        <ul class="info-list">
          <li><strong>Plum (梅)</strong> - Winter, resilience</li>
          <li><strong>Orchid (兰)</strong> - Spring, elegance</li>
          <li><strong>Bamboo (竹)</strong> - Summer, integrity</li>
          <li><strong>Chrysanthemum (菊)</strong> - Autumn, humility</li>
        </ul>
      </div>
    </div>

    <div class="canvas-area">
      <div ref="canvasContainer" class="canvas-container" />
    </div>
  </div>
</template>

<style scoped>
.four-gentlemen-demo {
  display: flex;
  height: 100%;
  width: 100%;
}

.sidebar {
  width: 300px;
  background-color: #fff;
  border-right: 1px solid #ddd;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}

.sidebar-header {
  padding: 20px;
  border-bottom: 1px solid #ddd;
  background: linear-gradient(135deg, #f8f6f0 0%, #fff 100%);
}

.sidebar-header h3 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: #333;
}

.subtitle {
  margin: 8px 0 0;
  font-size: 13px;
  color: #666;
}

.controls {
  padding: 16px;
  border-bottom: 1px solid #ddd;
}

.control-group {
  margin-bottom: 12px;
}

.control-group:last-child {
  margin-bottom: 0;
}

.control-group label {
  display: block;
  font-size: 12px;
  font-weight: 500;
  color: #666;
  margin-bottom: 6px;
}

.input-group {
  display: flex;
  gap: 4px;
}

.input-group input {
  flex: 1;
  padding: 6px 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 13px;
}

.input-group button {
  padding: 6px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background-color: #fff;
  cursor: pointer;
  font-size: 13px;
}

.input-group button:hover {
  background-color: #f5f5f5;
}

.regenerate-btn {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #5d7c5d;
  border-radius: 4px;
  background-color: #5d7c5d;
  color: white;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  transition: all 0.2s;
}

.regenerate-btn:hover {
  background-color: #4a6b4a;
  border-color: #4a6b4a;
}

.download-btn {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background-color: #fff;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
}

.download-btn:hover {
  background-color: #f5f5f5;
}

.element-menu {
  padding: 16px;
  border-bottom: 1px solid #ddd;
}

.category-name {
  font-size: 12px;
  font-weight: 600;
  color: #666;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 12px;
}

.element-list {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.element-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12px 8px;
  border: 1px solid #ddd;
  border-radius: 8px;
  background-color: #fafafa;
  cursor: pointer;
  transition: all 0.2s;
}

.element-btn:hover {
  background-color: #f0f0f0;
  border-color: #ccc;
}

.element-btn.active {
  background-color: #5d7c5d;
  color: white;
  border-color: #5d7c5d;
}

.element-btn .chinese {
  font-size: 24px;
  margin-bottom: 4px;
}

.element-btn .english {
  font-size: 11px;
  opacity: 0.8;
}

.info-panel {
  flex: 1;
  padding: 16px;
  background-color: #fafafa;
}

.info-title {
  font-size: 13px;
  font-weight: 600;
  color: #333;
  margin-bottom: 8px;
}

.info-text {
  font-size: 12px;
  color: #666;
  line-height: 1.5;
  margin: 0 0 12px;
}

.info-list {
  font-size: 12px;
  color: #666;
  line-height: 1.8;
  margin: 0;
  padding-left: 16px;
}

.info-list strong {
  color: #333;
}

.canvas-area {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #e8e6e0;
  padding: 20px;
  overflow: auto;
}

.canvas-container {
  background-color: #f8f6f0;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  border-radius: 4px;
  overflow: hidden;
}

.canvas-container :deep(svg) {
  display: block;
}
</style>
