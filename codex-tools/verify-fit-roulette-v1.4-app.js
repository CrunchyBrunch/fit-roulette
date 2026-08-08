const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("assert");
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
    this.selectedOptions = [];
    this.files = [];
    this.style = {};
  }
  addEventListener(type, callback) { this.listeners.set(type, callback); }
  click() { this.listeners.get("click")?.({ target: this, preventDefault() {} }); }
  focus() { this.focused = true; }
  close() { this.open = false; }
  showModal() { this.open = true; }
  scrollIntoView() {}
  setAttribute(name, value) { this[name] = value; }
  removeAttribute(name) { delete this[name]; }
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
  const occasionInputs = ["work", "friday", "casual", "date", "gym"].map((value) => Object.assign(new MockElement(), { value, name: "itemOccasion" }));
  const beltInputs = ["required", "optional", "none"].map((value) => Object.assign(new MockElement(), { value, name: "itemBeltMode" }));
  const feedbackInputs = ["colors", "top_pants", "shoes", "belt_shoes", "too_formal", "too_casual", "weather", "exact", "other"].map((value) => Object.assign(new MockElement(), { value, name: "feedbackReason" }));
  let domReady;
  const storage = new Map();
  const storageWrites = [];
  const storageWriteAttempts = [];
  const confirmations = [];
  const events = [];
  if (savedValue !== undefined && savedValue !== null) storage.set("fitRoulette.v1", savedValue);
  if (options.initialRecovery !== undefined && options.initialRecovery !== null) storage.set(Smart.RECOVERY_KEY, options.initialRecovery);

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
    removeItem(key) { storage.delete(key); }
  };
  const windowObject = {
    __FIT_ROULETTE_TESTING__: true,
    FitRouletteSmartCloset: Smart,
    addEventListener() {},
    confirm(message) {
      confirmations.push(message);
      events.push("confirm");
      return options.confirmResult !== false;
    },
    requestAnimationFrame(callback) { callback(); }
  };
  const context = {
    console: { log: console.log, warn: console.warn, error() {} },
    document,
    navigator: {},
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
assert.equal(migratedState.schemaVersion, 4);
assert.equal(migratedApp.storage.get(Smart.RECOVERY_KEY), legacyRaw, "Recovery copy must be the untouched pre-migration payload.");
assert.equal(JSON.parse(migratedApp.storage.get("fitRoulette.v1")).schemaVersion, 4);
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
assert.equal(JSON.parse(importedLegacy.storage.get("fitRoulette.v1")).schemaVersion, 4);
assert.equal(importedLegacy.api.getState().wardrobe[0].primaryColor, "Cerulean");
assert.equal(importedLegacy.elements.get("exportRecoveryBtn").hidden, false, "Protected-original control must enable immediately.");

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
assert.equal(existingRecoveryResult.recoveryCreated, false);
assert.equal(existingRecovery.storage.get(Smart.RECOVERY_KEY), existingRecoveryRaw, "Existing recovery must never be overwritten.");
assert.equal(existingRecovery.elements.get("exportRecoveryBtn").hidden, false);
assert(existingRecovery.elements.get("toast").textContent.includes("Existing protected original retained"));
assert(!existingRecovery.elements.get("toast").textContent.includes("Protected original saved"));

const invalidLegacyImportRaw = '{"version":3,"wardrobe":{},"history":[],"bannedCombos":[],"feedback":[]}';
const migrationFailure = runApp(importBaselineRaw);
const migrationFailureState = migrationFailure.api.getState();
const migrationFailureResult = migrationFailure.api.importBackupText(invalidLegacyImportRaw);
assert.equal(migrationFailureResult.ok, false);
assert.strictEqual(migrationFailure.api.getState(), migrationFailureState);
assert.equal(migrationFailure.storage.get("fitRoulette.v1"), importBaselineRaw);
assert.equal(migrationFailure.storage.get(Smart.RECOVERY_KEY), invalidLegacyImportRaw, "Recovery created before migration must remain available after validation failure.");
assert.equal(migrationFailure.elements.get("exportRecoveryBtn").hidden, false, "Recovery created before a failed migration must remain downloadable.");

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
assert.equal(primaryFailure.elements.get("exportRecoveryBtn").hidden, false);
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

const schemaFourImportState = Smart.createFreshState("2026-08-08T13:00:00.000Z");
schemaFourImportState.settings.defaultOccasion = "date";
const schemaFourImportRaw = JSON.stringify(schemaFourImportState);
const schemaFourImport = runApp(importBaselineRaw);
const schemaFourImportResult = schemaFourImport.api.importBackupText(schemaFourImportRaw);
assert.equal(schemaFourImportResult.ok, true);
assert.equal(schemaFourImportResult.legacy, false);
assert.equal(schemaFourImport.storage.has(Smart.RECOVERY_KEY), false, "Schema-v4 import must not create an unnecessary legacy recovery.");
assert.equal(JSON.parse(schemaFourImport.storage.get("fitRoulette.v1")).settings.defaultOccasion, "date");

const fresh = runApp(null);
assert.equal(fresh.api.getState().wardrobe.length, 0);
assert.equal(fresh.api.getState().setup.completed, false);
assert(fresh.elements.get("freshSetup").innerHTML.includes("Start with an empty closet"));
const freshSetupWasShown = !fresh.elements.get("freshSetup").hidden;

const intentionallyEmpty = runApp(JSON.stringify({ version: 3, wardrobe: [], history: [], bannedCombos: [], feedback: [], settings: {} }));
assert.equal(intentionallyEmpty.api.getState().wardrobe.length, 0);
assert.equal(intentionallyEmpty.api.getState().setup.completed, true);
assert.equal(intentionallyEmpty.elements.get("freshSetup").hidden, true);

const now = "2026-08-07T12:00:00.000Z";
function item(id, subtype, color, overrides = {}) {
  return Smart.createItem({
    id, name: id, ...Smart.SUBTYPE_TEMPLATES[subtype], primaryColor: color, status: "available", preference: "neutral", labels: [],
    review: { status: "reviewed", reasons: [], reviewedAt: now }, legacyFallback: false, legacyMatching: {}, ...overrides
  }, { now });
}

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

console.log(JSON.stringify({
  ok: true,
  migratedItems: migratedState.wardrobe.length,
  recoveryCreated: migratedApp.storage.has(Smart.RECOVERY_KEY),
  legacyImportRecoveryCreated: importedLegacyResult.recoveryCreated,
  legacyImportFailureCases: 5,
  existingRecoveryPreserved: existingRecovery.storage.get(Smart.RECOVERY_KEY) === existingRecoveryRaw,
  swapEligible: swapReport.eligible.length,
  freshSetupShown: freshSetupWasShown
}));
