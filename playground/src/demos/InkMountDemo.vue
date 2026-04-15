<script setup lang="ts">
import { onMounted, ref } from "vue";
import { InkMount } from "@jobinjia/shuimo-core";

const canvasRef = ref<HTMLCanvasElement>();
const seed = ref(42);
const layers = ref(5);
const quality = ref<"draft" | "normal" | "high">("high");

function render() {
  const canvas = canvasRef.value;
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  canvas.width = 1200;
  canvas.height = 800;

  // No background fill needed — renderer handles paper color via pixel buffer
  InkMount.generate({
    width: canvas.width,
    height: canvas.height,
    seed: seed.value,
    layers: layers.value,
    quality: quality.value,
    ctx,
  });
}

onMounted(render);

function regenerate() {
  seed.value = Math.floor(Math.random() * 100000);
  render();
}
</script>

<template>
  <div style="padding: 20px">
    <h2>InkMount — 写意水墨山</h2>
    <div style="margin-bottom: 12px; display: flex; gap: 12px; align-items: center">
      <label>
        Layers:
        <input v-model.number="layers" type="range" min="2" max="10" step="1" @input="render" />
        {{ layers }}
      </label>
      <label>
        Quality:
        <select v-model="quality" @change="render">
          <option value="draft">Draft</option>
          <option value="normal">Normal</option>
          <option value="high">High</option>
        </select>
      </label>
      <label>
        Seed:
        <input v-model.number="seed" type="number" style="width: 80px" @change="render" />
      </label>
      <button @click="regenerate">Regenerate</button>
    </div>
    <canvas
      ref="canvasRef"
      style="border: 1px solid #ddd; max-width: 100%; background: #faf8f5"
    />
  </div>
</template>
