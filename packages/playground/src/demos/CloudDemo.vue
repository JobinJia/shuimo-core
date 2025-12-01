<script setup lang="ts">
import { cloud } from '@shuimo/core'
import { onMounted, ref } from 'vue'

const canvasContainer = ref<HTMLDivElement>()
const seedInput = ref(String(Date.now()))
const width = ref(800)
const height = ref(600)
const size = ref(400)
const color = ref('100,100,100')

// Fractal noise parameters
const octaves = ref(4)
const frequency = ref(0.005)
const threshold = ref(0.3)
const mode = ref<'particles' | 'continuous'>('continuous')

function generate() {
  if (!canvasContainer.value)
    return

  const seed = Number.parseInt(seedInput.value) || Date.now()

  const cloudCanvas = cloud(0, 0, seed, {
    width: width.value,
    height: height.value,
    size: size.value,
    color: color.value,
    octaves: octaves.value,
    frequency: frequency.value,
    threshold: threshold.value,
    mode: mode.value,
  })

  // Clear container and append canvas
  canvasContainer.value.innerHTML = ''
  canvasContainer.value.appendChild(cloudCanvas)
}

function generateNew() {
  seedInput.value = String(Date.now())
  generate()
}

onMounted(() => {
  generate()
})
</script>

<template>
  <div class="cloud-demo">
    <div class="header">
      <h1>Fractal Cloud Generator</h1>
      <p class="subtitle">
        Chinese ink wash style clouds using fractal noise (fBm)
      </p>
    </div>

    <div class="controls">
      <div class="control-section">
        <h3>Basic Settings</h3>

        <div class="control-group">
          <label for="seed-input">Seed:</label>
          <input
            id="seed-input"
            v-model="seedInput"
            type="text"
            @keyup.enter="generate"
          >
        </div>

        <div class="control-row">
          <div class="control-group">
            <label for="width-input">Canvas Width:</label>
            <input
              id="width-input"
              v-model.number="width"
              type="number"
              min="400"
              max="1200"
            >
          </div>

          <div class="control-group">
            <label for="height-input">Canvas Height:</label>
            <input
              id="height-input"
              v-model.number="height"
              type="number"
              min="300"
              max="800"
            >
          </div>
        </div>

        <div class="control-group">
          <label for="size-input">Cloud Size:</label>
          <input
            id="size-input"
            v-model.number="size"
            type="number"
            min="100"
            max="800"
          >
        </div>

        <div class="control-group">
          <label for="color-input">Color (RGB):</label>
          <input
            id="color-input"
            v-model="color"
            type="text"
            placeholder="100,100,100"
          >
        </div>
      </div>

      <div class="control-section">
        <h3>Render Mode</h3>

        <div class="control-group">
          <label>Mode:</label>
          <div class="radio-group">
            <label class="radio-label">
              <input
                v-model="mode"
                type="radio"
                value="continuous"
                @change="generate"
              >
              Continuous (像素纹理)
            </label>
            <label class="radio-label">
              <input
                v-model="mode"
                type="radio"
                value="particles"
                @change="generate"
              >
              Particles (粒子效果)
            </label>
          </div>
        </div>
      </div>

      <div class="control-section">
        <h3>Fractal Noise Settings</h3>

        <div class="control-group">
          <label for="octaves-input">Octaves (Detail):</label>
          <input
            id="octaves-input"
            v-model.number="octaves"
            type="range"
            min="1"
            max="8"
            step="1"
          >
          <span class="value">{{ octaves }}</span>
        </div>

        <div class="control-group">
          <label for="frequency-input">Frequency (Scale):</label>
          <input
            id="frequency-input"
            v-model.number="frequency"
            type="range"
            min="0.001"
            max="0.02"
            step="0.001"
          >
          <span class="value">{{ frequency.toFixed(3) }}</span>
        </div>

        <div class="control-group">
          <label for="threshold-input">Threshold (Density):</label>
          <input
            id="threshold-input"
            v-model.number="threshold"
            type="range"
            min="0.1"
            max="0.6"
            step="0.05"
          >
          <span class="value">{{ threshold.toFixed(2) }}</span>
        </div>
      </div>

      <div class="button-group">
        <button class="btn-primary" @click="generateNew">
          Generate New Cloud
        </button>
        <button class="btn-secondary" @click="generate">
          Regenerate
        </button>
      </div>
    </div>

    <div class="preview">
      <div ref="canvasContainer" class="canvas-display" />
    </div>

    <div class="info">
      <h2>Fractal Noise Based Cloud (fBm)</h2>
      <p>
        This implementation creates realistic cloud formations using <strong>Fractional Brownian Motion (fBm)</strong>,
        a technique that combines multiple octaves of Perlin noise at different frequencies and amplitudes.
        This approach creates natural, billowy clouds similar to traditional Chinese ink wash (水墨) paintings.
      </p>

      <h3>Algorithm: Fractal Noise (fBm)</h3>
      <p>
        The core technique is to layer multiple noise functions with increasing frequency and decreasing amplitude:
      </p>
      <ul>
        <li><strong>Octave 1:</strong> frequency × 1, amplitude × 1.0 (large features)</li>
        <li><strong>Octave 2:</strong> frequency × 2, amplitude × 0.5 (medium details)</li>
        <li><strong>Octave 3:</strong> frequency × 4, amplitude × 0.25 (fine details)</li>
        <li><strong>Octave 4+:</strong> frequency × 8, 16, 32..., amplitude × 0.125, 0.0625... (micro details)</li>
      </ul>
      <p>
        Each octave adds progressively finer detail while contributing less to the overall shape.
        The final noise value determines the density/opacity of particles at each position.
      </p>

      <h3>Render Modes</h3>
      <p>
        Two rendering approaches are available:
      </p>
      <ul>
        <li>
          <strong>Continuous (像素纹理):</strong> Every pixel is sampled from fractal noise.
          Creates smooth, continuous cloud textures similar to the reference image.
          Best for realistic cloud formations.
        </li>
        <li>
          <strong>Particles (粒子效果):</strong> Samples noise every few pixels and renders as overlapping particles.
          Creates soft, ink-wash style clouds with organic edges.
          Best for traditional Chinese painting effects.
        </li>
      </ul>

      <h3>Implementation Steps (Continuous Mode)</h3>
      <ol>
        <li><strong>Pixel Sampling:</strong> For each pixel, calculate fractal noise value at that coordinate</li>
        <li><strong>Apply Threshold:</strong> Values below threshold become transparent, creating cloud shape</li>
        <li><strong>Map to Alpha:</strong> Noise density directly maps to pixel transparency (0-255)</li>
        <li><strong>Render ImageData:</strong> Write RGBA values directly to canvas via putImageData</li>
      </ol>

      <h3>Parameters Explained</h3>
      <ul>
        <li><strong>Octaves:</strong> Number of noise layers (1-8). More octaves = more detail but slower rendering</li>
        <li><strong>Frequency:</strong> Base noise scale (0.001-0.02). Lower = larger cloud features</li>
        <li><strong>Threshold:</strong> Density cutoff (0.1-0.6). Lower = denser/larger clouds, higher = wispy clouds</li>
        <li><strong>Cloud Size:</strong> Bounding box size for the cloud region</li>
      </ul>

      <h3>Why Fractal Noise?</h3>
      <ul>
        <li>✨ <strong>Natural Appearance:</strong> Mimics natural cloud formation through turbulence</li>
        <li>✨ <strong>Multi-scale Detail:</strong> Large billows with fine wisps, just like real clouds</li>
        <li>✨ <strong>Organic Shapes:</strong> No artificial boundaries or geometric artifacts</li>
        <li>✨ <strong>Controllable:</strong> Intuitive parameters for different cloud types</li>
        <li>✨ <strong>Reproducible:</strong> Same seed always generates the same cloud</li>
      </ul>

      <h3>Recommended Presets</h3>
      <ul>
        <li><strong>Fluffy Cumulus:</strong> Octaves: 4, Frequency: 0.005, Threshold: 0.3</li>
        <li><strong>Wispy Cirrus:</strong> Octaves: 6, Frequency: 0.008, Threshold: 0.5</li>
        <li><strong>Dense Storm:</strong> Octaves: 5, Frequency: 0.004, Threshold: 0.2</li>
        <li><strong>Ink Wash Style:</strong> Octaves: 3, Frequency: 0.006, Threshold: 0.35</li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.cloud-demo {
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
  font-size: 1.1rem;
  color: #666;
}

.controls {
  background: #f8f9fa;
  padding: 1.5rem;
  border-radius: 8px;
  margin-bottom: 2rem;
}

.control-section {
  margin-bottom: 1.5rem;
  padding-bottom: 1.5rem;
  border-bottom: 1px solid #ddd;
}

.control-section:last-of-type {
  border-bottom: none;
  margin-bottom: 1rem;
  padding-bottom: 0;
}

.control-section h3 {
  margin-top: 0;
  margin-bottom: 1rem;
  color: #2c3e50;
  font-size: 1.1rem;
}

.control-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  margin-bottom: 1rem;
}

.control-group {
  margin-bottom: 1rem;
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.control-group label {
  font-weight: 500;
  color: #2c3e50;
  min-width: 120px;
}

.control-group input[type="text"],
.control-group input[type="number"] {
  flex: 1;
  padding: 0.5rem;
  font-size: 1rem;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.control-group input[type="range"] {
  flex: 1;
}

.control-group .value {
  min-width: 50px;
  text-align: right;
  font-weight: 500;
  color: #666;
}

.control-group.checkbox {
  margin-bottom: 0.5rem;
}

.control-group.checkbox label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: auto;
  cursor: pointer;
}

.control-group.checkbox input[type="checkbox"] {
  width: 18px;
  height: 18px;
  cursor: pointer;
}

.radio-group {
  display: flex;
  gap: 1.5rem;
  flex: 1;
}

.radio-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  font-weight: normal;
  min-width: auto;
}

.radio-label input[type="radio"] {
  cursor: pointer;
}

.button-group {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
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
  min-width: 200px;
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

.preview {
  display: flex;
  justify-content: center;
  margin-bottom: 2rem;
  min-height: 400px;
}

.canvas-display {
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  padding: 1rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.canvas-display :deep(canvas) {
  max-width: 100%;
  height: auto;
  border: 1px solid #eee;
  background: #f5f5dc;
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

.info ul,
.info ol {
  line-height: 1.8;
  color: #666;
}

.info li {
  margin-bottom: 0.5rem;
}

.info li strong {
  color: #2c3e50;
}

.comparison-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 1rem;
}

.comparison-table th,
.comparison-table td {
  padding: 0.75rem;
  border: 1px solid #ddd;
  text-align: left;
}

.comparison-table th {
  background: #2c3e50;
  color: white;
  font-weight: 600;
}

.comparison-table td {
  background: white;
}

.comparison-table tr:hover td {
  background: #f5f5f5;
}
</style>
