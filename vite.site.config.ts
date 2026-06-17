import { resolve } from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  root: 'site',
  base: './',
  build: {
    outDir: resolve('dist/site'),
    emptyOutDir: true
  },
  server: {
    port: 5174
  },
  preview: {
    port: 4174
  },
  plugins: [react(), tailwindcss()]
})
