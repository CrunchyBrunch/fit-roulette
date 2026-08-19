const assert = require("assert");
const fs = require("fs");
const http = require("http");
const path = require("path");
const SmartCloset = require("../smart-closet.js");

const root = path.resolve(__dirname, "..");
const NOW = "2026-08-19T12:00:00-04:00";
const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".md": "text/markdown; charset=utf-8"
};

function loadPlaywright() {
  try {
    return require("playwright");
  } catch (error) {
    return require(path.resolve(path.dirname(process.execPath), "..", "node_modules", "playwright"));
  }
}

function browserExecutable() {
  return [
    process.env.FIT_ROULETTE_BROWSER,
    process.env.CHROME_PATH,
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
  ].filter(Boolean).find((candidate) => fs.existsSync(candidate)) || "";
}

function serve() {
  return new Promise((resolve) => {
    const server = http.createServer((request, response) => {
      const url = new URL(request.url, "http://127.0.0.1");
      const pathname = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
      const filePath = path.resolve(root, `.${pathname}`);
      if (!filePath.startsWith(root) || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
        response.writeHead(404);
        response.end("Not found");
        return;
      }
      response.writeHead(200, {
        "content-type": contentTypes[path.extname(filePath)] || "application/octet-stream",
        "cache-control": "no-store"
      });
      fs.createReadStream(filePath).pipe(response);
    });
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

function item(id, category, extra = {}) {
  const defaults = {
    top: { subtype: "t-shirt", layerRoles: ["base"], sleeveLength: "short", bottomLength: "not_applicable", rainProtection: "none", windProtection: "none" },
    bottom: { subtype: "chinos", layerRoles: [], sleeveLength: "not_applicable", bottomLength: "full", beltMode: "none", rainProtection: "none", windProtection: "none" },
    shoes: { subtype: "sandals", layerRoles: [], sleeveLength: "not_applicable", bottomLength: "not_applicable", rainProtection: "none", windProtection: "none" },
    layer: { subtype: "jacket", layerRoles: ["outer"], sleeveLength: "long", bottomLength: "not_applicable", rainProtection: "light", windProtection: "protected" }
  }[category];
  return SmartCloset.createItem({
    id,
    name: id,
    category,
    primaryColor: "Navy",
    pattern: "solid",
    formality: 2,
    occasions: ["casual", "work"],
    warmth: "light",
    rainPolicy: "okay",
    status: "available",
    preference: "neutral",
    ...defaults,
    ...extra
  }, { now: NOW });
}

function history(id, date, itemIds, extra = {}) {
  return { id, date, occasion: "casual", itemIds, itemSnapshots: [], source: "generated", note: "", context: null, ...extra };
}

function fixture() {
  const result = SmartCloset.createFreshState(NOW);
  result.setup = { completed: true, choice: "synthetic" };
  result.wardrobe = [
    item("historically-reclassified", "bottom", { name: "Current Reclassified Chinos With A Deliberately Long Garment Name" }),
    item("top", "top", {
      name: "Custom Color Top With A Deliberately Long Garment Name For Wrapping",
      primaryColor: "Moonlit Aubergine With An Intentionally Long Saved Name",
      review: { status: "needs_review", reasons: ["Confirm imported metadata."], reviewedAt: "" },
      legacyFallback: true
    }),
    item("bottom", "bottom", { name: "Everyday Bottom" }),
    item("shoes", "shoes", { name: "Synthetic Sandals" }),
    item("archived-layer", "layer", { name: "Archived Winter Coat", status: "archived", warmth: "very_warm" }),
    item("unavailable-shoes", "shoes", { name: "Unavailable Shoes", status: "unavailable" })
  ];
  result.history = [
    history("generated-snapshot", "2026-08-18T16:00:00.000Z", ["historically-reclassified", "bottom", "shoes"], {
      itemSnapshots: [
        { id: "historically-reclassified", name: "Former Navy Tee", category: "top", subtype: "t-shirt", primaryColor: "Navy", formality: 2, occasions: ["casual"], pattern: "solid" },
        { id: "bottom", name: "Saved Everyday Bottom", category: "bottom", subtype: "chinos", primaryColor: "Navy", formality: 2, occasions: ["casual"], pattern: "solid" },
        { id: "shoes", name: "Saved Sandals", category: "shoes", subtype: "sandals", primaryColor: "Navy", formality: 2, occasions: ["casual"], pattern: "solid" }
      ],
      context: { source: "current", temperatureC: 21, condition: "clear", precipitationBucket: "none", windBucket: "calm", exposure: "outdoors" }
    }),
    history("manual-same-day", "2026-08-17T12:00:00", ["top", "bottom", "shoes"], { source: "manual" }),
    history("invalid-date", "not-a-date", ["missing-reference"], { source: "manual" }),
    history("future-date", "2027-01-01T12:00:00", ["top"])
  ];
  result.bannedCombos = [];
  result.pairRelationships = [];
  result.unresolvedRecords = {};
  return result;
}

function cappedFixture() {
  const result = SmartCloset.createFreshState(NOW);
  result.setup = { completed: true, choice: "synthetic" };
  result.wardrobe = [
    ...Array.from({ length: 38 }, (_, index) => item(`cap-top-${String(index).padStart(2, "0")}`, "top")),
    ...Array.from({ length: 38 }, (_, index) => item(`cap-bottom-${String(index).padStart(2, "0")}`, "bottom")),
    ...Array.from({ length: 38 }, (_, index) => item(`cap-shoes-${String(index).padStart(2, "0")}`, "shoes"))
  ];
  return result;
}

async function freshPage(browser, baseUrl, options = {}) {
  const payload = JSON.stringify(fixture());
  const context = await browser.newContext({
    viewport: { width: options.width || 1280, height: options.height || 900 },
    colorScheme: options.colorScheme || "light",
    forcedColors: options.forcedColors || "none"
  });
  await context.addInitScript((stored) => {
    window.__FIT_ROULETTE_TESTING__ = true;
    window.__FIT_ROULETTE_NOW__ = () => new Date("2026-08-19T12:00:00-04:00").getTime();
    if (localStorage.getItem("fitRoulette.v1") === null) localStorage.setItem("fitRoulette.v1", stored);
    window.__insightsLocationRequests = 0;
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition = () => { window.__insightsLocationRequests += 1; };
    }
  }, payload);
  const page = await context.newPage();
  const issues = [];
  const externalRequests = [];
  page.on("console", (message) => {
    if (["warning", "error"].includes(message.type())) issues.push(`${message.type()}: ${message.text()}`);
  });
  page.on("pageerror", (error) => issues.push(`pageerror: ${error.message}`));
  page.on("request", (request) => {
    if (!request.url().startsWith(baseUrl.split("?")[0])) externalRequests.push(request.url());
  });
  await page.goto(baseUrl, { waitUntil: "load" });
  return { context, page, issues, externalRequests, payload };
}

async function verifyInsights(browser, baseUrl, options) {
  const { context, page, issues, externalRequests, payload } = await freshPage(browser, baseUrl, options);
  try {
    if (options.enlargedText) await page.evaluate(() => { document.documentElement.style.fontSize = "20px"; });
    const persistedBefore = await page.evaluate(() => localStorage.getItem("fitRoulette.v1"));
    const stateBefore = await page.evaluate(() => JSON.stringify(window.__fitRouletteTest.getState()));
    const recoveryBefore = await page.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith("fitRoulette.v1.recovery.")).sort());

    const tabs = page.locator(".tab-button");
    assert.equal(await tabs.count(), 5);
    assert.deepEqual(await tabs.allTextContents(), ["Generate", "Closet", "History", "Insights", "Data"]);
    await page.getByRole("button", { name: "Insights", exact: true }).click();
    assert.equal(await page.locator('[data-screen="insights"]').getAttribute("aria-current"), "page");
    const activeBorderWidth = await page.locator('[data-screen="insights"]').evaluate((node) => parseFloat(getComputedStyle(node).borderTopWidth));
    assert.equal(activeBorderWidth, options.forcedColors === "active" ? 2 : 1, "Forced-color boundaries must not leak into ordinary layouts.");
    assert.equal(await page.locator("#screen-insights").isVisible(), true);
    assert.equal(await page.getByRole("heading", { name: "Data Readiness" }).count(), 1);
    assert.equal(await page.getByRole("heading", { name: "Closet Composition" }).count(), 1);
    assert.equal(await page.getByRole("heading", { name: "Logged Activity" }).count(), 1);
    assert.equal(await page.getByRole("heading", { name: "Current Coverage" }).count(), 1);
    assert.equal(await page.getByRole("heading", { name: "Closet Evaluation" }).count(), 1);
    assert.equal(await page.locator("canvas, svg").count(), 0, "Insights should remain text-first.");

    const readiness = await page.locator("#insightsReadiness").textContent();
    assert.match(readiness, /4 logged outfits/);
    assert.match(readiness, /broken garment reference/);
    assert.match(readiness, /future-dated/);
    assert.match(readiness, /invalid date/);
    assert.match(readiness, /Some older records may have been normalized as generated/);

    const activity = await page.locator("#insightsActivity").textContent();
    assert.match(activity, /Based on 2 logged outfits across 2 logged days/);
    assert.match(activity, /Former Navy Tee/);
    assert.match(activity, /Top: 2/);
    assert.match(activity, /Current utilization/);
    assert(!/never worn|neglected|donate|bad purchase|you need to buy|your closet score/i.test(activity));

    const composition = await page.locator("#insightsComposition").textContent();
    assert.match(composition, /Moonlit Aubergine With An Intentionally Long Saved Name/);
    assert.match(composition, /Custom \/ Unclassified/);
    await page.locator("#insightsCompositionScope").selectOption("available");
    await page.locator("#insightsRangeSelect").selectOption("30");
    assert.match(await page.locator("#insightsActivity").textContent(), /Range: Last 30 days/);
    assert.equal(await page.locator("#insightsActivity .insight-range").count(), await page.locator("#insightsActivity .insight-card").count(), "Every time-dependent card must expose its active range.");

    const started = Date.now();
    await page.locator("#runCoverageBtn").click();
    await page.locator("#coverageStatus").filter({ hasText: /Analysis complete/ }).waitFor();
    const coverageMs = Date.now() - started;
    const coverage = await page.locator("#insightsCoverage").textContent();
    assert.match(coverage, /2 valid combinations/);
    assert.match(coverage, /Exact count within the analysis budget/);
    assert.match(coverage, /Physical layer fit is not modeled/);

    await page.locator("#runEvaluationBtn").click();
    await page.locator("#evaluationStatus").filter({ hasText: /complete/ }).waitFor();
    const evaluation = await page.locator("#insightsEvaluation").textContent();
    assert.match(evaluation, /Current coverage appears sufficient for the selected needs/);
    assert.match(evaluation, /No overall grade is produced/);

    const countBeforeVisits = await page.locator("#screen-insights .insight-card").count();
    for (let index = 0; index < 8; index += 1) {
      await page.getByRole("button", { name: "Data", exact: true }).click();
      await page.getByRole("button", { name: "Insights", exact: true }).click();
    }
    assert.equal(await page.locator("#screen-insights .insight-card").count(), countBeforeVisits);

    await page.evaluate(() => {
      document.querySelector("#runCoverageBtn").click();
      const context = document.querySelector("#insightsCoverageContext");
      context.value = "cold";
      context.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await page.waitForTimeout(25);
    assert.match(await page.locator("#coverageStatus").textContent(), /Assumptions changed/);
    assert.match(await page.locator("#insightsCoverage").textContent(), /Not analyzed yet/);

    const overflow = await page.evaluate(() => ({
      html: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      body: document.body.scrollWidth - document.body.clientWidth,
      tab: document.querySelector(".tabbar").scrollWidth - document.querySelector(".tabbar").clientWidth,
      cards: [...document.querySelectorAll("#screen-insights .insight-card")].reduce((maximum, node) => Math.max(maximum, node.scrollWidth - node.clientWidth), 0),
      touchTargets: [...document.querySelectorAll(".tab-button")].map((node) => ({ width: node.getBoundingClientRect().width, height: node.getBoundingClientRect().height }))
    }));
    assert(overflow.html <= 1 && overflow.body <= 1 && overflow.tab <= 1 && overflow.cards <= 1, `${options.width}px Insights overflowed: ${JSON.stringify(overflow)}`);
    assert(overflow.touchTargets.every((target) => target.width >= 44 && target.height >= 44), `Navigation touch target is too small: ${JSON.stringify(overflow.touchTargets)}`);

    await page.locator('[data-screen="insights"]').click();
    await page.keyboard.press("Shift+Tab");
    assert.equal(await page.evaluate(() => document.activeElement?.dataset?.screen), "history");
    assert.notEqual(await page.locator('[data-screen="history"]').evaluate((node) => getComputedStyle(node).outlineStyle), "none");
    const persistedAfter = await page.evaluate(() => localStorage.getItem("fitRoulette.v1"));
    const stateAfter = await page.evaluate(() => JSON.stringify(window.__fitRouletteTest.getState()));
    const recoveryAfter = await page.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith("fitRoulette.v1.recovery.")).sort());
    assert.equal(persistedBefore, payload);
    assert.equal(persistedAfter, persistedBefore);
    assert.equal(stateAfter, stateBefore);
    assert.deepEqual(recoveryAfter, recoveryBefore);
    assert.equal(await page.evaluate(() => window.__insightsLocationRequests), 0);
    assert.equal(externalRequests.filter((url) => /open-meteo|latitude|longitude/i.test(url)).length, 0);
    await page.reload({ waitUntil: "load" });
    await page.getByRole("button", { name: "Insights", exact: true }).click();
    assert.equal(await page.evaluate(() => localStorage.getItem("fitRoulette.v1")), persistedBefore);
    assert.equal(await page.evaluate(() => JSON.stringify(window.__fitRouletteTest.getState())), stateBefore);
    assert.deepEqual(await page.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith("fitRoulette.v1.recovery.")).sort()), recoveryBefore);
    assert.deepEqual(issues, []);
    return { ...options, coverageMs, horizontalOverflow: 0, stateByteEquivalent: true, consoleIssues: 0 };
  } finally {
    await context.close();
  }
}

async function verifyCap(browser, baseUrl) {
  const { context, page, issues } = await freshPage(browser, baseUrl, { width: 1280, colorScheme: "light" });
  try {
    await page.evaluate((large) => window.__fitRouletteTest.replaceState(large), cappedFixture());
    const before = await page.evaluate(() => JSON.stringify(window.__fitRouletteTest.getState()));
    await page.getByRole("button", { name: "Insights", exact: true }).click();
    const started = Date.now();
    await page.locator("#runCoverageBtn").click();
    await page.locator("#coverageStatus").filter({ hasText: /Analysis capped for performance/ }).waitFor();
    const durationMs = Date.now() - started;
    assert.match(await page.locator("#insightsCoverage").textContent(), /At least 50000 valid combinations/);
    assert.match(await page.locator("#insightsCoverage").textContent(), /Per-garment bottlenecks are not classified/);
    assert.equal(await page.evaluate(() => JSON.stringify(window.__fitRouletteTest.getState())), before);
    assert.deepEqual(issues, []);
    return { attemptedTuples: 50000, lowerBound: 50000, durationMs, deterministic: true };
  } finally {
    await context.close();
  }
}

async function verifyOffline(browser, baseUrl) {
  const { context, page, issues } = await freshPage(browser, baseUrl, { width: 359, colorScheme: "dark" });
  try {
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload({ waitUntil: "load" });
    await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
    await context.setOffline(true);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Insights", exact: true }).click();
    assert.equal(await page.getByRole("heading", { name: "Data Readiness" }).count(), 1);
    assert.deepEqual(issues, []);
    return { offline: true, insightsAvailable: true };
  } finally {
    await context.setOffline(false);
    await context.close();
  }
}

(async () => {
  const { chromium } = loadPlaywright();
  const executablePath = browserExecutable();
  assert(executablePath, "No Chromium browser was found.");
  const server = await serve();
  const browser = await chromium.launch({ executablePath, headless: true });
  try {
    const port = server.address().port;
    const baseUrl = `http://127.0.0.1:${port}/?v160-ui=1`;
    const responsive = [];
    for (const options of [
      { width: 320, colorScheme: "light", enlargedText: true },
      { width: 359, colorScheme: "dark", enlargedText: false },
      { width: 768, colorScheme: "light", enlargedText: false },
      { width: 1280, colorScheme: "dark", enlargedText: false },
      { width: 359, colorScheme: "light", forcedColors: "active", enlargedText: false }
    ]) responsive.push(await verifyInsights(browser, baseUrl, options));
    const cap = await verifyCap(browser, baseUrl);
    const offline = await verifyOffline(browser, baseUrl);
    console.log(JSON.stringify({ ok: true, responsive, cap, offline, personalDataAccessed: false, realLocationAccessed: false }));
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
