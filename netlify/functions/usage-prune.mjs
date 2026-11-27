// Runs once a day: forgets screens not seen for 90 days and keeps only monthly totals.
import { getStore } from '@netlify/blobs';
import { prune } from '../usage-core.mjs';

export default async () => {
  const store = getStore('usage');
  const { blobs } = await store.list({ prefix: 'dev/' });
  const docs = [];
  for (const b of blobs) { const d = await store.get(b.key, { type: 'json' }).catch(() => null); if (d && Array.isArray(d.seen)) docs.push(d); }
  const { drop, monthly } = prune(docs, new Date().toISOString().slice(0, 10));
  const saved = (await store.get('monthly', { type: 'json' }).catch(() => null)) || {};
  for (const [m, n] of Object.entries(monthly)) saved[m] = Math.max(saved[m] || 0, n);   // never lower a month once counted
  await store.setJSON('monthly', saved);
  for (const id of drop) await store.delete('dev/' + id);
  return new Response(`Pruned ${drop.length}`);
};

export const config = { schedule: '@daily' };
