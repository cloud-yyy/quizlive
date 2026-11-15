import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// In development the API is reached through the same-origin "/api" prefix
// (the production nginx container does the same), so cookies just work.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:4000', changeOrigin: true, rewrite: (p) => p.replace(/^\/api/, '') },
      '/socket.io': { target: 'http://localhost:4000', ws: true },
    },
  },
})
