import { createRouter, createWebHistory } from 'vue-router';
import Shanshui from './Shanshui.vue';
import Font from './Font.vue';

const routes = [
  {
    path: '/',
    name: 'ROOT',
    redirect: '/shanshui'
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
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

export default router;
