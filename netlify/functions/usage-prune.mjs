// Runs once a day (on the live site only): forgets screens not seen for 90 days and keeps only monthly totals.
// It tidies both the live store and the preview store, since scheduled runs may not say which deploy they belong to.
import { getStore } from '@netlify/blobs';
import { prune } from '../usage-core.mjs';

async function tidy(name, today) {
  const store = getStore(name);
  const { blobs } = await store.list({ prefix: 'dev/' });
  const docs = [];
  for (const b of blobs) { const d = await store.get(b.key, { type: 'json' }).catch(() => null); if (d && Array.isArray(d.seen)) docs.push(d); }
  const { drop, monthly } = prune(docs, today);
  const saved = (await store.get('monthly', { type: 'json' }).catch(() => null)) || {};
  for (const [m, n] of Object.entries(monthly)) saved[m] = Math.max(saved[m] || 0, n);   // never lower a month once counted
  await store.setJSON('monthly', saved);
  for (const id of drop) await store.delete('dev/' + id);
  return drop.length;
}

export default async () => {
  const today = new Date().toISOString().slice(0, 10);
  const live = await tidy('usage', today), preview = await tidy('usage-preview', today);
  return new Response(`Pruned ${live} live, ${preview} preview`);
};

export const config = { schedule: '@daily' };
