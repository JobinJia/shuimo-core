import { createRouter, createWebHistory } from "vue-router";
import Stamp from "../demos/Stamp.vue";
import StampPlayground from "../demos/StampPlayground.vue";
import Shanshui from "../demos/Shanshui.vue";
import ShanShuiElements from "../demos/ShanShuiElements.vue";
import CloudDemo from "../demos/CloudDemo.vue";
import FlowerCanvasTest from "../FlowerCanvasTest.vue";
import MistyMount from "../demos/MistyMount.vue";
import XuanPaperDemo from "../demos/XuanPaperDemo.vue";
import PaintingGeneratorDemo from "../demos/PaintingGeneratorDemo.vue";
import FourGentlemenDemo from "../demos/FourGentlemenDemo.vue";
import InkMountDemo from "../demos/InkMountDemo.vue";
import LoadingShowcase from "../demos/LoadingShowcase.vue";
import GoldfishDemo from "../demos/GoldfishDemo.vue";
import InkBleedDemo from "../demos/InkBleedDemo.vue";

const routes = [
  {
    path: "/",
    name: "ROOT",
    redirect: "/flower-canvas",
  },
  {
    path: "/shanshui",
    name: "Shanshui",
    component: Shanshui,
  },
  {
    path: "/shanshui-elements",
    name: "ShanShuiElements",
    component: ShanShuiElements,
  },
  {
    path: "/cloud",
    name: "CloudDemo",
    component: CloudDemo,
  },
  {
    path: "/stamp",
    name: "Stamp",
    component: Stamp,
  },
  {
    path: "/stamp-playground",
    name: "StampPlayground",
    component: StampPlayground,
  },
  {
    path: "/flower-canvas",
    name: "FlowerCanvas",
    component: FlowerCanvasTest,
  },
  {
    path: "/misty-mount",
    name: "MistyMount",
    component: MistyMount,
  },
  {
    path: "/xuan-paper",
    name: "XuanPaper",
    component: XuanPaperDemo,
  },
  {
    path: "/painting-generator",
    name: "PaintingGenerator",
    component: PaintingGeneratorDemo,
  },
  {
    path: "/loading-showcase",
    name: "LoadingShowcase",
    component: LoadingShowcase,
  },
  {
    path: "/goldfish",
    name: "Goldfish",
    component: GoldfishDemo,
  },
  {
    path: "/four-gentlemen",
    name: "FourGentlemen",
    component: FourGentlemenDemo,
  },
  {
    path: "/ink-mount",
    name: "InkMount",
    component: InkMountDemo,
  },
  {
    path: "/ink-bleed",
    name: "InkBleed",
    component: InkBleedDemo,
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;
