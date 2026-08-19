# Changelog

## Fit Roulette v1.5.4 &mdash; Daily Workflow Field Fixes

- Separated the 15-minute successful automatic-refresh throttle from a 30-second failure backoff, preserving one-request deduplication, same-session recovery, exactly-once Generate/Reroll, saved opt-in state, last valid cache, and coordinate privacy.
- Centralized foreground weather resolution across startup, Generate/Reroll, visible resume, `pageshow`, and `online` without timers, background polling, unsolicited permission prompts, or lifecycle-triggered outfit generation.
- Reused one native-select-backed Primary/Secondary canonical color control with labeled swatches, independent selection state, non-color selected indicators, forced-color boundaries, custom-string preservation, and responsive wrapping.
- Retained programmatic editor-title focus and mobile-keyboard avoidance while replacing the pointer-open native rectangle with a narrowly scoped, app-themed keyboard-opening indicator.
- Added an advisory exact-identity duplicate decision covering every item-entry save path, including read-only review, Continue Editing, and transactional Save Anyway without fuzzy matching, merging, or persisted warning state.
- Added structured Manual Log search, persistent selection state, live count, and a removable selected-garment summary without changing partial logs, provenance, recency, history, or schema.

This release uses app version `1.5.4`, unchanged data schema `5`, primary key `fitRoulette.v1`, unchanged recovery keys rooted at `fitRoulette.v1.recovery.schema4` and `fitRoulette.v1.recovery.schema5`, and service-worker cache `fit-roulette-v1.5.4`.

## Fit Roulette v1.5.3 &mdash; Item Entry Polish

- Unified Add Item around one shared editor with an optional `Start with a garment preset` launcher, accessible exact/customized preset feedback, semantic color and occasion shortcut states, and no persisted preset identity.
- Corrected the false migration-style Review Requested notice on new and Similar drafts while retaining genuine imported/migrated review reasons and existing valid review-save behavior.
- Reordered item entry into identity, garment details, appearance, occasions/formality, weather/layering, matching, and advanced/administrative groups without changing serialization, search, matching, generation, or custom-color strings.
- Replaced intrusive Similar-mode Name focus with deliberate dialog-heading focus and retained validation focus, dirty-exit protection, and native close restoration.
- Added multi-issue transactional validation with a linked summary, inline actionable messages, `aria-invalid`, `aria-describedby`, non-color-only styling, disclosure opening, correction clearing, and first-error focus.
- Separated Automatic Weather preference, current-condition availability, and next-roll/used context communication while leaving provider, permission, cache, fallback, privacy, and scoring behavior unchanged.
- Added concise generator-trust copy and deterministic UI coverage for workflow, review provenance, selection semantics, validation, weather state communication, contrast, and the retained v1.5.2 narrow-layout matrix.

This release uses app version `1.5.3`, unchanged data schema `5`, primary key `fitRoulette.v1`, unchanged recovery keys rooted at `fitRoulette.v1.recovery.schema4` and `fitRoulette.v1.recovery.schema5`, and service-worker cache `fit-roulette-v1.5.3`.

## Fit Roulette v1.5.2 &mdash; Narrow Editor Hotfix

- Constrained the visually hidden native segmented-control inputs so global form-control sizing can no longer widen the item editor, and aligned narrow sticky header/action insets with the form's responsive padding.
- Preserved native checkbox semantics, label association, pointer and keyboard activation, checked styling, and visible focus treatment.
- Added rendered 320px and 359px overflow coverage across Quick Add, Add Item, Edit Item, Add Similar, Save and Add Similar, expanded matching disclosures, long content, validation, and two-digit relationship counts.

This hotfix uses app version `1.5.2`, unchanged data schema `5`, primary key `fitRoulette.v1`, unchanged recovery keys rooted at `fitRoulette.v1.recovery.schema4` and `fitRoulette.v1.recovery.schema5`, and service-worker cache `fit-roulette-v1.5.2`.

## Fit Roulette v1.5.1 &mdash; Context and Daily-Use Field Fixes

- Resolved automatic context exactly once before candidate construction, sharing eligible in-flight weather refreshes and retaining the saved opt-in plus visible fallback across permission, network, provider, timeout, and storage failures.
- Added centralized footwear-aware sock reconciliation across every existing occasion, including dress-sock preference, sockless sandals, compatible alternate-shoe preference, nonblocking missing-sock explanations, and swap/reroll reconciliation.
- Centralized dirty editor exits across Close, Escape, backdrop, navigation, and unload paths with Save, Discard, and Continue Editing outcomes and transactional single-save behavior.
- Added deterministic presentation-only outfit ordering so Base, the single automatic layer, Bottom, Belt, Socks, Shoes, and Accessories match DOM reading order without mutating generation or history state.
- Added native nested disclosure affordances and lazy independent Prefer Together/Never Pair rendering with live counts, plus a transactional Save and Add Similar workflow with safe item-specific resets.
- Corrected dark-theme primary-button text contrast through centralized theme tokens and added automated WCAG AA assertions.
- Corrected future legacy inference so Athletic Socks wins before generic Socks, while leaving existing schema-5 garments untouched.
- Expanded deterministic regression coverage for context resolution, every footwear/sock policy, editor exit safety, disclosure behavior, stable ordering, history recency, variant resets, and warm/cold Tank behavior.

This release uses app version `1.5.1`, unchanged data schema `5`, primary key `fitRoulette.v1`, unchanged recovery keys rooted at `fitRoulette.v1.recovery.schema4` and `fitRoulette.v1.recovery.schema5`, and service-worker cache `fit-roulette-v1.5.1`.

## Fit Roulette v1.5.0 &mdash; Context Engine

- Added opt-in current conditions through a small Open-Meteo adapter with explicit location consent, bounded/deduplicated no-store requests, provider attribution, normalized coordinate-free caching, and manual/offline fallback.
- Added centralized fresh, stale, and expired context policy plus session-only manual temperature, condition, warmer/colder, expected-rain, indoor/outdoor, and Ignore Weather controls.
- Moved closet data to schema 5 with exact pre-migration recovery at `fitRoulette.v1.recovery.schema5`, retained schema-4 protected originals, additional protected originals for later confirmed legacy imports, and transactional failure behavior.
- Added independent multi-value Base/Mid/Outer layer roles, compositional warmth, structured rain protection, and structured wind protection while retaining category, subtype, rain wear policy, pair rules, and imported metadata.
- Added context-aware outfit scoring and at most one compatible automatic Mid/Outer layer, with honest warmth shortfall text and one-action removal that preserves belt, logging, recency, swap, and ban semantics.
- Added compact coordinate-free history context snapshots recording only the effective roll context and whether an automatic layer was removed.
- Added Athletic for new exercise and training assignments, preserved ambiguous legacy Gym / Errands values for explicit review, and retained Friday Jeans after confirming Work plus Build Around Jeans is not behaviorally equivalent.
- Expanded deterministic migration, recovery, provider, privacy, freshness, context, layer, history, occasion, application, service-worker, PWA, and deployment verification.

This release uses app version `1.5.0`, data schema `5`, primary key `fitRoulette.v1`, recovery keys rooted at `fitRoulette.v1.recovery.schema4` and `fitRoulette.v1.recovery.schema5`, and service-worker cache `fit-roulette-v1.5.0`. Open-Meteo use is limited to the app's current noncommercial deployment and requires visible attribution; commercialization requires a provider/licensing review.

## Fit Roulette v1.4.2 &mdash; Smart Closet Field Fixes

- Made garment saves transactional, single-write, and reliably closing only after successful persistence, with focused validation feedback, scroll reset, and unsaved-change protection.
- Grouped Prefer Together and Never Pair candidates by wearable category, excluded impossible same-slot pairs, and kept stored exceptions visible and removable without letting them influence matching.
- Replaced unrestricted color fields with canonical selectors plus an explicit custom-color route, and made Solid use the schema-4 absent-secondary value without bulk rewriting existing closets.
- Expanded Closet search across structured garment fields with predictable case-insensitive multi-term matching while leaving outfit scoring unchanged.
- Made Optional Belt generate a compatible belt by default, added one-action removal, and ensured removal is respected by logging, recency, and unrelated swaps; Required and No Belt remain strict.
- Retained the v1.4.1 protected-original import transaction and added regression coverage across the complete maintenance scope.

This release keeps data schema version 4, storage key `fitRoulette.v1`, and recovery key `fitRoulette.v1.recovery.schema4`.

## Fit Roulette v1.4.1 &mdash; Smart Closet Stabilization

- Confirmed legacy JSON imports now store the exact untouched file text as the protected original before replacing primary closet storage.
- Imports stop without changing primary or in-memory closet data when required recovery creation fails.
- Existing protected originals are never overwritten by later imports and remain associated with the earlier recovery payload.
- Migration, validation, and primary-storage failures preserve current closet state while retaining any protected original created for the attempted import.
- Added focused regression coverage for legacy recovery ordering, exact raw preservation, repeated imports, failure paths, future schemas, and schema-v4 imports.

This release keeps data schema version 4, storage key `fitRoulette.v1`, and recovery key `fitRoulette.v1.recovery.schema4`.

## Fit Roulette v1.4.0 &mdash; Smart Closet Foundation

- Added transactional schema-v4 migration with a one-time untouched recovery copy before legacy data is replaced.
- Added structured garment categories, controlled subtypes, primary and secondary colors, patterns, sleeve and bottom lengths, five-level formality, occasions, warmth, and rain policy.
- Added distinct Available, Unavailable, and Archived item states plus Avoid, Neutral, Like, and Favorite preferences.
- Replaced tag-dependent defaults with explainable structured matching while preserving occasion eligibility, exact global bans, and conservative semantic compatibility.
- Added canonical bidirectional Prefer together and Never pair item relationships.
- Renamed Raw Tags to Labels for search and organization; Labels do not affect structured matching.
- Added item-level legacy matching fallback and a nonblocking review queue for inferred, incomplete, ambiguous, or unfamiliar migrated settings.
- Added Quick Add, a progressive mobile editor, and Add Similar with safe status, timestamp, history, and relationship resets.
- Made logged history authoritative for wear recency and isolated Generate, Reroll, Swap, and viewed-fit resets from long-term wear history.
- Expanded Swap to every eligible replacement and added concise explanations for status, occasion, and matching exclusions.
- Added generalized fresh-install choices and a history-derived acknowledgment when today's outfit was manually logged.
- Preserved supported older imports, history, exact bans, feedback, settings, custom values, labels, notes, images, timestamps, legacy matching fields, and unfamiliar recoverable data.

This release keeps the existing `fitRoulette.v1` localStorage key and uses internal data schema version 4.

## Fit Roulette v1.3.3 &mdash; Interaction Polish

- Grouped Build Around selection by closet category so mobile item menus stay short and scannable.
- Centralized Generate, Reroll, and post-log state transitions so new results never inherit stale confirmation state.
- Fixed native manual-log date sizing and related form shrink constraints on narrow phone viewports.
- Made reroll and Swap changes easier to follow with a gentler highlight and dependent belt-change notes.
- Added an in-memory unseen-first reroll session with viewed counts, exhaustion messaging, controlled repeats, and an explicit reset.

This release keeps the existing `fitRoulette.v1` localStorage key and adds no persistent data fields.

## Fit Roulette v1.3.2 &mdash; Field Fixes

- Fixed guided matching and quick-tag chips so selection, deselection, and saved state stay synchronized without duplicate values.
- Added configurable post-log behavior with confirmation-and-keep as the backward-compatible default.
- Added a persistent Default Occasion setting.
- Strengthened exact-outfit and top/bottom-pair recency scoring without turning recent wear into a hard ban.
- Removed automatic Add/Edit Item name focus so mobile keyboards open only after a deliberate tap.
- Made the sticky item editor header show the current item name as it changes.
- Grouped archived closet items in a clearly labeled section above active items when Show Archived is enabled.

This release keeps the existing `fitRoulette.v1` localStorage key. New settings are optional and normalized safely for existing installs and older JSON backups.

## 1.3.1 - Home Screen Polish

- Replaced the generated placeholder icons with the custom Fit Roulette artwork.
- Added dedicated 180x180 Apple touch, 192x192 PWA, 512x512 PWA, and 32x32 favicon PNG assets.
- Audited standalone iPhone installation metadata and GitHub Pages-safe relative paths.
- Declared install icons with `purpose: "any"` and removed the stale maskable declaration.
- Synchronized the service-worker cache name with app version `1.3.1`.

App release versions are independent from the local user-data schema. This release continues to use the unchanged `fitRoulette.v1` localStorage key and does not migrate or reset saved data.
