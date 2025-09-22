import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  build: {
    sourcemap: true,
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'CesiumUniversalManipulator',
      formats: ['es', 'cjs'],
      fileName: (format) => `index${format === 'es' ? '' : '.cjs'}`
    },
    rollupOptions: {
      external: ['cesium'],
      output: {
        globals: {
          cesium: 'Cesium'
        }
      }
    }
  },
  server: {
    port: 4173
  }
});
