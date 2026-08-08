const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

const html = read("index.html");
const manifest = JSON.parse(read("manifest.json"));
const sw = read("sw.js");
const app = read("app.js");
const readme = read("README.md");
const changelog = read("CHANGELOG.md");

assert(html.includes('href="./manifest.json"'), "Manifest link is not project-path relative.");
assert(html.includes('<link rel="apple-touch-icon" sizes="180x180" href="./icons/icon-180.png">'), "Apple touch icon metadata is incorrect.");
assert(html.includes('href="./icons/favicon-32.png"'), "Favicon path is not project-path relative.");
assert(html.includes('src="./app.js?v=1.4.1"'), "Versioned app script path is not project-path relative.");
assert(html.includes('navigator.serviceWorker.register("./sw.js?v=1.4.1", { updateViaCache: "none" })'), "Versioned early service-worker update bootstrap is missing.");
assert(html.indexOf('navigator.serviceWorker.register("./sw.js?v=1.4.1"') < html.indexOf('src="./app.js?v=1.4.1"'), "Service-worker update bootstrap must run before the app bundle.");
assert(app.includes('navigator.serviceWorker.register(`./sw.js?v=${APP_VERSION}`, { updateViaCache: "none" })'), "App service-worker registration must bypass stale HTTP caches.");
assert(html.includes('href="./styles.css?v=1.4.1"'), "Versioned stylesheet path is not project-path relative.");
assert(html.includes('<meta name="apple-mobile-web-app-capable" content="yes">'), "Standalone Apple metadata is missing.");
assert(html.includes('<meta name="apple-mobile-web-app-title" content="Fit Roulette">'), "Apple app title is missing.");
assert(html.includes('<meta name="apple-mobile-web-app-status-bar-style" content="default">'), "Apple status bar metadata is missing.");
assert((html.match(/<meta name="theme-color"/g) || []).length === 1, "Theme color metadata should be declared once.");

assert(manifest.name === "Fit Roulette", "Manifest name is incorrect.");
assert(manifest.short_name === "Fit Roulette", "Manifest short_name is incorrect.");
assert(manifest.start_url === "./index.html", "Manifest start_url should be ./index.html for GitHub Pages.");
assert(manifest.scope === "./", "Manifest scope should be ./ for GitHub Pages.");
assert(manifest.display === "standalone", "Manifest display should be standalone.");
assert(Boolean(manifest.background_color), "Manifest background_color is missing.");
assert(Boolean(manifest.theme_color), "Manifest theme_color is missing.");

for (const icon of manifest.icons) {
  assert(!icon.src.startsWith("/"), `Icon path must be relative: ${icon.src}`);
  assert(icon.type === "image/png", `Icon must declare image/png: ${icon.src}`);
  assert(icon.purpose === "any", `Icon purpose must be any: ${icon.src}`);
  assert(fs.existsSync(path.join(root, icon.src.replace(/^\.\//, ""))), `Missing icon: ${icon.src}`);
}
assert(manifest.icons.some((icon) => icon.sizes === "192x192"), "Manifest is missing the 192x192 icon.");
assert(manifest.icons.some((icon) => icon.sizes === "512x512"), "Manifest is missing the 512x512 icon.");
assert(!manifest.icons.some((icon) => String(icon.purpose).includes("maskable")), "A maskable icon should not be declared for this artwork.");

const expectedPngs = {
  "icons/icon-main.png": [1254, 1254],
  "icons/icon-180.png": [180, 180],
  "icons/icon-192.png": [192, 192],
  "icons/icon-512.png": [512, 512],
  "icons/favicon-32.png": [32, 32]
};
for (const [relativePath, expectedSize] of Object.entries(expectedPngs)) {
  const buffer = fs.readFileSync(path.join(root, relativePath));
  assert(buffer.subarray(0, 8).toString("hex") === "89504e470d0a1a0a", `${relativePath} is not a valid PNG.`);
  assert(buffer.readUInt32BE(16) === expectedSize[0], `${relativePath} has the wrong width.`);
  assert(buffer.readUInt32BE(20) === expectedSize[1], `${relativePath} has the wrong height.`);
}

const cacheListMatch = sw.match(/const APP_ASSETS = \[([\s\S]*?)\];/);
assert(cacheListMatch, "Could not find APP_ASSETS in sw.js.");
const cachedAssets = [...cacheListMatch[1].matchAll(/"([^"]+)"/g)].map((match) => match[1]);
for (const asset of cachedAssets) {
  if (asset === "./") continue;
  const localAsset = asset.replace(/^\.\//, "");
  assert(fs.existsSync(path.join(root, localAsset)), `Service worker caches missing asset: ${asset}`);
  assert(!asset.startsWith("/"), `Service worker asset must be relative: ${asset}`);
}

assert(sw.includes("caches.match(\"./index.html\")"), "Offline navigation fallback should use ./index.html.");
assert(sw.includes('key.startsWith("fit-roulette-")'), "Service-worker activation should only remove old Fit Roulette caches.");
assert(sw.includes('CACHE_NAME = "fit-roulette-v1.4.1"'), "Service-worker cache name is not synchronized to 1.4.1.");
assert(sw.includes('ASSET_VERSION = "1.4.1"'), "Service-worker install asset version is not synchronized to 1.4.1.");
assert(sw.includes('updateUrl.searchParams.set("v", ASSET_VERSION)'), "Service-worker installation does not bypass stale predecessor caches.");
assert(sw.includes('fetch(updateUrl, { cache: "reload" })'), "Service-worker installation does not force fresh release assets.");
assert(sw.includes("cache.put(canonicalUrl, response.clone())"), "Service-worker installation does not store fresh responses under canonical asset keys.");
assert(sw.includes("cache.put(updateUrl, response)"), "Service-worker installation does not cache versioned HTML asset requests for offline use.");
assert(![sw, app, html, readme].some((text) => text.includes("v1.4-dev-smart-closet")), "Development-only cache identifier remains in release-candidate assets or documentation.");
assert(sw.includes('"./smart-closet.js"'), "Service worker does not cache the Smart Closet module.");
assert(app.includes('APP_VERSION = "1.4.1"'), "Visible app version is not 1.4.1.");
assert(app.includes('STORAGE_KEY = "fitRoulette.v1"'), "localStorage key changed unexpectedly.");
assert(readme.includes("Current release: **1.4.1 - Smart Closet Stabilization**"), "README release metadata is not synchronized.");
assert(changelog.includes("Fit Roulette v1.4.1 &mdash; Smart Closet Stabilization"), "v1.4.1 changelog entry is missing.");
assert(fs.existsSync(path.join(root, ".nojekyll")), ".nojekyll is missing.");

console.log(JSON.stringify({
  ok: true,
  cachedAssets: cachedAssets.length,
  manifestIcons: manifest.icons.length,
  verifiedPngs: Object.keys(expectedPngs).length,
  cacheName: (sw.match(/CACHE_NAME = "([^"]+)"/) || [])[1]
}));
