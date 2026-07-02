import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true,
    port: 5175,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            const packagePath = id.split('node_modules/')[1] || ''

            if (
              packagePath.startsWith('recharts/') ||
              packagePath.startsWith('d3-') ||
              packagePath.startsWith('victory-vendor/')
            ) {
              return 'charts'
            }

            if (packagePath.startsWith('lucide-react/')) {
              return 'icons'
            }

            if (
              packagePath.startsWith('axios/') ||
              packagePath.startsWith('socket.io-client/') ||
              packagePath.startsWith('engine.io-client/')
            ) {
              return 'network'
            }

            return 'vendor'
          }
        },
      },
    },
  },
})
