import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/terminal/',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    port: 5175,
    allowedHosts: ['dirgelike-superartificially-rachelle.ngrok-free.dev']
  }
})
