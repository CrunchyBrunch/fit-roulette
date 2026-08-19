const assert = require("assert");
const fs = require("fs");
const path = require("path");

require("./verify-fit-roulette-v1.5.3-app.js");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const context = fs.readFileSync(path.join(root, "context-engine.js"), "utf8");

assert(app.includes('APP_VERSION = "1.6.0"'));
assert(app.includes('ensureAutomaticWeather("startup")'));
assert(app.includes('ensureAutomaticWeather("visible-resume")'));
assert(app.includes('ensureAutomaticWeather("pageshow")'));
assert(app.includes('ensureAutomaticWeather("online")'));
assert(app.includes('error?.code === "FAILURE_BACKOFF"'));
assert(!app.includes("automaticAttemptWithoutPermissionsApi"));
assert(context.includes("const FAILURE_BACKOFF_MS = 30 * 1000"));
assert(context.includes("lastAutomaticSuccess"));
assert(context.includes("lastAutomaticFailure"));
assert(app.includes("findLikelyDuplicate"));
assert(app.includes("manualSelectedItemIds"));
assert(app.includes("renderColorChoiceButtons(\"secondary\")"));

console.log(JSON.stringify({
  ok: true,
  appVersion: "1.6.0",
  schemaVersion: 5,
  weatherBackoffSeconds: 30,
  lifecycleResolver: true,
  duplicateAdvisory: true,
  manualSelectionState: true
}));
