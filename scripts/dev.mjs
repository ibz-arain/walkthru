// Local stand-in for Vercel: serves site/ and runs the /api functions with the same (req, res) helpers.
// Uses a local SQLite file (.data/local.db) unless TURSO_DATABASE_URL is set in .env.local.
import http from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
if (existsSync(path.join(root, '.env.local'))) for (const line of readFileSync(path.join(root, '.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
await mkdir(path.join(root, '.data'), { recursive: true });
process.chdir(root);
const PORT = +(process.env.PORT || 8787);
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.mp4': 'video/mp4', '.svg': 'image/svg+xml' };

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname.startsWith('/api/')) {
    const name = url.pathname.slice(5).replace(/[^a-z0-9-]/gi, '');
    const file = path.join(root, 'api', `${name}.js`);
    if (!name || !existsSync(file)) { res.writeHead(404, { 'content-type': 'application/json' }); return res.end('{"error":"No such API"}'); }
    let raw = ''; for await (const ch of req) raw += ch;
    req.query = Object.fromEntries(url.searchParams);
    try { req.body = raw && (req.headers['content-type'] || '').includes('json') ? JSON.parse(raw) : raw; } catch { req.body = {}; }
    res.status = code => { res.statusCode = code; return res; };
    res.json = obj => { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(obj)); };
    const mod = await import(pathToFileURL(file).href + (process.env.DEV_RELOAD ? `?t=${Date.now()}` : ''));
    return mod.default(req, res);
  }
  let p = path.normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '');
  if (p === '/' || p === '') p = '/index.html';
  let file = path.join(root, 'site', p);
  if (!path.extname(file) && existsSync(file + '.html')) file += '.html'; // clean URLs, like Vercel: /playground → playground.html
  try { const data = await readFile(file); res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' }); res.end(data); }
  catch { res.writeHead(404); res.end('Not found'); }
}).listen(PORT, () => console.log(`Demo dev server → http://localhost:${PORT}  (playground: /playground · studio: /playground#admin)  db: ${process.env.TURSO_DATABASE_URL || 'file:.data/local.db'}`));
