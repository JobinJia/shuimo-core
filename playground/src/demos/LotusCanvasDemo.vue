<script setup lang="ts">
import { generateFlowerCanvas } from "@jobinjia/shuimo-core";
import { onMounted, ref } from "vue";

const canvasContainer = ref<HTMLDivElement>();
const currentSeed = ref("");
const isGenerating = ref(false);

const PRESET_SEEDS = ["1", "42", "100", "256", "1024"];

function generate(seed?: string) {
  if (!canvasContainer.value || isGenerating.value) return;
  isGenerating.value = true;
  canvasContainer.value.innerHTML = "";

  const finalSeed = seed || Date.now().toString();
  currentSeed.value = finalSeed;

  try {
    const canvas = generateFlowerCanvas({
      seed: finalSeed,
      species: "lotus",
      width: 600,
      height: 600,
    });
    canvasContainer.value.appendChild(canvas);
  } catch (err) {
    canvasContainer.value.innerHTML = `<pre style="color:#c00">${String(err)}</pre>`;
  } finally {
    isGenerating.value = false;
  }
}

function regenerateWithSeed() {
  generate(currentSeed.value);
}

onMounted(() => {
  generate("42");
});
</script>

<template>
  <div class="lotus-canvas-demo">
    <h1>荷花 Lotus · Canvas</h1>
    <p class="subtitle">species preset · 单花 + 多叶 · 留白构图</p>

    <div class="controls">
      <button :disabled="isGenerating" @click="generate()">🎲 Random</button>
      <button
        v-for="s in PRESET_SEEDS"
        :key="s"
        :disabled="isGenerating"
        @click="generate(s)"
      >
        seed {{ s }}
      </button>
      <div class="seed-control">
        <input v-model="currentSeed" placeholder="Enter seed" :disabled="isGenerating" />
        <button :disabled="isGenerating" @click="regenerateWithSeed()">♻️ Regenerate</button>
      </div>
    </div>

    <div class="canvas-wrapper">
      <div ref="canvasContainer" class="canvas-container" />
    </div>

    <p class="hint">当前 seed：<code>{{ currentSeed }}</code></p>
  </div>
</template>

<style scoped>
.lotus-canvas-demo {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 2rem;
  min-height: 100vh;
  background: #f5f5f5;
}

h1 {
  margin: 0 0 0.25rem;
  color: #333;
}

.subtitle {
  margin: 0 0 1.5rem;
  color: #777;
  font-size: 0.95rem;
}

.controls {
  display: flex;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
  justify-content: center;
}

.seed-control {
  display: flex;
  gap: 0.5rem;
}

button {
  padding: 0.6rem 1.1rem;
  font-size: 0.95rem;
  background: #4a6b3a;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.2s;
}

button:hover:not(:disabled) {
  background: #3a5a2a;
}

button:disabled {
  background: #bbb;
  cursor: not-allowed;
}

input {
  padding: 0.6rem;
  font-size: 0.95rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  width: 180px;
}

.canvas-wrapper {
  background: white;
  padding: 1.5rem;
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

.hint {
  margin-top: 1rem;
  color: #666;
  font-size: 0.9rem;
}

code {
  background: #fff;
  padding: 2px 6px;
  border-radius: 3px;
  border: 1px solid #ddd;
}
</style>
