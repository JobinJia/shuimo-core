<script setup lang="ts">
import { generateFlowerCanvas } from '@shuimo/core'
import { onMounted, ref } from 'vue'

const canvasContainer = ref<HTMLDivElement>()
const currentSeed = ref('')
const isGenerating = ref(false)

function generate(seed?: string) {
  if (!canvasContainer.value || isGenerating.value)
    return

  isGenerating.value = true

  // Clear previous canvas
  canvasContainer.value.innerHTML = ''

  // Use provided seed or generate random
  const finalSeed = seed || Date.now().toString()
  currentSeed.value = finalSeed

  try {
    const canvas = generateFlowerCanvas({
      seed: finalSeed,
      type: 'random',
      width: 600,
      height: 600,
    })

    canvasContainer.value.appendChild(canvas)
  } catch (error) {
    console.error('Failed to generate flower:', error)
  } finally {
    isGenerating.value = false
  }
}

function generateWoody() {
  if (!canvasContainer.value || isGenerating.value)
    return

  isGenerating.value = true
  canvasContainer.value.innerHTML = ''

  const seed = Date.now().toString()
  currentSeed.value = seed

  try {
    const canvas = generateFlowerCanvas({
      seed,
      type: 'woody',
      width: 600,
      height: 600,
    })

    canvasContainer.value.appendChild(canvas)
  } catch (error) {
    console.error('Failed to generate woody flower:', error)
  } finally {
    isGenerating.value = false
  }
}

function generateHerbal() {
  if (!canvasContainer.value || isGenerating.value)
    return

  isGenerating.value = true
  canvasContainer.value.innerHTML = ''

  const seed = Date.now().toString()
  currentSeed.value = seed

  try {
    const canvas = generateFlowerCanvas({
      seed,
      type: 'herbal',
      width: 600,
      height: 600,
    })

    canvasContainer.value.appendChild(canvas)
  } catch (error) {
    console.error('Failed to generate herbal flower:', error)
  } finally {
    isGenerating.value = false
  }
}

function regenerateWithSeed() {
  generate(currentSeed.value)
}

onMounted(() => {
  generate()
})
</script>

<template>
  <div class="flower-canvas-test">
    <h1>Flower Canvas Test</h1>

    <div class="controls">
      <button :disabled="isGenerating" @click="generate()">
        🔄 Random
      </button>
      <button :disabled="isGenerating" @click="generateWoody()">
        🌳 Woody
      </button>
      <button :disabled="isGenerating" @click="generateHerbal()">
        🌿 Herbal
      </button>
      <div class="seed-control">
        <input
          v-model="currentSeed"
          placeholder="Enter seed"
          :disabled="isGenerating"
        >
        <button :disabled="isGenerating" @click="regenerateWithSeed()">
          ♻️ Regenerate
        </button>
      </div>
    </div>

    <div class="canvas-wrapper">
      <div ref="canvasContainer" class="canvas-container" />
    </div>
  </div>
</template>

<style scoped>
.flower-canvas-test {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 2rem;
  min-height: 100vh;
  background: #f5f5f5;
}

h1 {
  margin-bottom: 2rem;
  color: #333;
}

.controls {
  display: flex;
  gap: 1rem;
  margin-bottom: 2rem;
  flex-wrap: wrap;
  justify-content: center;
}

.seed-control {
  display: flex;
  gap: 0.5rem;
}

button {
  padding: 0.75rem 1.5rem;
  font-size: 1rem;
  background: #4CAF50;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.3s;
}

button:hover:not(:disabled) {
  background: #45a049;
}

button:disabled {
  background: #ccc;
  cursor: not-allowed;
}

input {
  padding: 0.75rem;
  font-size: 1rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  width: 200px;
}

.canvas-wrapper {
  background: white;
  padding: 2rem;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.canvas-container {
  min-width: 600px;
  min-height: 600px;
  display: flex;
  justify-content: center;
  align-items: center;
}

.canvas-container canvas {
  display: block;
  border: 1px solid #eee;
}
</style>
