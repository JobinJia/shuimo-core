<script setup lang="ts">
import { generateFlower } from '@shuimo/core'
import { onMounted, ref } from 'vue'

const container = ref<HTMLDivElement>()
const seedInput = ref('')
const plantType = ref<'random' | 'woody' | 'herbal'>('random')
const currentSeed = ref('')

/**
 * Generate flower with seed from input or random
 * If input is empty, generates random seed
 * If input has value, uses that seed
 */
function generate() {
  if (!container.value)
    return

  // Clear previous content
  container.value.innerHTML = ''

  // Use input seed or generate new one
  const seed = seedInput.value || generateRandomSeed()
  currentSeed.value = seed

  // Update input to show the seed being used
  seedInput.value = seed

  try {
    // Generate flower (now returns Canvas instead of SVG)
    const canvas = generateFlower({
      seed,
      type: plantType.value,
      width: 600,
      height: 600,
    })

    // Add to container
    container.value.appendChild(canvas)
  } catch (error) {
    console.error('Failed to generate flower:', error)
    container.value.innerHTML = `<div style="color: red">Error generating flower: ${error}</div>`
  }
}

/**
 * Generate new flower with random seed
 * Clears input and generates completely new flower
 */
function generateNew() {
  // Clear input to force new random seed
  seedInput.value = ''
  generate()
}

/**
 * Generate a random seed string
 * Uses combination of timestamp and random string for uniqueness
 */
function generateRandomSeed(): string {
  const timestamp = Date.now()
  const randomStr = Math.random().toString(36).substring(2, 8)
  return `${timestamp}-${randomStr}`
}

function downloadImage() {
  if (!container.value)
    return

  const canvasElement = container.value.querySelector('canvas')
  if (!canvasElement)
    return

  // Convert canvas to PNG blob
  canvasElement.toBlob((blob) => {
    if (!blob)
      return

    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `flower-${currentSeed.value}.png`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  })
}

onMounted(() => {
  generate()
})
</script>

<template>
  <div class="flower-page">
    <div class="header">
      <h1>Flower Generator</h1>
      <p class="subtitle">
        Procedurally generated paintings of non-existent flowers
      </p>
      <p class="credit">
        Original concept by <a href="https://github.com/LingDong-" target="_blank">Lingdong Huang</a>
        | Canvas implementation for shuimo-core
      </p>
    </div>

    <div class="controls">
      <div class="control-group">
        <label for="seed-input">Seed (leave empty for random):</label>
        <input
          id="seed-input"
          v-model="seedInput"
          type="text"
          placeholder="Enter seed or leave empty"
          @keyup.enter="generate"
        >
      </div>

      <div class="control-group">
        <label for="type-select">Plant Type:</label>
        <select id="type-select" v-model="plantType">
          <option value="random">
            Random
          </option>
          <option value="woody">
            Woody (Tree-like)
          </option>
          <option value="herbal">
            Herbal (Grass-like)
          </option>
        </select>
      </div>

      <div class="button-group">
        <button class="btn-primary" @click="generateNew">
          Generate New Flower
        </button>
        <button class="btn-secondary" @click="generate">
          Regenerate with Current Seed
        </button>
        <button class="btn-secondary" @click="downloadImage">
          Download PNG
        </button>
      </div>

      <div v-if="currentSeed" class="current-seed">
        Current Seed: <code>{{ currentSeed }}</code>
      </div>
    </div>

    <div class="flower-container">
      <div ref="container" class="flower-display" />
    </div>

    <div class="info">
      <h2>About</h2>
      <p>
        This flower generator creates unique, procedurally generated flower paintings
        using algorithms that simulate natural growth patterns. Each flower is entirely
        unique and can be reproduced using its seed value.
      </p>

      <h3>Features</h3>
      <ul>
        <li><strong>Woody Plants:</strong> Tree-like structures with branches, leaves, and flowers</li>
        <li><strong>Herbal Plants:</strong> Grass-like structures with stems, leaves, and flowers at the top</li>
        <li><strong>Perlin Noise:</strong> Smooth, natural-looking variations in shape and color</li>
        <li><strong>3D Rotation:</strong> Leaves and petals are positioned using 3D transformations</li>
        <li><strong>Color Gradients:</strong> Dynamic color interpolation based on lighting</li>
        <li><strong>Reproducible:</strong> Same seed always generates the same flower</li>
      </ul>

      <h3>Technical Details</h3>
      <ul>
        <li>Canvas-based rendering (original algorithm)</li>
        <li>Seedable PRNG using Blum Blum Shub algorithm</li>
        <li>Perlin noise for natural variations</li>
        <li>Image filters (wispy, fade)</li>
        <li>Canvas blend modes for layering effects</li>
        <li>Squircle border clipping</li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.flower-page {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

.header {
  text-align: center;
  margin-bottom: 2rem;
}

.header h1 {
  font-size: 2.5rem;
  margin-bottom: 0.5rem;
  color: #2c3e50;
}

.subtitle {
  font-size: 1.2rem;
  color: #666;
  margin-bottom: 0.5rem;
}

.credit {
  font-size: 0.9rem;
  color: #999;
}

.credit a {
  color: #42b983;
  text-decoration: none;
}

.credit a:hover {
  text-decoration: underline;
}

.controls {
  background: #f8f9fa;
  padding: 1.5rem;
  border-radius: 8px;
  margin-bottom: 2rem;
}

.control-group {
  margin-bottom: 1rem;
}

.control-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
  color: #2c3e50;
}

.control-group input,
.control-group select {
  width: 100%;
  padding: 0.5rem;
  font-size: 1rem;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.button-group {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-top: 1rem;
}

.btn-primary,
.btn-secondary {
  padding: 0.75rem 1.25rem;
  font-size: 0.95rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.3s;
  flex: 1;
  min-width: 150px;
  white-space: nowrap;
}

.btn-primary {
  background: #42b983;
  color: white;
}

.btn-primary:hover {
  background: #38a372;
}

.btn-secondary {
  background: #e0e0e0;
  color: #333;
}

.btn-secondary:hover {
  background: #d0d0d0;
}

.current-seed {
  margin-top: 1rem;
  padding: 0.75rem;
  background: white;
  border-radius: 4px;
  font-size: 0.9rem;
}

.current-seed code {
  background: #f0f0f0;
  padding: 0.25rem 0.5rem;
  border-radius: 3px;
  font-family: 'Courier New', monospace;
}

.flower-container {
  display: flex;
  justify-content: center;
  margin-bottom: 3rem;
}

.flower-display {
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  padding: 1rem;
  min-height: 600px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.flower-display :deep(canvas) {
  max-width: 100%;
  height: auto;
  border: 1px solid #eee;
}

.info {
  background: #f8f9fa;
  padding: 2rem;
  border-radius: 8px;
}

.info h2 {
  color: #2c3e50;
  margin-top: 0;
  margin-bottom: 1rem;
}

.info h3 {
  color: #2c3e50;
  margin-top: 1.5rem;
  margin-bottom: 0.75rem;
}

.info p {
  line-height: 1.6;
  color: #666;
  margin-bottom: 1rem;
}

.info ul {
  line-height: 1.8;
  color: #666;
}

.info li {
  margin-bottom: 0.5rem;
}

.info li strong {
  color: #2c3e50;
}
</style>
