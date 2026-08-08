const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("assert");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const html = read("index.html");
const css = read("styles.css");
const app = read("app.js");
const smart = read("smart-closet.js");
const sw = read("sw.js");

new vm.Script(app, { filename: "app.js" });
new vm.Script(smart, { filename: "smart-closet.js" });
new vm.Script(sw, { filename: "sw.js" });

assert(html.indexOf('src="./smart-closet.js?v=1.4.1"') < html.indexOf('src="./app.js?v=1.4.1"'), "Smart Closet data module must load before the app.");
assert(html.indexOf('navigator.serviceWorker.register("./sw.js?v=1.4.1"') < html.indexOf('src="./smart-closet.js?v=1.4.1"'), "Versioned service-worker update bootstrap must run before cached application bundles.");
for (const id of [
  "freshSetup", "reviewQueue", "itemSubtype", "itemPattern", "itemFormality", "itemStatus", "itemPreference",
  "itemSleeveLength", "itemBottomLength", "itemWarmth", "itemRainPolicy", "preferItemsSelect", "neverItemsSelect",
  "itemLabels", "addSimilarBtn", "todayLoggedNotice", "swapSummary", "dataSafetyNotice"
]) {
  assert(html.includes(`id="${id}"`), `Missing Smart Closet UI control: ${id}`);
}

assert(!html.includes("Raw tags"), "Raw Tags must be renamed to Labels.");
assert(!html.includes("Copy Matching Rules"), "Copy Matching Rules must be replaced by Add Similar.");
assert(!html.includes(">Duplicate<"), "Duplicate must be replaced by Add Similar.");
assert(!html.includes('type="range"'), "The 1–10 formality slider must be removed.");
assert(html.includes("Labels are only for search and organization"));
assert(html.includes("Every chip") === false, "Implementation requirements should not leak into UI copy.");

assert(smart.includes("const SCHEMA_VERSION = 4"));
assert(smart.includes('RECOVERY_KEY = "fitRoulette.v1.recovery.schema4"'));
assert(app.includes('STORAGE_KEY = "fitRoulette.v1"'));
assert(app.includes('APP_VERSION = "1.4.1"'), "Visible release version must be 1.4.1.");
assert(sw.includes('CACHE_NAME = "fit-roulette-v1.4.1"'), "Final service-worker cache must match the 1.4.1 release.");
assert(app.includes("SmartCloset.semanticCompatibility"), "Generator must use centralized semantic compatibility.");
assert(app.includes("appState.pairRelationships"), "Top-level pair relationships are not integrated.");
assert(app.includes("legacyFallback: false"), "Per-item legacy retirement is not implemented.");
assert(app.includes("history: appState.history.map"), "History changes must invalidate candidate context.");
assert(!app.includes("choices.slice(0, 8)"), "Swap must not truncate eligible replacements.");
for (const brand of ["Ralph Lauren", "Levi's", "Converse", "New Balance", "Brooks", "Jordan"]) {
  assert(!app.includes(brand), `Sample data must stay generalized; found brand-specific text: ${brand}`);
}

assert(css.includes("@media (prefers-reduced-motion: reduce)"));
assert(css.includes("@media (min-width: 560px)"));
assert(css.includes("overflow-x"), "Responsive overflow protection is missing.");
assert(html.includes('<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">'));

for (const asset of ["index.html", "styles.css", "smart-closet.js", "app.js", "manifest.json", "sw.js"]) {
  assert(fs.existsSync(path.join(root, asset)), `Missing asset: ${asset}`);
}

console.log(JSON.stringify({
  ok: true,
  schemaVersion: 4,
  structuredControls: 18,
  appVersion: (app.match(/APP_VERSION = "([^"]+)"/) || [])[1]
}));
