<script setup lang="ts">
import {
  generateShuimoLoadingSVG,
  generateCalligraphyLoadingSVG,
} from "@jobinjia/shuimo-core";
import { computed, reactive } from "vue";

const LoadingTypes = [
  {
    key: "taiji",
    label: "太极墨",
    fn: generateShuimoLoadingSVG,
    seed: "90813",
    ink: "#171717",
    paper: "#fbf7ec",
  },
  {
    key: "calligraphy",
    label: "书法笔触",
    fn: generateCalligraphyLoadingSVG,
    seed: "31415",
    ink: "#1a1a1a",
    paper: "#faf7f0",
  },
] as const;

type LoadingKey = (typeof LoadingTypes)[number]["key"];

const state = reactive({
  active: "taiji" as LoadingKey,
  width: 160,
  height: 160,
  duration: 3.2,
  seed: "90813",
  inkColor: "#171717",
  paperColor: "#fbf7ec",
  reducedMotion: false,
});

const activeFn = computed(() => LoadingTypes.find((t) => t.key === state.active)!.fn);

const loadingSvg = computed(() =>
  activeFn.value({
    width: state.width,
    height: state.height,
    duration: state.duration,
    seed: state.seed,
    inkColor: state.inkColor,
    paperColor: state.paperColor,
    reducedMotion: state.reducedMotion,
  }),
);

const fnName = computed(() => {
  const entry = LoadingTypes.find((t) => t.key === state.active)!;
  return entry.fn.name;
});

const usageCode = computed(
  () => `${fnName.value}({
  width: ${state.width},
  height: ${state.height},
  seed: "${state.seed}",
  duration: ${state.duration.toFixed(1)},
  reducedMotion: ${state.reducedMotion},
})`,
);

function switchType(key: LoadingKey) {
  state.active = key;
  const preset = LoadingTypes.find((t) => t.key === key)!;
  state.seed = preset.seed;
  state.inkColor = preset.ink;
  state.paperColor = preset.paper;
}

function randomizeSeed() {
  state.seed = String(Math.floor(Math.random() * 100000));
}

function resetDemo() {
  const preset = LoadingTypes.find((t) => t.key === state.active)!;
  state.width = 160;
  state.height = 160;
  state.duration = 3.2;
  state.seed = preset.seed;
  state.inkColor = preset.ink;
  state.paperColor = preset.paper;
  state.reducedMotion = false;
}
</script>

<template>
  <div class="loading-demo">
    <section class="preview">
      <header class="preview-header">
        <div>
          <p class="kicker">Loading SVG</p>
          <h1 class="title">水墨 Loading</h1>
        </div>
        <div class="actions">
          <button class="button secondary" type="button" @click="resetDemo">Reset</button>
          <button class="button primary" type="button" @click="randomizeSeed">New Seed</button>
        </div>
      </header>

      <div class="tabs">
        <button
          v-for="t in LoadingTypes"
          :key="t.key"
          class="tab"
          :class="{ active: state.active === t.key }"
          @click="switchType(t.key)"
        >
          {{ t.label }}
        </button>
      </div>

      <div class="stage">
        <div class="stage-inner">
          <div class="mark" v-html="loadingSvg" />
        </div>
      </div>
    </section>

    <aside class="panel">
      <label class="field field-wide">
        <span>Seed</span>
        <input v-model="state.seed" type="text" />
      </label>

      <label class="field">
        <span>Width</span>
        <input v-model.number="state.width" type="number" min="96" max="280" step="8" />
      </label>

      <label class="field">
        <span>Height</span>
        <input v-model.number="state.height" type="number" min="96" max="280" step="8" />
      </label>

      <label class="field field-wide">
        <span>Duration {{ state.duration.toFixed(1) }}s</span>
        <input v-model.number="state.duration" type="range" min="1.6" max="6" step="0.1" />
      </label>

      <label class="swatch">
        <span>Ink</span>
        <input v-model="state.inkColor" type="color" />
      </label>

      <label class="swatch">
        <span>Paper</span>
        <input v-model="state.paperColor" type="color" />
      </label>

      <label class="toggle field-wide">
        <input v-model="state.reducedMotion" type="checkbox" />
        <span>Reduced motion</span>
      </label>

      <pre class="code field-wide"><code>{{ usageCode }}</code></pre>
    </aside>
  </div>
</template>

<style scoped>
.loading-demo {
  min-height: 100vh;
  display: grid;
  grid-template-columns: minmax(520px, 1fr) 340px;
  gap: 1px;
  color: #1b1814;
  background: #d8d0c3;
}

.preview,
.panel {
  min-height: 100vh;
  background: #f3eee4;
}

.preview {
  display: grid;
  grid-template-rows: auto auto 1fr;
}

.preview-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24px;
  padding: 32px 38px 20px;
}

.kicker {
  margin: 0 0 8px;
  color: #8d2a24;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.title {
  margin: 0;
  color: #1b1814;
  font-family: "峄山碑篆体", serif;
  font-size: 44px;
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
  border: 1px solid #27231e;
  border-radius: 3px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 650;
}

.button.primary {
  color: #fbf7ec;
  background: #27231e;
}

.button.secondary {
  color: #27231e;
  background: transparent;
}

.tabs {
  display: flex;
  gap: 0;
  padding: 0 38px;
  border-bottom: 1px solid rgba(39, 35, 30, 0.12);
}

.tab {
  padding: 10px 18px;
  border: none;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  color: #7b7264;
  background: none;
  font-size: 14px;
  font-weight: 600;
  transition:
    color 0.15s,
    border-color 0.15s;
}

.tab:hover {
  color: #1b1814;
}

.tab.active {
  color: #8d2a24;
  border-bottom-color: #8d2a24;
}

.stage {
  display: grid;
  place-items: center;
  padding: 24px 38px 52px;
}

.stage-inner {
  width: min(68vh, 520px);
  aspect-ratio: 1;
  display: grid;
  place-items: center;
  border: 1px solid rgba(39, 35, 30, 0.08);
  background:
    radial-gradient(circle at center, rgba(255, 255, 255, 0.62), rgba(255, 255, 255, 0) 54%),
    #fbf7ec;
}

.mark {
  width: 220px;
  height: 220px;
}

.mark :deep(svg) {
  width: 100%;
  height: 100%;
  display: block;
}

.panel {
  display: grid;
  grid-template-columns: 1fr 1fr;
  align-content: start;
  gap: 14px 12px;
  padding: 32px 24px;
}

.field,
.swatch,
.toggle {
  display: flex;
  flex-direction: column;
  gap: 7px;
  color: #51493f;
  font-size: 12px;
  font-weight: 700;
}

.field-wide {
  grid-column: 1 / -1;
}

.field input[type="text"],
.field input[type="number"] {
  height: 36px;
  width: 100%;
  padding: 0 10px;
  border: 1px solid rgba(39, 35, 30, 0.18);
  border-radius: 3px;
  color: #1b1814;
  background: #fffaf0;
}

.field input[type="range"] {
  width: 100%;
  accent-color: #27231e;
}

.swatch input {
  width: 100%;
  height: 36px;
  padding: 2px;
  border: 1px solid rgba(39, 35, 30, 0.18);
  border-radius: 3px;
  background: #fffaf0;
}

.toggle {
  flex-direction: row;
  align-items: center;
}

.toggle input {
  width: 17px;
  height: 17px;
  accent-color: #27231e;
}

.code {
  overflow: auto;
  margin: 8px 0 0;
  padding: 14px;
  border: 1px solid rgba(39, 35, 30, 0.1);
  border-radius: 3px;
  color: #312c25;
  background: #e9e1d3;
  font-size: 12px;
  line-height: 1.55;
}

@media (max-width: 920px) {
  .loading-demo {
    grid-template-columns: 1fr;
  }

  .preview,
  .panel {
    min-height: auto;
  }

  .preview-header {
    padding: 24px 22px 16px;
  }

  .tabs {
    padding: 0 22px;
    overflow-x: auto;
  }

  .stage {
    padding: 20px 22px 28px;
  }

  .stage-inner {
    width: min(100%, 460px);
  }

  .panel {
    grid-template-columns: 1fr 1fr;
  }
}

@media (max-width: 560px) {
  .preview-header {
    flex-direction: column;
  }

  .panel {
    grid-template-columns: 1fr;
  }

  .field-wide {
    grid-column: auto;
  }
}
</style>
