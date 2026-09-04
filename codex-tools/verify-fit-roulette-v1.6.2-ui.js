const assert = require("assert");
const fs = require("fs");
const http = require("http");
const path = require("path");
const SmartCloset = require("../smart-closet.js");

const root = path.resolve(__dirname, "..");
const NOW = "2026-09-03T12:00:00-04:00";
const contentTypes = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".json": "application/json", ".png": "image/png" };

function loadPlaywright() {
  try { return require("playwright"); }
  catch (error) { return require(path.resolve(path.dirname(process.execPath), "..", "node_modules", "playwright")); }
}

function browserExecutable() {
  return [process.env.FIT_ROULETTE_BROWSER, process.env.CHROME_PATH,
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"]
    .filter(Boolean).find((candidate) => fs.existsSync(candidate)) || "";
}

function serve() {
  return new Promise((resolve) => {
    const server = http.createServer((request, response) => {
      const url = new URL(request.url, "http://127.0.0.1");
      const pathname = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
      const filePath = path.resolve(root, `.${pathname}`);
      if (!filePath.startsWith(root) || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
        response.writeHead(404); response.end("Not found"); return;
      }
      response.writeHead(200, { "content-type": contentTypes[path.extname(filePath)] || "application/octet-stream", "cache-control": "no-store" });
      fs.createReadStream(filePath).pipe(response);
    });
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

function item(id, category, extra = {}) {
  const defaults = {
    top: { subtype: "t-shirt", layerRoles: ["base"], sleeveLength: "short", bottomLength: "not_applicable", beltMode: "" },
    bottom: { subtype: "chinos", layerRoles: [], sleeveLength: "not_applicable", bottomLength: "full", beltMode: "none" },
    shoes: { subtype: "sandals", layerRoles: [], sleeveLength: "not_applicable", bottomLength: "not_applicable", beltMode: "" },
    layer: { subtype: "jacket", layerRoles: ["outer"], sleeveLength: "long", bottomLength: "not_applicable", beltMode: "" },
    belt: { subtype: "casual belt", layerRoles: [], sleeveLength: "not_applicable", bottomLength: "not_applicable", beltMode: "" },
    socks: { subtype: "casual socks", layerRoles: [], sleeveLength: "not_applicable", bottomLength: "not_applicable", beltMode: "" }
  }[category];
  return SmartCloset.createItem({
    id, name: id, category, primaryColor: "navy", secondaryColor: "", pattern: "solid",
    formality: 2, occasions: ["casual"], warmth: "light", rainPolicy: "okay",
    rainProtection: "none", windProtection: "none", status: "available", preference: "neutral",
    labels: [], notes: "", ...defaults, ...extra
  }, { now: NOW });
}

function fixture() {
  const state = SmartCloset.createFreshState(NOW);
  state.setup = { completed: true, choice: "synthetic" };
  state.wardrobe = [
    item("top-one", "top", { name: "Current Renamed Top", primaryColor: "navy" }),
    item("top-two", "top", { name: "White Alternate Top", primaryColor: "white" }),
    item("bottom", "bottom", { name: "Khaki Chinos", primaryColor: "khaki" }),
    item("shoes", "shoes", { name: "Brown Sandals", primaryColor: "brown" }),
    item("layer", "layer", { name: "Custom Plum Jacket", primaryColor: "Plum Smoke", pattern: "striped" }),
    item("unavailable", "top", { name: "Unavailable Gray Tee", primaryColor: "gray", status: "unavailable" })
  ];
  state.history = [{
    id: "log-generated", date: "2026-09-01T16:00:00.000Z", occasion: "casual",
    itemIds: ["top-one", "bottom", "shoes", "missing-item"],
    itemSnapshots: [
      { ...state.wardrobe[0], name: "Saved Navy Top", category: "top" },
      { ...state.wardrobe[2] }, { ...state.wardrobe[3] }
    ],
    source: "generated", note: "Original note",
    context: { source: "current", temperatureC: 21, condition: "clear", precipitationBucket: "none", windBucket: "calm", exposure: "outdoors" }
  }, {
    id: "same-day", date: "2026-09-01T12:00:00", occasion: "casual",
    itemIds: ["top-two", "bottom", "shoes"], itemSnapshots: [], source: "manual", note: "Second same-day record", context: null
  }, {
    id: "legacy-gym", date: "2026-08-30T12:00:00", occasion: "gym",
    itemIds: ["top-two", "bottom", "shoes"], itemSnapshots: [], source: "manual", note: "Legacy occasion", context: null
  }];
  return state;
}

function historyHeavyFixture() {
  const state = SmartCloset.createFreshState(NOW);
  state.setup = { completed: true, choice: "synthetic" };
  state.wardrobe = [
    ...Array.from({ length: 12 }, (_, index) => item(`perf-top-${index}`, "top", { name: `Performance Top ${index}` })),
    ...Array.from({ length: 10 }, (_, index) => item(`perf-bottom-${index}`, "bottom", { name: `Performance Bottom ${index}` })),
    ...Array.from({ length: 12 }, (_, index) => item(`perf-shoes-${index}`, "shoes", { name: `Performance Shoes ${index}` }))
  ];
  state.history = Array.from({ length: 2400 }, (_, index) => ({
    id: `history-${index}`,
    date: `2025-${String((index % 12) + 1).padStart(2, "0")}-${String((index % 27) + 1).padStart(2, "0")}T12:00:00`,
    occasion: "casual",
    itemIds: [`perf-top-${index % 12}`, `perf-bottom-${index % 10}`, `perf-shoes-${index % 12}`],
    itemSnapshots: [], source: "manual", note: "", context: null
  }));
  return state;
}

async function freshPage(browser, baseUrl, options = {}) {
  const context = await browser.newContext({ viewport: { width: options.width || 1280, height: options.height || 900 }, colorScheme: options.colorScheme || "light", forcedColors: options.forcedColors || "none" });
  await context.addInitScript(({ payload, now }) => {
    localStorage.setItem("fitRoulette.v1", payload);
    localStorage.setItem("fitRoulette.v1.recovery.schema4", "synthetic-schema4-original");
    localStorage.setItem("fitRoulette.v1.recovery.schema5", "synthetic-schema5-original");
    localStorage.setItem("fitRoulette.v1.recovery.schema5.import.synthetic", "synthetic-import-original");
    window.__FIT_ROULETTE_TESTING__ = true;
    window.__FIT_ROULETTE_NOW__ = () => new Date(now).getTime();
    window.__locationRequests = 0;
    if (navigator.geolocation) navigator.geolocation.getCurrentPosition = () => { window.__locationRequests += 1; };
  }, { payload: JSON.stringify(options.state || fixture()), now: NOW });
  const page = await context.newPage();
  const issues = [];
  const externalRequests = [];
  page.on("console", (message) => { if (["warning", "error"].includes(message.type())) issues.push(`${message.type()}: ${message.text()}`); });
  page.on("pageerror", (error) => issues.push(`pageerror: ${error.message}`));
  page.on("request", (request) => { if (!request.url().startsWith(baseUrl.split("?")[0])) externalRequests.push(request.url()); });
  await page.goto(baseUrl, { waitUntil: "load" });
  return { context, page, issues, externalRequests };
}

async function verifyResponsive(browser, baseUrl, options) {
  const { context, page, issues } = await freshPage(browser, baseUrl, options);
  try {
    if (options.enlargedText) await page.evaluate(() => { document.documentElement.style.fontSize = "20px"; });
    await page.getByRole("button", { name: "Closet", exact: true }).click();
    assert.equal(await page.locator(".closet-card .closet-category-icon svg").count(), 5);
    assert.equal(await page.locator("#closetFilterCount").textContent(), "0 active");
    await page.locator("#closetFilterDetails").evaluate((node) => { node.open = true; });
    await page.locator("#closetColor").selectOption("Plum Smoke");
    assert.equal(await page.locator(".closet-card[data-item-id='layer']").count(), 1);
    assert.equal(await page.locator("#closetFilterCount").textContent(), "1 active");
    await page.locator("#clearClosetFiltersBtn").click();
    assert.equal(await page.locator("#closetFilterCount").textContent(), "0 active");

    await page.getByRole("button", { name: "History", exact: true }).click();
    await page.locator("#manualLogHistoryBtn").click();
    assert((await page.locator("#manualItemPicker details.manual-category").count()) >= 3);
    const dateBox = await page.locator("#manualLogDate").boundingBox();
    const formBox = await page.locator("#manualLogForm").boundingBox();
    assert(dateBox.x >= formBox.x && dateBox.x + dateBox.width <= formBox.x + formBox.width + 1, "Date input must stay contained.");
    const scrollOwners = await page.locator("#manualLogDialog").evaluate((dialog) => ({ dialog: getComputedStyle(dialog).overflowY, form: getComputedStyle(dialog.querySelector(".item-form")).overflowY }));
    assert.equal(scrollOwners.dialog, "hidden");
    assert(["auto", "scroll"].includes(scrollOwners.form));
    await page.locator("#manualItemPicker input[value='top-one']").check();
    assert.match(await page.locator("[data-manual-category-selected='top']").textContent(), /Current Renamed Top/);
    await page.locator("#closeManualLogBtn").click();
    assert.equal(await page.locator("#historyExitDialog").getAttribute("open") !== null, true);
    await page.locator("#discardHistoryExitBtn").click();

    await page.getByRole("button", { name: "Closet", exact: true }).click();
    await page.locator("#addItemBtn").click();
    await page.locator("#itemName").fill("Navy White Striped Polo");
    assert.equal(await page.locator("#itemPrimaryColor").inputValue(), "Navy");
    assert.equal(await page.locator("#itemSecondaryColor").inputValue(), "White");
    assert.equal(await page.locator("#itemPattern").inputValue(), "striped");
    assert.match(await page.locator("#itemNameSuggestion").textContent(), /Suggested from item name/);
    await page.locator("#closeItemDialogBtn").click();
    await page.locator("#discardItemExitBtn").click();

    const horizontalOverflow = await page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth));
    assert.equal(horizontalOverflow, 0);
    assert.deepEqual(issues, []);
    return { width: options.width, colorScheme: options.colorScheme, forcedColors: options.forcedColors || "none", enlargedText: Boolean(options.enlargedText), horizontalOverflow };
  } finally { await context.close(); }
}

async function verifyHistoryEdit(browser, baseUrl) {
  const { context, page, issues } = await freshPage(browser, baseUrl, { width: 768 });
  try {
    const recoveryBefore = await page.evaluate(() => [
      localStorage.getItem("fitRoulette.v1.recovery.schema4"),
      localStorage.getItem("fitRoulette.v1.recovery.schema5"),
      localStorage.getItem("fitRoulette.v1.recovery.schema5.import.synthetic")
    ]);
    await page.evaluate(() => {
      window.__primaryWrites = 0;
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function(key, value) {
        if (key === "fitRoulette.v1") window.__primaryWrites += 1;
        return original.call(this, key, value);
      };
    });
    await page.getByRole("button", { name: "History", exact: true }).click();
    await page.locator("[data-log-id='log-generated'] [data-action='edit-log']").click();
    assert.match(await page.locator("#manualSelectedSummary").textContent(), /Saved Navy Top/);
    assert.match(await page.locator("#manualSelectedSummary").textContent(), /Missing garment reference/);
    await page.locator("#manualLogNote").fill("Edited note");
    await page.locator("#manualLogSubmitBtn").click();
    const sameDate = await page.evaluate(() => ({ writes: window.__primaryWrites, record: window.__fitRouletteTest.getState().history.find((entry) => entry.id === "log-generated") }));
    assert.equal(sameDate.writes, 1, "History Edit must write primary storage exactly once.");
    assert.equal(sameDate.record.source, "generated");
    assert.equal(sameDate.record.date, "2026-09-01T16:00:00.000Z");
    assert.equal(sameDate.record.context.source, "current");
    assert.deepEqual(sameDate.record.itemIds, ["top-one", "bottom", "shoes", "missing-item"]);
    assert.equal(sameDate.record.itemSnapshots.find((entry) => entry.id === "top-one").name, "Saved Navy Top");
    assert.equal(sameDate.record.note, "Edited note");
    assert.equal(await page.locator("[data-log-id='same-day']").count(), 1, "Another record on the same day must retain its identity.");

    await page.locator("[data-log-id='log-generated'] [data-action='edit-log']").click();
    await page.locator("#manualLogDate").fill("2026-09-02");
    assert.match(await page.locator("#manualContextNotice").textContent(), /remove the saved context snapshot/);
    await page.locator("#manualLogSubmitBtn").click();
    const changedDate = await page.evaluate(() => window.__fitRouletteTest.getState().history.find((entry) => entry.id === "log-generated"));
    assert.equal(changedDate.context, null);
    assert.equal(changedDate.date, "2026-09-02T12:00:00");
    assert.equal(await page.evaluate(() => window.__primaryWrites), 2);

    await page.locator("[data-log-id='log-generated'] [data-action='edit-log']").click();
    await page.locator("#manualLogNote").fill("Discard this draft");
    await page.locator("#closeManualLogBtn").click();
    await page.locator("#discardHistoryExitBtn").click();
    assert.deepEqual(await page.evaluate(() => [
      localStorage.getItem("fitRoulette.v1.recovery.schema4"),
      localStorage.getItem("fitRoulette.v1.recovery.schema5"),
      localStorage.getItem("fitRoulette.v1.recovery.schema5.import.synthetic")
    ]), recoveryBefore, "History Edit must not rewrite recovery storage.");
    await page.locator("[data-log-id='legacy-gym'] [data-action='edit-log']").click();
    assert.equal(await page.locator("#manualLogOccasion").inputValue(), "gym", "Legacy Gym / Errands must remain editable without remapping.");
    await page.locator("#closeManualLogBtn").click();
    assert.equal(await page.evaluate(() => window.__primaryWrites), 2, "Discard must not write storage.");
    assert.equal((await page.evaluate(() => window.__fitRouletteTest.getState().history.find((entry) => entry.id === "log-generated"))).note, "Edited note");

    await page.locator("[data-log-id='log-generated'] [data-action='edit-log']").click();
    await page.locator("#manualLogNote").fill("Persistence must fail atomically");
    await page.evaluate(() => {
      window.__savedSetItem = Storage.prototype.setItem;
      Storage.prototype.setItem = function(key, value) {
        if (key === "fitRoulette.v1") throw new Error("Synthetic storage failure");
        return window.__savedSetItem.call(this, key, value);
      };
    });
    await page.locator("#manualLogSubmitBtn").click();
    assert.match(await page.locator("#manualLogError").textContent(), /not saved/);
    assert.equal((await page.evaluate(() => window.__fitRouletteTest.getState().history.find((entry) => entry.id === "log-generated"))).note, "Edited note");
    await page.evaluate(() => { Storage.prototype.setItem = window.__savedSetItem; });
    await page.locator("#closeManualLogBtn").click();
    await page.locator("#discardHistoryExitBtn").click();
    const unexpectedIssues = issues.filter((message) => !message.includes("Synthetic storage failure"));
    assert.deepEqual(unexpectedIssues, []);
    return { oneWritePerSave: true, sourcePreserved: true, snapshotPreserved: true, brokenReferencePreserved: true, dateChangeClearsContext: true, discardWrites: 0, persistenceFailureAtomic: true, recoveryByteEquivalent: true };
  } finally { await context.close(); }
}

async function verifySuggestionAndSwapBoundaries(browser, baseUrl) {
  const { context, page, issues } = await freshPage(browser, baseUrl, { width: 768 });
  try {
    const suggestions = await page.evaluate(() => [
      window.__fitRouletteTest.suggestFromItemName("Off-White Navy Striped Polo"),
      window.__fitRouletteTest.suggestFromItemName("Dark Grey Checked Jacket"),
      window.__fitRouletteTest.suggestFromItemName("Midnight Storm Tee")
    ]);
    assert.deepEqual(suggestions[0], { colors: ["off-white", "navy"], pattern: "striped" });
    assert.deepEqual(suggestions[1], { colors: ["dark gray"], pattern: "plaid" });
    assert.deepEqual(suggestions[2], { colors: [], pattern: "" });

    await page.getByRole("button", { name: "Closet", exact: true }).click();
    await page.locator("#addItemBtn").click();
    const itemScroll = await page.locator("#itemDialog").evaluate((dialog) => ({ dialog: getComputedStyle(dialog).overflowY, form: getComputedStyle(dialog.querySelector(".item-form")).overflowY }));
    assert.equal(itemScroll.dialog, "hidden");
    assert(["auto", "scroll"].includes(itemScroll.form));
    await page.locator("#itemName").fill("Navy Striped Polo");
    await page.locator('[data-color-kind="primary"][data-color="Red"]').click();
    await page.locator("#itemName").fill("Blue Striped Polo");
    assert.equal(await page.locator("#itemPrimaryColor").inputValue(), "Red", "An explicit color choice must win over later name suggestions.");
    await page.locator("#closeItemDialogBtn").click();
    await page.locator("#discardItemExitBtn").click();

    await page.locator(".closet-card[data-item-id='top-one'] [data-action='edit']").click();
    await page.locator("#itemName").fill("Red Striped Current Top");
    assert.equal(await page.locator("#itemPrimaryColor").inputValue(), "Navy", "Edit must not apply name suggestions.");
    assert.equal(await page.locator("#itemPattern").inputValue(), "solid");
    await page.locator("#closeItemDialogBtn").click();
    await page.locator("#discardItemExitBtn").click();

    await page.evaluate(() => {
      const state = window.__fitRouletteTest.getState();
      const top = state.wardrobe.find((item) => item.id === "top-one");
      const bottom = state.wardrobe.find((item) => item.id === "bottom");
      const shoes = state.wardrobe.find((item) => item.id === "shoes");
      window.__fitRouletteTest.setCurrentOutfit({ occasion: "casual", buildAroundId: "", items: [top, bottom, shoes], score: 100, context: { source: "none" } });
      window.__fitRouletteTest.renderResult();
    });
    await page.getByRole("button", { name: "Generate", exact: true }).click();
    const swapButton = page.locator("[data-result-item-id='top-one'] [data-result-action='swap']");
    await swapButton.focus();
    await swapButton.click();
    assert.equal(await page.locator("#swapDialogTitle").evaluate((node) => document.activeElement === node), true);
    await page.locator("#swapDialogScroll").evaluate((node) => { node.scrollTop = 500; });
    await page.locator("#closeSwapDialogBtn").click();
    assert.equal(await swapButton.evaluate((node) => document.activeElement === node), true, "Closing Swap must restore focus.");
    await swapButton.click();
    assert.equal(await page.locator("#swapDialogScroll").evaluate((node) => node.scrollTop), 0, "Every Swap open must reset scroll.");
    await page.locator("#closeSwapDialogBtn").click();
    assert.deepEqual(issues, []);
    return { conservativeSuggestions: true, explicitOverridePreserved: true, editSuggestionsDisabled: true, singleDialogScrollOwner: true, swapScrollReset: true, swapFocusRestored: true };
  } finally { await context.close(); }
}

async function verifyGeneration(browser, baseUrl) {
  const state = historyHeavyFixture();
  const { context, page, issues, externalRequests } = await freshPage(browser, baseUrl, { width: 1280, state });
  try {
    const before = await page.evaluate(() => localStorage.getItem("fitRoulette.v1"));
    const immediate = await page.evaluate(() => {
      document.querySelector("#generateBtn").click();
      return { disabled: document.querySelector("#generateBtn").disabled, status: document.querySelector("#generationStatus").textContent, busy: document.querySelector("#outfitResult").getAttribute("aria-busy") };
    });
    assert.equal(immediate.disabled, true);
    assert.equal(immediate.busy, "true");
    assert.match(immediate.status, /Building your fit/);
    const started = Date.now();
    await page.locator("#generationStatus").filter({ hasText: /Fit ready|No fit matched/ }).waitFor({ timeout: 10000 });
    const durationMs = Date.now() - started;
    assert(durationMs < 3000, `History-heavy generation took ${durationMs}ms after the paint checkpoint.`);
    assert.equal(await page.evaluate(() => localStorage.getItem("fitRoulette.v1")), before, "Generation without logging must not write product state.");
    assert.equal(await page.evaluate(() => window.__locationRequests), 0);
    assert.deepEqual(externalRequests, []);
    assert.deepEqual(issues, []);
    return { wardrobeItems: 34, historyRecords: 2400, durationMs, progressAnnounced: true, stateByteEquivalent: true };
  } finally { await context.close(); }
}

(async () => {
  const { chromium } = loadPlaywright();
  const executablePath = browserExecutable();
  assert(executablePath, "No Chromium browser was found.");
  const server = await serve();
  const browser = await chromium.launch({ executablePath, headless: true });
  try {
    const baseUrl = `http://127.0.0.1:${server.address().port}/?v162-ui=1`;
    const responsive = [];
    for (const options of [
      { width: 320, colorScheme: "light", enlargedText: true },
      { width: 359, colorScheme: "dark" },
      { width: 768, colorScheme: "light" },
      { width: 1280, colorScheme: "dark" },
      { width: 359, colorScheme: "light", forcedColors: "active" }
    ]) responsive.push(await verifyResponsive(browser, baseUrl, options));
    const historyEdit = await verifyHistoryEdit(browser, baseUrl);
    const editorBoundaries = await verifySuggestionAndSwapBoundaries(browser, baseUrl);
    const generation = await verifyGeneration(browser, baseUrl);
    console.log(JSON.stringify({ ok: true, responsive, historyEdit, editorBoundaries, generation, personalDataAccessed: false, realLocationAccessed: false }));
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
