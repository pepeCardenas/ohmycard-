import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base relativa: funciona tanto en GitHub Pages (/ohmycard-/) como en la raíz de cualquier dominio
export default defineConfig({
  base: './',
  plugins: [react()],
})
