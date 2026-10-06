// Builds MapleHill-screensaver.html: the Maple Hill scene in screen saver mode as one
// self-contained file. Three.js is bundled in as a classic script, and the web fonts
// are dropped, so it runs from disk with no network and no module loading.
//   npm install && npm run build
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const here = dirname(fileURLToPath(import.meta.url));
let html = readFileSync(join(here, '..', 'index.html'), 'utf8');

const open = '<script type="module">';
const start = html.indexOf(open), end = html.indexOf('</script>', start);
if (start < 0 || end < 0) throw new Error('Could not find the scene module in index.html');
const moduleSrc = html.slice(start + open.length, end);

const out = await build({
  stdin: { contents: moduleSrc, resolveDir: here, loader: 'js' },
  bundle: true, format: 'iife', minify: true, write: false, target: 'es2020', legalComments: 'none',
});
const js = out.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');

html = html.slice(0, start) + `<script>${js}</script>` + html.slice(end + '</script>'.length);
// The flag must be set before the page's first script, which hides the panel and readouts
if (!html.includes('<body>')) throw new Error('Could not find <body> in index.html');
html = html.replace('<body>', '<body>\n<script>window.MAPLE_SAVER = true;</script>');
html = html.replace(/<script type="importmap">[\s\S]*?<\/script>\s*/, '');
html = html.replace(/<link rel="(preconnect|stylesheet)" href="https:\/\/fonts\.[^>]*>\s*/g, '');
html = html.replace(/<title>[^<]*<\/title>/, '<title>Maple Hill Screen Saver</title>');
if (/https?:\/\/(cdn\.jsdelivr|fonts\.g)/.test(html)) throw new Error('A network dependency is still in the output');

writeFileSync(join(here, 'MapleHill-screensaver.html'), html);
console.log(`Wrote MapleHill-screensaver.html (${(html.length / 1024).toFixed(0)} KB)`);
