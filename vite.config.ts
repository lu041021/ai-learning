import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'markdown': ['react-markdown', 'remark-gfm', 'rehype-highlight'],
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
