# Prayer Times

A prayer-times display for **home** (phone, tablet, laptop) and **mosque** screens (wall TV or vertical screen). The whole app is `index.html`, with no install or build needed to run it.

## How prayer times work

- **Calculated on the device.** After the location is set, times are calculated in the browser, so they keep working **offline with no time limit**.
- **AlAdhan as backup and check.**
  - While online, the device compares its times with [AlAdhan](https://aladhan.com/prayer-times-api) about once a week. Small differences (≤ 5 min, usually Asr by 1 minute) are corrected automatically and remembered for offline use.
  - AlAdhan is used directly when on-device calculation isn't possible: the *Moonsighting Committee* method, or "AlAdhan only" chosen in Settings. Three months are then saved for offline use; after that the screen needs internet again to load new months.
- **City lookup.** A city name is turned into coordinates and a time zone once, which needs internet. *Use my current location* and typed coordinates work immediately, even offline.
- **Changing location while offline.** The previous location's times stay on screen, with a badge, until the new one can be looked up.
- **"Now" rules.**
  - Fajr is "now" until sunrise (Tulu', طلوع).
  - From sunrise until Dhuhr, no prayer is "now". After Fajr, the next item is **Ishraq** (الشروق, sunrise + 20 min), shown on the Sunrise card rather than a separate card.
  - Isha is "now" until Islamic midnight (half-way between sunset and sunrise).
- **Makruh (مكروه) warning.** A red, blinking card and strip appear when Ruku and Sujood are not allowed:
  - from Tulu' until Ishraq;
  - at **Zawal (زوال)**: the 10 minutes before true solar noon, shown on the Dhuhr / Jumu'ah card. This follows the **Hanafi** view by default, so it also applies on Fridays;
  - in the 20 minutes before Maghrib.

  All minutes can be changed in Settings → Prayer & Iqama. The Zawal warning can be turned off (Maliki view), or skipped on Fridays only (Shafi'i view).
- **Hijri date** is shown as, for example, "24 Rabi' al-Thani 1448 AH", with the Arabic ٢٤ ربيع الآخر ١٤٤٨ هـ.

Settings → Location → **Compare with AlAdhan** shows both sets of times side by side.

## Quick start (opening the file directly)

1. Open `index.html` in Chrome, Edge, Firefox or Safari.
2. Click once anywhere. Browsers only allow sound after one click.
3. Settings (⚙ or `S`) → **Location**: enter your city, or press *Use my current location*. Then choose the method your mosque follows and press **Save**.

## Install on a phone (Add to Home Screen)

From the Netlify site:
- **Android / Chrome / Edge:** an **Install** banner appears (also the ⤓ button in the top bar, or Settings → Backup & Help → Install app).
- **iPhone / iPad:** open the site in **Safari**, tap **Share**, then **Add to Home Screen**. The app shows this tip once; dismissing it hides it for 2 weeks.

The installed app opens full screen with its own icon and works offline.

## Feedback and error reports

Users can send suggestions, problems or "wrong prayer time" reports from **Settings → Feedback**.
- **Optional diagnostics.** Users can choose to include app version, browser, settings, today's times, the city (never exact GPS) and the last errors recorded on the device. A preview shows exactly what will be sent.
- **Offline.** A message written offline is saved and sent automatically when the device is back online.
- **Limits.** At most 5 messages per device per day, plus a hidden spam trap.

**Receiving the messages (one-time setup in Netlify):**
1. Netlify → your project → **Forms** → **Enable form detection** (if not already on).
2. Deploy this version. A form called **feedback** appears under **Forms**.
3. **Forms → Submission notifications → Add notification → Email notification**: enter your email address and choose the *feedback* form.

Every message is also kept under **Forms → feedback** in Netlify.

## Deploying on Netlify

**Option A: drag and drop.** Drag this folder onto Netlify.
- Everything works, including offline start-up (`sw.js`).
- The full-size originals in `images/` are uploaded too (~9 MB extra), but they're only used if a resized copy is missing.

**Option B: from a Git repository (recommended).** Push this folder to GitHub and connect the repository in Netlify.
- `netlify.toml` runs `node scripts/build.mjs`, which:
  - rebuilds `manifest.json` / `manifest.js` from the `images/` and `sounds/` folders;
  - publishes only what's needed into `dist/`, leaving the full-size originals out when a resized copy exists.
- **Resizing new images** is done on GitHub, not on Netlify: the **Resize new images** workflow (`.github/workflows/resize-images.yml`) runs whenever something is added to `images/` on `main`. It creates `images/optimized` (≤ 2560 px) and `images/thumbs` (400 px) copies, updates the manifest and commits them, and Netlify then deploys again. The Netlify build itself has no dependencies.
- You can run the same build locally with `node scripts/build.mjs` (it resizes too if you have `npm install sharp` in the folder), or use `generate-manifest.ps1` on Windows.

Settings are stored per device and per site address. If you move from opening the file to the Netlify site, use Settings → Backup & Help → **Export**, then **Import** on the site.

## Publishing new backgrounds and adhans to every screen

1. On github.com, open the repository → `images/` or `sounds/` → **Add file → Upload files** → **Commit**.
2. Netlify publishes the update in about a minute. For a new background, the **Resize new images** workflow then commits the resized copies (see the repository's **Actions** tab), and Netlify publishes again a minute or two later. Until then, the full-size image is used.
3. Every screen checks for new content about every 3 hours, and at start-up.
4. What each screen does with new items is set per device under Settings → Display → *When new backgrounds or adhans are published*:
   - **Add to the list and let me know**: new items appear with a "New" badge.
   - **Switch to the newest background automatically.**
   - **Add quietly.**

   Adhan sounds are never switched automatically.

- File names become display names (`blue-mosque.jpg` → "Blue Mosque"). Edit `"name"` in `manifest.json` for a better title.
- Recommended sizes: images up to ~3 MB (JPG), adhan audio up to ~10 MB (MP3).
- **Replacing an image under the same file name:** also delete its copies in `images/optimized/` and `images/thumbs/`, otherwise the old resized copies stay in use. Uploading it under a new name avoids this.

Files uploaded *inside Settings* stay on that device only. **Export** includes them, so one screen's full setup can be copied to another screen with **Import**.

## Offline behaviour

| Situation | What happens |
|---|---|
| Internet drops while open | Nothing changes: times are calculated on the device |
| Browser or PC restarts with no internet | The page opens from the offline copy (Netlify / https only) |
| New city entered while offline | Previous location's times stay, with a badge; the new city loads once online |
| Very first start-up with no internet | Coordinates or *Use my location* work; a city name needs internet once |

The device clock must be correct: without internet, Windows can't correct its time.

## Home vs Mosque mode

| | Home | Mosque / TV |
|---|---|---|
| Layout | Scrolls on phones and tablets; fills the screen on wide or full-screen displays | Always fills the screen; text sizes itself to the screen |
| Iqama | Hidden by default | Shown, with an "Iqama in mm:ss" countdown |
| At adhan | Adhan with a Stop bar, optional notification | Full-screen adhan display |
| At Iqama | Optional chime | Optional "silence your phones" screen |
| Screen | Optional keep-awake | Always awake; the pointer and buttons hide after 4 s idle |

**Sound on an unattended mosque screen:** click once after each start-up, or launch the browser in kiosk mode:

```
chrome.exe --kiosk --autoplay-policy=no-user-gesture-required https://YOUR-SITE.netlify.app/
```

## Keyboard shortcuts

`S` settings · `F` full screen · `Esc` stop the adhan / close the overlay

## Files

| File | Purpose |
|---|---|
| `index.html` | The whole app |
| `sw.js` | Offline support (used on https / Netlify) |
| `app.webmanifest`, `icons/` | App name and icons for "Add to Home Screen" |
| `manifest.json` / `manifest.js` | List of backgrounds and sounds (generated) |
| `scripts/build.mjs`, `package.json`, `netlify.toml` | Netlify build and caching settings |
| `.github/workflows/resize-images.yml` | Resizes new images uploaded to GitHub and commits the copies |
| `generate-manifest.ps1` | Windows alternative to the build: rebuilds the manifest and resized images locally |
| `images/`, `images/optimized/`, `images/thumbs/` | Backgrounds (originals, TV-sized copies, previews) |
| `sounds/` | Adhan audio |
| `_backup/` | The original version, kept for reference |
| `HANDOVER.md` | Project history, decisions and open items — read first when continuing development |
| `tests/` | Automated test (`node tests/smoke.test.cjs`) and visual preview tool |
