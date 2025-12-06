import path from 'node:path'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

export default defineConfig(({ mode }) => ({
  plugins: [vue()],
  resolve: {
    alias: {
      '@shuimo/core': mode === 'production'
        ? path.resolve(__dirname, '../packages/core/dist/index.mjs')
        : path.resolve(__dirname, '../packages/core/src/index.ts'),
    },
  },
  server: {
    port: 3000,
    host: true,
  },
}))
