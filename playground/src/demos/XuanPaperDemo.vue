<script setup lang="ts">
import {
  XuanPaper,
  XuanPaperColors,
  GoldFleckColors,
  type XuanPaperOptions,
} from "@jobinjia/shuimo-core";
import { computed, onMounted, reactive, useTemplateRef, watch } from "vue";

const canvasContainer = useTemplateRef<HTMLDivElement>("canvasContainer");
const svgContainer = useTemplateRef<HTMLDivElement>("svgContainer");

const state = reactive({
  width: 600,
  height: 400,
  seed: Date.now(),
  fiberDensity: 1.0,
  fiberScale: 1.0,
  textureIntensity: 0.3,
  grainDensity: 0.5,
  age: 0,
  deckleEdge: false,
  deckleRoughness: 0.5,
  colorPreset: "processed" as keyof typeof XuanPaperColors,
  renderMode: "canvas" as "canvas" | "svg",
  goldFlecks: false,
  goldDensity: 0.5,
  goldSizeMin: 2,
  goldSizeMax: 12,
  goldColorPreset: "gold" as keyof typeof GoldFleckColors,
  goldClustering: 0.3,
});

const selectedColor = computed(() => XuanPaperColors[state.colorPreset]);
const selectedGoldColor = computed(() => GoldFleckColors[state.goldColorPreset]);

const paperPresetDescription = computed(() => {
  switch (state.colorPreset) {
    case "raw":
      return "偏生宣气质：更清白、更轻、更有纤维显露。";
    case "processed":
      return "默认半熟到熟宣之间：温润、均衡，适合大多数书画底纸。";
    case "antique":
      return "熟宣取向的旧色纸：底色更暖，纸面更沉静。";
    case "teaStained":
      return "染色熟宣取向：保留熟宣质感，同时加入茶染旧化感。";
    case "moonWhite":
      return "偏生宣的冷白变体：更冷净，适合清雅画面。";
  }
});

const currentOptions = computed<XuanPaperOptions>(() => ({
  width: state.width,
  height: state.height,
  baseColor: selectedColor.value,
  fiberDensity: state.fiberDensity,
  fiberScale: state.fiberScale,
  textureIntensity: state.textureIntensity,
  grainDensity: state.grainDensity,
  age: state.age,
  deckleEdge: state.deckleEdge,
  deckleRoughness: state.deckleRoughness,
  seed: state.seed,
  goldFlecks: state.goldFlecks,
  goldDensity: state.goldDensity,
  goldSize: [state.goldSizeMin, state.goldSizeMax],
  goldColor: selectedGoldColor.value,
  goldClustering: state.goldClustering,
}));

function generate() {
  if (state.renderMode === "canvas" && canvasContainer.value) {
    canvasContainer.value.innerHTML = "";
    const canvas = XuanPaper.generate(currentOptions.value);
    canvasContainer.value.appendChild(canvas);
  } else if (state.renderMode === "svg" && svgContainer.value) {
    svgContainer.value.innerHTML = "";
    const svg = XuanPaper.generateSVG(currentOptions.value);
    svgContainer.value.appendChild(svg);
  }
}

function generateNew() {
  state.seed = Date.now();
  generate();
}

function downloadPaper() {
  const canvas = XuanPaper.generate(currentOptions.value);
  const link = document.createElement("a");
  link.download = `xuan-paper-${state.seed}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
}

onMounted(generate);

watch([currentOptions, () => state.renderMode], generate);
</script>

<template>
  <div class="xuan-paper-demo">
    <div class="header">
      <h1>宣纸生成器</h1>
      <p class="subtitle">Xuan Paper Generator - Traditional Chinese Rice Paper</p>
    </div>

    <div class="main-content">
      <div class="controls">
        <div class="control-section">
          <h3>基本设置 / Basic</h3>

          <div class="control-group">
            <label>渲染模式:</label>
            <div class="radio-group">
              <label class="radio-label">
                <input v-model="state.renderMode" type="radio" value="canvas" />
                Canvas
              </label>
              <label class="radio-label">
                <input v-model="state.renderMode" type="radio" value="svg" />
                SVG
              </label>
            </div>
          </div>

          <div class="control-row">
            <div class="control-group">
              <label>宽度:</label>
              <input v-model.number="state.width" type="number" min="200" max="1200" step="50" />
            </div>
            <div class="control-group">
              <label>高度:</label>
              <input v-model.number="state.height" type="number" min="200" max="800" step="50" />
            </div>
          </div>

          <div class="control-group">
            <label>随机种子:</label>
            <input v-model.number="state.seed" type="number" />
          </div>
        </div>

        <div class="control-section">
          <h3>纸张颜色 / Color</h3>

          <div class="control-group color-preset">
            <label>预设颜色:</label>
            <select v-model="state.colorPreset">
              <option value="raw">生宣 Raw (纯白)</option>
              <option value="processed">熟宣 Processed (暖白)</option>
              <option value="antique">古宣 Antique (米黄)</option>
              <option value="teaStained">茶染 Tea-stained</option>
              <option value="moonWhite">月白 Moon White</option>
            </select>
          </div>

          <div class="color-preview">
            <div
              class="color-swatch"
              :style="{
                backgroundColor: `rgb(${selectedColor.join(',')})`,
              }"
            />
            <span class="color-value">RGB({{ selectedColor.join(", ") }})</span>
          </div>
          <p class="preset-note">{{ paperPresetDescription }}</p>
        </div>

        <div class="control-section">
          <h3>纤维纹理 / Fiber</h3>

          <div class="control-group">
            <label>纤维密度:</label>
            <input v-model.number="state.fiberDensity" type="range" min="0" max="3" step="0.1" />
            <span class="value">{{ state.fiberDensity.toFixed(1) }}</span>
          </div>

          <div class="control-group">
            <label>纤维长度:</label>
            <input v-model.number="state.fiberScale" type="range" min="0.3" max="2" step="0.1" />
            <span class="value">{{ state.fiberScale.toFixed(1) }}</span>
          </div>

          <div class="control-group">
            <label>纹理强度:</label>
            <input
              v-model.number="state.textureIntensity"
              type="range"
              min="0"
              max="1"
              step="0.05"
            />
            <span class="value">{{ state.textureIntensity.toFixed(2) }}</span>
          </div>

          <div class="control-group">
            <label>颗粒密度:</label>
            <input v-model.number="state.grainDensity" type="range" min="0" max="1" step="0.1" />
            <span class="value">{{ state.grainDensity.toFixed(1) }}</span>
          </div>
        </div>

        <div class="control-section gold-section">
          <h3>撒金效果 / Gold Flecks</h3>

          <div class="control-group checkbox">
            <label>
              <input v-model="state.goldFlecks" type="checkbox" />
              启用撒金 (Enable Gold)
            </label>
          </div>

          <template v-if="state.goldFlecks">
            <div class="control-group color-preset">
              <label>金色:</label>
              <select v-model="state.goldColorPreset">
                <option value="gold">经典金 Gold</option>
                <option value="paleGold">淡金 Pale Gold</option>
                <option value="roseGold">玫瑰金 Rose Gold</option>
                <option value="copper">古铜 Copper</option>
                <option value="silver">银 Silver</option>
                <option value="bronze">青铜 Bronze</option>
              </select>
            </div>

            <div class="gold-color-preview">
              <div
                class="color-swatch gold"
                :style="{
                  backgroundColor: `rgb(${selectedGoldColor.join(',')})`,
                }"
              />
            </div>

            <div class="control-group">
              <label>密度:</label>
              <input v-model.number="state.goldDensity" type="range" min="0.1" max="1" step="0.1" />
              <span class="value">{{ state.goldDensity.toFixed(1) }}</span>
            </div>

            <div class="control-group">
              <label>最小尺寸:</label>
              <input v-model.number="state.goldSizeMin" type="range" min="1" max="8" step="1" />
              <span class="value">{{ state.goldSizeMin }}px</span>
            </div>

            <div class="control-group">
              <label>最大尺寸:</label>
              <input v-model.number="state.goldSizeMax" type="range" min="5" max="25" step="1" />
              <span class="value">{{ state.goldSizeMax }}px</span>
            </div>

            <div class="control-group">
              <label>聚集度:</label>
              <input
                v-model.number="state.goldClustering"
                type="range"
                min="0"
                max="0.8"
                step="0.1"
              />
              <span class="value">{{ state.goldClustering.toFixed(1) }}</span>
            </div>
          </template>
        </div>

        <div class="control-section">
          <h3>特效 / Effects</h3>

          <div class="control-group">
            <label>老化程度:</label>
            <input v-model.number="state.age" type="range" min="0" max="1" step="0.05" />
            <span class="value">{{ (state.age * 100).toFixed(0) }}%</span>
          </div>

          <div class="control-group checkbox">
            <label>
              <input v-model="state.deckleEdge" type="checkbox" />
              毛边效果 (Deckle Edge)
            </label>
          </div>

          <div v-if="state.deckleEdge" class="control-group">
            <label>毛边粗糙度:</label>
            <input
              v-model.number="state.deckleRoughness"
              type="range"
              min="0.1"
              max="1"
              step="0.1"
            />
            <span class="value">{{ state.deckleRoughness.toFixed(1) }}</span>
          </div>
        </div>

        <div class="button-group">
          <button class="btn-primary" @click="generateNew">生成新纸张</button>
          <button class="btn-secondary" @click="generate">重新生成</button>
          <button class="btn-download" @click="downloadPaper">下载 PNG</button>
        </div>
      </div>

      <div class="preview">
        <div v-show="state.renderMode === 'canvas'" ref="canvasContainer" class="paper-display" />
        <div v-show="state.renderMode === 'svg'" ref="svgContainer" class="paper-display" />
      </div>
    </div>

    <div class="info">
      <h2>关于宣纸 / About Xuan Paper</h2>
      <p>
        宣纸（Xuan Paper）是中国传统书画的专用纸张，产于安徽省宣城市泾县，
        以青檀树皮和沙田稻草为主要原料，具有独特的纤维纹理和良好的吸墨性能。
      </p>

      <h3>撒金宣 / Gold-Flecked Paper</h3>
      <p>
        撒金宣是一种装饰性宣纸，表面撒有金箔或金粉碎片，常用于书写对联、贺词等喜庆场合。
        现在的生成器会先建立纸性的“底材模型”，再让金箔贴合纸面的厚薄起伏与边缘节奏，
        不再只是单独盖一层金点。
      </p>

      <h3>纸性模型 / Paper Character Model</h3>
      <ul>
        <li><strong>生宣取向:</strong> 纤维更外露，纸面更轻、更白，厚薄起伏更明显。</li>
        <li><strong>半熟取向:</strong> 纤维、颗粒和底色比较均衡，适合作为默认展示。</li>
        <li>
          <strong>熟宣取向:</strong> 纸面更温润、更匀整，纤维感收敛，旧化时更容易显出沉静暖色。
        </li>
        <li><strong>颜色预设:</strong> 仍然保留旧 API 的颜色名字，但内部会映射到不同纸性。</li>
      </ul>

      <h3>使用方式 / Usage</h3>
      <pre><code>import { XuanPaper, GoldFleckColors } from '@jobinjia/shuimo-core'

// 撒金宣
const canvas = XuanPaper.generate({
  width: 800,
  height: 600,
  goldFlecks: true,
  goldDensity: 0.5,
  goldSize: [1, 4],
  goldColor: GoldFleckColors.gold,
  goldClustering: 0.3,
})</code></pre>
    </div>
  </div>
</template>

<style scoped>
.xuan-paper-demo {
  max-width: 1400px;
  margin: 0 auto;
  padding: 2rem;
  min-height: 100vh;
  background: #fafafa;
}

.header {
  text-align: center;
  margin-bottom: 2rem;
}

.header h1 {
  font-size: 2.5rem;
  margin-bottom: 0.5rem;
  color: #2c3e50;
  font-weight: 300;
}

.subtitle {
  font-size: 1.1rem;
  color: #666;
}

.main-content {
  display: grid;
  grid-template-columns: 320px 1fr;
  gap: 2rem;
  margin-bottom: 2rem;
}

.controls {
  background: white;
  padding: 1.5rem;
  border-radius: 12px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
  height: fit-content;
}

.control-section {
  margin-bottom: 1.5rem;
  padding-bottom: 1.5rem;
  border-bottom: 1px solid #eee;
}

.control-section:last-of-type {
  border-bottom: none;
  margin-bottom: 1rem;
  padding-bottom: 0;
}

.control-section h3 {
  margin: 0 0 1rem 0;
  color: #2c3e50;
  font-size: 1rem;
  font-weight: 600;
}

.gold-section {
  background: linear-gradient(135deg, #fef9e7 0%, #fdf6e3 100%);
  margin: -1.5rem;
  margin-bottom: 1.5rem;
  padding: 1.5rem;
  border-radius: 8px;
}

.gold-section h3 {
  color: #b8860b;
}

.control-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

.control-group {
  margin-bottom: 0.75rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.control-group label {
  font-size: 0.9rem;
  color: #555;
  min-width: 70px;
}

.control-group input[type="number"] {
  flex: 1;
  padding: 0.4rem 0.5rem;
  font-size: 0.9rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  width: 100%;
}

.control-group input[type="range"] {
  flex: 1;
}

.control-group .value {
  min-width: 45px;
  text-align: right;
  font-size: 0.85rem;
  color: #888;
  font-family: monospace;
}

.control-group.checkbox label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: auto;
  cursor: pointer;
}

.control-group.checkbox input[type="checkbox"] {
  width: 16px;
  height: 16px;
  cursor: pointer;
}

.color-preset select {
  flex: 1;
  padding: 0.4rem;
  font-size: 0.9rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: white;
}

.color-preview,
.gold-color-preview {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-top: 0.5rem;
  margin-bottom: 0.75rem;
}

.color-swatch {
  width: 40px;
  height: 40px;
  border-radius: 6px;
  border: 1px solid #ddd;
  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.1);
}

.color-swatch.gold {
  box-shadow: 0 2px 8px rgba(218, 165, 32, 0.4);
}

.color-value {
  font-size: 0.85rem;
  color: #888;
  font-family: monospace;
}

.preset-note {
  margin: 0;
  font-size: 0.84rem;
  line-height: 1.5;
  color: #6b6258;
}

.radio-group {
  display: flex;
  gap: 1rem;
  flex: 1;
}

.radio-label {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  cursor: pointer;
  font-size: 0.9rem;
  color: #555;
}

.radio-label input[type="radio"] {
  cursor: pointer;
}

.button-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: 1rem;
}

.btn-primary,
.btn-secondary,
.btn-download {
  padding: 0.7rem 1rem;
  font-size: 0.9rem;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary {
  background: #8b7355;
  color: white;
}

.btn-primary:hover {
  background: #7a6349;
}

.btn-secondary {
  background: #e8e4df;
  color: #555;
}

.btn-secondary:hover {
  background: #ddd8d2;
}

.btn-download {
  background: #5a8a6e;
  color: white;
}

.btn-download:hover {
  background: #4d7760;
}

.preview {
  display: flex;
  justify-content: stretch;
  align-items: flex-start;
  min-width: 0;
}

.paper-display {
  background: #333;
  border-radius: 12px;
  padding: 2rem;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-width: 0;
}

.paper-display :deep(canvas),
.paper-display :deep(svg) {
  display: block;
  width: 100%;
  max-width: none;
  height: auto;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
}

.info {
  background: white;
  padding: 2rem;
  border-radius: 12px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
}

.info h2 {
  color: #2c3e50;
  margin-top: 0;
  margin-bottom: 1rem;
  font-weight: 500;
}

.info h3 {
  color: #2c3e50;
  margin-top: 1.5rem;
  margin-bottom: 0.75rem;
  font-weight: 500;
}

.info p {
  line-height: 1.8;
  color: #555;
  margin-bottom: 1rem;
}

.info ul {
  line-height: 1.8;
  color: #555;
  padding-left: 1.5rem;
}

.info li {
  margin-bottom: 0.5rem;
}

.info li strong {
  color: #2c3e50;
}

.info pre {
  background: #f5f5f5;
  padding: 1rem;
  border-radius: 8px;
  overflow-x: auto;
}

.info code {
  font-family: "SF Mono", Consolas, monospace;
  font-size: 0.85rem;
  color: #333;
}

@media (max-width: 900px) {
  .main-content {
    grid-template-columns: 1fr;
  }

  .controls {
    order: 2;
  }

  .preview {
    order: 1;
  }
}
</style>
