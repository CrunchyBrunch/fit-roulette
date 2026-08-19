const assert = require("assert");
const fs = require("fs");
const path = require("path");

require("./verify-fit-roulette-v1.5.3-static.js");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const smart = fs.readFileSync(path.join(root, "smart-closet.js"), "utf8");

for (const id of [
  "secondaryColorChips", "duplicateDialog", "duplicateReviewDetails", "manualItemSearch",
  "manualSelectedCount", "manualSelectedSummary", "manualNoResults"
]) assert(html.includes(`id="${id}"`), `${id} is missing.`);

assert(css.includes(".color-swatch-multicolor"));
assert(css.includes("@media (forced-colors: active)"));
assert(css.includes("#itemDialog.keyboard-open #itemDialogTitle:focus"));
assert(css.includes(".manual-selected-summary"));
assert(app.includes('data-color-kind="${kind}"'));
assert(app.includes("duplicateIdentity"));
assert(app.includes("matchesClosetSearch(item, manualItemSearch)"));
assert(smart.includes("const SCHEMA_VERSION = 5"));
assert(app.includes('STORAGE_KEY = "fitRoulette.v1"'));
assert(!html.includes("fit-roulette-v1.5.3"));

console.log(JSON.stringify({
  ok: true,
  appVersion: "1.6.0",
  schemaVersion: 5,
  colorControls: ["primary", "secondary"],
  focusPolicy: "programmatic-title-with-keyboard-indicator",
  duplicatePolicy: "exact-advisory",
  manualSearch: true
}));
