import { defineConfig } from 'vitest/config';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `vite build` : site statique (GitHub Pages, base réglable par BASE_PATH).
// `vite build --mode single` : dist/xl-sprint.html, fichier unique hors ligne.
export default defineConfig(({ mode }) => {
  const single = mode === 'single';
  return {
    base: single ? './' : (process.env.BASE_PATH ?? './'),
    plugins: single ? [viteSingleFile({ removeViteModuleLoader: true })] : [],
    build: single
      ? { outDir: 'dist', emptyOutDir: false, rollupOptions: { input: 'xl-sprint.html' } }
      : { outDir: 'dist/site', emptyOutDir: true },
    test: { include: ['tests/**/*.test.ts'], environment: 'node' },
  };
});
