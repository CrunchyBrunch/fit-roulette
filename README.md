# Fit Roulette

Fit Roulette is a free, static, local-first outfit picker PWA. It uses vanilla HTML, CSS, and JavaScript, stores closet data in `localStorage`, and works without a backend, account, paid API, or database server.

Current release: **1.4.0 - Smart Closet Foundation**

## Run Locally

You can open `index.html` directly for a quick look, but PWA features such as the service worker work best from a local web server.

From this folder:

```powershell
python -m http.server 4173
```

Then open:

```text
http://127.0.0.1:4173/
```

If Python is not available, any static file server works.

## Deploy To GitHub Pages

1. Create a GitHub repository.
2. Copy every file in this folder into the repository root:
   - `index.html`
   - `styles.css`
   - `app.js`
   - `manifest.json`
   - `sw.js`
   - `icons/`
   - `.nojekyll`
   - `README.md`
   - `CHANGELOG.md`
3. Commit and push to GitHub.
4. In GitHub, open the repository settings.
5. Go to Pages.
6. Set Source to `Deploy from a branch`.
7. Choose the branch, usually `main`, and the folder `/root`.
8. Save.

Your app will be available at a URL like:

```text
https://your-username.github.io/your-repo-name/
```

The app uses relative paths (`./index.html`, `icons/...`, `app.js`, `styles.css`), so it works when hosted from a GitHub Pages project path such as `/your-repo-name/`.

## Update The App

1. Edit the static files.
2. If you change cached files, update `APP_VERSION` in `app.js` and keep `CACHE_NAME` in `sw.js` synchronized, for example `fit-roulette-v1.4.0`.
3. Commit and push.
4. Open the deployed app once while online so the service worker can cache the new version.

Installed PWA copies may need a refresh after deployment because iOS Safari can keep older service worker assets briefly.

You can confirm the deployed version from the app:

1. Open Fit Roulette.
2. Go to Data.
3. Check the visible app version under the settings controls.

The Data screen also stores two daily-use preferences:

- `Default Occasion` chooses the initial Generate occasion without changing manual occasion selections during a session.
- `After Logging` controls whether a logged outfit remains visible or is cleared.

Build Around uses a category selector followed by a short item selector. Reroll tracks combinations viewed only for the current in-memory generation context, prefers unseen fits first, and enables controlled repeats after the valid pool is exhausted. `Reset viewed fits` restarts that temporary session without changing outfit history.

## Export And Import Closet Data

Fit Roulette stores your wardrobe, history, banned combos, optional rejection feedback, and settings in the browser's `localStorage`.

The app uses the storage key `fitRoulette.v1`. This user-data key is independent from the visible app release version. Smart Closet uses internal schema version `4` without changing that key. Before a legacy payload is migrated, the app stores one untouched recovery copy at `fitRoulette.v1.recovery.schema4`, migrates and validates entirely in memory, and writes the primary key only after validation succeeds. Unsupported future schemas and malformed data are left untouched and open in a protected, read-only recovery state.

Schema-v4 garments use structured category, subtype, primary/secondary color, pattern, sleeve/bottom length, five-level formality, occasion eligibility, warmth, rain policy, status, preference, labels, review state, and per-item legacy fallback. Implementation enums deliberately stay small: sleeve length is Not applicable/Sleeveless/Short/Long/Other/Unspecified; bottom length is Not applicable/Short/Cropped/Full/Other/Unspecified; warmth is Unspecified through Very warm; rain policy is Unspecified/Avoid/Okay/Preferred. Unsupported colors remain valid custom values.

To back up:

1. Open the app.
2. Go to Data.
3. Tap `Export JSON Backup`.
4. Save the downloaded JSON file somewhere safe.

To restore:

1. Open the app.
2. Go to Data.
3. Tap `Import JSON Backup`.
4. Choose a previously exported JSON file.
5. Confirm the import.

Import replaces the current local data on that device/browser.

## Add To iPhone Home Screen

1. Deploy the app to an HTTPS URL, such as GitHub Pages.
2. Open the deployed URL in Safari on iPhone.
3. Open Data and confirm the app displays version `1.4.0`.
4. If an older Fit Roulette icon is already installed, remove that Home Screen copy before reinstalling; iOS may retain its old icon.
5. Return to Safari, tap the Share button, then tap `Add to Home Screen`.
6. Confirm the name `Fit Roulette` and add it.

Launch the new Home Screen icon once while online. It should open as a standalone app without Safari browser controls, and subsequent launches can use the cached app shell offline.

## PWA Files

- `manifest.json` defines the install metadata and icons.
- `icons/icon-main.png` is the original custom artwork and is not overwritten by the icon-generation helper.
- `icons/` contains the generated Apple touch, PWA, and favicon PNG assets.
- `sw.js` caches the static app shell and serves `index.html` for navigation while offline.
- All app data stays local to the browser through `localStorage`.

The v1.4.0 release uses service-worker cache `fit-roulette-v1.4.0`, synchronized with the visible app version. The cache includes the complete Smart Closet application shell, including `smart-closet.js`.

## Verify Smart Closet Release

With Node.js available, run:

```powershell
node codex-tools/verify-fit-roulette-smart-closet.js
node codex-tools/verify-fit-roulette-v1.4-app.js
node codex-tools/verify-fit-roulette-v1.4-static.js
node codex-tools/verify-fit-roulette-deploy.js
```

The historical migration and static entry points route to the v1.4 checks by default. Set `FIT_ROULETTE_RUN_V133_HARNESS=1` only when intentionally examining the preserved v1.3.3 harness code.

Release notes are maintained in `CHANGELOG.md`.

## Release Workflow

1. Make all changes inside the cloned repository at `C:\Users\iwill\Documents\GitHub\fit-roulette`.
2. Run the syntax, migration, static behavior, deployment, icon, and offline verification checks.
3. Update `APP_VERSION` in `app.js` and keep the service-worker `CACHE_NAME` synchronized to the same release.
4. Update `CHANGELOG.md`.
5. Review `git diff` and confirm only intended files changed.
6. Commit the verified release.
7. Push to `origin main` without force-pushing.
8. Confirm the deployed GitHub Pages app displays the new version.
