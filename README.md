# Fit Roulette

Fit Roulette is a free, static, local-first outfit picker PWA. It uses vanilla HTML, CSS, and JavaScript, stores closet data in `localStorage`, and works without a backend, account, paid API, or database server.

Current release: **1.5.0 - Context Engine**

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
   - `context-engine.js`
   - `smart-closet.js`
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
2. If you change cached files, update `APP_VERSION` in `app.js` and keep `CACHE_NAME` in `sw.js` synchronized, for example `fit-roulette-v1.5.0`.
3. Commit and push.
4. Open the deployed app once while online so the service worker can cache the new version.

Installed PWA copies may need a refresh after deployment because iOS Safari can keep older service worker assets briefly.

You can confirm the deployed version from the app:

1. Open Fit Roulette.
2. Go to Data.
3. Check the visible app version under the settings controls.

The Data screen stores daily-use preferences including:

- `Default Occasion` chooses the initial Generate occasion without changing manual occasion selections during a session.
- `After Logging` controls whether a logged outfit remains visible or is cleared.
- `Temperature Unit` controls Fahrenheit/Celsius display without changing context scoring.

Build Around uses a category selector followed by a short item selector. Reroll tracks combinations viewed only for the current in-memory generation context, prefers unseen fits first, and enables controlled repeats after the valid pool is exhausted. `Reset viewed fits` restarts that temporary session without changing outfit history.

## Context And Weather

Outfit context is optional. Generation remains functional with no location permission, no network connection, no cached weather, or an expired reading. Manual temperature, broad conditions, warmer/colder adjustment, rain expectation, indoor/outdoor exposure, and Ignore Weather are session controls; manual overrides are not saved as preferences.

`Use Current Location` is the only action that can trigger a browser location prompt. If automatic weather was previously enabled and permission is already granted, Fit Roulette may refresh an older cache without prompting. It never watches location or performs background tracking. The app rounds coordinates before sending them directly to Open-Meteo and does not store coordinates, accuracy, location history, raw provider payloads, or coordinate-bearing request URLs. Closet contents, history, garment data, and identity are never sent to the provider.

Fresh cached current conditions are at most 60 minutes old. A reading older than 60 minutes and no more than 6 hours old is labeled stale and requires explicit awareness before it affects a roll. Older readings are expired and cannot influence generation. Failed refreshes retain the last valid normalized cache. Provider readings are modeled current conditions, not live sensors or safety advice.

[Weather data by Open-Meteo](https://open-meteo.com/) is used through the current-conditions endpoint for this free, noncommercial app. Open-Meteo's free service requires attribution and noncommercial use; commercialization requires a new provider and licensing review. Coordinates sent to Open-Meteo may be processed under its [privacy terms](https://open-meteo.com/en/terms).

## Export And Import Closet Data

Fit Roulette stores your wardrobe, history, banned combos, optional rejection feedback, and settings in the browser's `localStorage`.

The app uses the storage key `fitRoulette.v1`. This user-data key is independent from the visible app release version. Context Engine uses internal schema version `5` without changing that key. Before schema-4 primary data is replaced, the exact raw value is stored once at `fitRoulette.v1.recovery.schema5`. The earlier `fitRoulette.v1.recovery.schema4` protected original is never overwritten. Later confirmed schema 1-4 imports receive an additional protected-original key when the schema-5 slot already contains a different payload. Migration and validation happen in memory, and the primary key is written only after required recovery succeeds. Unsupported future schemas, malformed data, and prohibited location fields leave the primary untouched and open in a protected, read-only state.

Schema-v5 garments retain every schema-v4 field and add independent eligible layer roles (`Base`, `Mid`, `Outer`) plus structured rain and wind protection (`Unspecified`, `None`, `Light`, `Protective`). A garment may have more than one role, and eligible Top-category garments such as sweaters can serve as a Mid layer without changing category. Warmth remains the finite `Unspecified` through `Very warm` scale and is interpreted as a compositional contribution across the selected outfit. Category/subtype, style pair rules, layer role, warmth, and physical fit are separate concerns; physical bulk compatibility and ordered multi-layer sequences remain deferred. Unsupported colors and imported metadata remain preserved.

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

When a confirmed schema 1-4 backup is imported, v1.5.0 stores the exact untouched file text in a schema-5 protected-original slot before replacing primary storage. Existing schema-4 and schema-5 protected originals remain byte-for-byte unchanged, and every retained original is listed separately in Data. Import stops without changing primary or in-memory closet state if required recovery, migration, validation, or primary storage fails. Schema-5 imports do not create an unnecessary legacy recovery.

## Add To iPhone Home Screen

1. Deploy the app to an HTTPS URL, such as GitHub Pages.
2. Open the deployed URL in Safari on iPhone.
3. Open Data and confirm the app displays version `1.5.0`.
4. If an older Fit Roulette icon is already installed, remove that Home Screen copy before reinstalling; iOS may retain its old icon.
5. Return to Safari, tap the Share button, then tap `Add to Home Screen`.
6. Confirm the name `Fit Roulette` and add it.

Launch the new Home Screen icon once while online. It should open as a standalone app without Safari browser controls, and subsequent launches can use the cached app shell offline.

## PWA Files

- `manifest.json` defines the install metadata and icons.
- `icons/icon-main.png` is the original custom artwork and is not overwritten by the icon-generation helper.
- `icons/` contains the generated Apple touch, PWA, and favicon PNG assets.
- `sw.js` caches the static app shell and serves `index.html` for navigation while offline.
- Closet and normalized context data stay local to the browser through `localStorage`; opt-in coordinates are sent directly to Open-Meteo and are never stored by Fit Roulette.

The v1.5.0 release uses service-worker cache `fit-roulette-v1.5.0`, synchronized with the visible app version. The cache includes the complete application shell, including `context-engine.js` and `smart-closet.js`. The service worker ignores cross-origin traffic and any URL containing latitude or longitude parameters.

## Verify Smart Closet Release

With Node.js available, run:

```powershell
node codex-tools/verify-fit-roulette-smart-closet.js
node codex-tools/verify-fit-roulette-context-engine.js
node codex-tools/verify-fit-roulette-v1.5-app.js
node codex-tools/verify-fit-roulette-v1.5-static.js
node codex-tools/verify-fit-roulette-deploy.js
```

The historical migration and static entry points route to the current checks by default. Set `FIT_ROULETTE_RUN_V133_HARNESS=1` only when intentionally examining the preserved v1.3.3 harness code. Detailed architecture, audit findings, thresholds, privacy behavior, and deferred scope are in `CONTEXT_ENGINE.md`.

Release notes are maintained in `CHANGELOG.md`.

## Release Workflow

1. Make all changes inside the cloned repository at `C:\Users\iwill\Documents\GitHub\fit-roulette`.
2. Run the syntax, migration, static behavior, deployment, icon, and offline verification checks.
3. Update `APP_VERSION` in `app.js` and keep the service-worker `CACHE_NAME` synchronized to the same release.
4. Update `CHANGELOG.md`.
5. Review `git diff` and confirm only intended files changed.
6. Commit the verified release.
7. Push the release branch without force-pushing and open a draft pull request.
8. Do not mark ready, merge, or deploy until the product owner confirms a fresh external export of the released personal closet is retained.
9. After authorization and passing remote checks, squash-merge, synchronize local `main`, and verify GitHub Pages deployed the exact merge commit.
