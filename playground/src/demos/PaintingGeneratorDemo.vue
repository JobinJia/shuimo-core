<script setup lang="ts">
import { onMounted, ref } from "vue";
import {
  PaintingGenerator,
  type BlankPosition,
  type PaintingType,
  XuanPaperColors,
  GoldFleckColors,
} from "@shuimo/core";

// Form state
const paintingType = ref<PaintingType>("landscape");
const width = ref(1400);
const height = ref(800);
const onXuanPaper = ref(true);
const blankPosition = ref<BlankPosition>("none");
const seed = ref(String(Date.now()));

// Flower options
const flowerType = ref<"woody" | "herbal" | "random">("random");

// Xuan paper options
const paperColorPreset = ref<
  "processed" | "raw" | "antique" | "teaStained" | "moonWhite" | "custom"
>("processed");
const customPaperColor = ref({ r: 252, g: 250, b: 240 });
const textureIntensity = ref(0.3);
const age = ref(0);
const fiberDensity = ref(1.0);
const grainDensity = ref(0.5);

// Gold fleck options
const goldFlecks = ref(false);
const goldDensity = ref(0.5);
const goldColorPreset = ref<"gold" | "paleGold" | "roseGold" | "copper" | "silver" | "bronze">(
  "gold",
);

// Canvas container
const canvasContainer = ref<HTMLDivElement | null>(null);

// Paper color presets
const paperColorOptions = [
  { value: "processed", label: "熟宣 (暖白)" },
  { value: "raw", label: "生宣 (纯白)" },
  { value: "antique", label: "古宣 (米黄)" },
  { value: "teaStained", label: "茶染 (浅褐)" },
  { value: "moonWhite", label: "月白 (冷白)" },
  { value: "custom", label: "自定义" },
];

// Gold color presets
const goldColorOptions = [
  { value: "gold", label: "经典金" },
  { value: "paleGold", label: "淡金" },
  { value: "roseGold", label: "玫瑰金" },
  { value: "copper", label: "古铜" },
  { value: "silver", label: "银" },
  { value: "bronze", label: "青铜" },
];

// Blank position options
const blankPositionOptions: { value: BlankPosition; label: string }[] = [
  { value: "none", label: "无留白" },
  { value: "topLeft", label: "左上" },
  { value: "top", label: "上方" },
  { value: "topRight", label: "右上" },
  { value: "left", label: "左侧" },
  { value: "center", label: "中心" },
  { value: "right", label: "右侧" },
  { value: "bottomLeft", label: "左下" },
  { value: "bottom", label: "下方" },
  { value: "bottomRight", label: "右下" },
];

function getPaperColor(): [number, number, number] {
  switch (paperColorPreset.value) {
    case "raw":
      return XuanPaperColors.raw;
    case "antique":
      return XuanPaperColors.antique;
    case "teaStained":
      return XuanPaperColors.teaStained;
    case "moonWhite":
      return XuanPaperColors.moonWhite;
    case "custom":
      return [customPaperColor.value.r, customPaperColor.value.g, customPaperColor.value.b];
    case "processed":
    default:
      return XuanPaperColors.processed;
  }
}

function getGoldColor(): [number, number, number] {
  switch (goldColorPreset.value) {
    case "paleGold":
      return GoldFleckColors.paleGold;
    case "roseGold":
      return GoldFleckColors.roseGold;
    case "copper":
      return GoldFleckColors.copper;
    case "silver":
      return GoldFleckColors.silver;
    case "bronze":
      return GoldFleckColors.bronze;
    case "gold":
    default:
      return GoldFleckColors.gold;
  }
}

function render() {
  if (!canvasContainer.value) return;

  const seedNum = Number.parseInt(seed.value) || Date.now();

  const result = PaintingGenerator.generate({
    type: paintingType.value,
    width: width.value,
    height: height.value,
    onXuanPaper: onXuanPaper.value,
    blankPosition: blankPosition.value,
    seed: seedNum,
    flowerType: flowerType.value,
    xuanPaperOptions: {
      baseColor: getPaperColor(),
      textureIntensity: textureIntensity.value,
      age: age.value,
      fiberDensity: fiberDensity.value,
      grainDensity: grainDensity.value,
      goldFlecks: goldFlecks.value,
      goldDensity: goldDensity.value,
      goldColor: getGoldColor(),
    },
  });

  canvasContainer.value.innerHTML = result.svg;
}

function randomSeed() {
  seed.value = String(Date.now());
  render();
}

function downloadSVG() {
  if (!canvasContainer.value) return;

  const svgContent = canvasContainer.value.innerHTML;
  const blob = new Blob([svgContent], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = `shuimo-${paintingType.value}-${seed.value}.svg`;
  link.click();

  URL.revokeObjectURL(url);
}

onMounted(() => {
  render();
});
</script>

<template>
  <div class="painting-demo">
    <div class="sidebar-controls">
      <h3>画作生成器</h3>

      <!-- Basic Settings -->
      <div class="control-section">
        <h4>基本设置</h4>

        <div class="control-row">
          <label>画作类型</label>
          <select v-model="paintingType">
            <option value="landscape">山水画</option>
            <option value="flowerBird">花鸟画</option>
          </select>
        </div>

        <div class="control-row">
          <label>宽度</label>
          <input v-model.number="width" type="number" min="400" max="2000" step="100" />
        </div>

        <div class="control-row">
          <label>高度</label>
          <input v-model.number="height" type="number" min="300" max="1500" step="100" />
        </div>

        <div class="control-row">
          <label>随机种子</label>
          <input v-model="seed" type="text" />
        </div>
      </div>

      <!-- Paper Settings -->
      <div class="control-section">
        <h4>宣纸设置</h4>

        <div class="control-row checkbox">
          <label>
            <input v-model="onXuanPaper" type="checkbox" />
            使用宣纸背景
          </label>
        </div>

        <template v-if="onXuanPaper">
          <div class="control-row">
            <label>纸张颜色</label>
            <select v-model="paperColorPreset">
              <option v-for="opt in paperColorOptions" :key="opt.value" :value="opt.value">
                {{ opt.label }}
              </option>
            </select>
          </div>

          <template v-if="paperColorPreset === 'custom'">
            <div class="control-row color-picker">
              <label>R</label>
              <input v-model.number="customPaperColor.r" type="range" min="200" max="255" />
              <span class="value">{{ customPaperColor.r }}</span>
            </div>
            <div class="control-row color-picker">
              <label>G</label>
              <input v-model.number="customPaperColor.g" type="range" min="200" max="255" />
              <span class="value">{{ customPaperColor.g }}</span>
            </div>
            <div class="control-row color-picker">
              <label>B</label>
              <input v-model.number="customPaperColor.b" type="range" min="180" max="255" />
              <span class="value">{{ customPaperColor.b }}</span>
            </div>
          </template>

          <div class="control-row">
            <label>纹理强度</label>
            <input v-model.number="textureIntensity" type="range" min="0" max="1" step="0.1" />
            <span class="value">{{ textureIntensity.toFixed(1) }}</span>
          </div>

          <div class="control-row">
            <label>陈旧程度</label>
            <input v-model.number="age" type="range" min="0" max="1" step="0.1" />
            <span class="value">{{ age.toFixed(1) }}</span>
          </div>

          <div class="control-row">
            <label>纤维密度</label>
            <input v-model.number="fiberDensity" type="range" min="0" max="2" step="0.2" />
            <span class="value">{{ fiberDensity.toFixed(1) }}</span>
          </div>

          <div class="control-row">
            <label>颗粒密度</label>
            <input v-model.number="grainDensity" type="range" min="0" max="1" step="0.1" />
            <span class="value">{{ grainDensity.toFixed(1) }}</span>
          </div>

          <!-- Gold Flecks -->
          <div class="sub-section">
            <div class="control-row checkbox">
              <label>
                <input v-model="goldFlecks" type="checkbox" />
                洒金效果 (撒金宣)
              </label>
            </div>

            <template v-if="goldFlecks">
              <div class="control-row">
                <label>金色</label>
                <select v-model="goldColorPreset">
                  <option v-for="opt in goldColorOptions" :key="opt.value" :value="opt.value">
                    {{ opt.label }}
                  </option>
                </select>
              </div>

              <div class="control-row">
                <label>金量</label>
                <input v-model.number="goldDensity" type="range" min="0.1" max="1" step="0.1" />
                <span class="value">{{ goldDensity.toFixed(1) }}</span>
              </div>
            </template>
          </div>
        </template>
      </div>

      <!-- Composition Settings -->
      <div class="control-section">
        <h4>构图设置（留白）</h4>

        <div class="control-row">
          <label>留白位置</label>
          <select v-model="blankPosition">
            <option v-for="opt in blankPositionOptions" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </option>
          </select>
        </div>

        <!-- Blank position visual hint -->
        <div class="blank-hint">
          <div class="blank-grid" :class="`blank-${blankPosition}`">
            <div v-for="i in 9" :key="i" class="blank-cell" />
          </div>
          <p class="hint-text">浅色区域不生成元素</p>
        </div>
      </div>

      <!-- Flower Options -->
      <div v-if="paintingType === 'flowerBird'" class="control-section">
        <h4>花鸟画设置</h4>

        <div class="control-row">
          <label>花卉类型</label>
          <select v-model="flowerType">
            <option value="random">随机</option>
            <option value="woody">木本</option>
            <option value="herbal">草本</option>
          </select>
        </div>
      </div>

      <!-- Actions -->
      <div class="control-section actions">
        <button class="btn-primary" @click="render">生成画作</button>
        <button @click="randomSeed">随机种子</button>
        <button @click="downloadSVG">下载 SVG</button>
      </div>
    </div>

    <div class="canvas-area">
      <div ref="canvasContainer" class="canvas-container" />
    </div>
  </div>
</template>

<style scoped>
.painting-demo {
  display: flex;
  height: 100%;
  width: 100%;
}

.sidebar-controls {
  width: 300px;
  background: #fff;
  border-right: 1px solid #ddd;
  padding: 16px;
  overflow-y: auto;
  flex-shrink: 0;
}

.sidebar-controls h3 {
  margin: 0 0 16px;
  font-size: 18px;
  color: #333;
  padding-bottom: 12px;
  border-bottom: 2px solid #3498db;
}

.control-section {
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid #eee;
}

.control-section:last-child {
  border-bottom: none;
}

.control-section h4 {
  margin: 0 0 12px;
  font-size: 14px;
  color: #666;
  font-weight: 600;
}

.sub-section {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px dashed #ddd;
}

.control-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}

.control-row label {
  flex-shrink: 0;
  width: 70px;
  font-size: 13px;
  color: #555;
}

.control-row.checkbox label {
  width: auto;
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
}

.control-row.color-picker label {
  width: 20px;
  text-align: center;
}

.control-row input[type="text"],
.control-row input[type="number"],
.control-row select {
  flex: 1;
  padding: 6px 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 13px;
}

.control-row input[type="range"] {
  flex: 1;
}

.control-row .value {
  width: 36px;
  text-align: right;
  font-size: 12px;
  color: #888;
}

.blank-hint {
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.hint-text {
  margin: 0;
  font-size: 11px;
  color: #999;
}

.blank-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 2px;
  width: 90px;
  height: 60px;
  background: #ddd;
  padding: 2px;
  border-radius: 4px;
}

.blank-cell {
  background: #666;
  border-radius: 2px;
  transition: background 0.2s;
}

/* Blank position highlighting */
.blank-none .blank-cell {
  background: #666;
}

.blank-topLeft .blank-cell:nth-child(1),
.blank-topLeft .blank-cell:nth-child(2),
.blank-topLeft .blank-cell:nth-child(4) {
  background: #f5f5dc;
}

.blank-top .blank-cell:nth-child(1),
.blank-top .blank-cell:nth-child(2),
.blank-top .blank-cell:nth-child(3) {
  background: #f5f5dc;
}

.blank-topRight .blank-cell:nth-child(2),
.blank-topRight .blank-cell:nth-child(3),
.blank-topRight .blank-cell:nth-child(6) {
  background: #f5f5dc;
}

.blank-left .blank-cell:nth-child(1),
.blank-left .blank-cell:nth-child(4),
.blank-left .blank-cell:nth-child(7) {
  background: #f5f5dc;
}

.blank-center .blank-cell:nth-child(5) {
  background: #f5f5dc;
}

.blank-right .blank-cell:nth-child(3),
.blank-right .blank-cell:nth-child(6),
.blank-right .blank-cell:nth-child(9) {
  background: #f5f5dc;
}

.blank-bottomLeft .blank-cell:nth-child(4),
.blank-bottomLeft .blank-cell:nth-child(7),
.blank-bottomLeft .blank-cell:nth-child(8) {
  background: #f5f5dc;
}

.blank-bottom .blank-cell:nth-child(7),
.blank-bottom .blank-cell:nth-child(8),
.blank-bottom .blank-cell:nth-child(9) {
  background: #f5f5dc;
}

.blank-bottomRight .blank-cell:nth-child(6),
.blank-bottomRight .blank-cell:nth-child(8),
.blank-bottomRight .blank-cell:nth-child(9) {
  background: #f5f5dc;
}

.actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.actions button {
  padding: 10px 16px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: #fff;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}

.actions button:hover {
  background: #f5f5f5;
}

.actions .btn-primary {
  background: #3498db;
  color: #fff;
  border-color: #3498db;
}

.actions .btn-primary:hover {
  background: #2980b9;
}

.canvas-area {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #e5e5e5;
  padding: 20px;
  overflow: auto;
}

.canvas-container {
  background: #fff;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  border-radius: 4px;
}

.canvas-container :deep(svg) {
  display: block;
}
</style>
