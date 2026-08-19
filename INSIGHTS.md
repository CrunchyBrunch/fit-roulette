# Closet Insights Foundation

Fit Roulette v1.6.0 adds a local-only, read-only analytical boundary without changing schema 5, storage keys, import/export shape, recovery behavior, matching, or generation. `insights.js` contains deterministic pure functions; `app.js` owns transient controls and accessible rendering. Derived results are never persisted.

## Evidence and provenance

Every result is classified as one of four evidence types:

- **Current inventory:** normalized garments as they exist now, with an explicit All current garments or Currently Available denominator.
- **Logged history:** normalized history records only. Generated, viewed, rerolled, swapped, or suggested outfits receive no logged-use credit unless a history record exists.
- **Metadata:** review readiness, legacy fallback, unresolved imports, saved field completeness, and reference health. Missing metadata is not a wardrobe deficiency.
- **Compatibility:** a deterministic analysis of current inventory under explicit occasion, context, and optional Build Around assumptions. Compatibility is not proof of physical fit, user preference, or wardrobe need.

Historical item metadata is snapshot-first. A usable `itemSnapshots` entry wins over the current garment even after rename, recategorization, recoloring, formality edits, archive, or deletion. Current live metadata is used only when no usable snapshot exists. If neither source is available, the history occurrence remains logged evidence while its metadata is unresolved. Duplicate item IDs in one malformed record are counted once for garment use and co-appearance.

Legacy history records without an explicit manual source normalize as generated, so source cards disclose that older generated counts may contain that fallback. Context is counted only when a stored coordinate-free context snapshot exists. Ignored context is separate, and weather is never inferred for a manual log without context.

## Date contract

`normalizeHistoryDate` is the centralized analytical date parser. It does not rewrite a stored value.

- A timezone-less `YYYY-MM-DD` value is interpreted at local noon.
- Manual local-noon date-times retain their local analytical day.
- Generated UTC timestamps use the browser's local display day, matching History presentation.
- Invalid dates remain logged evidence but are excluded from time calculations and reported as invalid.
- Future dates remain logged evidence but are excluded from time calculations and reported as future.
- Multiple records on one local analytical date are multiple logged outfits and one logged day.
- A blank day means no outfit was logged; it does not prove that no outfit was used.

The selected Logged Activity range is session-only and defaults to All logged history. Last 30 days includes today and the previous 29 local calendar dates; Last 90 days includes today and the previous 89. Composition and Current Coverage do not use the history range.

## Metric contracts

| Metric | Numerator | Denominator and exclusions |
| --- | --- | --- |
| Logged outfits | Normalized history records with usable, nonfuture dates inside the selected range | No closet denominator; manual/generated, partial, imported, and same-day duplicates are included |
| Logged days | Distinct local analytical dates represented by selected records | Invalid and future dates excluded |
| Garment logged use | Selected history records containing the unique garment ID | One appearance maximum per record; wording is “Appears in N logged outfits” |
| Last logged use | Latest usable selected date containing the garment ID | Recomputed from history; current `lastWorn` cannot override it |
| Days since last logged use | Local epoch-day difference between today and last logged use | Future logs excluded; no time-of-day arithmetic |
| Highest/lowest logged counts | Logged-use counts for Currently Available garments | Ties retained; zero uses “No logged appearances in this range,” never “never worn” |
| Exact repetition | Repeated canonical sets of unique item IDs | Each history record remains a separate logged occurrence |
| Co-appearance | Each unordered pair present in a selected record | At most once per pair per record; not preference or compatibility proof |
| Occasion distribution | Saved normalized history occasion | Occasion is never inferred from garments; legacy Gym / Errands stays labeled |
| Source distribution | `manual` versus normalized `generated` | Includes legacy-source caveat |
| Category appearances | Snapshot-first category for each logged item occurrence | Unresolved categories separate; counts are garment appearances, not outfits |
| Layer/belt/sock activity | Logged records actually containing those categories | Removed or originally suggested items are not reconstructed |
| Context coverage | Selected records with stored context snapshots | Ignored context separate; no inferred historical weather |
| Current utilization | Currently Available garment IDs appearing in selected logged history | All Currently Available garments, including needs-review, form the denominator; unavailable/archived excluded |

Garment-level `lastWorn` is exposed only as labeled lower-confidence legacy recency when selected history contains no corresponding record. It never replaces history-derived evidence.

## Composition contract

Composition describes current normalized state by status, review readiness, category, subtype, exact saved primary color, applicable exact saved secondary color, pattern, formality, occasion, layer role, warmth, rain/wind protection, item preference, and pair-rule count. Each breakdown names its denominator.

Canonical colors may retain existing visual treatment, but every count is textual. Custom colors remain exact saved strings. A family view groups them only as `Custom / Unclassified`; it never invents a canonical family. Empty categories, unequal counts, metadata gaps, or a small wardrobe are not labeled deficiencies.

## Current Coverage contract

Coverage runs only after explicit user action. Inputs are occasion, a local preset context assumption, and an optional eligible Build Around garment. No location or provider request is made.

The analysis uses currently available and occasion-eligible garments, base-top role eligibility, released semantic compatibility, Prefer Together/Never Pair records, exact bans, belt policy, footwear/sock reconciliation, the single optional-layer model, explicit context, and Build Around eligibility. Item preference affects generator ranking but is not a hard validity rule. Physical layer bulk, ordered multilayer fit, laundry state, and subjective fit are not modeled.

Candidate tuples are visited in stable ID order. The hard budget is 50,000 tuples per run:

- At or below the budget, the result is exact.
- Above the budget, enumeration stops deterministically.
- The result says `At least N valid combinations` and `Analysis capped for performance`.
- No extrapolation, random sampling, or generator attempt/pool cap is presented as a total.
- For an exact run, Build Around bottlenecks mean zero, one, or two valid combinations under the selected assumptions. Per-garment zero/few classifications are omitted after a capped run because they would not be authoritative.

The UI yields before synchronous bounded analysis, uses a run token to suppress stale results after options change, and invalidates results when wardrobe, history, rules, bans, unresolved records, or the local date changes. Results stay in memory only.

## Closet Evaluation contract

Closet Evaluation is a user-initiated concise report composed from the same readiness, composition, activity, and optional coverage outputs. It may describe review readiness, formality range, saved weather properties, logged utilization, and selected compatibility evidence.

It has no overall grade, numeric score, user ranking, gender/lifestyle/occupation/income inference, purchasing pressure, or automatic effect on generation. A wider range, larger closet, or greater variety is not treated as inherently better. When exact selected coverage is nonzero with required slots represented, it may conclude: `Current coverage appears sufficient for the selected needs.`

## Read-only and privacy guarantees

Analysis functions do not access the DOM, browser storage, provider clients, network APIs, randomness, or service workers. The application compares serialized state before and after every analysis in development and test paths. Automated and rendered tests compare the `fitRoulette.v1` byte string and recovery-key inventory before and after opening Insights, changing ranges, running coverage, running Closet Evaluation, navigating away, and reloading.

Insights does not change settings, timestamps, review state, pair rules, bans, generated outfit state, reroll state, or recency. It does not request location, call Open-Meteo, send telemetry, or transmit closet/history data. Ordinary service-worker application-asset behavior remains unchanged.

## Empty and limited evidence

Empty, no-history, sparse, all-archived, broken-reference, custom-color, context-free, and capped states state what is present and what cannot be concluded. There is no opaque accuracy percentage. Nearby language includes sample sizes and limitations such as:

- `Based on 24 logged outfits across 18 logged days.`
- `Some metadata is incomplete.`
- `Weather context is available for 8 of 16 logs.`
- `Some older records may have been normalized as generated.`
- `Not logged in this range.`

The release does not implement an outfit-history calendar, neglect/review ranking, Clothing Personality, historical Why This Fit reconstruction, individual banned-outfit review, post-wear feedback, shopping recommendations, donation guidance, persisted analytics/preferences, a canonical stored history date, schema 6, physical multilayer compatibility, suggestion/reroll telemetry, or analytics-driven generation.
