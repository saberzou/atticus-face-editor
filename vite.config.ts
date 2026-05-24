import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// Deployed at https://saberzou.github.io/atticus-face-editor/
export default defineConfig({
  base: '/atticus-face-editor/',
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
})
