import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    entry: {
      index: "src/index.ts",
      foundation: "src/foundation/index.ts",
      elements: "src/elements/index.ts",
      drawing: "src/drawing/index.ts",
      "xuan-paper-worker": "src/elements/natural/xuan-paper/worker.ts",
      "xuan-paper-worker-protocol": "src/elements/natural/xuan-paper/worker-protocol.ts",
    },
    format: ["esm"],
    dts: {
      resolve: true,
      sourcemap: false,
    },
    clean: true,
    sourcemap: false,
    external: ["uuid"],
    outDir: "dist",
  },

  test: {
    globals: true,
    environment: "jsdom",
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: ["node_modules/", "dist/", "**/*.spec.ts", "**/*.test.ts", "**/types.ts"],
    },
  },
});
