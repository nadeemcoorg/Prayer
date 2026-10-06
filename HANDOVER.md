# Prayer Times — Project Handover

> **For a new Claude session / new developer:** read this file first, then `README.md`.
> Repository: **`nadeemcoorg/Prayer`** on GitHub (default branch `main`, deployed by Netlify).
> It records what the app is, how it is built, every revision so far, the decisions the owner made (and why), and what is still open.
> Last updated: **2026-10-06** · Current version: **2.5.0** · Owner: Nadeem Ahmad (GitHub: `nadeemcoorg`)

---

## 1. What the app is

A single-page prayer-times app (`index.html`) used in two ways:

- **Home**: phone, tablet or laptop. Scrolls on small screens; fills the screen on wide or full-screen displays.
- **Mosque / TV**: wall display (landscape or vertical). Fills the screen, large text, shows Iqama countdowns and a "silence phones" screen, keeps the screen awake, and hides the pointer and buttons when idle.

**Hosting**
- **Netlify:** built automatically from the GitHub repository (repo owner `nadeemcoorg`).
- **From disk:** opening `index.html` directly (file://) also works, with reduced features: no offline start-up, no install, no feedback sending.

No user accounts, no backend server. Everything runs in the browser; settings are stored on each device.

---

## 2. Owner's decisions and preferences (keep these)

| Topic | Decision |
|---|---|
| Prayer-time source | **Calculated on the device**, with **AlAdhan as backup** and an automatic cross-check |
| Sunrise label | Sunrise = **Tulu' (طلوع)**, *not* الشروق |
| Ishraq | **Ishraq (الشروق)** = sunrise + 20 min. **No separate card**: shown on the Sunrise card. After Fajr, the "Next prayer" panel counts down to Ishraq |
| "Now" rules | Fajr is "now" until sunrise. **Sunrise → Dhuhr: nothing is "now"**. Isha is "now" until **Islamic midnight** (half-way sunset → sunrise) |
| Makruh (spelling: *Makruh*, مكروه) | Red, blinking card plus red strip: **Tulu' → Ishraq** and **Maghrib − 20 min → Maghrib**. Text: "Ruku and Sujood are not allowed". The pre-Maghrib warning is on the **Asr** card (the current period); the owner was told and didn't object |
| Zawal (زوال) | **Hanafi by default**: a third Makruh window, **10 min before true solar noon → noon**, every day **including Friday**, on the **Dhuhr / Jumu'ah card**. Settings → Prayer & Iqama: on/off (Maliki users turn it off), minutes (3–30), and "No Zawal warning on Fridays" (Shafi'i, off by default). The window ends at solar noon, not at the shown Dhuhr time, for methods that add minutes to Dhuhr (Türkiye, Dubai, Morocco, Lisbon) |
| Layouts | **Layout themes for all modes** (Settings → Display → Layout): 1 Classic (default), 2 Mosque board, 3 Split, 5 Sun path. Mockups: https://claude.ai/artifact/Umajse7HnkW9ePa86atVH6 |
| Focus view | **Mosque only**, Focus mode on/off (off by default) with a choice of **4A** clock + countdown side by side, **4B** clock first, **4C** countdown only. Automatic: on from the **adhan until the Iqama**, starting **once the adhan screen closes**; off after the Iqama |
| Night view | Layout 6 for every screen. Automatic: on **after Isha's Iqama**, off at the **Fajr adhan**. Default **on for Mosque, off for Home** (setting: auto / on / off). Ticker stays visible; Fajr adhan and sound unaffected |
| Minutes | 20 by default (Settings → Prayer & Iqama → "Minutes"), used for both Ishraq and pre-Maghrib Makruh |
| Feedback | Netlify Forms with an email notification (address configured in Netlify, never in code) |
| Images | No uploads to all users yet. Per-device uploads only (one custom background and one adhan per device) |
| Design | No blur/glass effects (rendering problems on cheap TV sticks); keep the flat look |

---

## 3. File map

| Path | Purpose |
|---|---|
| `index.html` | The whole app: HTML + CSS + JS in one file (~2,400 lines) |
| `sw.js` | Service worker: offline start-up, caches the page, manifest, sounds and previews |
| `app.webmanifest`, `icons/` | PWA "Add to Home Screen": name, colours, icons (192, 512, maskable, apple-touch, favicon) |
| `manifest.json` / `manifest.js` | **Asset list** (backgrounds and sounds). `manifest.js` makes it work on file://. Generated; edit `"name"` values freely |
| `scripts/build.mjs` | Netlify build (no dependencies): regenerates the manifest, copies only the needed files into `dist/`. Resizes images too when `sharp` is available |
| `.github/workflows/resize-images.yml` | GitHub Action: on a push to `main` that touches `images/`, installs `sharp`, runs the build script and commits the new `optimized/` + `thumbs/` copies and manifest |
| `netlify.toml` | Build command (with a safety fallback), publish `dist`, cache headers |
| `package.json` | Only a `build` script, **no dependencies** (on purpose, see revision 2.1.1) |
| `generate-manifest.ps1` | Windows alternative: rebuilds the manifest and resized images locally (no longer required; the GitHub Action does it) |
| `images/` | Original backgrounds (large, up to 6000 px) |
| `images/optimized/` | 2560 px copies (used by the app) |
| `images/thumbs/` | 400 px previews (Settings picker) |
| `sounds/` | Adhan MP3s (`sound001–003`, named "Adhan 1–3") |
| `tests/smoke.test.cjs` | Automated test: runs the real app code with a stub DOM and mocked network (`node tests/smoke.test.cjs`) |
| `tests/preview_harness.py` | Builds `tests/preview_harness.html` for visual checks with mocked data and a fake clock |
| `_backup/` | Original v1 files (`Index.original.html`, etc.) |
| `CLAUDE.md` | Standing instructions for Claude sessions (what "deploy" means) |
| `README.md` | User and admin guide (deploying, offline, feedback setup, install on phone) |

---

## 4. Architecture (index.html script)

Sections in order, each marked by a `/* ---- name ---- */` banner:

1. **helpers**: `$`, `el()`, `deepMerge`, `store` (localStorage wrapper, never throws), `idb` (IndexedDB for uploaded files).
2. **time maths**: everything uses *wall-clock time of the location's time zone* as "fake-UTC" milliseconds (`wallNow(tz)`, `wallOf(instant, tz)`, `baseOf(key)`), so times are right even if the device is in another time zone.
3. **settings**: `DEFAULTS`, `loadSettings()`, `migrateV1()` (imports the old `prayerSettings` key and fixes the v1 method mix-up), `locKey()`, `currentTz()`.
4. **on-device calc**:
   - `METHOD_PARAMS`: AlAdhan method ids → angles/minutes, including AlAdhan's built-in offsets for 13 Türkiye, 16 Dubai, 21 Morocco and 22 Lisbon.
   - `PT.compute()`: the PrayTimes.org algorithm.
   - `calcRaw()`, `localDay()`, `hijriOf()`.
   - Calibration: `calibrate()` compares with AlAdhan when online and keeps corrections of ≤ 5 min.
5. **location**:
   - `resolveLocation()` turns a city into coordinates and a time zone (Open-Meteo geocoding).
   - Typed coordinates use the device time zone, refined online.
6. **AlAdhan backup**: `fetchMonth()` (monthly calendar), `neededMonths()` (current + 2 months), `sourceInfo()` (decides local / api / stale), `ensureData()`, `getDay()`.
7. **schedule**: `dayEvents()` applies offsets, Iqama rules and Jumu'ah; `schedule()` is memoised and includes yesterday, today and tomorrow.
8. **rendering**: `applyVisual()` (mode, colours, layout classes `fill` / `portrait` / `list-mode`), `buildRows()`, `renderHijri()`, `setStatus()`.
9. **automatic views**: `focusAt()` and `nightAt()` are pure; `applyAuto()` sets `auto-focus`, `focus-a|b|c` and `night` on `<html>`. Focus is held back while the adhan overlay is open.
10. **main loop**:
   - `makruhAt()` and `prayerState()` are **pure functions**, tested directly.
   - `tick()` runs every second, aligned to the second.
11. **alerts**: `checkAlerts()` fires each alert **once** within a 2-minute window, with de-duplication in `pr.fired`. It never re-fires (this fixed the v1 bug that repeated the adhan every second).
12. **audio**: a single `Audio` element, the `unlockAudio()` first-tap unlock, `chime()` (WebAudio, no file).
13. notifications, wake lock, idle/full screen, toasts, custom files.
14. **settings dialog**: `<dialog>` with a *draft* copy. Changes preview live (`V = draft`); Cancel reverts; Save commits.
15. geolocation, import/export (the export includes uploaded files as data URLs).
16. **new content & offline**: `refreshManifest()` every 3 h, "New" badges, auto-switch option, `registerSW()`.
17. **install (PWA)**: `beforeinstallprompt` handling, iOS "Share → Add to Home Screen" tip.
18. **error log & feedback**: `logError()` keeps the last 30 errors on the device; `diagnostics()`; `sendFeedback()` posts to Netlify Forms; `flushOutbox()` sends messages saved while offline.

### Storage keys (localStorage unless noted)
- `pr.settings.v2` settings · `pr.cache.v3` AlAdhan monthly backup · `pr.calib` calibration · `pr.fired` alerts already fired today
- `pr.files` uploaded file names · `pr.seen` / `pr.new` content badges
- `pr.errors` error log · `pr.outbox` unsent feedback · `pr.fbSent` feedback rate limit · `pr.installSnooze`
- Legacy: `prayerSettings` (v1, migrated), `pr.cache.v2` (converted)
- IndexedDB `prayer-reminder` / store `files`: keys `adhan`, `background`

### External services (all free, no keys)
- **AlAdhan API**: `/v1/timings`, `/v1/calendar`, `/v1/calendarByAddress`. Backup data and calibration.
- **Open-Meteo geocoding**: city → latitude, longitude, time zone (needed once per city).
- **Netlify Forms**: the `feedback` form (a hidden static form in `index.html` lets Netlify detect it).

---

## 5. Revision history

### v1 (original, before this work)
A single `Index.html` with major bugs found in the first review:
- the adhan **repeated every second** during the prayer minute;
- the **calculation method ids were swapped** ("Muslim World League" sent Egyptian and vice versa);
- location not saved; changes not re-fetched; time-zone setting unused;
- countdown and highlight never updated; Cancel didn't revert; Reset broke the adhan;
- the custom file was too big for localStorage, so Save failed;
- autoplay was blocked on kiosks; no offline support; `alert()` popups; poor accessibility.

### v2.0.0: full rewrite
- All v1 bugs fixed; Home and Mosque modes; responsive (phone → 4K TV, portrait TVs).
- Settings dialog with tabs, live preview and validation.
- Per-prayer offsets, Iqama (minutes after adhan or fixed time), Jumu'ah.
- Adhan per prayer, a separate Fajr sound, volume, reminders, notifications, Iqama screen.
- AlAdhan monthly cache, full-screen mode, wake lock, ticker, Hijri date, 12/24 h.
- Uploads stored in IndexedDB; export/import.
- Images optimised (9 MB → 3.5 MB) with thumbnails; friendly asset names; `manifest.js` for file://.

### v2.0.x: UI fixes after the owner's screenshots
- **Overlap bug:** the class `.next` was used both for the next-prayer panel and the highlighted card, so the card took the panel's grid area. The panel was renamed `.next-panel`.
- **Blank panels:** `backdrop-filter` blur rendered blank in the preview and is heavy on TV sticks. Removed; panels made more solid.
- Sound-unlock bar moved into the layout (it covered the title); NOW/NEXT badge moved to the card edge.
- Settings tab bar was squashed (it scrolled vertically): fixed with `flex:none` on the header, tabs and footer.
- **Home full screen used only a 1280 px column:** a `fill` layout now applies to wide windows (≥ 1024 px, landscape) and full screen.
- Fajr no longer "Now" after sunrise.
- `Index.html` renamed to **`index.html`**, because Netlify is case-sensitive.

### v2.1.0: on-device times, offline, Netlify
- **On-device calculation**, verified against AlAdhan in 13 cities:
  - Fajr, Sunrise, Dhuhr, Maghrib, Isha and Midnight match to the minute.
  - Asr is −1 min (−3 at high latitude); fixed automatically by calibration.
- City lookup via Open-Meteo. Offline location change keeps the previous location's times (badge "Previous location").
- AlAdhan backup keeps 3 months. Isha is "now" until Islamic midnight.
- Service worker (offline start-up), `navigator.storage.persist()`, `netlify.toml`, `scripts/build.mjs`, `package.json`.
- New-content check every 3 h with "New" badges and auto-switch; export includes uploaded files; "Compare with AlAdhan" button.

### v2.1.1: Netlify build fix
- The first Git deploy failed (`npm run build` exit code 1).
- Fix:
  - removed the optional `sharp` dependency;
  - the build command now runs `node scripts/build.mjs` with a fallback that publishes the files as they are if the script fails;
  - clearer error messages.
- Images added through GitHub are now published at original size. Run `generate-manifest.ps1` locally to resize them.

### v2.2.0: Islamic time rules, Hijri fix, install
- Sunrise card labelled **طلوع**; **Ishraq** line on the Sunrise card; Ishraq as "next" after Fajr.
- **Makruh** red blinking warning (two windows). Settings toggle and minutes.
- **Hijri month bug:** some phone browsers return Gregorian month names, so "24 Rabiʻ II" showed as "24 April". The app now uses its own month tables (English + Arabic: ٢٤ ربيع الآخر ١٤٤٨ هـ), with a tabular Hijri fallback if the browser lacks the Umm al-Qura calendar.
- **PWA:** `app.webmanifest`, icons, an install banner (Android/Chrome), an iPhone tip, and a Settings → Backup & Help install section.

### v2.3.0: feedback and error log
- Settings → **Feedback** tab:
  - type, message and optional email;
  - "Include diagnostics" with a preview of exactly what will be sent (city only, never exact GPS);
  - rate limit of 5 per day; honeypot spam trap; offline outbox.
- On-device error log (script errors, failed lookups, blocked audio, geolocation and offline-support failures).
- "Report a problem" button on the error screen.

### v2.3.1: automatic image resizing, docs refresh
- New GitHub Action **Resize new images** (`.github/workflows/resize-images.yml`): images uploaded to `images/` through GitHub are resized and committed back automatically, then Netlify redeploys. `sharp` is installed only inside the Action, so the Netlify build stays dependency-free (the v2.1.1 decision holds).
- README and HANDOVER brought up to date: resizing, the repository instead of a local folder, the Moonsighting Committee offline limit.
- `CLAUDE.md` added: what "deploy" means (merge → pull → check and fix → push).

### v2.4.0: Zawal Makruh window
- Third Makruh window at **Zawal**, Hanafi by default (on, 10 min, Fridays included). Based on Sahih Muslim 831 (the three forbidden times).
- `dayEvents()` now returns `zawal` (true solar noon: the day's Dhuhr before user offsets and Jumu'ah, minus the method's own Dhuhr minutes); `makruhAt()` checks `zawal − zawalMin → zawal`.
- New settings `display.zawal`, `display.zawalMin`, `display.zawalSkipFriday`. Existing screens get the Hanafi default on update.
- Tests: 5 new checks (weekday, edges, Friday, Shafi'i Friday option, off). Verified on screen (1920×1080, Tokyo, before and after noon) and in Settings on a phone.

### v2.5.0: layout themes, Focus and Night (current)
- Settings → Display → **Layout**: 1 Classic (default), 2 **Mosque board** (timetable with Adhan/Iqama columns and a Jumu'ah row every day), 3 **Split**, 5 **Sun path** (the sun's arc with prayers and the three Makruh windows). Merged from PRs #3–#7, one branch per feature on a shared `layout-base`.
- **Focus mode** (Mosque only, off by default): A clock + countdown, B clock first, C countdown only; on from the adhan until the Iqama, after the adhan screen closes.
- **Night view** (layout 6): after Isha's Iqama until the Fajr adhan; default Automatic = Mosque screens only, or On / Off. Near-black with dim amber text, slight drift against burn-in.
- `focusAt()`, `nightAt()` and `sunGeom()` are pure and tested. Size +24 KB, no new downloads. Preview harness: optional display-settings argument and a `tv_portrait` scenario.
- The owner previewed the layouts on the Netlify deploy previews; Focus and Night could not be checked live because they depend on the time of day (see section 8).

---

## 6. Testing

- **Automated:** `node tests/smoke.test.cjs`. Expected: **42 passed, 0 failed, errors: none**. It covers:
  - location lookup and on-device times; Fajr/Ishraq/Dhuhr/Isha "now/next" rules; Makruh windows, including Zawal;
  - Islamic midnight; Hijri date; iPhone install state; the adhan fires once;
  - diagnostics content; offline feedback outbox; Netlify form encoding;
  - layouts build (board, split, sun path); Focus and Night on/off windows; sun-path geometry.
- **Visual:** `python tests/preview_harness.py <phone|tv|tv_portrait|phone_times|laptop> [fake ISO time] ['{"layout":"board"}']` → open `tests/preview_harness.html`. The fake time is how Focus and Night were checked.
- **Verified on screen** (by screenshot): 1920×1080 TV (24 h and 12 h), 1024×768, 1080×1920 portrait, laptop, tablet, phone, first-run banner.
- **Not yet verified on screen:** Settings dialog after the tab fix (the owner did confirm the fix by screenshot), adhan/Iqama overlays, Makruh visuals, install banner, Feedback tab. The owner said "Looks good" after v2.2.0.

---

## 7. Known limitations

- Autoplay: browsers need **one tap** after each start-up for sound, unless the kiosk is launched with `--autoplay-policy=no-user-gesture-required`.
- The device clock must be correct; offline, it can't be corrected.
- iPhone: no install button is possible (Apple policy). The user is shown the Share → Add to Home Screen tip.
- AlAdhan uses UTC+0 for Casablanca, while Morocco is officially on UTC+1. Calibration ignores differences over 5 minutes, so on-device times follow the device's time-zone data.
- Moonsighting Committee method (15) always uses AlAdhan (seasonal rules not implemented on-device), so offline it only works for the 3 saved months.
- Netlify itself doesn't resize images; the GitHub Action does, a minute or two after the upload. Replacing an image under the same file name needs its old `optimized/` and `thumbs/` copies deleted.
- Images added by drag-and-drop deploy (not through GitHub) aren't resized; use `generate-manifest.ps1` first.

---

## 8. Open items and next steps

1. **Deployment status to confirm:**
   - ~~all v2.2/2.3 files uploaded to GitHub~~: done (checked 2026-10-05);
   - the Netlify build shows `✓ dist/ ready` (the build runs cleanly locally);
   - Netlify → Forms → *Enable form detection*, then *Submission notifications → Email* for the `feedback` form;
   - after the first image upload, check the repository's **Actions** tab shows *Resize new images* succeeding (needs Settings → Actions → General → *Workflow permissions: Read and write* if the push step is refused).
2. ~~**Layouts**~~: done in v2.5.0. Hooks in `index.html`: `LAYOUTS`, the `lay-*` class on `<html>`, `focusAt()` / `nightAt()` and `applyAuto()` in `tick()`, one marked block per feature in the CSS, in Settings → Display → Layout and in the smoke test. Follow-ups:
   - a way for the owner to **preview Focus and Night** without waiting for the right time (for example a "Preview for 30 seconds" button in Settings);
   - Mockup page: https://claude.ai/artifact/Umajse7HnkW9ePa86atVH6
6. **Small bug (from before v2.5.0):** in 12-hour mode the Ishraq line on the Sunrise card reads "5:59 الشروقAM" (the AM lands in the wrong place inside the Arabic text).
3. **Photo validation** (block people, animals, cartoons, hearts, emoji and so on in user uploads). Options discussed:
   - (A) on-device object/face detection, ~5–8 MB, catches people and animals;
   - (B) on-device zero-shot model (CLIP), ~90–150 MB, catches everything but is slow;
   - (C) cloud AI check through a Netlify Function, the most accurate, but needs internet and a privacy note;
   - (D) admin PIN for Settings in Mosque mode.

   Recommended: **D + A** now, C later if shared uploads are added. Note: block only when people or animals are the *main subject* (the bundled "Madinah Courtyard" image has small people in it). **Waiting for a decision.**
4. ~~**Zawal** as a third Makruh window~~: done in v2.4.0 (Hanafi default).
5. Phase 2 idea (only if needed): admin uploads that reach all screens instantly (Supabase or Firebase plus an admin page).

---

## 9. How to continue in a new session

1. Start a Claude Code session on the GitHub repository `nadeemcoorg/Prayer`.
2. Ask Claude: *"Read HANDOVER.md and README.md, run `node tests/smoke.test.cjs`, then continue with item N from section 8."*
3. After changes:
   - re-run the tests;
   - bump the version (`APP_VERSION` in `index.html`, `VERSION` in `sw.js`, `package.json`);
   - add a line to section 5;
   - commit and push to a branch, then merge into `main` (Netlify deploys `main`).
