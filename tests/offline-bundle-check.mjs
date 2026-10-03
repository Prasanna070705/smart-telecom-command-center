// Offline stand-in for 'vite build', used only because npm was unreachable: bundles src/ with esbuild against React 19.2.5.
// Tailwind is not installed offline, so the CSS import is stubbed and the page renders unstyled here.
import { build } from 'esbuild';
import { writeFileSync, mkdirSync } from 'node:fs';
mkdirSync('ui/dist/assets', { recursive: true });
const r = await build({ entryPoints: ['ui/src/main.jsx'], bundle: true, outfile: 'ui/dist/assets/app.js', format: 'esm', jsx: 'automatic',
  loader: { '.css': 'empty' }, define: { 'process.env.NODE_ENV': '"production"' },
  minify: true, metafile: true, logLevel: 'warning' });
writeFileSync('ui/dist/index.html', '<!doctype html><html lang="en"><head><meta charset="UTF-8"><title>Smart Telecom Command Center</title></head><body><div id="root"></div><script type="module" src="/assets/app.js"></script></body></html>');
const out = Object.entries(r.metafile.outputs)[0];
console.log('bundle ok:', out[0], (out[1].bytes / 1024).toFixed(0), 'KB | errors', r.errors.length, '| warnings', r.warnings.length);
