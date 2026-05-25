<script lang="ts" setup>
import { computed, onMounted, reactive, ref, watch } from "vue";
import {
  generateSealAsync,
  type SealMode,
  type SealNotchStrategy,
  type SealScript,
  type SealShape,
} from "@jobinjia/shuimo-core/stamp-v2";
import { generateStampAsync, type StampOptions } from "@jobinjia/shuimo-core";

const SEAL_FONT_URL = "/fonts/yishanbeizhuanti.ttf";

type ShapeKind = SealShape["kind"];

const controls = reactive({
  text: "落梅听,风雪",
  size: 280,
  seed: 42,
  mode: "yang" as SealMode,
  shape: "square" as ShapeKind,
  script: "" as "" | SealScript,
  polygonSides: 6,
  polygonOrientation: "flat-top" as "flat-top" | "point-top",
  notchStrategy: "auto" as SealNotchStrategy,
  notchJitter: 0.4,
  borderThickness: 7,
  cornerRadius: 11,
  cornerMode: "round" as "none" | "round",
  inkColor: "#c1272d",
  padding: 0,
  gap: 3,
  columnGap: 3,
  stretchAuto: true,
  stretch: true,
  roughness: 0.2,
  carvingIntensity: 1.0,
  bleed: 1.0,
  offsetX: 0,
  offsetY: 0,
});

const isYinPreset = ref(false);

function toggleModePreset() {
  if (!isYinPreset.value) {
    controls.mode = "yin";
    controls.shape = "square";
    controls.borderThickness = 8;
    controls.roughness = 0.5;
    controls.carvingIntensity = 0.7;
    controls.bleed = 0.7;
  } else {
    controls.mode = "yang";
    controls.shape = "square";
    controls.borderThickness = 7;
    controls.roughness = 0.2;
    controls.carvingIntensity = 1.0;
    controls.bleed = 1.0;
  }
  isYinPreset.value = !isYinPreset.value;
}

const savedTexture = reactive({ roughness: 0.2, carvingIntensity: 1.0, bleed: 1.0 });
const textureOn = ref(true);

function toggleTexture() {
  if (textureOn.value) {
    savedTexture.roughness = controls.roughness;
    savedTexture.carvingIntensity = controls.carvingIntensity;
    savedTexture.bleed = controls.bleed;
    controls.roughness = 0;
    controls.carvingIntensity = 0;
    controls.bleed = 0;
  } else {
    controls.roughness = savedTexture.roughness;
    controls.carvingIntensity = savedTexture.carvingIntensity;
    controls.bleed = savedTexture.bleed;
  }
  textureOn.value = !textureOn.value;
}

const v2Svg = ref("");
const v1Svg = ref("");
const v2Error = ref("");
const v1Error = ref("");
const rendering = ref(false);
const pickedNotch = ref<number | null>(null);

const v2Shape = computed<SealShape>(() => {
  switch (controls.shape) {
    case "auto":
      return { kind: "auto" };
    case "rect":
      return { kind: "rect" };
    case "ellipse":
      return { kind: "ellipse" };
    case "circle":
      return { kind: "circle" };
    case "polygon":
      return {
        kind: "polygon",
        sides: controls.polygonSides,
        orientation: controls.polygonOrientation,
      };
    default:
      return { kind: "square" };
  }
});

function parseText(raw: string): string[] {
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

async function renderV2() {
  v2Error.value = "";
  try {
    const r = await generateSealAsync({
      text: parseText(controls.text),
      size: controls.size,
      seed: controls.seed,
      font: SEAL_FONT_URL,
      mode: controls.mode,
      shape: v2Shape.value,
      script: controls.script || undefined,
      notch: { strategy: controls.notchStrategy, jitter: controls.notchJitter },
      border: {
        thickness: controls.borderThickness,
        roughness: controls.roughness,
        corner: controls.cornerMode,
        cornerRadius: controls.cornerRadius,
      },
      carving: { intensity: controls.carvingIntensity },
      ink: { color: controls.inkColor, bleed: controls.bleed },
      layout: {
        padding: controls.padding,
        gap: controls.gap,
        rowGap: controls.gap,
        columnGap: controls.columnGap,
        stretch: controls.stretchAuto ? undefined : controls.stretch,
        offsetX: controls.offsetX,
        offsetY: controls.offsetY,
      },
    });
    v2Svg.value = r.svg ?? "";
    // pickedNotch isn't on the public SealResult — leave the badge informational only.
    pickedNotch.value = null;
  } catch (err) {
    v2Error.value = err instanceof Error ? err.message : String(err);
    v2Svg.value = "";
  }
}

async function renderV1() {
  v1Error.value = "";
  try {
    // v1's API splits text into columns; treat the input string as a single column.
    const v1Text = parseText(controls.text);
    const opts: StampOptions = {
      text: v1Text,
      type: controls.mode === "yin" ? "yin" : "yang",
      color: controls.inkColor,
      fontFamily: "峄山碑篆体",
      fontUrl: SEAL_FONT_URL,
      fontSize: 70,
      seed: controls.seed,
      paddingXPx: 4,
      paddingYPx: 4,
      noiseAmountPx: 10,
      cornerRadiusPx: 4,
      borderPointsPx: 28,
    };
    v1Svg.value = await generateStampAsync(opts);
  } catch (err) {
    v1Error.value = err instanceof Error ? err.message : String(err);
    v1Svg.value = "";
  }
}

async function regenerate() {
  rendering.value = true;
  try {
    await Promise.all([renderV2(), renderV1()]);
  } finally {
    rendering.value = false;
  }
}

function rollSeed() {
  controls.seed = Math.floor(Math.random() * 1_000_000);
}

onMounted(() => {
  regenerate();
});

watch(
  () => ({
    t: controls.text,
    sz: controls.size,
    sd: controls.seed,
    md: controls.mode,
    sh: controls.shape,
    sc: controls.script,
    ps: controls.polygonSides,
    po: controls.polygonOrientation,
    ns: controls.notchStrategy,
    nj: controls.notchJitter,
    bt: controls.borderThickness,
    cr: controls.cornerRadius,
    cm: controls.cornerMode,
    ic: controls.inkColor,
    rg: controls.roughness,
    ci: controls.carvingIntensity,
    bl: controls.bleed,
    pd: controls.padding,
    gp: controls.gap,
    cgp: controls.columnGap,
    str: controls.stretch,
    strA: controls.stretchAuto,
    ox: controls.offsetX,
    oy: controls.offsetY,
  }),
  () => {
    regenerate();
  },
);
</script>

<template>
  <div class="page">
    <header>
      <h1>Stamp v2 — 中国书法印章</h1>
      <p class="hint">
        左侧 v2 (新版 / stamp-v2)，右侧 v1 (现有 generateStampAsync) 同 seed 对比。
        改任意参数会自动重绘。
      </p>
    </header>

    <section class="grid">
      <aside class="panel">
        <div class="row">
          <label>文字 <span class="hint-inline">逗号分列</span></label>
          <input v-model="controls.text" placeholder="落梅听,风雪" />
        </div>

        <div class="row">
          <label>形状</label>
          <select v-model="controls.shape">
            <option value="auto">自动 (适应文字)</option>
            <option value="square">方形</option>
            <option value="rect">长方形</option>
            <option value="circle">圆形</option>
            <option value="ellipse">椭圆</option>
            <option value="polygon">多边形 (polygon)</option>
          </select>
        </div>

        <template v-if="controls.shape === 'polygon'">
          <div class="row">
            <label>边数 ({{ controls.polygonSides }})</label>
            <input type="range" min="3" max="12" step="1" v-model.number="controls.polygonSides" />
          </div>
          <div class="row">
            <label>朝向</label>
            <select v-model="controls.polygonOrientation">
              <option value="flat-top">平边朝上 (6/8 角章)</option>
              <option value="point-top">顶点朝上 (三角/五角)</option>
            </select>
          </div>
        </template>

        <div class="row">
          <label>模式</label>
          <select v-model="controls.mode">
            <option value="yang">阳章 (朱文)</option>
            <option value="yin">阴章 (白文)</option>
          </select>
        </div>

        <div class="row">
          <label>篆体 (script)</label>
          <select v-model="controls.script">
            <option value="">未设 (用 carving.intensity)</option>
            <option value="jinwen">金文 (圆润)</option>
            <option value="dazhuan">大篆</option>
            <option value="xiaozhuan">小篆 (V2 默认)</option>
            <option value="jiudiezhuan">九叠篆 (自动撑满)</option>
            <option value="custom">custom (零基线)</option>
          </select>
        </div>


        <div class="row">
          <label>seed</label>
          <input type="number" v-model.number="controls.seed" />
          <button class="btn-mini" @click="rollSeed">🎲</button>
        </div>

        <div class="row">
          <label>尺寸 ({{ controls.size }}px)</label>
          <input type="range" min="160" max="480" step="20" v-model.number="controls.size" />
        </div>

        <div class="row">
          <label>边框粗细 ({{ controls.borderThickness }}px)</label>
          <input type="range" min="2" max="20" step="1" v-model.number="controls.borderThickness" />
        </div>


        <div class="row">
          <label>内边距 ({{ controls.padding }}px)</label>
          <input type="range" min="0" max="30" step="1" v-model.number="controls.padding" />
        </div>

        <div class="row">
          <label>字间距 (行内 {{ controls.gap }}px)</label>
          <input type="range" min="0" max="20" step="1" v-model.number="controls.gap" />
        </div>

        <div class="row">
          <label>列间距 ({{ controls.columnGap }}px)</label>
          <input type="range" min="-30" max="40" step="1" v-model.number="controls.columnGap" />
        </div>

        <div class="row">
          <label>
            <input type="checkbox" v-model="controls.stretchAuto" /> 撑满 cell：跟随形状自动
          </label>
        </div>
        <div class="row" v-if="!controls.stretchAuto">
          <label>
            <input type="checkbox" v-model="controls.stretch" /> 撑满 cell (九叠篆)
          </label>
        </div>

        <div class="row">
          <label>圆角模式</label>
          <select v-model="controls.cornerMode">
            <option value="round">圆角</option>
            <option value="none">直角</option>
          </select>
        </div>

        <div class="row">
          <label>圆角半径 ({{ controls.cornerRadius }}px)</label>
          <input type="range" min="0" max="40" step="1" v-model.number="controls.cornerRadius" />
        </div>

        <div class="row">
          <label>文字偏移 X ({{ controls.offsetX.toFixed(1) }})</label>
          <input type="range" min="-1" max="1" step="0.1" v-model.number="controls.offsetX" />
        </div>

        <div class="row">
          <label>文字偏移 Y ({{ controls.offsetY.toFixed(1) }})</label>
          <input type="range" min="-1" max="1" step="0.1" v-model.number="controls.offsetY" />
        </div>

        <div class="row">
          <label>印泥色</label>
          <input type="color" v-model="controls.inkColor" />
        </div>

        <div class="row group">
          <label class="group-title">纹理</label>
        </div>

        <div class="row">
          <label>边框磨损 ({{ controls.roughness.toFixed(2) }})</label>
          <input type="range" min="0" max="1" step="0.05" v-model.number="controls.roughness" />
        </div>

        <div class="row">
          <label>刀刻感 ({{ controls.carvingIntensity.toFixed(2) }})</label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            v-model.number="controls.carvingIntensity"
          />
        </div>

        <div class="row">
          <label>印泥渗透 ({{ controls.bleed.toFixed(2) }})</label>
          <input type="range" min="0" max="1" step="0.05" v-model.number="controls.bleed" />
        </div>

        <div class="presets">
          <button class="btn btn-preset" @click="toggleModePreset">{{ isYinPreset ? '阳章预设' : '阴章预设' }}</button>
          <button class="btn btn-clean" @click="toggleTexture">{{ textureOn ? '关闭纹理' : '开启纹理' }}</button>
        </div>

        <button class="btn" :disabled="rendering" @click="regenerate">
          {{ rendering ? "正在绘制…" : "重新生成" }}
        </button>
      </aside>

      <main class="output">
        <article class="card">
          <h2>v2 · generateSeal</h2>
          <div class="stage" v-html="v2Svg" />
          <p v-if="v2Error" class="error">{{ v2Error }}</p>
        </article>

        <article class="card">
          <h2>v1 · generateStampAsync</h2>
          <div class="stage" v-html="v1Svg" />
          <p v-if="v1Error" class="error">{{ v1Error }}</p>
        </article>
      </main>
    </section>
  </div>
</template>

<style scoped>
.page {
  padding: 32px;
  font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif;
  color: #222;
  max-width: 1200px;
  margin: 0 auto;
}

header h1 {
  font-size: 22px;
  margin: 0 0 4px;
}

.hint {
  color: #777;
  font-size: 13px;
  margin: 0 0 24px;
}

.grid {
  display: grid;
  grid-template-columns: 280px 1fr;
  gap: 32px;
}

.panel {
  background: #fafafa;
  border: 1px solid #eee;
  border-radius: 8px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  position: sticky;
  top: 24px;
  align-self: flex-start;
}

.row {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  color: #555;
}

.row input,
.row select {
  font: inherit;
  padding: 4px 6px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: white;
}

.row input[type="color"] {
  width: 64px;
  height: 30px;
  padding: 2px;
}

.row input[type="range"] {
  padding: 0;
}

.btn {
  padding: 8px 12px;
  border: none;
  border-radius: 4px;
  background: #c1272d;
  color: white;
  font-size: 13px;
  cursor: pointer;
}

.btn:disabled {
  opacity: 0.5;
  cursor: wait;
}

.btn-mini {
  margin-left: 6px;
  padding: 2px 6px;
  border: 1px solid #ddd;
  background: white;
  border-radius: 4px;
  cursor: pointer;
}

.group {
  margin-top: 8px;
  border-top: 1px dashed #ddd;
  padding-top: 8px;
}

.group-title {
  font-weight: 600;
  color: #444;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.presets {
  display: flex;
  gap: 6px;
}

.btn-preset {
  flex: 1;
  background: #2c3e50;
}

.btn-clean {
  flex: 1;
  background: #888;
}

.output {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.card {
  border: 1px solid #eee;
  border-radius: 8px;
  padding: 16px;
  background: white;
}

.card h2 {
  font-size: 13px;
  font-weight: 600;
  margin: 0 0 12px;
  color: #444;
}

.stage {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 320px;
  background: #fdfdf8;
  border-radius: 4px;
}

.stage :deep(svg) {
  max-width: 100%;
  height: auto;
}

.error {
  color: #c1272d;
  font-size: 12px;
  margin: 8px 0 0;
}
</style>
