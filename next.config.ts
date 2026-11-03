import type { NextConfig } from 'next'

const config: NextConfig = {
  // Las migraciones SQL se leen en tiempo de ejecución: incluirlas en las funciones de Vercel.
  outputFileTracingIncludes: { '/**': ['./drizzle/**/*'] },
}

export default config
