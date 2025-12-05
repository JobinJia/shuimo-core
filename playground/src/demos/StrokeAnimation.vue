<template>
  <div class="stroke-animation-demo">
    <div class="demo-header">
      <h1>笔画动画 - 实验性功能</h1>
      <p class="description">
        基于论文 "Animating Strokes in Drawing Process of Chinese Ink Painting" 实现的笔画绘制动画
      </p>
    </div>

    <div class="demo-content">
      <div class="canvas-container">
        <canvas
          ref="canvasRef"
          :width="canvasWidth"
          :height="canvasHeight"
          @mousedown="startDrawing"
          @mousemove="draw"
          @mouseup="stopDrawing"
          @mouseleave="stopDrawing"
        ></canvas>
        <div v-if="!hasStroke" class="placeholder">
          <p>在画布上绘制一个笔画</p>
          <p class="hint">按住鼠标左键拖动绘制</p>
        </div>
      </div>

      <div class="controls">
        <div class="control-section">
          <h3>绘制控制</h3>
          <button @click="clearCanvas" class="btn">清空画布</button>
          <button @click="generateAnimation" :disabled="!hasStroke || isProcessing" class="btn btn-primary">
            {{ isProcessing ? '处理中...' : '生成动画' }}
          </button>
        </div>

        <div v-if="hasAnimation" class="control-section">
          <h3>动画控制</h3>
          <div class="button-group">
            <button @click="playAnimation" :disabled="isPlaying" class="btn">播放</button>
            <button @click="pauseAnimation" :disabled="!isPlaying" class="btn">暂停</button>
            <button @click="resetAnimation" class="btn">重置</button>
          </div>

          <div class="slider-control">
            <label>动画速度: {{ animationSpeed }}</label>
            <input
              type="range"
              v-model.number="animationSpeed"
              min="10"
              max="100"
              @input="updateSpeed"
            />
          </div>

          <div class="progress-bar">
            <div class="progress-fill" :style="{ width: `${progress * 100}%` }"></div>
          </div>
          <div class="progress-text">进度: {{ Math.round(progress * 100) }}%</div>
        </div>

        <div class="control-section">
          <h3>渲染选项</h3>
          <div class="checkbox-group">
            <label>
              <input type="checkbox" v-model="showTrajectory" @change="updateRenderConfig" />
              显示轨迹辅助线
            </label>
            <label>
              <input type="checkbox" v-model="showFootprintBounds" @change="updateRenderConfig" />
              显示足迹边界
            </label>
          </div>

          <div class="slider-control">
            <label>干笔效果强度: {{ dryBrushStrength.toFixed(2) }}</label>
            <input
              type="range"
              v-model.number="dryBrushStrength"
              min="0"
              max="1"
              step="0.1"
              @input="updateRenderConfig"
            />
          </div>

          <div class="slider-control">
            <label>足迹数量: {{ numFootprints }}</label>
            <input
              type="range"
              v-model.number="numFootprints"
              min="10"
              max="100"
              step="5"
            />
          </div>

          <div class="slider-control">
            <label>笔画粗细: {{ strokeScale }}x</label>
            <input
              type="range"
              v-model.number="strokeScale"
              min="1"
              max="30"
              step="1"
              @input="updateStrokeScale"
            />
          </div>
        </div>

        <div v-if="statsInfo" class="control-section stats">
          <h3>统计信息</h3>
          <ul>
            <li>轨迹点数: {{ statsInfo.trajectoryPoints }}</li>
            <li>足迹数量: {{ statsInfo.footprints }}</li>
            <li>处理时间: {{ statsInfo.processingTime }}ms</li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { Vector2, Experimental } from '@shuimo/core'

// 使用实验性功能的类
type StrokeTrajectoryEstimator = InstanceType<typeof Experimental.StrokeTrajectoryEstimator>
type BrushFootprintGenerator = InstanceType<typeof Experimental.BrushFootprintGenerator>
type StrokeAnimator = InstanceType<typeof Experimental.StrokeAnimator>
type ContourExtractor = InstanceType<typeof Experimental.ContourExtractor>

// 类型导入
type StrokeShape = Experimental.StrokeShape
type StrokeContour = Experimental.StrokeContour

// Canvas设置
const canvasRef = ref<HTMLCanvasElement | null>(null)
const canvasWidth = 800
const canvasHeight = 600

// 绘制状态
const isDrawing = ref(false)
const currentPath = ref<Vector2[]>([])
const hasStroke = ref(false)
const drawnImageData = ref<ImageData | null>(null)

// 动画状态
const hasAnimation = ref(false)
const isPlaying = ref(false)
const isProcessing = ref(false)
const progress = ref(0)

// 控制参数
const animationSpeed = ref(30)
const showTrajectory = ref(false)
const showFootprintBounds = ref(false)
const dryBrushStrength = ref(0.5)
const numFootprints = ref(50)
const strokeScale = ref(14)

// 统计信息
const statsInfo = ref<{
  trajectoryPoints: number
  footprints: number
  processingTime: number
} | null>(null)

// 动画组件
let drawingCtx: CanvasRenderingContext2D | null = null
let trajectoryEstimator: StrokeTrajectoryEstimator | null = null
let footprintGenerator: BrushFootprintGenerator | null = null
let contourExtractor: ContourExtractor | null = null
let animator: StrokeAnimator | null = null
let animationFrameId: number | null = null

onMounted(() => {
  if (!canvasRef.value) return

  drawingCtx = canvasRef.value.getContext('2d')
  if (!drawingCtx) return

  // 初始化组件
  trajectoryEstimator = new Experimental.StrokeTrajectoryEstimator()
  footprintGenerator = new Experimental.BrushFootprintGenerator()
  contourExtractor = new Experimental.ContourExtractor()

  // 设置画布样式
  drawingCtx.lineCap = 'round'
  drawingCtx.lineJoin = 'round'
  drawingCtx.lineWidth = 15

  // 监听动画进度
  startProgressMonitoring()
})

onUnmounted(() => {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId)
  }
  if (animator) {
    animator.destroy()
  }
})

// 开始绘制
function startDrawing(e: MouseEvent) {
  if (!canvasRef.value || !drawingCtx) return

  isDrawing.value = true
  const rect = canvasRef.value.getBoundingClientRect()
  const x = e.clientX - rect.left
  const y = e.clientY - rect.top

  currentPath.value = [new Vector2(x, y)]

  drawingCtx.beginPath()
  drawingCtx.moveTo(x, y)
}

// 绘制中
function draw(e: MouseEvent) {
  if (!isDrawing.value || !canvasRef.value || !drawingCtx) return

  const rect = canvasRef.value.getBoundingClientRect()
  const x = e.clientX - rect.left
  const y = e.clientY - rect.top

  currentPath.value.push(new Vector2(x, y))

  drawingCtx.lineTo(x, y)
  drawingCtx.strokeStyle = '#000'
  drawingCtx.stroke()
}

// 停止绘制
function stopDrawing() {
  if (!isDrawing.value) return

  isDrawing.value = false

  if (currentPath.value.length > 2) {
    hasStroke.value = true
    // 保存绘制的图像数据
    if (drawingCtx && canvasRef.value) {
      drawnImageData.value = drawingCtx.getImageData(
        0,
        0,
        canvasRef.value.width,
        canvasRef.value.height
      )
    }
  }
}

// 清空画布
function clearCanvas() {
  if (!drawingCtx || !canvasRef.value) return

  drawingCtx.clearRect(0, 0, canvasRef.value.width, canvasRef.value.height)
  currentPath.value = []
  hasStroke.value = false
  hasAnimation.value = false
  drawnImageData.value = null
  statsInfo.value = null

  if (animator) {
    animator.destroy()
    animator = null
  }
}

// 生成动画
async function generateAnimation() {
  if (!trajectoryEstimator || !footprintGenerator || !canvasRef.value || !drawingCtx) return
  if (!drawnImageData.value || currentPath.value.length < 2) return

  isProcessing.value = true
  const startTime = performance.now()

  try {
    // 1. 构建笔画形状
    const strokeShape = buildStrokeShape()

    // 2. 估算轨迹
    const trajectory = trajectoryEstimator.estimateTrajectory(strokeShape)

    // 3. 生成足迹
    const footprints = footprintGenerator.generateFootprints(
      trajectory,
      strokeShape.contour,
      numFootprints.value
    )
    trajectory.footprints = footprints

    const processingTime = performance.now() - startTime

    // 4. 创建动画器
    if (animator) {
      animator.destroy()
    }
    animator = new Experimental.StrokeAnimator(canvasRef.value)
    animator.setTrajectory(trajectory)
    animator.setSpeed(animationSpeed.value)

    // 更新渲染配置
    updateRenderConfig()
    // 设置笔画粗细
    updateStrokeScale()

    // 更新统计信息
    statsInfo.value = {
      trajectoryPoints: trajectory.points.length,
      footprints: footprints.length,
      processingTime: Math.round(processingTime)
    }

    hasAnimation.value = true

    // 清空画布并准备播放动画
    drawingCtx.clearRect(0, 0, canvasRef.value.width, canvasRef.value.height)
  } catch (error) {
    console.error('生成动画失败:', error)
    alert('生成动画失败，请重试')
  } finally {
    isProcessing.value = false
  }
}

// 构建笔画形状
function buildStrokeShape(): StrokeShape {
  if (!drawnImageData.value || !contourExtractor) {
    throw new Error('No drawn image data or contour extractor')
  }

  // 使用轮廓提取器从图像中提取真实轮廓
  const contour = contourExtractor.extractContour(drawnImageData.value)

  if (!contour) {
    // 如果轮廓提取失败，回退到使用绘制路径
    console.warn('轮廓提取失败，使用绘制路径作为备选')
    return {
      imageData: drawnImageData.value,
      contour: {
        points: currentPath.value,
        startIndex: 0,
        endIndex: currentPath.value.length - 1
      }
    }
  }

  console.log(`提取到轮廓点数: ${contour.points.length}, 起点索引: ${contour.startIndex}, 终点索引: ${contour.endIndex}`)

  return {
    imageData: drawnImageData.value,
    contour
  }
}

// 播放动画
function playAnimation() {
  if (!animator) return
  animator.play()
  isPlaying.value = true
}

// 暂停动画
function pauseAnimation() {
  if (!animator) return
  animator.pause()
  isPlaying.value = false
}

// 重置动画
function resetAnimation() {
  if (!animator) return
  animator.reset()
  isPlaying.value = false
  progress.value = 0
}

// 更新速度
function updateSpeed() {
  if (!animator) return
  animator.setSpeed(animationSpeed.value)
}

// 更新渲染配置
function updateRenderConfig() {
  if (!animator) return
  animator.setRenderConfig({
    showTrajectory: showTrajectory.value,
    showFootprintBounds: showFootprintBounds.value,
    dryBrushStrength: dryBrushStrength.value
  })
}

// 更新笔画粗细
function updateStrokeScale() {
  if (!animator) return
  animator.setStrokeScale(strokeScale.value)
}

// 监听动画进度
function startProgressMonitoring() {
  const updateProgress = () => {
    if (animator && isPlaying.value) {
      const state = animator.getAnimationState()
      progress.value = state.progress
      isPlaying.value = state.isPlaying
    }
    animationFrameId = requestAnimationFrame(updateProgress)
  }
  updateProgress()
}
</script>

<style scoped>
.stroke-animation-demo {
  padding: 20px;
  max-width: 1400px;
  margin: 0 auto;
}

.demo-header {
  margin-bottom: 30px;
}

.demo-header h1 {
  font-size: 28px;
  margin-bottom: 10px;
  color: #333;
}

.description {
  color: #666;
  font-size: 14px;
}

.demo-content {
  display: flex;
  gap: 30px;
}

.canvas-container {
  position: relative;
  flex-shrink: 0;
}

canvas {
  border: 2px solid #ddd;
  border-radius: 8px;
  cursor: crosshair;
  background: white;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.placeholder {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
  color: #999;
  pointer-events: none;
}

.placeholder p {
  margin: 5px 0;
}

.hint {
  font-size: 12px;
  color: #bbb;
}

.controls {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.control-section {
  background: white;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.control-section h3 {
  margin: 0 0 15px 0;
  font-size: 16px;
  color: #333;
}

.btn {
  padding: 8px 16px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: white;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
  margin-right: 10px;
}

.btn:hover:not(:disabled) {
  background: #f5f5f5;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background: #1890ff;
  color: white;
  border-color: #1890ff;
}

.btn-primary:hover:not(:disabled) {
  background: #40a9ff;
}

.button-group {
  display: flex;
  gap: 10px;
  margin-bottom: 15px;
}

.slider-control {
  margin-bottom: 15px;
}

.slider-control label {
  display: block;
  margin-bottom: 8px;
  font-size: 14px;
  color: #666;
}

.slider-control input[type='range'] {
  width: 100%;
}

.checkbox-group {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.checkbox-group label {
  display: flex;
  align-items: center;
  font-size: 14px;
  color: #666;
  cursor: pointer;
}

.checkbox-group input[type='checkbox'] {
  margin-right: 8px;
}

.progress-bar {
  width: 100%;
  height: 8px;
  background: #f0f0f0;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 8px;
}

.progress-fill {
  height: 100%;
  background: #1890ff;
  transition: width 0.1s linear;
}

.progress-text {
  font-size: 12px;
  color: #666;
  text-align: right;
}

.stats {
  background: #f9f9f9;
}

.stats ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.stats li {
  padding: 5px 0;
  font-size: 14px;
  color: #666;
}
</style>
