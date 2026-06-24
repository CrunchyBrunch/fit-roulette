# Fit Roulette

Fit Roulette is a free, static, local-first outfit picker PWA. It uses vanilla HTML, CSS, and JavaScript, stores closet data in `localStorage`, and works without a backend, account, paid API, or database server.

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
2. If you change cached files, update `CACHE_NAME` in `sw.js`.
3. Commit and push.
4. Open the deployed app once while online so the service worker can cache the new version.

Installed PWA copies may need a refresh after deployment because iOS Safari can keep older service worker assets briefly.

## Export And Import Closet Data

Fit Roulette stores your wardrobe, history, and banned combos in the browser's `localStorage`.

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
3. Tap the Share button.
4. Tap `Add to Home Screen`.
5. Confirm the name `Fit Roulette`.

After opening once online, the app shell is cached for offline use.

## PWA Files

- `manifest.json` defines the install metadata and icons.
- `icons/` contains iPhone and PWA PNG icons.
- `sw.js` caches the static app shell and serves `index.html` for navigation while offline.
- All app data stays local to the browser through `localStorage`.
