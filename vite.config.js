import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
export default defineConfig({
  base: '/pokemon-tcg-tracker/',
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173
  }
})
