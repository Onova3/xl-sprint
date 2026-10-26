import { defineConfig } from 'vitest/config';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `vite build` : site statique (GitHub Pages, base réglable par BASE_PATH).
// `vite build --mode single` : dist/xl-sprint.html, l'application seule en fichier unique hors ligne.
export default defineConfig(({ mode }) => {
  const single = mode === 'single';
  return {
    base: single ? './' : (process.env.BASE_PATH ?? './'),
    plugins: single ? [viteSingleFile({ removeViteModuleLoader: true })] : [],
    build: single
      ? {
          outDir: 'dist/single',
          emptyOutDir: true,
          assetsInlineLimit: 100000000,
          rollupOptions: { input: 'app.html' },
        }
      : {
          outDir: 'dist/site',
          emptyOutDir: true,
          // index.html = page d'accueil, app.html = application
          rollupOptions: { input: { index: 'index.html', app: 'app.html' } },
        },
    test: { include: ['tests/**/*.test.ts'], environment: 'node' },
  };
});
