// Usage statistics (server side): run with  node tests/usage.test.mjs
import { parseAgent, sanitize, mergeDevice, summarize, prune, samePassword, KEEP_DAYS } from '../netlify/usage-core.mjs';

let ok = 0, bad = 0;
const eq = (a, b, m) => { const p = JSON.stringify(a) === JSON.stringify(b); p ? ok++ : bad++; console.log((p ? 'PASS ' : 'FAIL ') + m + (p ? '' : `  got ${JSON.stringify(a)} exp ${JSON.stringify(b)}`)); };

// Browsers and devices
const T5 = 'Mozilla/5.0 (Linux; Android 8.0.0; AGS2-W09) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/72.0.3626.105 Safari/537.36';
const t5 = parseAgent(T5);
eq([t5.browser, t5.browserVer, t5.os, t5.osVer, t5.model], ['Chrome', '72', 'Android', '8.0', 'AGS2-W09'], 'Huawei T5 with old Chrome: Chrome 72, Android 8.0, model AGS2-W09');
const iph = parseAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1');
eq([iph.browser, iph.browserVer, iph.os, iph.model], ['Safari', '18', 'iOS', 'iPhone'], 'iPhone Safari');
const reduced = parseAgent('Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36', { model: 'SM-A515F' });
eq([reduced.browser, reduced.browserVer, reduced.model], ['Chrome', '131', 'SM-A515F'], 'Modern Chrome hides the model ("K"); Client Hints fill it in');
const ff = parseAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0');
eq([ff.browser, ff.browserVer, ff.os], ['Firefox', '133', 'Windows'], 'Firefox on Windows');
const edge = parseAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0');
eq(edge.browser, 'Edge', 'Edge is not mistaken for Chrome');

// What is kept from a message
const msg = { id: 'AB2CD3EF', v: '2.6.1', mode: 'mosque', layout: 'board', focus: 'b', night: 'auto', city: 'Mangaluru', country: 'India', lat: 12.91416, lon: 74.85603,
  tz: 'Asia/Kolkata', ua: T5, screen: '1920x1200', dpr: 2, installed: false, old: { minmax: true, flexgap: true }, errors: 3, name: 'Main hall TV', email: 'x@y.z', ip: '1.2.3.4' };
const rec = sanitize(msg, { country: { code: 'in', name: 'India' } }, '2026-11-27');
eq([rec.lat, rec.lon], [12.9, 74.9], 'Location is rounded to ~10 km even if a screen sends more');
eq(['email' in rec, 'ip' in rec, 'ua' in rec], [false, false, false], 'Unknown fields (email, IP, raw user agent) are never kept');
eq([rec.mode, rec.layout, rec.focus, rec.model, rec.cc, rec.old.flexgap, rec.name], ['mosque', 'board', 'b', 'AGS2-W09', 'IN', true, 'Main hall TV'], 'Kept fields');
eq([sanitize({ ...msg, id: 'short' }), sanitize({ ...msg, id: 'AB0CD1EF' }), sanitize(null)], [null, null, null], 'Bad device numbers and empty messages are refused');
eq(sanitize({ ...msg, mode: 'evil', layout: '<script>' }).mode + '|' + sanitize({ ...msg, layout: '<script>' }).layout, '|', 'Unknown values become empty');
eq(sanitize({ ...msg, city: '<b>Hack</b>' }).city, 'bHack/b', 'Angle brackets are stripped from text');

// One document per screen
let doc = null;
for (let i = 0; i < 100; i++) doc = mergeDevice(doc, { ...rec, day: new Date(Date.UTC(2026, 7, 1) + i * 864e5).toISOString().slice(0, 10) });
eq([doc.first, doc.seen.length, doc.seen[doc.seen.length - 1]], ['2026-08-01', KEEP_DAYS, '2026-11-08'], 'A screen keeps at most 90 days of "seen" days, first day remembered');
doc = mergeDevice(doc, { ...rec, day: '2026-11-08' });
eq(doc.seen.filter(d => d === '2026-11-08').length, 1, 'Two messages on the same day count once');

// Summary for the stats page
const mk = (id, mode, days, extra = {}) => { let d = null; for (const day of days) d = mergeDevice(d, { ...rec, ...extra, id, mode, day }); return d; };
const docs = [
  mk('AAAAAAAA', 'home', ['2026-11-26', '2026-11-27']),
  mk('BBBBBBBB', 'mosque', ['2026-11-20', '2026-11-27'], { city: 'Dubai', country: 'UAE' }),
  mk('CCCCCCCC', 'home', ['2026-08-01']),                       // last seen 118 days ago
  mk('DDDDDDDD', 'home', ['2026-11-27'], { errors: 15, old: { minmax: false, flexgap: false } })
];
const sum = summarize(docs, '2026-11-27', 30);
eq([sum.kpi.activeToday, sum.kpi.activePeriod, sum.kpi.mosque, sum.kpi.newThisWeek], [3, 3, 1, 2], 'Headline numbers');
eq(sum.daily[sum.daily.length - 1], { day: '2026-11-27', home: 2, mosque: 1 }, 'Today: 2 Home, 1 Mosque');
eq(sum.places[0], { city: 'Mangaluru', country: 'India', home: 2, mosque: 0 }, 'Places are grouped by city');
eq(sum.devices.find(d => d.id === 'DDDDDDDD').status + '|' + sum.devices.find(d => d.id === 'AAAAAAAA').status, 'errors|old', 'Needs attention: many errors, old browser');

// Daily clean-up
const pr = prune(docs, '2026-11-27');
eq([pr.drop, pr.monthly['2026-08'], pr.monthly['2026-11']], [['CCCCCCCC'], 1, 3], 'Screens unseen for 90 days are dropped; monthly totals kept');

// Password
eq([samePassword('secret', 'secret'), samePassword('secreT', 'secret'), samePassword('', ''), samePassword('x', '')], [true, false, false, false], 'Stats password check (empty password never matches)');

console.log(`\n${ok} passed, ${bad} failed`); if (bad) process.exit(1);
