import { resolve } from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  root: resolve('src/renderer'),
  plugins: [react()],
  resolve: {
    alias: {
      '@renderer': resolve('src/renderer/src')
    }
  },
  build: {
    outDir: resolve('out/visual'),
    emptyOutDir: true,
    rollupOptions: {
      input: resolve('src/renderer/visual.html')
    }
  },
  preview: {
    port: 4173,
    strictPort: true
  }
})
