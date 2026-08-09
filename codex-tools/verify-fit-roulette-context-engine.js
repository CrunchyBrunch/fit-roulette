const assert = require("assert");
const Context = require("../context-engine.js");

const NOW = "2026-08-08T12:00:00.000Z";

function providerPayload(overrides = {}) {
  return {
    latitude: 12.35,
    longitude: 45.68,
    generationtime_ms: 0.3,
    current: {
      time: "2026-08-08T11:45",
      temperature_2m: 12,
      apparent_temperature: 9,
      precipitation: 0.4,
      rain: 0.4,
      showers: 0,
      snowfall: 0,
      weather_code: 61,
      wind_speed_10m: 28,
      is_day: 1,
      ...overrides
    }
  };
}

const normalized = Context.normalizeProviderResponse(providerPayload(), { fetchedAt: NOW });
assert.deepEqual(normalized, {
  temperatureC: 12,
  apparentTemperatureC: 9,
  condition: "rain",
  precipitationMm: 0.4,
  rainMm: 0.4,
  showersMm: 0,
  snowfallCm: 0,
  windKph: 28,
  isDay: true,
  observedAt: "2026-08-08T11:45",
  fetchedAt: NOW
});
assert(!/latitude|longitude|generationtime|weather_code/i.test(JSON.stringify(normalized)), "Normalized provider state must omit coordinates and raw provider metadata.");
assert.equal(Context.mapWeatherCode(0), "clear");
assert.equal(Context.mapWeatherCode(3), "cloudy");
assert.equal(Context.mapWeatherCode(82), "rain");
assert.equal(Context.mapWeatherCode(75), "snow");
assert.equal(Context.mapWeatherCode(499), "unknown");
assert.equal(Context.normalizeProviderResponse(providerPayload({ weather_code: 499, wind_speed_10m: 2 }), { fetchedAt: NOW }).condition, "unknown");
assert.equal(Context.normalizeProviderResponse(providerPayload({ weather_code: 0, wind_speed_10m: 30 }), { fetchedAt: NOW }).condition, "wind");
assert.throws(() => Context.normalizeProviderResponse({}, { fetchedAt: NOW }), (error) => error.code === "INVALID_PROVIDER_RESPONSE");
assert.throws(() => Context.normalizeProviderResponse(providerPayload({ temperature_2m: "bad" }), { fetchedAt: NOW }), (error) => error.code === "INVALID_PROVIDER_RESPONSE");

assert.equal(Context.weatherFreshness({ ...normalized, fetchedAt: "2026-08-08T11:00:00.000Z" }, NOW), "fresh");
assert.equal(Context.weatherFreshness({ ...normalized, fetchedAt: "2026-08-08T10:59:59.999Z" }, NOW), "stale");
assert.equal(Context.weatherFreshness({ ...normalized, fetchedAt: "2026-08-08T06:00:00.000Z" }, NOW), "stale");
assert.equal(Context.weatherFreshness({ ...normalized, fetchedAt: "2026-08-08T05:59:59.999Z" }, NOW), "expired");
assert.equal(Context.weatherFreshness(null, NOW), "missing");

const persistedFresh = Context.deriveEffectiveContext({ mode: "automatic", cachedWeather: normalized, unit: "f", now: NOW });
assert.equal(persistedFresh.source, "cached", "A fresh persisted record must remain labeled as cached after reload.");
const current = Context.deriveEffectiveContext({
  mode: "automatic", cachedWeather: normalized, currentSessionFetchedAt: normalized.fetchedAt, unit: "f", now: NOW
});
assert.equal(current.source, "current");
assert.equal(current.effectiveTemperatureC, 9);
assert.equal(current.condition, "rain");
const staleRecord = { ...normalized, fetchedAt: "2026-08-08T08:00:00.000Z" };
assert.equal(Context.deriveEffectiveContext({ mode: "automatic", cachedWeather: staleRecord, unit: "f", now: NOW }).active, false, "Stale context requires awareness.");
assert.equal(Context.deriveEffectiveContext({ mode: "automatic", cachedWeather: staleRecord, acceptStale: true, unit: "f", now: NOW }).source, "cached");
const expiredRecord = { ...normalized, fetchedAt: "2026-08-08T05:00:00.000Z" };
assert.equal(Context.deriveEffectiveContext({ mode: "automatic", cachedWeather: expiredRecord, acceptStale: true, unit: "f", now: NOW }).active, false, "Expired context must never silently influence matching.");

const manualF = Context.deriveEffectiveContext({
  mode: "manual", manualTemperature: 50, unit: "f", manualCondition: "cloudy",
  adjustment: "colder", exposure: "indoors", rainExpected: true
});
const manualC = Context.deriveEffectiveContext({
  mode: "manual", manualTemperature: 10, unit: "c", manualCondition: "cloudy",
  adjustment: "colder", exposure: "indoors", rainExpected: true
});
assert.equal(manualF.effectiveTemperatureC, manualC.effectiveTemperatureC, "Fahrenheit/Celsius display choice must not change scoring.");
assert.equal(manualF.condition, "rain");
assert.equal(manualF.adjusted, true);
assert(Context.targetWarmth({ ...manualF, exposure: "indoors" }) < Context.targetWarmth({ ...manualF, exposure: "outdoors" }), "Mostly indoors must reduce the warmth target.");
const ignored = Context.deriveEffectiveContext({ mode: "manual", manualTemperature: 20, unit: "c", ignore: true });
assert.equal(ignored.source, "ignored");
assert.equal(Context.scoreOutfitContext([], ignored).score, 0);

const baseItems = [
  { warmth: "light", rainProtection: "none", windProtection: "none" },
  { warmth: "medium", rainProtection: "none", windProtection: "none" }
];
const layeredItems = [...baseItems, { warmth: "warm", rainProtection: "protected", windProtection: "protected" }];
assert.equal(Context.combinedWarmth(layeredItems), 6);
assert(Context.scoreOutfitContext(layeredItems, manualF).score > Context.scoreOutfitContext(baseItems, manualF).score, "Warmth and structured protection must compose across garments.");
assert.equal(Context.shouldConsiderLayer(baseItems, manualF), true);
const warm = Context.deriveEffectiveContext({ mode: "manual", manualTemperature: 82, unit: "f", manualCondition: "clear", exposure: "outdoors" });
assert.equal(Context.shouldConsiderLayer(baseItems, warm), false, "Warm conditions should not request an automatic layer.");
const transitional = Context.deriveEffectiveContext({ mode: "manual", manualTemperature: 59, unit: "f", manualCondition: "clear", exposure: "outdoors" });
assert.equal(Context.shouldConsiderLayer(baseItems, transitional), true, "Transitional conditions may request one layer when the outfit is short of its warmth target.");
const windy = Context.deriveEffectiveContext({ mode: "manual", manualTemperature: 60, unit: "f", manualCondition: "wind", exposure: "outdoors" });
assert.equal(windy.windBucket, "windy", "Manual windy context must engage the documented wind threshold.");
assert(Context.scoreOutfitContext(layeredItems, windy).score > Context.scoreOutfitContext(baseItems, windy).score, "Structured wind protection must affect scoring in windy context.");
const severe = Context.deriveEffectiveContext({ mode: "manual", manualTemperature: -4, unit: "f", manualCondition: "snow", exposure: "outdoors" });
const severeAssessment = Context.scoreOutfitContext(layeredItems, severe);
assert(severeAssessment.shortfall > 1 && severeAssessment.sufficient === false, "One layer must not claim sufficient warmth in severe conditions.");
assert(Context.describeContext(severe, { shortfall: severeAssessment.shortfall }).includes("does not fully meet"));

const history = Context.historyContextSnapshot(manualF, { suggested: true, removed: true });
assert.equal(history.source, "manual");
assert.equal(history.automaticLayerSuggested, true);
assert.equal(history.automaticLayerRemoved, true);
assert(!/latitude|longitude|payload|url/i.test(JSON.stringify(history)));
assert.deepEqual(Context.normalizeHistoryContext(history), history);

async function verifyClient() {
  let fetchCount = 0;
  let requestedUrl = "";
  let requestedOptions = null;
  let releaseFetch;
  const fetchGate = new Promise((resolve) => { releaseFetch = resolve; });
  const geolocation = {
    getCurrentPosition(success) {
      success({ coords: { latitude: 12.34567, longitude: 45.67891, accuracy: 4 } });
    }
  };
  const client = Context.createWeatherClient({
    geolocation,
    now: () => Date.parse(NOW),
    fetchImpl: async (url, options) => {
      fetchCount += 1;
      requestedUrl = url;
      requestedOptions = options;
      await fetchGate;
      return { ok: true, json: async () => providerPayload() };
    }
  });
  const first = client.refresh({ force: true });
  const second = client.refresh({ force: true });
  releaseFetch();
  const [firstResult, secondResult] = await Promise.all([first, second]);
  assert.deepEqual(firstResult, secondResult);
  assert.equal(fetchCount, 1, "Concurrent refreshes must be deduplicated.");
  const url = new URL(requestedUrl);
  assert.equal(url.origin + url.pathname, Context.PROVIDER_URL);
  assert.equal(url.searchParams.get("latitude"), "12.35");
  assert.equal(url.searchParams.get("longitude"), "45.68");
  assert.deepEqual(url.searchParams.get("current").split(","), Context.CURRENT_FIELDS);
  assert.equal(url.searchParams.has("hourly"), false);
  assert.equal(url.searchParams.has("daily"), false);
  assert.equal(requestedOptions.cache, "no-store");
  assert.equal(requestedOptions.credentials, "omit");
  assert.equal(requestedOptions.referrerPolicy, "no-referrer");

  let autoNow = Date.parse(NOW);
  const rateClient = Context.createWeatherClient({
    geolocation,
    now: () => autoNow,
    automaticMinimumMs: 60000,
    fetchImpl: async () => ({ ok: true, json: async () => providerPayload() })
  });
  await rateClient.refresh({ force: false });
  await assert.rejects(() => rateClient.refresh({ force: false }), (error) => error.code === "RATE_LIMITED");
  autoNow += 60001;
  await rateClient.refresh({ force: false });

  const denied = Context.createWeatherClient({
    geolocation: { getCurrentPosition(success, failure) { failure({ code: 1 }); } },
    fetchImpl: async () => ({ ok: true, json: async () => providerPayload() })
  });
  await assert.rejects(() => denied.refresh({ force: true }), (error) => error.code === "LOCATION_DENIED");
  const unavailable = Context.createWeatherClient({ geolocation: null, fetchImpl: async () => ({ ok: true }) });
  await assert.rejects(() => unavailable.refresh({ force: true }), (error) => error.code === "LOCATION_UNAVAILABLE");
  const providerError = Context.createWeatherClient({ geolocation, fetchImpl: async () => ({ ok: false, status: 503 }) });
  await assert.rejects(() => providerError.refresh({ force: true }), (error) => error.code === "PROVIDER_ERROR");
  const malformed = Context.createWeatherClient({ geolocation, fetchImpl: async () => ({ ok: true, json: async () => ({ current: {} }) }) });
  await assert.rejects(() => malformed.refresh({ force: true }), (error) => error.code === "INVALID_PROVIDER_RESPONSE");
  const network = Context.createWeatherClient({ geolocation, fetchImpl: async () => { throw new Error("offline"); } });
  await assert.rejects(() => network.refresh({ force: true }), (error) => error.code === "NETWORK_ERROR");
  const timeout = Context.createWeatherClient({
    geolocation,
    timeoutMs: 5,
    fetchImpl: async (url, options) => new Promise((resolve, reject) => {
      options.signal.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })));
    })
  });
  await assert.rejects(() => timeout.refresh({ force: true }), (error) => error.code === "WEATHER_TIMEOUT");
  let cancellationFetches = 0;
  const cancellable = Context.createWeatherClient({
    geolocation: { getCurrentPosition() {} },
    timeoutMs: 1000,
    fetchImpl: async () => { cancellationFetches += 1; return { ok: true, json: async () => providerPayload() }; }
  });
  const cancelledRequest = cancellable.refresh({ force: true });
  cancellable.cancel();
  await assert.rejects(() => cancelledRequest, (error) => error.code === "REQUEST_CANCELLED");
  assert.equal(cancellationFetches, 0, "Cancelling during geolocation must prevent a stale provider request.");
  const locationTimeout = Context.createWeatherClient({
    geolocation: { getCurrentPosition() {} }, timeoutMs: 5,
    fetchImpl: async () => ({ ok: true, json: async () => providerPayload() })
  });
  await assert.rejects(() => locationTimeout.refresh({ force: true }), (error) => error.code === "LOCATION_TIMEOUT");

  assert.equal(await Context.permissionState({ query: async () => ({ state: "granted" }) }, geolocation), "granted");
  assert.equal(await Context.permissionState({ query: async () => ({ state: "prompt" }) }, geolocation), "prompt");
  assert.equal(await Context.permissionState({ query: async () => ({ state: "denied" }) }, geolocation), "denied");
  assert.equal(await Context.permissionState(null, geolocation), "unsupported");
  assert.equal(await Context.permissionState(null, null), "unavailable");
}

verifyClient().then(() => {
  console.log(JSON.stringify({
    ok: true,
    providerFields: Context.CURRENT_FIELDS.length,
    freshnessStates: 4,
    privacySafe: true,
    concurrentDeduplication: true
  }));
}).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
