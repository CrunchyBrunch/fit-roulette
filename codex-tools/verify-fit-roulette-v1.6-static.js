const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

require("./verify-fit-roulette-v1.5.4-static.js");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const html = read("index.html");
const css = read("styles.css");
const app = read("app.js");
const insights = read("insights.js");
const sw = read("sw.js");

new vm.Script(insights, { filename: "insights.js" });

for (const id of [
  "screen-insights", "insightsTitle", "insightsHero", "insightsVisuals", "insightsReadiness", "insightsCompositionScope",
  "insightsComposition", "insightsRangeSelect", "insightsActivity", "insightsCoverageOccasion",
  "insightsCoverageContext", "insightsCoverageBuildAround", "runCoverageBtn", "coverageStatus",
  "insightsCoverage", "runEvaluationBtn", "evaluationStatus", "insightsEvaluation"
]) assert(html.includes(`id="${id}"`), `Missing Insights UI target: ${id}`);

const tabs = [...html.matchAll(/class="tab-button[^\"]*"[^>]*data-screen="([^"]+)"/g)].map((match) => match[1]);
assert.deepEqual(tabs, ["generate", "closet", "history", "insights", "settings"]);
assert(html.includes('data-screen="generate" aria-current="page"'));
assert(html.includes("Data Readiness"));
assert(html.includes("Closet Composition"));
assert(html.includes("Logged Activity"));
assert(html.includes("Current Coverage"));
assert(html.includes("Closet Evaluation"));
assert(html.includes("Your closet right now"));
assert.equal((html.match(/class="insights-disclosure insights-group"/g) || []).length, 3);
assert(html.includes('option value="all" selected>All logged history'));
assert(html.includes('role="status" aria-live="polite" aria-atomic="true"'));

assert(html.indexOf('src="./smart-closet.js?v=1.6.1"') < html.indexOf('src="./insights.js?v=1.6.1"'));
assert(html.indexOf('src="./insights.js?v=1.6.1"') < html.indexOf('src="./app.js?v=1.6.1"'));
assert(sw.includes('"./insights.js"'));
assert(sw.includes('CACHE_NAME = "fit-roulette-v1.6.1"'));

assert(css.includes("grid-template-columns: repeat(5, minmax(0, 1fr))"));
assert(css.includes(".insights-card-grid"));
assert(css.includes(".insight-breakdown"));
assert(css.includes(".insights-hero-grid"));
assert(css.includes(".insight-visual-track"));
assert(css.includes(".insights-card-details"));
assert(css.includes("overflow-wrap: anywhere"));
assert(css.includes("@media (max-width: 359px)"));
assert(css.includes("@media (forced-colors: active)"));
assert(css.includes(".tab-button.is-active"));
assert(css.includes("min-height: 46px"));
const forcedColorsBlock = css.match(/@media \(forced-colors: active\) \{([\s\S]*?)\n\}/)?.[1] || "";
assert(forcedColorsBlock.includes(".tab-button.is-active"), "Active navigation forced-color boundary escaped its media query.");
assert(forcedColorsBlock.includes(".evaluation-conclusion"), "Evaluation forced-color boundary escaped its media query.");
assert(forcedColorsBlock.includes(".insight-visual-track > span"), "Visual summaries need a forced-color boundary.");

assert(html.indexOf('id="weatherSettingsPanel"') > html.indexOf('id="screen-settings"'), "Persistent weather setup must live in Data.");
assert(html.indexOf('id="weatherSettingsPanel"') < html.indexOf('id="useCurrentLocationBtn"'), "Automatic Weather actions must remain inside the Data panel.");
assert(html.indexOf('id="contextMode"') < html.indexOf('id="screen-closet"'), "Transient generation context must remain on Generate.");
assert(html.includes('id="weatherGenerateStatus"'));
assert(html.includes('id="manageWeatherBtn"'));
assert(html.includes('class="color-state-control" aria-hidden="true" tabindex="-1"'), "Native color state controls must not create duplicate visible or accessibility controls.");
assert(html.includes('class="color-choice-grid" role="group"'));
assert(app.includes('data-color="${CUSTOM_COLOR_VALUE}"'), "Custom color must remain available through the visible chip interaction.");
assert(app.includes("renderClosetVisual(item)"));
assert(css.includes(".closet-category-icon"));
assert(css.includes("#manualLogDate"));
assert(css.includes("min-inline-size: 0"));
assert(html.includes("Fit Roulette cannot rotate, rename, or delete files already downloaded to your computer."));
assert(!html.includes("whole-day forecast"));
assert(!app.includes("hourly="));

for (const unsafe of ["Never worn", "Neglected", "Donate", "Bad purchase", "You need to buy", "Your closet score", "Clothing Personality", "Why This Fit?"]) {
  assert(!html.includes(unsafe), `Deferred or unsafe Insights language found in UI: ${unsafe}`);
}
assert(!app.includes("insightsCoverageResult = appState"), "Derived coverage must not enter product state.");
assert(!app.includes("appState.insights"), "Derived analytics must not enter schema state.");
assert(!insights.includes("fitRoulette.v1"), "Pure analysis must not know the storage key.");

console.log(JSON.stringify({
  ok: true,
  appVersion: "1.6.1",
  topLevelSections: tabs.length,
  schemaVersion: 5,
  cacheName: "fit-roulette-v1.6.1",
  renderedStatusRegions: 2
}));
