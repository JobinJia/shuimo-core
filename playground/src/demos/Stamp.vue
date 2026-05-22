<script lang="ts" setup>
import { generateStampAsync, type StampOptions } from "@jobinjia/shuimo-core";
import { onMounted, ref } from "vue";

const SEAL_FONT_URL = "/fonts/yishanbeizhuanti.ttf";

const yinStampSvg = ref("");
const yangStampSvg = ref("");

const squareYinStampSvg = ref("");
const squareYangStampSvg = ref("");

const rectangleYinStampSvg = ref("");
const rectangleYangStampSvg = ref("");

const circleYinStampSvg = ref("");
const circleYangStampSvg = ref("");

const ellipseYinStampSvg = ref("");
const ellipseYangStampSvg = ref("");

async function waitForFont(fontFamily: string, fontSize: number) {
  if (typeof document === "undefined" || !document.fonts) return;

  const fontSpec = `${fontSize}px ${fontFamily}`;

  for (let attempt = 0; attempt < 20; attempt++) {
    if (document.fonts.check(fontSpec)) return;

    try {
      await document.fonts.load(fontSpec);
    } catch {
      // 忽略单次加载失败，继续轮询等待字体注册完成。
    }

    if (document.fonts.check(fontSpec)) return;

    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

onMounted(async () => {
  // 显式等待目标字体可用，否则刷新时会先用回退字体测量，导致边框和居中全部漂移。
  await document.fonts.ready;
  await waitForFont("峄山碑篆体", 70);

  // 阴章 - 红底白字 (默认自动形状)
  const yinOptions = {
    text: ["落梅听", "风雪"],
    type: "yin" as const,
    color: "#C8102E",
    fontFamily: "峄山碑篆体",
    fontSize: 70,
    columnSpacingPx: 0.3,
    characterSpacingPx: 3.2,
    paddingXPx: 1.5,
    paddingYPx: 2.5,
    borderScaleX: 1.0,
    borderScaleY: 1.015,
    offsetX: 0,
    offsetY: 0,
    noiseAmountPx: 11,
    cornerRadiusPx: 5,
    borderPointsPx: 28,
    seed: 12345,
  };
  yinStampSvg.value = await generateStampAsync({ ...yinOptions, fontUrl: SEAL_FONT_URL });

  // 阳章 - 白底红字红边框 (默认自动形状)
  const yangOptions = {
    text: ["落梅", "听风雪"],
    type: "yang" as const,
    color: "#C8102E",
    fontFamily: "峄山碑篆体",
    fontSize: 70,
    columnSpacingPx: 0.3,
    characterSpacingPx: 3.2,
    paddingXPx: 1.5,
    paddingYPx: 2.5,
    borderScaleX: 1.0,
    borderScaleY: 1.015,
    borderWidthPx: 4,
    offsetX: 0,
    offsetY: 0,
    noiseAmountPx: 11,
    borderPointsPx: 28,
    seed: 54321,
  };
  yangStampSvg.value = await generateStampAsync({ ...yangOptions, fontUrl: SEAL_FONT_URL });

  // 正方形印章 - 阴章
  const squareYinOptions = {
    text: ["月落", "乌啼"],
    type: "yin" as const,
    shape: "square" as const,
    color: "#C8102E",
    fontFamily: "峄山碑篆体",
    fontSize: 70,
    columnSpacingPx: 0.3,
    characterSpacingPx: 3.2,
    paddingXPx: 1.5,
    paddingYPx: 1.5,
    borderScale: 1.0,
    offsetX: 0,
    offsetY: 0,
    noiseAmountPx: 8,
    cornerRadiusPx: 5,
    borderPointsPx: 24,
    seed: 11111,
  };
  squareYinStampSvg.value = await generateStampAsync({
    ...squareYinOptions,
    fontUrl: SEAL_FONT_URL,
  });

  // 正方形印章 - 阳章
  const squareYangOptions = {
    text: ["月落", "乌啼"],
    type: "yang" as const,
    shape: "square" as const,
    color: "#C8102E",
    fontFamily: "峄山碑篆体",
    fontSize: 70,
    columnSpacingPx: 0.3,
    characterSpacingPx: 3.2,
    paddingXPx: 1.5,
    paddingYPx: 1.5,
    borderScale: 1.0,
    borderWidthPx: 4,
    offsetX: 0,
    offsetY: 0,
    noiseAmountPx: 8,
    borderPointsPx: 24,
    seed: 11112,
  };
  squareYangStampSvg.value = await generateStampAsync({
    ...squareYangOptions,
    fontUrl: SEAL_FONT_URL,
  });

  // 长方形印章 - 阴章
  const rectangleYinOptions = {
    text: ["明月", "别枝", "惊鹊"],
    type: "yin" as const,
    shape: "rectangle" as const,
    color: "#C8102E",
    fontFamily: "峄山碑篆体",
    fontSize: 70,
    columnSpacingPx: 0.35,
    characterSpacingPx: 3.2,
    paddingXPx: 1.5,
    paddingYPx: 1.5,
    borderScale: 1.0,
    offsetX: 0,
    offsetY: 0,
    noiseAmountPx: 10,
    cornerRadiusPx: 5,
    borderPointsPx: 24,
    seed: 22221,
  };
  rectangleYinStampSvg.value = await generateStampAsync({
    ...rectangleYinOptions,
    fontUrl: SEAL_FONT_URL,
  });

  // 长方形印章 - 阳章
  const rectangleYangOptions = {
    text: ["清风", "半夜", "鸣蝉"],
    type: "yang" as const,
    shape: "rectangle" as const,
    color: "#C8102E",
    fontFamily: "峄山碑篆体",
    fontSize: 70,
    columnSpacingPx: 0.35,
    characterSpacingPx: 3.2,
    paddingXPx: 1.5,
    paddingYPx: 1.5,
    borderScale: 1.0,
    borderWidthPx: 4,
    offsetX: 0,
    offsetY: 0,
    noiseAmountPx: 10,
    borderPointsPx: 24,
    seed: 22222,
  };
  rectangleYangStampSvg.value = await generateStampAsync({
    ...rectangleYangOptions,
    fontUrl: SEAL_FONT_URL,
  });

  // 圆形印章 - 阴章
  const circleYinOptions = {
    text: ["兰"],
    type: "yin" as const,
    shape: "circle" as const,
    color: "#C8102E",
    fontFamily: "峄山碑篆体",
    fontSize: 70,
    paddingXPx: 4.5,
    paddingYPx: 4.5,
    borderScaleX: 1.0,
    borderScaleY: 1.0,
    offsetX: 0,
    offsetY: 0,
    noiseAmountPx: 10,
    borderPointsPx: 32,
    seed: 33333,
  };
  circleYinStampSvg.value = await generateStampAsync({
    ...circleYinOptions,
    fontUrl: SEAL_FONT_URL,
  });

  // 圆形印章 - 阳章
  const circleYangOptions = {
    text: ["梅"],
    type: "yang" as const,
    shape: "circle" as const,
    color: "#C8102E",
    fontFamily: "峄山碑篆体",
    fontSize: 70,
    paddingXPx: 4.5,
    paddingYPx: 4.5,
    borderScaleX: 1.0,
    borderScaleY: 1.0,
    borderWidthPx: 4,
    offsetX: 0,
    offsetY: 0,
    noiseAmountPx: 10,
    borderPointsPx: 32,
    seed: 33334,
  };
  circleYangStampSvg.value = await generateStampAsync({
    ...circleYangOptions,
    fontUrl: SEAL_FONT_URL,
  });

  // 椭圆形印章 - 阴章
  const ellipseYinOptions = {
    text: ["水墨", "江南"],
    type: "yin" as const,
    shape: "ellipse" as const,
    color: "#C8102E",
    fontFamily: "峄山碑篆体",
    fontSize: 70,
    columnSpacingPx: 0.35,
    characterSpacingPx: 3.2,
    paddingXPx: 2,
    paddingYPx: 3,
    borderScaleX: 1.0,
    borderScaleY: 1.02,
    offsetX: 0,
    offsetY: 0,
    noiseAmountPx: 10,
    borderPointsPx: 32,
    seed: 44443,
  };
  ellipseYinStampSvg.value = await generateStampAsync({
    ...ellipseYinOptions,
    fontUrl: SEAL_FONT_URL,
  });

  // 椭圆形印章 - 阳章
  const ellipseYangOptions = {
    text: ["隔窗", "听雨"],
    type: "yang" as const,
    shape: "ellipse" as const,
    color: "#C8102E",
    fontFamily: "峄山碑篆体",
    fontSize: 70,
    columnSpacingPx: 0.35,
    characterSpacingPx: 3.2,
    paddingXPx: 2,
    paddingYPx: 3,
    borderScaleX: 1.0,
    borderScaleY: 1.02,
    borderWidthPx: 4,
    offsetX: 0,
    offsetY: 0,
    noiseAmountPx: 10,
    borderPointsPx: 32,
    seed: 1,
  };
  ellipseYangStampSvg.value = await generateStampAsync({
    ...ellipseYangOptions,
    fontUrl: SEAL_FONT_URL,
  });
});
</script>

<template>
  <div style="padding: 5em">
    <!-- 印章演示区域 -->
    <div style="margin-top: 3em">
      <h2 style="font-family: &quot;楷体&quot;, serif; color: #333; margin-bottom: 1em">
        印章演示 Stamp Demo
      </h2>
      <p style="color: #666; margin-bottom: 2em; max-width: 800px; font-size: 0.95em">
        所有印章均使用
        <code style="background: #f0f0f0; padding: 2px 6px; border-radius: 3px"
          >measureStampText()</code
        >
        测量实际渲染的文字尺寸，确保文字在印章内准确居中，不受字体渲染差异影响。
        当前示例也同步校正了各形状的留白参数，避免出现边框过松或字距失真的视觉误差。
      </p>

      <!-- 所有印章展示 -->
      <div
        style="
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 1.5em;
        "
      >
        <!-- 自动形状 - 阴章 -->
        <div style="text-align: center">
          <div class="stamp-container" v-html="yinStampSvg" />
          <p style="margin-top: 0.8em; color: #888; font-size: 0.85em">自动 - 阴章</p>
          <p style="margin-top: 0.3em; color: #aaa; font-size: 0.75em">shape: 'auto'</p>
        </div>

        <!-- 自动形状 - 阳章 -->
        <div style="text-align: center">
          <div class="stamp-container" v-html="yangStampSvg" />
          <p style="margin-top: 0.8em; color: #888; font-size: 0.85em">自动 - 阳章</p>
          <p style="margin-top: 0.3em; color: #aaa; font-size: 0.75em">shape: 'auto'</p>
        </div>

        <!-- 正方形 - 阴章 -->
        <div style="text-align: center">
          <div class="stamp-container" v-html="squareYinStampSvg" />
          <p style="margin-top: 0.8em; color: #888; font-size: 0.85em">正方形 - 阴章</p>
          <p style="margin-top: 0.3em; color: #aaa; font-size: 0.75em">shape: 'square'</p>
        </div>

        <!-- 正方形 - 阳章 -->
        <div style="text-align: center">
          <div class="stamp-container" v-html="squareYangStampSvg" />
          <p style="margin-top: 0.8em; color: #888; font-size: 0.85em">正方形 - 阳章</p>
          <p style="margin-top: 0.3em; color: #aaa; font-size: 0.75em">shape: 'square'</p>
        </div>

        <!-- 长方形 - 阴章 -->
        <div style="text-align: center">
          <div class="stamp-container" v-html="rectangleYinStampSvg" />
          <p style="margin-top: 0.8em; color: #888; font-size: 0.85em">长方形 - 阴章</p>
          <p style="margin-top: 0.3em; color: #aaa; font-size: 0.75em">shape: 'rectangle'</p>
        </div>

        <!-- 长方形 - 阳章 -->
        <div style="text-align: center">
          <div class="stamp-container" v-html="rectangleYangStampSvg" />
          <p style="margin-top: 0.8em; color: #888; font-size: 0.85em">长方形 - 阳章</p>
          <p style="margin-top: 0.3em; color: #aaa; font-size: 0.75em">shape: 'rectangle'</p>
        </div>

        <!-- 圆形 - 阴章 -->
        <div style="text-align: center">
          <div class="stamp-container" v-html="circleYinStampSvg" />
          <p style="margin-top: 0.8em; color: #888; font-size: 0.85em">圆形 - 阴章</p>
          <p style="margin-top: 0.3em; color: #aaa; font-size: 0.75em">shape: 'circle'</p>
        </div>

        <!-- 圆形 - 阳章 -->
        <div style="text-align: center">
          <div class="stamp-container" v-html="circleYangStampSvg" />
          <p style="margin-top: 0.8em; color: #888; font-size: 0.85em">圆形 - 阳章</p>
          <p style="margin-top: 0.3em; color: #aaa; font-size: 0.75em">shape: 'circle'</p>
        </div>

        <!-- 椭圆形 - 阴章 -->
        <div style="text-align: center">
          <div class="stamp-container" v-html="ellipseYinStampSvg" />
          <p style="margin-top: 0.8em; color: #888; font-size: 0.85em">椭圆形 - 阴章</p>
          <p style="margin-top: 0.3em; color: #aaa; font-size: 0.75em">shape: 'ellipse'</p>
        </div>

        <!-- 椭圆形 - 阳章 -->
        <div style="text-align: center">
          <div class="stamp-container" v-html="ellipseYangStampSvg" />
          <p style="margin-top: 0.8em; color: #888; font-size: 0.85em">椭圆形 - 阳章</p>
          <p style="margin-top: 0.3em; color: #aaa; font-size: 0.75em">shape: 'ellipse'</p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="css">
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
</style>
