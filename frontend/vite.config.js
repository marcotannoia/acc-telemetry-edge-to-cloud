import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  publicDir: process.env.BUILD_PUBLIC_FRONTEND === 'true' ? false : 'public',
})
