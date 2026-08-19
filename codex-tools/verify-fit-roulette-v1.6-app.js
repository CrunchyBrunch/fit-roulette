const assert = require("assert");
const fs = require("fs");
const path = require("path");

require("./verify-fit-roulette-v1.5.4-app.js");
require("./verify-fit-roulette-v1.6-insights.js");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const insights = fs.readFileSync(path.join(root, "insights.js"), "utf8");
const smart = fs.readFileSync(path.join(root, "smart-closet.js"), "utf8");

assert(app.includes('APP_VERSION = "1.6.0"'));
assert(app.includes("const Insights = window.FitRouletteInsights"));
assert(app.includes("readOnlyAnalysis(() => Insights.analyzeInsights"));
assert(app.includes("readOnlyAnalysis(() => Insights.analyzeCoverage"));
assert(app.includes("readOnlyAnalysis(() => Insights.evaluateCloset"));
assert(app.includes('throw new Error("Insights analysis mutated application state.")'));
assert(app.includes("insightsCoverageRunToken"), "Coverage must suppress stale results.");
assert(app.includes("insightsSourceFingerprint"), "Relevant state changes must invalidate transient results.");
assert(app.includes("insightsAnalysisDate"), "Date-sensitive results must invalidate on a local-date change.");
assert(app.includes('button.setAttribute("aria-current", "page")'));
assert(app.includes('button.removeAttribute("aria-current")'));
assert(app.includes("formatLongDate") && app.includes("Invalid saved date"));

for (const forbidden of ["localStorage", "document", "fetch(", "XMLHttpRequest", "Math.random", "navigator", "geolocation"]) {
  assert(!insights.includes(forbidden), `Pure Insights module must not use ${forbidden}.`);
}
assert(insights.includes("const COVERAGE_TUPLE_LIMIT = 50000"));
assert(insights.includes("resolveHistoricalItem"));
assert(insights.includes("uniqueItemIds"));
assert(insights.includes("At least ${validCount} valid combination"));
assert(insights.includes("Analysis capped for performance."));
assert(insights.includes("Current coverage appears sufficient for the selected needs."));
assert(smart.includes("date: savedDate"), "History normalization must preserve saved invalid/future dates for analysis.");

console.log(JSON.stringify({
  ok: true,
  appVersion: "1.6.0",
  schemaVersion: 5,
  pureAnalysis: true,
  stateEquivalenceGuard: true,
  coverageCap: 50000
}));
