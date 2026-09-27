const assert = require("assert/strict");
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const root = path.resolve(__dirname, "..");
const baseline = "720f5335941bcbd976d4305d2fb66573705ab3c8";
const read = (name) => fs.readFileSync(path.join(root, name), "utf8").replace(/\r\n/g, "\n");
const original = (name) => execFileSync("git", ["show", `${baseline}:${name}`], { cwd: root, encoding: "utf8" }).replace(/\r\n/g, "\n");
for (const name of ["insights.js", "context-engine.js", "smart-closet.js"]) assert.equal(read(name), original(name), `${name} must remain byte-equivalent to the released domain contract.`);
const functionSource = (code, name) => {
  const start = code.indexOf(`  function ${name}(`);
  assert(start >= 0, name);
  const next = code.indexOf("\n  function ", start + 1);
  return code.slice(start, next < 0 ? undefined : next);
};
for (const name of ["performGenerationAndRender", "pickOutfit", "scoreOutfit", "isCompatibleOutfit", "ensureAutomaticWeather", "addHistoryRecord"]) {
  // The async weather function is separately guaranteed by the unchanged
  // resolver region below; all selection/scoring functions remain exact.
  if (name === "ensureAutomaticWeather") continue;
  assert.equal(functionSource(read("app.js"), name), functionSource(original("app.js"), name), `${name} changed outside scope.`);
}
const region = (code) => code.slice(code.indexOf('  async function ensureAutomaticWeather('), code.indexOf('  function disableAutomaticWeather('));
assert.equal(region(read("app.js")), region(original("app.js")));
require("./verify-fit-roulette-v1.6.3-slots.js");
console.log(JSON.stringify({ ok: true, domainAndGenerationUnchanged: true, schema: 5, insightsCalculationsUnchanged: true, weatherResolverUnchanged: true }));
