# Fit Roulette v1.5.1 Context Engine

## v1.5.3 Item Entry And Context Communication

Item creation, editing, Add Similar, and Save and Add Similar use one shared schema-5 editor. New items can start from an optional garment preset; preset identity and customization state are transient and never enter storage or export. New and Similar drafts never own migration-review messaging. Only a persisted garment that entered Edit with `review.status = needs_review` presents its retained reasons, and the existing valid review/save path remains the only editor action that clears those reasons and item-level legacy fallback.

Validation remains transactional and now reports all known issues through a top summary plus field/group-specific messages, programmatic invalid/error association, disclosure opening, and first-error focus. The field reordering is presentation-only: collection, validation, pair rules, search, generation, history, import/export, custom-color strings, schema 5, and all protected-original behavior remain unchanged. Editor openings focus a programmatic heading rather than a text field so Add Similar and Save and Add Similar do not summon a mobile keyboard without typing intent.

The context interface communicates three independent dimensions: saved `Automatic Weather: On/Off`; current-condition availability (`Current`, `Cached`, `Stale`, `Expired`, `Unavailable`, or `Not enabled`); and the effective context the next roll will use or the generated outfit used (`Current`, `Cached`, accepted stale, Manual, Adjusted, Ignored, or Neutral). Temporary Manual and Ignore Weather remain session controls and do not change the saved automatic preference. This wording layer does not alter provider calls, permission rules, freshness thresholds, cache normalization, fallback behavior, generation orchestration, history context, or coordinate privacy.

## v1.5.1 Daily-Use Corrections

Generation now resolves effective automatic context before candidate construction. Fresh cache is used immediately; stale, expired, or missing cache starts one shared refresh when the saved opt-in and current permission state allow it. Concurrent Generate actions await the same resolution and produce one outfit. Failures preserve the last valid cache and saved opt-in, identify the actual fallback, and never block generation. Prompt and denied states are not repeatedly invoked. Browsers without the Permissions API receive at most one best-effort automatic attempt per session after a failure; an explicit Use Current Location or retry action resets that guard. Browser permission UI remains browser-controlled.

Sock selection is centralized after footwear evaluation. Sandals and explicitly sockless footwear omit socks; sneakers, running shoes, boots, and unknown/custom footwear expect a compatible available sock; dress shoes prefer dress socks. Existing availability, occasion, pair-rule, preference, matching, and recency scoring remain authoritative. Complete alternate shoes outrank a sock-required fit with no compatible sock, while the final incomplete fallback remains visible and usable. Shoe swaps reconcile the automatic sock again, and only logged socks receive wear recency.

The editor uses one dirty-exit controller for in-app and feasible browser exits, with transactional Save, Discard, and Continue Editing outcomes. Prefer Together and Never Pair remain native nested disclosures, default collapsed, render candidates lazily, and preserve authoritative hidden selections. Save and Add Similar commits the current item once, then creates a clean unsaved variant draft with relationships and item-specific state reset. Result ordering is presentation-only and stable: Base, the single automatic layer, Bottom, Belt, Socks, Shoes, Accessories, then future categories. Dark primary buttons use theme-specific text tokens that meet WCAG AA.

## Technical Audit

The v1.4.2 baseline stores one JSON state at `fitRoulette.v1`. Schema 4 already provides structured categories (`Top`, `Bottom`, `Shoes`, `Layer`, `Belt`, `Socks`, `Accessory`), controlled subtypes, warmth, rain wear policy, occasion eligibility, item status and preference, bidirectional pair rules, exact-combination bans, review state, and preserved legacy metadata. Custom subtype values are normalized to `Other` while the original value remains in `unrecognizedStructured` for review.

Migration already validates in memory, preserves a first protected original before legacy replacement, and writes primary storage only after recovery. Confirmed imports preserve primary and in-memory state on recovery, validation, or primary-write failure. History stores item IDs plus garment snapshots and is authoritative for usage and recency. Generate and Reroll use an in-memory candidate session; Swap changes only a matching wearable slot; Optional Belt removal stays in memory until logging; generated outfits are not persisted across reload.

The service worker caches only same-origin GET application assets. There is no Content Security Policy or other repository network restriction. v1.4.2 offered a persisted Fahrenheit manual weather setting. v1.5 preserves that former preference as inactive legacy metadata but uses session-only manual context and a separate saved display-unit preference.

The released occasion model includes `Work`, `Friday Jeans`, `Casual`, `Date`, and ambiguous `Gym / Errands`. Friday Jeans is not equivalent to Work plus Build Around Jeans: Friday has different eligibility and target formality, while Work-selected jeans may be ineligible. Friday Jeans therefore remains supported. New exercise/training assignments use `Athletic`; legacy `Gym / Errands` values remain readable and enter the nonblocking review queue so the app never guesses exercise versus errands. An explicitly imported `Errands` value safely maps to `Casual`.

## Schema 5 And Protected Originals

- Primary: `fitRoulette.v1`
- Existing protected original: `fitRoulette.v1.recovery.schema4`
- First pre-schema-5 protected original: `fitRoulette.v1.recovery.schema5`
- Additional confirmed legacy imports: `fitRoulette.v1.recovery.schema5.import.<unique suffix>`

Automatic v4 to v5 migration stores the exact raw schema-4 primary at the schema-5 recovery key before writing primary storage. Neither fixed recovery key is overwritten. A confirmed schema 1-4 import must also be retained exactly; if the fixed schema-5 slot contains different bytes, an additional protected-original key is created. Every retained original is independently labeled and downloadable in Data.

Recovery failure aborts before primary write. Migration, validation, and primary-write failures leave the prior in-memory and primary state intact. Schema-5 imports do not create a legacy recovery. Malformed, unsupported future-schema, and coordinate-bearing data are rejected. Protected originals are never used as the active closet automatically and sample garments are never substituted during migration or recovery.

## Garment Layer Model

Category and layer role remain independent. Applicable garments have a validated `layerRoles` array containing one or more of:

- `base`
- `mid`
- `outer`

Warmth uses the retained finite `warmth` scale. Context scoring maps it to compositional points: Unspecified `0`, Very light `0.5`, Light `1`, Medium `2`, Warm `3`, Very warm `4`. Points are summed across the visible outfit.

Rain and wind use independent `rainProtection` and `windProtection` values: `unspecified`, `none`, `light`, `protected`. The existing `rainPolicy` remains distinct: it describes whether the owner wants to wear the item in precipitation, not how much protection it provides. Labels never substitute for any structured layer or weather property.

Clearly understood new templates receive conservative defaults. During v4 migration, sweaters, hoodies, jackets, flannels, overshirts, coats, and custom applicable garments receive a review reason. Review is nonblocking. Non-applicable categories use canonical `layerRoles: []`, `rainProtection: "none"`, and `windProtection: "none"`. Physical bulk/fit compatibility and ordered multiple layers are not modeled in v1.5.

## Provider Adapter And Privacy

`context-engine.js` is provider-neutral outside its Open-Meteo adapter. It requests only current `temperature_2m`, `apparent_temperature`, `precipitation`, `rain`, `showers`, `snowfall`, `weather_code`, `wind_speed_10m`, and `is_day`. Provider weather codes are mapped once to `unknown`, `clear`, `cloudy`, `rain`, `snow`, or `wind`. Unknown codes and malformed numerical data fail safely.

Browser geolocation is requested only after `Use Current Location`. Automatic refresh occurs without a new prompt only when the user previously enabled it and permission is already granted. The app never calls `watchPosition`, tracks in the background, or stores latitude, longitude, accuracy, location history, raw provider payloads, or request URLs. Coordinates are rounded to two decimal places before a direct provider request. Requests use `cache: "no-store"`, omit credentials, send no referrer, time out, abort on disable, and deduplicate concurrent refreshes. Closet, history, garments, and identity are not sent.

The normalized cache contains temperature, apparent temperature, broad condition, precipitation components, wind, day/night, provider observation time, and fetch time only. The service worker ignores cross-origin traffic and coordinate-bearing URLs.

Open-Meteo's free endpoint is approved only while Fit Roulette remains noncommercial. Visible attribution is mandatory. Commercialization, subscriptions, advertising, promotional use, or materially different traffic requires provider/licensing review. Provider terms state that troubleshooting logs can contain coordinates for up to 90 days, which is disclosed before location use.

## Freshness And Effective Context

- Fresh: up to and including 60 minutes old; usable normally.
- Stale: older than 60 minutes and up to and including 6 hours; labeled and usable only after explicit awareness.
- Expired: older than 6 hours; displayed as expired and excluded from matching.

Manual refresh bypasses the 15-minute automatic attempt interval. Failed refresh retains the last valid normalized record. Offline and permission-failure flows retain full manual and weather-neutral generation.

Effective context is derived from exactly one reported source (`current` when fetched in this page session, fresh/stale `cached` after persistence or reload, or `manual`), then applies session-only warmer/colder, expected-rain, and indoor/outdoor adjustments. Ignore Weather returns a neutral scoring context. Adjustments never mutate the cached provider record.

The central warmth target is based on effective Celsius temperature, reduced for mostly indoors, and modestly increased for outdoor high wind. Wind protection affects scoring at 25 km/h or greater. Rain and snow use structured maximum rain protection across the outfit plus the retained rain wear policy. Context influences deterministic scoring; style, formality, occasion, availability, pair rules, preferences, exact bans, and history recency remain independent inputs.

## Single Optional Layer

The existing base outfit is generated first from a Base-eligible top and the occasion's other slots. If context indicates a meaningful warmth or protection need, the engine evaluates available applicable garments with `mid` or `outer` eligibility, regardless of whether their category is `Top` or `Layer`, while preserving occasion, pair-rule, preference, and recency behavior. This lets a sweater remain a Top while serving as a Mid layer. Complementary Base/Mid top pairs may use existing style pair rules; physical-fit rules remain deferred. The engine adds only the best compatible candidate. Warm conditions do not add a warmth-only layer. Failure to find a layer never blocks the base outfit.

The result records the automatic layer ID and context used. `Remove Layer` removes it in memory without creating a ban or relationship. Unrelated swaps operate on the visible layerless outfit and cannot restore it. Logging records only visible garments, so a removed layer receives no usage or recency credit. The compact history context records source, effective temperature/band, broad precipitation/wind, exposure, adjustments, and whether a suggested layer was removed—never coordinates or raw provider data. If one available layer cannot close the warmth gap, the result states that limitation instead of claiming adequate coverage.

## Verification And Deferred Scope

Deterministic tests use injected fetch, geolocation, clock, and permission interfaces. No automated test requires live weather or real location. The release suite covers migration ordering and failures, multiple protected originals, layer validation and persistence, provider normalization and failures, request cancellation/deduplication/rate limiting, freshness boundaries, context derivation, unit stability, single-layer generation/removal, belts, swaps, recency, history privacy, legacy occasions, static/PWA assets, and deployment identifiers.

Deferred to later releases: multiple simultaneous layers, ordered sequences, physical bulk compatibility, forecasts, alerts, background location, saved places, travel and packing, laundry/rewear rules, analytics, closet evaluation, expanded garment categories, cloud/accounts, telemetry, and commercial provider infrastructure.
