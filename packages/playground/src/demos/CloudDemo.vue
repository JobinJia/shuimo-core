<script setup lang="ts">
import { cloud } from '@shuimo/core'
import { onMounted, ref } from 'vue'

const canvasContainer = ref<HTMLDivElement>()
const seedInput = ref(String(Date.now()))
const width = ref(800)
const height = ref(600)
const size = ref(300)
const color = ref('100,100,100')
const numSegments = ref(4)
const density = ref(1.0)
const radiationHeight = ref(240)
const radiationAngle = ref(90)

function generate() {
  if (!canvasContainer.value)
    return

  const seed = Number.parseInt(seedInput.value) || Date.now()

  const cloudCanvas = cloud(0, 0, seed, {
    width: width.value,
    height: height.value,
    size: size.value,
    color: color.value,
    numSegments: numSegments.value,
    density: density.value,
    radiationHeight: radiationHeight.value,
    radiationAngle: radiationAngle.value,
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
      <h1>Cloud Generator</h1>
      <p class="subtitle">
        Chinese ink wash style clouds with particle radiation
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
            max="600"
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
        <h3>Cloud Structure</h3>

        <div class="control-group">
          <label for="segments-input">Ellipse Segments:</label>
          <input
            id="segments-input"
            v-model.number="numSegments"
            type="range"
            min="1"
            max="8"
            step="1"
          >
          <span class="value">{{ numSegments }}</span>
        </div>

        <div class="control-group">
          <label for="density-input">Density:</label>
          <input
            id="density-input"
            v-model.number="density"
            type="range"
            min="0.3"
            max="2"
            step="0.1"
          >
          <span class="value">{{ density.toFixed(1) }}</span>
        </div>
      </div>

      <div class="control-section">
        <h3>Radiation Settings</h3>

        <div class="control-group">
          <label for="radiation-height-input">Radiation Height:</label>
          <input
            id="radiation-height-input"
            v-model.number="radiationHeight"
            type="range"
            min="50"
            max="500"
            step="10"
          >
          <span class="value">{{ radiationHeight }}px</span>
        </div>

        <div class="control-group">
          <label for="radiation-angle-input">Radiation Angle:</label>
          <input
            id="radiation-angle-input"
            v-model.number="radiationAngle"
            type="range"
            min="45"
            max="135"
            step="5"
          >
          <span class="value">{{ radiationAngle }}°</span>
        </div>
      </div>

      <div class="button-group">
        <button class="btn-primary" @click="generateNew">
          Generate New Shape
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
      <h2>Boundary-based Chinese Ink Wash Cloud</h2>
      <p>
        This implementation creates organic cloud formations using <strong>multiple overlapping ellipse curves</strong>
        to form an irregular boundary, then radiates particles <strong>upward in one direction</strong> to create
        the traditional Chinese ink wash (水墨) cloud effect.
      </p>

      <h3>Algorithm Overview</h3>
      <ul>
        <li><strong>Ellipse Boundary:</strong> 3-5 irregular ellipse curves with Perlin noise distortion</li>
        <li><strong>Overlapping Segments:</strong> Multiple ellipses merge to create organic, non-circular cloud outline</li>
        <li><strong>Unidirectional Radiation:</strong> Particles radiate from boundary points in one direction (default: upward)</li>
        <li><strong>Layered Particles:</strong> 30 vertical layers with decreasing density (40% at max height)</li>
        <li><strong>Gradient Falloff:</strong> Quadratic alpha decay combined with Perlin noise variation</li>
        <li><strong>Size Variation:</strong> Particles range from 0.8-3.0px and shrink with distance</li>
      </ul>

      <h3>Parameters Explained</h3>
      <ul>
        <li><strong>Cloud Size:</strong> Approximate width of the cloud base</li>
        <li><strong>Ellipse Segments:</strong> Number of overlapping ellipses forming the boundary (more = more irregular)</li>
        <li><strong>Density:</strong> Particle count multiplier (higher = denser, darker cloud)</li>
        <li><strong>Radiation Height:</strong> How far particles extend from the boundary</li>
        <li><strong>Radiation Angle:</strong> Direction of particle radiation (90° = straight up, 45° = diagonal)</li>
      </ul>

      <h3>Key Features</h3>
      <ul>
        <li>✅ <strong>Non-circular shapes</strong> from overlapping ellipses</li>
        <li>✅ <strong>Clear boundary edge</strong> at the bottom with fade above</li>
        <li>✅ <strong>Unidirectional radiation</strong> matching reference image</li>
        <li>✅ <strong>Organic, irregular outlines</strong> from Perlin noise distortion</li>
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
