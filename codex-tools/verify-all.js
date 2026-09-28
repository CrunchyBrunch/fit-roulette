const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

function javascriptFiles(directory, prefix = "") {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) return javascriptFiles(path.join(directory, entry.name), relative);
    return entry.isFile() && entry.name.endsWith(".js") ? [relative] : [];
  });
}

function buildSteps(root) {
  const toolFiles = javascriptFiles(path.join(root, "codex-tools"), "codex-tools");
  const appFiles = fs.readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".js"))
    .map((entry) => entry.name);
  const verifiers = toolFiles.filter((file) => /^codex-tools\/verify-fit-roulette-[^/]+\.js$/.test(file)).sort();
  if (!verifiers.length) throw new Error("No Fit Roulette verifiers found.");
  return [
    ...[...appFiles, ...toolFiles].sort().map((file) => ({ name: `syntax: ${file}`, args: ["--check", file] })),
    { name: "verification runner tests", args: ["--test", "codex-tools/tests/verify-all.test.js"] },
    ...verifiers.map((file) => ({ name: file, args: [file] }))
  ];
}

function runSteps(steps, { root, env = process.env, timeout = 180000 } = {}) {
  for (const [index, step] of steps.entries()) {
    console.log(`\n[${index + 1}/${steps.length}] ${step.name}`);
    const result = spawnSync(process.execPath, step.args, {
      cwd: root, env, stdio: "inherit", timeout, killSignal: "SIGKILL"
    });
    if (result.error) {
      const reason = result.error.code === "ETIMEDOUT" ? `timed out after ${timeout}ms` : result.error.message;
      throw new Error(`${step.name}: ${reason}`);
    }
    if (result.status !== 0) throw new Error(`${step.name}: failed (${result.signal || `exit ${result.status}`})`);
  }
}

function browserEnvironment() {
  if (process.env.FIT_ROULETTE_RUN_V133_HARNESS === "1") {
    throw new Error("Unset FIT_ROULETTE_RUN_V133_HARNESS for current-release verification.");
  }
  let playwright;
  try { playwright = require("playwright"); }
  catch { throw new Error("Playwright is required. Run npm ci, then npm run verify:install."); }
  const chromium = process.env.FIT_ROULETTE_BROWSER || process.env.CHROME_PATH || playwright.chromium.executablePath();
  for (const [name, executable] of [["Chromium", chromium], ["WebKit", playwright.webkit.executablePath()]]) {
    if (!fs.existsSync(executable)) throw new Error(`${name} is missing at ${executable}. Run npm run verify:install.`);
  }
  // All retained browser harnesses understand this override, including Windows-era helpers.
  return { ...process.env, FIT_ROULETTE_BROWSER: chromium };
}

if (require.main === module) {
  try {
    const root = path.resolve(__dirname, "..");
    const steps = buildSteps(root);
    runSteps(steps, { root, env: browserEnvironment() });
    console.log(`\nPASS: ${steps.length} verification steps, including Chromium and WebKit.`);
    console.log("Physical iPhone Safari and installed-home-screen PWA acceptance remains required for release.");
  } catch (error) {
    console.error(`\nFAIL: ${error.message}`);
    process.exitCode = 1;
  }
}

module.exports = { buildSteps, runSteps };
