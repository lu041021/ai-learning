import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

const isMock = process.env.VITE_MOCK === 'true'

export default defineConfig({
  plugins: [react()],
  resolve: isMock ? {
    alias: {
      '@tauri-apps/api/core': path.resolve(__dirname, 'src/api/mock-invoke.ts'),
      '@tauri-apps/api/event': path.resolve(__dirname, 'src/api/mock-invoke.ts'),
    },
  } : {},
  build: {
    cssMinify: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom') || id.includes('node_modules/react-router')) {
            return 'react-vendor'
          }
          if (id.includes('node_modules/highlight.js')) {
            return 'highlight'
          }
          if (id.includes('node_modules/react-markdown') || id.includes('node_modules/remark-gfm') || id.includes('node_modules/rehype-highlight')) {
            return 'markdown'
          }
        },
      },
    },
  },
  server: {
    watch: {
      ignored: ['**/src-tauri/target/**', '**/node_modules/**', '**/.git/**'],
    },
  },
})
