# Working in Fit Roulette

## Scope and architecture
- Read `README.md` for the current release and workflow. This is a static, local-first vanilla HTML/CSS/JavaScript PWA; npm dependencies support verification only.
- Keep changes scoped to the requested feature or fix. Use a task branch in the current checkout; do not rely on the original author's Windows path.
- Read `CONTEXT_ENGINE.md` when changing weather, layers, compatibility, or generation; read `INSIGHTS.md` when changing analysis or coverage.

## Admin and specialist chats
- **Admin** owns the [Fit Roulette roadmap in Notion](https://app.notion.com/p/3d80c88d6b908159abeccab87d029ae0). Use Current Focus, Next Milestone, and the owner's direction to pick the next actionable task. Daily Use Notes are candidates until promoted. Define the outcome, scope, stop point, and acceptance evidence; track the assigned chat, revision, blockers, and next decision. Admin checks evidence and handles operations only within granted authority. Leave investigation and implementation with one specialist.
- Reuse the Fit Roulette Codex chats by subject: **v1.4 Smart Closet** for wardrobe schema, migration, and recovery; **v1.5 Context Engine** for weather, layering, and generation; **v1.6 Closet Insights** for Insights, history, and v1.6 daily-use work. **v0-v1.3** has the early app and PWA context. The specialists investigate defects, implement authorized changes, run verification, and prepare draft PRs. For an existing PR, send fixes back to the chat that produced it.
- Resolve destinations by project and chat identity. The coordinating **Admin** is distinct from the earlier **Admin** that produced PR #14. **Legacy Fit Roulette** is historical product context.
- Route all independent PR audits and re-reviews to Fit Roulette's dedicated **PR Audits** chat. Its sole purpose is to examine the exact PR revision and return findings and a verdict. Versioned chats, including **v1.6 Closet Insights** and future version specialists, own engineering. Admin sends findings to the implementation owner for fixes, then returns the new SHA to **PR Audits**.
- Choose model and thinking separately for each handoff. Keep the chat's established model by default: coordinating Admin and v1.6 Closet Insights use `gpt-6-astra`; the earlier Admin, v1.4 Smart Closet, v1.5 Context Engine, and v0-v1.3 use `gpt-5.6-sol`. Check current settings and supported efforts at dispatch. Flag a proposed model change to the owner before switching. Choose effort for this task's uncertainty and impact: comparing two SHAs may need little reasoning; tracing a recovery write across failure paths may need High. Reassess if scope or evidence changes.
- When the owner has authorized messaging the destination, use `send_message_to_thread` with the prompt below. Preserve the current model unless switching as agreed; set the supported thinking level for this assignment. Otherwise give the owner the completed prompt to paste. Follow the existing chat with `wait_threads` or read its return there; no second investigation or parallel implementation.
- Check the return against acceptance. A review verdict names the full reviewed commit and its check results; if the PR head moves, the verdict no longer covers it. Return confirmed findings to the implementation owner, carry unresolved findings into the next handoff, and route any required re-review at the new head. Report the result or the specific decision/blocker that needs the owner. Apply standing authorization once its conditions hold; keep implementation, independent review, merge, and verified Pages rollout distinct. The release gates below still apply.

## Assignment prompt
Fill all eight fields in the message itself, including when the routing tool sets the model and effort.

```text
Destination: [existing Fit Roulette role/chat; ID if ambiguous]
Recommended model: [specific available model]
Recommended thinking level: [level supported by that model]
Reason: [one sentence about this task's difficulty, uncertainty, or impact]
Task: [one concrete outcome]
Target and evidence: [repo, branch/PR, full SHA, files, roadmap note or reproduction]
Scope and authority: [allowed actions, constraints, and stop point]
Acceptance and return: [checks, evidence, unresolved findings, and any decision for Admin]
```

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
- The owner grants standing authorization to route and carry out technical engineering work through PRs that follow these scope, verification, review, and documentation rules. Personal JSON exports are optional. Use the release workflow in `README.md` for merge and Pages verification.
