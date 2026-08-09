if (process.env.FIT_ROULETTE_RUN_V133_HARNESS !== "1") {
  require("./verify-fit-roulette-smart-closet.js");
  require("./verify-fit-roulette-v1.5-app.js");
  process.exit(0);
}

const fs = require("fs");
const path = require("path");
const vm = require("vm");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

class MockClassList {
  add() {}
  remove() {}
  toggle() {}
}

class MockElement {
  constructor(id = "") {
    this.id = id;
    this.value = "";
    this.checked = false;
    this.hidden = false;
    this.innerHTML = "";
    this.textContent = "";
    this.dataset = {};
    this.classList = new MockClassList();
    this.listeners = new Map();
    this.selectedOptions = [];
  }
  addEventListener(type, callback) {
    this.listeners.set(type, callback);
  }
  click() {
    const callback = this.listeners.get("click");
    if (callback) callback({ target: this });
  }
  focus() {}
  close() {
    this.open = false;
  }
  showModal() {
    this.open = true;
  }
  scrollIntoView() {}
  setAttribute(name, value) {
    this[name] = value;
  }
  removeAttribute(name) {
    delete this[name];
  }
  closest(selector) {
    if (selector === "[data-action]" && this.dataset.action) return this;
    if (selector === "[data-template-id]" && this.dataset.templateId) return this;
    if (selector === "[data-color]" && this.dataset.color) return this;
    if (selector === "[data-match-kind]" && this.dataset.matchKind) return this;
    if (selector === "[data-occasion-preset]" && this.dataset.occasionPreset) return this;
    if (selector === "[data-quick-tag]" && this.dataset.quickTag) return this;
    if (selector === "[data-result-action]" && this.dataset.resultAction) return this;
    if (selector === "[data-replacement-id]" && this.dataset.replacementId) return this;
    return null;
  }
  querySelector() {
    return null;
  }
  querySelectorAll() {
    return [];
  }
}

const ids = [
  "toast", "quickAddBtn", "occasionSelect", "buildAroundCategorySelect", "buildAroundSelect", "buildAroundItemField", "generateBtn", "outfitResult", "resultActions",
  "rerollBtn", "logBtn", "banBtn", "rerollSessionStatus", "rerollSessionText", "resetViewedFitsBtn", "addItemBtn", "closetSearch", "closetCategory", "showInactive", "closetList",
  "historyList", "settingsStats", "themeSelect", "afterLoggingSelect", "defaultOccasionSelect", "appVersion", "exportBtn", "importBtn", "importFile",
  "resetDemoBtn", "clearBansBtn", "itemForm", "saveGenerateBtn", "closeItemDialogBtn", "duplicateItemBtn",
  "archiveItemBtn", "permanentDeleteBtn", "itemFormality", "formalityOutput", "itemCategory", "itemOccasions",
  "itemDialog", "itemQuickTags", "tagSuggestions", "matchingDetails", "advancedTagsDetails", "templateChips",
  "copyMatchingSelect", "copyMatchingBtn", "itemPrimaryColor", "itemSecondaryColors", "primaryColorChips",
  "worksMatchChips", "avoidMatchChips", "avoidItemsSelect", "itemDialogMode", "itemDialogTitle", "itemId",
  "itemName", "itemTags", "itemSeason", "itemWorksWithTags", "itemAvoidWithTags", "itemAvoidWithItems",
  "itemImageUrl", "itemNotes", "itemActive", "formError", "advancedDeleteDetails", "weatherDetails",
  "weatherSummary", "useWeather", "weatherTemperature", "weatherCondition", "weatherInputs",
  "manualLogGenerateBtn", "manualLogHistoryBtn", "manualLogForm", "closeManualLogBtn", "manualLogDialog",
  "manualLogDate", "manualLogOccasion", "manualIncludeUnavailable", "manualItemPicker", "manualLogError",
  "manualLogNote", "swapDialog", "swapDialogTitle", "closeSwapDialogBtn", "swapChoices", "feedbackDialog",
  "feedbackForm", "dismissFeedbackBtn", "skipFeedbackBtn", "feedbackChoices", "feedbackOtherField",
  "feedbackOther", "beltModeFieldset", "itemMinTemperature", "itemMaxTemperature", "itemRainSafe",
  "itemWarmthLevel", "itemWeatherConditions"
];

const elements = new Map(ids.map((id) => [id, new MockElement(id)]));
const tabButtons = ["generate", "closet", "history", "settings"].map((screen) => {
  const button = new MockElement();
  button.dataset.screen = screen;
  return button;
});
const screens = ["generate", "closet", "history", "settings"].map((screen) => {
  const element = new MockElement(`screen-${screen}`);
  element.id = `screen-${screen}`;
  return element;
});
const occasionInputs = ["work", "friday", "casual", "date", "gym"].map((occasion) => {
  const input = new MockElement();
  input.value = occasion;
  return input;
});
const beltModeInputs = ["required", "optional", "none"].map((value) => {
  const input = new MockElement();
  input.value = value;
  input.name = "itemBeltMode";
  return input;
});
const weatherConditionInputs = ["sunny", "cloudy", "rain", "snow", "windy"].map((value) => {
  const input = new MockElement();
  input.value = value;
  input.name = "itemWeatherCondition";
  return input;
});
const feedbackReasonInputs = ["colors", "top_pants", "shoes", "belt_shoes", "too_formal", "too_casual", "weather", "exact", "other"].map((value) => {
  const input = new MockElement();
  input.value = value;
  input.name = "feedbackReason";
  return input;
});

let domReady = null;
const oldState = {
  version: 1,
  wardrobe: [
    { id: "old_top", name: "Old Tee", category: "top", colors: ["white"], tags: ["t-shirt", "casual"], occasions: ["casual"], formality: 3, active: true },
    { id: "archived_top", name: "Archived Tee", category: "top", colors: ["black"], tags: ["casual"], occasions: ["casual"], formality: 3, active: false },
    { id: "old_pants", name: "Old Jeans", category: "pants", colors: ["navy"], tags: ["jeans"], occasions: ["casual"], formality: 4, active: true },
    { id: "old_shoes", name: "Old Sneakers", category: "shoes", colors: ["white"], tags: ["sneakers"], occasions: ["casual"], formality: 3, active: true },
    { id: "laundry_shoes", name: "Laundry Sneakers", category: "shoes", colors: ["black"], tags: ["sneakers"], occasions: ["casual"], formality: 3, unavailable: true }
  ],
  history: [{ id: "old_log", date: "2026-06-20T12:00:00.000Z", occasion: "casual", itemIds: ["old_top", "old_pants", "old_shoes"] }],
  bannedCombos: [{ id: "old_ban", itemIds: ["archived_top", "old_pants", "old_shoes"], occasion: "casual" }]
};
const storage = new Map([["fitRoulette.v1", JSON.stringify(oldState)]]);

const document = {
  documentElement: new MockElement("documentElement"),
  body: { appendChild() {} },
  addEventListener(type, callback) {
    if (type === "DOMContentLoaded") domReady = callback;
  },
  createElement() {
    return new MockElement();
  },
  querySelector(selector) {
    if (selector.startsWith("#")) return elements.get(selector.slice(1));
    if (selector === "input[name='itemBeltMode']:checked") return beltModeInputs.find((input) => input.checked) || null;
    const beltValue = selector.match(/^input\[name='itemBeltMode'\]\[value='(.+)'\]$/);
    if (beltValue) return beltModeInputs.find((input) => input.value === beltValue[1]) || null;
    if (selector === "input[name='feedbackReason']:checked") return feedbackReasonInputs.find((input) => input.checked) || null;
    return null;
  },
  querySelectorAll(selector) {
    if (selector === ".tab-button") return tabButtons;
    if (selector === ".screen") return screens;
    if (selector === "input[name='itemOccasion']") return occasionInputs;
    if (selector === "input[name='itemOccasion']:checked") return occasionInputs.filter((input) => input.checked);
    if (selector === "input[name='itemBeltMode']") return beltModeInputs;
    if (selector === "input[name='itemWeatherCondition']") return weatherConditionInputs;
    if (selector === "input[name='itemWeatherCondition']:checked") return weatherConditionInputs.filter((input) => input.checked);
    if (selector === "input[name='feedbackReason']") return feedbackReasonInputs;
    if (selector === "input[name='manualItem']:checked") return [];
    if (selector === ".result-item.is-changed") return [];
    if (selector === "[data-color]") return [];
    return [];
  }
};

const context = {
  console,
  document,
  navigator: {},
  window: { addEventListener() {}, confirm: () => true },
  localStorage: {
    getItem(key) {
      return storage.has(key) ? storage.get(key) : null;
    },
    setItem(key, value) {
      storage.set(key, String(value));
    }
  },
  Blob, URL, Intl, Date, Math, Number, String, Array, Set, Map, RegExp, clearTimeout, setTimeout
};

const code = fs.readFileSync(path.resolve(__dirname, "..", "app.js"), "utf8");
vm.runInNewContext(code, context, { filename: "app.js" });
domReady();

elements.get("buildAroundCategorySelect").value = "tops";
elements.get("buildAroundCategorySelect").listeners.get("change")({ target: elements.get("buildAroundCategorySelect") });
assert(elements.get("buildAroundSelect").innerHTML.includes("Old Tee"), "Grouped build-around did not show an active old item.");
assert(!elements.get("buildAroundSelect").innerHTML.includes("Archived Tee"), "Archived item appeared in build-around options.");
elements.get("buildAroundCategorySelect").value = "shoes";
elements.get("buildAroundCategorySelect").listeners.get("change")({ target: elements.get("buildAroundCategorySelect") });
assert(elements.get("buildAroundSelect").innerHTML.includes("Old Sneakers"), "Grouped build-around did not show active old shoes.");
assert(!elements.get("buildAroundSelect").innerHTML.includes("Laundry Sneakers"), "Unavailable item appeared in build-around options.");
assert(elements.get("occasionSelect").value === "work", "Old data did not receive the safe default occasion.");

elements.get("showInactive").checked = true;
elements.get("showInactive").listeners.get("change")({ target: elements.get("showInactive") });
const archivedClosetHtml = elements.get("closetList").innerHTML;
assert(archivedClosetHtml.includes('aria-label="Archived"'), "Archived items were not grouped and labeled.");
assert(archivedClosetHtml.indexOf("Archived Tee") < archivedClosetHtml.indexOf("Active items"), "Archived items were not shown above active items.");
elements.get("showInactive").checked = false;
elements.get("showInactive").listeners.get("change")({ target: elements.get("showInactive") });
assert(!elements.get("closetList").innerHTML.includes("Archived Tee"), "Archived item remained visible after Show Archived was disabled.");

elements.get("manualLogGenerateBtn").click();
assert(!elements.get("manualItemPicker").innerHTML.includes("Archived Tee"), "Manual logging showed archived items by default.");
assert(!elements.get("manualItemPicker").innerHTML.includes("Laundry Sneakers"), "Manual logging showed unavailable items by default.");
elements.get("manualIncludeUnavailable").checked = true;
elements.get("manualIncludeUnavailable").listeners.get("change")();
assert(elements.get("manualItemPicker").innerHTML.includes("Archived Tee"), "Manual logging could not include archived items.");
assert(elements.get("manualItemPicker").innerHTML.includes("Laundry Sneakers"), "Manual logging could not include unavailable items.");
elements.get("closeManualLogBtn").click();

elements.get("occasionSelect").value = "casual";
elements.get("buildAroundSelect").value = "";
elements.get("generateBtn").click();
assert(elements.get("outfitResult").innerHTML.includes("Old Tee"), "Old wardrobe did not generate.");
assert(!elements.get("outfitResult").innerHTML.includes("Archived Tee"), "Archived item appeared in generated outfit.");

elements.get("buildAroundSelect").value = "archived_top";
elements.get("generateBtn").click();
assert(/not active/i.test(elements.get("outfitResult").innerHTML), "Archived build-around item was not rejected.");

elements.get("themeSelect").value = "light";
elements.get("themeSelect").listeners.get("change")({ target: elements.get("themeSelect") });
const migrated = JSON.parse(storage.get("fitRoulette.v1"));
assert(migrated.settings.theme === "light", "Theme did not migrate into old storage record.");
assert(migrated.settings.afterLogging === "confirm_keep", "Old settings did not receive confirmation-and-keep default.");
assert(migrated.settings.defaultOccasion === "work", "Old settings did not receive Work / Office default.");
assert(migrated.settings.weather.enabled === false, "Old settings did not receive weather-off default.");
assert(migrated.wardrobe.length === oldState.wardrobe.length, "Migration changed wardrobe count.");
assert(migrated.history.length === oldState.history.length, "Migration changed history.");
assert(migrated.bannedCombos.length === oldState.bannedCombos.length, "Migration changed banned combos.");
assert(Array.isArray(migrated.feedback) && migrated.feedback.length === 0, "Old state did not receive an empty feedback collection.");
assert(migrated.history[0].source === "generated", "Old history did not receive generated source default.");
assert(migrated.history[0].note === "", "Old history did not receive an empty note default.");
const migratedPants = migrated.wardrobe.find((item) => item.id === "old_pants");
assert(migratedPants.beltMode === "optional", "Old pants did not receive optional belt mode.");
assert(migratedPants.minTemperature === null && migratedPants.maxTemperature === null, "Old item received restrictive temperature defaults.");
assert(migratedPants.rainSafe === null && migratedPants.warmthLevel === null, "Old item received restrictive weather defaults.");

console.log(JSON.stringify({ ok: true, theme: migrated.settings.theme, wardrobeCount: migrated.wardrobe.length }));
