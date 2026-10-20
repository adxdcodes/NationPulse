import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  // Load VITE_* variables from the single .env at the repository root.
  envDir: fileURLToPath(new URL('../../', import.meta.url)),
  plugins: [react()],
})
