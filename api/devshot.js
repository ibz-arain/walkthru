// TEMPORARY dev-only helper for capturing home page images. Not committed.
import { writeFileSync, mkdirSync } from 'node:fs';
export default async function (req, res) {
  const name = String(req.query.name || 'shot').replace(/[^a-z0-9-]/gi, ''), m = String(req.body || '').match(/^data:image\/(png|jpeg);base64,(.+)$/);
  if (!m) { res.statusCode = 400; return res.end('bad'); }
  mkdirSync('.build/shots', { recursive: true }); writeFileSync(`.build/shots/${name}.${m[1] === 'png' ? 'png' : 'jpg'}`, Buffer.from(m[2], 'base64')); res.end('ok');
}
