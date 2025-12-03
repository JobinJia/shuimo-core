<script lang="ts" setup>
import { generateStamp } from '@shuimo/core'
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

onMounted(() => {
  // 阴章 - 红底白字 (默认自动形状)
  yinStampSvg.value = generateStamp({
    text: ['落梅听', '风雪'],
    type: 'yin',
    color: '#C8102E',
    fontFamily: 'beishida, 楷体, serif',
    fontSize: 70,
    paddingX: 0,
    paddingY: 0,
    noiseAmount: 12,
    borderPoints: 24,
    seed: 12345,
  })

  // 阳章 - 白底红字红边框 (默认自动形状)
  yangStampSvg.value = generateStamp({
    text: ['落梅', '听风雪'],
    type: 'yang',
    color: '#C8102E',
    fontFamily: 'beishida, 楷体, serif',
    fontSize: 70,
    paddingX: 13,
    paddingY: 2,
    noiseAmount: 12,
    borderPoints: 24,
    seed: 54321,
  })

  // 正方形印章 - 阴章
  squareYinStampSvg.value = generateStamp({
    text: ['月落', '乌啼'],
    type: 'yin',
    shape: 'square',
    color: '#C8102E',
    fontFamily: 'beishida, 楷体, serif',
    fontSize: 80,
    paddingX: 0,
    paddingY: 0,
    noiseAmount: 12,
    borderPoints: 24,
    seed: 11111,
  })

  // 正方形印章 - 阳章
  squareYangStampSvg.value = generateStamp({
    text: ['月落', '乌啼'],
    type: 'yang',
    shape: 'square',
    color: '#C8102E',
    fontFamily: 'beishida, 楷体, serif',
    fontSize: 70,
    paddingX: -10,
    paddingY: 0,
    noiseAmount: 1,
    borderPoints: 33,
    seed: 11112,
    regularShape: false,
  })

  // 长方形印章 - 阴章
  rectangleYinStampSvg.value = generateStamp({
    text: ['明月', '别枝', '惊鹊'],
    type: 'yin',
    shape: 'rectangle',
    color: '#C8102E',
    fontFamily: 'beishida, 楷体, serif',
    fontSize: 70,
    paddingX: 0,
    paddingY: 0,
    noiseAmount: 12,
    borderPoints: 24,
    seed: 22221,
  })

  // 长方形印章 - 阳章
  rectangleYangStampSvg.value = generateStamp({
    text: ['清风', '半夜', '鸣蝉'],
    type: 'yang',
    shape: 'rectangle',
    color: '#C8102E',
    fontFamily: 'beishida, 楷体, serif',
    fontSize: 70,
    paddingX: 0,
    paddingY: 0,
    noiseAmount: 12,
    borderPoints: 24,
    seed: 22222,
  })

  // 圆形印章 - 阴章
  circleYinStampSvg.value = generateStamp({
    text: ['兰'],
    type: 'yin',
    shape: 'circle',
    color: '#C8102E',
    fontFamily: 'beishida, 楷体, serif',
    fontSize: 70,
    paddingX: 10,
    paddingY: 5,
    noiseAmount: 12,
    borderPoints: 32,
    seed: 33333,
  })

  // 圆形印章 - 阳章
  circleYangStampSvg.value = generateStamp({
    text: ['梅'],
    type: 'yang',
    shape: 'circle',
    color: '#C8102E',
    fontFamily: 'beishida, 楷体, serif',
    fontSize: 70,
    paddingX: 10,
    paddingY: 0,
    noiseAmount: 12,
    borderPoints: 32,
    seed: 33334,
  })

  // 椭圆形印章 - 阴章
  ellipseYinStampSvg.value = generateStamp({
    text: ['水墨', '江南'],
    type: 'yin',
    shape: 'ellipse',
    color: '#C8102E',
    fontFamily: 'beishida, 楷体, serif',
    fontSize: 70,
    paddingX: 15,
    paddingY: 15,
    noiseAmount: 12,
    borderPoints: 32,
    seed: 44443,
  })

  // 椭圆形印章 - 阳章
  ellipseYangStampSvg.value = generateStamp({
    text: ['隔窗', '听雨'],
    type: 'yang',
    shape: 'ellipse',
    color: '#C8102E',
    fontFamily: 'beishida, 楷体, serif',
    fontSize: 70,
    paddingX: 5,
    paddingY: 5,
    noiseAmount: 2,
    borderPoints: 33,
    seed: 1,
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
      <h2 style="font-family: '楷体', serif; color: #333; margin-bottom: 2em;">
        印章演示 Stamp Demo
      </h2>

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
        /* 使用根路径 / 引用 public 目录下的字体，确保打包后路径正确 */
        src: url('/fonts/yishanbeizhuanti.ttf') format('truetype');
        font-weight: normal;
        font-style: normal;
        /* 建议添加 font-display: swap; 优化加载体验 */
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
