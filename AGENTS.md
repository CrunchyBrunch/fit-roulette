# Working in Fit Roulette

## Scope and architecture
- Read `README.md` for the current release and workflow. This is a static, local-first vanilla HTML/CSS/JavaScript PWA; npm dependencies support verification only.
- Keep changes scoped to the requested feature or fix. Use a task branch in the current checkout; do not rely on the original author's Windows path.
- Read `CONTEXT_ENGINE.md` when changing weather, layers, compatibility, or generation; read `INSIGHTS.md` when changing analysis or coverage.

## Contracts to preserve
- `fitRoulette.v1` is the user-data key, independent of app release numbering. Preserve schema, import/export, recovery-original bytes, and transactional writes unless a schema change is explicitly requested.
- Unsupported future schemas, malformed data, and prohibited location fields must remain protected. Never overwrite recovery originals or partially save a failed import/edit.
- Generated/viewed/rerolled outfits are not logged use. History edits preserve identity, provenance, snapshots, and missing references according to the existing contracts.
- Tests use synthetic fixtures and isolated browser contexts. Never inspect or commit personal closet exports, browser storage, real coordinates, or location history.
- Keep weather opt-in and foreground-only. Preserve offline/permission-denied fallback, location minimization, and read-only Insights behavior.

## Verification
- Setup: `npm ci --ignore-scripts`, then `npm run verify:install` (installs Chromium/WebKit and Linux browser dependencies).
- Canonical gate: `npm run verify`. It syntax-checks app/tool JavaScript and runs every retained `verify-fit-roulette-*.js` entry point, including browser/offline checks. New verifiers matching that pattern join automatically.
- Missing browser prerequisites and failing checks are failures; report the command, cause, and any blocked validation. Do not weaken assertions to obtain green CI.
- Historical migration/static entry points run current checks by default. `FIT_ROULETTE_RUN_V133_HARNESS=1` is only for intentionally investigating the old harness, never the release gate.
- Browser automation does not prove physical iPhone Safari, installed-PWA, native picker, or safe-area behavior. Keep the README's physical-device acceptance gate explicit.

## Review and release
- For changes to cached app assets, synchronize the app version, HTML query versions, service-worker cache, and release notes per the existing release process. Documentation/tooling-only changes need no app version bump.
- Review the diff, commit to a task branch, push without force, and open a draft PR with scope, root cause where established, preserved contracts, exact verification results, and deferred/manual checks.
- Stop at the draft PR unless the user separately authorizes release actions. Ready/merge/deploy requires owner confirmation of a fresh external personal-closet export and passing remote checks. Merging to the Pages branch can publish the app.
