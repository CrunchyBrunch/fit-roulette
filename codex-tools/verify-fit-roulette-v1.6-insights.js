const assert = require("assert");
const SmartCloset = require("../smart-closet.js");
const Insights = require("../insights.js");

const NOW = new Date("2026-08-19T12:00:00-04:00");
const CASUAL = {
  id: "casual",
  label: "Casual",
  slots: [
    { key: "top", label: "Top", categories: ["top"] },
    { key: "bottom", label: "Bottom", categories: ["bottom"] },
    { key: "shoes", label: "Shoes", categories: ["shoes"] }
  ]
};
const WORK = {
  id: "work",
  label: "Work / Office",
  slots: [
    { key: "top", label: "Top", categories: ["top"] },
    { key: "bottom", label: "Bottom", categories: ["bottom"] },
    { key: "shoes", label: "Shoes", categories: ["shoes"] },
    { key: "belt", label: "Belt", categories: ["belt"] }
  ]
};

function state(items = [], history = []) {
  return {
    ...SmartCloset.createFreshState(NOW.toISOString()),
    wardrobe: items,
    history,
    bannedCombos: [],
    pairRelationships: [],
    unresolvedRecords: {}
  };
}

function item(id, category, extra = {}) {
  const defaults = {
    top: { subtype: "t-shirt", layerRoles: ["base"], sleeveLength: "short", bottomLength: "not_applicable", rainProtection: "none", windProtection: "none" },
    bottom: { subtype: "chinos", layerRoles: [], sleeveLength: "not_applicable", bottomLength: "full", beltMode: "none", rainProtection: "none", windProtection: "none" },
    shoes: { subtype: "sandals", layerRoles: [], sleeveLength: "not_applicable", bottomLength: "not_applicable", rainProtection: "none", windProtection: "none" },
    layer: { subtype: "jacket", layerRoles: ["outer"], sleeveLength: "long", bottomLength: "not_applicable", rainProtection: "light", windProtection: "light" },
    belt: { subtype: "casual belt", layerRoles: [], sleeveLength: "not_applicable", bottomLength: "not_applicable", rainProtection: "none", windProtection: "none" },
    socks: { subtype: "casual socks", layerRoles: [], sleeveLength: "not_applicable", bottomLength: "not_applicable", rainProtection: "none", windProtection: "none" },
    accessory: { subtype: "other", layerRoles: [], sleeveLength: "not_applicable", bottomLength: "not_applicable", rainProtection: "none", windProtection: "none" }
  }[category];
  return SmartCloset.createItem({
    id,
    name: extra.name || id,
    category,
    primaryColor: "navy",
    pattern: "solid",
    formality: 2,
    occasions: ["casual", "work"],
    warmth: "light",
    rainPolicy: "okay",
    status: "available",
    preference: "neutral",
    ...defaults,
    ...extra
  }, { now: NOW.toISOString() });
}

function log(id, date, itemIds, extra = {}) {
  return {
    id,
    date,
    occasion: "casual",
    itemIds,
    itemSnapshots: [],
    source: "generated",
    note: "",
    context: null,
    ...extra
  };
}

function baseCloset() {
  return [item("top", "top"), item("bottom", "bottom"), item("shoes", "shoes")];
}

function deepFreeze(value, seen = new Set()) {
  if (!value || typeof value !== "object" || seen.has(value)) return value;
  seen.add(value);
  Object.freeze(value);
  Object.values(value).forEach((child) => deepFreeze(child, seen));
  return value;
}

const fixtures = {};

fixtures.empty = state();
fixtures.completeNoHistory = state(baseCloset());
fixtures.oneLogged = state(baseCloset(), [log("one", "2026-08-18T12:00:00", ["top", "bottom", "shoes"])]);
fixtures.sparse = state(baseCloset(), [log("old", "2025-02-01T12:00:00", ["top", "bottom", "shoes"])]);
fixtures.generated = state(baseCloset(), Array.from({ length: 40 }, (_, index) => log(`g${index}`, `2026-07-${String((index % 20) + 1).padStart(2, "0")}T12:00:00`, ["top", "bottom", "shoes"])));
fixtures.manual = state(baseCloset(), [
  log("m1", "2026-08-18T12:00:00", ["top"], { source: "manual" }),
  log("m2", "2026-08-17T12:00:00", ["bottom"], { source: "manual" }),
  log("g1", "2026-08-16T12:00:00", ["shoes"])
]);
fixtures.mixedProvenance = state(baseCloset(), [
  log("legacy", "2024-01-01T12:00:00", ["top"], { source: undefined }),
  log("current", "2026-08-18T12:00:00", ["bottom"], { source: "manual" })
]);
fixtures.mixedContext = state(baseCloset(), [
  log("pre", "2024-01-01T12:00:00", ["top"], { source: "manual" }),
  log("post", "2026-08-18T12:00:00", ["top"], { context: { source: "manual", temperatureC: 10, condition: "rain" } }),
  log("ignored", "2026-08-17T12:00:00", ["bottom"], { context: { source: "ignored" } })
]);
fixtures.seasonal = state([...baseCloset(), item("winter_coat", "layer", { warmth: "very_warm", occasions: ["work"] })]);
fixtures.minimalistCovered = state(baseCloset());
fixtures.poorCompatibility = state([
  item("bottom", "bottom"),
  item("shoes", "shoes"),
  ...Array.from({ length: 25 }, (_, index) => item(`poor_top_${String(index).padStart(2, "0")}`, "top"))
]);
fixtures.poorCompatibility.pairRelationships = fixtures.poorCompatibility.wardrobe
  .filter((entry) => entry.category === "top")
  .map((entry, index) => ({ id: `poor_never_${index}`, type: "never", itemIds: ["bottom", entry.id].sort(), createdAt: NOW.toISOString(), updatedAt: NOW.toISOString() }));
fixtures.pairHeavy = state([
  item("top", "top"),
  item("shoes", "shoes"),
  ...Array.from({ length: 21 }, (_, index) => item(`pair_bottom_${String(index).padStart(2, "0")}`, "bottom"))
]);
fixtures.pairHeavy.pairRelationships = fixtures.pairHeavy.wardrobe
  .filter((entry) => entry.category === "bottom")
  .map((entry, index) => ({ id: `pair_${index}`, type: index === 0 ? "never" : "prefer", itemIds: [entry.id, "top"].sort(), createdAt: NOW.toISOString(), updatedAt: NOW.toISOString() }));
fixtures.banned = state(baseCloset());
fixtures.banned.bannedCombos = [{ id: "ban", itemIds: ["bottom", "shoes", "top"], createdAt: NOW.toISOString() }];
fixtures.inactiveHeavy = state([
  item("active", "top"),
  ...Array.from({ length: 20 }, (_, index) => item(`unavailable_${index}`, "bottom", { status: "unavailable" })),
  ...Array.from({ length: 20 }, (_, index) => item(`archived_${index}`, "shoes", { status: "archived" }))
]);
fixtures.customColors = state(Array.from({ length: 250 }, (_, index) => item(`custom_${String(index).padStart(3, "0")}`, "top", {
  primaryColor: index === 0 ? "Moonlit Aubergine" : `Custom Shade ${String(index).padStart(3, "0")}`,
  pattern: "striped",
  secondaryColor: index === 0 ? "Grandma's Teal" : `Custom Accent ${String(index).padStart(3, "0")}`
})));
fixtures.sameDate = state(baseCloset(), [
  log("am", "2026-08-18T08:00:00-04:00", ["top"]),
  log("pm", "2026-08-18T19:00:00-04:00", ["bottom"])
]);
fixtures.badDates = state(baseCloset(), [
  log("future", "2027-01-01T12:00:00", ["top"]),
  log("invalid", "not-a-date", ["bottom"]),
  log("blank", "", ["top"]),
  log("valid", "2026-08-18T12:00:00", ["shoes"])
]);
fixtures.snapshotRename = state([
  item("changed", "bottom", { name: "Current Chinos", primaryColor: "red", formality: 5 })
], [
  log("snapshot", "2026-08-18T12:00:00", ["changed", "changed"], {
    itemSnapshots: [{ id: "changed", name: "Old Navy Tee", category: "top", subtype: "t-shirt", primaryColor: "navy", formality: 2, occasions: ["casual"], pattern: "solid" }]
  })
]);
fixtures.broken = state([], [
  log("deleted-snapshot", "2026-08-18T12:00:00", ["deleted"], { itemSnapshots: [{ id: "deleted", name: "Saved Jacket", category: "layer" }] }),
  log("broken", "2026-08-17T12:00:00", ["missing"]),
  log("partial", "2026-08-16T12:00:00", ["partial"], { itemSnapshots: [{ id: "partial", name: "Partial Snapshot" }] })
]);
fixtures.multiYear = state(baseCloset(), [
  ...Array.from({ length: 1500 }, (_, index) => log(`long_${index}`, new Date(Date.UTC(2022, 0, 1 + index, 16)).toISOString(), [index % 2 ? "top" : "bottom"])),
  log("recent", "2026-08-18T12:00:00", ["shoes"])
]);
fixtures.noContext = state(baseCloset(), [log("manual", "2026-08-18T12:00:00", ["top"], { source: "manual" })]);
fixtures.contextRich = state(baseCloset(), [
  log("c1", "2026-08-18T12:00:00", ["top"], { context: { source: "current", temperatureC: 20, condition: "clear" } }),
  log("c2", "2026-08-17T12:00:00", ["bottom"], { context: { source: "cached", temperatureC: 18, condition: "cloudy" } })
]);
fixtures.sufficient = state(baseCloset(), [log("s1", "2026-08-18T12:00:00", ["top", "bottom", "shoes"])]);
fixtures.capped = state([
  ...Array.from({ length: 38 }, (_, index) => item(`t${String(index).padStart(2, "0")}`, "top")),
  ...Array.from({ length: 38 }, (_, index) => item(`b${String(index).padStart(2, "0")}`, "bottom")),
  ...Array.from({ length: 38 }, (_, index) => item(`s${String(index).padStart(2, "0")}`, "shoes"))
]);

assert.equal(Object.keys(fixtures).length, 24, "The deterministic analytical fixture inventory must remain complete.");

const empty = Insights.analyzeInsights(fixtures.empty, { now: NOW });
assert.equal(empty.readiness.currentCloset.total, 0);
assert.equal(empty.activity.totalLoggedOutfits, 0);
assert(empty.readiness.history.evidenceText.includes("No logged outfits"));

const complete = Insights.analyzeInsights(fixtures.completeNoHistory, { now: NOW });
assert.equal(complete.composition.category.length, 3);
assert.equal(complete.activity.currentUtilization.denominator, 3);

const one = Insights.analyzeLoggedActivity(fixtures.oneLogged, { now: NOW, range: "all" });
assert.equal(one.totalLoggedOutfits, 1);
assert.equal(one.loggedDays, 1);
assert.equal(one.garmentActivity.find((entry) => entry.id === "top").count, 1);
assert.equal(one.garmentActivity.find((entry) => entry.id === "top").daysSinceLastLogged, 1);

assert.equal(Insights.analyzeLoggedActivity(fixtures.sparse, { now: NOW, range: "30" }).totalLoggedOutfits, 0);
assert.equal(Insights.analyzeLoggedActivity(fixtures.generated, { now: NOW, range: "all" }).source.find((row) => row.key === "generated").count, 40);
assert.equal(Insights.analyzeLoggedActivity(fixtures.manual, { now: NOW }).source.find((row) => row.key === "manual").count, 2);
assert(Insights.analyzeDataReadiness(fixtures.mixedProvenance, { now: NOW }).history.legacySourceCaveat);

const mixedContext = Insights.analyzeDataReadiness(fixtures.mixedContext, { now: NOW }).history;
assert.equal(mixedContext.contextLogs, 2);
assert.equal(mixedContext.ignoredContextLogs, 1);
assert.equal(mixedContext.manualWithoutContext, 1);

assert.equal(Insights.analyzeComposition(fixtures.seasonal).warmth.find((row) => row.key === "very_warm").count, 1);
const minimalistCoverage = Insights.analyzeCoverage(fixtures.minimalistCovered, { occasion: CASUAL });
assert.equal(minimalistCoverage.validCount, 1);
assert.equal(minimalistCoverage.capped, false);
const weatherCloset = state([...baseCloset(), item("context_layer", "layer", { occasions: ["casual"], warmth: "very_warm" })]);
assert.equal(Insights.analyzeCoverage(weatherCloset, { occasion: CASUAL, context: Insights.coverageContextPreset("neutral") }).validCount, 1);
assert.equal(Insights.analyzeCoverage(weatherCloset, { occasion: CASUAL, context: Insights.coverageContextPreset("cold") }).validCount, 2);
assert.equal(Insights.analyzeCoverage(weatherCloset, { occasion: CASUAL, context: Insights.coverageContextPreset("rain") }).validCount, 2);
assert.equal(Insights.analyzeCoverage(weatherCloset, { occasion: CASUAL, context: Insights.coverageContextPreset("hot") }).validCount, 1);
assert.equal(Insights.analyzeCoverage(weatherCloset, { occasion: CASUAL, buildAroundId: "context_layer" }).validCount, 1);
const reconciledCloset = state([
  item("work_top", "top", { occasions: ["work"], formality: 4 }),
  item("work_bottom", "bottom", { occasions: ["work"], formality: 4, beltMode: "required" }),
  item("work_shoes", "shoes", { occasions: ["work"], formality: 4, subtype: "dress shoes" }),
  item("work_belt", "belt", { occasions: ["work"], formality: 4 }),
  item("work_socks_a", "socks", { occasions: ["work"], formality: 4, subtype: "dress socks" }),
  item("work_socks_b", "socks", { occasions: ["work"], formality: 4, subtype: "dress socks" })
]);
assert.equal(Insights.analyzeCoverage(reconciledCloset, { occasion: WORK }).validCount, 2);
const missingSocks = state(reconciledCloset.wardrobe.filter((entry) => entry.category !== "socks"));
const missingSockCoverage = Insights.analyzeCoverage(missingSocks, { occasion: WORK });
assert.equal(missingSockCoverage.validCount, 1, "Released generation remains usable when no compatible socks are available.");
assert.equal(missingSockCoverage.incompleteSockCandidates, 1);

assert.equal(Insights.analyzeCoverage(fixtures.poorCompatibility, { occasion: CASUAL }).validCount, 0);
assert.equal(Insights.analyzeComposition(fixtures.pairHeavy).pairRules.total, 21);
assert.equal(Insights.analyzeCoverage(fixtures.pairHeavy, { occasion: CASUAL }).validCount, 20);
assert.equal(Insights.analyzeCoverage(fixtures.banned, { occasion: CASUAL }).validCount, 0);

const inactive = Insights.analyzeDataReadiness(fixtures.inactiveHeavy).currentCloset;
assert.deepEqual([inactive.available, inactive.unavailable, inactive.archived], [1, 20, 20]);
const compositionPerformanceStarted = process.hrtime.bigint();
const custom = Insights.analyzeComposition(fixtures.customColors);
const compositionPerformanceMs = Number(process.hrtime.bigint() - compositionPerformanceStarted) / 1e6;
assert(custom.primaryColor.some((row) => row.label === "Moonlit Aubergine"));
assert.equal(custom.colorFamily.find((row) => row.label === "Custom / Unclassified").count, 250);

const sameDate = Insights.analyzeLoggedActivity(fixtures.sameDate, { now: NOW });
assert.equal(sameDate.totalLoggedOutfits, 2);
assert.equal(sameDate.loggedDays, 1);

const badDates = Insights.analyzeLoggedActivity(fixtures.badDates, { now: NOW });
assert.equal(badDates.totalLoggedOutfits, 1);
assert.deepEqual(badDates.excludedDateRecords, { invalid: 2, future: 1 });
const migratedBadDates = SmartCloset.migrateAndValidate(fixtures.badDates, { now: NOW.toISOString() }).state.history;
const migratedBadDate = migratedBadDates.find((record) => record.id === "invalid");
assert.equal(migratedBadDate.date, "not-a-date", "Schema-5 normalization must preserve an invalid saved date for reporting.");
assert.equal(migratedBadDates.find((record) => record.id === "blank").date, "", "Schema-5 normalization must preserve a blank saved date for reporting.");

const snapshot = Insights.analyzeLoggedActivity(fixtures.snapshotRename, { now: NOW });
assert.equal(snapshot.categoryUse.find((row) => row.key === "top").count, 1);
assert.equal(snapshot.categoryUse.some((row) => row.key === "bottom"), false);
assert.equal(snapshot.garmentActivity[0].count, 1, "Duplicate IDs in one malformed log must count once.");
const broken = Insights.analyzeDataReadiness(fixtures.broken, { now: NOW }).history;
assert.equal(broken.brokenReferenceCount, 1);
assert.equal(broken.logsWithUsableSnapshots, 2);

const historyPerformanceStarted = process.hrtime.bigint();
const multiAll = Insights.analyzeLoggedActivity(fixtures.multiYear, { now: NOW, range: "all" });
const historyPerformanceMs = Number(process.hrtime.bigint() - historyPerformanceStarted) / 1e6;
const multi90 = Insights.analyzeLoggedActivity(fixtures.multiYear, { now: NOW, range: "90" });
assert.equal(multiAll.totalLoggedOutfits, 1501);
assert.equal(multi90.totalLoggedOutfits, 1);
assert.equal(Insights.analyzeDataReadiness(fixtures.noContext).history.contextLogs, 0);
assert.equal(Insights.analyzeDataReadiness(fixtures.contextRich).history.contextLogs, 2);

const sufficientCoverage = Insights.analyzeCoverage(fixtures.sufficient, { occasion: CASUAL });
const evaluation = Insights.evaluateCloset(fixtures.sufficient, { now: NOW, coverage: sufficientCoverage });
assert.equal(evaluation.conclusion, "Current coverage appears sufficient for the selected needs.");

const performanceStarted = process.hrtime.bigint();
const capped = Insights.analyzeCoverage(fixtures.capped, { occasion: CASUAL });
const performanceMs = Number(process.hrtime.bigint() - performanceStarted) / 1e6;
assert.equal(capped.capped, true);
assert.equal(capped.attemptedTuples, 50000);
assert(capped.countText.startsWith("At least "));
assert.equal(capped.capText, "Analysis capped for performance.");
const cappedAgain = Insights.analyzeCoverage(fixtures.capped, { occasion: CASUAL });
assert.deepEqual(cappedAgain, capped, "Capped analysis must be deterministic.");

const immutable = deepFreeze(structuredClone(fixtures.contextRich));
const serializedBefore = JSON.stringify(immutable);
Insights.analyzeInsights(immutable, { now: NOW, range: "all" });
Insights.analyzeCoverage(immutable, { occasion: CASUAL });
Insights.evaluateCloset(immutable, { now: NOW, coverage: sufficientCoverage });
assert.equal(JSON.stringify(immutable), serializedBefore, "Analysis must not mutate deep-frozen input state.");

const dateOnly = Insights.normalizeHistoryDate("2026-08-19", NOW);
const generatedUtc = Insights.normalizeHistoryDate("2026-08-19T01:00:00.000Z", NOW);
assert.equal(dateOnly.dateKey, "2026-08-19");
assert.equal(generatedUtc.dateKey, `${new Date("2026-08-19T01:00:00.000Z").getFullYear()}-${String(new Date("2026-08-19T01:00:00.000Z").getMonth() + 1).padStart(2, "0")}-${String(new Date("2026-08-19T01:00:00.000Z").getDate()).padStart(2, "0")}`);

const allLanguage = JSON.stringify(Object.values(fixtures).map((fixture) => Insights.analyzeInsights(fixture, { now: NOW }))).toLowerCase();
for (const unsafe of ["never worn", "neglected", "donate", "bad purchase", "you need to buy", "your closet score", "accuracy percentage"]) {
  assert(!allLanguage.includes(unsafe), `Unsafe analytical language found: ${unsafe}`);
}

console.log(JSON.stringify({
  ok: true,
  analysisVersion: Insights.ANALYSIS_VERSION,
  fixtures: Object.keys(fixtures).length,
  deterministicCap: capped.attemptedTuples,
  cappedValidLowerBound: capped.validCount,
  representativeCompositionTimingMs: Math.round(compositionPerformanceMs * 10) / 10,
  representativeHistoryTimingMs: Math.round(historyPerformanceMs * 10) / 10,
  representativeCapTimingMs: Math.round(performanceMs * 10) / 10,
  stateMutation: false,
  schemaVersion: SmartCloset.SCHEMA_VERSION
}));
