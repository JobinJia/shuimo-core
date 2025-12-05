import { createRouter, createWebHistory } from 'vue-router'
import Stamp from '../demos/Stamp.vue'
import StampPlayground from '../demos/StampPlayground.vue'
import Shanshui from '../demos/Shanshui.vue'
import ShanShuiElements from '../demos/ShanShuiElements.vue'
import CloudDemo from '../demos/CloudDemo.vue'
import FlowerCanvasTest from '../FlowerCanvasTest.vue'
import StrokeAnimation from '../demos/StrokeAnimation.vue'

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
    path: '/stroke-animation',
    name: 'StrokeAnimation',
    component: StrokeAnimation,
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

export default router
