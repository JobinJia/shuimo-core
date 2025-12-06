<script lang="ts" setup>
import { generateStamp, measureStampText } from '@shuimo/core'
import { onMounted, ref } from 'vue'

const yinStampSvg = ref('')
const yangStampSvg = ref('')

const squareYinStampSvg = ref('')
const squareYangStampSvg = ref('')

const rectangleYinStampSvg = ref('')
const rectangleYangStampSvg = ref('')

const circleYinStampSvg = ref('')
const circleYangStampSvg = ref('')

const ellipseYinStampSvg = ref('')
const ellipseYangStampSvg = ref('')

onMounted(async () => {
  // 等待所有字体加载完成，确保测量准确
  await document.fonts.ready

  // 阴章 - 红底白字 (默认自动形状)
  const yinOptions = {
    text: ['落梅听', '风雪'],
    type: 'yin' as const,
    color: '#C8102E',
    fontFamily: 'Heiti SC, sans-serif',
    fontSize: 70,
    columnSpacingPx: 1.4,
    characterSpacingPx: 3.5,
    paddingXPx: 10,
    paddingYPx: 10,
    borderScale: 1.0,
    offsetX: 0,
    offsetY: 0,
    noiseAmount: 10,
    borderPoints: 24,
    seed: 12345,
  }
  const yinMeasure = measureStampText(yinOptions)
  yinStampSvg.value = generateStamp({
    ...yinOptions,
    measuredColumnWidths: yinMeasure?.columnWidths,
    measuredColumnHeights: yinMeasure?.columnHeights,
    measuredColumnHeights: yinMeasure?.columnHeights,
  })

  // 阳章 - 白底红字红边框 (默认自动形状)
  const yangOptions = {
    text: ['落梅', '听风雪'],
    type: 'yang' as const,
    color: '#C8102E',
    fontFamily: 'Heiti SC, sans-serif',
    fontSize: 70,
    columnSpacingPx: 1.4,
    characterSpacingPx: 3.5,
    paddingXPx: 10,
    paddingYPx: 10,
    borderScale: 1.0,
    borderWidth: 4,
    offsetX: 0,
    offsetY: 0,
    noiseAmount: 10,
    borderPoints: 24,
    seed: 54321,
  }
  const yangMeasure = measureStampText(yangOptions)
  yangStampSvg.value = generateStamp({
    ...yangOptions,
    measuredColumnWidths: yangMeasure?.columnWidths,
    measuredColumnHeights: yangMeasure?.columnHeights,
    measuredColumnHeights: yangMeasure?.columnHeights,
  })

  // 正方形印章 - 阴章
  const squareYinOptions = {
    text: ['月落', '乌啼'],
    type: 'yin' as const,
    shape: 'square' as const,
    color: '#C8102E',
    fontFamily: 'Heiti SC, sans-serif',
    fontSize: 70,
    columnSpacingPx: 1.4,
    characterSpacingPx: 3.5,
    paddingXPx: 10,
    paddingYPx: 10,
    borderScale: 1.0,
    offsetX: 0,
    offsetY: 0,
    noiseAmount: 8,
    borderPoints: 24,
    seed: 11111,
  }
  const squareYinMeasure = measureStampText(squareYinOptions)
  squareYinStampSvg.value = generateStamp({
    ...squareYinOptions,
    measuredColumnWidths: squareYinMeasure?.columnWidths,
    measuredColumnHeights: squareYinMeasure?.columnHeights,
    measuredColumnHeights: squareYinMeasure?.columnHeights,
  })

  // 正方形印章 - 阳章
  const squareYangOptions = {
    text: ['月落', '乌啼'],
    type: 'yang' as const,
    shape: 'square' as const,
    color: '#C8102E',
    fontFamily: 'Heiti SC, sans-serif',
    fontSize: 70,
    columnSpacingPx: 1.4,
    characterSpacingPx: 3.5,
    paddingXPx: 10,
    paddingYPx: 10,
    borderScale: 1.0,
    borderWidth: 4,
    offsetX: 0,
    offsetY: 0,
    noiseAmount: 8,
    borderPoints: 24,
    seed: 11112,
  }
  const squareYangMeasure = measureStampText(squareYangOptions)
  squareYangStampSvg.value = generateStamp({
    ...squareYangOptions,
    measuredColumnWidths: squareYangMeasure?.columnWidths,
    measuredColumnHeights: squareYangMeasure?.columnHeights,
  })

  // 长方形印章 - 阴章
  const rectangleYinOptions = {
    text: ['明月', '别枝', '惊鹊'],
    type: 'yin' as const,
    shape: 'rectangle' as const,
    color: '#C8102E',
    fontFamily: 'Heiti SC, sans-serif',
    fontSize: 70,
    columnSpacingPx: 1.4,
    characterSpacingPx: 3.5,
    paddingXPx: 10,
    paddingYPx: 10,
    borderScale: 1.0,
    offsetX: 0,
    offsetY: 0,
    noiseAmount: 10,
    borderPoints: 24,
    seed: 22221,
  }
  const rectangleYinMeasure = measureStampText(rectangleYinOptions)
  rectangleYinStampSvg.value = generateStamp({
    ...rectangleYinOptions,
    measuredColumnWidths: rectangleYinMeasure?.columnWidths,
    measuredColumnHeights: rectangleYinMeasure?.columnHeights,
  })

  // 长方形印章 - 阳章
  const rectangleYangOptions = {
    text: ['清风', '半夜', '鸣蝉'],
    type: 'yang' as const,
    shape: 'rectangle' as const,
    color: '#C8102E',
    fontFamily: 'Heiti SC, sans-serif',
    fontSize: 70,
    columnSpacingPx: 1.4,
    characterSpacingPx: 3.5,
    paddingXPx: 10,
    paddingYPx: 10,
    borderScale: 1.0,
    borderWidth: 4,
    offsetX: 0,
    offsetY: 0,
    noiseAmount: 10,
    borderPoints: 24,
    seed: 22222,
  }
  const rectangleYangMeasure = measureStampText(rectangleYangOptions)
  rectangleYangStampSvg.value = generateStamp({
    ...rectangleYangOptions,
    measuredColumnWidths: rectangleYangMeasure?.columnWidths,
    measuredColumnHeights: rectangleYangMeasure?.columnHeights,
  })

  // 圆形印章 - 阴章
  const circleYinOptions = {
    text: ['兰'],
    type: 'yin' as const,
    shape: 'circle' as const,
    color: '#C8102E',
    fontFamily: 'Heiti SC, sans-serif',
    fontSize: 70,
    paddingXPx: 15,
    paddingYPx: 15,
    borderScale: 1.0,
    offsetX: 0,
    offsetY: 0,
    noiseAmount: 10,
    borderPoints: 32,
    seed: 33333,
  }
  const circleYinMeasure = measureStampText(circleYinOptions)
  circleYinStampSvg.value = generateStamp({
    ...circleYinOptions,
    measuredColumnWidths: circleYinMeasure?.columnWidths,
    measuredColumnHeights: circleYinMeasure?.columnHeights,
  })

  // 圆形印章 - 阳章
  const circleYangOptions = {
    text: ['梅'],
    type: 'yang' as const,
    shape: 'circle' as const,
    color: '#C8102E',
    fontFamily: 'Heiti SC, sans-serif',
    fontSize: 70,
    paddingXPx: 15,
    paddingYPx: 15,
    borderScale: 1.0,
    borderWidth: 4,
    offsetX: 0,
    offsetY: 0,
    noiseAmount: 10,
    borderPoints: 32,
    seed: 33334,
  }
  const circleYangMeasure = measureStampText(circleYangOptions)
  circleYangStampSvg.value = generateStamp({
    ...circleYangOptions,
    measuredColumnWidths: circleYangMeasure?.columnWidths,
    measuredColumnHeights: circleYangMeasure?.columnHeights,
  })

  // 椭圆形印章 - 阴章
  const ellipseYinOptions = {
    text: ['水墨', '江南'],
    type: 'yin' as const,
    shape: 'ellipse' as const,
    color: '#C8102E',
    fontFamily: 'Heiti SC, sans-serif',
    fontSize: 70,
    columnSpacingPx: 1.4,
    characterSpacingPx: 3.5,
    paddingXPx: 10,
    paddingYPx: 10,
    borderScale: 1.0,
    offsetX: 0,
    offsetY: 0,
    noiseAmount: 10,
    borderPoints: 32,
    seed: 44443,
  }
  const ellipseYinMeasure = measureStampText(ellipseYinOptions)
  ellipseYinStampSvg.value = generateStamp({
    ...ellipseYinOptions,
    measuredColumnWidths: ellipseYinMeasure?.columnWidths,
    measuredColumnHeights: ellipseYinMeasure?.columnHeights,
  })

  // 椭圆形印章 - 阳章
  const ellipseYangOptions = {
    text: ['隔窗', '听雨'],
    type: 'yang' as const,
    shape: 'ellipse' as const,
    color: '#C8102E',
    fontFamily: 'Heiti SC, sans-serif',
    fontSize: 70,
    columnSpacingPx: 1.4,
    characterSpacingPx: 3.5,
    paddingXPx: 10,
    paddingYPx: 10,
    borderScale: 1.0,
    borderWidth: 4,
    offsetX: 0,
    offsetY: 0,
    noiseAmount: 10,
    borderPoints: 32,
    seed: 1,
  }
  const ellipseYangMeasure = measureStampText(ellipseYangOptions)
  ellipseYangStampSvg.value = generateStamp({
    ...ellipseYangOptions,
    measuredColumnWidths: ellipseYangMeasure?.columnWidths,
    measuredColumnHeights: ellipseYangMeasure?.columnHeights,
  })
})
</script>

<template>
  <div style="padding: 5em;">
    <!-- <svg width="400" height="300" viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="ink-bleed">
          <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="3" result="noise" />

          <feDisplacementMap in="SourceGraphic" in2="noise" scale="25" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>

      <rect x="100" y="50" width="200" height="200" fill="#333" fill-opacity="0.8" filter="url(#ink-bleed)" />
    </svg>

    <svg width="450" height="450" viewBox="0 0 450 450" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="perlin-ink-bleed">
          <feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="4" seed="1337" result="perlinNoise" />

          <feDisplacementMap
            in="SourceGraphic"
            in2="perlinNoise"
            scale="25"
            xChannelSelector="R"
            yChannelSelector="G"
            result="displaced"
          />

          <feGaussianBlur in="displaced" stdDeviation="1.8" result="blurredInk" />

          <feColorMatrix
            in="blurredInk"
            type="matrix"
            values="1 0 0 0 0
                0 1 0 0 0
                0 0 1 0 0
                0 0 0 1.5 -0.5"
            result="finalInk"
          />
        </filter>
      </defs>

      <circle cx="225" cy="225" r="120" fill="#1A1A1A" fill-opacity="0.9" filter="url(#perlin-ink-bleed)" />
    </svg> -->

    <!-- 印章演示区域 -->
    <div style="margin-top: 3em;">
      <h2 style="font-family: '楷体', serif; color: #333; margin-bottom: 1em;">
        印章演示 Stamp Demo
      </h2>
      <p style="color: #666; margin-bottom: 2em; max-width: 800px; font-size: 0.95em;">
        所有印章均使用 <code style="background: #f0f0f0; padding: 2px 6px; border-radius: 3px;">measureStampText()</code>
        测量实际渲染的文字尺寸，确保文字在印章内准确居中，不受字体渲染差异影响。
      </p>

      <!-- 所有印章展示 -->
      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 1.5em;">
        <!-- 自动形状 - 阴章 -->
        <div style="text-align: center;">
          <div class="stamp-container" v-html="yinStampSvg" />
          <p style="margin-top: 0.8em; color: #888; font-size: 0.85em;">
            自动 - 阴章
          </p>
          <p style="margin-top: 0.3em; color: #aaa; font-size: 0.75em;">
            shape: 'auto'
          </p>
        </div>

        <!-- 自动形状 - 阳章 -->
        <div style="text-align: center;">
          <div class="stamp-container" v-html="yangStampSvg" />
          <p style="margin-top: 0.8em; color: #888; font-size: 0.85em;">
            自动 - 阳章
          </p>
          <p style="margin-top: 0.3em; color: #aaa; font-size: 0.75em;">
            shape: 'auto'
          </p>
        </div>

        <!-- 正方形 - 阴章 -->
        <div style="text-align: center;">
          <div class="stamp-container" v-html="squareYinStampSvg" />
          <p style="margin-top: 0.8em; color: #888; font-size: 0.85em;">
            正方形 - 阴章
          </p>
          <p style="margin-top: 0.3em; color: #aaa; font-size: 0.75em;">
            shape: 'square'
          </p>
        </div>

        <!-- 正方形 - 阳章 -->
        <div style="text-align: center;">
          <div class="stamp-container" v-html="squareYangStampSvg" />
          <p style="margin-top: 0.8em; color: #888; font-size: 0.85em;">
            正方形 - 阳章
          </p>
          <p style="margin-top: 0.3em; color: #aaa; font-size: 0.75em;">
            shape: 'square'
          </p>
        </div>

        <!-- 长方形 - 阴章 -->
        <div style="text-align: center;">
          <div class="stamp-container" v-html="rectangleYinStampSvg" />
          <p style="margin-top: 0.8em; color: #888; font-size: 0.85em;">
            长方形 - 阴章
          </p>
          <p style="margin-top: 0.3em; color: #aaa; font-size: 0.75em;">
            shape: 'rectangle'
          </p>
        </div>

        <!-- 长方形 - 阳章 -->
        <div style="text-align: center;">
          <div class="stamp-container" v-html="rectangleYangStampSvg" />
          <p style="margin-top: 0.8em; color: #888; font-size: 0.85em;">
            长方形 - 阳章
          </p>
          <p style="margin-top: 0.3em; color: #aaa; font-size: 0.75em;">
            shape: 'rectangle'
          </p>
        </div>

        <!-- 圆形 - 阴章 -->
        <div style="text-align: center;">
          <div class="stamp-container" v-html="circleYinStampSvg" />
          <p style="margin-top: 0.8em; color: #888; font-size: 0.85em;">
            圆形 - 阴章
          </p>
          <p style="margin-top: 0.3em; color: #aaa; font-size: 0.75em;">
            shape: 'circle'
          </p>
        </div>

        <!-- 圆形 - 阳章 -->
        <div style="text-align: center;">
          <div class="stamp-container" v-html="circleYangStampSvg" />
          <p style="margin-top: 0.8em; color: #888; font-size: 0.85em;">
            圆形 - 阳章
          </p>
          <p style="margin-top: 0.3em; color: #aaa; font-size: 0.75em;">
            shape: 'circle'
          </p>
        </div>

        <!-- 椭圆形 - 阴章 -->
        <div style="text-align: center;">
          <div class="stamp-container" v-html="ellipseYinStampSvg" />
          <p style="margin-top: 0.8em; color: #888; font-size: 0.85em;">
            椭圆形 - 阴章
          </p>
          <p style="margin-top: 0.3em; color: #aaa; font-size: 0.75em;">
            shape: 'ellipse'
          </p>
        </div>

        <!-- 椭圆形 - 阳章 -->
        <div style="text-align: center;">
          <div class="stamp-container" v-html="ellipseYangStampSvg" />
          <p style="margin-top: 0.8em; color: #888; font-size: 0.85em;">
            椭圆形 - 阳章
          </p>
          <p style="margin-top: 0.3em; color: #aaa; font-size: 0.75em;">
            shape: 'ellipse'
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="css">
 @font-face {
        font-family: 'beishida';
        src: url('@/assets/fonts/jinlong.ttf') format('truetype');
        font-weight: normal;
        font-style: normal;
        font-display: swap;
      }

      .stamp-container {
        background: #f5f5f5;
        padding: 1.5em;
        border-radius: 8px;
        min-height: 200px;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
      }

      .stamp-container :deep(svg) {
        max-width: 100%;
        max-height: 180px;
        height: auto;
        width: auto;
      }
         /* 适用于每个独立的列 */
          .vertical-col {
            writing-mode: vertical-rl;
            text-orientation: upright;
            line-height: 1.1; /* 调整字间距 */
            letter-spacing: 0.15em; /* 调整行间距 */
            font-family: 'beishida', '楷体', serif;
            font-size: 70px; /* 每个字的大小 */
            fill: #1a1a1a;
            filter: url(#perlin-ink-character-col);
          }

          /* 印章文字样式 */
          .vertical-col-stamp {
            writing-mode: vertical-rl;
            text-orientation: upright;
            line-height: 1.1;
            letter-spacing: 0.15em;
            font-family: 'beishida', '楷体', serif;
            font-size: 70px;
            fill: #ffffff; /* 白色文字 */
            filter: url(#perlin-ink-subtle-flaw);
          }
</style>
