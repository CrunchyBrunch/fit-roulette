(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FitRouletteContextEngine = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const PROVIDER_URL = "https://api.open-meteo.com/v1/forecast";
  const CURRENT_FIELDS = [
    "temperature_2m",
    "apparent_temperature",
    "precipitation",
    "rain",
    "showers",
    "snowfall",
    "weather_code",
    "wind_speed_10m",
    "is_day"
  ];
  const CONDITIONS = ["unknown", "clear", "cloudy", "rain", "snow", "wind"];
  const UNITS = ["f", "c"];
  const ADJUSTMENTS = ["same", "warmer", "colder"];
  const EXPOSURES = ["outdoors", "indoors"];
  const FRESH_MAX_MS = 60 * 60 * 1000;
  const STALE_MAX_MS = 6 * 60 * 60 * 1000;
  const AUTO_REFRESH_MIN_MS = 15 * 60 * 1000;
  const REQUEST_TIMEOUT_MS = 10000;
  const WIND_THRESHOLD_KPH = 25;

  const WARMTH_POINTS = Object.freeze({
    unspecified: 0,
    very_light: 0.5,
    light: 1,
    medium: 2,
    warm: 3,
    very_warm: 4
  });
  const RAIN_PROTECTION_POINTS = Object.freeze({ unspecified: 0, none: 0, light: 1, protected: 2 });
  const WIND_PROTECTION_POINTS = Object.freeze({ unspecified: 0, none: 0, light: 1, protected: 2 });

  function finiteNumber(value, minimum, maximum, field) {
    const number = Number(value);
    if (!Number.isFinite(number) || number < minimum || number > maximum) {
      throw contextError("INVALID_PROVIDER_RESPONSE", `Weather field ${field} is invalid.`);
    }
    return number;
  }

  function optionalTime(value) {
    const text = String(value || "").trim();
    return text && !Number.isNaN(Date.parse(text)) ? text : "";
  }

  function mapWeatherCode(value) {
    const code = Number(value);
    if (!Number.isInteger(code)) return "unknown";
    if (code === 0) return "clear";
    if ([1, 2, 3, 45, 48].includes(code)) return "cloudy";
    if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99].includes(code)) return "rain";
    if ([71, 73, 75, 77, 85, 86].includes(code)) return "snow";
    return "unknown";
  }

  function precipitationBucket(value) {
    const amount = Math.max(0, Number(value) || 0);
    if (amount === 0) return "none";
    return amount <= 2.5 ? "light" : "heavy";
  }

  function windBucket(value) {
    const speed = Math.max(0, Number(value) || 0);
    if (speed < 15) return "calm";
    if (speed < WIND_THRESHOLD_KPH) return "breezy";
    return "windy";
  }

  function normalizeProviderResponse(payload, options) {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)
      || !payload.current || typeof payload.current !== "object" || Array.isArray(payload.current)) {
      throw contextError("INVALID_PROVIDER_RESPONSE", "Weather response is missing current conditions.");
    }
    const current = payload.current;
    const temperatureC = finiteNumber(current.temperature_2m, -100, 70, "temperature_2m");
    const apparentTemperatureC = finiteNumber(current.apparent_temperature, -120, 80, "apparent_temperature");
    const precipitationMm = finiteNumber(current.precipitation, 0, 1000, "precipitation");
    const rainMm = finiteNumber(current.rain, 0, 1000, "rain");
    const showersMm = finiteNumber(current.showers, 0, 1000, "showers");
    const snowfallCm = finiteNumber(current.snowfall, 0, 1000, "snowfall");
    const weatherCode = finiteNumber(current.weather_code, 0, 999, "weather_code");
    const windKph = finiteNumber(current.wind_speed_10m, 0, 500, "wind_speed_10m");
    const fetchedAt = new Date(options?.fetchedAt || Date.now()).toISOString();
    let condition = mapWeatherCode(weatherCode);
    if (["unknown", "clear", "cloudy"].includes(condition) && windKph >= WIND_THRESHOLD_KPH) condition = "wind";
    return {
      temperatureC: roundOne(temperatureC),
      apparentTemperatureC: roundOne(apparentTemperatureC),
      condition,
      precipitationMm: roundOne(precipitationMm),
      rainMm: roundOne(rainMm),
      showersMm: roundOne(showersMm),
      snowfallCm: roundOne(snowfallCm),
      windKph: roundOne(windKph),
      isDay: current.is_day === 1 ? true : (current.is_day === 0 ? false : null),
      observedAt: String(current.time || "").trim(),
      fetchedAt
    };
  }

  function normalizeCachedWeather(record) {
    if (!record || typeof record !== "object" || Array.isArray(record)) return null;
    try {
      const temperatureC = finiteNumber(record.temperatureC, -100, 70, "temperatureC");
      const apparentTemperatureC = finiteNumber(record.apparentTemperatureC, -120, 80, "apparentTemperatureC");
      const precipitationMm = finiteNumber(record.precipitationMm, 0, 1000, "precipitationMm");
      const rainMm = finiteNumber(record.rainMm, 0, 1000, "rainMm");
      const showersMm = finiteNumber(record.showersMm, 0, 1000, "showersMm");
      const snowfallCm = finiteNumber(record.snowfallCm, 0, 1000, "snowfallCm");
      const windKph = finiteNumber(record.windKph, 0, 500, "windKph");
      const fetchedAt = optionalTime(record.fetchedAt);
      if (!fetchedAt || !CONDITIONS.includes(record.condition)) return null;
      return {
        temperatureC: roundOne(temperatureC),
        apparentTemperatureC: roundOne(apparentTemperatureC),
        condition: record.condition,
        precipitationMm: roundOne(precipitationMm),
        rainMm: roundOne(rainMm),
        showersMm: roundOne(showersMm),
        snowfallCm: roundOne(snowfallCm),
        windKph: roundOne(windKph),
        isDay: typeof record.isDay === "boolean" ? record.isDay : null,
        observedAt: String(record.observedAt || "").trim(),
        fetchedAt
      };
    } catch (error) {
      return null;
    }
  }

  function weatherFreshness(record, now) {
    const normalized = normalizeCachedWeather(record);
    if (!normalized) return "missing";
    const age = Math.max(0, new Date(now || Date.now()).getTime() - new Date(normalized.fetchedAt).getTime());
    if (age <= FRESH_MAX_MS) return "fresh";
    if (age <= STALE_MAX_MS) return "stale";
    return "expired";
  }

  function deriveEffectiveContext(input) {
    const unit = UNITS.includes(input?.unit) ? input.unit : "f";
    const adjustment = ADJUSTMENTS.includes(input?.adjustment) ? input.adjustment : "same";
    const exposure = EXPOSURES.includes(input?.exposure) ? input.exposure : "outdoors";
    const mode = input?.mode === "automatic" ? "automatic" : "manual";
    const ignored = input?.ignore === true;
    const rainExpected = input?.rainExpected === true;
    if (ignored) {
      return baseEffectiveContext({ source: "ignored", availability: "ignored", mode, unit, adjustment, exposure, ignored: true });
    }

    let source = "none";
    let availability = "missing";
    let reportedTemperatureC = null;
    let apparentTemperatureC = null;
    let condition = "unknown";
    let precipitationMm = 0;
    let windKph = 0;
    let observedAt = "";
    let fetchedAt = "";

    if (mode === "automatic") {
      const cached = normalizeCachedWeather(input?.cachedWeather);
      availability = weatherFreshness(cached, input?.now);
      if (cached && (availability === "fresh" || (availability === "stale" && input?.acceptStale === true))) {
        source = availability === "fresh" && input?.currentSessionFetchedAt === cached.fetchedAt ? "current" : "cached";
        reportedTemperatureC = cached.temperatureC;
        apparentTemperatureC = cached.apparentTemperatureC;
        condition = cached.condition;
        precipitationMm = cached.precipitationMm;
        windKph = cached.windKph;
        observedAt = cached.observedAt;
        fetchedAt = cached.fetchedAt;
      }
    } else {
      const manualTemperature = nullableTemperature(input?.manualTemperature, unit);
      condition = CONDITIONS.includes(input?.manualCondition) ? input.manualCondition : "unknown";
      if (condition === "wind") windKph = WIND_THRESHOLD_KPH;
      if (manualTemperature !== null || condition !== "unknown" || rainExpected) {
        source = "manual";
        availability = "manual";
        reportedTemperatureC = manualTemperature;
        apparentTemperatureC = manualTemperature;
      }
    }

    if (source === "none") {
      return baseEffectiveContext({ source, availability, mode, unit, adjustment, exposure, ignored: false });
    }
    if (rainExpected && condition !== "snow") condition = "rain";
    if (rainExpected && precipitationMm === 0) precipitationMm = 0.1;
    let effectiveTemperatureC = apparentTemperatureC ?? reportedTemperatureC;
    if (effectiveTemperatureC !== null) {
      if (adjustment === "warmer") effectiveTemperatureC += 3;
      if (adjustment === "colder") effectiveTemperatureC -= 3;
      effectiveTemperatureC = roundOne(effectiveTemperatureC);
    }
    return {
      active: true,
      ignored: false,
      mode,
      source,
      availability,
      unit,
      reportedTemperatureC,
      apparentTemperatureC,
      effectiveTemperatureC,
      condition,
      precipitationBucket: precipitationBucket(precipitationMm),
      windBucket: windBucket(windKph),
      windKph,
      exposure,
      adjustment,
      adjusted: adjustment !== "same" || rainExpected,
      rainExpected,
      observedAt,
      fetchedAt
    };
  }

  function baseEffectiveContext(values) {
    return {
      active: false,
      ignored: values.ignored,
      mode: values.mode,
      source: values.source,
      availability: values.availability,
      unit: values.unit,
      reportedTemperatureC: null,
      apparentTemperatureC: null,
      effectiveTemperatureC: null,
      condition: "unknown",
      precipitationBucket: "none",
      windBucket: "calm",
      windKph: 0,
      exposure: values.exposure,
      adjustment: values.adjustment,
      adjusted: false,
      rainExpected: false,
      observedAt: "",
      fetchedAt: ""
    };
  }

  function targetWarmth(context) {
    if (!context?.active || context.ignored) return null;
    const temperature = context.effectiveTemperatureC;
    let target;
    if (temperature === null) target = 3;
    else if (temperature <= -10) target = 12;
    else if (temperature <= 0) target = 10;
    else if (temperature <= 7) target = 8;
    else if (temperature <= 13) target = 6;
    else if (temperature <= 18) target = 4.5;
    else if (temperature <= 24) target = 3;
    else target = 1.5;
    if (context.exposure === "indoors") target = Math.max(1, target - 2);
    if (context.windBucket === "windy" && context.exposure === "outdoors") target += 1;
    return target;
  }

  function warmthContribution(item) {
    return WARMTH_POINTS[item?.warmth] || 0;
  }

  function combinedWarmth(items) {
    return roundOne((items || []).reduce((sum, item) => sum + warmthContribution(item), 0));
  }

  function scoreOutfitContext(items, context) {
    const combined = combinedWarmth(items);
    const target = targetWarmth(context);
    if (target === null) return { score: 0, combinedWarmth: combined, targetWarmth: null, shortfall: 0, sufficient: true };
    const deficit = Math.max(0, target - combined);
    const excess = Math.max(0, combined - target - 1);
    let score = -(deficit * 9) - (excess * 4);
    const rainProtection = maximumProtection(items, "rainProtection", RAIN_PROTECTION_POINTS);
    const windProtection = maximumProtection(items, "windProtection", WIND_PROTECTION_POINTS);
    const wet = context.rainExpected || ["rain", "snow"].includes(context.condition) || context.precipitationBucket !== "none";
    if (wet) {
      score += rainProtection * 11;
      if (!rainProtection) score -= 16;
      score -= (items || []).filter((item) => item.rainPolicy === "avoid").length * 18;
    }
    if (context.windBucket === "windy" && context.exposure === "outdoors") {
      score += windProtection * 8;
      if (!windProtection) score -= 10;
    }
    return {
      score,
      combinedWarmth: combined,
      targetWarmth: target,
      shortfall: roundOne(deficit),
      sufficient: deficit <= 1
    };
  }

  function shouldConsiderLayer(items, context) {
    const hasExistingLayer = (items || []).some((item) => item.category === "layer"
      || (item.category === "top"
        && !(item.layerRoles || []).includes("base")
        && (item.layerRoles || []).some((role) => ["mid", "outer"].includes(role))));
    if (!context?.active || context.ignored || hasExistingLayer) return false;
    const result = scoreOutfitContext(items, context);
    const protectiveNeed = context.rainExpected || ["rain", "snow"].includes(context.condition)
      || (context.windBucket === "windy" && context.exposure === "outdoors");
    if (!protectiveNeed && context.effectiveTemperatureC !== null && context.effectiveTemperatureC >= 18) return false;
    return result.shortfall > 1 || protectiveNeed;
  }

  function historyContextSnapshot(context, layerState) {
    if (!context || (!context.active && !context.ignored)) return null;
    const snapshot = {
      source: context.source,
      temperatureC: context.effectiveTemperatureC === null ? null : roundOne(context.effectiveTemperatureC),
      temperatureBand: temperatureBand(context.effectiveTemperatureC),
      condition: CONDITIONS.includes(context.condition) ? context.condition : "unknown",
      precipitationBucket: context.precipitationBucket,
      windBucket: context.windBucket,
      exposure: context.exposure,
      adjusted: context.adjusted === true,
      automaticLayerSuggested: layerState?.suggested === true,
      automaticLayerRemoved: layerState?.removed === true
    };
    return snapshot;
  }

  function normalizeHistoryContext(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const source = ["current", "cached", "manual", "ignored"].includes(value.source) ? value.source : "ignored";
    const temperatureC = value.temperatureC === null ? null : safeNumber(value.temperatureC, -120, 80);
    return {
      source,
      temperatureC,
      temperatureBand: ["unknown", "hot", "warm", "mild", "cool", "cold", "severe_cold"].includes(value.temperatureBand)
        ? value.temperatureBand : temperatureBand(temperatureC),
      condition: CONDITIONS.includes(value.condition) ? value.condition : "unknown",
      precipitationBucket: ["none", "light", "heavy"].includes(value.precipitationBucket) ? value.precipitationBucket : "none",
      windBucket: ["calm", "breezy", "windy"].includes(value.windBucket) ? value.windBucket : "calm",
      exposure: EXPOSURES.includes(value.exposure) ? value.exposure : "outdoors",
      adjusted: value.adjusted === true,
      automaticLayerSuggested: value.automaticLayerSuggested === true,
      automaticLayerRemoved: value.automaticLayerRemoved === true
    };
  }

  function temperatureBand(value) {
    if (value === null || value === undefined || !Number.isFinite(Number(value))) return "unknown";
    const c = Number(value);
    if (c > 29) return "hot";
    if (c > 23) return "warm";
    if (c > 16) return "mild";
    if (c > 8) return "cool";
    if (c > 0) return "cold";
    return "severe_cold";
  }

  function describeContext(context, options) {
    if (!context || context.source === "none") return "No weather context used.";
    if (context.ignored) return "Weather ignored for this roll.";
    const unit = UNITS.includes(options?.unit) ? options.unit : context.unit;
    const parts = [];
    if (context.reportedTemperatureC !== null) parts.push(formatTemperature(context.reportedTemperatureC, unit));
    if (context.apparentTemperatureC !== null && Math.abs(context.apparentTemperatureC - context.reportedTemperatureC) >= 0.5) {
      parts.push(`feels like ${formatTemperature(context.apparentTemperatureC, unit)}`);
    }
    if (context.condition !== "unknown") parts.push(conditionLabel(context.condition));
    let text = parts.join(", ") || "Manual context";
    if (options?.layerName) text += ` — added ${options.layerName}.`;
    else text += ".";
    if (options?.shortfall > 1) text += " One available layer does not fully meet the warmth target.";
    return text;
  }

  function formatTemperature(celsius, unit) {
    if (celsius === null || celsius === undefined || !Number.isFinite(Number(celsius))) return "--°";
    const value = unit === "c" ? Number(celsius) : celsiusToFahrenheit(Number(celsius));
    return `${Math.round(value)}°${unit === "c" ? "C" : "F"}`;
  }

  function conditionLabel(value) {
    return { clear: "clear", cloudy: "cloudy", rain: "rain", snow: "snow", wind: "windy", unknown: "unknown conditions" }[value] || "unknown conditions";
  }

  function celsiusToFahrenheit(value) {
    return (Number(value) * 9 / 5) + 32;
  }

  function fahrenheitToCelsius(value) {
    return (Number(value) - 32) * 5 / 9;
  }

  function nullableTemperature(value, unit) {
    if (value === null || value === undefined || String(value).trim() === "") return null;
    const number = Number(value);
    if (!Number.isFinite(number)) return null;
    const celsius = unit === "c" ? number : fahrenheitToCelsius(number);
    return celsius >= -100 && celsius <= 70 ? roundOne(celsius) : null;
  }

  function createWeatherClient(options) {
    const fetchImpl = options?.fetchImpl || (typeof fetch === "function" ? fetch.bind(globalThis) : null);
    const geolocation = options?.geolocation || (typeof navigator !== "undefined" ? navigator.geolocation : null);
    const now = options?.now || (() => Date.now());
    const timeoutMs = Number(options?.timeoutMs) > 0 ? Number(options.timeoutMs) : REQUEST_TIMEOUT_MS;
    const automaticMinimumMs = Number(options?.automaticMinimumMs) >= 0 ? Number(options.automaticMinimumMs) : AUTO_REFRESH_MIN_MS;
    let inFlight = null;
    let lastAutomaticAttempt = 0;
    let activeController = null;
    let cancelled = false;

    async function refresh(refreshOptions) {
      const force = refreshOptions?.force === true;
      if (inFlight) return inFlight;
      const currentTime = now();
      if (!force && lastAutomaticAttempt && currentTime - lastAutomaticAttempt < automaticMinimumMs) {
        throw contextError("RATE_LIMITED", "Automatic weather refresh is rate-limited.");
      }
      if (!fetchImpl) throw contextError("FETCH_UNAVAILABLE", "Weather requests are unavailable in this browser.");
      if (!geolocation || typeof geolocation.getCurrentPosition !== "function") {
        throw contextError("LOCATION_UNAVAILABLE", "Current location is unavailable in this browser.");
      }
      if (!force) lastAutomaticAttempt = currentTime;
      inFlight = (async () => {
        cancelled = false;
        activeController = typeof AbortController === "function" ? new AbortController() : null;
        let timeoutId = null;
        try {
          const coordinates = await locate(geolocation, timeoutMs, refreshOptions?.maximumAge, activeController?.signal);
          const latitude = roundCoordinate(coordinates.latitude);
          const longitude = roundCoordinate(coordinates.longitude);
          const url = new URL(PROVIDER_URL);
          url.searchParams.set("latitude", String(latitude));
          url.searchParams.set("longitude", String(longitude));
          url.searchParams.set("current", CURRENT_FIELDS.join(","));
          url.searchParams.set("temperature_unit", "celsius");
          url.searchParams.set("wind_speed_unit", "kmh");
          url.searchParams.set("precipitation_unit", "mm");
          timeoutId = setTimeout(() => activeController?.abort(), timeoutMs);
          const response = await fetchImpl(url.toString(), {
            method: "GET",
            cache: "no-store",
            credentials: "omit",
            referrerPolicy: "no-referrer",
            signal: activeController?.signal
          });
          if (!response || response.ok !== true) {
            throw contextError("PROVIDER_ERROR", `Weather provider returned ${response?.status || "an error"}.`);
          }
          const payload = await response.json();
          return normalizeProviderResponse(payload, { fetchedAt: now() });
        } catch (error) {
          if (cancelled) throw contextError("REQUEST_CANCELLED", "Weather request was cancelled.");
          if (error?.name === "AbortError") throw contextError("WEATHER_TIMEOUT", "Weather request timed out.");
          if (error?.code) throw error;
          throw contextError("NETWORK_ERROR", "Weather could not be refreshed.");
        } finally {
          if (timeoutId !== null) clearTimeout(timeoutId);
          activeController = null;
          cancelled = false;
        }
      })().finally(() => {
        inFlight = null;
      });
      return inFlight;
    }

    function cancel() {
      cancelled = true;
      activeController?.abort();
    }

    return { refresh, cancel, isRefreshing: () => Boolean(inFlight) };
  }

  function locate(geolocation, timeoutMs, maximumAge, signal) {
    return new Promise((resolve, reject) => {
      let settled = false;
      const abort = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(Object.assign(new Error("Location request aborted."), { name: "AbortError" }));
      };
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        signal?.removeEventListener("abort", abort);
        reject(contextError("LOCATION_TIMEOUT", "Location request timed out."));
      }, timeoutMs);
      if (signal?.aborted) {
        abort();
        return;
      }
      signal?.addEventListener("abort", abort, { once: true });
      geolocation.getCurrentPosition((position) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        signal?.removeEventListener("abort", abort);
        const latitude = Number(position?.coords?.latitude);
        const longitude = Number(position?.coords?.longitude);
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
          reject(contextError("LOCATION_UNAVAILABLE", "Location response was invalid."));
          return;
        }
        resolve({ latitude, longitude });
      }, (error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        signal?.removeEventListener("abort", abort);
        const code = error?.code === 1 ? "LOCATION_DENIED" : (error?.code === 3 ? "LOCATION_TIMEOUT" : "LOCATION_UNAVAILABLE");
        reject(contextError(code, code === "LOCATION_DENIED" ? "Location permission was denied." : "Current location is unavailable."));
      }, {
        enableHighAccuracy: false,
        timeout: timeoutMs,
        maximumAge: Number.isFinite(Number(maximumAge)) ? Number(maximumAge) : FRESH_MAX_MS
      });
    });
  }

  async function permissionState(permissions, geolocation) {
    if (!geolocation || typeof geolocation.getCurrentPosition !== "function") return "unavailable";
    if (!permissions || typeof permissions.query !== "function") return "unsupported";
    try {
      const status = await permissions.query({ name: "geolocation" });
      return ["granted", "prompt", "denied"].includes(status?.state) ? status.state : "unsupported";
    } catch (error) {
      return "unsupported";
    }
  }

  function maximumProtection(items, field, scale) {
    return Math.max(0, ...(items || []).map((item) => scale[item?.[field]] || 0));
  }

  function safeNumber(value, minimum, maximum) {
    const number = Number(value);
    if (!Number.isFinite(number) || number < minimum || number > maximum) return null;
    return roundOne(number);
  }

  function roundCoordinate(value) {
    return Math.round(Number(value) * 100) / 100;
  }

  function roundOne(value) {
    return Math.round(Number(value) * 10) / 10;
  }

  function contextError(code, message) {
    const error = new Error(message);
    error.code = code;
    return error;
  }

  return {
    PROVIDER_URL,
    CURRENT_FIELDS,
    CONDITIONS,
    UNITS,
    ADJUSTMENTS,
    EXPOSURES,
    FRESH_MAX_MS,
    STALE_MAX_MS,
    AUTO_REFRESH_MIN_MS,
    REQUEST_TIMEOUT_MS,
    WIND_THRESHOLD_KPH,
    WARMTH_POINTS,
    RAIN_PROTECTION_POINTS,
    WIND_PROTECTION_POINTS,
    mapWeatherCode,
    normalizeProviderResponse,
    normalizeCachedWeather,
    weatherFreshness,
    deriveEffectiveContext,
    targetWarmth,
    warmthContribution,
    combinedWarmth,
    scoreOutfitContext,
    shouldConsiderLayer,
    historyContextSnapshot,
    normalizeHistoryContext,
    temperatureBand,
    describeContext,
    formatTemperature,
    celsiusToFahrenheit,
    fahrenheitToCelsius,
    nullableTemperature,
    precipitationBucket,
    windBucket,
    createWeatherClient,
    permissionState,
    roundCoordinate
  };
});
