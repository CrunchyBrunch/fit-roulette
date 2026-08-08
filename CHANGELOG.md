# Changelog

## Fit Roulette v1.4.0 &mdash; Smart Closet Foundation

This locally prepared release candidate is not yet deployed or publicly available.

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

This release candidate keeps the existing `fitRoulette.v1` localStorage key and uses internal data schema version 4.

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
