import { createRouter, createWebHistory } from 'vue-router';
import Shanshui from '../demos/Shanshui.vue';
import Font from '../demos/Font.vue';
import Flower from '../Flower.vue';
import FlowerCompare from '../FlowerCompare.vue';
import FlowerCanvasTest from '../FlowerCanvasTest.vue';

const routes = [
  {
    path: '/',
    name: 'ROOT',
    redirect: '/flower-canvas'
  },
  {
    path: '/shanshui',
    name: 'Shanshui',
    component: Shanshui
  },
  {
    path: '/font',
    name: 'Font',
    component: Font
  },
  {
    path: '/flower',
    name: 'Flower',
    component: Flower
  },
  {
    path: '/flower-compare',
    name: 'FlowerCompare',
    component: FlowerCompare
  },
  {
    path: '/flower-canvas',
    name: 'FlowerCanvas',
    component: FlowerCanvasTest
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

export default router;
