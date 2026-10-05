# Prayer Times — notes for Claude

Read `HANDOVER.md` first (project history, decisions, open items), then `README.md`.

## "Deploy" means

When the owner says **deploy**, do all three steps without asking again:

1. **Pull** — `git pull origin main` to bring in the latest changes (including commits made on github.com or by the "Resize new images" Action).
2. **Check for errors and fix** —
   - `node tests/smoke.test.cjs` → must report `0 failed, errors: none`;
   - `node scripts/build.mjs` → must end with `✓ dist/ ready`; then remove `dist/` and revert the date-only changes it makes to `manifest.json` / `manifest.js`;
   - fix anything that fails and re-run until both are clean. If the app changed, bump the version (`APP_VERSION` in `index.html`, `VERSION` in `sw.js`, `package.json`, the version check in `tests/smoke.test.cjs`) and add a line to HANDOVER.md section 5.
3. **Push** — commit and push to `main`; Netlify deploys `main` automatically. If the session is restricted to a working branch, push there, open a pull request and merge it.

Never push while tests or the build are failing; report what is still broken instead.
