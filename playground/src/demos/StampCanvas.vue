<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { generateCanvasStampAsync, type CanvasStampOptions } from "@jobinjia/shuimo-core";

const canvasPreviewRef = ref<HTMLDivElement>();

const textLines = ref(["落梅听", "风雪月"]);
const initialText = "落梅听\n风雪月";
const fontsReady = ref(false);

interface CanvasTuningProfile {
  columnSpacing: number;
  characterSpacing: number;
  paddingX: number;
  paddingY: number;
  cornerRadius: number;
  borderBandWidth: number;
  borderWidth: number;
  edgeErosion: number;
  inkDensity: number;
}

const defaultProfile: CanvasTuningProfile = {
  columnSpacing: 1,
  characterSpacing: 1,
  paddingX: 0,
  paddingY: 0,
  cornerRadius: 6,
  borderBandWidth: 2,
  borderWidth: 1.4,
  edgeErosion: 0.35,
  inkDensity: 0.97,
};

const stampType = ref<"yin" | "yang">("yin");
const color = ref("#C8102E");
const fontFamily = ref("峄山碑篆体");
const fontSize = ref(200);
const fontWeight = ref<string | number>("normal");
const columnSpacing = ref(defaultProfile.columnSpacing);
const characterSpacing = ref(defaultProfile.characterSpacing);
const paddingX = ref(defaultProfile.paddingX);
const paddingY = ref(defaultProfile.paddingY);
const cornerRadius = ref(defaultProfile.cornerRadius);
const borderBandWidth = ref(defaultProfile.borderBandWidth);
const borderWidth = ref(defaultProfile.borderWidth);
const edgeErosion = ref(defaultProfile.edgeErosion);
const inkDensity = ref(defaultProfile.inkDensity);
const seed = ref(12345);

onMounted(async () => {
  await document.fonts.ready;
  await waitForFont(fontFamily.value, fontSize.value);
  fontsReady.value = true;
});

const textInput = ref(initialText);
const userModifiedText = ref(false);
const userModifiedTuning = ref(false);
const applyingTuningProfile = ref(false);

async function waitForFont(family: string, size: number) {
  if (typeof document === "undefined" || !document.fonts) return;
  const spec = `${size}px ${family}`;
  for (let i = 0; i < 20; i++) {
    if (document.fonts.check(spec)) return;
    try { await document.fonts.load(spec); } catch {}
    if (document.fonts.check(spec)) return;
    await new Promise((r) => setTimeout(r, 100));
  }
}

function applyTuningProfile(p: CanvasTuningProfile) {
  applyingTuningProfile.value = true;
  columnSpacing.value = p.columnSpacing;
  characterSpacing.value = p.characterSpacing;
  paddingX.value = p.paddingX;
  paddingY.value = p.paddingY;
  cornerRadius.value = p.cornerRadius;
  borderBandWidth.value = p.borderBandWidth;
  borderWidth.value = p.borderWidth;
  edgeErosion.value = p.edgeErosion;
  inkDensity.value = p.inkDensity;
  applyingTuningProfile.value = false;
}

watch(textInput, (v, old) => {
  textLines.value = v.split("\n").filter((l) => l.trim());
  if (old !== undefined && v !== initialText) userModifiedText.value = true;
});

watch(
  [columnSpacing, characterSpacing, paddingX, paddingY, cornerRadius, borderBandWidth, borderWidth, edgeErosion, inkDensity],
  () => { if (!applyingTuningProfile.value) userModifiedTuning.value = true; },
);

const FONT_URL = "/fonts/yishanbeizhuanti.ttf";

const stampOptions = computed<CanvasStampOptions>(() => ({
  text: textLines.value,
  type: stampType.value,
  color: color.value,
  fontFamily: fontFamily.value,
  fontSize: fontSize.value,
  fontWeight: fontWeight.value,
  fontUrl: fontFamily.value === "峄山碑篆体" ? FONT_URL : undefined,
  columnSpacing: columnSpacing.value,
  characterSpacing: characterSpacing.value,
  paddingX: paddingX.value,
  paddingY: paddingY.value,
  cornerRadius: cornerRadius.value,
  borderBandWidth: borderBandWidth.value,
  borderWidth: borderWidth.value,
  edgeErosion: edgeErosion.value,
  inkDensity: inkDensity.value,
  seed: seed.value,
  scale: 3,
}));

let renderVersion = 0;

async function renderCanvas() {
  const el = canvasPreviewRef.value;
  if (!el || !fontsReady.value) return;
  const version = ++renderVersion;
  const canvas = await generateCanvasStampAsync(stampOptions.value);
  if (version !== renderVersion) return;
  el.innerHTML = "";
  el.appendChild(canvas);
}

watch([stampOptions, fontsReady], () => renderCanvas(), { immediate: true });

function randomizeSeed() {
  seed.value = Math.floor(Math.random() * 100000);
}

function resetDefaults() {
  textInput.value = initialText;
  textLines.value = ["落梅听", "风雪月"];
  userModifiedText.value = false;
  userModifiedTuning.value = false;
  stampType.value = "yin";
  color.value = "#C8102E";
  fontFamily.value = "峄山碑篆体";
  fontSize.value = 200;
  fontWeight.value = "normal";
  applyTuningProfile(defaultProfile);
  seed.value = 12345;
}

function downloadPNG() {
  const el = canvasPreviewRef.value;
  if (!el) return;
  const canvas = el.querySelector("canvas");
  if (!canvas) return;
  const link = document.createElement("a");
  link.href = canvas.toDataURL("image/png");
  link.download = `stamp-canvas-${Date.now()}.png`;
  link.click();
}

function exportConfig() {
  const blob = new Blob([JSON.stringify(stampOptions.value, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `stamp-canvas-config-${Date.now()}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

const presets = [
  {
    name: "阴章 - 2×3",
    config: { text: "落梅听\n风雪", type: "yin" as const, fontSize: 70, ...defaultProfile, seed: 12345 },
  },
  {
    name: "阴章 - 2×2",
    config: { text: "恩桂\n月錢", type: "yin" as const, fontSize: 70, ...defaultProfile, seed: 11112 },
  },
  {
    name: "阴章 - 2×2 (营脸盛主)",
    config: { text: "营脸\n盛主", type: "yin" as const, fontSize: 70, ...defaultProfile, seed: 22221 },
  },
  {
    name: "阴章 - 大字",
    config: { text: "印\n章", type: "yin" as const, fontSize: 120, borderBandWidth: 14, borderWidth: 1.7, cornerRadius: 8, columnSpacing: 1, characterSpacing: 1, paddingX: 0, paddingY: 0, edgeErosion: 0.35, inkDensity: 0.92, seed: 33333 },
  },
  {
    name: "阳章 - 2×2",
    config: { text: "印\n章", type: "yang" as const, fontSize: 100, borderBandWidth: 0, borderWidth: 1.5, cornerRadius: 6, columnSpacing: 1, characterSpacing: 1, paddingX: 2, paddingY: 2, edgeErosion: 0.35, inkDensity: 0.97, seed: 44444 },
  },
  {
    name: "阳章 - 3字",
    config: { text: "梅\n兰\n竹", type: "yang" as const, fontSize: 80, borderBandWidth: 0, borderWidth: 1.2, cornerRadius: 4, columnSpacing: 1, characterSpacing: 1, paddingX: 1, paddingY: 1, edgeErosion: 0.4, inkDensity: 0.95, seed: 55555 },
  },
];

function applyPreset(preset: (typeof presets)[0]) {
  textInput.value = preset.config.text;
  textLines.value = preset.config.text.split("\n").filter((l) => l.trim());
  stampType.value = preset.config.type;
  fontSize.value = preset.config.fontSize;
  userModifiedTuning.value = false;
  applyTuningProfile(preset.config);
  seed.value = preset.config.seed;
  userModifiedText.value = false;
  userModifiedTuning.value = false;
}
</script>

<template>
  <div class="stamp-playground">
    <div class="controls-panel">
      <div class="panel-header">
        <h3>Canvas 印章配置</h3>
        <button class="export-config-btn" @click="exportConfig" title="导出当前配置为 JSON">
          导出配置
        </button>
      </div>

      <div class="controls-content">
        <!-- Presets -->
        <div class="control-section">
          <h4>预设样式</h4>
          <div class="preset-buttons">
            <button
              v-for="preset in presets"
              :key="preset.name"
              class="preset-btn"
              @click="applyPreset(preset)"
            >
              {{ preset.name }}
            </button>
          </div>
        </div>

        <!-- Text Input -->
        <div class="control-section">
          <h4>印章文字</h4>
          <textarea v-model="textInput" class="text-input" placeholder="每行一个字段" rows="3" />
          <p class="hint">每行一列，从右到左排列</p>
        </div>

        <!-- Type -->
        <div class="control-section">
          <h4>类型</h4>
          <div class="control-row">
            <label>
              <span class="label-text">类型</span>
              <select v-model="stampType" class="select-input">
                <option value="yin">阴章 (红底白字)</option>
                <option value="yang">阳章 (白底红字)</option>
              </select>
            </label>
          </div>
        </div>

        <!-- Color & Font -->
        <div class="control-section">
          <h4>颜色与字体</h4>
          <div class="control-row color-row">
            <label>
              <span class="label-text">印泥颜色</span>
              <div class="color-input-group">
                <input v-model="color" type="color" class="color-picker" />
                <input v-model="color" type="text" class="color-text" />
              </div>
            </label>
          </div>
          <div class="control-row">
            <label>
              <span class="label-text">字体</span>
              <select v-model="fontFamily" class="select-input">
                <option value="峄山碑篆体">峄山碑篆体</option>
                <option value="'Kaiti SC', 'Kaiti TC', STKaiti, KaiTi, 楷体, serif">楷体</option>
                <option value="'Songti SC', 'Songti TC', STSong, SimSun, 宋体, serif">宋体</option>
                <option value="'PingFang SC', 'Microsoft YaHei', 微软雅黑, sans-serif">黑体</option>
                <option value="serif">Serif</option>
              </select>
            </label>
          </div>
          <div class="control-row">
            <label>
              <span class="label-text">字体粗细</span>
              <select v-model="fontWeight" class="select-input">
                <option value="100">100 - 极细</option>
                <option value="200">200 - 纤细</option>
                <option value="300">300 - 细</option>
                <option value="normal">400 - 正常</option>
                <option value="500">500 - 中等</option>
                <option value="600">600 - 半粗</option>
                <option value="bold">700 - 粗体</option>
                <option value="800">800 - 特粗</option>
                <option value="900">900 - 极粗</option>
              </select>
            </label>
          </div>
        </div>

        <!-- Size & Position -->
        <div class="control-section">
          <h4>尺寸与间距</h4>
          <div class="control-row">
            <label>
              <span class="label-text">字体大小: {{ fontSize }}px</span>
              <input v-model.number="fontSize" type="range" min="20" max="400" class="range-input" />
            </label>
          </div>
          <div class="control-row">
            <label>
              <span class="label-text">列间距: {{ columnSpacing.toFixed(1) }}px</span>
              <input v-model.number="columnSpacing" type="range" min="-10" max="20" step="0.5" class="range-input" />
            </label>
          </div>
          <div class="control-row">
            <label>
              <span class="label-text">字间距: {{ characterSpacing.toFixed(1) }}px</span>
              <input v-model.number="characterSpacing" type="range" min="-10" max="20" step="0.5" class="range-input" />
            </label>
          </div>
          <div class="control-row">
            <label>
              <span class="label-text">水平留白: {{ paddingX.toFixed(1) }}px</span>
              <input v-model.number="paddingX" type="range" min="0" max="20" step="0.5" class="range-input" />
            </label>
          </div>
          <div class="control-row">
            <label>
              <span class="label-text">垂直留白: {{ paddingY.toFixed(1) }}px</span>
              <input v-model.number="paddingY" type="range" min="0" max="20" step="0.5" class="range-input" />
            </label>
          </div>
        </div>

        <!-- Border & Effects -->
        <div class="control-section">
          <h4>边框与效果</h4>
          <div class="control-row">
            <label>
              <span class="label-text">边框带宽度: {{ borderBandWidth }}px</span>
              <input v-model.number="borderBandWidth" type="range" min="0" max="20" step="1" class="range-input" />
            </label>
          </div>
          <div v-if="stampType === 'yang'" class="control-row">
            <label>
              <span class="label-text">边框线宽: {{ borderWidth.toFixed(1) }}px</span>
              <input v-model.number="borderWidth" type="range" min="0.5" max="5" step="0.1" class="range-input" />
            </label>
            <p class="hint">阳章红色边框线宽</p>
          </div>
          <div class="control-row">
            <label>
              <span class="label-text">圆角半径: {{ cornerRadius }}px</span>
              <input v-model.number="cornerRadius" type="range" min="0" max="30" step="1" class="range-input" />
            </label>
          </div>
          <div class="control-row">
            <label>
              <span class="label-text">边缘侵蚀: {{ edgeErosion.toFixed(2) }}</span>
              <input v-model.number="edgeErosion" type="range" min="0" max="1" step="0.05" class="range-input" />
            </label>
            <p class="hint">噪声侵蚀强度，越高边缘缺口越深</p>
          </div>
          <div class="control-row">
            <label>
              <span class="label-text">印泥密度: {{ inkDensity.toFixed(2) }}</span>
              <input v-model.number="inkDensity" type="range" min="0.7" max="1" step="0.01" class="range-input" />
            </label>
            <p class="hint">表面印泥覆盖密度，越低纸纹越明显</p>
          </div>
        </div>

        <!-- Seed -->
        <div class="control-section">
          <h4>随机种子</h4>
          <div class="control-row">
            <label>
              <span class="label-text">Seed</span>
              <div class="seed-input-group">
                <input v-model.number="seed" type="number" class="number-input" />
                <button class="icon-btn" @click="randomizeSeed" title="随机种子">🎲</button>
              </div>
            </label>
          </div>
        </div>

        <!-- Actions -->
        <div class="control-section">
          <div class="action-buttons">
            <button class="action-btn primary" @click="downloadPNG">下载 PNG</button>
            <button class="action-btn" @click="resetDefaults">重置默认值</button>
          </div>
        </div>
      </div>
    </div>

    <div class="preview-panel">
      <div class="preview-header">
        <h3>Canvas 预览</h3>
      </div>
      <div class="preview-content">
        <div ref="canvasPreviewRef" class="stamp-preview" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.stamp-playground { display: flex; height: 100%; width: 100%; background-color: #f8f9fa; }
.controls-panel { width: 380px; background-color: #fff; border-right: 1px solid #e0e0e0; display: flex; flex-direction: column; overflow-y: auto; }
.panel-header { padding: 20px 24px; border-bottom: 1px solid #e0e0e0; background-color: #fafafa; display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.panel-header h3 { margin: 0; font-size: 18px; font-weight: 600; color: #333; }
.export-config-btn { padding: 6px 14px; border: 1px solid #3498db; border-radius: 6px; background-color: #3498db; color: #fff; cursor: pointer; font-size: 13px; font-weight: 500; transition: all 0.2s; }
.export-config-btn:hover { background-color: #2980b9; border-color: #2980b9; }
.controls-content { flex: 1; padding: 20px 24px; }
.control-section { margin-bottom: 28px; }
.control-section:last-child { margin-bottom: 0; }
.control-section h4 { margin: 0 0 12px 0; font-size: 14px; font-weight: 600; color: #555; text-transform: uppercase; letter-spacing: 0.5px; }
.control-row { margin-bottom: 12px; }
.control-row:last-child { margin-bottom: 0; }
.control-row label { display: block; }
.label-text { display: block; font-size: 13px; font-weight: 500; color: #666; margin-bottom: 6px; }
.text-input { width: 100%; padding: 10px 12px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px; font-family: inherit; resize: vertical; transition: border-color 0.2s; }
.text-input:focus { outline: none; border-color: #3498db; }
.hint { margin: 6px 0 0 0; font-size: 12px; color: #999; }
.select-input { width: 100%; padding: 8px 12px; border: 1px solid #ddd; border-radius: 6px; font-size: 13px; background-color: #fff; cursor: pointer; transition: border-color 0.2s; }
.select-input:focus { outline: none; border-color: #3498db; }
.color-input-group { display: flex; gap: 8px; align-items: center; }
.color-picker { width: 50px; height: 36px; border: 1px solid #ddd; border-radius: 6px; cursor: pointer; }
.color-text { flex: 1; padding: 8px 12px; border: 1px solid #ddd; border-radius: 6px; font-size: 13px; font-family: monospace; }
.range-input { width: 100%; height: 6px; border-radius: 3px; background: #e0e0e0; outline: none; cursor: pointer; }
.range-input::-webkit-slider-thumb { width: 16px; height: 16px; border-radius: 50%; background: #3498db; cursor: pointer; }
.range-input::-moz-range-thumb { width: 16px; height: 16px; border-radius: 50%; background: #3498db; cursor: pointer; border: none; }
.seed-input-group { display: flex; gap: 8px; }
.number-input { flex: 1; padding: 8px 12px; border: 1px solid #ddd; border-radius: 6px; font-size: 13px; font-family: monospace; }
.icon-btn { padding: 8px 12px; border: 1px solid #ddd; border-radius: 6px; background-color: #fff; cursor: pointer; font-size: 16px; transition: background-color 0.2s; }
.icon-btn:hover { background-color: #f5f5f5; }
.preset-buttons { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.preset-btn { padding: 10px 12px; border: 1px solid #ddd; border-radius: 6px; background-color: #fff; cursor: pointer; font-size: 13px; font-weight: 500; transition: all 0.2s; }
.preset-btn:hover { background-color: #f5f5f5; border-color: #3498db; }
.action-buttons { display: flex; gap: 12px; }
.action-btn { flex: 1; padding: 12px 16px; border: 1px solid #ddd; border-radius: 6px; background-color: #fff; cursor: pointer; font-size: 14px; font-weight: 500; transition: all 0.2s; }
.action-btn:hover { background-color: #f5f5f5; }
.action-btn.primary { background-color: #3498db; color: white; border-color: #3498db; }
.action-btn.primary:hover { background-color: #2980b9; border-color: #2980b9; }
.preview-panel { flex: 1; display: flex; flex-direction: column; overflow: auto; }
.preview-header { padding: 20px 24px; border-bottom: 1px solid #e0e0e0; background-color: #fafafa; }
.preview-header h3 { margin: 0; font-size: 18px; font-weight: 600; color: #333; }
.preview-content { flex: 1; display: flex; align-items: center; justify-content: center; padding: 40px; overflow: auto; }
.stamp-preview { background-color: #fff; padding: 40px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1); display: flex; align-items: center; justify-content: center; max-width: 100%; overflow: visible; }
.stamp-preview :deep(canvas) { display: block; max-width: 400px; max-height: 400px; width: auto; height: auto; image-rendering: -webkit-optimize-contrast; image-rendering: crisp-edges; }
</style>
