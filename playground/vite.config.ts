import path from "node:path";
import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite-plus";

export default defineConfig(({ mode }) => ({
  plugins: [vue()],
  resolve: {
    alias: [
      // Subpath alias must come first so it wins over the bare-specifier alias.
      // In dev we source from packages/core/wasm/ directly (the build pipeline
      // would otherwise copy this to dist/wasm/ via build:copy-wasm).
      {
        find: /^@jobinjia\/shuimo-core\/wasm\/(.*)$/,
        replacement: path.resolve(__dirname, "../packages/core/wasm/harfbuzz/$1"),
      },
      {
        find: "@jobinjia/shuimo-core/stamp-v2",
        replacement:
          mode === "production"
            ? path.resolve(__dirname, "../packages/core/dist/stamp-v2.mjs")
            : path.resolve(__dirname, "../packages/core/src/drawing/stampV2/index.ts"),
      },
      {
        find: "@jobinjia/shuimo-core",
        replacement:
          mode === "production"
            ? path.resolve(__dirname, "../packages/core/dist/index.mjs")
            : path.resolve(__dirname, "../packages/core/src/index.ts"),
      },
    ],
  },
  server: {
    port: 3000,
    host: true,
  },
}));
