import { defineConfig } from 'vite';

// base: './' — чтобы сборка открывалась и на Vercel, и на GitHub Pages (этап 9).
export default defineConfig({
  base: './',
  server: { port: 5173 },
});
