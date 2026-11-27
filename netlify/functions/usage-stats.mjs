// GET /api/usage-stats?days=30 — numbers for the owner's stats page. Needs the STATS_PASSWORD set in Netlify.
import { getStore } from '@netlify/blobs';
import { summarize, samePassword, storeName } from '../usage-core.mjs';

export default async (req, context) => {
  const pw = process.env.STATS_PASSWORD || '';
  if (!pw) return Response.json({ error: 'The stats password is not set yet: add STATS_PASSWORD in Netlify → Site settings → Environment variables, then deploy again.' }, { status: 503 });
  if (!samePassword(req.headers.get('x-stats-key') || '', pw)) return Response.json({ error: 'Wrong password.' }, { status: 401 });
  const days = [7, 30, 90].includes(+new URL(req.url).searchParams.get('days')) ? +new URL(req.url).searchParams.get('days') : 30;
  const store = getStore(storeName(context));
  const { blobs } = await store.list({ prefix: 'dev/' });
  const docs = [];
  for (let i = 0; i < blobs.length; i += 50) {
    const part = await Promise.all(blobs.slice(i, i + 50).map(b => store.get(b.key, { type: 'json' }).catch(() => null)));
    for (const d of part) if (d && d.snap && Array.isArray(d.seen)) docs.push(d);
  }
  const monthly = (await store.get('monthly', { type: 'json' }).catch(() => null)) || {};
  return Response.json({ ...summarize(docs, new Date().toISOString().slice(0, 10), days), monthly }, { headers: { 'Cache-Control': 'no-store' } });
};

export const config = { path: '/api/usage-stats' };
