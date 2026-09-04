const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");

assert(app.includes('APP_VERSION = "1.6.2"'));
assert(app.includes("function suggestFromItemName(name)"), "Name suggestions must be deterministic and local.");
assert(app.includes("function getGenerationIndexes()"), "Generation must use transient indexes.");
assert(app.includes("function invalidateGenerationIndexes()"), "Transient generation indexes need explicit invalidation.");
assert(app.includes("function requestHistoryEditorExit"), "History Edit needs dirty-exit protection.");
assert(app.includes("if (!persistEditorState(nextState))"), "History Edit must validate and persist transactionally.");
assert(app.includes("source: original?.source === \"generated\" ? \"generated\" : \"manual\""), "History Edit must preserve generated/manual provenance.");
assert(app.includes("original && selectedDate === originalDateKey ? original.context : null"), "Same-date context must be preserved and changed-date context removed.");
assert(app.includes("bannedSignatures: new Set"), "Exact ban lookup must be indexed without changing semantics.");
assert(!app.includes("setInterval("), "The release must not add background timers.");
assert(!app.includes("navigator.sendBeacon"), "The release must not add telemetry.");
assert(html.includes('id="generationStatus"'));
assert(html.includes('id="historyExitDialog"'));
assert(html.includes('id="closetFilterDetails"'));
assert(!html.includes('id="showInactive"'), "The former permanent archived toggle must not remain as a duplicate filter.");
assert(html.includes('id="manualLogDialog"') && html.includes('aria-labelledby="manualLogDialogTitle"'));
assert(html.includes('id="swapDialogTitle" tabindex="-1"'));
assert(css.includes("overscroll-behavior: contain"));
assert(css.includes(".closet-category-icon svg"));
assert(css.includes(".manual-category > summary"));
assert.equal((html.match(/id="(?:closetSubtype|closetColor|closetPattern|closetFormality|closetOccasion|closetStatus)"/g) || []).length, 6);

console.log(JSON.stringify({
  ok: true,
  appVersion: "1.6.2",
  schemaVersion: 5,
  historyEdit: "transactional",
  generationIndexes: "memory-only",
  backgroundWeatherChanges: false
}));
