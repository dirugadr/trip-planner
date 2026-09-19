import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false
      },
      // Remote MCP server + OAuth (Épica 12): same-origin in prod (Vercel
      // rewrites), so mirror that in dev.
      '/oauth': { target: 'http://localhost:3000', changeOrigin: true, secure: false },
      '/mcp': { target: 'http://localhost:3000', changeOrigin: true, secure: false },
      '/.well-known': { target: 'http://localhost:3000', changeOrigin: true, secure: false }
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
