<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { generateStampAsync, type StampOptions, type StampType, type StampShape, type StampTextCarving } from '@shuimo/core'

const FONT_URLS: Record<string, string | undefined> = {
  峄山碑篆体: '/fonts/yishanbeizhuanti.ttf',
}

// Text configuration
const textLines = ref(['水墨', '江南'])
const initialText = '水墨\n江南'
const fontsReady = ref(false)

interface StampTuningProfile {
  offsetX: number
  offsetY: number
  columnSpacing: number
  characterSpacing: number
  paddingX: number
  paddingY: number
  borderScaleX: number
  borderScaleY: number
  noiseAmountPx: number
  borderPointsPx: number
  cornerRadiusPx: number
  borderWidthPx: number
  regularShape: boolean
}

const shapeProfiles: Record<Exclude<StampShape, 'auto'> | 'auto', StampTuningProfile> = {
  auto: {
    offsetX: 0,
    offsetY: 0,
    columnSpacing: 0.008,
    characterSpacing: 0.045,
    paddingX: 0.018,
    paddingY: 0.03,
    borderScaleX: 1.0,
    borderScaleY: 1.01,
    noiseAmountPx: 11,
    borderPointsPx: 28,
    cornerRadiusPx: 10,
    borderWidthPx: 6,
    regularShape: false,
  },
  square: {
    offsetX: 0,
    offsetY: 0,
    columnSpacing: 0.008,
    characterSpacing: 0.045,
    paddingX: 0.015,
    paddingY: 0.02,
    borderScaleX: 1.00,
    borderScaleY: 1.00,
    noiseAmountPx: 8,
    borderPointsPx: 24,
    cornerRadiusPx: 10,
    borderWidthPx: 4,
    regularShape: false,
  },
  rectangle: {
    offsetX: 0,
    offsetY: 0,
    columnSpacing: 0.01,
    characterSpacing: 0.045,
    paddingX: 0.015,
    paddingY: 0.02,
    borderScaleX: 1.00,
    borderScaleY: 1.00,
    noiseAmountPx: 9,
    borderPointsPx: 24,
    cornerRadiusPx: 10,
    borderWidthPx: 4,
    regularShape: false,
  },
  circle: {
    offsetX: 0,
    offsetY: 0,
    columnSpacing: 0.05,
    characterSpacing: 0.04,
    paddingX: 0.06,
    paddingY: 0.06,
    borderScaleX: 1.00,
    borderScaleY: 1.00,
    noiseAmountPx: 9,
    borderPointsPx: 32,
    cornerRadiusPx: 10,
    borderWidthPx: 4,
    regularShape: false,
  },
  ellipse: {
    offsetX: 0,
    offsetY: 0,
    columnSpacing: 0.01,
    characterSpacing: 0.045,
    paddingX: 0.02,
    paddingY: 0.035,
    borderScaleX: 1.0,
    borderScaleY: 1.015,
    noiseAmountPx: 10,
    borderPointsPx: 32,
    cornerRadiusPx: 10,
    borderWidthPx: 4,
    regularShape: false,
  },
}

// Stamp parameters
const stampType = ref<StampType>('yang')
const stampShape = ref<StampShape>('auto')
const color = ref('#C8102E')
const fontFamily = ref('峄山碑篆体')
const fontSize = ref(100)
const fontWeight = ref<string | number>('normal')
const textCarving = ref<StampTextCarving>('normal')
const offsetX = ref(0)
const offsetY = ref(0)
const columnSpacing = ref(0.012)
const characterSpacing = ref(0.05)
const paddingX = ref(0.025)
const paddingY = ref(0.04)
const borderScaleX = ref(1.0)
const borderScaleY = ref(1.015)
const noiseAmount = ref(10)
const borderPoints = ref(28)
const cornerRadius = ref(10)
const borderWidth = ref(6)
const regularShape = ref(false)
const seed = ref(12345)

onMounted(async () => {
  await document.fonts.ready
  await waitForFont(fontFamily.value, fontSize.value)
  fontsReady.value = true
})

// Text input
const textInput = ref(initialText)
const userModifiedText = ref(false)
const userModifiedTuning = ref(false)
const applyingTuningProfile = ref(false)

async function waitForFont(fontFamily: string, fontSize: number) {
  if (typeof document === 'undefined' || !document.fonts)
    return

  const fontSpec = `${fontSize}px ${fontFamily}`

  for (let attempt = 0; attempt < 20; attempt++) {
    if (document.fonts.check(fontSpec))
      return

    try {
      await document.fonts.load(fontSpec)
    }
    catch {
      // 忽略瞬时失败，继续等待字体注册完成。
    }

    if (document.fonts.check(fontSpec))
      return

    await new Promise(resolve => setTimeout(resolve, 100))
  }
}

function applyTuningProfile(profile: StampTuningProfile) {
  applyingTuningProfile.value = true
  offsetX.value = profile.offsetX
  offsetY.value = profile.offsetY
  columnSpacing.value = profile.columnSpacing
  characterSpacing.value = profile.characterSpacing
  paddingX.value = profile.paddingX
  paddingY.value = profile.paddingY
  borderScaleX.value = profile.borderScaleX
  borderScaleY.value = profile.borderScaleY
  noiseAmount.value = profile.noiseAmountPx
  borderPoints.value = profile.borderPointsPx
  cornerRadius.value = profile.cornerRadiusPx
  borderWidth.value = profile.borderWidthPx
  regularShape.value = profile.regularShape
  applyingTuningProfile.value = false
}

// Sync text lines with input and track user modifications
watch(textInput, (newValue, oldValue) => {
  textLines.value = newValue.split('\n').filter(line => line.trim())

  // Mark as user modified if the change wasn't from preset application
  if (oldValue !== undefined && newValue !== initialText) {
    userModifiedText.value = true
  }
})

watch(
  [
    offsetX,
    offsetY,
    columnSpacing,
    characterSpacing,
    paddingX,
    paddingY,
    borderScaleX,
    borderScaleY,
    noiseAmount,
    borderPoints,
    cornerRadius,
    borderWidth,
    regularShape,
  ],
  () => {
    if (applyingTuningProfile.value)
      return
    userModifiedTuning.value = true
  },
)

watch(stampShape, (shape) => {
  if (!userModifiedTuning.value) {
    applyTuningProfile(shapeProfiles[shape])
  }
})

const stampOptions = computed<StampOptions>(() => ({
    text: textLines.value,
    type: stampType.value,
    shape: stampShape.value,
    color: color.value,
    fontFamily: fontFamily.value,
    fontSize: fontSize.value,
    fontWeight: fontWeight.value,
    textCarving: textCarving.value,
    offsetX: offsetX.value,
    offsetY: offsetY.value,
    columnSpacing: columnSpacing.value,
    characterSpacing: characterSpacing.value,
    paddingX: paddingX.value,
    paddingY: paddingY.value,
    borderScaleX: borderScaleX.value,
    borderScaleY: borderScaleY.value,
    noiseAmountPx: noiseAmount.value,
    borderPointsPx: borderPoints.value,
    cornerRadiusPx: cornerRadius.value,
    borderWidthPx: borderWidth.value,
    regularShape: regularShape.value,
    seed: seed.value,
  }))

const stampSvg = ref('')
let renderToken = 0

watch(
  [stampOptions, fontsReady],
  async ([options, ready]) => {
    if (!ready) {
      stampSvg.value = ''
      return
    }

    const currentToken = ++renderToken
    const svg = await generateStampAsync({
      ...options,
      fontUrl: FONT_URLS[options.fontFamily ?? ''],
    })
    if (currentToken === renderToken)
      stampSvg.value = svg
  },
  { immediate: true },
)

function randomizeSeed() {
  seed.value = Math.floor(Math.random() * 100000)
}

function resetDefaults() {
  textInput.value = initialText
  textLines.value = ['水墨', '江南']
  userModifiedText.value = false
  userModifiedTuning.value = false
  stampType.value = 'yang'
  stampShape.value = 'auto'
  color.value = '#C8102E'
  fontFamily.value = '峄山碑篆体'
  fontSize.value = 100
  fontWeight.value = 'normal'
  textCarving.value = 'normal'
  applyTuningProfile(shapeProfiles.auto)
  seed.value = 12345
}

function downloadSVG() {
  const blob = new Blob([stampSvg.value], { type: 'image/svg+xml' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `stamp-${Date.now()}.svg`
  link.click()
  URL.revokeObjectURL(url)
}

// Preset examples
const presets = [
  {
    name: '阴章 - 自动',
    config: {
      text: '落梅听\n风雪',
      type: 'yin' as StampType,
      shape: 'auto' as StampShape,
      fontSize: 70,
      ...shapeProfiles.auto,
      seed: 12345,
    },
  },
  {
    name: '阳章 - 正方形',
    config: {
      text: '月落\n乌啼',
      type: 'yang' as StampType,
      shape: 'square' as StampShape,
      fontSize: 70,
      ...shapeProfiles.square,
      seed: 11112,
    },
  },
  {
    name: '阴章 - 长方形',
    config: {
      text: '明月\n别枝\n惊鹊',
      type: 'yin' as StampType,
      shape: 'rectangle' as StampShape,
      fontSize: 70,
      ...shapeProfiles.rectangle,
      seed: 22221,
    },
  },
  {
    name: '阴章 - 圆形',
    config: {
      text: '兰',
      type: 'yin' as StampType,
      shape: 'circle' as StampShape,
      fontSize: 70,
      ...shapeProfiles.circle,
      seed: 33333,
    },
  },
  {
    name: '阳章 - 椭圆',
    config: {
      text: '隔窗\n听雨',
      type: 'yang' as StampType,
      shape: 'ellipse' as StampShape,
      fontSize: 70,
      ...shapeProfiles.ellipse,
      seed: 44444,
    },
  },
]

function applyPreset(preset: typeof presets[0]) {
  // Only update text if user hasn't modified it
  if (!userModifiedText.value) {
    textInput.value = preset.config.text
    textLines.value = preset.config.text.split('\n').filter(line => line.trim())
  }

  stampType.value = preset.config.type
  stampShape.value = preset.config.shape
  fontSize.value = preset.config.fontSize
  userModifiedTuning.value = false
  applyTuningProfile({
    offsetX: preset.config.offsetX,
    offsetY: preset.config.offsetY,
    columnSpacing: preset.config.columnSpacing,
    characterSpacing: preset.config.characterSpacing,
    paddingX: preset.config.paddingX,
    paddingY: preset.config.paddingY,
    borderScaleX: preset.config.borderScaleX,
    borderScaleY: preset.config.borderScaleY,
    noiseAmountPx: preset.config.noiseAmountPx,
    borderPointsPx: preset.config.borderPointsPx,
    cornerRadiusPx: preset.config.cornerRadiusPx,
    borderWidthPx: preset.config.borderWidthPx,
    regularShape: preset.config.regularShape,
  })
  seed.value = preset.config.seed
  userModifiedTuning.value = false
}
</script>

<template>
  <div class="stamp-playground">
    <div class="controls-panel">
      <div class="panel-header">
        <h3>印章参数配置</h3>
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
          <textarea
            v-model="textInput"
            class="text-input"
            placeholder="每行一个字段"
            rows="3"
          />
          <p class="hint">
            每行一列，从右到左排列
          </p>
        </div>

        <!-- Type & Shape -->
        <div class="control-section">
          <h4>类型与形状</h4>
          <div class="control-row">
            <label>
              <span class="label-text">类型</span>
              <select v-model="stampType" class="select-input">
                <option value="yin">阴章 (红底白字)</option>
                <option value="yang">阳章 (白底红字)</option>
              </select>
            </label>
          </div>
          <div class="control-row">
            <label>
              <span class="label-text">形状</span>
              <select v-model="stampShape" class="select-input">
                <option value="auto">自动</option>
                <option value="square">正方形</option>
                <option value="rectangle">长方形</option>
                <option value="circle">圆形</option>
                <option value="ellipse">椭圆形</option>
              </select>
            </label>
          </div>
          <div class="control-row checkbox-row">
            <label class="checkbox-label">
              <input v-model="regularShape" type="checkbox" class="checkbox-input">
              <span class="checkbox-text">规则形状 (仅非 auto 形状)</span>
            </label>
            <p class="hint">
              开启后，square、rectangle、circle、ellipse 将生成完美几何形状
            </p>
          </div>
        </div>

        <!-- Color & Font -->
        <div class="control-section">
          <h4>颜色与字体</h4>
          <div class="control-row color-row">
            <label>
              <span class="label-text">印泥颜色</span>
              <div class="color-input-group">
                <input v-model="color" type="color" class="color-picker">
                <input v-model="color" type="text" class="color-text">
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
              <span class="label-text">刀刻强度</span>
              <select v-model="textCarving" class="select-input">
                <option value="normal">默认刀刻</option>
                <option value="strong">强刀刻</option>
                <option value="stone-cut">石刻刀刻</option>
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
          <h4>尺寸与位置</h4>
          <div class="control-row">
            <label>
              <span class="label-text">字体大小: {{ fontSize }}px</span>
              <input v-model.number="fontSize" type="range" min="20" max="200" class="range-input">
            </label>
          </div>
          <div class="control-row">
            <label>
              <span class="label-text">水平偏移: {{ offsetX.toFixed(2) }} ({{ offsetX === -1 ? '左' : offsetX === 0 ? '中' : offsetX === 1 ? '右' : offsetX < 0 ? '偏左' : '偏右' }})</span>
              <input v-model.number="offsetX" type="range" min="-1" max="1" step="0.05" class="range-input">
            </label>
          </div>
          <div class="control-row">
            <label>
              <span class="label-text">垂直偏移: {{ offsetY.toFixed(2) }} ({{ offsetY === -1 ? '上' : offsetY === 0 ? '中' : offsetY === 1 ? '下' : offsetY < 0 ? '偏上' : '偏下' }})</span>
              <input v-model.number="offsetY" type="range" min="-1" max="1" step="0.05" class="range-input">
            </label>
          </div>
          <div class="control-row">
            <label>
              <span class="label-text">列间距 (左右): {{ columnSpacing.toFixed(2) }}</span>
              <input v-model.number="columnSpacing" type="range" min="-0.5" max="1.0" step="0.01" class="range-input">
            </label>
            <p class="hint">控制文字列之间的水平间距</p>
          </div>
          <div class="control-row">
            <label>
              <span class="label-text">字间距 (上下): {{ characterSpacing.toFixed(2) }}</span>
              <input v-model.number="characterSpacing" type="range" min="-0.2" max="0.5" step="0.01" class="range-input">
            </label>
            <p class="hint">控制同一列中文字的垂直间距</p>
          </div>
          <div class="control-row">
            <label>
              <span class="label-text">水平留白: {{ paddingX.toFixed(2) }}</span>
              <input v-model.number="paddingX" type="range" min="-0.1" max="0.5" step="0.01" class="range-input">
            </label>
            <p class="hint">控制文字左右两侧的留白</p>
          </div>
          <div class="control-row">
            <label>
              <span class="label-text">垂直留白: {{ paddingY.toFixed(2) }}</span>
              <input v-model.number="paddingY" type="range" min="0" max="0.5" step="0.01" class="range-input">
            </label>
            <p class="hint">控制文字上下两侧的留白</p>
          </div>
          <div class="control-row">
            <label>
              <span class="label-text">边框宽度缩放: {{ borderScaleX.toFixed(2) }}</span>
              <input v-model.number="borderScaleX" type="range" min="0.5" max="2.0" step="0.01" class="range-input">
            </label>
            <p class="hint">水平方向放大或缩小印章边框 (1.0 = 默认)</p>
          </div>
          <div class="control-row">
            <label>
              <span class="label-text">边框高度缩放: {{ borderScaleY.toFixed(2) }}</span>
              <input v-model.number="borderScaleY" type="range" min="0.5" max="2.0" step="0.01" class="range-input">
            </label>
            <p class="hint">垂直方向放大或缩小印章边框 (1.0 = 默认)</p>
          </div>
        </div>

        <!-- Border & Effects -->
        <div class="control-section">
          <h4>边框与效果</h4>
          <div class="control-row">
            <label>
              <span class="label-text">不规则度: {{ noiseAmount }}</span>
              <input v-model.number="noiseAmount" type="range" min="0" max="50" class="range-input">
            </label>
          </div>
          <div class="control-row">
            <label>
              <span class="label-text">边框点数: {{ borderPoints }}</span>
              <input v-model.number="borderPoints" type="range" min="8" max="96" step="4" class="range-input">
            </label>
          </div>
          <div class="control-row">
            <label>
              <span class="label-text">圆角半径: {{ cornerRadius }}</span>
              <input v-model.number="cornerRadius" type="range" min="0" max="60" class="range-input">
            </label>
          </div>
          <div class="control-row">
            <label>
              <span class="label-text">边框宽度: {{ borderWidth }}px</span>
              <input v-model.number="borderWidth" type="range" min="0.5" max="15" step="0.5" class="range-input">
            </label>
            <p class="hint">仅阳章 (白底红字) 显示边框</p>
          </div>
        </div>

        <!-- Seed -->
        <div class="control-section">
          <h4>随机种子</h4>
          <div class="control-row">
            <label>
              <span class="label-text">Seed</span>
              <div class="seed-input-group">
                <input v-model.number="seed" type="number" class="number-input">
                <button class="icon-btn" @click="randomizeSeed" title="随机种子">
                  🎲
                </button>
              </div>
            </label>
          </div>
        </div>

        <!-- Actions -->
        <div class="control-section">
          <div class="action-buttons">
            <button class="action-btn primary" @click="downloadSVG">
              下载 SVG
            </button>
            <button class="action-btn" @click="resetDefaults">
              重置默认值
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="preview-panel">
      <div class="preview-header">
        <h3>预览</h3>
      </div>
      <div class="preview-content">
        <div class="stamp-preview" v-html="stampSvg" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.stamp-playground {
  display: flex;
  height: 100%;
  width: 100%;
  background-color: #f8f9fa;
}

.controls-panel {
  width: 380px;
  background-color: #fff;
  border-right: 1px solid #e0e0e0;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}

.panel-header {
  padding: 20px 24px;
  border-bottom: 1px solid #e0e0e0;
  background-color: #fafafa;
}

.panel-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #333;
}

.controls-content {
  flex: 1;
  padding: 20px 24px;
}

.control-section {
  margin-bottom: 28px;
}

.control-section:last-child {
  margin-bottom: 0;
}

.control-section h4 {
  margin: 0 0 12px 0;
  font-size: 14px;
  font-weight: 600;
  color: #555;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.control-row {
  margin-bottom: 12px;
}

.control-row:last-child {
  margin-bottom: 0;
}

.control-row label {
  display: block;
}

.label-text {
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: #666;
  margin-bottom: 6px;
}

.text-input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
  font-family: inherit;
  resize: vertical;
  transition: border-color 0.2s;
}

.text-input:focus {
  outline: none;
  border-color: #3498db;
}

.hint {
  margin: 6px 0 0 0;
  font-size: 12px;
  color: #999;
}

.checkbox-row {
  margin-bottom: 16px;
}

.checkbox-label {
  display: flex;
  align-items: center;
  cursor: pointer;
}

.checkbox-input {
  width: 18px;
  height: 18px;
  margin: 0;
  cursor: pointer;
  accent-color: #3498db;
}

.checkbox-text {
  margin-left: 8px;
  font-size: 13px;
  font-weight: 500;
  color: #666;
  user-select: none;
}

.select-input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 13px;
  background-color: #fff;
  cursor: pointer;
  transition: border-color 0.2s;
}

.select-input:focus {
  outline: none;
  border-color: #3498db;
}

.color-input-group {
  display: flex;
  gap: 8px;
  align-items: center;
}

.color-picker {
  width: 50px;
  height: 36px;
  border: 1px solid #ddd;
  border-radius: 6px;
  cursor: pointer;
}

.color-text {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 13px;
  font-family: monospace;
}

.range-input {
  width: 100%;
  height: 6px;
  border-radius: 3px;
  background: #e0e0e0;
  outline: none;
  cursor: pointer;
}

.range-input::-webkit-slider-thumb {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #3498db;
  cursor: pointer;
}

.range-input::-moz-range-thumb {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #3498db;
  cursor: pointer;
  border: none;
}

.seed-input-group {
  display: flex;
  gap: 8px;
}

.number-input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 13px;
  font-family: monospace;
}

.icon-btn {
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  background-color: #fff;
  cursor: pointer;
  font-size: 16px;
  transition: background-color 0.2s;
}

.icon-btn:hover {
  background-color: #f5f5f5;
}

.preset-buttons {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.preset-btn {
  padding: 10px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  background-color: #fff;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  transition: all 0.2s;
}

.preset-btn:hover {
  background-color: #f5f5f5;
  border-color: #3498db;
}

.action-buttons {
  display: flex;
  gap: 12px;
}

.action-btn {
  flex: 1;
  padding: 12px 16px;
  border: 1px solid #ddd;
  border-radius: 6px;
  background-color: #fff;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s;
}

.action-btn:hover {
  background-color: #f5f5f5;
}

.action-btn.primary {
  background-color: #3498db;
  color: white;
  border-color: #3498db;
}

.action-btn.primary:hover {
  background-color: #2980b9;
  border-color: #2980b9;
}

.preview-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.preview-header {
  padding: 20px 24px;
  border-bottom: 1px solid #e0e0e0;
  background-color: #fafafa;
}

.preview-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #333;
}

.preview-content {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px;
  overflow: auto;
}

.stamp-preview {
  background-color: #fff;
  padding: 40px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
}

.stamp-preview :deep(svg) {
  max-width: 500px;
  max-height: 500px;
  width: auto;
  height: auto;
}
</style>
