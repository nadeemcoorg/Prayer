/* Usage statistics: shared logic for the Netlify functions (pure, no storage, so it can be tested with node).
   One record per screen ("device"), written only by that screen, at most once a day:
     dev/<id>  →  { id, first, last, seen: ['YYYY-MM-DD', …≤90], snap: { …latest technical details } }
   Never stored: IP addresses, names, exact location, error text. */

export const ID_RE = /^[A-HJ-NP-Z2-9]{8}$/;            // 8 characters, no 0/O/1/I
export const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
export const KEEP_DAYS = 90;
export const MAX_BODY = 4096;

const str = (v, n = 60) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, n) : '');
const num = (v, lo, hi) => { const x = Number(v); return Number.isFinite(x) && x >= lo && x <= hi ? x : null; };
const oneOf = (v, list) => (list.includes(v) ? v : '');

/** Browser, OS and device model from a user-agent string (plus Client Hints when the browser sent them). */
export function parseAgent(ua = '', hints = {}) {
  ua = String(ua).slice(0, 400);
  let browser = 'Other', ver = '';
  const m = (re) => { const r = ua.match(re); return r ? r[1] : ''; };
  if ((ver = m(/Edg(?:e|A|iOS)?\/(\d+)/))) browser = 'Edge';
  else if ((ver = m(/SamsungBrowser\/(\d+)/))) browser = 'Samsung Internet';
  else if ((ver = m(/HuaweiBrowser\/(\d+)/))) browser = 'Huawei Browser';
  else if ((ver = m(/(?:Firefox|FxiOS)\/(\d+)/))) browser = 'Firefox';
  else if ((ver = m(/(?:Chrome|CriOS)\/(\d+)/))) browser = 'Chrome';
  else if ((ver = m(/Version\/(\d+)[\d.]* .*Safari/))) browser = 'Safari';
  let os = 'Other', osVer = '';
  if ((osVer = m(/Android (\d+(?:\.\d+)?)/))) os = 'Android';
  else if ((osVer = m(/(?:iPhone|CPU) OS (\d+)/))) os = /iPad/.test(ua) ? 'iPadOS' : 'iOS';
  else if (/Windows NT/.test(ua)) { os = 'Windows'; osVer = m(/Windows NT (\d+\.\d+)/); }
  else if (/CrOS/.test(ua)) os = 'ChromeOS';
  else if (/Mac OS X/.test(ua)) os = 'macOS';
  else if (/Linux/.test(ua)) os = 'Linux';
  let model = str(hints && hints.model, 40);
  if (!model && os === 'Android') { const a = ua.match(/Android [^;)]*; ([^;)]+?)(?: Build\/[^;)]*)?\)/); if (a && !/^(K|wv)$/.test(a[1].trim())) model = str(a[1], 40); }
  if (!model && /iPhone/.test(ua)) model = 'iPhone';
  if (!model && /iPad/.test(ua)) model = 'iPad';
  if (!model && /AFT\w+/.test(ua)) model = 'Fire TV ' + m(/(AFT\w+)/);
  if (hints && hints.platformVersion && os === 'Android' && !osVer) osVer = str(hints.platformVersion, 10);
  return { browser, browserVer: ver, os, osVer, model };
}

/** Turn an incoming message into the record we keep. Returns null when the message is not acceptable. */
export function sanitize(body, geo = {}, today) {
  if (!body || typeof body !== 'object' || !ID_RE.test(body.id || '')) return null;
  const agent = parseAgent(body.ua, body.uaData);
  const lat = num(body.lat, -90, 90), lon = num(body.lon, -180, 180);
  return {
    id: body.id,
    day: today,
    v: str(body.v, 12),
    mode: oneOf(body.mode, ['home', 'mosque']),
    layout: oneOf(body.layout, ['classic', 'board', 'split', 'sunpath']),
    focus: oneOf(body.focus, ['off', 'a', 'b', 'c']),
    night: oneOf(body.night, ['auto', 'on', 'off']),
    city: str(body.city, 60),
    country: str(body.country, 60) || str(geo.country && geo.country.name, 60),
    cc: str(geo.country && geo.country.code, 2).toUpperCase(),
    lat: lat == null ? null : Math.round(lat * 10) / 10,        // ~10 km, whatever the screen sent
    lon: lon == null ? null : Math.round(lon * 10) / 10,
    tz: str(body.tz, 40),
    ...agent,
    screen: str(body.screen, 15),
    dpr: num(body.dpr, 0.5, 5),
    installed: !!body.installed,
    old: { minmax: body.old && body.old.minmax === true, flexgap: body.old && body.old.flexgap === true },
    errors: num(body.errors, 0, 9999) || 0,
    name: str(body.name, 40)                                     // optional screen name, only if the screen set one
  };
}

/** Merge today's record into the screen's stored document. */
export function mergeDevice(prev, rec) {
  const seen = prev && Array.isArray(prev.seen) ? prev.seen.filter(d => DAY_RE.test(d)) : [];
  if (!seen.includes(rec.day)) seen.push(rec.day);
  seen.sort(); while (seen.length > KEEP_DAYS) seen.shift();
  const { id, day, ...snap } = rec;
  return { id, first: (prev && prev.first) || day, last: day, seen, snap };
}

const addDays = (day, n) => new Date(Date.parse(day + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10);
const pct = (n, total) => (total ? Math.round(n / total * 100) : 0);

/** Everything the stats page shows, for the last `period` days up to `today`. */
export function summarize(docs, today, period = 30) {
  const from = addDays(today, -(period - 1)), weekAgo = addDays(today, -6);
  const active = docs.filter(d => d && d.last >= from);
  const daily = [];
  for (let i = 0; i < period; i++) {
    const day = addDays(from, i); let home = 0, mosque = 0;
    for (const d of docs) if (d.seen.includes(day)) (d.snap.mode === 'mosque' ? mosque++ : home++);
    daily.push({ day, home, mosque });
  }
  const tally = (key) => { const t = {}; for (const d of active) { const k = key(d) || 'Unknown'; t[k] = (t[k] || 0) + 1; } return Object.entries(t).sort((a, b) => b[1] - a[1]).map(([k, n]) => [k, n, pct(n, active.length)]); };
  const places = {};
  for (const d of active) {
    const s = d.snap, k = s.city ? `${s.city}|${s.country}` : (s.lat != null ? `${s.lat}, ${s.lon}|${s.country || s.cc}` : `Unknown|${s.country || s.cc}`);
    const p = places[k] || (places[k] = { city: k.split('|')[0], country: k.split('|')[1] || '', home: 0, mosque: 0 });
    s.mode === 'mosque' ? p.mosque++ : p.home++;
  }
  const ageOf = (s) => {
    if (s.old.minmax || s.old.flexgap) return 'Over 3 years';
    const v = +s.browserVer; if (s.browser === 'Chrome' && v && v < 110) return '1–3 years old';
    return 'Up to date';
  };
  const attention = (d) => {
    const s = d.snap; if (s.errors >= 10) return 'errors';
    if (s.old.minmax || s.old.flexgap) return 'old';
    return '';
  };
  const todayRow = daily[daily.length - 1];
  return {
    today, period,
    kpi: {
      activeToday: todayRow.home + todayRow.mosque,
      activePeriod: active.length,
      mosque: active.filter(d => d.snap.mode === 'mosque').length,
      mosqueCities: new Set(active.filter(d => d.snap.mode === 'mosque').map(d => d.snap.city || `${d.snap.lat},${d.snap.lon}`)).size,
      newThisWeek: docs.filter(d => d.first >= weekAgo).length
    },
    daily,
    places: Object.values(places).sort((a, b) => (b.home + b.mosque) - (a.home + a.mosque)).slice(0, 50),
    versions: tally(d => d.snap.v), layouts: tally(d => d.snap.layout), browsers: tally(d => ageOf(d.snap)),
    devices: active.sort((a, b) => (b.last + b.id).localeCompare(a.last + a.id)).slice(0, 500).map(d => ({
      id: d.id, name: d.snap.name, city: d.snap.city || (d.snap.lat != null ? `${d.snap.lat}, ${d.snap.lon}` : ''), country: d.snap.country || d.snap.cc,
      mode: d.snap.mode, layout: d.snap.layout, v: d.snap.v, browser: `${d.snap.browser} ${d.snap.browserVer}`.trim(), os: `${d.snap.os} ${d.snap.osVer}`.trim(),
      model: d.snap.model, screen: d.snap.screen, errors: d.snap.errors, last: d.last, status: attention(d)
    }))
  };
}

/** Daily clean-up: forget screens not seen for KEEP_DAYS, and count distinct active screens per month before they go. */
export function prune(docs, today) {
  const cutoff = addDays(today, -KEEP_DAYS), months = {}, keep = [], drop = [];
  for (const d of docs) {
    for (const day of d.seen) { const m = day.slice(0, 7); (months[m] || (months[m] = new Set())).add(d.id); }
    if (d.last < cutoff) drop.push(d.id); else keep.push(d);
  }
  const monthly = Object.fromEntries(Object.entries(months).map(([m, s]) => [m, s.size]));
  return { drop, monthly };
}

/** Constant-time comparison for the stats password. */
export function samePassword(a = '', b = '') {
  a = String(a); b = String(b); let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0 && b.length > 0;
}
