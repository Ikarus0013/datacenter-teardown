// Bundles src/ + data/baseline.json + three.js into one offline HTML file: dist/datacenter.html
import { build } from 'esbuild';
import { readFile, writeFile, mkdir } from 'node:fs/promises';

const js = await build({
  entryPoints: ['src/main.js'],
  bundle: true,
  minify: true,
  format: 'iife',
  write: false,
  loader: { '.json': 'json', '.geojson': 'json' },
});

const [html, css] = await Promise.all([
  readFile('src/index.html', 'utf8'),
  readFile('src/style.css', 'utf8'),
]);

const script = js.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const out = html
  .replace('<!--STYLE-->', () => `<style>${css}</style>`)
  .replace('<!--SCRIPT-->', () => `<script>${script}</script>`);

await mkdir('dist', { recursive: true });
await writeFile('dist/datacenter.html', out);
console.log(`dist/datacenter.html  ${(out.length / 1024).toFixed(0)} KB`);
