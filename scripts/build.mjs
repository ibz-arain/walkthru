// Build the site from src/  (npm run build)
//   site/index.html, account.html, terms.html, privacy.html, track.js, og.png  → copied
//   site/playground.html  → small HTML shell
//   site/assets/playground.<hash>.js / .css  → the app with three.js bundled in, minified, cache-forever names
//   walkthru.html  → the old single-file build (three.js from a CDN), for sharing as one file
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, readdirSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url))); process.chdir(root);
const read = f => readFileSync(f, 'utf8');
const JS = ['core', 'walls', 'build', 'furniture', 'house2', 'car', 'builder', 'furnish3', 'editor', 'designer', 'app', 'designs', 'account', 'cloud', 'ui', 'extras'].map(n => `src/${n}.js`);
const CSS = ['src/css/ui.css', 'src/css/editor.css'];
const head = read('src/head.html'), body = read('src/body.html'), code = JS.map(read).join('\n'), css = CSS.map(read).join('\n');
const hash = s => createHash('sha256').update(s).digest('hex').slice(0, 10);

// 1. single file (unchanged behaviour: import map → CDN)
writeFileSync('walkthru.html', `${head}<style>\n${css}</style>\n${body}<script type="module">\n${code}</script>\n`);

// 2. site
mkdirSync('site/assets', { recursive: true });
for (const f of readdirSync('site/assets')) rmSync(`site/assets/${f}`);
for (const [from, to] of [['src/landing.html', 'index.html'], ['src/account.html', 'account.html'], ['src/track.js', 'track.js'], ['src/assets/og.png', 'og.png'], ['src/assets/home-render.jpg', 'home-render.jpg'], ['src/assets/home-plan.jpg', 'home-plan.jpg'], ['src/assets/home-walk.jpg', 'home-walk.jpg']]) copyFileSync(from, `site/${to}`);

mkdirSync('.build', { recursive: true });
writeFileSync('.build/playground.js', code.replaceAll("'three/addons/", "'three/examples/jsm/"));
const js = await esbuild.build({ entryPoints: ['.build/playground.js'], bundle: true, minify: true, format: 'esm', target: 'es2020', write: false, legalComments: 'none', logLevel: 'warning' });
const cssOut = await esbuild.transform(css, { loader: 'css', minify: true });
const jsText = js.outputFiles[0].text, jsName = `playground.${hash(jsText)}.js`, cssName = `playground.${hash(cssOut.code)}.css`;
writeFileSync(`site/assets/${jsName}`, jsText); writeFileSync(`site/assets/${cssName}`, cssOut.code);

const shellBody = body.replace(/<script type="importmap">[\s\S]*?<\/script>/, '');
writeFileSync('site/playground.html', `<!doctype html>
<html lang="en">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="description" content="Demo playground: design a floor plan and explore it in 3D.">
${head}<link rel="modulepreload" href="/assets/${jsName}">
<link rel="stylesheet" href="/assets/${cssName}">
${shellBody}<script type="module" src="/assets/${jsName}"></script>
</html>
`);
const kb = n => (n / 1024).toFixed(0) + ' KB';
console.log(`site/assets/${jsName}  ${kb(jsText.length)}\nsite/assets/${cssName}  ${kb(cssOut.code.length)}\nsite/playground.html  ${kb(read('site/playground.html').length)}`);
