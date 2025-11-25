import { defineConfig } from 'vite';
import { resolve } from 'path';
import dts from 'vite-plugin-dts';

export default defineConfig({
  plugins: [
    dts({
      insertTypesEntry: true,
      include: ['src/**/*'],
      exclude: ['src/**/*.spec.ts', 'src/**/*.test.ts']
    })
  ],

  build: {
    lib: {
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
        foundation: resolve(__dirname, 'src/foundation/index.ts'),
        elements: resolve(__dirname, 'src/elements/index.ts'),
        renderer: resolve(__dirname, 'src/renderer/index.ts')
      },
      formats: ['es'],
      fileName: (format, entryName) => `${entryName}.js`
    },

    sourcemap: true,
    minify: 'esbuild',

    rollupOptions: {
      external: ['uuid'],
      output: {
        preserveModules: false
      }
    }
  },

  test: {
    globals: true,
    environment: 'jsdom',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.spec.ts',
        '**/*.test.ts'
      ]
    }
  }
});
