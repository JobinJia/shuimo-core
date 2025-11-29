import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    foundation: 'src/foundation/index.ts',
    elements: 'src/elements/index.ts',
    drawing: 'src/drawing/index.ts',
  },

  format: ['esm'],

  dts: {
    resolve: true,
    sourcemap: false,
  },

  clean: true,

  sourcemap: false,

  external: ['uuid'],

  outDir: 'dist',

  outExtension() {
    return {
      js: '.js',
    }
  },
})
