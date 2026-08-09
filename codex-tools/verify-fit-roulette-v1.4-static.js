const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("assert");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const html = read("index.html");
const css = read("styles.css");
const app = read("app.js");
const contextEngine = read("context-engine.js");
const smart = read("smart-closet.js");
const sw = read("sw.js");

new vm.Script(app, { filename: "app.js" });
new vm.Script(contextEngine, { filename: "context-engine.js" });
new vm.Script(smart, { filename: "smart-closet.js" });
new vm.Script(sw, { filename: "sw.js" });

assert(html.indexOf('src="./context-engine.js?v=1.5.1"') < html.indexOf('src="./smart-closet.js?v=1.5.1"'), "Context Engine must load before Smart Closet.");
assert(html.indexOf('src="./smart-closet.js?v=1.5.1"') < html.indexOf('src="./app.js?v=1.5.1"'), "Smart Closet data module must load before the app.");
assert(html.indexOf('navigator.serviceWorker.register("./sw.js?v=1.5.1"') < html.indexOf('src="./context-engine.js?v=1.5.1"'), "Versioned service-worker update bootstrap must run before cached application bundles.");
for (const id of [
  "freshSetup", "reviewQueue", "itemSubtype", "itemPattern", "itemFormality", "itemStatus", "itemPreference",
  "itemSleeveLength", "itemBottomLength", "itemWarmth", "itemRainPolicy", "preferItemsSelect", "neverItemsSelect",
  "itemPrimaryColorCustom", "itemSecondaryColorCustom", "secondaryColorField", "preferItemsGroup", "neverItemsGroup",
  "preferItemsChoices", "neverItemsChoices", "preferItemsLegacy", "neverItemsLegacy",
  "itemLabels", "addSimilarBtn", "todayLoggedNotice", "swapSummary", "dataSafetyNotice",
  "preferDetails", "neverDetails", "preferItemsCount", "neverItemsCount", "saveAddSimilarBtn",
  "itemExitDialog", "saveItemExitBtn", "discardItemExitBtn", "continueItemExitBtn",
  "layerRoleFieldset", "itemRainProtection", "itemWindProtection", "useCurrentLocationBtn", "contextMode",
  "manualTemperature", "manualCondition", "temperatureUnit", "feelsAdjustment", "contextExposure", "expectRain",
  "ignoreWeather", "acceptStaleWeather", "weatherStatus", "recoveryDownloads"
]) {
  assert(html.includes(`id="${id}"`), `Missing Smart Closet UI control: ${id}`);
}

assert(!html.includes("Raw tags"), "Raw Tags must be renamed to Labels.");
assert(!html.includes("Copy Matching Rules"), "Copy Matching Rules must be replaced by Add Similar.");
assert(!html.includes(">Duplicate<"), "Duplicate must be replaced by Add Similar.");
assert(!html.includes('type="range"'), "The 1–10 formality slider must be removed.");
assert(html.includes("Labels are only for search and organization"));
assert(html.includes("Every chip") === false, "Implementation requirements should not leak into UI copy.");

assert(smart.includes("const SCHEMA_VERSION = 5"));
assert(smart.includes('RECOVERY_KEY = "fitRoulette.v1.recovery.schema5"'));
assert(smart.includes('LEGACY_RECOVERY_KEY = "fitRoulette.v1.recovery.schema4"'));
assert(app.includes('STORAGE_KEY = "fitRoulette.v1"'));
assert(app.includes('APP_VERSION = "1.5.1"'), "Visible release version must be 1.5.1.");
assert(sw.includes('CACHE_NAME = "fit-roulette-v1.5.1"'), "Final service-worker cache must match the 1.5.1 release.");
assert(app.includes("SmartCloset.canWearTogether"), "Pair-rule candidates must use wearable-slot compatibility.");
assert(app.includes('data-result-action="remove-belt"'), "Optional-belt removal control is missing.");
assert(app.includes('data-result-action="remove-layer"'), "Optional-layer removal control is missing.");
assert(app.includes("Custom color…"), "Controlled colors must retain an explicit custom route.");
assert(css.includes(".relationship-choice"), "Grouped relationship choices are missing responsive styles.");
assert(css.includes(".relationship-picker > summary::after"), "Application-owned disclosure chevrons are missing.");
assert(css.includes(".relationship-picker[open] > summary::after"), "Disclosure open-state treatment is missing.");
assert(css.includes(":focus-visible"), "Explicit keyboard focus styling is missing.");
assert(html.includes('<details id="preferDetails"') && html.includes('<details id="neverDetails"'), "Prefer and Never must remain independent native disclosures.");
assert(!html.match(/<details id="preferDetails"[^>]*\sopen(?:\s|>)/) && !html.match(/<details id="neverDetails"[^>]*\sopen(?:\s|>)/), "Relationship disclosures must default collapsed.");

function themeToken(blockPattern, token) {
  const block = css.match(blockPattern)?.[1] || "";
  return block.match(new RegExp(`--${token}:\\s*(#[0-9a-f]{6})`, "i"))?.[1] || "";
}

function relativeLuminance(hex) {
  const values = hex.slice(1).match(/../g).map((part) => parseInt(part, 16) / 255).map((value) => (
    value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  ));
  return (0.2126 * values[0]) + (0.7152 * values[1]) + (0.0722 * values[2]);
}

function contrastRatio(foreground, background) {
  const values = [relativeLuminance(foreground), relativeLuminance(background)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

const lightTokens = {
  accent: themeToken(/^:root\s*\{([\s\S]*?)\n\}/m, "accent"),
  strong: themeToken(/^:root\s*\{([\s\S]*?)\n\}/m, "accent-strong"),
  text: themeToken(/^:root\s*\{([\s\S]*?)\n\}/m, "primary-text")
};
const darkTokens = {
  accent: themeToken(/:root\[data-theme="dark"\]\s*\{([\s\S]*?)\n\}/m, "accent"),
  strong: themeToken(/:root\[data-theme="dark"\]\s*\{([\s\S]*?)\n\}/m, "accent-strong"),
  text: themeToken(/:root\[data-theme="dark"\]\s*\{([\s\S]*?)\n\}/m, "primary-text")
};
for (const [theme, tokens] of Object.entries({ light: lightTokens, dark: darkTokens })) {
  assert(Object.values(tokens).every(Boolean), `${theme} primary-button tokens are incomplete.`);
  assert(contrastRatio(tokens.text, tokens.accent) >= 4.5, `${theme} primary-button contrast must meet WCAG AA.`);
  assert(contrastRatio(tokens.text, tokens.strong) >= 4.5, `${theme} primary-button hover contrast must meet WCAG AA.`);
}
assert(app.includes("SmartCloset.semanticCompatibility"), "Generator must use centralized semantic compatibility.");
assert(app.includes("ContextEngine.scoreOutfitContext"), "Generator must use centralized context scoring.");
assert(contextEngine.includes('cache: "no-store"'), "Coordinate-bearing requests must bypass persistent HTTP caches.");
assert(html.includes("Weather data by Open-Meteo"), "Required provider attribution is missing.");
assert(!html.includes("Gym/Errands"), "Legacy Gym / Errands must not be offered for new assignments.");
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

for (const asset of ["index.html", "styles.css", "context-engine.js", "smart-closet.js", "app.js", "manifest.json", "sw.js"]) {
  assert(fs.existsSync(path.join(root, asset)), `Missing asset: ${asset}`);
}

console.log(JSON.stringify({
  ok: true,
  schemaVersion: 5,
  structuredControls: 43,
  appVersion: (app.match(/APP_VERSION = "([^"]+)"/) || [])[1]
}));
