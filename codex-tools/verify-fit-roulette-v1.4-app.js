const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("assert");
const ContextEngine = require("../context-engine.js");
const Smart = require("../smart-closet.js");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const appCode = fs.readFileSync(path.join(root, "app.js"), "utf8");
const htmlIds = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);

class MockClassList {
  constructor() { this.values = new Set(); }
  add(...values) { values.forEach((value) => this.values.add(value)); }
  remove(...values) { values.forEach((value) => this.values.delete(value)); }
  contains(value) { return this.values.has(value); }
  toggle(value, force) {
    const enabled = force === undefined ? !this.values.has(value) : Boolean(force);
    if (enabled) this.values.add(value); else this.values.delete(value);
    return enabled;
  }
}

class MockElement {
  constructor(id = "") {
    this.id = id;
    this.value = "";
    this.checked = false;
    this.hidden = false;
    this.open = false;
    this.innerHTML = "";
    this.textContent = "";
    this.dataset = {};
    this.classList = new MockClassList();
    this.listeners = new Map();
    this.listenerAdds = new Map();
    this.selectedOptions = [];
    this.options = [];
    this.files = [];
    this.style = {};
    this.scrollTop = 0;
    this.disabled = false;
    this.attributes = new Map();
  }
  addEventListener(type, callback) {
    this.listeners.set(type, callback);
    this.listenerAdds.set(type, (this.listenerAdds.get(type) || 0) + 1);
  }
  click() { this.listeners.get("click")?.({ target: this, preventDefault() {} }); }
  focus() { this.focused = true; }
  close() { this.open = false; }
  showModal() { this.open = true; }
  scrollIntoView() {}
  setAttribute(name, value) { this.attributes.set(name, value); if (name === "open") this.open = true; }
  removeAttribute(name) { this.attributes.delete(name); if (name === "open") this.open = false; }
  hasAttribute(name) { return this.attributes.has(name); }
  remove() {}
  closest(selector) {
    const dataMatch = selector.match(/^\[data-([a-z-]+)(?:='([^']+)')?\]$/);
    if (dataMatch) {
      const key = dataMatch[1].replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
      if (this.dataset[key] !== undefined && (dataMatch[2] === undefined || this.dataset[key] === dataMatch[2])) return this;
    }
    return null;
  }
  querySelector() { return null; }
  querySelectorAll() { return []; }
}

function runApp(savedValue, options = {}) {
  const elements = new Map(htmlIds.map((id) => [id, new MockElement(id)]));
  const tabButtons = ["generate", "closet", "history", "settings"].map((screen) => {
    const element = new MockElement();
    element.dataset.screen = screen;
    return element;
  });
  const screens = ["generate", "closet", "history", "settings"].map((screen) => new MockElement(`screen-${screen}`));
  const occasionInputs = ["work", "friday", "casual", "date", "athletic", "gym"].map((value) => Object.assign(new MockElement(), { value, name: "itemOccasion" }));
  const beltInputs = ["required", "optional", "none"].map((value) => Object.assign(new MockElement(), { value, name: "itemBeltMode" }));
  const layerRoleInputs = ["base", "mid", "outer"].map((value) => Object.assign(new MockElement(), { value, name: "itemLayerRole" }));
  const feedbackInputs = ["colors", "top_pants", "shoes", "belt_shoes", "too_formal", "too_casual", "weather", "exact", "other"].map((value) => Object.assign(new MockElement(), { value, name: "feedbackReason" }));
  let domReady;
  const storage = new Map();
  const storageWrites = [];
  const storageWriteAttempts = [];
  const confirmations = [];
  const events = [];
  if (savedValue !== undefined && savedValue !== null) storage.set("fitRoulette.v1", savedValue);
  if (options.initialRecovery !== undefined && options.initialRecovery !== null) storage.set(Smart.RECOVERY_KEY, options.initialRecovery);
  if (options.initialLegacyRecovery !== undefined && options.initialLegacyRecovery !== null) storage.set(Smart.LEGACY_RECOVERY_KEY, options.initialLegacyRecovery);

  const document = {
    documentElement: new MockElement("documentElement"),
    body: { appendChild() {} },
    addEventListener(type, callback) { if (type === "DOMContentLoaded") domReady = callback; },
    createElement() { return new MockElement(); },
    querySelector(selector) {
      if (selector.startsWith("#")) return elements.get(selector.slice(1)) || null;
      if (selector === "input[name='itemBeltMode']:checked") return beltInputs.find((input) => input.checked) || null;
      const beltValue = selector.match(/^input\[name='itemBeltMode'\]\[value='(.+)'\]$/);
      if (beltValue) return beltInputs.find((input) => input.value === beltValue[1]) || null;
      if (selector === "input[name='feedbackReason']:checked") return feedbackInputs.find((input) => input.checked) || null;
      return null;
    },
    querySelectorAll(selector) {
      if (selector === ".tab-button") return tabButtons;
      if (selector === ".screen") return screens;
      if (selector === "input[name='itemOccasion']") return occasionInputs;
      if (selector === "input[name='itemOccasion']:checked") return occasionInputs.filter((input) => input.checked);
      if (selector === "input[name='itemBeltMode']") return beltInputs;
      if (selector === "input[name='itemLayerRole']") return layerRoleInputs;
      if (selector === "input[name='itemLayerRole']:checked") return layerRoleInputs.filter((input) => input.checked);
      if (selector === "input[name='feedbackReason']") return feedbackInputs;
      if (selector === "input[name='manualItem']:checked") return [];
      return [];
    }
  };

  const localStorage = {
    getItem(key) { return storage.has(key) ? storage.get(key) : null; },
    setItem(key, value) {
      const stringValue = String(value);
      storageWriteAttempts.push({ key, value: stringValue });
      events.push(`attempt:${key}`);
      if (options.failSetItem?.(key, stringValue)) throw new Error(`Synthetic storage failure for ${key}`);
      storage.set(key, stringValue);
      storageWrites.push({ key, value: stringValue });
      events.push(`write:${key}`);
    },
    removeItem(key) { storage.delete(key); },
    key(index) { return [...storage.keys()][index] ?? null; },
    get length() { return storage.size; }
  };
  const windowObject = {
    __FIT_ROULETTE_TESTING__: true,
    FitRouletteContextEngine: ContextEngine,
    FitRouletteSmartCloset: Smart,
    addEventListener() {},
    confirm(message) {
      confirmations.push(message);
      events.push("confirm");
      return options.confirmResult !== false;
    },
    requestAnimationFrame(callback) { callback(); },
    fetch: options.fetchImpl
  };
  const context = {
    console: { log: console.log, warn: console.warn, error() {} },
    document,
    navigator: { permissions: options.permissions || null, geolocation: options.geolocation || null },
    window: windowObject,
    localStorage,
    Blob,
    URL: { createObjectURL: () => "blob:test", revokeObjectURL() {} },
    Intl,
    Date,
    Math,
    Number,
    String,
    Array,
    Set,
    Map,
    RegExp,
    clearTimeout,
    setTimeout
  };
  vm.runInNewContext(appCode, context, { filename: "app.js" });
  domReady();
  return { api: windowObject.__fitRouletteTest, elements, storage, storageWrites, storageWriteAttempts, confirmations, events, windowObject };
}

const legacyRaw = JSON.stringify({
  version: 3,
  wardrobe: [
    { id: "legacy_top", name: "Legacy Tee", category: "top", colors: ["White"], tags: ["t-shirt"], occasions: ["casual"], formality: 3, active: true },
    { id: "legacy_bottom", name: "Legacy Jeans", category: "pants", colors: ["Navy"], tags: ["jeans"], occasions: ["casual"], formality: 4, active: true },
    { id: "legacy_shoes", name: "Legacy Sneakers", category: "shoes", colors: ["White"], tags: ["sneakers"], occasions: ["casual"], formality: 3, active: true },
    { id: "legacy_layer", name: "Legacy Jacket", category: "outerwear", colors: ["Olive"], tags: ["jacket"], occasions: ["casual"], formality: 5, active: true },
    { id: "laundry_shoes", name: "Laundry Shoes", category: "shoes", colors: ["Black"], tags: ["sneakers"], occasions: ["casual"], formality: 3, unavailable: true }
  ],
  history: [], bannedCombos: [], feedback: [], settings: { defaultOccasion: "casual" }
});

const migratedApp = runApp(legacyRaw);
const migratedState = migratedApp.api.getState();
assert.equal(migratedState.schemaVersion, 5);
assert.equal(migratedApp.storage.get(Smart.RECOVERY_KEY), legacyRaw, "Recovery copy must be the untouched pre-migration payload.");
assert.equal(JSON.parse(migratedApp.storage.get("fitRoulette.v1")).schemaVersion, 5);
assert.equal(migratedState.wardrobe.find((item) => item.id === "laundry_shoes").status, "unavailable");
assert(migratedApp.elements.get("reviewQueue").innerHTML.includes("Review Smart Closet Settings"));
assert(migratedApp.elements.get("buildAroundSelect").innerHTML.includes("Legacy Tee") || migratedApp.elements.get("buildAroundCategorySelect").innerHTML.includes("Tops"));
assert(!migratedApp.elements.get("buildAroundSelect").innerHTML.includes("Laundry Shoes"));

const casual = migratedApp.api.pickOutfit("casual", "");
assert(!casual.error, casual.error);
assert(!casual.items.some((item) => item.category === "layer"), "Layers must not be automatically inserted.");
const aroundLayer = migratedApp.api.pickOutfit("casual", "legacy_layer");
assert(!aroundLayer.error, aroundLayer.error);
assert(aroundLayer.items.some((item) => item.id === "legacy_layer"), "Build Around must support layers.");
assert.equal(migratedApp.api.getState().history.length, 0, "Viewing and reroll candidate construction must not write history.");

const releasedSchemaFourRaw = JSON.stringify({
  schemaVersion: 4,
  version: 4,
  wardrobe: [], history: [], bannedCombos: [], feedback: [], pairRelationships: [],
  settings: { theme: "dark", afterLogging: "keep", defaultOccasion: "casual", weather: { enabled: true, temperature: 52, condition: "rain" } },
  setup: { completed: true, choice: "existing" },
  releaseMarker: "exact schema-four bytes"
});
const schemaFourLegacyRecovery = "{\"protectedBeforeSchema4\":true}";
const automaticSchemaFour = runApp(releasedSchemaFourRaw, { initialLegacyRecovery: schemaFourLegacyRecovery });
assert.equal(automaticSchemaFour.storage.get(Smart.RECOVERY_KEY), releasedSchemaFourRaw, "Automatic v4 to v5 migration must retain the exact raw schema-four primary first.");
assert.equal(automaticSchemaFour.storage.get(Smart.LEGACY_RECOVERY_KEY), schemaFourLegacyRecovery, "Existing schema-four recovery must never be overwritten.");
assert.deepEqual(
  automaticSchemaFour.events.slice(0, 4),
  [`attempt:${Smart.RECOVERY_KEY}`, `write:${Smart.RECOVERY_KEY}`, "attempt:fitRoulette.v1", "write:fitRoulette.v1"],
  "Automatic schema-four recovery must be written before the migrated primary."
);
assert.equal(automaticSchemaFour.api.getState().settings.weather.legacyManual.temperature, 52, "The prior explicit manual-weather preference must remain preserved but inactive.");

const automaticRecoveryFailure = runApp(releasedSchemaFourRaw, { failSetItem: (key) => key === Smart.RECOVERY_KEY });
assert.equal(automaticRecoveryFailure.storage.get("fitRoulette.v1"), releasedSchemaFourRaw);
assert.equal(automaticRecoveryFailure.api.isStorageWriteLocked(), true);
assert(!automaticRecoveryFailure.storageWriteAttempts.some((entry) => entry.key === "fitRoulette.v1"), "Primary migration must not be attempted after recovery failure.");

const preexistingSchemaFiveRecovery = "{\"protectedBeforeSchema5\":\"first\"}";
const automaticExistingRecovery = runApp(releasedSchemaFourRaw, { initialRecovery: preexistingSchemaFiveRecovery });
assert.equal(automaticExistingRecovery.storage.get(Smart.RECOVERY_KEY), preexistingSchemaFiveRecovery, "Existing schema-five recovery must never be overwritten.");
assert.equal(automaticExistingRecovery.api.getState().schemaVersion, 5);

const malformed = runApp("{ definitely not json");
assert.equal(malformed.storage.get("fitRoulette.v1"), "{ definitely not json", "Malformed primary data must remain untouched.");
assert.equal(malformed.storage.get(Smart.RECOVERY_KEY), "{ definitely not json");
assert.equal(malformed.api.isStorageWriteLocked(), true);
assert.equal(malformed.api.getState().wardrobe.length, 0, "Load failure must not restore demo data.");
assert(malformed.elements.get("dataSafetyNotice").innerHTML.includes("Closet data protected"));

const futureRaw = JSON.stringify({ schemaVersion: 9, wardrobe: [] });
const future = runApp(futureRaw);
assert.equal(future.storage.get("fitRoulette.v1"), futureRaw);
assert.equal(future.api.isStorageWriteLocked(), true);
assert.equal(future.api.getLoadIssue().code, "UNSUPPORTED_FUTURE_SCHEMA");

const invalidSchemaRaw = JSON.stringify({ schemaVersion: "mystery", wardrobe: [] });
const invalidSchema = runApp(invalidSchemaRaw);
assert.equal(invalidSchema.storage.get("fitRoulette.v1"), invalidSchemaRaw);
assert.equal(invalidSchema.storage.get(Smart.RECOVERY_KEY), invalidSchemaRaw, "Invalid declared schemas must receive a protected original before safe rejection.");
assert.equal(invalidSchema.api.isStorageWriteLocked(), true);
assert.equal(invalidSchema.api.getLoadIssue().code, "INVALID_SCHEMA");

const importBaselineRaw = JSON.stringify(Smart.createFreshState("2026-08-08T12:00:00.000Z"));
const exactLegacyImportRaw = `{
  "version": 3,
  "customTopLevel": { "ordering": "must stay exact" },
  "wardrobe": [
    {
      "id": "import_custom_top",
      "name": "Imported Custom Top",
      "category": "top",
      "colors": ["Cerulean", "Cream", "Gold"],
      "tags": ["t-shirt", "Unknown Label"],
      "occasions": ["casual"],
      "formality": 3,
      "active": true,
      "notes": "Preserve exact legacy import text.",
      "imageUrl": "./icons/favicon-32.png"
    }
  ],
  "history": [],
  "bannedCombos": [],
  "feedback": [],
  "settings": { "defaultOccasion": "casual" }
}`;

const importedLegacy = runApp(importBaselineRaw);
const importedLegacyResult = importedLegacy.api.importBackupText(exactLegacyImportRaw);
assert.equal(importedLegacyResult.ok, true);
assert.equal(importedLegacyResult.legacy, true);
assert.equal(importedLegacyResult.recoveryCreated, true);
assert.equal(importedLegacy.confirmations.length, 1, "Legacy import must retain the destructive confirmation.");
assert.deepEqual(
  importedLegacy.events.slice(0, 5),
  ["confirm", `attempt:${Smart.RECOVERY_KEY}`, `write:${Smart.RECOVERY_KEY}`, "attempt:fitRoulette.v1", "write:fitRoulette.v1"],
  "Recovery must be written after confirmation and before primary storage."
);
assert.equal(importedLegacy.storage.get(Smart.RECOVERY_KEY), exactLegacyImportRaw, "Legacy recovery must preserve the exact raw bytes represented by the input string.");
assert.equal(JSON.parse(importedLegacy.storage.get("fitRoulette.v1")).schemaVersion, 5);
assert.equal(importedLegacy.api.getState().wardrobe[0].primaryColor, "Cerulean");
assert(importedLegacy.elements.get("recoveryDownloads").innerHTML.includes("before schema 5"), "Protected-original control must enable immediately.");

const cancelledImport = runApp(importBaselineRaw, { confirmResult: false });
const cancelledState = cancelledImport.api.getState();
const cancelledResult = cancelledImport.api.importBackupText(exactLegacyImportRaw);
assert.equal(cancelledResult.cancelled, true);
assert.strictEqual(cancelledImport.api.getState(), cancelledState);
assert.equal(cancelledImport.storage.get("fitRoulette.v1"), importBaselineRaw);
assert.equal(cancelledImport.storage.has(Smart.RECOVERY_KEY), false);

const recoveryFailure = runApp(importBaselineRaw, {
  failSetItem: (key) => key === Smart.RECOVERY_KEY
});
const recoveryFailureState = recoveryFailure.api.getState();
const recoveryFailureCloset = recoveryFailure.elements.get("closetList").innerHTML;
const recoveryFailureResult = recoveryFailure.api.importBackupText(exactLegacyImportRaw);
assert.equal(recoveryFailureResult.ok, false);
assert.equal(recoveryFailureResult.error.code, "RECOVERY_WRITE_FAILED");
assert.strictEqual(recoveryFailure.api.getState(), recoveryFailureState, "Recovery failure must not replace in-memory state.");
assert.equal(recoveryFailure.storage.get("fitRoulette.v1"), importBaselineRaw, "Recovery failure must not replace primary storage.");
assert.equal(recoveryFailure.elements.get("closetList").innerHTML, recoveryFailureCloset, "Recovery failure must not change visible closet data.");
assert(!recoveryFailure.storageWriteAttempts.some((entry) => entry.key === "fitRoulette.v1"), "Primary storage must not be attempted after recovery failure.");
assert(recoveryFailure.elements.get("toast").textContent.includes("protected original could not be created"));

const existingRecoveryRaw = "{\n  \"syntheticProtectedOriginal\": \"keep byte-for-byte\"\n}";
const existingRecovery = runApp(importBaselineRaw, { initialRecovery: existingRecoveryRaw });
const existingRecoveryResult = existingRecovery.api.importBackupText(exactLegacyImportRaw);
assert.equal(existingRecoveryResult.ok, true);
assert.equal(existingRecoveryResult.recoveryCreated, true, "A later confirmed legacy import must receive its own retained original.");
assert.equal(existingRecovery.storage.get(Smart.RECOVERY_KEY), existingRecoveryRaw, "Existing recovery must never be overwritten.");
assert(existingRecoveryResult.recoveryKey.startsWith(Smart.RECOVERY_PREFIX));
assert.equal(existingRecovery.storage.get(existingRecoveryResult.recoveryKey), exactLegacyImportRaw);
assert(existingRecovery.elements.get("recoveryDownloads").innerHTML.includes("retained legacy import"));

const invalidLegacyImportRaw = '{"version":3,"wardrobe":{},"history":[],"bannedCombos":[],"feedback":[]}';
const migrationFailure = runApp(importBaselineRaw);
const migrationFailureState = migrationFailure.api.getState();
const migrationFailureResult = migrationFailure.api.importBackupText(invalidLegacyImportRaw);
assert.equal(migrationFailureResult.ok, false);
assert.strictEqual(migrationFailure.api.getState(), migrationFailureState);
assert.equal(migrationFailure.storage.get("fitRoulette.v1"), importBaselineRaw);
assert.equal(migrationFailure.storage.get(Smart.RECOVERY_KEY), invalidLegacyImportRaw, "Recovery created before migration must remain available after validation failure.");
assert(migrationFailure.elements.get("recoveryDownloads").innerHTML.includes("before schema 5"), "Recovery created before a failed migration must remain downloadable.");

const primaryFailure = runApp(importBaselineRaw, {
  failSetItem: (key) => key === "fitRoulette.v1"
});
const primaryFailureState = primaryFailure.api.getState();
const primaryFailureCloset = primaryFailure.elements.get("closetList").innerHTML;
const primaryFailureResult = primaryFailure.api.importBackupText(exactLegacyImportRaw);
assert.equal(primaryFailureResult.ok, false);
assert.strictEqual(primaryFailure.api.getState(), primaryFailureState);
assert.equal(primaryFailure.storage.get("fitRoulette.v1"), importBaselineRaw);
assert.equal(primaryFailure.storage.get(Smart.RECOVERY_KEY), exactLegacyImportRaw, "Protected original must remain after primary write failure.");
assert.equal(primaryFailure.elements.get("closetList").innerHTML, primaryFailureCloset);
assert(primaryFailure.api.protectedOriginals().some((record) => record.key === Smart.RECOVERY_KEY));
assert(primaryFailure.elements.get("toast").textContent.includes("could not be replaced"));

const repeatedImportRaw = JSON.stringify({ version: 3, wardrobe: [], history: [], bannedCombos: [], feedback: [], settings: { defaultOccasion: "work" } });
const repeatedImport = runApp(importBaselineRaw);
assert.equal(repeatedImport.api.importBackupText(exactLegacyImportRaw).ok, true);
assert.equal(repeatedImport.api.importBackupText(repeatedImportRaw).ok, true);
assert.equal(repeatedImport.storage.get(Smart.RECOVERY_KEY), exactLegacyImportRaw, "Repeated legacy imports must retain the first protected original.");

const malformedImport = runApp(importBaselineRaw);
const malformedImportState = malformedImport.api.getState();
assert.equal(malformedImport.api.importBackupText("{ definitely not json").ok, false);
assert.strictEqual(malformedImport.api.getState(), malformedImportState);
assert.equal(malformedImport.storage.get("fitRoulette.v1"), importBaselineRaw);
assert.equal(malformedImport.storage.has(Smart.RECOVERY_KEY), false);
assert.equal(malformedImport.confirmations.length, 0);

const futureImport = runApp(importBaselineRaw, { initialRecovery: existingRecoveryRaw });
const futureImportState = futureImport.api.getState();
assert.equal(futureImport.api.importBackupText(JSON.stringify({ schemaVersion: 9, wardrobe: [] })).ok, false);
assert.strictEqual(futureImport.api.getState(), futureImportState);
assert.equal(futureImport.storage.get("fitRoulette.v1"), importBaselineRaw);
assert.equal(futureImport.storage.get(Smart.RECOVERY_KEY), existingRecoveryRaw);
assert.equal(futureImport.confirmations.length, 0);

const coordinateImport = runApp(importBaselineRaw);
const coordinateImportState = coordinateImport.api.getState();
const coordinateImportResult = coordinateImport.api.importBackupText(JSON.stringify({ schemaVersion: 4, wardrobe: [], settings: { weather: { latitude: 12.3, longitude: 45.6 } } }));
assert.equal(coordinateImportResult.ok, false);
assert.equal(coordinateImportResult.error.code, "PRIVACY_VIOLATION");
assert.strictEqual(coordinateImport.api.getState(), coordinateImportState);
assert.equal(coordinateImport.storage.get("fitRoulette.v1"), importBaselineRaw);
assert.equal(coordinateImport.storage.has(Smart.RECOVERY_KEY), false, "Coordinate-bearing imports must be rejected before creating any recovery copy.");
assert.equal(coordinateImport.confirmations.length, 0);

const schemaFiveImportState = Smart.createFreshState("2026-08-08T13:00:00.000Z");
schemaFiveImportState.settings.defaultOccasion = "date";
const schemaFiveImportRaw = JSON.stringify(schemaFiveImportState);
const schemaFiveImport = runApp(importBaselineRaw);
const schemaFiveImportResult = schemaFiveImport.api.importBackupText(schemaFiveImportRaw);
assert.equal(schemaFiveImportResult.ok, true);
assert.equal(schemaFiveImportResult.legacy, false);
assert.equal(schemaFiveImport.storage.has(Smart.RECOVERY_KEY), false, "Schema-v5 import must not create an unnecessary legacy recovery.");
assert.equal(JSON.parse(schemaFiveImport.storage.get("fitRoulette.v1")).settings.defaultOccasion, "date");

const schemaFourImport = runApp(importBaselineRaw, { initialLegacyRecovery: schemaFourLegacyRecovery });
const schemaFourImportResult = schemaFourImport.api.importBackupText(releasedSchemaFourRaw);
assert.equal(schemaFourImportResult.ok, true);
assert.equal(schemaFourImportResult.legacy, true);
assert.equal(schemaFourImport.storage.get(schemaFourImportResult.recoveryKey), releasedSchemaFourRaw, "Confirmed schema-four import must be retained exactly before primary replacement.");
assert.equal(schemaFourImport.storage.get(Smart.LEGACY_RECOVERY_KEY), schemaFourLegacyRecovery);

const fresh = runApp(null);
assert.equal(fresh.api.getState().wardrobe.length, 0);
assert.equal(fresh.api.getState().setup.completed, false);
assert(fresh.elements.get("freshSetup").innerHTML.includes("Start with an empty closet"));
const freshSetupWasShown = !fresh.elements.get("freshSetup").hidden;

const intentionallyEmpty = runApp(JSON.stringify({ version: 3, wardrobe: [], history: [], bannedCombos: [], feedback: [], settings: {} }));
assert.equal(intentionallyEmpty.api.getState().wardrobe.length, 0);
assert.equal(intentionallyEmpty.api.getState().setup.completed, true);
assert.equal(intentionallyEmpty.elements.get("freshSetup").hidden, true);
assert(fresh.elements.get("occasionSelect").innerHTML.includes("Athletic"), "Athletic must be available for new generation contexts.");
assert(!fresh.elements.get("occasionSelect").innerHTML.includes("Gym / Errands"), "Legacy Gym / Errands must not be offered as a new generation context.");

const now = "2026-08-07T12:00:00.000Z";
function item(id, subtype, color, overrides = {}) {
  return Smart.createItem({
    id, name: id, ...Smart.SUBTYPE_TEMPLATES[subtype], primaryColor: color, status: "available", preference: "neutral", labels: [],
    review: { status: "reviewed", reasons: [], reviewedAt: now }, legacyFallback: false, legacyMatching: {}, ...overrides
  }, { now });
}

const legacyGymItem = item("legacy_gym_item", "athletic top", "Black", {
  occasions: ["gym"], review: { status: "needs_review", reasons: ["Legacy Gym / Errands is ambiguous."], reviewedAt: "" }
});
const legacyOccasionApp = runApp(JSON.stringify({
  ...Smart.createFreshState(now), setup: { completed: true, choice: "existing" }, wardrobe: [legacyGymItem]
}));
assert(legacyOccasionApp.elements.get("occasionSelect").innerHTML.includes("legacy closet only"), "Legacy generation context must remain readable when the closet still contains ambiguous data.");
legacyOccasionApp.api.openItemDialog(legacyGymItem.id);
assert(legacyOccasionApp.elements.get("itemOccasions").innerHTML.includes("Legacy Gym / Errands"), "Stored ambiguous occasion must remain visible for explicit correction.");
assert(legacyOccasionApp.api.collectItemFromForm().occasions.includes("gym"), "Opening an existing item must not silently discard its legacy occasion.");
legacyOccasionApp.api.closeItemDialog({ force: true });

const fridayJeans = item("friday_jeans", "jeans", "Navy", { occasions: ["friday", "casual"] });
const fridayAuditApp = runApp(JSON.stringify({
  ...Smart.createFreshState(now), setup: { completed: true, choice: "existing" }, wardrobe: [
    item("friday_top", "button-down", "Blue", { occasions: ["work", "friday"] }),
    fridayJeans,
    item("friday_shoes", "dress shoes", "Brown", { occasions: ["work", "friday"] }),
    item("friday_belt", "dress belt", "Brown", { occasions: ["work", "friday"] }),
    item("friday_socks", "dress socks", "Navy", { occasions: ["work", "friday"] })
  ]
}));
assert(!fridayAuditApp.api.pickOutfit("friday", fridayJeans.id).error, "Friday Jeans must remain functional for legacy and current data.");
assert(fridayAuditApp.api.pickOutfit("work", fridayJeans.id).error, "Work plus Build Around Jeans is not equivalent when the jeans exclude Work.");
legacyOccasionApp.api.openItemDialog();
assert(!legacyOccasionApp.elements.get("itemOccasions").innerHTML.includes("Legacy Gym / Errands"), "Legacy Gym / Errands must not be offered for a new assignment.");
legacyOccasionApp.api.closeItemDialog({ force: true });

const fieldTopA = item("field_top_a", "polo", "Navy", { name: "Navy Weekend Polo", labels: ["travel"], occasions: ["casual", "date"] });
const fieldTopB = item("field_top_b", "t-shirt", "White", { name: "White Tee", occasions: ["casual", "date"] });
const fieldTopAlt = item("field_top_alt", "t-shirt", "Gray", { name: "Gray Tee", occasions: ["casual", "date"] });
const fieldLayer = item("field_layer", "jacket", "Olive", { name: "Olive Jacket", occasions: ["casual", "date"] });
const fieldBottom = item("field_bottom", "jeans", "Navy", { name: "Navy Jeans", beltMode: "optional", occasions: ["casual", "date"] });
const fieldShoes = item("field_shoes", "dress shoes", "Brown", { name: "Formal Brown Shoes", occasions: ["casual", "date"] });
const fieldBelt = item("field_belt", "casual belt", "Brown", { name: "Brown Belt", occasions: ["casual", "date"] });
const validStoredPair = { id: "valid_stored_pair", type: "prefer", itemIds: Smart.canonicalPair(fieldTopA.id, fieldLayer.id), createdAt: now, updatedAt: now };
const impossibleStoredPair = { id: "impossible_stored_pair", type: "never", itemIds: Smart.canonicalPair(fieldTopA.id, fieldTopB.id), createdAt: now, updatedAt: now };
const fieldState = {
  ...Smart.createFreshState(now),
  setup: { completed: true, choice: "existing" },
  wardrobe: [fieldTopA, fieldTopB, fieldTopAlt, fieldLayer, fieldBottom, fieldShoes, fieldBelt],
  pairRelationships: [validStoredPair, impossibleStoredPair]
};

const editorApp = runApp(JSON.stringify(fieldState));
editorApp.elements.get("itemForm").scrollTop = 640;
editorApp.elements.get("itemDialog").scrollTop = 240;
editorApp.api.openItemDialog(fieldTopA.id);
assert.equal(editorApp.elements.get("itemForm").scrollTop, 0, "Each editor open must reset the scrolling form to the top.");
assert.equal(editorApp.elements.get("itemDialog").scrollTop, 0, "Each editor open must reset the dialog to the top.");
editorApp.elements.get("preferItemsSelect").selectedOptions = [{ value: fieldLayer.id }];
editorApp.elements.get("neverItemsSelect").selectedOptions = [{ value: fieldTopB.id }];
editorApp.elements.get("itemName").value = "Navy Weekend Polo Updated";
const writesBeforeValidSave = editorApp.storageWriteAttempts.filter((entry) => entry.key === "fitRoulette.v1").length;
assert.equal(editorApp.api.saveItemFromEditor({ generateAfter: false }), true);
assert.equal(editorApp.elements.get("itemDialog").open, false, "A valid save must close the editor.");
assert.equal(editorApp.storageWriteAttempts.filter((entry) => entry.key === "fitRoulette.v1").length - writesBeforeValidSave, 1, "A valid save must persist exactly once.");
assert.equal(editorApp.api.getState().wardrobe.find((entry) => entry.id === fieldTopA.id).name, "Navy Weekend Polo Updated");
const writesAfterClosedSave = editorApp.storageWriteAttempts.length;
assert.equal(editorApp.api.saveItemFromEditor({ generateAfter: false }), false, "A stale submit after close must be ignored.");
assert.equal(editorApp.storageWriteAttempts.length, writesAfterClosedSave);

editorApp.elements.get("itemForm").scrollTop = 500;
editorApp.api.openItemDialog(fieldTopA.id);
assert.equal(editorApp.elements.get("itemForm").scrollTop, 0, "Repeated editor cycles must reset scroll without stale state.");
editorApp.elements.get("itemName").value = "";
const invalidWrites = editorApp.storageWriteAttempts.length;
assert.equal(editorApp.api.saveItemFromEditor({ generateAfter: false }), false);
assert.equal(editorApp.elements.get("itemDialog").open, true, "Invalid save must remain in the editor.");
assert.equal(editorApp.elements.get("formError").hidden, false);
assert(editorApp.elements.get("formError").textContent.includes("Name is required"));
assert.equal(editorApp.elements.get("itemName").focused, true, "Validation must focus the blocking field.");
assert.equal(editorApp.storageWriteAttempts.length, invalidWrites, "Invalid save must not attempt persistence.");
assert.equal(editorApp.elements.get("itemForm").listenerAdds.get("submit"), 1, "Repeated opens must not accumulate submit handlers.");

const failureApp = runApp(JSON.stringify(fieldState), { failSetItem: (key) => key === "fitRoulette.v1" });
const failureStateBefore = JSON.stringify(failureApp.api.getState());
failureApp.api.openItemDialog(fieldTopA.id);
failureApp.elements.get("itemName").value = "Unsaved storage failure";
failureApp.elements.get("preferItemsSelect").selectedOptions = [{ value: fieldLayer.id }];
failureApp.elements.get("neverItemsSelect").selectedOptions = [{ value: fieldTopB.id }];
assert.equal(failureApp.api.saveItemFromEditor({ generateAfter: false }), false);
assert.equal(failureApp.elements.get("itemDialog").open, true, "Persistence failure must keep the editor open.");
assert.equal(JSON.stringify(failureApp.api.getState()), failureStateBefore, "Persistence failure must not mutate in-memory closet state.");
assert(failureApp.elements.get("formError").textContent.includes("not saved"));

const guardedCloseApp = runApp(JSON.stringify(fieldState), { confirmResult: false });
guardedCloseApp.api.openItemDialog(fieldTopA.id);
guardedCloseApp.elements.get("itemNotes").value = "Unsaved note";
assert.equal(guardedCloseApp.api.closeItemDialog(), false, "Declining discard confirmation must keep unsaved edits open.");
assert.equal(guardedCloseApp.elements.get("itemDialog").open, true);

editorApp.elements.get("itemCategory").value = "top";
const topCandidateIds = editorApp.api.relationshipCandidates(fieldTopA.id).map((entry) => entry.id);
assert(!topCandidateIds.includes(fieldTopA.id), "Current garment must be excluded from pair candidates.");
assert(!topCandidateIds.includes(fieldTopB.id), "Same-slot base tops must be excluded from new pair candidates.");
assert(topCandidateIds.includes(fieldLayer.id), "Base-top/layer relationships must remain selectable.");
assert(topCandidateIds.includes(fieldBottom.id));
editorApp.elements.get("itemCategory").value = "bottom";
const bottomCandidateIds = editorApp.api.relationshipCandidates(fieldBottom.id).map((entry) => entry.id);
assert(bottomCandidateIds.includes(fieldBelt.id), "Bottom/belt relationships must remain selectable.");

const relationCopy = JSON.parse(JSON.stringify(fieldState));
editorApp.api.syncPairRelationships(relationCopy, fieldTopA.id, [fieldLayer.id], [fieldTopB.id], now);
assert(relationCopy.pairRelationships.some((record) => record.id === validStoredPair.id), "Existing valid relationships must survive unchanged edits.");
assert(relationCopy.pairRelationships.some((record) => record.id === impossibleStoredPair.id), "Existing impossible relationships must not be silently destroyed.");
editorApp.api.syncPairRelationships(relationCopy, fieldTopA.id, [fieldLayer.id], [], now);
assert(!relationCopy.pairRelationships.some((record) => record.id === impossibleStoredPair.id), "Explicitly clearing a stored exception must remove it.");
const contradictoryCopy = JSON.parse(JSON.stringify(fieldState));
editorApp.api.syncPairRelationships(contradictoryCopy, fieldTopA.id, [fieldLayer.id], [fieldLayer.id], now);
const contradictoryRecords = contradictoryCopy.pairRelationships.filter((record) => record.itemIds.includes(fieldTopA.id) && record.itemIds.includes(fieldLayer.id));
assert.equal(contradictoryRecords.length, 1, "The relationship model must never store contradictory duplicate pairs.");

const largeCandidateApp = runApp(JSON.stringify({
  ...Smart.createFreshState(now), setup: { completed: true, choice: "existing" },
  wardrobe: [fieldBottom, ...Array.from({ length: 120 }, (_, index) => item(`large_shoe_${index}`, "sneakers", "Gray", { occasions: ["casual"] }))]
}));
largeCandidateApp.elements.get("itemCategory").value = "bottom";
assert.equal(largeCandidateApp.api.relationshipCandidates(fieldBottom.id).length, 120, "Grouped relationship candidates must not truncate large closets.");

const inconsistentSolid = item("inconsistent_solid", "polo", "Cerulean", {
  name: "Cerulean Polo", secondaryColor: "Cream", pattern: "solid", occasions: ["casual"]
});
const colorApp = runApp(JSON.stringify({
  ...Smart.createFreshState(now), setup: { completed: true, choice: "existing" }, wardrobe: [inconsistentSolid]
}));
assert.equal(colorApp.api.getState().wardrobe[0].secondaryColor, "Cream", "Loading must not bulk-rewrite an inconsistent schema-v4 garment.");
colorApp.api.openItemDialog(inconsistentSolid.id);
assert.equal(colorApp.elements.get("itemSecondaryColor").disabled, true, "Solid must disable Secondary Color visibly.");
assert.equal(colorApp.api.collectItemFromForm().secondaryColor, "", "Solid must collect the canonical absent-secondary value.");
assert.equal(colorApp.api.saveItemFromEditor({ generateAfter: false }), true);
assert.equal(colorApp.api.getState().wardrobe[0].secondaryColor, "", "Reviewing and saving a solid garment must clear stale secondary color.");
colorApp.api.openItemDialog(inconsistentSolid.id);
colorApp.elements.get("itemPattern").value = "plaid";
colorApp.api.updateSecondaryColorAvailability();
assert.equal(colorApp.elements.get("itemSecondaryColor").disabled, false, "A multi-color pattern must enable Secondary Color.");
colorApp.api.setColorControl("primary", "Cerulean");
colorApp.api.setColorControl("secondary", "Cream");
assert.equal(colorApp.api.saveItemFromEditor({ generateAfter: false }), true);
assert.equal(colorApp.api.getState().wardrobe[0].primaryColor, "Cerulean", "Custom primary color casing must survive save.");
assert.equal(colorApp.api.getState().wardrobe[0].secondaryColor, "Cream", "Canonical or custom secondary colors must survive save.");
const colorRoundTrip = runApp(colorApp.storage.get("fitRoulette.v1"));
assert.equal(colorRoundTrip.api.getState().wardrobe[0].primaryColor, "Cerulean");
assert.equal(colorRoundTrip.api.getState().wardrobe[0].secondaryColor, "Cream");
colorRoundTrip.api.openItemDialog(inconsistentSolid.id);
colorRoundTrip.elements.get("itemPrimaryColor").value = "__custom__";
colorRoundTrip.elements.get("itemPrimaryColorCustom").value = "";
assert(colorRoundTrip.api.validateItem(colorRoundTrip.api.collectItemFromForm()).message.includes("Primary color is required"));

assert(editorApp.api.matchesClosetSearch(fieldTopA, "navy polo"), "Multi-term search must match across structured fields.");
assert(editorApp.api.matchesClosetSearch(fieldShoes, "formal brown shoes"), "Formality, color, and category must combine predictably.");
assert(editorApp.api.matchesClosetSearch(inconsistentSolid, "cerulean polo"), "Custom colors must remain searchable.");
assert(!editorApp.api.matchesClosetSearch(inconsistentSolid, "cream"), "Solid garments must not match stale secondary-color state.");
assert(editorApp.api.matchesClosetSearch(fieldTopA, "travel"), "User labels must remain searchable.");
const scoreBeforeSearch = editorApp.api.scoreOutfit([fieldTopA, fieldBottom, fieldShoes], "casual", { randomize: false });
editorApp.api.matchesClosetSearch(fieldTopA, "navy polo");
assert.equal(editorApp.api.scoreOutfit([fieldTopA, fieldBottom, fieldShoes], "casual", { randomize: false }), scoreBeforeSearch, "Closet search must not alter outfit scoring.");

function beltTestState(bottom, belt, extraRelationships = [], extraWardrobe = []) {
  return {
    ...Smart.createFreshState(now), setup: { completed: true, choice: "existing" },
    wardrobe: [
      item("belt_test_top", "t-shirt", "White", { occasions: ["casual"] }),
      item("belt_test_top_alt", "polo", "Gray", { occasions: ["casual"] }),
      bottom,
      item("belt_test_shoes", "sneakers", "White", { occasions: ["casual"] }),
      ...(belt ? [belt] : []),
      ...extraWardrobe
    ],
    pairRelationships: extraRelationships
  };
}

const optionalBottom = item("optional_bottom", "jeans", "Navy", { beltMode: "optional", occasions: ["casual"] });
const requiredBottom = item("required_bottom", "chinos", "Khaki", { beltMode: "required", occasions: ["casual"] });
const noBeltBottom = item("no_belt_bottom", "athletic shorts", "Black", { beltMode: "none", occasions: ["casual"] });
const availableBelt = item("available_belt", "casual belt", "Brown", { occasions: ["casual"] });

const optionalBeltApp = runApp(JSON.stringify(beltTestState(optionalBottom, availableBelt)));
const optionalOutfit = optionalBeltApp.api.pickOutfit("casual", "");
assert(!optionalOutfit.error, optionalOutfit.error);
assert(optionalOutfit.items.some((entry) => entry.category === "belt"), "Optional Belt must default to a compatible belt when available.");
optionalBeltApp.api.setCurrentOutfit(optionalOutfit);
const historyBeforeRemoval = optionalBeltApp.api.getState().history.length;
const writesBeforeRemoval = optionalBeltApp.storageWriteAttempts.length;
assert.equal(optionalBeltApp.api.removeOptionalBelt(), true);
assert(!optionalBeltApp.api.getCurrentOutfit().items.some((entry) => entry.category === "belt"));
assert.equal(optionalBeltApp.api.getState().history.length, historyBeforeRemoval, "Removing an unlogged belt must not write history.");
assert.equal(optionalBeltApp.storageWriteAttempts.length, writesBeforeRemoval, "Removing an optional belt must remain in-memory until logging.");
assert.equal(optionalBeltApp.api.lastItemWornDate(availableBelt), null, "Removed-but-unlogged belts must not gain recency.");
const topToSwap = optionalBeltApp.api.getCurrentOutfit().items.find((entry) => entry.category === "top");
assert(optionalBeltApp.api.swapChoiceReport(topToSwap).eligible.every((choice) => !choice.items.some((entry) => entry.category === "belt")), "Unrelated swaps must not restore a removed optional belt.");
optionalBeltApp.api.logCurrentOutfit();
assert(!optionalBeltApp.api.getState().history[0].itemIds.includes(availableBelt.id), "Logged history must exclude a removed belt.");
assert.equal(optionalBeltApp.api.lastItemWornDate(availableBelt), null, "Logging after removal must not mark the belt used.");

const requiredBeltApp = runApp(JSON.stringify(beltTestState(requiredBottom, availableBelt)));
const requiredOutfit = requiredBeltApp.api.pickOutfit("casual", "");
assert(!requiredOutfit.error, requiredOutfit.error);
assert(requiredOutfit.items.some((entry) => entry.category === "belt"), "Required Belt must generate a compatible belt.");
requiredBeltApp.api.setCurrentOutfit(requiredOutfit);
assert.equal(requiredBeltApp.api.removeOptionalBelt(), false, "Required belts must not be removable through the optional-belt action.");

const noBeltApp = runApp(JSON.stringify(beltTestState(noBeltBottom, availableBelt)));
const noBeltOutfit = noBeltApp.api.pickOutfit("casual", "");
assert(!noBeltOutfit.error, noBeltOutfit.error);
assert(!noBeltOutfit.items.some((entry) => entry.category === "belt"), "No Belt must never generate a belt.");

const incompatibleBeltPair = { id: "never_optional_belt", type: "never", itemIds: Smart.canonicalPair(optionalBottom.id, availableBelt.id), createdAt: now, updatedAt: now };
const optionalNoCompatibleApp = runApp(JSON.stringify(beltTestState(optionalBottom, availableBelt, [incompatibleBeltPair])));
const optionalWithoutCompatible = optionalNoCompatibleApp.api.pickOutfit("casual", "");
assert(!optionalWithoutCompatible.error, "Optional Belt must not block generation when no compatible belt exists.");
assert(!optionalWithoutCompatible.items.some((entry) => entry.category === "belt"));

const incompatibleRequiredPair = { id: "never_required_belt", type: "never", itemIds: Smart.canonicalPair(requiredBottom.id, availableBelt.id), createdAt: now, updatedAt: now };
const requiredNoCompatibleApp = runApp(JSON.stringify(beltTestState(requiredBottom, availableBelt, [incompatibleRequiredPair])));
assert(requiredNoCompatibleApp.api.pickOutfit("casual", "").error, "Required Belt must not generate an outfit that violates its belt requirement.");

const ineligibleBeltsApp = runApp(JSON.stringify(beltTestState(optionalBottom, null, [], [
  item("unavailable_belt", "casual belt", "Brown", { occasions: ["casual"], status: "unavailable" }),
  item("archived_belt", "casual belt", "Black", { occasions: ["casual"], status: "archived" })
])));
const ineligibleBeltsOutfit = ineligibleBeltsApp.api.pickOutfit("casual", "");
assert(!ineligibleBeltsOutfit.error);
assert(!ineligibleBeltsOutfit.items.some((entry) => entry.category === "belt"), "Archived and unavailable belts must remain ineligible.");

const tops = [item("top", "t-shirt", "White")];
const bottoms = [item("bottom", "jeans", "Navy")];
const shoes = Array.from({ length: 10 }, (_, index) => item(`shoes_${index}`, "sneakers", index % 2 ? "White" : "Gray"));
const unavailableShoe = item("shoes_unavailable", "sneakers", "Black", { status: "unavailable" });
const occasionShoe = item("shoes_date_only", "sneakers", "White", { occasions: ["date"] });
const swapState = {
  ...Smart.createFreshState(now),
  setup: { completed: true, choice: "existing" },
  wardrobe: [...tops, ...bottoms, ...shoes, unavailableShoe, occasionShoe]
};
fresh.api.replaceState(swapState);
const outfit = { occasion: "casual", buildAroundId: "", items: [tops[0], bottoms[0], shoes[0]], score: 100 };
fresh.api.setCurrentOutfit(outfit);
const swapReport = fresh.api.swapChoiceReport(shoes[0]);
assert.equal(swapReport.eligible.length, 9, "Every compatible replacement beyond the old eight-item cap must be reachable.");
assert.equal(swapReport.excluded.status, 1);
assert.equal(swapReport.excluded.occasion, 1);

const globalBanTop = item("global_ban_top", "polo", "Navy", { occasions: ["casual", "date"] });
const globalBanBottom = item("global_ban_bottom", "chinos", "Khaki", { occasions: ["casual", "date"] });
const globalBanShoes = item("global_ban_shoes", "boots", "Brown", { occasions: ["casual", "date"] });
fresh.api.replaceState({
  ...Smart.createFreshState(now),
  setup: { completed: true, choice: "existing" },
  wardrobe: [globalBanTop, globalBanBottom, globalBanShoes],
  bannedCombos: [{ id: "global_ban", itemIds: [globalBanTop.id, globalBanBottom.id, globalBanShoes.id], occasion: "casual", createdAt: now }]
});
assert(fresh.api.pickOutfit("casual", "").error, "The exact outfit must be banned for its original occasion.");
assert(fresh.api.pickOutfit("date", "").error, "Exact outfit bans must remain global rather than occasion-specific.");

fresh.api.replaceState(swapState);

const contextBefore = fresh.api.generationContextKey("casual", "");
fresh.api.getState().wardrobe[0].labels = ["search only", "purple"];
assert.equal(fresh.api.generationContextKey("casual", ""), contextBefore, "Labels must not affect matching cache keys.");
fresh.api.getState().wardrobe[0].preference = "favorite";
assert.notEqual(fresh.api.generationContextKey("casual", ""), contextBefore, "Preference changes must invalidate candidate context.");

fresh.api.getState().history = [{ id: "history_old", date: "2026-07-01T12:00:00", occasion: "casual", itemIds: ["top"], itemSnapshots: [], source: "manual", note: "" }];
fresh.api.getState().wardrobe[0].lastWorn = "2026-08-01";
assert.equal(fresh.api.lastItemWornDate(fresh.api.getState().wardrobe[0]), "2026-07-01", "History must be authoritative when it can establish recency.");

const similarSource = { ...fresh.api.getState().wardrobe[0], status: "archived", lastWorn: "2026-08-01", legacyFallback: true };
const similar = fresh.api.similarItem(similarSource);
assert.equal(similar.status, "available");
assert.equal(similar.lastWorn, null);
assert.equal(similar.legacyFallback, false);

const manualTodayState = {
  ...swapState,
  history: [{ id: "today", date: new Date().toISOString(), occasion: "casual", itemIds: ["top", "bottom", "shoes_0"], itemSnapshots: [], source: "manual", note: "" }]
};
fresh.api.replaceState(manualTodayState);
assert(fresh.elements.get("todayLoggedNotice").innerHTML.includes("Today's fit is logged"));

const contextTop = item("context_top", "t-shirt", "White", { occasions: ["casual"], warmth: "light" });
const contextTopAlt = item("context_top_alt", "polo", "Navy", { occasions: ["casual"], warmth: "light" });
const contextBottom = item("context_bottom", "jeans", "Navy", { occasions: ["casual"], warmth: "light", beltMode: "optional" });
const contextShoes = item("context_shoes", "boots", "Brown", { occasions: ["casual"], warmth: "medium" });
const contextBelt = item("context_belt", "casual belt", "Brown", { occasions: ["casual"] });
const contextLayer = item("context_layer", "coat", "Black", {
  occasions: ["casual"], warmth: "very_warm", layerRoles: ["outer"], rainProtection: "protected", windProtection: "protected"
});
const baseRoleOnlyLayer = item("base_role_only_layer", "hoodie", "Gray", {
  occasions: ["casual"], layerRoles: ["base"], rainProtection: "none", windProtection: "none"
});
const contextApp = runApp(JSON.stringify({
  ...Smart.createFreshState(now), setup: { completed: true, choice: "existing" },
  wardrobe: [contextTop, contextTopAlt, contextBottom, contextShoes, contextBelt, contextLayer, baseRoleOnlyLayer]
}));
contextApp.api.setContextSession({
  mode: "manual", manualTemperatureC: 4.4, manualCondition: "clear", adjustment: "same",
  exposure: "outdoors", rainExpected: false, ignore: false
});
let coldOutfit = null;
for (let attempt = 0; attempt < 8; attempt += 1) {
  const candidate = contextApp.api.pickOutfit("casual", "");
  assert(candidate.items.filter((entry) => entry.category === "layer").length <= 1, "Generation must never add more than one automatic layer.");
  if (candidate.automaticLayerId === contextLayer.id) {
    coldOutfit = candidate;
    break;
  }
}
assert(coldOutfit, "The valid cold-weather layer must appear in the finite reroll pool.");
assert(!coldOutfit.error, coldOutfit.error);
assert.equal(coldOutfit.items.filter((entry) => entry.category === "layer").length, 1);
assert.equal(coldOutfit.automaticLayerId, contextLayer.id, "Only a valid Mid/Outer garment may be added automatically.");
assert(!coldOutfit.items.some((entry) => entry.id === baseRoleOnlyLayer.id), "A Base-only garment must not be used as the optional layer.");
assert(coldOutfit.items.some((entry) => entry.category === "belt"), "Optional belt behavior must survive a generated layer.");
contextApp.api.setCurrentOutfit(coldOutfit);
const bansBeforeLayerRemoval = contextApp.api.getState().bannedCombos.length;
assert.equal(contextApp.api.removeAutomaticLayer(), true);
assert(!contextApp.api.getCurrentOutfit().items.some((entry) => entry.category === "layer"));
assert.equal(contextApp.api.getState().bannedCombos.length, bansBeforeLayerRemoval, "Removing a layer must not create a ban.");
assert.equal(contextApp.api.lastItemWornDate(contextLayer), null, "Removed layers must receive no recency credit.");
assert.equal(contextApp.api.getRerollSession().automaticLayerSuppressed, true);
for (let attempt = 0; attempt < 3; attempt += 1) {
  const rerolledAfterRemoval = contextApp.api.pickOutfit("casual", "");
  assert.equal(rerolledAfterRemoval.automaticLayerId, "", "Reroll must not silently restore a layer removed in the current generation session.");
}
const remainingTop = contextApp.api.getCurrentOutfit().items.find((entry) => entry.category === "top");
assert(contextApp.api.swapChoiceReport(remainingTop).eligible.every((choice) => !choice.items.some((entry) => entry.category === "layer")), "Unrelated swaps must not restore a removed layer.");
contextApp.api.logCurrentOutfit();
const layerlessLog = contextApp.api.getState().history[0];
assert(!layerlessLog.itemIds.includes(contextLayer.id), "Logged history must record only the garments actually worn.");
assert.equal(layerlessLog.context.automaticLayerSuggested, true);
assert.equal(layerlessLog.context.automaticLayerRemoved, true);
assert.equal(contextApp.api.lastItemWornDate(contextLayer), null);
assert(!JSON.stringify(layerlessLog).match(/latitude|longitude|providerUrl/i), "History context must not contain coordinates or provider URLs.");

const midRoleTop = item("mid_role_top", "sweater", "Gray", {
  occasions: ["casual"], warmth: "very_warm", layerRoles: ["mid"], rainProtection: "none", windProtection: "light"
});
const roleLayerApp = runApp(JSON.stringify({
  ...Smart.createFreshState(now), setup: { completed: true, choice: "existing" },
  wardrobe: [contextTop, contextBottom, contextShoes, midRoleTop, baseRoleOnlyLayer]
}));
roleLayerApp.api.setContextSession({
  mode: "manual", manualTemperatureC: 4.4, manualCondition: "clear", adjustment: "same",
  exposure: "outdoors", rainExpected: false, ignore: false
});
assert(!roleLayerApp.api.candidateItems({ key: "top", categories: ["top"] }, "casual").some((entry) => entry.id === midRoleTop.id), "A Mid-only top must not fill the Base slot.");
let roleLayerOutfit = null;
for (let attempt = 0; attempt < 8; attempt += 1) {
  const candidate = roleLayerApp.api.pickOutfit("casual", "");
  if (candidate.automaticLayerId === midRoleTop.id) {
    roleLayerOutfit = candidate;
    break;
  }
}
assert(roleLayerOutfit, "A Mid-role top must appear in the finite reroll pool as an automatic layer.");
assert(!roleLayerOutfit.error, roleLayerOutfit.error);
assert.equal(roleLayerOutfit.automaticLayerId, midRoleTop.id, "Layer role, not garment category, must permit a Mid-role sweater as the automatic layer.");
assert.equal(roleLayerOutfit.items.filter((entry) => entry.category === "top").length, 2);
roleLayerApp.api.getState().wardrobe.push(contextLayer);
roleLayerApp.api.setCurrentOutfit(roleLayerOutfit);
const roleLayerSwaps = roleLayerApp.api.swapChoiceReport(midRoleTop);
assert(roleLayerSwaps.eligible.some((choice) => choice.replacementId === contextLayer.id), "An automatic layer may swap across garment categories when the replacement has a valid role.");
assert(roleLayerSwaps.eligible.every((choice) => {
  const replacement = choice.items.find((entry) => entry.id === choice.replacementId);
  return roleLayerApp.api.isAutomaticLayerCandidate(replacement);
}), "Automatic-layer swap choices must expose only available Mid/Outer garments.");

const blockedRoleState = Smart.setRelationship({
  ...Smart.createFreshState(now), setup: { completed: true, choice: "existing" },
  wardrobe: [contextTop, contextBottom, contextShoes, midRoleTop]
}, contextTop.id, midRoleTop.id, "never", now);
const blockedRoleApp = runApp(JSON.stringify(blockedRoleState));
blockedRoleApp.api.setContextSession({ mode: "manual", manualTemperatureC: -20, manualCondition: "snow", exposure: "outdoors", ignore: false });
const blockedRoleOutfit = blockedRoleApp.api.pickOutfit("casual", "");
assert(!blockedRoleOutfit.error, "No suitable compatible layer must not block base outfit generation.");
assert.equal(blockedRoleOutfit.automaticLayerId, "", "A Never pair rule must exclude a role-based automatic layer.");
assert(blockedRoleOutfit.contextAssessment.shortfall > 1 && blockedRoleOutfit.contextAssessment.sufficient === false, "Severe conditions must report the remaining single-layer limitation honestly.");

const warmApp = runApp(JSON.stringify({
  ...Smart.createFreshState(now), setup: { completed: true, choice: "existing" },
  wardrobe: [contextTop, contextBottom, contextShoes, contextLayer]
}));
warmApp.api.setContextSession({ mode: "manual", manualTemperatureC: 27, manualCondition: "clear", exposure: "outdoors", ignore: false });
const warmOutfit = warmApp.api.pickOutfit("casual", "");
assert(!warmOutfit.error);
assert(!warmOutfit.items.some((entry) => entry.category === "layer"), "Warm conditions should not add an automatic layer.");
warmApp.api.setContextSession({ ignore: true });
const neutralOutfit = warmApp.api.pickOutfit("casual", "");
assert(!neutralOutfit.error);
assert.equal(neutralOutfit.context.source, "ignored");
assert(!neutralOutfit.items.some((entry) => entry.category === "layer"), "Ignore Weather must restore weather-neutral generation.");

async function verifyAsyncWeatherState() {
  const cached = ContextEngine.normalizeProviderResponse({ current: {
    temperature_2m: 12, apparent_temperature: 10, precipitation: 0, rain: 0, showers: 0,
    snowfall: 0, weather_code: 2, wind_speed_10m: 12, is_day: 1, time: "2026-08-08T12:00"
  } }, { fetchedAt: new Date().toISOString() });
  const weatherState = Smart.createFreshState(now);
  weatherState.setup = { completed: true, choice: "existing" };
  weatherState.settings.weather.cached = cached;
  const geolocation = { getCurrentPosition(success) { success({ coords: { latitude: 12.34567, longitude: 45.67891 } }); } };
  const providerPayload = { current: {
    temperature_2m: 14, apparent_temperature: 13, precipitation: 0.2, rain: 0.2, showers: 0,
    snowfall: 0, weather_code: 61, wind_speed_10m: 18, is_day: 1, time: "2026-08-08T13:00"
  } };

  const offlineApp = runApp(JSON.stringify(weatherState), {
    geolocation,
    fetchImpl: async () => { throw new Error("offline"); }
  });
  assert.equal(offlineApp.api.currentEffectiveContext().source, "cached", "Fresh provider data loaded from storage must be labeled cached.");
  assert.equal(await offlineApp.api.refreshWeather({ force: true, userInitiated: true }), false);
  assert.deepEqual(offlineApp.api.getState().settings.weather.cached, cached, "A failed refresh must preserve the last valid cached context.");

  const storageFailureApp = runApp(JSON.stringify(weatherState), {
    geolocation,
    fetchImpl: async () => ({ ok: true, json: async () => providerPayload }),
    failSetItem: (key) => key === "fitRoulette.v1"
  });
  assert.equal(await storageFailureApp.api.refreshWeather({ force: true, userInitiated: true }), false);
  assert.deepEqual(storageFailureApp.api.getState().settings.weather.cached, cached, "A weather storage failure must roll back the in-memory cache.");

  const weatherApp = runApp(JSON.stringify(weatherState), {
    geolocation,
    fetchImpl: async () => ({ ok: true, json: async () => providerPayload })
  });
  assert.equal(await weatherApp.api.refreshWeather({ force: true, userInitiated: true }), true);
  assert.equal(weatherApp.api.getState().settings.weather.automatic, true);
  assert.equal(weatherApp.api.getState().settings.weather.cached.condition, "rain");
  assert.equal(weatherApp.api.currentEffectiveContext().source, "current", "A successful in-session refresh must be labeled current.");
  assert(!/latitude|longitude|accuracy|coordinates/i.test(JSON.stringify(weatherApp.api.getState().settings.weather.cached)));
  const reloadedWeatherApp = runApp(weatherApp.storage.get("fitRoulette.v1"));
  assert.equal(reloadedWeatherApp.api.currentEffectiveContext().source, "cached", "Reload must not represent persisted provider data as newly fetched.");
  weatherApp.api.disableAutomaticWeather();
  assert.equal(weatherApp.api.getState().settings.weather.automatic, false);
  assert.equal(weatherApp.api.getState().settings.weather.cached, null);

  const disableFailureState = JSON.parse(JSON.stringify(weatherState));
  disableFailureState.settings.weather.automatic = true;
  const disableFailureApp = runApp(JSON.stringify(disableFailureState), {
    failSetItem: (key) => key === "fitRoulette.v1"
  });
  disableFailureApp.api.disableAutomaticWeather();
  assert.equal(disableFailureApp.api.getState().settings.weather.automatic, true, "Disable must roll back if the updated state cannot be persisted.");
  assert.deepEqual(disableFailureApp.api.getState().settings.weather.cached, cached);
}

verifyAsyncWeatherState().then(() => {
  console.log(JSON.stringify({
    ok: true,
    migratedItems: migratedState.wardrobe.length,
    recoveryCreated: migratedApp.storage.has(Smart.RECOVERY_KEY),
    legacyImportRecoveryCreated: importedLegacyResult.recoveryCreated,
    legacyImportFailureCases: 5,
    existingRecoveryPreserved: existingRecovery.storage.get(Smart.RECOVERY_KEY) === existingRecoveryRaw,
    editorTransactionalSave: true,
    groupedRelationshipCandidates: largeCandidateApp.api.relationshipCandidates(fieldBottom.id).length,
    structuredSearch: true,
    optionalBeltRemoval: true,
    optionalLayerRemoval: true,
    weatherFailureRollback: true,
    swapEligible: swapReport.eligible.length,
    freshSetupShown: freshSetupWasShown
  }));
}).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
