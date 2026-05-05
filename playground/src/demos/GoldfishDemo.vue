<script setup lang="ts">
import { generateGoldfishCanvas } from "@jobinjia/shuimo-core";
import { computed, onMounted, reactive, useTemplateRef, watch } from "vue";

const canvasRef = useTemplateRef<HTMLCanvasElement>("canvas");

const state = reactive({
  seed: "goldfish-0429",
  count: 1,
  paperColor: "#fbf4e3",
  waterColor: "rgba(100, 110, 120, 0.08)",
  inkColor: "rgba(30, 30, 28, 0.9)",
});

const usageCode = computed(
  () => `generateGoldfishCanvas({
  ctx,
  width: 1280,
  height: 820,
  seed: "${state.seed}",
  count: ${state.count},
})`,
);

function render() {
  const canvas = canvasRef.value;
  const ctx = canvas?.getContext("2d");
  if (!canvas || !ctx) return;

  const width = 1280;
  const height = 820;
  const ratio = window.devicePixelRatio || 1;

  canvas.width = width * ratio;
  canvas.height = height * ratio;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

  generateGoldfishCanvas({
    ctx,
    width,
    height,
    seed: state.seed,
    count: state.count,
    paperColor: state.paperColor,
    waterColor: state.waterColor,
    inkColor: state.inkColor,
  });
}

function randomizeSeed() {
  state.seed = `goldfish-${Math.floor(Math.random() * 100000)}`;
}

function resetDemo() {
  state.seed = "goldfish-0429";
  state.count = 1;
  state.paperColor = "#fbf4e3";
  state.waterColor = "rgba(100, 110, 120, 0.08)";
  state.inkColor = "rgba(30, 30, 28, 0.9)";
}

watch(state, render);
onMounted(render);
</script>

<template>
  <div class="goldfish-demo">
    <section class="workbench">
      <header class="toolbar">
        <div class="title-block">
          <p class="kicker">Ink Wash Creature</p>
          <h1 class="title">水墨金鱼</h1>
        </div>
        <div class="actions">
          <button class="button ghost" type="button" @click="resetDemo">Reset</button>
          <button class="button solid" type="button" @click="randomizeSeed">New Seed</button>
        </div>
      </header>

      <div class="canvas-shell">
        <canvas ref="canvas" class="canvas" />
      </div>
    </section>

    <aside class="controls">
      <label class="field field-wide">
        <span>Seed</span>
        <input v-model="state.seed" type="text" />
      </label>

      <label class="field field-wide">
        <span>Fish Count {{ state.count }}</span>
        <input v-model.number="state.count" type="range" min="1" max="5" step="1" />
      </label>

      <label class="swatch">
        <span>Paper</span>
        <input v-model="state.paperColor" type="color" />
      </label>

      <pre class="code field-wide"><code>{{ usageCode }}</code></pre>
    </aside>
  </div>
</template>

<style scoped>
.goldfish-demo {
  min-height: 100vh;
  display: grid;
  grid-template-columns: minmax(560px, 1fr) 320px;
  gap: 1px;
  color: #211b16;
  background: #d1c7b6;
}

.workbench,
.controls {
  min-height: 100vh;
  background: #f2eadc;
}

.workbench {
  display: grid;
  grid-template-rows: auto 1fr;
}

.toolbar {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24px;
  padding: 30px 38px 18px;
}

.kicker {
  margin: 0 0 8px;
  color: #a83d2d;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.title {
  margin: 0;
  color: #211b16;
  font-family: "峄山碑篆体", serif;
  font-size: 48px;
  font-weight: 400;
  letter-spacing: 0;
  line-height: 1;
}

.actions {
  display: flex;
  gap: 8px;
}

.button {
  height: 34px;
  padding: 0 13px;
  border: 1px solid #28221c;
  border-radius: 3px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 650;
}

.button.solid {
  color: #fff8ec;
  background: #28221c;
}

.button.ghost {
  color: #28221c;
  background: transparent;
}

.canvas-shell {
  display: grid;
  place-items: center;
  padding: 22px 38px 46px;
}

.canvas {
  width: min(100%, 1280px) !important;
  height: auto !important;
  display: block;
  aspect-ratio: 1280 / 820;
  border: 1px solid rgba(40, 34, 28, 0.12);
  box-shadow: 0 20px 46px rgba(80, 62, 38, 0.16);
  background: #fbf4e3;
}

.controls {
  display: grid;
  grid-template-columns: 1fr 1fr;
  align-content: start;
  gap: 14px 12px;
  padding: 32px 24px;
}

.field,
.swatch {
  display: grid;
  gap: 8px;
  color: #5c5044;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.field-wide {
  grid-column: 1 / -1;
}

.field input[type="text"] {
  height: 36px;
  box-sizing: border-box;
  border: 1px solid rgba(40, 34, 28, 0.22);
  border-radius: 3px;
  padding: 0 10px;
  color: #211b16;
  background: rgba(255, 250, 241, 0.82);
}

.field input[type="range"] {
  accent-color: #a83d2d;
}

.swatch input {
  width: 100%;
  height: 36px;
  border: 1px solid rgba(40, 34, 28, 0.22);
  border-radius: 3px;
  background: transparent;
}

.code {
  margin: 10px 0 0;
  padding: 14px;
  overflow: auto;
  border: 1px solid rgba(40, 34, 28, 0.12);
  color: #302922;
  background: rgba(255, 250, 241, 0.74);
  font-size: 12px;
  line-height: 1.55;
}

@media (max-width: 900px) {
  .goldfish-demo {
    grid-template-columns: 1fr;
  }

  .workbench,
  .controls {
    min-height: auto;
  }

  .toolbar {
    padding: 24px 22px 14px;
  }

  .canvas-shell {
    padding: 16px 22px 30px;
  }
}
</style>
