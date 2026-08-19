# Fit Roulette

Fit Roulette is a free, static, local-first outfit picker PWA. It uses vanilla HTML, CSS, and JavaScript, stores closet data in `localStorage`, and works without a backend, account, paid API, or database server.

Current release: **1.6.0 - Closet Insights Foundation**

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
   - `insights.js`
   - `app.js`
   - `manifest.json`
   - `sw.js`
   - `icons/`
   - `.nojekyll`
   - `README.md`
   - `INSIGHTS.md`
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
2. If you change cached files, update `APP_VERSION` in `app.js` and keep `CACHE_NAME` in `sw.js` synchronized, for example `fit-roulette-v1.6.0`.
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

## Closet Insights

Insights is the fifth top-level section. It keeps four evidence types separate: current closet inventory, explicitly logged history, metadata readiness, and current compatibility analysis. Data Readiness, Closet Composition, and Logged Activity are deterministic read-only summaries. Current Coverage and Closet Evaluation run only after an explicit user action. Opening, filtering, or running Insights does not write `fitRoulette.v1`, recovery keys, settings, timestamps, matching state, or analytical results.

Logged Activity defaults to All logged history and offers transient 30-day and 90-day ranges. Multiple records on one date are multiple logged outfits but one logged day. Snapshot metadata is preferred for historical analysis; the current garment is only a fallback when a usable saved snapshot is absent, and unresolved references remain visible evidence. Invalid and future dates are flagged and excluded from time calculations without changing the saved date. Generated, viewed, rerolled, or suggested outfits receive no logged-use credit unless a history record exists.

Current Coverage reuses the released availability, occasion, compatibility, pair-rule, exact-ban, belt, sock, single-layer, context, and Build Around rules. It deterministically evaluates at most 50,000 candidate tuples. Results within the budget are exact; a larger search stops and reports `At least N valid combinations` plus `Analysis capped for performance`, without extrapolation or random sampling. Coverage never recommends a purchase and never changes generation. Closet Evaluation composes the same evidence into optional cards with no grade, score, user comparison, or purchasing pressure.

All analysis remains local. Insights does not request location, call Open-Meteo, send telemetry, load external analytics, or invoke an external model. Metric contracts, provenance, limitations, privacy guarantees, and deferred scope are documented in [`INSIGHTS.md`](INSIGHTS.md).

## Context And Weather

Outfit context is optional. Generation remains functional with no location permission, no network connection, no cached weather, or an expired reading. Manual temperature, broad conditions, warmer/colder adjustment, rain expectation, indoor/outdoor exposure, and Ignore Weather are session controls; manual overrides are not saved as preferences.

`Use Current Location` is the explicit action for first-time permission. Once automatic weather is enabled, startup, Generate/Reroll, visible resume, `pageshow`, and connectivity recovery share one foreground resolver: fresh cache is immediate, while stale, expired, or missing data is refreshed when permission allows. A successful automatic refresh has a 15-minute throttle; a failed refresh instead receives a separate 30-second backoff and may recover later in the same session without requiring routine manual Refresh. Permission prompt or denied states retain the saved opt-in and visibly fall back without blocking, prompting repeatedly, or duplicating generation. Browsers without the Permissions API use the same bounded failure backoff rather than a permanent session guard. No repeating retry timer, background polling, or background location was added. Fit Roulette rounds coordinates before sending them directly to Open-Meteo and does not store coordinates, accuracy, location history, raw provider payloads, or coordinate-bearing request URLs. Closet contents, history, garment data, and identity are never sent to the provider.

The context panel presents the saved Automatic Weather preference separately from current-condition availability and from the effective context the next roll will use or the generated outfit used. Manual, Ignore Weather, provider failure, and neutral fallback therefore never make an enabled automatic preference appear disabled.

Footwear-aware reconciliation adds a compatible available sock after shoes are selected. Sandals and explicitly sockless footwear remain sockless; sneakers, running shoes, boots, and conservative custom footwear expect socks; dress shoes prefer dress socks. If no compatible sock or complete alternate shoe exists, generation remains usable and identifies the missing sock instead of inventing one. Generated results display in stable wear order without changing scoring, history, signatures, or saved item order.

The item editor is one shared workflow across Add Item, Edit, Add Similar, and Save and Add Similar. New items may start from an optional garment preset, whose visible and accessible state distinguishes an exact preset from a customized draft. Presets never save automatically and are hidden during ordinary Edit and Similar flows. New drafts use ordinary validation rather than migration-review messaging; genuine imported or migrated review reasons remain visible until a valid review/save clears them. Multiple validation issues receive a summary, inline explanations, accessible invalid state, and first-error focus without partially saving. Opening any editor mode focuses its heading instead of summoning a text keyboard; pointer opening suppresses only the heading's native rectangle, while keyboard opening retains an app-themed focus indicator. Modified drafts remain protected across Close, Escape, backdrop, navigation where supported, and reload/tab close. Exact high-confidence identity matches receive a non-blocking Possible Duplicate decision with Review Existing, Save Anyway, and Continue Editing; intentional identical garments remain valid and no warning state is persisted. Prefer Together and Never Pair remain independent lazy disclosures, and native segmented inputs stay accessible without widening the editor at 320px and 359px.

The editor follows the same user-facing order in every mode: identity, garment details, appearance, occasions and formality, weather and layering, matching preferences, then advanced/administrative details. Pattern precedes its conditional Secondary Color. Primary and applicable Secondary Color share one canonical, text-labeled swatch control while their native selects remain authoritative; custom color strings and stored semantics are unchanged. Warmth, rainwear, protection, and eligible layer roles remain grouped without changing stored data or matching semantics.

Manual outfit logging retains date, occasion, partial outfits, notes, provenance, and history behavior while adding structured garment search, a live selected count, and a removable selected-garment summary. Filtering never clears selections, and disabling unavailable items removes only selections that are no longer eligible under the existing control.

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

When a confirmed schema 1-4 backup is imported, the schema-5 app stores the exact untouched file text in a schema-5 protected-original slot before replacing primary storage. Existing schema-4 and schema-5 protected originals remain byte-for-byte unchanged, and every retained original is listed separately in Data. Import stops without changing primary or in-memory closet state if required recovery, migration, validation, or primary storage fails. Schema-5 imports do not create an unnecessary legacy recovery.

## Add To iPhone Home Screen

1. Deploy the app to an HTTPS URL, such as GitHub Pages.
2. Open the deployed URL in Safari on iPhone.
3. Open Data and confirm the app displays version `1.6.0`.
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

The v1.6.0 release uses service-worker cache `fit-roulette-v1.6.0`, synchronized with the visible app version. The cache includes the complete application shell, including `context-engine.js`, `smart-closet.js`, and `insights.js`. The service worker ignores cross-origin traffic and any URL containing latitude or longitude parameters.

## Verify Smart Closet Release

With Node.js available, run:

```powershell
node codex-tools/verify-fit-roulette-smart-closet.js
node codex-tools/verify-fit-roulette-context-engine.js
node codex-tools/verify-fit-roulette-v1.6-insights.js
node codex-tools/verify-fit-roulette-v1.6-app.js
node codex-tools/verify-fit-roulette-v1.6-static.js
node codex-tools/verify-fit-roulette-v1.6-ui.js
node codex-tools/verify-fit-roulette-deploy.js
```

The rendered v1.6.0 UI verifier and retained responsive layout verifiers require Playwright and an installed Chrome, Edge, or Chromium browser; set `FIT_ROULETTE_BROWSER` when the browser executable is not in a standard location.

The historical migration and static entry points route to the current checks by default. Set `FIT_ROULETTE_RUN_V133_HARNESS=1` only when intentionally examining the preserved v1.3.3 harness code. Context architecture is documented in `CONTEXT_ENGINE.md`; Insights contracts and limitations are documented in `INSIGHTS.md`.

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
