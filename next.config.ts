import type { NextConfig } from 'next'

const config: NextConfig = {
  // Docker builds a self-contained server; `npm start` uses the regular output
  output: process.env.OPENINN_STANDALONE ? 'standalone' : undefined,
  // Type checking runs separately via `npm run typecheck` (TypeScript 7 has no JS API for Next to call)
  typescript: { ignoreBuildErrors: true },
}

export default config
