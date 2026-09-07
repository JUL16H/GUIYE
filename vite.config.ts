import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
export default defineConfig({
  plugins: [vue()],
  server: { port: 1420, strictPort: true },
  clearScreen: false,
  envPrefix: ['VITE_'],
  build: {
    target: 'es2022',
    rollupOptions: {
      output: { manualChunks: { markdown: ['markdown-it', 'katex', 'dompurify'] } },
    },
  },
})
