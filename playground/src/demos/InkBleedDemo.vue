<script setup lang="ts">
import { inkBleed, prng } from "@jobinjia/shuimo-core";
import { computed, ref } from "vue";

const seedInput = ref(String(Date.now()));
const len = ref(220);
const layerCount = ref(50);
const alpha = ref(0.04);
const masterDepth = ref(7);
const masterVariance = ref(11); // ≈ len * 0.05
const layerDepth = ref(4);
const layerVariance = ref(4.4); // ≈ len * 0.02
const varianceDecay = ref(0.8);
const baseSides = ref(8);
const color = ref("20,20,20");
const layersPerColor = ref(5);
const colorB = ref("");
const showBlobCompare = ref(true);

const width = 720;
const height = 480;

function regenerate() {
  const seed = Number.parseInt(seedInput.value) || Date.now();
  prng.seed(seed);
  const colors = colorB.value ? [color.value, colorB.value] : color.value;
  const svg = inkBleed(width / 2, height / 2, {
    len: len.value,
    col: colors,
    layersPerColor: layersPerColor.value,
    layerCount: layerCount.value,
    alpha: alpha.value,
    masterDepth: masterDepth.value,
    masterVariance: masterVariance.value,
    layerDepth: layerDepth.value,
    layerVariance: layerVariance.value,
    varianceDecay: varianceDecay.value,
    baseSides: baseSides.value,
  }) as string;
  return svg;
}

const inkSvg = ref(regenerate());

// re-couple variance defaults to len when len changes
function syncDefaults() {
  masterVariance.value = +(len.value * 0.05).toFixed(2);
  layerVariance.value = +(len.value * 0.02).toFixed(2);
  generate();
}

function generate() {
  inkSvg.value = regenerate();
}

function newSeed() {
  seedInput.value = String(Date.now());
  generate();
}

const stats = computed(() => {
  // # of vertices per layer = baseSides * 2^(masterDepth + layerDepth)
  const verts = baseSides.value * Math.pow(2, masterDepth.value + layerDepth.value);
  const totalPolys = layerCount.value;
  return { verts, totalPolys };
});
</script>

<template>
  <div class="ink-bleed-demo">
    <div class="header">
      <h1>Ink Bleed (Hobbs watercolor)</h1>
      <p class="subtitle">
        Recursive Gaussian-displaced polygon, stacked at low opacity. Algorithm by Tyler Hobbs.
      </p>
    </div>

    <div class="content">
      <div class="canvas-area">
        <svg :width="width" :height="height" class="paper" v-html="inkSvg" />
        <div class="caption">
          Seed: <code>{{ seedInput }}</code>
          &nbsp;·&nbsp; {{ stats.totalPolys }} layers ·
          ≈{{ stats.verts }} verts/layer
        </div>
      </div>

      <div class="controls">
        <div class="control-section">
          <h3>Base</h3>
          <div class="control-group">
            <label>Seed</label>
            <input v-model="seedInput" type="text" @keyup.enter="generate" />
            <button @click="newSeed">New</button>
          </div>
          <div class="control-group">
            <label>Color (R,G,B)</label>
            <input v-model="color" type="text" @change="generate" />
          </div>
          <div class="control-group">
            <label>Second color (optional)</label>
            <input v-model="colorB" type="text" placeholder="e.g. 100,40,30" @change="generate" />
          </div>
          <div class="control-group">
            <label>Layers per color</label>
            <input v-model.number="layersPerColor" type="range" min="1" max="20" @change="generate" />
            <span class="value">{{ layersPerColor }}</span>
          </div>
          <div class="control-group">
            <label>Base sides</label>
            <input v-model.number="baseSides" type="range" min="3" max="32" @change="generate" />
            <span class="value">{{ baseSides }}</span>
          </div>
          <div class="control-group">
            <label>Size (len)</label>
            <input v-model.number="len" type="range" min="60" max="380" @change="syncDefaults" />
            <span class="value">{{ len }}</span>
          </div>
        </div>

        <div class="control-section">
          <h3>Stacking</h3>
          <div class="control-group">
            <label>Layer count</label>
            <input v-model.number="layerCount" type="range" min="5" max="120" @change="generate" />
            <span class="value">{{ layerCount }}</span>
          </div>
          <div class="control-group">
            <label>Layer alpha</label>
            <input v-model.number="alpha" type="range" min="0.01" max="0.2" step="0.005" @change="generate" />
            <span class="value">{{ alpha }}</span>
          </div>
        </div>

        <div class="control-section">
          <h3>Master deform (defines the "母版" silhouette)</h3>
          <div class="control-group">
            <label>Depth</label>
            <input v-model.number="masterDepth" type="range" min="2" max="8" @change="generate" />
            <span class="value">{{ masterDepth }}</span>
          </div>
          <div class="control-group">
            <label>Variance</label>
            <input v-model.number="masterVariance" type="range" min="0" max="40" step="0.5" @change="generate" />
            <span class="value">{{ masterVariance }}</span>
          </div>
        </div>

        <div class="control-section">
          <h3>Per-layer deform (defines the "bleed" jitter)</h3>
          <div class="control-group">
            <label>Depth</label>
            <input v-model.number="layerDepth" type="range" min="1" max="6" @change="generate" />
            <span class="value">{{ layerDepth }}</span>
          </div>
          <div class="control-group">
            <label>Variance</label>
            <input v-model.number="layerVariance" type="range" min="0" max="20" step="0.2" @change="generate" />
            <span class="value">{{ layerVariance }}</span>
          </div>
          <div class="control-group">
            <label>Variance decay</label>
            <input v-model.number="varianceDecay" type="range" min="0.3" max="1" step="0.02" @change="generate" />
            <span class="value">{{ varianceDecay }}</span>
          </div>
        </div>

        <div class="note">
          顶点上限提醒：每层顶点 ≈ <code>baseSides × 2^(masterDepth + layerDepth)</code>。
          当前 ≈ <strong>{{ stats.verts }}</strong>/层 × {{ stats.totalPolys }} 层。
          想加深细节优先调 <code>masterDepth</code>，<code>layerDepth</code> 别超过 5。
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ink-bleed-demo {
  padding: 24px;
  font-family: system-ui, -apple-system, sans-serif;
}
.header h1 {
  margin: 0 0 4px;
}
.subtitle {
  color: #777;
  margin: 0 0 18px;
}
.content {
  display: grid;
  grid-template-columns: 1fr 360px;
  gap: 24px;
}
.canvas-area {
  display: flex;
  flex-direction: column;
  align-items: center;
}
.paper {
  background: #f7f3e6;
  border: 1px solid #d8d2bf;
  border-radius: 4px;
}
.caption {
  margin-top: 10px;
  font-size: 12px;
  color: #888;
}
.controls {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.control-section {
  background: #fafafa;
  border: 1px solid #eee;
  border-radius: 6px;
  padding: 12px 14px;
}
.control-section h3 {
  margin: 0 0 10px;
  font-size: 13px;
  color: #555;
  font-weight: 600;
}
.control-group {
  display: grid;
  grid-template-columns: 130px 1fr 42px;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}
.control-group label {
  font-size: 12px;
  color: #666;
}
.control-group input[type="text"] {
  grid-column: 2 / 4;
  padding: 4px 6px;
  border: 1px solid #ddd;
  border-radius: 3px;
  font-size: 12px;
}
.control-group input[type="range"] {
  width: 100%;
}
.control-group .value {
  font-size: 11px;
  color: #555;
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.control-group button {
  grid-column: 3;
  padding: 4px 8px;
  font-size: 11px;
  border: 1px solid #bbb;
  background: #fff;
  border-radius: 3px;
  cursor: pointer;
}
.note {
  font-size: 11px;
  color: #888;
  line-height: 1.5;
  background: #fcfbf6;
  border: 1px dashed #d8d2bf;
  padding: 8px 10px;
  border-radius: 4px;
}
code {
  background: #eee;
  padding: 0 4px;
  border-radius: 2px;
}
</style>
