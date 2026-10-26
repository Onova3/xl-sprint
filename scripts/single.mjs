// Après `vite build --mode single` : dist/single/app.html -> dist/xl-sprint.html (fichier unique hors ligne).
import { copyFileSync, rmSync } from 'node:fs';
copyFileSync('dist/single/app.html', 'dist/xl-sprint.html');
rmSync('dist/single', { recursive: true, force: true });
console.log('dist/xl-sprint.html');
