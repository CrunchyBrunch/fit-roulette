const assert = require("assert");
const fs = require("fs");
const path = require("path");
const Smart = require("../smart-closet.js");

const NOW = "2026-08-07T12:00:00.000Z";

function migrate(raw) {
  return Smart.migrateAndValidate(raw, { now: NOW }).state;
}

const legacy = {
  version: 3,
  wardrobe: [
    {
      id: "top_custom", name: "Custom Plaid Shirt", category: "top", colors: ["Cerulean", "Cream", "Gold"],
      tags: ["button-down", "Plaid", "Unknown Label"], occasions: ["office", "Friday Jeans", "date"],
      formality: 8, active: true, worksWithTags: ["navy"], avoidWithTags: ["athletic"],
      notes: "Keep this note", imageUrl: "images/custom.png", lastWorn: "2026-07-01", mysteryField: { keep: true }
    },
    {
      id: "bottom_unavailable", name: "Laundry Jeans", category: "pants", colors: ["Navy"], tags: ["jeans"],
      occasions: ["casual"], formality: 4, unavailable: true
    },
    {
      id: "shoes_archived", name: "Old Sneakers", category: "shoes", colors: ["White"], tags: ["sneakers"],
      occasions: ["casual"], formality: 3, active: false
    },
    {
      id: "layer", name: "Olive Jacket", category: "outerwear", colors: ["Olive"], tags: ["jacket"],
      occasions: ["casual", "date"], formality: 5, active: true, avoidWithItems: ["missing-item"]
    },
    "unfamiliar wardrobe record"
  ],
  history: [{ id: "log1", date: "2026-07-20T12:00:00", occasion: "casual", itemIds: ["bottom_unavailable", "shoes_archived"], note: "History note" }],
  bannedCombos: [{ id: "ban1", itemIds: ["top_custom", "bottom_unavailable"], occasion: "work" }],
  feedback: [{ id: "feedback1", bannedComboId: "ban1", reason: "colors", itemIds: ["top_custom", "bottom_unavailable"], note: "Keep feedback" }],
  settings: { theme: "dark", afterLogging: "keep", defaultOccasion: "Friday Jeans", customSetting: "preserved" },
  customTopLevel: { preserve: true }
};

const migrated = migrate(legacy);
assert.equal(migrated.schemaVersion, 5);
assert.equal(migrated.version, 5);
assert.equal(migrated.setup.completed, true, "Existing empty or populated users must not see fresh setup.");
assert.deepEqual(migrated.customTopLevel, { preserve: true });
assert.equal(migrated.settings.customSetting, "preserved");
assert.equal(migrated.settings.defaultOccasion, "friday");
assert.equal(migrated.wardrobe.length, 4);
assert.equal(migrated.unresolvedRecords.wardrobe.length, 1, "Malformed records must be preserved for recovery.");

const custom = migrated.wardrobe.find((item) => item.id === "top_custom");
assert.equal(custom.primaryColor, "Cerulean");
assert.equal(custom.secondaryColor, "Cream");
assert.equal(custom.subtype, "button-down");
assert.equal(custom.pattern, "plaid");
assert.equal(custom.formality, 4);
assert.equal(custom.status, "available");
assert.equal(custom.notes, "Keep this note");
assert.equal(custom.imageUrl, "images/custom.png");
assert.equal(custom.mysteryField.keep, true);
assert(custom.labels.includes("Unknown Label"));
assert(custom.legacyFallback, "Legacy matcher data should remain active until review.");
assert.equal(custom.review.status, "needs_review");
assert.deepEqual(custom.layerRoles, ["base"]);
assert.equal(custom.rainProtection, "unspecified");
assert.equal(custom.windProtection, "unspecified");

assert.equal(migrated.wardrobe.find((item) => item.id === "bottom_unavailable").status, "unavailable");
const archived = migrated.wardrobe.find((item) => item.id === "shoes_archived");
assert.equal(archived.status, "archived");
assert.equal(archived.review.status, "needs_review");
assert(archived.review.reasons.some((reason) => reason.includes("archived or temporarily unavailable")));
const migratedLayer = migrated.wardrobe.find((item) => item.id === "layer");
assert.equal(migratedLayer.category, "layer");
assert.deepEqual(migratedLayer.layerRoles, ["outer"]);
assert.equal(migratedLayer.review.status, "needs_review", "Ambiguous migrated layers must enter the existing review queue without blocking migration.");
assert.equal(migrated.history[0].note, "History note");
assert.equal(migrated.bannedCombos[0].occasion, "work", "Legacy exact-ban fields remain preserved even though matching is global.");
assert.equal(migrated.feedback[0].note, "Keep feedback");
assert.equal(migrated.unresolvedPairRelationships[0].reference, "missing-item");

const reopened = Smart.migrateAndValidate(JSON.parse(JSON.stringify(migrated)), { now: NOW });
assert.equal(reopened.migrated, false);
assert.deepEqual(reopened.state, migrated, "Schema-v4 reopening must be idempotent.");

const reviewedCustom = Smart.createItem({
  ...custom,
  review: { status: "reviewed", reasons: [], reviewedAt: NOW },
  legacyFallback: false
}, { now: NOW });
const reviewedReopen = migrate({
  ...migrated,
  wardrobe: migrated.wardrobe.map((entry) => entry.id === custom.id ? reviewedCustom : entry)
});
assert.equal(reviewedReopen.wardrobe.find((entry) => entry.id === custom.id).review.status, "reviewed", "Preserved legacy colors must not requeue a reviewed schema-v5 item.");
assert.equal(reviewedReopen.wardrobe.find((entry) => entry.id === custom.id).legacyFallback, false);

const emptyLegacy = migrate({ version: 3, wardrobe: [], history: [], bannedCombos: [], feedback: [], settings: {} });
assert.equal(emptyLegacy.wardrobe.length, 0, "An intentionally empty legacy closet must remain empty.");
assert.equal(emptyLegacy.setup.completed, true);

const fresh = Smart.createFreshState(NOW);
assert.equal(fresh.wardrobe.length, 0);
assert.equal(fresh.setup.completed, false);
assert(Smart.SUBTYPE_TEMPLATES["athletic top"].occasions.includes("athletic"));
assert(!Smart.SUBTYPE_TEMPLATES["athletic top"].occasions.includes("gym"), "New athletic assignments must not use legacy Gym / Errands.");
assert.deepEqual(Smart.SUBTYPE_TEMPLATES.hoodie.layerRoles, ["mid", "outer"], "Legitimate multi-role garments must remain expressible.");
assert(Object.values(Smart.SUBTYPE_TEMPLATES).every((template) => !template.occasions.includes("gym")), "New subtype defaults must not assign the legacy Gym / Errands occasion.");

const legacyGym = migrate({
  schemaVersion: 4,
  wardrobe: [{
    id: "legacy_gym", name: "Legacy Gym Shirt", category: "top", subtype: "athletic top", primaryColor: "Black",
    secondaryColor: "", pattern: "solid", sleeveLength: "short", bottomLength: "not_applicable", formality: 1,
    occasions: ["gym"], warmth: "very_light", rainPolicy: "unspecified", status: "available", preference: "neutral",
    labels: [], review: { status: "reviewed", reasons: [], reviewedAt: NOW }, legacyFallback: false, legacyMatching: {},
    unrecognizedStructured: {}, beltMode: "", imageUrl: "", notes: "", lastWorn: null, createdAt: NOW, updatedAt: NOW
  }], history: [], bannedCombos: [], feedback: [], pairRelationships: [], settings: {}
});
assert.deepEqual(legacyGym.wardrobe[0].occasions, ["gym"], "Ambiguous legacy Gym / Errands values must be preserved without guessing.");
assert.equal(legacyGym.wardrobe[0].review.status, "needs_review");
assert(legacyGym.wardrobe[0].review.reasons.some((reason) => reason.includes("Athletic") && reason.includes("Casual")));
const explicitErrands = migrate({
  ...legacyGym,
  schemaVersion: 4,
  wardrobe: [{
    ...legacyGym.wardrobe[0], id: "explicit_errands", name: "Explicit Errands Shirt", occasions: ["errands"],
    review: { status: "reviewed", reasons: [], reviewedAt: NOW }
  }]
});
assert.deepEqual(explicitErrands.wardrobe[0].occasions, ["casual"], "An explicit Errands value may safely map to Casual.");

const copiedV133Fixture = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "v1.3.3-smart-closet-browser.json"), "utf8"));
const copiedV133 = migrate(copiedV133Fixture);
assert.equal(copiedV133.wardrobe.length, 10, "The copied v1.3.3 fixture must migrate without dropping valid garments.");
assert.equal(copiedV133.history.length, 1, "Synthetic legacy history must survive migration.");
assert.equal(copiedV133.wardrobe.find((entry) => entry.id === "legacy_white_tee").primaryColor, "Cerulean");
assert.equal(copiedV133.wardrobe.find((entry) => entry.id === "legacy_white_tee").notes, "Synthetic release-candidate migration fixture.");
assert.equal(copiedV133.wardrobe.find((entry) => entry.id === "legacy_white_tee").imageUrl, "./icons/favicon-32.png");
assert.equal(copiedV133.wardrobe.find((entry) => entry.id === "legacy_laundry_shoes").status, "unavailable");
assert.equal(copiedV133.wardrobe.find((entry) => entry.id === "legacy_archived_top").status, "archived");

const oldestSupported = migrate({
  schemaVersion: 1,
  wardrobe: Array.from({ length: 10 }, (_, index) => ({
    id: `old_${index + 1}`,
    name: `Old Item ${index + 1}`,
    category: "top",
    tags: ["t-shirt"],
    colors: ["Blue"],
    occasions: ["casual"],
    formality: index + 1,
    active: true
  })),
  history: [], bannedCombos: [], feedback: [], settings: { defaultOccasion: "unknown" }
});
assert.deepEqual(oldestSupported.wardrobe.map((entry) => entry.formality), [1, 1, 2, 2, 3, 3, 4, 4, 5, 5]);
assert.equal(oldestSupported.settings.defaultOccasion, "work", "Invalid saved defaults must fall back safely.");

const unfamiliarV4Item = {
  ...Smart.createItem({ id: "unfamiliar_v4", name: "Unfamiliar v4 Item", category: "top", subtype: "t-shirt", primaryColor: "Infrared" }, { now: NOW }),
  subtype: "cape", secondaryColor: "Gold", pattern: "paisley", sleeveLength: "elbow", formality: 99,
  occasions: ["casual", "wedding"], warmth: "toasty", rainPolicy: "sometimes", status: "in_rotation", preference: "love",
  layerRoles: ["foundation", "outer"], rainProtection: "storm-ish", windProtection: "sometimes",
  review: { status: "reviewed", reasons: [], reviewedAt: NOW }
};
const unfamiliarV4 = migrate({
  ...Smart.createFreshState(NOW),
  wardrobe: [unfamiliarV4Item],
  pairRelationships: [{ type: "prefer", itemIds: ["unfamiliar_v4", "missing_item"] }]
});
const preservedUnknowns = unfamiliarV4.wardrobe[0];
assert.equal(preservedUnknowns.primaryColor, "Infrared");
assert.equal(preservedUnknowns.secondaryColor, "Gold");
assert.equal(preservedUnknowns.review.status, "needs_review");
for (const field of ["subtype", "pattern", "sleeveLength", "formality", "occasions", "warmth", "rainPolicy", "layerRoles", "rainProtection", "windProtection", "status", "preference"]) {
  assert(Object.prototype.hasOwnProperty.call(preservedUnknowns.unrecognizedStructured, field), `Unfamiliar ${field} must remain preserved.`);
}
assert.equal(unfamiliarV4.pairRelationships.length, 0);
assert(unfamiliarV4.unresolvedPairRelationships.some((entry) => entry.reason.includes("Unresolved")));

assert.throws(
  () => migrate({ schemaVersion: 6, wardrobe: [] }),
  (error) => error.code === "UNSUPPORTED_FUTURE_SCHEMA"
);
assert.throws(
  () => migrate({ schemaVersion: "mystery", wardrobe: [] }),
  (error) => error.code === "INVALID_SCHEMA"
);
assert.throws(
  () => migrate({ version: 3, wardrobe: "not-an-array" }),
  (error) => error.code === "INVALID_COLLECTION"
);
assert.throws(
  () => migrate({ schemaVersion: 5, wardrobe: [], settings: { weather: { latitude: 12.3, longitude: 45.6 } } }),
  (error) => error.code === "PRIVACY_VIOLATION"
);

function item(id, subtype, color, overrides = {}) {
  const template = Smart.SUBTYPE_TEMPLATES[subtype];
  return Smart.createItem({
    id, name: id, ...template, primaryColor: color, status: "available", preference: "neutral", labels: [],
    review: { status: "reviewed", reasons: [], reviewedAt: NOW }, legacyFallback: false, legacyMatching: {}, ...overrides
  }, { now: NOW });
}

const top = item("top", "polo", "Navy");
const bottom = item("bottom", "chinos", "Khaki");
const shoes = item("shoes", "dress shoes", "Brown");
const belt = item("belt", "dress belt", "Brown");
const layer = item("layer", "jacket", "Olive");
assert.deepEqual(top.layerRoles, ["base"]);
assert.deepEqual(bottom.layerRoles, []);
assert.equal(bottom.rainProtection, "none");
assert.throws(
  () => Smart.validateState({ ...Smart.createFreshState(NOW), wardrobe: [{ ...top, layerRoles: ["side"] }] }),
  (error) => error.code === "INVALID_ITEM_ENUM"
);
assert.throws(
  () => Smart.validateState({ ...Smart.createFreshState(NOW), wardrobe: [{ ...top, rainProtection: "stormproof" }] }),
  (error) => error.code === "INVALID_ITEM_ENUM"
);
const baseOptions = { settings: { weather: { enabled: false } }, pairRelationships: [] };
const baseline = Smart.semanticCompatibility([top, bottom, shoes, belt], "date", baseOptions);
assert(baseline.valid);

const labelChanged = [top, bottom, shoes, belt].map((entry) => ({ ...entry, labels: ["labels must not match", "athletic", "purple"] }));
assert.equal(
  Smart.semanticCompatibility(labelChanged, "date", baseOptions).score,
  baseline.score,
  "Labels must never influence structured matching."
);

const neverPair = [{ id: "pair", type: "never", itemIds: Smart.canonicalPair("top", "bottom") }];
assert.equal(Smart.semanticCompatibility([top, bottom, shoes], "date", { ...baseOptions, pairRelationships: neverPair }).valid, false);
const preferredPair = [{ id: "pair", type: "prefer", itemIds: Smart.canonicalPair("top", "bottom") }];
assert(Smart.semanticCompatibility([top, bottom, shoes], "date", { ...baseOptions, pairRelationships: preferredPair }).score > Smart.semanticCompatibility([top, bottom, shoes], "date", baseOptions).score);

const excludedTop = { ...top, occasions: ["casual"] };
assert.equal(Smart.semanticCompatibility([excludedTop, bottom, shoes], "date", baseOptions).valid, false, "Occasion exclusion must be hard.");
assert(Smart.semanticCompatibility([top, bottom, shoes, layer], "date", baseOptions).valid, "A compatible selected layer should work with a base outfit.");

const avoidTop = { ...top, preference: "avoid" };
const avoidScore = Smart.semanticCompatibility([avoidTop, bottom, shoes], "date", baseOptions).score;
const favoriteScore = Smart.semanticCompatibility([{ ...top, preference: "favorite" }, bottom, shoes], "date", baseOptions).score;
assert(avoidScore < favoriteScore);
assert.equal(
  Smart.semanticCompatibility([avoidTop, bottom, shoes], "date", { ...baseOptions, buildAroundId: "top" }).score,
  Smart.semanticCompatibility([top, bottom, shoes], "date", baseOptions).score,
  "Build Around should override only the selected item's Avoid preference."
);
assert.equal(
  Smart.semanticCompatibility([{ ...avoidTop, status: "unavailable" }, bottom, shoes], "date", { ...baseOptions, buildAroundId: "top" }).valid,
  false,
  "Build Around must not override availability."
);

const legacyAvoid = {
  ...top,
  legacyFallback: true,
  legacyMatching: { avoidWithTags: ["chinos"], worksWithTags: [], avoidWithItems: [], tags: [] }
};
assert.equal(Smart.semanticCompatibility([legacyAvoid, bottom, shoes], "date", baseOptions).valid, false);
assert.equal(Smart.semanticCompatibility([{ ...legacyAvoid, legacyFallback: false }, bottom, shoes], "date", baseOptions).valid, true);

const stateWithPair = { ...fresh, wardrobe: [top, bottom], pairRelationships: [] };
const related = Smart.setRelationship(stateWithPair, "bottom", "top", "prefer", NOW);
assert.deepEqual(related.pairRelationships[0].itemIds, ["bottom", "top"].sort());
assert.equal(Smart.relationshipType(related, "top", "bottom"), "prefer");
const removed = Smart.setRelationship(related, "top", "bottom", "", NOW);
assert.equal(removed.pairRelationships.length, 0);

assert.equal(Smart.canWearTogether(top, { ...top, id: "other_top" }), false, "Two base tops occupy the same wearable slot.");
assert.equal(Smart.canWearTogether(bottom, { ...bottom, id: "other_bottom" }), false, "Two bottoms occupy the same wearable slot.");
assert.equal(Smart.canWearTogether(shoes, { ...shoes, id: "other_shoes" }), false, "Two pairs of shoes occupy the same wearable slot.");
assert.equal(Smart.canWearTogether(top, layer), true, "A base top and a supported layer can be worn together.");
assert.equal(Smart.canWearTogether(bottom, belt), true, "A bottom and belt can be worn together.");

const impossibleStoredNever = [{ id: "impossible", type: "never", itemIds: Smart.canonicalPair("top", "other_top") }];
const otherTop = { ...top, id: "other_top", name: "other top" };
assert.equal(
  Smart.semanticCompatibility([top, otherTop], "date", { ...baseOptions, pairRelationships: impossibleStoredNever }).valid,
  true,
  "Impossible stored relationships must remain data-safe without influencing matching."
);

const staleSolid = { ...top, secondaryColor: "Magenta", pattern: "solid" };
assert.deepEqual(Smart.itemColors(staleSolid), [top.primaryColor], "Solid garments must ignore stale secondary color without rewriting stored data.");
assert.deepEqual(Smart.itemColors({ ...staleSolid, pattern: "striped" }), [top.primaryColor, "Magenta"]);

const roundTrip = migrate(JSON.parse(JSON.stringify(migrated)));
assert.deepEqual(roundTrip, migrated, "Export/import shaped JSON must preserve schema-v5 meaning.");

console.log(JSON.stringify({
  ok: true,
  schemaVersion: migrated.schemaVersion,
  migratedItems: migrated.wardrobe.length,
  reviewItems: migrated.wardrobe.filter((entry) => entry.review.status === "needs_review").length,
  unresolvedWardrobe: migrated.unresolvedRecords.wardrobe.length
}));
