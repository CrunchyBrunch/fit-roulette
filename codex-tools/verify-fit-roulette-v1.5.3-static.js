const assert = require("assert");
const fs = require("fs");
const path = require("path");

require("./verify-fit-roulette-v1.5.2-static.js");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");
const smart = fs.readFileSync(path.join(root, "smart-closet.js"), "utf8");
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);

assert.equal(new Set(ids).size, ids.length, "The unified editor must not duplicate IDs.");
assert(html.includes("Start with a garment preset"));
assert(!html.includes("<h3>Quick Add</h3>"));
assert(html.includes('placeholder="Example: &quot;Navy Chinos&quot;"'));
assert(html.includes('id="itemDialogTitle" tabindex="-1"'));
assert(html.includes('data-template-id') === false, "Preset buttons must remain dynamically rendered from the canonical template list.");
assert(app.includes('aria-pressed="false"'));
assert(app.includes("activePresetBaseline"));
assert(app.includes("Customized from"));
assert(app.includes("persistedNeedsReview"));
assert(!app.includes('options.addSimilar && typeof $("#itemName").focus'));
assert(app.includes('$("#itemDialogTitle").focus'));
assert(app.includes("validateItemIssues"));
assert(app.includes('target.setAttribute?.("aria-invalid", "true")'));
assert(app.includes('target.setAttribute?.("aria-describedby", messageId)'));
assert(html.includes('id="weatherPreferenceStatus"'));
assert(html.includes('id="weatherAvailabilityStatus"'));
assert(html.includes('id="weatherEffectiveStatus"'));
assert(html.includes("Fit Roulette ranks valid outfits using occasion, compatibility, your preferences, current context, and wear history."));
assert(css.includes(".selection-indicator"));
assert(css.includes(".field-error::before"));
assert(css.includes(".has-error"));

const orderedIds = [
  "presetSection", "itemName", "itemCategory", "itemSubtype", "sleeveLengthField",
  "itemPrimaryColor", "itemPattern", "secondaryColorField", "itemOccasionFieldset",
  "itemFormality", "weatherLayerSection", "matchingDetails", "advancedDetails"
];
for (let index = 1; index < orderedIds.length; index += 1) {
  assert(
    html.indexOf(`id="${orderedIds[index - 1]}"`) < html.indexOf(`id="${orderedIds[index]}"`),
    `${orderedIds[index]} must follow ${orderedIds[index - 1]} in DOM order.`
  );
}
assert(html.indexOf('id="itemPreference"') > html.indexOf('id="matchingDetails"'));
assert(html.indexOf('id="itemStatus"') > html.indexOf('id="advancedDetails"'));
assert.equal((html.match(/id="itemReviewNotice"/g) || []).length, 1);
assert.equal((html.match(/id="templateChips"/g) || []).length, 1);
assert(smart.includes("const SCHEMA_VERSION = 5"));
assert(smart.includes('RECOVERY_KEY = "fitRoulette.v1.recovery.schema5"'));
assert(app.includes('STORAGE_KEY = "fitRoulette.v1"'));

console.log(JSON.stringify({
  ok: true,
  appVersion: "1.5.3",
  schemaVersion: 5,
  uniqueIds: ids.length,
  itemEntryOrder: orderedIds,
  validationModel: "summary-inline-aria",
  weatherCommunicationDimensions: 3
}));
