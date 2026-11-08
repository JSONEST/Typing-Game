import { defineConfig } from 'vite';

// base './' permite publicar en una subcarpeta (por ejemplo GitHub Pages) sin cambiar nada.
export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    sourcemap: true
  }
});
