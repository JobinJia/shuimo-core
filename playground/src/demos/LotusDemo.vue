<script setup lang="ts">
import { lotus } from "@jobinjia/shuimo-core";
import { computed, reactive } from "vue";

const state = reactive({
  seed: 42,
  width: 400,
  height: 520,
  size: 65,
  withStem: true,
  withLeaf: true,
  withBud: false,
});

const loadingSvg = computed(() => {
  const content = lotus(state.width * 0.5, state.height * 0.28, state.seed, {
    size: state.size,
    withStem: state.withStem,
    withLeaf: state.withLeaf,
    withBud: state.withBud,
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${state.width}" height="${state.height}" viewBox="0 0 ${state.width} ${state.height}">${content}</svg>`;
});

function randomizeSeed() {
  state.seed = Math.floor(Math.random() * 100000);
}

function resetDemo() {
  state.seed = 42;
  state.size = 65;
  state.withStem = true;
  state.withLeaf = true;
  state.withBud = false;
}
</script>

<template>
  <div class="lotus-demo">
    <section class="preview">
      <header class="preview-header">
        <div>
          <p class="kicker">Element</p>
          <h1 class="title">荷花</h1>
        </div>
        <div class="actions">
          <button class="button secondary" type="button" @click="resetDemo">Reset</button>
          <button class="button primary" type="button" @click="randomizeSeed">换种子</button>
        </div>
      </header>

      <div class="stage">
        <div class="stage-inner">
          <div class="mark" v-html="loadingSvg" />
        </div>
      </div>
    </section>

    <aside class="panel">
      <label class="field field-wide">
        <span>Seed</span>
        <input v-model.number="state.seed" type="number" />
      </label>

      <label class="field field-wide">
        <span>花大小 {{ state.size }}</span>
        <input v-model.number="state.size" type="range" min="30" max="120" step="1" />
      </label>

      <label class="toggle field-wide">
        <input v-model="state.withStem" type="checkbox" />
        <span>茎</span>
      </label>

      <label class="toggle field-wide">
        <input v-model="state.withLeaf" type="checkbox" />
        <span>荷叶</span>
      </label>

      <label class="toggle field-wide">
        <input v-model="state.withBud" type="checkbox" />
        <span>花苞</span>
      </label>
    </aside>
  </div>
</template>

<style scoped>
.lotus-demo {
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
  grid-template-rows: auto 1fr;
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
  width: 100%;
  height: 100%;
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

.toggle {
  flex-direction: row;
  align-items: center;
}

.toggle input {
  width: 17px;
  height: 17px;
  accent-color: #27231e;
}

@media (max-width: 920px) {
  .lotus-demo {
    grid-template-columns: 1fr;
  }
  .preview,
  .panel {
    min-height: auto;
  }
  .preview-header {
    padding: 24px 22px 16px;
  }
  .stage {
    padding: 20px 22px 28px;
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
}
</style>
