<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { Mount, Tree, Water, Cloud, Arch, Man, overrideMathRandom, prng } from '@shuimo/core'

// Initialize Math.random override
overrideMathRandom()

// Element types
type ElementType =
  | 'mountain'
  | 'flatMount'
  | 'distMount'
  | 'rock'
  | 'tree01'
  | 'tree02'
  | 'tree03'
  | 'tree04'
  | 'tree05'
  | 'tree06'
  | 'tree07'
  | 'tree08'
  | 'water'
  | 'cloud'
  | 'arch01'
  | 'arch02'
  | 'arch03'
  | 'arch04'
  | 'boat'
  | 'tower'
  | 'man'

// State
const selectedElement = ref<ElementType>('mountain')
const seedInput = ref(String(Date.now()))
const canvasContainer = ref<HTMLDivElement | null>(null)

// Element categories for the menu
const elementCategories = [
  {
    name: 'Natural - Mountains',
    elements: [
      { id: 'mountain' as ElementType, name: 'Mountain' },
      { id: 'flatMount' as ElementType, name: 'Flat Mount' },
      { id: 'distMount' as ElementType, name: 'Distant Mount' },
      { id: 'rock' as ElementType, name: 'Rock' },
    ],
  },
  {
    name: 'Natural - Trees',
    elements: [
      { id: 'tree01' as ElementType, name: 'Tree Type 1' },
      { id: 'tree02' as ElementType, name: 'Tree Type 2' },
      { id: 'tree03' as ElementType, name: 'Tree Type 3' },
      { id: 'tree04' as ElementType, name: 'Tree Type 4' },
      { id: 'tree05' as ElementType, name: 'Tree Type 5' },
      { id: 'tree06' as ElementType, name: 'Tree Type 6' },
      { id: 'tree07' as ElementType, name: 'Tree Type 7' },
      { id: 'tree08' as ElementType, name: 'Tree Type 8' },
    ],
  },
  {
    name: 'Natural - Water & Cloud',
    elements: [
      { id: 'water' as ElementType, name: 'Water' },
      { id: 'cloud' as ElementType, name: 'Cloud' },
    ],
  },
  {
    name: 'Objects - Architecture',
    elements: [
      { id: 'arch01' as ElementType, name: 'Arch Type 1' },
      { id: 'arch02' as ElementType, name: 'Arch Type 2' },
      { id: 'arch03' as ElementType, name: 'Arch Type 3' },
      { id: 'arch04' as ElementType, name: 'Arch Type 4' },
      { id: 'boat' as ElementType, name: 'Boat' },
      { id: 'tower' as ElementType, name: 'Transmission Tower' },
    ],
  },
  {
    name: 'Objects - People',
    elements: [
      { id: 'man' as ElementType, name: 'Man' },
    ],
  },
]

// Generate element with appropriate sizing and centered positioning
function generateElement(type: ElementType, seed: number): string {
  prng.seed(seed)

  let width = 800
  let height = 600
  let content = ''

  // Adjust canvas size and position based on element type
  // Position elements at the bottom center of the canvas
  switch (type) {
    case 'mountain':
      // Mountain draws from xoff-wid/2 to xoff+wid/2, and from yoff-hei upwards
      // With trees and textures extending beyond, need extra space
      width = 1200
      height = 900
      content = Mount.mountain(600, 550, seed, {
        hei: 350,
        wid: 500,
        veg: true,
      }) as string
      break

    case 'flatMount':
      width = 1100
      height = 650
      content = Mount.flatMount(550, 450, seed, {
        hei: 180,
        wid: 600,
      }) as string
      break

    case 'distMount':
      // Distant mount draws from xoff to xoff+len
      width = 1400
      height = 550
      content = Mount.distMount(250, 350, seed, {
        hei: 120,
        len: 900,
      }) as string
      break

    case 'rock':
      // Rock draws centered around xoff, yoff
      width = 900
      height = 800
      content = Mount.rock(450, 500, seed, {
        hei: 250,
        wid: 350,
      }) as string
      break

    case 'tree01':
      width = 500
      height = 600
      content = Tree.tree01(250, 500, seed, { hei: 350 }) as string
      break

    case 'tree02':
      width = 500
      height = 600
      content = Tree.tree02(250, 500, seed, { hei: 350 }) as string
      break

    case 'tree03':
      width = 500
      height = 600
      content = Tree.tree03(250, 500, seed, { hei: 350 }) as string
      break

    case 'tree04':
      width = 500
      height = 600
      content = Tree.tree04(250, 500, seed, { hei: 350 }) as string
      break

    case 'tree05':
      width = 500
      height = 600
      content = Tree.tree05(250, 500, seed, { hei: 350 }) as string
      break

    case 'tree06':
      width = 500
      height = 600
      content = Tree.tree06(250, 500, seed, { hei: 350 }) as string
      break

    case 'tree07':
      width = 500
      height = 600
      content = Tree.tree07(250, 500, seed, { hei: 350 }) as string
      break

    case 'tree08':
      width = 500
      height = 600
      content = Tree.tree08(250, 500, seed, { hei: 350 }) as string
      break

    case 'water':
      // Water draws waves centered around xoff (from -len/2 to +len/2)
      // with vertical position at yoff
      width = 1100
      height = 600
      content = Water.generate(550, 300, seed, { len: 900, hei: 10, clu: 15 }) as string
      break

    case 'cloud':
      // Cloud generates on a canvas
      // centerX = width/2 + xoff, centerY = height/2 + yoff
      // To center cloud, use xoff=0, yoff=0
      width = 900
      height = 700
      const cloudSize = 450
      const canvas = Cloud.generate(0, 0, seed, {
        size: cloudSize,
        width: width,
        height: height
      })
      content = `<image x="0" y="0" width="${width}" height="${height}" href="${canvas.toDataURL()}" />`
      break

    case 'arch01':
      // Arch01 draws upward from yoff, simple arch
      width = 700
      height = 700
      content = Arch.arch01(350, 550, seed, { hei: 250 }) as string
      break

    case 'arch02':
      // Arch02 has multiple stories (sto=3), each hei tall, draws upward from yoff
      width = 700
      height = 900
      content = Arch.arch02(350, 800, seed, { hei: 100 }) as string
      break

    case 'arch03':
      // Arch03 similar to arch02
      width = 700
      height = 900
      content = Arch.arch03(350, 800, seed, { hei: 60 }) as string
      break

    case 'arch04':
      // Arch04 similar to arch02
      width = 700
      height = 900
      content = Arch.arch04(350, 800, seed, { hei: 160 }) as string
      break

    case 'boat':
      width = 700
      height = 500
      content = Arch.boat01(350, 300, seed, { len: 250 }) as string
      break

    case 'tower':
      width = 600
      height = 800
      content = Arch.transmissionTower01(300, 700, seed, { hei: 600 }) as string
      break

    case 'man':
      width = 500
      height = 600
      content = Man.man(250, 500, seed, { hei: 250 }) as string
      break
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <rect width="${width}" height="${height}" fill="#f5f5dc"/>
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
  <div class="elements-demo">
    <div class="sidebar">
      <div class="sidebar-header">
        <h3>Shanshui Elements</h3>
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
        <div
          v-for="category in elementCategories"
          :key="category.name"
          class="category"
        >
          <div class="category-name">
            {{ category.name }}
          </div>
          <div class="element-list">
            <button
              v-for="element in category.elements"
              :key="element.id"
              class="element-btn"
              :class="{ active: selectedElement === element.id }"
              @click="selectElement(element.id)"
            >
              {{ element.name }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="canvas-area">
      <div ref="canvasContainer" class="canvas-container" />
    </div>
  </div>
</template>

<style scoped>
.elements-demo {
  display: flex;
  height: 100%;
  width: 100%;
}

.sidebar {
  width: 280px;
  background-color: #fff;
  border-right: 1px solid #ddd;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}

.sidebar-header {
  padding: 20px;
  border-bottom: 1px solid #ddd;
}

.sidebar-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #333;
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
  border: 1px solid #3498db;
  border-radius: 4px;
  background-color: #3498db;
  color: white;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  transition: all 0.2s;
}

.regenerate-btn:hover {
  background-color: #2980b9;
  border-color: #2980b9;
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
  flex: 1;
  padding: 16px;
  overflow-y: auto;
}

.category {
  margin-bottom: 20px;
}

.category:last-child {
  margin-bottom: 0;
}

.category-name {
  font-size: 12px;
  font-weight: 600;
  color: #666;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 8px;
}

.element-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.element-btn {
  width: 100%;
  padding: 8px 12px;
  text-align: left;
  border: 1px solid transparent;
  border-radius: 4px;
  background-color: transparent;
  cursor: pointer;
  font-size: 13px;
  color: #333;
  transition: all 0.2s;
}

.element-btn:hover {
  background-color: #f5f5f5;
  border-color: #ddd;
}

.element-btn.active {
  background-color: #3498db;
  color: white;
  border-color: #3498db;
}

.canvas-area {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #f5f5f5;
  padding: 20px;
  overflow: auto;
}

.canvas-container {
  background-color: white;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  border-radius: 4px;
  overflow: hidden;
}

.canvas-container :deep(svg) {
  display: block;
}
</style>
