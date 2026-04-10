<script setup lang="ts">
import { XuanPaper, XuanPaperColors, GoldFleckColors, type XuanPaperOptions } from "@jobinjia/shuimo-core";
import { onMounted, ref, watch } from "vue";

const canvasContainer = ref<HTMLDivElement>();
const svgContainer = ref<HTMLDivElement>();

// Basic settings
const width = ref(600);
const height = ref(400);
const seed = ref(Date.now());

// Paper settings
const fiberDensity = ref(1.0);
const fiberScale = ref(1.0);
const textureIntensity = ref(0.3);
const grainDensity = ref(0.5);
const age = ref(0);
const deckleEdge = ref(false);
const deckleRoughness = ref(0.5);

// Color presets
const colorPreset = ref<keyof typeof XuanPaperColors>("processed");

// Render mode
const renderMode = ref<"canvas" | "svg">("canvas");

// Gold fleck settings (洒金宣)
const goldFlecks = ref(false);
const goldDensity = ref(0.5);
const goldSizeMin = ref(2);
const goldSizeMax = ref(12);
const goldColorPreset = ref<keyof typeof GoldFleckColors>("gold");
const goldClustering = ref(0.3);

function getColor(): [number, number, number] {
  return XuanPaperColors[colorPreset.value];
}

function getGoldColor(): [number, number, number] {
  return GoldFleckColors[goldColorPreset.value];
}

function generate() {
  const options: XuanPaperOptions = {
    width: width.value,
    height: height.value,
    baseColor: getColor(),
    fiberDensity: fiberDensity.value,
    fiberScale: fiberScale.value,
    textureIntensity: textureIntensity.value,
    grainDensity: grainDensity.value,
    age: age.value,
    deckleEdge: deckleEdge.value,
    deckleRoughness: deckleRoughness.value,
    seed: seed.value,
    // Gold fleck options
    goldFlecks: goldFlecks.value,
    goldDensity: goldDensity.value,
    goldSize: [goldSizeMin.value, goldSizeMax.value],
    goldColor: getGoldColor(),
    goldClustering: goldClustering.value,
  };

  if (renderMode.value === "canvas" && canvasContainer.value) {
    canvasContainer.value.innerHTML = "";
    const canvas = XuanPaper.generate(options);
    canvasContainer.value.appendChild(canvas);
  } else if (renderMode.value === "svg" && svgContainer.value) {
    svgContainer.value.innerHTML = "";
    const svg = XuanPaper.generateSVG(options);
    svgContainer.value.appendChild(svg);
  }
}

function generateNew() {
  seed.value = Date.now();
  generate();
}

function downloadPaper() {
  const options: XuanPaperOptions = {
    width: width.value,
    height: height.value,
    baseColor: getColor(),
    fiberDensity: fiberDensity.value,
    fiberScale: fiberScale.value,
    textureIntensity: textureIntensity.value,
    grainDensity: grainDensity.value,
    age: age.value,
    deckleEdge: deckleEdge.value,
    deckleRoughness: deckleRoughness.value,
    seed: seed.value,
    goldFlecks: goldFlecks.value,
    goldDensity: goldDensity.value,
    goldSize: [goldSizeMin.value, goldSizeMax.value],
    goldColor: getGoldColor(),
    goldClustering: goldClustering.value,
  };

  const canvas = XuanPaper.generate(options);
  const link = document.createElement("a");
  link.download = `xuan-paper-${seed.value}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
}

// Watch for changes and regenerate
watch(
  [
    width,
    height,
    fiberDensity,
    fiberScale,
    textureIntensity,
    grainDensity,
    age,
    deckleEdge,
    deckleRoughness,
    colorPreset,
    renderMode,
    goldFlecks,
    goldDensity,
    goldSizeMin,
    goldSizeMax,
    goldColorPreset,
    goldClustering,
  ],
  () => {
    generate();
  },
);

onMounted(() => {
  generate();
});
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
                <input v-model="renderMode" type="radio" value="canvas" />
                Canvas
              </label>
              <label class="radio-label">
                <input v-model="renderMode" type="radio" value="svg" />
                SVG
              </label>
            </div>
          </div>

          <div class="control-row">
            <div class="control-group">
              <label>宽度:</label>
              <input v-model.number="width" type="number" min="200" max="1200" step="50" />
            </div>
            <div class="control-group">
              <label>高度:</label>
              <input v-model.number="height" type="number" min="200" max="800" step="50" />
            </div>
          </div>

          <div class="control-group">
            <label>随机种子:</label>
            <input v-model.number="seed" type="number" />
          </div>
        </div>

        <div class="control-section">
          <h3>纸张颜色 / Color</h3>

          <div class="control-group color-preset">
            <label>预设颜色:</label>
            <select v-model="colorPreset">
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
                backgroundColor: `rgb(${getColor().join(',')})`,
              }"
            />
            <span class="color-value">RGB({{ getColor().join(", ") }})</span>
          </div>
        </div>

        <div class="control-section">
          <h3>纤维纹理 / Fiber</h3>

          <div class="control-group">
            <label>纤维密度:</label>
            <input v-model.number="fiberDensity" type="range" min="0" max="3" step="0.1" />
            <span class="value">{{ fiberDensity.toFixed(1) }}</span>
          </div>

          <div class="control-group">
            <label>纤维长度:</label>
            <input v-model.number="fiberScale" type="range" min="0.3" max="2" step="0.1" />
            <span class="value">{{ fiberScale.toFixed(1) }}</span>
          </div>

          <div class="control-group">
            <label>纹理强度:</label>
            <input v-model.number="textureIntensity" type="range" min="0" max="1" step="0.05" />
            <span class="value">{{ textureIntensity.toFixed(2) }}</span>
          </div>

          <div class="control-group">
            <label>颗粒密度:</label>
            <input v-model.number="grainDensity" type="range" min="0" max="1" step="0.1" />
            <span class="value">{{ grainDensity.toFixed(1) }}</span>
          </div>
        </div>

        <div class="control-section gold-section">
          <h3>撒金效果 / Gold Flecks</h3>

          <div class="control-group checkbox">
            <label>
              <input v-model="goldFlecks" type="checkbox" />
              启用撒金 (Enable Gold)
            </label>
          </div>

          <template v-if="goldFlecks">
            <div class="control-group color-preset">
              <label>金色:</label>
              <select v-model="goldColorPreset">
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
                  backgroundColor: `rgb(${getGoldColor().join(',')})`,
                }"
              />
            </div>

            <div class="control-group">
              <label>密度:</label>
              <input v-model.number="goldDensity" type="range" min="0.1" max="1" step="0.1" />
              <span class="value">{{ goldDensity.toFixed(1) }}</span>
            </div>

            <div class="control-group">
              <label>最小尺寸:</label>
              <input v-model.number="goldSizeMin" type="range" min="1" max="8" step="1" />
              <span class="value">{{ goldSizeMin }}px</span>
            </div>

            <div class="control-group">
              <label>最大尺寸:</label>
              <input v-model.number="goldSizeMax" type="range" min="5" max="25" step="1" />
              <span class="value">{{ goldSizeMax }}px</span>
            </div>

            <div class="control-group">
              <label>聚集度:</label>
              <input v-model.number="goldClustering" type="range" min="0" max="0.8" step="0.1" />
              <span class="value">{{ goldClustering.toFixed(1) }}</span>
            </div>
          </template>
        </div>

        <div class="control-section">
          <h3>特效 / Effects</h3>

          <div class="control-group">
            <label>老化程度:</label>
            <input v-model.number="age" type="range" min="0" max="1" step="0.05" />
            <span class="value">{{ (age * 100).toFixed(0) }}%</span>
          </div>

          <div class="control-group checkbox">
            <label>
              <input v-model="deckleEdge" type="checkbox" />
              毛边效果 (Deckle Edge)
            </label>
          </div>

          <div v-if="deckleEdge" class="control-group">
            <label>毛边粗糙度:</label>
            <input v-model.number="deckleRoughness" type="range" min="0.1" max="1" step="0.1" />
            <span class="value">{{ deckleRoughness.toFixed(1) }}</span>
          </div>
        </div>

        <div class="button-group">
          <button class="btn-primary" @click="generateNew">生成新纸张</button>
          <button class="btn-secondary" @click="generate">重新生成</button>
          <button class="btn-download" @click="downloadPaper">下载 PNG</button>
        </div>
      </div>

      <div class="preview">
        <div v-show="renderMode === 'canvas'" ref="canvasContainer" class="paper-display" />
        <div v-show="renderMode === 'svg'" ref="svgContainer" class="paper-display" />
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
        本生成器使用 <strong>Perlin 噪声</strong> 算法来控制金点的分布，使其看起来自然随机，
        避免过于规则的人工感。
      </p>

      <h3>Perlin 噪声算法 / Perlin Noise Algorithm</h3>
      <ul>
        <li>
          <strong>位置分布:</strong> 使用 Perlin 噪声创建聚集效果，金点会自然聚集在噪声值高的区域
        </li>
        <li><strong>大小变化:</strong> 金点大小由第二个 Perlin 噪声控制，产生自然的大小变化</li>
        <li><strong>颜色变化:</strong> 金色亮度随噪声变化，模拟金属的光泽效果</li>
        <li><strong>形状多样:</strong> 随机选择圆形、不规则圆形或椭圆形，增加真实感</li>
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
  justify-content: center;
  align-items: flex-start;
}

.paper-display {
  background: #333;
  border-radius: 12px;
  padding: 2rem;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  display: flex;
  align-items: center;
  justify-content: center;
}

.paper-display :deep(canvas),
.paper-display :deep(svg) {
  max-width: 100%;
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
