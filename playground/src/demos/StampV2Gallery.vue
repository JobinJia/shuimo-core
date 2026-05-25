<script lang="ts" setup>
import { onMounted, ref, computed } from "vue";
import {
  generateSealAsync,
  type SealMode,
  type SealScript,
  type SealShape,
} from "@jobinjia/shuimo-core/stamp-v2";

const SEAL_FONT_URL = "/fonts/yishanbeizhuanti.ttf";
const TILE_SIZE = 180;
const SEED = 42;

interface TextSpec {
  label: string;
  text: string[];
}

interface ShapeSpec {
  label: string;
  build: () => SealShape;
}

// Layout cases mirror the column-major `string[]` convention: each element of
// `text` is one column read top-to-bottom; columns themselves read right-to-left.
const TEXT_CASES: TextSpec[] = [
  { label: "1 字", text: ["落"] },
  { label: "2 字单列", text: ["落梅"] },
  { label: "3 字单列", text: ["落梅听"] },
  { label: "4 字单列", text: ["落梅听风"] },
  { label: "2 列 1 行", text: ["落", "梅"] },
  { label: "2 列 2 行", text: ["落梅", "听风"] },
  { label: "2 列 3 行 (3+2)", text: ["落梅听", "风雪"] },
  { label: "2 列 3 行 (3+3)", text: ["落梅听", "风雪雨"] },
  { label: "3 列 2 行", text: ["山高", "水长", "无尽"] },
  { label: "3 列 3 行", text: ["山高水", "长流远", "无尽时"] },
  { label: "4 列 2 行", text: ["山高", "水长", "书剑", "飘零"] },
];

const SHAPE_CASES: ShapeSpec[] = [
  { label: "自动", build: () => ({ kind: "auto" }) },
  { label: "方形", build: () => ({ kind: "square" }) },
  { label: "长方形", build: () => ({ kind: "rect" }) },
  { label: "圆形", build: () => ({ kind: "circle" }) },
  { label: "椭圆", build: () => ({ kind: "ellipse" }) },
  { label: "六边形", build: () => ({ kind: "polygon", sides: 6, orientation: "flat-top" }) },
  { label: "八边形", build: () => ({ kind: "polygon", sides: 8, orientation: "flat-top" }) },
  { label: "异形", build: () => ({ kind: "irregular" }) },
];

const SCRIPT_CASES: { label: string; value: "" | SealScript }[] = [
  { label: "未设 (carving=1.0)", value: "" },
  { label: "金文 (jinwen)", value: "jinwen" },
  { label: "大篆 (dazhuan)", value: "dazhuan" },
  { label: "小篆 (xiaozhuan)", value: "xiaozhuan" },
  { label: "九叠篆 (auto-stretch)", value: "jiudiezhuan" },
];

const MODE_CASES: { label: string; mode: SealMode }[] = [
  { label: "阳章", mode: "yang" },
  { label: "阴章", mode: "yin" },
];

interface Cell {
  rowKey: string;
  text: string[];
  textLabel: string;
  shape: SealShape;
  shapeLabel: string;
  mode: SealMode;
  modeLabel: string;
  svg: string;
  error?: string;
}

const cells = ref<Cell[]>([]);
const ready = ref(false);
const stretchAll = ref(true);
const scriptAll = ref<"" | SealScript>("");

const rows = computed(() => {
  const out: { textLabel: string; shapes: Cell[] }[] = [];
  for (const t of TEXT_CASES) {
    out.push({
      textLabel: t.label,
      shapes: cells.value.filter((c) => c.textLabel === t.label),
    });
  }
  return out;
});

async function renderAll() {
  const next: Cell[] = [];
  for (const t of TEXT_CASES) {
    for (const s of SHAPE_CASES) {
      for (const m of MODE_CASES) {
        const cell: Cell = {
          rowKey: `${t.label}-${s.label}-${m.mode}`,
          text: t.text,
          textLabel: t.label,
          shape: s.build(),
          shapeLabel: s.label,
          mode: m.mode,
          modeLabel: m.label,
          svg: "",
        };
        try {
          const r = await generateSealAsync({
            text: t.text,
            size: TILE_SIZE,
            seed: SEED,
            font: SEAL_FONT_URL,
            mode: m.mode,
            shape: s.build(),
            script: scriptAll.value || undefined,
            border: { thickness: 5, corner: "round", cornerRadius: 8, roughness: 0.2 },
            // When user picks a script, let its baseline drive intensity;
            // else use 0.9 (gallery default for the carving-only matrix).
            carving: scriptAll.value ? undefined : { intensity: 0.9 },
            ink: { color: "#c1272d", bleed: m.mode === "yin" ? 0.7 : 1.0 },
            layout: {
              padding: 0,
              gap: 2,
              columnGap: 2,
              stretch: stretchAll.value,
            },
          });
          cell.svg = r.svg ?? "";
        } catch (err) {
          cell.error = err instanceof Error ? err.message : String(err);
        }
        next.push(cell);
      }
    }
  }
  cells.value = next;
  ready.value = true;
}

onMounted(() => {
  renderAll();
});

function refresh() {
  ready.value = false;
  renderAll();
}
</script>

<template>
  <div class="page">
    <header>
      <h1>Stamp v2 — Gallery</h1>
      <p class="hint">
        全量测试：{{ TEXT_CASES.length }} 种字数布局 × {{ SHAPE_CASES.length }} 种形状 × {{ MODE_CASES.length }} 种模式。
        同 seed ({{ SEED }})，{{ TILE_SIZE }}px tile。
      </p>
      <div class="controls">
        <label>
          <input type="checkbox" v-model="stretchAll" @change="refresh" /> 撑满 cell (九叠篆)
        </label>
        <label>
          篆体:
          <select v-model="scriptAll" @change="refresh">
            <option v-for="s in SCRIPT_CASES" :key="s.value" :value="s.value">{{ s.label }}</option>
          </select>
        </label>
        <button @click="refresh" class="btn">重新生成</button>
      </div>
    </header>

    <p v-if="!ready" class="loading">渲染中…</p>

    <section v-for="row in rows" :key="row.textLabel" class="row-block">
      <div class="row-label">
        <span class="title">{{ row.textLabel }}</span>
        <span class="text-preview">{{ row.shapes[0]?.text.join(" / ") }}</span>
      </div>

      <div class="grid" :style="{ '--tile': `${TILE_SIZE}px` }">
        <div
          v-for="cell in row.shapes"
          :key="cell.rowKey"
          class="tile"
        >
          <div class="caption">
            {{ cell.shapeLabel }} · {{ cell.modeLabel }}
          </div>
          <div class="stage" v-html="cell.svg" />
          <p v-if="cell.error" class="error">{{ cell.error }}</p>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.page {
  padding: 24px;
  font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif;
  color: #222;
  max-width: 1600px;
  margin: 0 auto;
}

header h1 {
  font-size: 22px;
  margin: 0 0 4px;
}

.hint {
  color: #777;
  font-size: 13px;
  margin: 0 0 12px;
}

.controls {
  display: flex;
  gap: 16px;
  align-items: center;
  margin-bottom: 24px;
  font-size: 13px;
}

.controls label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #444;
  cursor: pointer;
}

.btn {
  padding: 6px 12px;
  border: none;
  border-radius: 4px;
  background: #c1272d;
  color: white;
  font-size: 13px;
  cursor: pointer;
}

.loading {
  color: #777;
  font-style: italic;
}

.row-block {
  margin-bottom: 32px;
  padding-bottom: 24px;
  border-bottom: 1px dashed #ddd;
}

.row-block:last-child {
  border-bottom: none;
}

.row-label {
  display: flex;
  align-items: baseline;
  gap: 12px;
  margin-bottom: 12px;
}

.row-label .title {
  font-size: 14px;
  font-weight: 600;
  color: #333;
}

.row-label .text-preview {
  font-size: 12px;
  color: #888;
  font-family: "Songti SC", "STSong", serif;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(var(--tile), 1fr));
  gap: 12px;
}

.tile {
  border: 1px solid #eee;
  border-radius: 6px;
  padding: 8px;
  background: white;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.caption {
  font-size: 11px;
  color: #666;
  margin-bottom: 6px;
  text-align: center;
}

.stage {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: calc(var(--tile) * 1.1);
  background: #fdfdf8;
  border-radius: 4px;
}

.stage :deep(svg) {
  max-width: 100%;
  height: auto;
}

.error {
  color: #c1272d;
  font-size: 11px;
  margin: 4px 0 0;
}
</style>
