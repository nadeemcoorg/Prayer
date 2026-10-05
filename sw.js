/* Prayer Times — offline support (service worker)
   • The page, manifest, sounds and image previews are kept in the browser, so the
     site opens even when the browser restarts without internet.
   • index.html / manifest are "network first": when online you always get the latest
     version; when offline the saved copy is used.
   • Images and sounds are "cache first" (file names don't change).
   • Calls to AlAdhan / Open-Meteo are not touched — the app keeps its own saved data. */
const VERSION = '2.3.0';
const SHELL = 'pt-shell-' + VERSION;
const MEDIA = 'pt-media-v1';
const SHELL_FILES = ['./', 'index.html', 'manifest.js', 'manifest.json', 'app.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/apple-touch-icon.png', 'icons/favicon-32.png'];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const shell = await caches.open(SHELL);
    await Promise.all(SHELL_FILES.map(u => shell.add(new Request(u, { cache: 'reload' })).catch(() => {})));
    try { // pre-save every adhan sound and every background preview listed in the manifest
      const r = await fetch('manifest.json', { cache: 'reload' });
      const m = await r.json(); const media = await caches.open(MEDIA);
      const urls = [...(m.sounds || []).map(s => 'sounds/' + s.filename), ...(m.images || []).filter(i => i.thumb).map(i => 'images/thumbs/' + i.filename)];
      await Promise.all(urls.map(async u => { if (!(await media.match(u))) await media.add(u).catch(() => {}); }));
    } catch { }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('pt-shell-') && k !== SHELL) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('message', event => {
  // The app sends the list of media it uses so it can be saved for offline use
  if (event.data && event.data.type === 'cache-media' && Array.isArray(event.data.urls)) {
    event.waitUntil(caches.open(MEDIA).then(c => Promise.all(event.data.urls.map(async u => { if (!(await c.match(u))) await c.add(u).catch(() => {}); }))));
  }
});

async function networkFirst(req) {
  const cache = await caches.open(SHELL);
  try {
    const res = await Promise.race([fetch(req), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 5000))]);
    if (res && res.ok) cache.put(req, res.clone());
    return res;
  } catch (e) {
    const hit = await cache.match(req, { ignoreSearch: true }) || (req.mode === 'navigate' ? await cache.match('index.html') || await cache.match('./') : null);
    if (hit) return hit;
    throw e;
  }
}
async function rangeFrom(res, range) {
  const buf = await res.arrayBuffer(); const size = buf.byteLength;
  const m = /bytes=(\d*)-(\d*)/.exec(range || ''); let start = m && m[1] ? +m[1] : 0; let end = m && m[2] ? +m[2] : size - 1;
  if (m && !m[1] && m[2]) { start = size - +m[2]; end = size - 1; }
  end = Math.min(end, size - 1);
  return new Response(buf.slice(start, end + 1), { status: 206, statusText: 'Partial Content', headers: {
    'Content-Type': res.headers.get('Content-Type') || 'audio/mpeg', 'Content-Range': `bytes ${start}-${end}/${size}`,
    'Content-Length': String(end - start + 1), 'Accept-Ranges': 'bytes' } });
}
async function cacheFirst(req) {
  const cache = await caches.open(MEDIA); const url = new URL(req.url); const key = url.pathname;
  const hit = await cache.match(key);
  const range = req.headers.get('range');
  if (hit) return range ? rangeFrom(hit, range) : hit;
  if (range) { // let the browser stream it now, and save the whole file in the background
    cache.add(key).catch(() => {});
    return fetch(req);
  }
  const res = await fetch(req);
  if (res && res.ok && res.status === 200) cache.put(key, res.clone());
  return res;
}

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;                  // APIs: leave alone
  const p = url.pathname;
  if (req.mode === 'navigate' || /\/(index\.html)?$/.test(p) || /\/manifest\.(js|json)$/.test(p)) { event.respondWith(networkFirst(req)); return; }
  if (/\/(images|sounds)\//.test(p)) { event.respondWith(cacheFirst(req)); return; }
});
