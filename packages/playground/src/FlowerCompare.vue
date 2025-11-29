<script setup lang="ts">
import { generateFlower } from '@shuimo/core'
import { ref } from 'vue'

const svgContainer = ref<HTMLDivElement>()
const originalIframe = ref<HTMLIFrameElement>()

const currentSeed = ref('')

/**
 * Generate both versions with same params
 */
function generateBoth() {
  // ALWAYS generate a new random seed on each click
  const timestamp = Date.now()
  const randomStr = Math.random().toString(36).substring(2, 7)
  currentSeed.value = `${timestamp}-${randomStr}`

  // Generate both versions with the same seed
  generateOriginalVersion()
  generateSVGVersion()
}

/**
 * Generate original Canvas version using iframe
 */
function generateOriginalVersion() {
  if (!originalIframe.value) {
    console.error('Iframe not ready')
    return
  }

  try {
    // Reload iframe with seed parameter
    const baseUrl = '/reference-code/flowers/index.html'
    const url = `${baseUrl}?seed=${currentSeed.value}`
    originalIframe.value.src = url
  } catch (error) {
    console.error('Original Canvas Error:', error)
  }
}

/**
 * Generate SVG version
 */
function generateSVGVersion() {
  if (!svgContainer.value)
    return

  svgContainer.value.innerHTML = ''

  try {
    // Generate flower with same seed as original
    const svg = generateFlower({
      seed: currentSeed.value,
      type: 'random', // Match original's Math.random() <= 0.5 logic
      width: 600,
      height: 600,
      background: 'paper',
    })

    svgContainer.value.appendChild(svg)
  } catch (error) {
    console.error('❌ SVG Error:', error)
    svgContainer.value.innerHTML = `<div style="color: red; padding: 20px;">
      <h3>SVG Error:</h3>
      <pre>${error}</pre>
    </div>`
  }
}
</script>

<template>
  <div class="compare-page">
    <!-- Top: Parameters Control Area -->
    <div class="params-area">
      <div class="header">
        <h1>Flower Parameter Comparison</h1>
        <p class="subtitle">
          Compare SVG implementation with original Canvas using exact same parameters
        </p>
      </div>

      <div class="controls">
        <div class="control-row">
          <div class="control-group full-width">
            <label for="seed-input">Current Seed (auto-generated on each click):</label>
            <input
              id="seed-input"
              v-model="currentSeed"
              type="text"
              readonly
              placeholder="Click 'Generate Both' to create flowers"
            >
          </div>
        </div>

        <div class="button-group">
          <button class="btn-primary" @click="generateBoth">
            🎲 Generate Both (New Random Seed)
          </button>
        </div>

        <div class="info-box">
          <p><strong>How it works:</strong></p>
          <ul>
            <li>Each click generates a <strong>new random seed</strong></li>
            <li>Both versions use the <strong>exact same seed</strong></li>
            <li>Plant type (woody/herbal) is randomly decided by the seed</li>
            <li>If the flowers match perfectly, the implementation is correct! ✅</li>
          </ul>
        </div>
      </div>
    </div>

    <!-- Bottom: Side by Side Comparison -->
    <div class="comparison-area">
      <div class="comparison-panel">
        <h2>Original Canvas Implementation</h2>
        <div class="iframe-container">
          <iframe
            v-if="currentSeed"
            ref="originalIframe"
            :key="currentSeed"
            :src="`/reference-code/flowers/index.html?seed=${currentSeed}`"
            frameborder="0"
          />
          <div v-else class="placeholder-hint">
            Click "Generate Both" to start
          </div>
        </div>
      </div>

      <div class="comparison-panel">
        <h2>SVG Implementation</h2>
        <div ref="svgContainer" class="flower-display" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.compare-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
}

/* Top: Parameters Area */
.params-area {
  flex-shrink: 0;
  background: #f8f9fa;
  border-bottom: 2px solid #ddd;
  padding: 1.5rem 2rem;
  overflow-y: auto;
  max-height: 40vh;
}

.header {
  text-align: center;
  margin-bottom: 1.5rem;
}

.header h1 {
  font-size: 1.75rem;
  margin-bottom: 0.25rem;
  color: #2c3e50;
}

.subtitle {
  font-size: 0.95rem;
  color: #666;
  margin: 0;
}

.controls {
  max-width: 1200px;
  margin: 0 auto;
}

.control-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  margin-bottom: 1rem;
}

.control-group {
  margin-bottom: 1rem;
}

.control-group.full-width {
  grid-column: 1 / -1;
}

.control-group input[readonly] {
  background: #f5f5f5;
  cursor: not-allowed;
  color: #666;
  font-family: monospace;
  font-size: 0.9rem;
}

.control-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
  color: #2c3e50;
  font-size: 0.9rem;
}

.control-group input,
.control-group select,
.control-group textarea {
  width: 100%;
  padding: 0.5rem;
  font-size: 0.95rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-family: inherit;
  box-sizing: border-box;
}

.control-group textarea {
  font-family: monospace;
  font-size: 0.85rem;
  resize: vertical;
}

.button-group {
  display: flex;
  gap: 1rem;
  justify-content: center;
}

.btn-primary {
  padding: 0.75rem 2rem;
  font-size: 1rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.3s;
  background: #42b983;
  color: white;
}

.btn-primary:hover {
  background: #38a372;
}

.info-box {
  background: #e7f3ff;
  border-left: 3px solid #42b983;
  padding: 1rem;
  border-radius: 4px;
  margin-top: 1rem;
}

.info-box p {
  margin: 0 0 0.5rem 0;
  color: #2c3e50;
}

.info-box ul {
  margin: 0;
  padding-left: 1.5rem;
  color: #555;
}

.info-box li {
  margin: 0.25rem 0;
  line-height: 1.5;
}

/* Bottom: Comparison Area */
.comparison-area {
  flex: 1;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0;
  min-height: 0;
  overflow: hidden;
}

.comparison-panel {
  display: flex;
  flex-direction: column;
  border-right: 1px solid #ddd;
  background: white;
  overflow: hidden;
}

.comparison-panel:last-child {
  border-right: none;
}

.comparison-panel h2 {
  margin: 0;
  padding: 1rem;
  background: #2c3e50;
  color: white;
  font-size: 1.1rem;
  text-align: center;
  flex-shrink: 0;
}

.iframe-container {
  flex: 1;
  position: relative;
  overflow: hidden;
}

.iframe-container iframe {
  width: 100%;
  height: 100%;
  border: none;
}

.placeholder-hint {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #999;
  font-size: 1.1rem;
}

.flower-display {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: auto;
  padding: 1rem;
  background: white;
}

.flower-display :deep(svg),
.flower-display :deep(canvas) {
  max-width: 100%;
  max-height: 100%;
}
</style>
