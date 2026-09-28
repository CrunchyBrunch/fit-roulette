const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");
const { buildSteps, runSteps } = require("../verify-all.js");

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "fit-verifier-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, "codex-tools"));
  return root;
}

test("discovers new regression scripts and nested JavaScript without executing helpers", (t) => {
  const root = fixture(t);
  fs.mkdirSync(path.join(root, "codex-tools", "helpers"));
  for (const file of ["app.js", "codex-tools/verify-fit-roulette-future.js", "codex-tools/serve-fit-roulette.js", "codex-tools/helpers/nested.js"]) {
    fs.writeFileSync(path.join(root, file), "");
  }
  const steps = buildSteps(root);
  assert(steps.some((step) => step.args.join(" ") === "--check codex-tools/helpers/nested.js"));
  assert(steps.some((step) => step.args.join(" ") === "--check app.js"));
  assert(steps.some((step) => step.args.join(" ") === "codex-tools/verify-fit-roulette-future.js"));
  assert(!steps.some((step) => step.args.join(" ") === "codex-tools/serve-fit-roulette.js"));
});

test("rejects an empty verifier suite instead of reporting success", (t) => {
  assert.throws(() => buildSteps(fixture(t)), /no.*verifier/i);
});

test("runs checks in order from the repository directory", (t) => {
  const root = fixture(t);
  runSteps([
    { name: "write", args: ["-e", "require('fs').writeFileSync('result', 'first')"] },
    { name: "append", args: ["-e", "require('fs').appendFileSync('result', '-second')"] }
  ], { root });
  assert.equal(fs.readFileSync(path.join(root, "result"), "utf8"), "first-second");
});

test("stops on a failed check and identifies it", (t) => {
  const root = fixture(t);
  assert.throws(() => runSteps([
    { name: "broken regression", args: ["-e", "process.exit(7)"] },
    { name: "must not run", args: ["-e", "require('fs').writeFileSync('unexpected', '')"] }
  ], { root }), /broken regression.*7/);
  assert.equal(fs.existsSync(path.join(root, "unexpected")), false);
});

test("a stalled verifier fails within its timeout", (t) => {
  assert.throws(() => runSteps([
    { name: "stalled regression", args: ["-e", "setInterval(() => {}, 1000)"] }
  ], { root: fixture(t), timeout: 500 }), /stalled regression.*timed out/i);
});
