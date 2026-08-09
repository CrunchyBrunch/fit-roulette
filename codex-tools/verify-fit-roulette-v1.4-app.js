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
  swapEligible: swapReport.eligible.length,
  freshSetupShown: freshSetupWasShown
}));
