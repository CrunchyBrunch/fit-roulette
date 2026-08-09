if (process.env.FIT_ROULETTE_RUN_V133_HARNESS !== "1") {
  require("./verify-fit-roulette-v1.5-static.js");
  require("./verify-fit-roulette-v1.5-app.js");
  process.exit(0);
}

const fs = require("fs");
const path = require("path");
const vm = require("vm");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

let focusedElement = null;

class MockClassList {
  constructor() {
    this.values = new Set();
  }
  add(value) {
    this.values.add(value);
  }
  remove(value) {
    this.values.delete(value);
  }
  contains(value) {
    return this.values.has(value);
  }
  toggle(value, force) {
    const shouldAdd = force === undefined ? !this.values.has(value) : Boolean(force);
    if (shouldAdd) this.values.add(value);
    else this.values.delete(value);
  }
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
  focus() {
    focusedElement = this;
  }
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
    if (selector === "[data-template-id]" && this.dataset.templateId) return this;
    if (selector === "[data-color]" && this.dataset.color) return this;
    if (selector === "[data-match-kind]" && this.dataset.matchKind) return this;
    if (selector === "[data-occasion-preset]" && this.dataset.occasionPreset) return this;
    if (selector === "[data-quick-tag]" && this.dataset.quickTag) return this;
    if (selector === "[data-action]" && this.dataset.action) return this;
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
  "toast",
  "quickAddBtn",
  "occasionSelect",
  "buildAroundCategorySelect",
  "buildAroundSelect",
  "buildAroundItemField",
  "generateBtn",
  "outfitResult",
  "resultActions",
  "rerollBtn",
  "logBtn",
  "banBtn",
  "rerollSessionStatus",
  "rerollSessionText",
  "resetViewedFitsBtn",
  "addItemBtn",
  "closetSearch",
  "closetCategory",
  "showInactive",
  "closetList",
  "historyList",
  "settingsStats",
  "themeSelect",
  "afterLoggingSelect",
  "defaultOccasionSelect",
  "appVersion",
  "exportBtn",
  "importBtn",
  "importFile",
  "resetDemoBtn",
  "clearBansBtn",
  "itemForm",
  "saveGenerateBtn",
  "closeItemDialogBtn",
  "duplicateItemBtn",
  "archiveItemBtn",
  "permanentDeleteBtn",
  "itemFormality",
  "formalityOutput",
  "itemCategory",
  "itemOccasions",
  "itemDialog",
  "itemQuickTags",
  "tagSuggestions",
  "matchingDetails",
  "advancedTagsDetails",
  "templateChips",
  "copyMatchingSelect",
  "copyMatchingBtn",
  "itemPrimaryColor",
  "itemSecondaryColors",
  "primaryColorChips",
  "worksMatchChips",
  "avoidMatchChips",
  "avoidItemsSelect",
  "itemDialogMode",
  "itemDialogTitle",
  "itemId",
  "itemName",
  "itemColors",
  "itemTags",
  "itemSeason",
  "itemWorksWithTags",
  "itemAvoidWithTags",
  "itemAvoidWithItems",
  "itemImageUrl",
  "itemNotes",
  "itemActive",
  "formError",
  "advancedDeleteDetails",
  "weatherDetails",
  "weatherSummary",
  "useWeather",
  "weatherTemperature",
  "weatherCondition",
  "weatherInputs",
  "manualLogGenerateBtn",
  "manualLogHistoryBtn",
  "manualLogForm",
  "closeManualLogBtn",
  "manualLogDialog",
  "manualLogDate",
  "manualLogOccasion",
  "manualIncludeUnavailable",
  "manualItemPicker",
  "manualLogError",
  "manualLogNote",
  "swapDialog",
  "swapDialogTitle",
  "closeSwapDialogBtn",
  "swapChoices",
  "feedbackDialog",
  "feedbackForm",
  "dismissFeedbackBtn",
  "skipFeedbackBtn",
  "feedbackChoices",
  "feedbackOtherField",
  "feedbackOther",
  "beltModeFieldset",
  "itemMinTemperature",
  "itemMaxTemperature",
  "itemRainSafe",
  "itemWarmthLevel",
  "itemWeatherConditions"
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
  input.name = "itemOccasion";
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
const manualItemInputs = [];
const changedResultRows = [];

let domReady = null;
const storage = new Map();

const document = {
  documentElement: new MockElement("documentElement"),
  body: {
    appendChild() {}
  },
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
    if (selector === "input[name='manualItem']:checked") return manualItemInputs.filter((input) => input.checked);
    if (selector === ".result-item.is-changed") return changedResultRows.filter((row) => row.classList.contains("is-changed"));
    if (selector === "[data-color]") return [];
    return [];
  }
};

const context = {
  console,
  document,
  navigator: {},
  window: {
    __FIT_ROULETTE_TESTING__: true,
    addEventListener() {},
    confirm: () => true
  },
  localStorage: {
    getItem(key) {
      return storage.has(key) ? storage.get(key) : null;
    },
    setItem(key, value) {
      storage.set(key, String(value));
    }
  },
  Blob,
  URL,
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

const appPath = path.resolve(__dirname, "..", "app.js");
const code = fs.readFileSync(appPath, "utf8");
vm.runInNewContext(code, context, { filename: appPath });
assert(typeof domReady === "function", "App did not register DOMContentLoaded.");
domReady();

const seeded = JSON.parse(storage.get("fitRoulette.v1"));
assert(seeded.wardrobe.length >= 26, "Starter wardrobe did not seed.");
assert(seeded.settings.afterLogging === "confirm_keep", "Default post-log behavior was not seeded.");
assert(seeded.settings.defaultOccasion === "work", "Default occasion was not seeded.");
assert(elements.get("occasionSelect").value === "work", "Generate did not initialize to the default occasion.");

elements.get("defaultOccasionSelect").value = "casual";
elements.get("defaultOccasionSelect").listeners.get("change")({ target: elements.get("defaultOccasionSelect") });
elements.get("occasionSelect").value = "date";
assert(JSON.parse(storage.get("fitRoulette.v1")).settings.defaultOccasion === "casual", "Active occasion overwrote the saved default.");

for (const occasion of ["work", "friday", "casual", "date", "gym"]) {
  elements.get("occasionSelect").value = occasion;
  elements.get("buildAroundSelect").value = "";
  elements.get("generateBtn").click();
  const html = elements.get("outfitResult").innerHTML;
  assert(!/No compatible fit found/i.test(html), `No fit generated for ${occasion}.`);
  assert(/Today's fit|Today&apos;s fit/.test(html), `Result card missing for ${occasion}.`);
  assert(elements.get("resultActions").hidden === false, `Actions hidden for ${occasion}.`);
}

elements.get("buildAroundCategorySelect").value = "bottoms";
elements.get("buildAroundCategorySelect").listeners.get("change")({ target: elements.get("buildAroundCategorySelect") });
assert(elements.get("buildAroundItemField").hidden === false, "Build-around item selector did not appear after choosing a category.");
assert(elements.get("buildAroundSelect").innerHTML.includes("Light Jeans"), "Bottoms group did not include pants.");
assert(!elements.get("buildAroundSelect").innerHTML.includes("Gray Polo"), "Bottoms group included a top.");
elements.get("occasionSelect").value = "casual";
elements.get("buildAroundSelect").value = "item_light_jeans";
elements.get("buildAroundSelect").listeners.get("change")({ target: elements.get("buildAroundSelect") });
elements.get("generateBtn").click();
assert(elements.get("outfitResult").innerHTML.includes("Light Jeans"), "Build-around item was not included.");
assert(elements.get("outfitResult").innerHTML.includes("Locked"), "Build-around item was not locked during Swap.");
elements.get("buildAroundCategorySelect").value = "tops";
elements.get("buildAroundCategorySelect").listeners.get("change")({ target: elements.get("buildAroundCategorySelect") });
assert(elements.get("buildAroundSelect").value === "", "Changing build-around category did not clear the prior item.");
assert(elements.get("buildAroundSelect").innerHTML.includes("Gray Polo"), "Tops group did not include tops.");
elements.get("buildAroundCategorySelect").value = "";
elements.get("buildAroundCategorySelect").listeners.get("change")({ target: elements.get("buildAroundCategorySelect") });
assert(elements.get("buildAroundItemField").hidden === true, "Clearing build-around category did not hide the item selector.");

elements.get("banBtn").click();
const afterBan = JSON.parse(storage.get("fitRoulette.v1"));
assert(afterBan.bannedCombos.length === 1, "Banned combo was not saved.");
feedbackReasonInputs.find((input) => input.value === "exact").checked = true;
elements.get("feedbackForm").listeners.get("submit")({ preventDefault() {} });
const afterFeedback = JSON.parse(storage.get("fitRoulette.v1"));
assert(afterFeedback.feedback.length === 1, "Structured ban feedback was not saved.");
assert(afterFeedback.feedback[0].reason === "exact", "Exact-outfit feedback reason changed.");

elements.get("themeSelect").value = "dark";
elements.get("themeSelect").listeners.get("change")({ target: elements.get("themeSelect") });
const afterTheme = JSON.parse(storage.get("fitRoulette.v1"));
assert(afterTheme.settings.theme === "dark", "Theme preference did not persist.");

elements.get("addItemBtn").click();
assert(focusedElement !== elements.get("itemName"), "Add Item focused the name field automatically.");
assert(elements.get("itemDialogTitle").textContent === "Add Item", "New-item editor title was unclear.");
elements.get("itemName").value = "Test Navy Polo";
elements.get("itemName").listeners.get("input")();
assert(elements.get("itemDialogTitle").textContent === "Test Navy Polo", "Editor title did not follow the item name.");
elements.get("itemPrimaryColor").value = "navy";
const templateTarget = new MockElement();
templateTarget.dataset.templateId = "polo";
elements.get("itemForm").listeners.get("click")({ target: templateTarget });
elements.get("saveGenerateBtn").click();
const afterTemplate = JSON.parse(storage.get("fitRoulette.v1"));
const templateItem = afterTemplate.wardrobe.find((item) => item.name === "Test Navy Polo");
assert(templateItem, "Template-created item was not saved.");
assert(templateItem.category === "top", "Template did not set category.");
assert(templateItem.worksWithTags.includes("khaki"), "Template did not set matching tags.");
assert(elements.get("outfitResult").innerHTML.includes("Test Navy Polo"), "Save + Generate did not build around the new item.");

const historyBeforeLog = afterTemplate.history.length;
elements.get("logBtn").click();
const afterGeneratedLog = JSON.parse(storage.get("fitRoulette.v1"));
assert(afterGeneratedLog.history.length === historyBeforeLog + 1, "Generated outfit was not logged.");
assert(afterGeneratedLog.history[0].source === "generated", "Generated log source was not saved.");
assert(elements.get("outfitResult").innerHTML.includes("Fit logged."), "Post-log success state did not render.");
assert(/Today's fit|Today&apos;s fit/.test(elements.get("outfitResult").innerHTML), "Default post-log behavior cleared the outfit.");
assert(elements.get("outfitResult").innerHTML.includes("Generate Another"), "Post-log flow lost Generate Another.");
elements.get("logBtn").click();
assert(JSON.parse(storage.get("fitRoulette.v1")).history.length === historyBeforeLog + 1, "Displayed outfit was logged twice.");

const generateAnotherTarget = new MockElement();
generateAnotherTarget.dataset.resultAction = "generate-another";
elements.get("outfitResult").listeners.get("click")({ target: generateAnotherTarget });
assert(/Today's fit|Today&apos;s fit/.test(elements.get("outfitResult").innerHTML), "Generate Another did not produce a fit.");
assert(!elements.get("outfitResult").innerHTML.includes("Fit logged."), "Generate kept stale confirmation state.");

elements.get("logBtn").click();
const rerollLoggedTarget = new MockElement();
rerollLoggedTarget.dataset.resultAction = "reroll";
elements.get("outfitResult").listeners.get("click")({ target: rerollLoggedTarget });
assert(/Today's fit|Today&apos;s fit/.test(elements.get("outfitResult").innerHTML), "Reroll after confirmation-and-keep did not produce a fit.");
assert(!elements.get("outfitResult").innerHTML.includes("Fit logged."), "Reroll kept stale confirmation state.");

elements.get("afterLoggingSelect").value = "keep";
elements.get("afterLoggingSelect").listeners.get("change")({ target: elements.get("afterLoggingSelect") });
elements.get("logBtn").click();
assert(elements.get("outfitResult").innerHTML.includes("Logged"), "Keep-visible mode did not show a logged indicator.");
assert(/Today's fit|Today&apos;s fit/.test(elements.get("outfitResult").innerHTML), "Keep-visible mode cleared the outfit.");
const keepHistoryCount = JSON.parse(storage.get("fitRoulette.v1")).history.length;
elements.get("logBtn").click();
assert(JSON.parse(storage.get("fitRoulette.v1")).history.length === keepHistoryCount, "Keep-visible mode allowed duplicate logging.");
elements.get("outfitResult").listeners.get("click")({ target: generateAnotherTarget });
assert(!elements.get("outfitResult").innerHTML.includes("Logged"), "Generate after keep-visible retained its logged badge.");
elements.get("logBtn").click();
elements.get("outfitResult").listeners.get("click")({ target: rerollLoggedTarget });
assert(!elements.get("outfitResult").innerHTML.includes("Logged"), "Reroll after keep-visible retained its logged badge.");
assert(/Today's fit|Today&apos;s fit/.test(elements.get("outfitResult").innerHTML), "Reroll after keep-visible did not produce a fit.");

elements.get("afterLoggingSelect").value = "clear";
elements.get("afterLoggingSelect").listeners.get("change")({ target: elements.get("afterLoggingSelect") });
elements.get("logBtn").click();
assert(elements.get("outfitResult").innerHTML.includes("Fit logged."), "Clear mode lost its confirmation.");
assert(!/Today's fit|Today&apos;s fit/.test(elements.get("outfitResult").innerHTML), "Clear mode kept the outfit visible.");
elements.get("outfitResult").listeners.get("click")({ target: generateAnotherTarget });
assert(/Today's fit|Today&apos;s fit/.test(elements.get("outfitResult").innerHTML), "Generate after clear mode did not produce a fit.");
assert(!elements.get("outfitResult").innerHTML.includes("Fit logged."), "Generate after clear mode retained confirmation.");
elements.get("logBtn").click();
elements.get("outfitResult").listeners.get("click")({ target: rerollLoggedTarget });
assert(/Today's fit|Today&apos;s fit/.test(elements.get("outfitResult").innerHTML), "Reroll after clear mode did not produce a fit.");
assert(!elements.get("outfitResult").innerHTML.includes("Fit logged."), "Reroll after clear mode retained confirmation.");

elements.get("afterLoggingSelect").value = "confirm_keep";
elements.get("afterLoggingSelect").listeners.get("change")({ target: elements.get("afterLoggingSelect") });

const storedForManual = JSON.parse(storage.get("fitRoulette.v1"));
["item_light_blue_ralph_lauren_polo", "item_light_jeans", "item_black_white_converse_mids"].forEach((id) => {
  const input = new MockElement();
  input.value = id;
  input.checked = true;
  manualItemInputs.push(input);
});
elements.get("manualLogGenerateBtn").click();
elements.get("manualLogDate").value = "2026-07-25";
elements.get("manualLogOccasion").value = "casual";
elements.get("manualLogNote").value = "Manual smoke log";
elements.get("manualLogForm").listeners.get("submit")({ preventDefault() {} });
const afterManualLog = JSON.parse(storage.get("fitRoulette.v1"));
assert(afterManualLog.history.length === storedForManual.history.length + 1, "Manual outfit was not logged.");
assert(afterManualLog.history[0].source === "manual", "Manual log source was not saved.");
assert(afterManualLog.history[0].note === "Manual smoke log", "Manual log note was not saved.");
assert(afterManualLog.history[0].date.startsWith("2026-07-25"), "Manual log date was not saved.");

elements.get("useWeather").checked = true;
elements.get("weatherTemperature").value = "48";
elements.get("weatherCondition").value = "rain";
elements.get("useWeather").listeners.get("change")();
const afterWeather = JSON.parse(storage.get("fitRoulette.v1"));
assert(afterWeather.settings.weather.enabled === true, "Weather preference did not persist.");
assert(afterWeather.settings.weather.temperature === 48, "Weather temperature did not persist.");
assert(afterWeather.settings.weather.condition === "rain", "Weather condition did not persist.");

elements.get("addItemBtn").click();
elements.get("itemName").value = "No Belt Test Jeans";
elements.get("itemPrimaryColor").value = "black";
const noBeltTemplateTarget = new MockElement();
noBeltTemplateTarget.dataset.templateId = "jeans";
elements.get("itemForm").listeners.get("click")({ target: noBeltTemplateTarget });
beltModeInputs.forEach((input) => {
  input.checked = input.value === "none";
});
elements.get("saveGenerateBtn").click();
const afterNoBeltItem = JSON.parse(storage.get("fitRoulette.v1"));
const noBeltItem = afterNoBeltItem.wardrobe.find((item) => item.name === "No Belt Test Jeans");
assert(noBeltItem?.beltMode === "none", "No-belt mode was not saved.");
assert(elements.get("outfitResult").innerHTML.includes("No Belt Test Jeans"), "No-belt bottoms did not generate.");
assert(!elements.get("outfitResult").innerHTML.includes('item-kicker">Belt'), "No-belt bottoms generated with a belt.");

elements.get("addItemBtn").click();
elements.get("itemName").value = "Belt Required Test Jeans";
elements.get("itemPrimaryColor").value = "navy";
const requiredBeltTemplateTarget = new MockElement();
requiredBeltTemplateTarget.dataset.templateId = "jeans";
elements.get("itemForm").listeners.get("click")({ target: requiredBeltTemplateTarget });
beltModeInputs.forEach((input) => {
  input.checked = input.value === "required";
});
elements.get("saveGenerateBtn").click();
const afterRequiredBeltItem = JSON.parse(storage.get("fitRoulette.v1"));
const requiredBeltItem = afterRequiredBeltItem.wardrobe.find((item) => item.name === "Belt Required Test Jeans");
assert(requiredBeltItem?.beltMode === "required", "Required-belt mode was not saved.");
assert(elements.get("outfitResult").innerHTML.includes("Belt Required Test Jeans"), "Required-belt bottoms did not generate.");
assert(elements.get("outfitResult").innerHTML.includes('item-kicker">Belt'), "Required-belt bottoms generated without a belt.");

elements.get("addItemBtn").click();
elements.get("itemName").value = "Copied Matching Polo";
elements.get("itemPrimaryColor").value = "black";
elements.get("copyMatchingSelect").value = "item_light_blue_ralph_lauren_polo";
elements.get("copyMatchingBtn").click();
assert(elements.get("itemWorksWithTags").value.includes("khaki"), "Copy matching did not copy worksWithTags.");
assert(String(elements.get("itemFormality").value) === "6", "Copy matching did not copy formality.");

elements.get("addItemBtn").click();
elements.get("itemName").value = "Chip Toggle Polo";
elements.get("itemName").listeners.get("input")();
elements.get("itemPrimaryColor").value = "navy";
const matchTarget = new MockElement();
matchTarget.dataset.matchKind = "works";
matchTarget.dataset.matchTags = "navy, pants";
elements.get("itemForm").listeners.get("click")({ target: matchTarget });
assert(elements.get("itemWorksWithTags").value.includes("navy"), "Matching chip did not select.");
assert(/is-selected[^>]+aria-pressed="true"[^>]*>works with navy pants/.test(elements.get("worksMatchChips").innerHTML), "Matching chip visual state did not select.");
elements.get("itemForm").listeners.get("click")({ target: matchTarget });
assert(!elements.get("itemWorksWithTags").value.includes("navy"), "Matching chip did not deselect.");
assert(!/is-selected[^>]+aria-pressed="true"[^>]*>works with navy pants/.test(elements.get("worksMatchChips").innerHTML), "Matching chip visual state did not deselect.");
elements.get("itemForm").listeners.get("click")({ target: matchTarget });
elements.get("itemForm").listeners.get("click")({ target: matchTarget });
elements.get("itemForm").listeners.get("click")({ target: matchTarget });
elements.get("itemForm").listeners.get("submit")({ preventDefault() {} });
const afterChipSave = JSON.parse(storage.get("fitRoulette.v1"));
const chipItem = afterChipSave.wardrobe.find((item) => item.name === "Chip Toggle Polo");
assert(chipItem, "Chip regression item was not saved.");
assert(chipItem.worksWithTags.filter((tag) => tag === "navy").length === 1, "Matching chip stored a duplicate value.");
context.window.__fitRouletteTest.openItemDialog(chipItem.id);
assert(elements.get("itemWorksWithTags").value.includes("navy"), "Matching chip state did not survive save and reopen.");
assert(elements.get("itemDialogTitle").textContent === "Chip Toggle Polo", "Existing editor did not show the item name.");

const sessionState = {
  version: 3,
  wardrobe: [
    { id: "session_top_a", name: "Session Top A", category: "top", colors: ["black"], occasions: ["casual"], formality: 4, active: true },
    { id: "session_top_b", name: "Session Top B", category: "top", colors: ["navy"], occasions: ["casual"], formality: 4, active: true },
    { id: "session_pants", name: "Session Pants", category: "pants", colors: ["gray"], occasions: ["casual"], formality: 4, active: true },
    { id: "session_shoes", name: "Session Shoes", category: "shoes", colors: ["white"], occasions: ["casual"], formality: 4, active: true }
  ],
  history: [],
  bannedCombos: [],
  feedback: [],
  settings: { theme: "system", afterLogging: "confirm_keep", defaultOccasion: "casual", weather: { enabled: false, temperature: null, condition: "sunny" } }
};
context.window.__fitRouletteTest.replaceState(sessionState);
elements.get("occasionSelect").value = "casual";
elements.get("buildAroundCategorySelect").value = "";
elements.get("buildAroundSelect").value = "";
elements.get("generateBtn").click();
const firstSessionOutfit = context.window.__fitRouletteTest.getCurrentOutfit();
const firstSessionSignature = firstSessionOutfit.items.map((item) => item.id).sort().join("|");
let sessionInfo = context.window.__fitRouletteTest.getRerollSession();
assert(sessionInfo.poolSize === 2 && sessionInfo.seen.length === 1, "First generated outfit was not tracked in the reroll session.");
elements.get("rerollBtn").click();
const secondSessionOutfit = context.window.__fitRouletteTest.getCurrentOutfit();
const secondSessionSignature = secondSessionOutfit.items.map((item) => item.id).sort().join("|");
assert(secondSessionSignature !== firstSessionSignature, "Reroll repeated before showing an unseen outfit.");
assert(secondSessionOutfit.changedItemIds.length === 1, "Reroll did not identify only the changed item.");
sessionInfo = context.window.__fitRouletteTest.getRerollSession();
assert(sessionInfo.seen.length === 2 && sessionInfo.repeatsEnabled, "Reroll session did not enter repeat mode after exhaustion.");
assert(elements.get("rerollSessionText").textContent.includes("repeats enabled"), "Pool exhaustion feedback was not rendered.");
elements.get("rerollBtn").click();
const repeatedSessionOutfit = context.window.__fitRouletteTest.getCurrentOutfit();
const repeatedSessionSignature = repeatedSessionOutfit.items.map((item) => item.id).sort().join("|");
assert(repeatedSessionSignature !== secondSessionSignature, "Repeat mode immediately repeated the current outfit despite an alternative.");
assert(context.window.__fitRouletteTest.getState().history.length === 0, "Reroll-session views leaked into worn history.");

elements.get("occasionSelect").value = "work";
elements.get("occasionSelect").listeners.get("change")();
assert(context.window.__fitRouletteTest.getRerollSession().seen.length === 0, "Occasion change did not reset the reroll session.");
elements.get("occasionSelect").value = "casual";
elements.get("generateBtn").click();
elements.get("buildAroundCategorySelect").value = "tops";
elements.get("buildAroundCategorySelect").listeners.get("change")({ target: elements.get("buildAroundCategorySelect") });
assert(context.window.__fitRouletteTest.getRerollSession().seen.length === 0, "Build-around category change did not reset the reroll session.");
elements.get("buildAroundSelect").value = "session_top_a";
elements.get("buildAroundSelect").listeners.get("change")();
elements.get("generateBtn").click();
assert(context.window.__fitRouletteTest.getCurrentOutfit().items.some((item) => item.id === "session_top_a"), "Grouped build-around generation did not require the selected item.");

elements.get("useWeather").checked = true;
elements.get("weatherTemperature").value = "70";
elements.get("weatherCondition").value = "sunny";
elements.get("useWeather").listeners.get("change")();
assert(context.window.__fitRouletteTest.getRerollSession().seen.length === 0, "Weather context change did not reset the reroll session.");

context.window.__fitRouletteTest.replaceState({
  ...sessionState,
  wardrobe: sessionState.wardrobe.filter((item) => item.id !== "session_top_b")
});
elements.get("occasionSelect").value = "casual";
elements.get("buildAroundCategorySelect").value = "";
elements.get("buildAroundSelect").value = "";
elements.get("generateBtn").click();
const onlySessionSignature = context.window.__fitRouletteTest.getCurrentOutfit().items.map((item) => item.id).sort().join("|");
elements.get("rerollBtn").click();
const onlyReroll = context.window.__fitRouletteTest.getCurrentOutfit();
assert(onlyReroll.items.map((item) => item.id).sort().join("|") === onlySessionSignature, "One-valid-outfit reroll replaced the only fit.");
assert(onlyReroll.changedItemIds.length === 0, "One-valid-outfit reroll showed a fake changed-item state.");
assert(context.window.__fitRouletteTest.getRerollSession().message.includes("Only one valid outfit"), "One-valid-outfit explanation was missing.");

const changedRow = new MockElement();
changedRow.classList.add("is-changed");
changedResultRows.push(changedRow);
context.window.__fitRouletteTest.clearChangedHighlights();
assert(!changedRow.classList.contains("is-changed"), "Changed-item highlight did not clear.");
assert(context.window.__fitRouletteTest.describeDependentChanges(
  [{ id: "pants", category: "pants" }, { id: "belt", category: "belt" }],
  [{ id: "pants_new", category: "pants" }]
).includes("Belt removed"), "Dependent belt removal was not explained.");

const today = new Date().toISOString();
const recencyState = {
  version: 3,
  wardrobe: [
    { id: "top_recent", name: "Recent Top", category: "top", colors: ["black"], occasions: ["casual"], formality: 4, active: true },
    { id: "top_fresh", name: "Fresh Top", category: "top", colors: ["black"], occasions: ["casual"], formality: 4, active: true },
    { id: "pants_recent", name: "Recent Pants", category: "pants", colors: ["gray"], occasions: ["casual"], formality: 4, active: true },
    { id: "pants_fresh", name: "Fresh Pants", category: "pants", colors: ["gray"], occasions: ["casual"], formality: 4, active: true },
    { id: "shoes_recent", name: "Recent Shoes", category: "shoes", colors: ["white"], occasions: ["casual"], formality: 4, active: true },
    { id: "shoes_fresh", name: "Fresh Shoes", category: "shoes", colors: ["white"], occasions: ["casual"], formality: 4, active: true }
  ],
  history: [{ id: "recent_log", date: today, occasion: "casual", itemIds: ["top_recent", "pants_recent", "shoes_recent"], source: "generated" }],
  bannedCombos: [],
  feedback: [],
  settings: { theme: "system", afterLogging: "confirm_keep", defaultOccasion: "work" }
};
context.window.__fitRouletteTest.replaceState(recencyState);
const recencyItems = context.window.__fitRouletteTest.getState().wardrobe;
const getRecencyItem = (id) => recencyItems.find((item) => item.id === id);
const exactOutfit = ["top_recent", "pants_recent", "shoes_recent"].map(getRecencyItem);
const repeatedPair = ["top_recent", "pants_recent", "shoes_fresh"].map(getRecencyItem);
const freshOutfit = ["top_fresh", "pants_fresh", "shoes_fresh"].map(getRecencyItem);
const exactScore = context.window.__fitRouletteTest.scoreOutfit(exactOutfit, "casual", { randomize: false });
const pairScore = context.window.__fitRouletteTest.scoreOutfit(repeatedPair, "casual", { randomize: false });
const freshScore = context.window.__fitRouletteTest.scoreOutfit(freshOutfit, "casual", { randomize: false });
assert(exactScore < pairScore, "Exact-outfit recency was not stronger than pair recency.");
assert(pairScore < freshScore, "Recent top/bottom pair was not penalized.");
getRecencyItem("top_recent").active = false;
getRecencyItem("pants_recent").active = false;
getRecencyItem("top_recent").active = true;
getRecencyItem("pants_recent").active = true;
const restoredPairScore = context.window.__fitRouletteTest.scoreOutfit(repeatedPair, "casual", { randomize: false });
assert(restoredPairScore === pairScore, "Temporary unavailability reset recency scoring.");

context.window.__fitRouletteTest.replaceState({
  ...recencyState,
  history: [{ id: "partial_manual", date: today, occasion: "casual", itemIds: ["top_recent", "pants_recent"], source: "manual" }]
});
const partialItems = context.window.__fitRouletteTest.getState().wardrobe;
const partialPair = ["top_recent", "pants_recent", "shoes_fresh"].map((id) => partialItems.find((item) => item.id === id));
assert(context.window.__fitRouletteTest.lastTopBottomPairDate(partialPair), "Partial manual log did not contribute pair recency.");

for (const asset of ["index.html", "styles.css", "manifest.json", "sw.js", "icons/favicon-32.png", "icons/icon-180.png", "icons/icon-192.png", "icons/icon-512.png"]) {
  assert(fs.existsSync(path.resolve(__dirname, "..", asset)), `${asset} is missing.`);
}
const styles = fs.readFileSync(path.resolve(__dirname, "..", "styles.css"), "utf8");
assert(styles.includes('input[type="date"]'), "Native date input mobile sizing rules are missing.");
assert(styles.includes("animation: changed-item 1.15s"), "Changed-item highlight duration is not in the requested range.");
assert(styles.includes("@media (prefers-reduced-motion: reduce)"), "Reduced-motion handling is missing.");

console.log(JSON.stringify({
  ok: true,
  wardrobeCount: afterTemplate.wardrobe.length,
  historyCount: afterManualLog.history.length,
  feedbackCount: afterFeedback.feedback.length,
  theme: afterTheme.settings.theme
}));
