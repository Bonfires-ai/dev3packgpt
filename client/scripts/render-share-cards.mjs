#!/usr/bin/env node
/**
 * render-share-cards.mjs — render the session-complete card images that X
 * shows as the link preview for /share (public/share-cards/session-<mood>.png).
 *
 * Run with: node scripts/render-share-cards.mjs
 *
 * Uses the same drawing code as the in-app Share button
 * (lib/sessionCardImage.ts) and the copy in config/persona.config.ts, run in
 * headless Chrome. Re-run after changing either. Needs Google Chrome and
 * network access (Inconsolata is fetched from the Google Fonts repo).
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const chrome = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const inconsolataUrl = 'https://github.com/google/fonts/raw/main/ofl/inconsolata/Inconsolata%5Bwdth%2Cwght%5D.ttf';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'share-cards-'));

// Compile the renderer and the config to CommonJS so this script and the page can load them.
execFileSync(
  path.join(root, 'node_modules/.bin/tsc'),
  [
    'lib/sessionCardImage.ts',
    'config/persona.config.ts',
    '--module',
    'commonjs',
    '--target',
    'es2020',
    '--lib',
    'es2020,dom',
    '--skipLibCheck',
    '--outDir',
    tmp,
  ],
  { cwd: root, stdio: 'inherit' }
);
const { personaConfig } = createRequire(import.meta.url)(path.join(tmp, 'config/persona.config.js'));
const renderer = fs.readFileSync(path.join(tmp, 'lib/sessionCardImage.js'), 'utf8');

const dataUrl = (buffer, type) => `data:${type};base64,${Buffer.from(buffer).toString('base64')}`;
const druk = dataUrl(fs.readFileSync(path.join(root, 'app/fonts/DrukCond-Super.woff2')), 'font/woff2');
const logo = dataUrl(fs.readFileSync(path.join(root, 'public/dev3pack-logo.jpg')), 'image/jpeg');
const inconsolataResponse = await fetch(inconsolataUrl);
if (!inconsolataResponse.ok) throw new Error(`Inconsolata download failed (${inconsolataResponse.status})`);
const inconsolata = dataUrl(await inconsolataResponse.arrayBuffer(), 'font/ttf');

const outDir = path.join(root, 'public/share-cards');
fs.mkdirSync(outDir, { recursive: true });

for (const mood of Object.keys(personaConfig.moods)) {
  const card = personaConfig.moods[mood].endCard;
  const args = { label: personaConfig.appName, motif: card.motif, title: card.title };
  const html = `<!doctype html><meta charset="utf-8">
<style>
  @font-face { font-family: 'Druk'; src: url(${druk}) format('woff2'); font-weight: 900; }
  @font-face { font-family: 'Inconsolata'; src: url(${inconsolata}) format('truetype'); font-weight: 200 900; }
</style>
<pre id="out"></pre>
<script>var exports = {};</script>
<script>${renderer}</script>
<script>
  exports
    .renderSessionCard({ ...${JSON.stringify(args)}, fonts: { display: 'Druk', mono: 'Inconsolata' }, logoSrc: '${logo}' })
    .then(blob => new Promise(resolve => { const r = new FileReader(); r.onload = () => resolve(r.result); r.readAsDataURL(blob); }))
    .then(url => { document.getElementById('out').textContent = url; })
    .catch(err => { document.getElementById('out').textContent = 'ERROR ' + err; });
</script>`;
  const page = path.join(tmp, `${mood}.html`);
  fs.writeFileSync(page, html);

  const dom = execFileSync(
    chrome,
    ['--headless=new', '--disable-gpu', '--virtual-time-budget=10000', '--dump-dom', `file://${page}`],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }
  );
  const match = dom.match(/data:image\/png;base64,([A-Za-z0-9+/=]+)/);
  if (!match) throw new Error(`No image rendered for ${mood}: ${dom.match(/ERROR[^<]*/)?.[0] ?? 'empty output'}`);

  const file = path.join(outDir, `session-${mood}.png`);
  fs.writeFileSync(file, Buffer.from(match[1], 'base64'));
  console.log(`wrote ${path.relative(root, file)}`);
}

fs.rmSync(tmp, { recursive: true, force: true });
