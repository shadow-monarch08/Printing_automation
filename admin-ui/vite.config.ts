import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: '../admin',
    emptyOutDir: true,
  },
  server: {
    allowedHosts: ['dirgelike-superartificially-rachelle.ngrok-free.dev']
  }
})
