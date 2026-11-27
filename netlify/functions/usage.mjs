// POST /api/usage — a screen's once-a-day anonymous usage message (only sent after the screen's user agreed).
import { getStore } from '@netlify/blobs';
import { sanitize, mergeDevice, MAX_BODY } from '../usage-core.mjs';

export default async (req, context) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const text = await req.text();
  if (text.length > MAX_BODY) return new Response('Too large', { status: 413 });
  let body; try { body = JSON.parse(text); } catch { return new Response('Bad JSON', { status: 400 }); }
  const today = new Date().toISOString().slice(0, 10);
  const rec = sanitize(body, (context && context.geo) || {}, today);      // the IP address is never read or stored
  if (!rec) return new Response('Rejected', { status: 400 });
  const store = getStore('usage');
  const key = 'dev/' + rec.id;
  const prev = await store.get(key, { type: 'json' }).catch(() => null);
  await store.setJSON(key, mergeDevice(prev, rec));
  return new Response(null, { status: 204 });
};

export const config = { path: '/api/usage' };
