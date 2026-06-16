import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {},
  preload: {},
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        '@shared': resolve('src/shared')
      }
    },
    optimizeDeps: {
      include: ['@pierre/diffs', '@pierre/diffs/react', '@pierre/trees', '@pierre/trees/react']
    },
    build: {
      chunkSizeWarningLimit: 800
    },
    plugins: [react()]
  }
})
