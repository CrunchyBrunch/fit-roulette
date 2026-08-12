const assert = require("assert");
const fs = require("fs");
const http = require("http");
const path = require("path");

const root = path.resolve(__dirname, "..");
const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png"
};

function loadPlaywright() {
  try {
    return require("playwright");
  } catch (firstError) {
    const bundled = path.resolve(path.dirname(process.execPath), "..", "node_modules", "playwright");
    try {
      return require(bundled);
    } catch (secondError) {
      throw new Error("Playwright is required for rendered layout verification. Install it or use the bundled workspace Node runtime.");
    }
  }
}

function browserExecutable() {
  const candidates = [
    process.env.FIT_ROULETTE_BROWSER,
    process.env.CHROME_PATH,
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "/usr/bin/google-chrome",
    "/usr/bin/microsoft-edge",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser"
  ].filter(Boolean);
  return candidates.find((candidate) => fs.existsSync(candidate)) || "";
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

async function seedSyntheticCloset(page) {
  await page.evaluate(() => {
    const Smart = window.FitRouletteSmartCloset;
    const now = "2026-08-12T12:00:00.000Z";
    let state = Smart.createFreshState(now);
    state.setup = { completed: true, choice: "existing" };
    const makeItem = (id, name, subtype, overrides = {}) => Smart.createItem({
      id, name, ...Smart.SUBTYPE_TEMPLATES[subtype], primaryColor: "Navy", status: "available",
      preference: "neutral", labels: [], review: { status: "reviewed", reasons: [], reviewedAt: now },
      legacyFallback: false, legacyMatching: {}, ...overrides
    }, { now });
    const source = makeItem(
      "layout_source",
      "A Very Long Synthetic Navy Polo Used Only For Narrow Dialog Verification",
      "polo"
    );
    state.wardrobe = [source];
    for (let index = 0; index < 30; index += 1) {
      state.wardrobe.push(makeItem(
        `layout_candidate_${index}`,
        `Long Synthetic Relationship Candidate ${String(index + 1).padStart(2, "0")} With Supported Garment Text`,
        "chinos",
        { primaryColor: index % 2 ? "Khaki" : "Charcoal" }
      ));
    }
    for (let index = 0; index < 24; index += 1) {
      state = Smart.setRelationship(
        state,
        source.id,
        `layout_candidate_${index}`,
        index < 12 ? "prefer" : "never",
        now
      );
    }
    localStorage.setItem("fitRoulette.v1", JSON.stringify(state));
  });
  await page.reload({ waitUntil: "load" });
}

async function openStressDetails(page) {
  for (const selector of ["#matchingDetails", "#preferDetails", "#neverDetails", "#advancedDetails"]) {
    const details = page.locator(selector);
    if (await details.count() && !(await details.evaluate((element) => element.open))) {
      await details.locator(":scope > summary").click();
    }
  }
}

async function closeEditor(page) {
  await page.locator("#closeItemDialogBtn").click();
  if (await page.locator("#itemExitDialog").evaluate((element) => element.open)) {
    await page.locator("#discardItemExitBtn").click();
  }
}

async function measure(page, mode, width) {
  return page.evaluate(({ mode, width }) => {
    const html = document.documentElement;
    const body = document.body;
    const dialog = document.querySelector("#itemDialog");
    const form = document.querySelector("#itemForm");
    const fieldset = document.querySelector("#layerRoleFieldset");
    const segmented = fieldset.querySelector(".segmented-control");
    const rect = (element) => {
      const value = element.getBoundingClientRect();
      return { left: value.left, right: value.right, width: value.width, height: value.height };
    };
    const inputs = [...segmented.querySelectorAll('input[name="itemLayerRole"]')].map((input) => {
      const style = getComputedStyle(input);
      return {
        value: input.value,
        checked: input.checked,
        label: input.labels?.[0]?.textContent?.trim() || "",
        rect: rect(input),
        spanRect: rect(input.nextElementSibling),
        display: style.display,
        visibility: style.visibility,
        opacity: style.opacity,
        position: style.position,
        width: style.width,
        height: style.height,
        minHeight: style.minHeight,
        margin: style.margin,
        padding: style.padding,
        border: style.border,
        clip: style.clip,
        clipPath: style.clipPath,
        transform: style.transform,
        overflow: style.overflow,
        pointerEvents: style.pointerEvents
      };
    });
    return {
      width,
      mode,
      page: {
        htmlClientWidth: html.clientWidth,
        htmlScrollWidth: html.scrollWidth,
        bodyClientWidth: body.clientWidth,
        bodyScrollWidth: body.scrollWidth
      },
      dialog: {
        clientWidth: dialog.clientWidth,
        scrollWidth: dialog.scrollWidth,
        clientHeight: dialog.clientHeight,
        scrollHeight: dialog.scrollHeight,
        overflowX: getComputedStyle(dialog).overflowX,
        overflowY: getComputedStyle(dialog).overflowY,
        rect: rect(dialog)
      },
      wrappers: [form, document.querySelector("#matchingDetails"), fieldset, segmented]
        .filter(Boolean).map((element) => ({
          id: element.id,
          className: element.className,
          clientWidth: element.clientWidth,
          scrollWidth: element.scrollWidth,
          rect: rect(element)
        })),
      inputs,
      preferCount: document.querySelector("#preferItemsCount")?.textContent || "",
      neverCount: document.querySelector("#neverItemsCount")?.textContent || "",
      controlStates: [
        "itemPrimaryColor", "itemSecondaryColor", "itemPattern", "itemRainPolicy",
        "itemRainProtection", "itemWindProtection", "layerRoleFieldset"
      ].map((id) => {
        const element = document.getElementById(id);
        return { id, visible: element.getBoundingClientRect().height > 0 };
      }),
      customColorOptions: ["itemPrimaryColor", "itemSecondaryColor"].map((id) => (
        [...document.getElementById(id).options].some((option) => option.textContent.trim() === "Custom color…")
      )),
      validationVisible: !document.querySelector("#formError")?.hidden,
      closeVisible: document.querySelector("#closeItemDialogBtn")?.getBoundingClientRect().height > 0,
      actionsVisible: document.querySelector(".dialog-actions")?.getBoundingClientRect().height > 0
    };
  }, { mode, width });
}

async function exerciseSegmentedControl(page) {
  const inputs = page.locator('#layerRoleFieldset input[name="itemLayerRole"]');
  const before = await inputs.evaluateAll((elements) => elements.map((input) => input.checked));
  for (let index = 0; index < await inputs.count(); index += 1) {
    await inputs.nth(index).locator("xpath=..").click();
  }
  const afterPointer = await inputs.evaluateAll((elements) => elements.map((input) => input.checked));
  const mid = inputs.nth(1);
  await mid.focus();
  await page.keyboard.press("Shift+Tab");
  const keyboardFocused = page.locator('#layerRoleFieldset input[name="itemLayerRole"]:focus');
  const focus = await keyboardFocused.evaluate((input) => ({
    active: document.activeElement === input,
    outlineStyle: getComputedStyle(input.nextElementSibling).outlineStyle,
    outlineWidth: getComputedStyle(input.nextElementSibling).outlineWidth
  }));
  const beforeSpace = await keyboardFocused.isChecked();
  await page.keyboard.press("Space");
  const afterSpace = await keyboardFocused.isChecked();
  return {
    before,
    afterPointer,
    focus,
    keyboardChanged: beforeSpace !== afterSpace,
    nativeTypes: await inputs.evaluateAll((elements) => elements.map((input) => input.type)),
    labels: await inputs.evaluateAll((elements) => elements.map((input) => input.labels?.[0]?.textContent?.trim() || ""))
  };
}

function verifyReport(report) {
  for (const result of report.results) {
    assert(result.page.htmlScrollWidth <= result.page.htmlClientWidth, `${report.width}px ${result.mode}: document overflowed.`);
    assert(result.page.bodyScrollWidth <= result.page.bodyClientWidth, `${report.width}px ${result.mode}: body overflowed.`);
    assert(result.dialog.scrollWidth <= result.dialog.clientWidth, `${report.width}px ${result.mode}: dialog overflowed ${result.dialog.scrollWidth}/${result.dialog.clientWidth}.`);
    assert(result.dialog.scrollHeight > result.dialog.clientHeight, `${report.width}px ${result.mode}: vertical dialog scrolling was lost.`);
    assert(result.closeVisible && result.actionsVisible, `${report.width}px ${result.mode}: editor controls became unreachable.`);
    for (const input of result.inputs) {
      assert.notEqual(input.display, "none", "Native segmented input was removed from accessibility.");
      assert.notEqual(input.visibility, "hidden", "Native segmented input was hidden from accessibility.");
      assert(input.label, "Native segmented input lost its associated label.");
      assert(input.rect.width <= 2 && input.rect.height <= 2, `${report.width}px ${result.mode}: hidden segmented input retained full dimensions.`);
      assert(input.spanRect.height >= 42, `${report.width}px ${result.mode}: visible segmented target became too short.`);
    }
    for (const wrapper of result.wrappers) {
      assert(wrapper.scrollWidth <= wrapper.clientWidth, `${report.width}px ${result.mode}: ${wrapper.id || wrapper.className} overflowed ${wrapper.scrollWidth}/${wrapper.clientWidth}.`);
    }
    assert(result.controlStates.every((control) => control.visible), `${report.width}px ${result.mode}: a required editor control was not rendered.`);
    assert(result.customColorOptions.every(Boolean), `${report.width}px ${result.mode}: a custom-color route was missing.`);
    const segmented = result.wrappers.find((entry) => String(entry.className).includes("segmented-control"));
    const fieldset = result.wrappers.find((entry) => entry.id === "layerRoleFieldset");
    assert(segmented.rect.right <= fieldset.rect.right + 1, `${report.width}px ${result.mode}: segmented control exceeded its fieldset.`);
  }
  assert.deepEqual(report.interaction.nativeTypes, ["checkbox", "checkbox", "checkbox"]);
  assert(report.interaction.labels.every(Boolean), "Segmented inputs must retain native label associations.");
  assert.notDeepEqual(report.interaction.before, report.interaction.afterPointer, "Pointer activation must change segmented state.");
  assert(report.interaction.focus.active, "Segmented input must remain focusable.");
  assert.notEqual(report.interaction.focus.outlineStyle, "none", "Focused segmented control must retain a visible outline.");
  assert.notEqual(report.interaction.focus.outlineWidth, "0px", "Focused segmented control outline must have visible width.");
  assert(report.interaction.keyboardChanged, "Space must activate the native segmented checkbox.");
  const edited = report.results.find((result) => result.mode === "edit-item");
  assert.equal(edited.preferCount, "12 selected", "Stress fixture must expose a two-digit Prefer count.");
  assert.equal(edited.neverCount, "12 selected", "Stress fixture must expose a two-digit Never count.");
  assert(report.results.find((result) => result.mode === "quick-add").validationVisible, "Required-field validation was not exercised.");
}

async function verifyWidth(browser, baseUrl, width, colorScheme) {
  const context = await browser.newContext({ viewport: { width, height: 800 }, colorScheme });
  const page = await context.newPage();
  const browserIssues = [];
  page.on("console", (message) => {
    if (["warning", "error"].includes(message.type())) browserIssues.push(`${message.type()}: ${message.text()}`);
  });
  page.on("pageerror", (error) => browserIssues.push(`pageerror: ${error.message}`));
  try {
    await page.goto(`${baseUrl}/?layout-verifier=${width}`, { waitUntil: "load" });
    await seedSyntheticCloset(page);
    const results = [];

    await page.locator("#quickAddBtn").click();
    await openStressDetails(page);
    await page.locator("#itemName").fill("");
    await page.locator('#itemForm button[type="submit"]').click();
    results.push(await measure(page, "quick-add", width));
    const interaction = await exerciseSegmentedControl(page);
    await closeEditor(page);

    await page.locator('[data-screen="closet"]').click();
    await page.locator("#addItemBtn").click();
    await openStressDetails(page);
    results.push(await measure(page, "add-item", width));
    await closeEditor(page);

    await page.locator('[data-item-id="layout_source"] [data-action="edit"]').click();
    await openStressDetails(page);
    results.push(await measure(page, "edit-item", width));
    await closeEditor(page);

    await page.locator('[data-item-id="layout_source"] [data-action="add-similar"]').click();
    await openStressDetails(page);
    results.push(await measure(page, "add-similar", width));
    await page.locator("#itemName").fill(`Synthetic Saved Similar Item ${width}`);
    await page.locator("#saveAddSimilarBtn").click();
    await openStressDetails(page);
    results.push(await measure(page, "save-and-add-similar", width));
    await closeEditor(page);

    await page.waitForTimeout(50);
    assert.deepEqual(browserIssues, [], `${width}px ${colorScheme}: browser issues detected: ${browserIssues.join(" | ")}`);
    const report = { width, colorScheme, results, interaction, browserIssues };
    verifyReport(report);
    return report;
  } finally {
    await context.close();
  }
}

(async () => {
  const { chromium } = loadPlaywright();
  const executablePath = browserExecutable();
  assert(executablePath, "No Chromium browser was found. Set FIT_ROULETTE_BROWSER to a Chrome/Edge/Chromium executable.");
  const server = await serve();
  const { port } = server.address();
  const browser = await chromium.launch({ executablePath, headless: true });
  try {
    const reports = [];
    for (const colorScheme of ["light", "dark"]) {
      for (const width of [320, 359, 1280]) {
        reports.push(await verifyWidth(browser, `http://127.0.0.1:${port}`, width, colorScheme));
      }
    }
    console.log(JSON.stringify({
      ok: true,
      widths: [...new Set(reports.map((report) => report.width))],
      themes: [...new Set(reports.map((report) => report.colorScheme))],
      modes: reports[0].results.map((result) => result.mode),
      maxDialogOverflow: Math.max(...reports.flatMap((report) => report.results.map((result) => result.dialog.scrollWidth - result.dialog.clientWidth))),
      nativeSegmentedControls: true,
      relationshipStressCount: 24,
      browserIssues: 0
    }));
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
