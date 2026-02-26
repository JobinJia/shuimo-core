import { createRouter, createWebHistory } from 'vue-router'
import Stamp from '../demos/Stamp.vue'
import StampPlayground from '../demos/StampPlayground.vue'
import Shanshui from '../demos/Shanshui.vue'
import ShanShuiElements from '../demos/ShanShuiElements.vue'
import CloudDemo from '../demos/CloudDemo.vue'
import FlowerCanvasTest from '../FlowerCanvasTest.vue'
import FlowerSVGTest from '../demos/FlowerSVGTest.vue'
import StrokeAnimation from '../demos/StrokeAnimation.vue'
import MistyMount from '../demos/MistyMount.vue'
import InkDiffusion from '../demos/InkDiffusion.vue'
import WebGPUShanshui from '../demos/WebGPUShanshui.vue'
import WebGPUShanshuiScroll from '../demos/WebGPUShanshuiScroll.vue'
import XuanPaperDemo from '../demos/XuanPaperDemo.vue'
import PaintingGeneratorDemo from '../demos/PaintingGeneratorDemo.vue'
import FourGentlemenDemo from '../demos/FourGentlemenDemo.vue'

const routes = [
  {
    path: '/',
    name: 'ROOT',
    redirect: '/flower-canvas',
  },
  {
    path: '/shanshui',
    name: 'Shanshui',
    component: Shanshui,
  },
  {
    path: '/shanshui-elements',
    name: 'ShanShuiElements',
    component: ShanShuiElements,
  },
  {
    path: '/cloud',
    name: 'CloudDemo',
    component: CloudDemo,
  },
  {
    path: '/stamp',
    name: 'Stamp',
    component: Stamp,
  },
  {
    path: '/stamp-playground',
    name: 'StampPlayground',
    component: StampPlayground,
  },
  {
    path: '/flower-canvas',
    name: 'FlowerCanvas',
    component: FlowerCanvasTest,
  },
  {
    path: '/flower-svg',
    name: 'FlowerSVG',
    component: FlowerSVGTest,
  },
  {
    path: '/stroke-animation',
    name: 'StrokeAnimation',
    component: StrokeAnimation,
  },
  {
    path: '/misty-mount',
    name: 'MistyMount',
    component: MistyMount,
    // path: '/ink-diffusion',
    // name: 'InkDiffusion',
    // component: InkDiffusion,
  },
  {
    path: '/webgpu-shanshui',
    name: 'WebGPUShanshui',
    component: WebGPUShanshui,
  },
  {
    path: '/webgpu-scroll',
    name: 'WebGPUShanshuiScroll',
    component: WebGPUShanshuiScroll,
  },
  {
    path: '/xuan-paper',
    name: 'XuanPaper',
    component: XuanPaperDemo,
  },
  {
    path: '/painting-generator',
    name: 'PaintingGenerator',
    component: PaintingGeneratorDemo,
  },
  {
    path: '/four-gentlemen',
    name: 'FourGentlemen',
    component: FourGentlemenDemo,
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

export default router
