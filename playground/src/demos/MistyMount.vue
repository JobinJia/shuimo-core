<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { Mount, prng } from '@shuimo/core'

const seedInput = ref(String(Date.now()))
const canvasContainer = ref<HTMLDivElement | null>(null)
const filterContainer = ref<HTMLDivElement | null>(null)

function render() {
  if (!canvasContainer.value) return

  const seed = Number.parseInt(seedInput.value) || Date.now()
  prng.seed(seed)

  const width = 1400
  const height = 700

  const content = Mount.mistyMount(700, 500, seed, {
    hei: 180,
    len: 1400,
    layers: 1,
  })

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <rect width="${width}" height="${height}" fill="#f5f5dc"/>
    ${content}
  </svg>`

  canvasContainer.value.innerHTML = svg

  // 渲染滤镜对照
  renderFilterDemo(seed)
}

function renderFilterDemo(seed: number) {
  if (!filterContainer.value) return

  prng.seed(seed)

  const width = 1400
  const height = 700

  // 使用 filterOnly 选项只渲染滤镜层
  const filterContent = Mount.mistyMount(700, 500, seed, {
    hei: 180,
    len: 1400,
    layers: 1,
    filterOnly: true,
  })

  const filterSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <rect width="${width}" height="${height}" fill="#f5f5dc"/>
    ${filterContent}
  </svg>`

  filterContainer.value.innerHTML = filterSvg
}

function randomSeed() {
  seedInput.value = String(Date.now())
  render()
}

onMounted(() => {
  render()
})
</script>

<template>
  <div class="misty-mount-demo">
    <div class="toolbar">
      <div class="control-group">
        <label>Seed</label>
        <input
          v-model="seedInput"
          type="text"
          @keyup.enter="render"
        >
        <button @click="randomSeed">Random</button>
        <button @click="render">Render</button>
      </div>
    </div>
    <div class="canvas-area">
      <div class="canvas-wrapper">
        <div ref="canvasContainer" class="canvas-container" />
        <div ref="filterContainer" class="filter-container" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.misty-mount-demo {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
}

.toolbar {
  padding: 16px;
  background: #fff;
  border-bottom: 1px solid #ddd;
  display: flex;
  gap: 16px;
  align-items: center;
}

.control-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.control-group label {
  font-size: 14px;
  color: #666;
}

.control-group input {
  padding: 6px 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  width: 160px;
}

.control-group button {
  padding: 6px 14px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: #fff;
  cursor: pointer;
}

.control-group button:hover {
  background: #f5f5f5;
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

.canvas-wrapper {
  display: flex;
  flex-direction: column;
  gap: 20px;
  align-items: center;
}

.canvas-container {
  background: #fff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  border-radius: 4px;
}

.filter-container {
  background: #fff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  border-radius: 4px;
}
</style>
