import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { postbuild } from './scripts/postbuild.js'

// BASE_PATH lets the same build target a user page or custom domain (/) or a
// project page (/<repo>/).
const base = process.env.BASE_PATH ?? '/'

export default defineConfig({
  base,
  plugins: [react(), tailwindcss()],
  build: {
    assetsInlineLimit: 2048,
  },
  ssgOptions: {
    // One directory per route (/campaign/index.html) — the most portable
    // shape for static hosts, GitHub Pages included.
    dirStyle: 'nested',
    formatting: 'none',
    beastiesOptions: false,
    onFinished: (dir) => postbuild(dir, base),
  },
})
