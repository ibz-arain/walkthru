// Email. With RESEND_API_KEY set, mail goes out through Resend; without it, each message is kept in the
// `outbox` table (and printed in the dev server log) so every flow still works locally.
import { db, now } from './db.js';

export const appUrl = req => process.env.APP_URL || `${(req.headers['x-forwarded-proto'] || 'http').split(',')[0]}://${req.headers['x-forwarded-host'] || req.headers.host}`;
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// A plain, readable layout: heading, a few lines, one button.
export function layout({ heading, lines = [], cta, url, foot }) {
  const brand = esc(process.env.BRAND_NAME || 'Demo');
  const html = `<div style="font:15px/1.6 -apple-system,Segoe UI,Inter,sans-serif;color:#111114;max-width:520px;margin:0 auto;padding:32px 24px">
  <p style="font-weight:600;margin:0 0 24px">${brand}</p><h1 style="font-size:20px;letter-spacing:-.01em;margin:0 0 12px">${esc(heading)}</h1>
  ${lines.map(l => `<p style="margin:0 0 12px;color:#3f3f46">${esc(l)}</p>`).join('')}
  ${url ? `<p style="margin:24px 0"><a href="${esc(url)}" style="background:#111114;color:#fff;text-decoration:none;padding:11px 18px;border-radius:8px;font-weight:500;display:inline-block">${esc(cta)}</a></p><p style="font-size:12px;color:#71717a;word-break:break-all">${esc(url)}</p>` : ''}
  ${foot ? `<p style="font-size:12px;color:#71717a;margin-top:28px">${esc(foot)}</p>` : ''}</div>`;
  const text = [heading, '', ...lines, ...(url ? ['', `${cta}: ${url}`] : []), ...(foot ? ['', foot] : [])].join('\n');
  return { html, text };
}

export async function sendMail(to, subject, msg) {
  const c = await db(); let status = 'queued', error = null;
  if (process.env.RESEND_API_KEY) {
    try {
      const r = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'content-type': 'application/json' },
        body: JSON.stringify({ from: process.env.MAIL_FROM || 'Demo <onboarding@resend.dev>', to: [to], subject, html: msg.html, text: msg.text }) });
      status = r.ok ? 'sent' : 'failed'; if (!r.ok) error = (await r.text()).slice(0, 500);
    } catch (e) { status = 'failed'; error = String(e.message).slice(0, 500); }
  } else if (!process.env.VERCEL) console.log(`\n[mail → ${to}] ${subject}\n${msg.text}\n`);
  await c.execute({ sql: 'INSERT INTO outbox (to_addr, subject, body, status, error, created_at) VALUES (?, ?, ?, ?, ?, ?)', args: [to, subject, msg.text, status, error, now()] });
  return status;
}

// Tell the people in a workspace who want notifications (editors and up) about customer activity.
export async function notifyTeam(req, orgId, subject, msg) {
  if (!orgId) return;
  const c = await db();
  const r = await c.execute({ sql: "SELECT u.email FROM members m JOIN users u ON u.id = m.user_id WHERE m.org_id = ? AND u.notify = 1 AND m.role IN ('owner','admin','editor')", args: [orgId] });
  for (const row of r.rows) await sendMail(row.email, subject, msg);
}
