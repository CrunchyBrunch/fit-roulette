(function (root, factory) {
  const contextEngine = root?.FitRouletteContextEngine
    || (typeof require === "function" ? require("./context-engine.js") : null);
  const api = factory(contextEngine);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FitRouletteSmartCloset = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (ContextEngine) {
  "use strict";

  const SCHEMA_VERSION = 5;
  const RECOVERY_KEY = "fitRoulette.v1.recovery.schema5";
  const LEGACY_RECOVERY_KEY = "fitRoulette.v1.recovery.schema4";
  const RECOVERY_PREFIX = "fitRoulette.v1.recovery.schema5.import.";

  const CATEGORIES = {
    top: "Top",
    bottom: "Bottom",
    shoes: "Shoes",
    layer: "Layer",
    belt: "Belt",
    socks: "Socks",
    accessory: "Accessory"
  };

  const CATEGORY_ORDER = ["top", "bottom", "shoes", "layer", "belt", "socks", "accessory"];
  const CATEGORY_ALIASES = { pants: "bottom", outerwear: "layer" };
  const OCCASIONS = ["work", "friday", "casual", "date", "athletic", "gym"];
  const STATUSES = ["available", "unavailable", "archived"];
  const PREFERENCES = ["avoid", "neutral", "like", "favorite"];
  const PATTERNS = ["solid", "striped", "plaid", "graphic", "multicolored", "other"];
  const SLEEVE_LENGTHS = ["not_applicable", "sleeveless", "short", "long", "other", "unspecified"];
  const BOTTOM_LENGTHS = ["not_applicable", "short", "cropped", "full", "other", "unspecified"];
  const WARMTH_LEVELS = ["unspecified", "very_light", "light", "medium", "warm", "very_warm"];
  const RAIN_POLICIES = ["unspecified", "avoid", "okay", "preferred"];
  const LAYER_ROLES = ["base", "mid", "outer"];
  const PROTECTION_LEVELS = ["unspecified", "none", "light", "protected"];
  const REVIEW_STATUSES = ["reviewed", "needs_review"];
  const RELATIONSHIP_TYPES = ["prefer", "never"];

  const COLOR_PALETTE = [
    "black", "white", "off-white", "cream", "gray", "charcoal", "dark gray", "navy", "blue",
    "light blue", "brown", "tan", "khaki", "olive", "green", "red", "burgundy", "pink",
    "purple", "orange", "yellow", "multicolor"
  ];

  const SUBTYPES = {
    top: ["polo", "t-shirt", "button-down", "sweater", "tank", "athletic top", "other"],
    bottom: ["jeans", "dress pants", "chinos", "cargos", "athletic shorts", "casual shorts", "drawstring bottoms", "athletic pants", "other"],
    shoes: ["dress shoes", "sneakers", "athletic/running shoes", "boots", "sandals", "other"],
    layer: ["jacket", "hoodie", "flannel", "overshirt", "coat", "other"],
    belt: ["dress belt", "casual belt", "woven belt", "other"],
    socks: ["dress socks", "casual socks", "athletic socks", "no-show socks", "other"],
    accessory: ["hat", "watch", "bag", "jewelry", "scarf", "other"]
  };

  const FORMALITY_LABELS = {
    1: "Athletic / Very Casual",
    2: "Casual",
    3: "Smart Casual",
    4: "Business Casual",
    5: "Formal"
  };

  const SUBTYPE_TEMPLATES = {
    polo: template("top", "polo", 3, ["work", "friday", "casual", "date"], { sleeveLength: "short", warmth: "light", layerRoles: ["base"] }),
    "t-shirt": template("top", "t-shirt", 2, ["friday", "casual", "athletic"], { sleeveLength: "short", warmth: "very_light", layerRoles: ["base"] }),
    "button-down": template("top", "button-down", 4, ["work", "friday", "casual", "date"], { sleeveLength: "long", warmth: "light", layerRoles: ["base"] }),
    sweater: template("top", "sweater", 3, ["work", "friday", "casual", "date"], { sleeveLength: "long", warmth: "warm", layerRoles: ["base", "mid"], windProtection: "light" }),
    tank: template("top", "tank", 1, ["casual", "athletic"], { sleeveLength: "sleeveless", warmth: "very_light", layerRoles: ["base"] }),
    "athletic top": template("top", "athletic top", 1, ["casual", "athletic"], { sleeveLength: "short", warmth: "very_light", layerRoles: ["base"] }),
    jeans: template("bottom", "jeans", 2, ["friday", "casual", "date"], { bottomLength: "full", beltMode: "optional" }),
    "dress pants": template("bottom", "dress pants", 4, ["work", "friday", "date"], { bottomLength: "full", beltMode: "optional" }),
    chinos: template("bottom", "chinos", 3, ["work", "friday", "casual", "date"], { bottomLength: "full", beltMode: "optional" }),
    cargos: template("bottom", "cargos", 2, ["casual"], { bottomLength: "full", beltMode: "optional" }),
    "athletic shorts": template("bottom", "athletic shorts", 1, ["casual", "athletic"], { bottomLength: "short", beltMode: "none", warmth: "very_light" }),
    "casual shorts": template("bottom", "casual shorts", 2, ["casual", "date"], { bottomLength: "short", beltMode: "optional" }),
    "drawstring bottoms": template("bottom", "drawstring bottoms", 1, ["casual", "athletic"], { bottomLength: "full", beltMode: "none" }),
    "athletic pants": template("bottom", "athletic pants", 1, ["casual", "athletic"], { bottomLength: "full", beltMode: "none" }),
    "dress shoes": template("shoes", "dress shoes", 5, ["work", "friday", "date"], { rainPolicy: "avoid" }),
    sneakers: template("shoes", "sneakers", 2, ["friday", "casual", "athletic"]),
    "athletic/running shoes": template("shoes", "athletic/running shoes", 1, ["casual", "athletic"], { rainPolicy: "okay" }),
    boots: template("shoes", "boots", 3, ["friday", "casual", "date"], { warmth: "medium", rainPolicy: "okay" }),
    sandals: template("shoes", "sandals", 1, ["casual"], { warmth: "very_light", rainPolicy: "okay" }),
    jacket: template("layer", "jacket", 3, ["work", "friday", "casual", "date"], { sleeveLength: "long", warmth: "medium", layerRoles: ["outer"], rainProtection: "light", windProtection: "light" }),
    hoodie: template("layer", "hoodie", 2, ["friday", "casual", "athletic"], { sleeveLength: "long", warmth: "warm", layerRoles: ["mid", "outer"], rainProtection: "none", windProtection: "light" }),
    flannel: template("layer", "flannel", 2, ["friday", "casual", "date"], { sleeveLength: "long", warmth: "light", pattern: "plaid", layerRoles: ["mid"], rainProtection: "none", windProtection: "none" }),
    overshirt: template("layer", "overshirt", 3, ["friday", "casual", "date"], { sleeveLength: "long", warmth: "light", layerRoles: ["mid", "outer"], rainProtection: "none", windProtection: "light" }),
    coat: template("layer", "coat", 4, ["work", "friday", "casual", "date"], { sleeveLength: "long", warmth: "very_warm", layerRoles: ["outer"], rainProtection: "light", windProtection: "protected" }),
    "dress belt": template("belt", "dress belt", 4, ["work", "friday", "date"]),
    "casual belt": template("belt", "casual belt", 2, ["friday", "casual", "date"]),
    "dress socks": template("socks", "dress socks", 4, ["work", "friday", "date"]),
    "casual socks": template("socks", "casual socks", 2, ["friday", "casual", "date"]),
    "athletic socks": template("socks", "athletic socks", 1, ["casual", "athletic"])
  };

  function template(category, subtype, formality, occasions, overrides) {
    return {
      category,
      subtype,
      formality,
      occasions,
      pattern: "solid",
      sleeveLength: ["top", "layer"].includes(category) ? "unspecified" : "not_applicable",
      bottomLength: category === "bottom" ? "unspecified" : "not_applicable",
      warmth: "unspecified",
      rainPolicy: "unspecified",
      layerRoles: category === "top" ? ["base"] : [],
      rainProtection: ["top", "layer"].includes(category) ? "unspecified" : "none",
      windProtection: ["top", "layer"].includes(category) ? "unspecified" : "none",
      beltMode: category === "bottom" ? "optional" : "",
      ...(overrides || {})
    };
  }

  function deepClone(value) {
    if (value === undefined) return undefined;
    return JSON.parse(JSON.stringify(value));
  }

  function stringOr(value, fallback) {
    const text = String(value ?? "").trim();
    return text || fallback;
  }

  function normalizeToken(value) {
    return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
  }

  function uniqueStrings(value) {
    const source = Array.isArray(value) ? value : String(value || "").split(",");
    const seen = new Set();
    return source.map((entry) => String(entry).trim()).filter((entry) => {
      const key = normalizeToken(entry);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function normalizeOccasion(value) {
    const token = normalizeToken(value).replace(/[^a-z0-9]+/g, "");
    const aliases = {
      work: "work", office: "work", workoffice: "work", friday: "friday", fridayjeans: "friday",
      casual: "casual", date: "date", athletic: "athletic", exercise: "athletic", training: "athletic",
      gym: "gym", errands: "casual", gymerrands: "gym"
    };
    return aliases[token] || "";
  }

  function normalizeCategory(value) {
    const token = normalizeToken(value);
    const mapped = CATEGORY_ALIASES[token] || token;
    return CATEGORIES[mapped] ? mapped : "top";
  }

  function normalizeStatus(item, schemaVersion, reasons) {
    if (STATUSES.includes(item.status)) return item.status;
    if (item.status !== undefined && item.status !== "") reasons.push("Confirm item status; an unfamiliar saved value was preserved.");
    if (item.unavailable === true) return "unavailable";
    if (item.active === false) {
      if (schemaVersion < 4) reasons.push("Confirm whether this item is archived or temporarily unavailable.");
      return "archived";
    }
    return "available";
  }

  function normalizeFormality(value, schemaVersion, reasons) {
    const number = Number(value);
    if (!Number.isFinite(number)) {
      reasons.push("Choose a formality level.");
      return 3;
    }
    if (schemaVersion < 4) return Math.max(1, Math.min(5, Math.ceil(Math.max(1, Math.min(10, Math.round(number))) / 2)));
    return Math.max(1, Math.min(5, Math.round(number)));
  }

  function inferSubtype(item, category) {
    const signals = normalizeToken([item.subtype, item.name, ...(Array.isArray(item.tags) ? item.tags : []), ...(Array.isArray(item.labels) ? item.labels : [])].join(" "));
    const candidates = SUBTYPES[category] || ["other"];
    const aliases = {
      "t-shirt": ["t-shirt", "tshirt", "tee"],
      "button-down": ["button-down", "button down", "dress shirt"],
      "athletic top": ["athletic", "workout", "gym shirt"],
      "dress pants": ["dress pants", "trousers", "pressed"],
      chinos: ["chino"], cargos: ["cargo"], jeans: ["jean", "denim"],
      "athletic shorts": ["athletic shorts", "gym shorts", "running shorts"],
      "casual shorts": ["shorts"], "drawstring bottoms": ["drawstring", "jogger"],
      "athletic pants": ["athletic pants", "track pants", "sweatpants"],
      "dress shoes": ["dress shoes", "oxford", "loafer"], sneakers: ["sneaker", "converse", "jordan"],
      "athletic/running shoes": ["running", "athletic shoe", "trainer"], boots: ["boot"], sandals: ["sandal"],
      "dress belt": ["dress belt"], "casual belt": ["belt"], "dress socks": ["dress socks"],
      "casual socks": ["socks"], "athletic socks": ["athletic socks"],
      jacket: ["jacket"], hoodie: ["hoodie"], flannel: ["flannel"], overshirt: ["overshirt"], coat: ["coat"]
    };
    const matches = candidates
      .filter((subtype) => subtype !== "other")
      .flatMap((subtype) => (aliases[subtype] || [subtype])
        .filter((term) => signals.includes(term))
        .map((term) => ({ subtype, specificity: normalizeToken(term).length })))
      .sort((a, b) => b.specificity - a.specificity);
    return matches[0]?.subtype || "other";
  }

  function normalizeSubtype(value, category, item, reasons) {
    const token = normalizeToken(value);
    if ((SUBTYPES[category] || []).includes(token)) return token;
    const inferred = inferSubtype(item, category);
    reasons.push(inferred === "other" ? "Choose a garment subtype." : `Confirm inferred subtype: ${titleCase(inferred)}.`);
    return inferred;
  }

  function inferPattern(item, reasons) {
    const direct = normalizeToken(item.pattern);
    if (PATTERNS.includes(direct)) return direct;
    const signals = normalizeToken([item.name, ...(item.tags || []), ...(item.labels || [])].join(" "));
    for (const pattern of ["striped", "plaid", "graphic", "multicolored"]) {
      if (signals.includes(pattern.replace("ed", ""))) {
        reasons.push(`Confirm inferred pattern: ${titleCase(pattern)}.`);
        return pattern;
      }
    }
    reasons.push("Confirm the inferred Solid pattern.");
    return "solid";
  }

  function enumOr(value, allowed, fallback, reasons, reason) {
    if (allowed.includes(value)) return value;
    if (reason) reasons.push(reason);
    return fallback;
  }

  function normalizeLayerRoles(value, category, subtype, defaults, schemaVersion, reasons, unrecognizedStructured) {
    if (!["top", "layer"].includes(category)) return [];
    const provided = Array.isArray(value) ? value.map(normalizeToken) : [];
    const invalid = provided.filter((role) => !LAYER_ROLES.includes(role));
    if (invalid.length || (value !== undefined && !Array.isArray(value))) {
      unrecognizedStructured.layerRoles = deepClone(value);
      reasons.push("Confirm layer roles; an unfamiliar saved value was preserved.");
    }
    const valid = [...new Set(provided.filter((role) => LAYER_ROLES.includes(role)))];
    let roles = valid.length ? valid : [...(defaults.layerRoles || [])];
    if (!roles.length) reasons.push("Choose at least one eligible layer role if this garment participates in layering.");
    if (schemaVersion < 5 && (category === "layer" || subtype === "sweater" || subtype === "other")) {
      reasons.push("Confirm whether this garment works as a Base, Mid, or Outer layer.");
    }
    return roles;
  }

  function normalizeProtection(value, category, fallback, field, schemaVersion, reasons, unrecognizedStructured) {
    if (!["top", "layer"].includes(category)) return "none";
    if (PROTECTION_LEVELS.includes(value)) return value;
    if (value !== undefined) {
      unrecognizedStructured[field] = deepClone(value);
      reasons.push(`Confirm ${field === "rainProtection" ? "rain" : "wind"} protection; an unfamiliar saved value was preserved.`);
    } else if (schemaVersion < 5 && category === "layer") {
      reasons.push(`Confirm this layer's ${field === "rainProtection" ? "rain" : "wind"} protection.`);
    }
    return PROTECTION_LEVELS.includes(fallback) ? fallback : "unspecified";
  }

  function migrateItem(rawItem, schemaVersion, now) {
    if (!rawItem || typeof rawItem !== "object" || Array.isArray(rawItem)) {
      return { unresolved: deepClone(rawItem), reason: "Wardrobe record is not an object." };
    }
    const item = deepClone(rawItem);
    const reasons = [];
    const category = normalizeCategory(item.category);
    const unrecognizedStructured = item.unrecognizedStructured && typeof item.unrecognizedStructured === "object"
      ? deepClone(item.unrecognizedStructured)
      : {};
    if (!CATEGORIES[normalizeToken(item.category)] && !CATEGORY_ALIASES[normalizeToken(item.category)]) {
      reasons.push("Confirm the inferred category.");
      if (item.category !== undefined) unrecognizedStructured.category = deepClone(item.category);
    }
    const subtype = normalizeSubtype(item.subtype, category, item, reasons);
    if (item.subtype && !(SUBTYPES[category] || []).includes(normalizeToken(item.subtype))) unrecognizedStructured.subtype = deepClone(item.subtype);
    const legacyColors = uniqueStrings(item.colors);
    const primaryColor = stringOr(item.primaryColor, legacyColors[0] || "");
    const secondaryColor = stringOr(item.secondaryColor, legacyColors[1] || "");
    if (!primaryColor) reasons.push("Choose a primary color.");
    if (schemaVersion < SCHEMA_VERSION && legacyColors.length > 2) {
      reasons.push("Legacy data contains more than two colors; extra values remain preserved in legacy data.");
      unrecognizedStructured.extraColors = legacyColors.slice(2);
    }
    const rawOccasions = uniqueStrings(item.occasions);
    const occasions = [...new Set(rawOccasions.map(normalizeOccasion).filter(Boolean))];
    const unrecognizedOccasions = rawOccasions.filter((value) => !normalizeOccasion(value));
    if (unrecognizedOccasions.length) {
      reasons.push("Confirm unfamiliar occasion values; they remain preserved for review.");
      unrecognizedStructured.occasions = unrecognizedOccasions;
    }
    if (!occasions.length) reasons.push("Choose at least one eligible occasion.");
    if (schemaVersion < 5 && occasions.includes("gym")) {
      reasons.push("Legacy Gym / Errands is ambiguous; choose Athletic for exercise or Casual for errands.");
    }
    const templateDefaults = SUBTYPE_TEMPLATES[subtype] || template(category, subtype, 3, ["casual"]);
    const legacyMatching = item.legacyMatching && typeof item.legacyMatching === "object" ? deepClone(item.legacyMatching) : {
      tags: uniqueStrings(item.tags),
      worksWithTags: uniqueStrings(item.worksWithTags),
      avoidWithTags: uniqueStrings(item.avoidWithTags),
      avoidWithItems: uniqueStrings(item.avoidWithItems)
    };
    const hasLegacyMatcher = [legacyMatching.worksWithTags, legacyMatching.avoidWithTags, legacyMatching.avoidWithItems]
      .some((values) => Array.isArray(values) && values.length);
    const migrated = schemaVersion < SCHEMA_VERSION;
    const existingReview = item.review && typeof item.review === "object" ? item.review : {};
    const explicitReviewStatus = REVIEW_STATUSES.includes(existingReview.status) ? existingReview.status : "";
    const explicitLegacyFallback = typeof item.legacyFallback === "boolean" ? item.legacyFallback : null;
    if (item.pattern && !PATTERNS.includes(normalizeToken(item.pattern))) {
      reasons.push("Confirm item pattern; an unfamiliar saved value was preserved.");
      unrecognizedStructured.pattern = deepClone(item.pattern);
    }
    if (item.sleeveLength !== undefined && !SLEEVE_LENGTHS.includes(item.sleeveLength)) unrecognizedStructured.sleeveLength = deepClone(item.sleeveLength);
    if (item.bottomLength !== undefined && !BOTTOM_LENGTHS.includes(item.bottomLength)) unrecognizedStructured.bottomLength = deepClone(item.bottomLength);
    if (item.warmth !== undefined && !WARMTH_LEVELS.includes(item.warmth)) unrecognizedStructured.warmth = deepClone(item.warmth);
    if (item.rainPolicy !== undefined && !RAIN_POLICIES.includes(item.rainPolicy)) unrecognizedStructured.rainPolicy = deepClone(item.rainPolicy);
    if (item.layerRoles !== undefined && !Array.isArray(item.layerRoles)) unrecognizedStructured.layerRoles = deepClone(item.layerRoles);
    if (item.rainProtection !== undefined && !PROTECTION_LEVELS.includes(item.rainProtection)) unrecognizedStructured.rainProtection = deepClone(item.rainProtection);
    if (item.windProtection !== undefined && !PROTECTION_LEVELS.includes(item.windProtection)) unrecognizedStructured.windProtection = deepClone(item.windProtection);
    if (item.beltMode !== undefined && category === "bottom" && !["required", "optional", "none"].includes(item.beltMode)) unrecognizedStructured.beltMode = deepClone(item.beltMode);
    const rawFormality = Number(item.formality);
    const maximumFormality = schemaVersion < 4 ? 10 : 5;
    if (item.formality !== undefined && (!Number.isFinite(rawFormality) || rawFormality < 1 || rawFormality > maximumFormality)) {
      reasons.push("Confirm formality; an unfamiliar saved value was preserved.");
      unrecognizedStructured.formality = deepClone(item.formality);
    }
    if (item.status && !STATUSES.includes(item.status)) unrecognizedStructured.status = deepClone(item.status);
    if (item.preference && !PREFERENCES.includes(item.preference)) {
      reasons.push("Confirm item preference; an unfamiliar saved value was preserved.");
      unrecognizedStructured.preference = deepClone(item.preference);
    }

    const normalized = {
      ...item,
      id: stringOr(item.id, `item_${stableToken(now, item.name)}`),
      name: stringOr(item.name, "Unnamed Item"),
      category,
      subtype,
      primaryColor,
      secondaryColor,
      pattern: PATTERNS.includes(normalizeToken(item.pattern))
        ? normalizeToken(item.pattern)
        : (schemaVersion < 4 ? inferPattern(item, reasons) : "solid"),
      sleeveLength: enumOr(item.sleeveLength, SLEEVE_LENGTHS, templateDefaults.sleeveLength, reasons, ["top", "layer"].includes(category) && (migrated || item.sleeveLength !== undefined) ? "Confirm sleeve length." : ""),
      bottomLength: enumOr(item.bottomLength, BOTTOM_LENGTHS, templateDefaults.bottomLength, reasons, category === "bottom" && (migrated || item.bottomLength !== undefined) ? "Confirm bottom length." : ""),
      formality: normalizeFormality(item.formality, schemaVersion, reasons),
      occasions: occasions.length ? occasions : [...templateDefaults.occasions],
      warmth: enumOr(item.warmth, WARMTH_LEVELS, legacyWarmth(item.warmthLevel) || templateDefaults.warmth, reasons, item.warmth !== undefined ? "Confirm warmth; an unfamiliar saved value was preserved." : ""),
      rainPolicy: enumOr(item.rainPolicy, RAIN_POLICIES, legacyRainPolicy(item.rainSafe) || templateDefaults.rainPolicy, reasons, item.rainPolicy !== undefined ? "Confirm rain policy; an unfamiliar saved value was preserved." : ""),
      layerRoles: normalizeLayerRoles(item.layerRoles, category, subtype, templateDefaults, schemaVersion, reasons, unrecognizedStructured),
      rainProtection: normalizeProtection(item.rainProtection, category, templateDefaults.rainProtection, "rainProtection", schemaVersion, reasons, unrecognizedStructured),
      windProtection: normalizeProtection(item.windProtection, category, templateDefaults.windProtection, "windProtection", schemaVersion, reasons, unrecognizedStructured),
      status: normalizeStatus(item, schemaVersion, reasons),
      preference: enumOr(item.preference, PREFERENCES, "neutral", reasons),
      labels: uniqueStrings(item.labels || item.tags),
      review: {
        ...deepClone(existingReview),
        status: reasons.length ? "needs_review" : (explicitReviewStatus || "reviewed"),
        reasons: uniqueStrings([...(Array.isArray(existingReview.reasons) ? existingReview.reasons : []), ...reasons]),
        reviewedAt: stringOr(existingReview.reviewedAt, "")
      },
      legacyFallback: explicitLegacyFallback === null ? Boolean(migrated && hasLegacyMatcher) : explicitLegacyFallback,
      legacyMatching,
      unrecognizedStructured,
      beltMode: category === "bottom" && ["required", "optional", "none"].includes(item.beltMode) ? item.beltMode : templateDefaults.beltMode,
      imageUrl: stringOr(item.imageUrl || item.image, ""),
      notes: stringOr(item.notes, ""),
      lastWorn: validDateOnly(item.lastWorn) || null,
      createdAt: stringOr(item.createdAt, now),
      updatedAt: stringOr(item.updatedAt, now)
    };
    return { item: normalized };
  }

  function legacyWarmth(value) {
    const values = ["", "very_light", "light", "medium", "warm", "very_warm"];
    const number = Number(value);
    return Number.isInteger(number) && number >= 1 && number <= 5 ? values[number] : "";
  }

  function legacyRainPolicy(value) {
    return value === true ? "okay" : value === false ? "avoid" : "";
  }

  function normalizeHistoryRecord(record, now) {
    if (!record || typeof record !== "object" || Array.isArray(record)) return null;
    const itemIds = uniqueStrings(record.itemIds || record.items);
    if (!itemIds.length) return null;
    return {
      ...deepClone(record),
      id: stringOr(record.id, `log_${stableToken(now, itemIds.join("_"))}`),
      date: validDateTime(record.date) || now,
      occasion: normalizeOccasion(record.occasion) || "casual",
      itemIds,
      itemSnapshots: Array.isArray(record.itemSnapshots) ? deepClone(record.itemSnapshots) : [],
      source: record.source === "manual" ? "manual" : "generated",
      note: stringOr(record.note, ""),
      context: ContextEngine?.normalizeHistoryContext(record.context) || null
    };
  }

  function normalizeBan(record, now) {
    if (!record || typeof record !== "object" || Array.isArray(record)) return null;
    const itemIds = uniqueStrings(record.itemIds).sort();
    if (!itemIds.length) return null;
    return {
      ...deepClone(record),
      id: stringOr(record.id, `ban_${stableToken(now, itemIds.join("_"))}`),
      itemIds,
      createdAt: stringOr(record.createdAt, now)
    };
  }

  function normalizeFeedback(record, now) {
    if (!record || typeof record !== "object" || Array.isArray(record)) return null;
    return {
      ...deepClone(record),
      id: stringOr(record.id, `feedback_${stableToken(now, record.reason)}`),
      bannedComboId: stringOr(record.bannedComboId, ""),
      reason: stringOr(record.reason, "other"),
      itemIds: uniqueStrings(record.itemIds),
      pairItemIds: uniqueStrings(record.pairItemIds).slice(0, 2),
      note: stringOr(record.note, ""),
      createdAt: stringOr(record.createdAt, now)
    };
  }

  function normalizeSettings(settings) {
    const source = settings && typeof settings === "object" && !Array.isArray(settings) ? deepClone(settings) : {};
    const weather = source.weather && typeof source.weather === "object" ? source.weather : {};
    const { weather: ignoredWeather, ...retained } = source;
    const legacyTemperature = nullableNumber(weather.temperature, -30, 130);
    const legacyCondition = ["sunny", "cloudy", "rain", "snow", "windy"].includes(weather.condition) ? weather.condition : "sunny";
    return {
      ...retained,
      theme: ["system", "light", "dark"].includes(source.theme) ? source.theme : "system",
      afterLogging: ["confirm_keep", "keep", "clear"].includes(source.afterLogging) ? source.afterLogging : "confirm_keep",
      defaultOccasion: normalizeOccasion(source.defaultOccasion) || "work",
      weather: {
        automatic: weather.automatic === true,
        unit: ["f", "c"].includes(weather.unit) ? weather.unit : "f",
        cached: ContextEngine?.normalizeCachedWeather(weather.cached) || null,
        legacyManual: weather.legacyManual && typeof weather.legacyManual === "object"
          ? {
            enabled: weather.legacyManual.enabled === true,
            temperature: nullableNumber(weather.legacyManual.temperature, -30, 130),
            condition: ["sunny", "cloudy", "rain", "snow", "windy"].includes(weather.legacyManual.condition)
              ? weather.legacyManual.condition : "sunny"
          }
          : (weather.enabled === true || legacyTemperature !== null
            ? { enabled: weather.enabled === true, temperature: legacyTemperature, condition: legacyCondition }
            : null)
      }
    };
  }

  function canonicalPair(itemA, itemB) {
    return uniqueStrings([itemA, itemB]).sort();
  }

  function normalizeRelationship(record, now) {
    if (!record || typeof record !== "object" || Array.isArray(record)) return null;
    const itemIds = canonicalPair(...uniqueStrings(record.itemIds).slice(0, 2));
    if (itemIds.length !== 2 || !RELATIONSHIP_TYPES.includes(record.type)) return null;
    return {
      ...deepClone(record),
      id: stringOr(record.id, `pair_${stableToken("", `${record.type}_${itemIds.join("_")}`)}`),
      type: record.type,
      itemIds,
      createdAt: stringOr(record.createdAt, now),
      updatedAt: stringOr(record.updatedAt, now)
    };
  }

  function migrateLegacyRelationships(rawWardrobe, validItems, existingRelationships, now) {
    const validIds = new Set(validItems.map((item) => item.id));
    const byName = new Map(validItems.map((item) => [normalizeToken(item.name), item.id]));
    const relationships = (existingRelationships || []).map((record) => normalizeRelationship(record, now)).filter(Boolean);
    const unresolved = [];
    const seen = new Set(relationships.map((record) => `${record.type}:${record.itemIds.join("|")}`));
    const seenPairs = new Set(relationships.map((record) => record.itemIds.join("|")));
    (rawWardrobe || []).forEach((raw) => {
      if (!raw || typeof raw !== "object") return;
      const sourceId = stringOr(raw.id, "");
      if (!validIds.has(sourceId)) return;
      uniqueStrings(raw.avoidWithItems || raw.legacyMatching?.avoidWithItems).forEach((reference) => {
        const targetId = validIds.has(reference) ? reference : byName.get(normalizeToken(reference));
        if (!targetId || targetId === sourceId) {
          unresolved.push({ sourceItemId: sourceId, type: "never", reference, reason: "Unresolved legacy item reference" });
          return;
        }
        const itemIds = canonicalPair(sourceId, targetId);
        const pairKey = itemIds.join("|");
        const key = `never:${itemIds.join("|")}`;
        if (seen.has(key)) return;
        if (seenPairs.has(pairKey)) {
          unresolved.push({ sourceItemId: sourceId, type: "never", reference, reason: "Legacy relationship conflicts with an existing pair relationship" });
          return;
        }
        seen.add(key);
        seenPairs.add(pairKey);
        relationships.push(normalizeRelationship({ type: "never", itemIds }, now));
      });
    });
    return { relationships, unresolved };
  }

  function migrateAndValidate(raw, options) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw migrationError("INVALID_ROOT", "Backup root must be an object.");
    assertNoSensitiveLocation(raw);
    const now = stringOr(options?.now, new Date().toISOString());
    const source = deepClone(raw);
    const declaredSchema = source.schemaVersion ?? source.version;
    const schemaVersion = Number(declaredSchema ?? 1);
    if (declaredSchema !== undefined && (!Number.isFinite(schemaVersion) || schemaVersion < 1)) {
      throw migrationError("INVALID_SCHEMA", "Saved schema version must be a positive number.");
    }
    if (schemaVersion > SCHEMA_VERSION) {
      throw migrationError("UNSUPPORTED_FUTURE_SCHEMA", `Schema ${schemaVersion} is newer than this app supports.`);
    }
    for (const key of ["wardrobe", "history", "bannedCombos", "feedback", "pairRelationships"]) {
      if (source[key] !== undefined && !Array.isArray(source[key])) {
        throw migrationError("INVALID_COLLECTION", `${key} must be an array when present.`);
      }
    }
    const unresolvedRecords = source.unresolvedRecords && typeof source.unresolvedRecords === "object"
      ? deepClone(source.unresolvedRecords)
      : {};
    const wardrobe = [];
    const unresolvedWardrobe = Array.isArray(unresolvedRecords.wardrobe) ? deepClone(unresolvedRecords.wardrobe) : [];
    const rawWardrobe = Array.isArray(source.wardrobe) ? source.wardrobe : [];
    rawWardrobe.forEach((record) => {
      const result = migrateItem(record, schemaVersion, now);
      if (result.item) wardrobe.push(result.item);
      else unresolvedWardrobe.push(result);
    });
    const ids = new Set();
    wardrobe.forEach((item) => {
      if (ids.has(item.id)) throw migrationError("DUPLICATE_ITEM_ID", `Duplicate wardrobe item id: ${item.id}`);
      ids.add(item.id);
    });
    const invalidRelationships = [];
    const seenRelationshipPairs = new Set();
    const validRelationships = (source.pairRelationships || []).map((record) => {
      const normalized = normalizeRelationship(record, now);
      if (!normalized) {
        invalidRelationships.push({ record: deepClone(record), reason: "Invalid pair relationship record" });
        return null;
      }
      if (!normalized.itemIds.every((itemId) => ids.has(itemId))) {
        invalidRelationships.push({ record: deepClone(record), reason: "Unresolved pair relationship item reference" });
        return null;
      }
      const pairKey = normalized.itemIds.join("|");
      if (seenRelationshipPairs.has(pairKey)) {
        invalidRelationships.push({ record: deepClone(record), reason: "Duplicate or conflicting pair relationship" });
        return null;
      }
      seenRelationshipPairs.add(pairKey);
      return normalized;
    }).filter(Boolean);
    const relationResult = migrateLegacyRelationships(schemaVersion < SCHEMA_VERSION ? rawWardrobe : [], wardrobe, validRelationships, now);
    const existingUnresolvedRelationships = Array.isArray(source.unresolvedPairRelationships) ? source.unresolvedPairRelationships : [];
    const history = [];
    (source.history || []).forEach((record) => {
      const normalized = normalizeHistoryRecord(record, now);
      if (normalized) history.push(normalized);
      else unresolvedRecords.history = [...(unresolvedRecords.history || []), { record: deepClone(record), reason: "Invalid history record" }];
    });
    const bannedCombos = [];
    (source.bannedCombos || []).forEach((record) => {
      const normalized = normalizeBan(record, now);
      if (normalized) bannedCombos.push(normalized);
      else unresolvedRecords.bannedCombos = [...(unresolvedRecords.bannedCombos || []), { record: deepClone(record), reason: "Invalid exact-ban record" }];
    });
    const feedback = [];
    (source.feedback || []).forEach((record) => {
      const normalized = normalizeFeedback(record, now);
      if (normalized) feedback.push(normalized);
      else unresolvedRecords.feedback = [...(unresolvedRecords.feedback || []), { record: deepClone(record), reason: "Invalid feedback record" }];
    });
    const state = {
      ...source,
      schemaVersion: SCHEMA_VERSION,
      version: SCHEMA_VERSION,
      wardrobe,
      history,
      bannedCombos,
      feedback,
      pairRelationships: relationResult.relationships,
      unresolvedPairRelationships: [...deepClone(existingUnresolvedRelationships), ...invalidRelationships, ...relationResult.unresolved],
      settings: normalizeSettings(source.settings),
      setup: normalizeSetup(source.setup, schemaVersion),
      unresolvedRecords: {
        ...unresolvedRecords,
        wardrobe: unresolvedWardrobe
      }
    };
    validateState(state);
    return { state, migrated: schemaVersion < SCHEMA_VERSION };
  }

  function normalizeSetup(setup, schemaVersion) {
    if (setup && typeof setup === "object") {
      return {
        ...deepClone(setup),
        completed: setup.completed === true,
        choice: ["empty", "quick_add", "sample", "existing", "recovery"].includes(setup.choice) ? setup.choice : ""
      };
    }
    return { completed: schemaVersion < SCHEMA_VERSION, choice: schemaVersion < SCHEMA_VERSION ? "existing" : "" };
  }

  function validateState(state) {
    assertNoSensitiveLocation(state);
    if (state.schemaVersion !== SCHEMA_VERSION) throw migrationError("INVALID_SCHEMA", "Schema version is not 5.");
    for (const key of ["wardrobe", "history", "bannedCombos", "feedback", "pairRelationships"]) {
      if (!Array.isArray(state[key])) throw migrationError("INVALID_COLLECTION", `${key} must be an array.`);
    }
    const itemIds = new Set();
    state.wardrobe.forEach((item) => {
      if (!item.id || !item.name || !CATEGORIES[item.category] || !SUBTYPES[item.category].includes(item.subtype)) {
        throw migrationError("INVALID_ITEM", `Invalid wardrobe item: ${item.id || "unknown"}`);
      }
      if (itemIds.has(item.id)) throw migrationError("DUPLICATE_ITEM_ID", `Duplicate wardrobe item id: ${item.id}`);
      itemIds.add(item.id);
      if (!STATUSES.includes(item.status) || !PREFERENCES.includes(item.preference) || !PATTERNS.includes(item.pattern)) {
        throw migrationError("INVALID_ITEM_ENUM", `Invalid structured fields for item: ${item.id}`);
      }
      if (!SLEEVE_LENGTHS.includes(item.sleeveLength) || !BOTTOM_LENGTHS.includes(item.bottomLength)
        || !WARMTH_LEVELS.includes(item.warmth) || !RAIN_POLICIES.includes(item.rainPolicy)
        || !Array.isArray(item.layerRoles) || !item.layerRoles.every((role) => LAYER_ROLES.includes(role))
        || new Set(item.layerRoles).size !== item.layerRoles.length
        || !PROTECTION_LEVELS.includes(item.rainProtection) || !PROTECTION_LEVELS.includes(item.windProtection)) {
        throw migrationError("INVALID_ITEM_ENUM", `Invalid matching details for item: ${item.id}`);
      }
      if (!["top", "layer"].includes(item.category)
        && (item.layerRoles.length || item.rainProtection !== "none" || item.windProtection !== "none")) {
        throw migrationError("INVALID_LAYER_DEFAULT", `Non-layer garment has unsafe layer properties: ${item.id}`);
      }
      if (!Number.isInteger(item.formality) || item.formality < 1 || item.formality > 5) {
        throw migrationError("INVALID_FORMALITY", `Invalid formality for item: ${item.id}`);
      }
      if (typeof item.primaryColor !== "string" || typeof item.secondaryColor !== "string" || !Array.isArray(item.labels)) {
        throw migrationError("INVALID_ITEM_FIELDS", `Invalid colors or labels for item: ${item.id}`);
      }
      if (!Array.isArray(item.occasions) || !item.occasions.every((value) => OCCASIONS.includes(value))) {
        throw migrationError("INVALID_OCCASIONS", `Invalid occasions for item: ${item.id}`);
      }
      if (!item.review || !REVIEW_STATUSES.includes(item.review.status) || !Array.isArray(item.review.reasons)
        || typeof item.legacyFallback !== "boolean" || !item.legacyMatching || typeof item.legacyMatching !== "object") {
        throw migrationError("INVALID_REVIEW_STATE", `Invalid review or legacy fallback state for item: ${item.id}`);
      }
    });
    const normalizedCached = ContextEngine?.normalizeCachedWeather(state.settings?.weather?.cached);
    if (state.settings?.weather?.cached && !normalizedCached) throw migrationError("INVALID_WEATHER_CACHE", "Cached weather context is invalid.");
    state.history.forEach((record) => {
      if (record.context !== null && !ContextEngine?.normalizeHistoryContext(record.context)) {
        throw migrationError("INVALID_HISTORY_CONTEXT", `Invalid history context: ${record.id}`);
      }
    });
    const relationshipKeys = new Set();
    const relationshipPairs = new Set();
    state.pairRelationships.forEach((relationship) => {
      if (!relationship || !RELATIONSHIP_TYPES.includes(relationship.type)
        || !Array.isArray(relationship.itemIds) || relationship.itemIds.length !== 2
        || relationship.itemIds.join("|") !== [...relationship.itemIds].sort().join("|")
        || !relationship.itemIds.every((itemId) => itemIds.has(itemId))) {
        throw migrationError("INVALID_RELATIONSHIP", "Pair relationships must reference two live items in canonical order.");
      }
      const key = `${relationship.type}:${relationship.itemIds.join("|")}`;
      if (relationshipKeys.has(key)) throw migrationError("DUPLICATE_RELATIONSHIP", `Duplicate pair relationship: ${key}`);
      const pairKey = relationship.itemIds.join("|");
      if (relationshipPairs.has(pairKey)) throw migrationError("CONFLICTING_RELATIONSHIP", `Conflicting pair relationship: ${pairKey}`);
      relationshipKeys.add(key);
      relationshipPairs.add(pairKey);
    });
    return true;
  }

  function createFreshState(now) {
    const timestamp = stringOr(now, new Date().toISOString());
    return migrateAndValidate({
      schemaVersion: SCHEMA_VERSION,
      wardrobe: [], history: [], bannedCombos: [], feedback: [], pairRelationships: [],
      settings: { theme: "system", afterLogging: "confirm_keep", defaultOccasion: "work", weather: { automatic: false, unit: "f", cached: null, legacyManual: null } },
      setup: { completed: false, choice: "" },
      createdAt: timestamp
    }, { now: timestamp }).state;
  }

  function createItem(raw, options) {
    const now = stringOr(options?.now, new Date().toISOString());
    const result = migrateItem({
      category: "top", subtype: "other", primaryColor: "", secondaryColor: "", pattern: "solid",
      sleeveLength: "unspecified", bottomLength: "not_applicable", formality: 3, occasions: ["casual"],
      warmth: "unspecified", rainPolicy: "unspecified", status: "available", preference: "neutral", labels: [],
      layerRoles: ["base"], rainProtection: "unspecified", windProtection: "unspecified",
      review: { status: "reviewed", reasons: [], reviewedAt: now }, legacyFallback: false, legacyMatching: {},
      createdAt: now, updatedAt: now, ...deepClone(raw || {})
    }, SCHEMA_VERSION, now);
    return result.item;
  }

  function applyTemplateToItem(item, subtype) {
    const selected = SUBTYPE_TEMPLATES[subtype];
    if (!selected) return deepClone(item);
    return { ...deepClone(item), ...deepClone(selected), subtype };
  }

  function relationshipType(state, itemA, itemB) {
    const pair = canonicalPair(itemA, itemB);
    return state.pairRelationships.find((record) => record.itemIds.join("|") === pair.join("|"))?.type || "";
  }

  function canWearTogether(itemA, itemB) {
    if (!itemA || !itemB || itemA.id === itemB.id) return false;
    const categoryA = normalizeCategory(itemA.category);
    const categoryB = normalizeCategory(itemB.category);
    if (!CATEGORIES[categoryA] || !CATEGORIES[categoryB]) return false;
    if (categoryA !== categoryB) return true;
    if (categoryA !== "top") return false;
    const rolesA = Array.isArray(itemA.layerRoles) ? itemA.layerRoles : [];
    const rolesB = Array.isArray(itemB.layerRoles) ? itemB.layerRoles : [];
    const aCanBase = rolesA.includes("base");
    const bCanBase = rolesB.includes("base");
    const aCanLayer = rolesA.some((role) => ["mid", "outer"].includes(role));
    const bCanLayer = rolesB.some((role) => ["mid", "outer"].includes(role));
    return (aCanBase && bCanLayer) || (bCanBase && aCanLayer);
  }

  function setRelationship(state, itemA, itemB, type, now) {
    const pair = canonicalPair(itemA, itemB);
    if (pair.length !== 2) return state;
    const next = deepClone(state);
    next.pairRelationships = next.pairRelationships.filter((record) => record.itemIds.join("|") !== pair.join("|"));
    if (RELATIONSHIP_TYPES.includes(type)) {
      next.pairRelationships.push(normalizeRelationship({ type, itemIds: pair, createdAt: now, updatedAt: now }, stringOr(now, new Date().toISOString())));
    }
    return next;
  }

  function semanticCompatibility(items, occasionId, options) {
    const settings = options?.settings || {};
    const relationships = options?.pairRelationships || [];
    const result = { valid: true, score: 0, reasons: [], hardReason: "" };
    if (!items.every((item) => item.occasions.includes(occasionId))) return hardFailure(result, "One or more items exclude this occasion.");
    if (!items.every((item) => item.status === "available")) return hardFailure(result, "One or more items are not available.");
    for (let i = 0; i < items.length; i += 1) {
      for (let j = i + 1; j < items.length; j += 1) {
        if (!canWearTogether(items[i], items[j])) continue;
        const pair = canonicalPair(items[i].id, items[j].id).join("|");
        const relationship = relationships.find((record) => record.itemIds.join("|") === pair);
        if (relationship?.type === "never") return hardFailure(result, `${items[i].name} and ${items[j].name} are set to Never pair.`);
        if (relationship?.type === "prefer") {
          result.score += 16;
          result.reasons.push("Includes a preferred pair.");
        }
      }
    }
    result.score += formalityCompatibility(items, result.reasons);
    result.score += colorCompatibility(items, result.reasons);
    result.score += patternCompatibility(items, result.reasons);
    result.score += subtypeCompatibility(items, result.reasons);
    result.score += lengthCompatibility(items, occasionId, result.reasons);
    result.score += warmthCompatibility(items, result.reasons);
    result.score += beltShoeCompatibility(items, result.reasons);
    result.score += layerCompatibility(items, result.reasons);
    result.score += items.reduce((sum, item) => {
      if (item.id === options?.buildAroundId && item.preference === "avoid") return sum;
      return sum + preferenceScore(item.preference);
    }, 0);
    const legacyResult = legacyCompatibility(items);
    if (!legacyResult.valid) return hardFailure(result, legacyResult.reason);
    result.score += legacyResult.score;
    return result;
  }

  function hardFailure(result, reason) {
    result.valid = false;
    result.hardReason = reason;
    return result;
  }

  function formalityCompatibility(items, reasons) {
    const values = items.map((item) => item.formality);
    const spread = Math.max(...values) - Math.min(...values);
    if (spread <= 1) return 8;
    if (spread === 2) return -6;
    reasons.push("The outfit spans very different formality levels.");
    return -28;
  }

  function itemColors(item) {
    return uniqueStrings(item.pattern === "solid"
      ? [item.primaryColor]
      : [item.primaryColor, item.secondaryColor]);
  }

  function colorCompatibility(items, reasons) {
    const neutrals = new Set(["black", "white", "off-white", "cream", "gray", "charcoal", "dark gray", "navy", "brown", "tan", "khaki"]);
    let score = 0;
    for (let i = 0; i < items.length; i += 1) {
      for (let j = i + 1; j < items.length; j += 1) {
        const pairScores = itemColors(items[i]).flatMap((first) => itemColors(items[j]).map((second) => {
          const a = normalizeToken(first);
          const b = normalizeToken(second);
          if (a === b) return 2;
          if (neutrals.has(a) || neutrals.has(b)) return 4;
          if (isKnownColorPair(a, b)) return 5;
          return -2;
        }));
        if (pairScores.length) score += Math.max(...pairScores);
      }
    }
    if (score < 0) reasons.push("Uses a less conventional color combination.");
    return score;
  }

  function isKnownColorPair(a, b) {
    const key = [a, b].sort().join("|");
    return new Set(["blue|brown", "blue|orange", "burgundy|navy", "green|navy", "navy|olive", "pink|purple", "purple|yellow", "red|white"]).has(key);
  }

  function patternCompatibility(items, reasons) {
    const bold = items.filter((item) => ["striped", "plaid", "graphic", "multicolored"].includes(item.pattern));
    if (bold.length <= 1) return bold.length ? 2 : 4;
    reasons.push("Multiple prominent patterns may compete.");
    return -12 * (bold.length - 1);
  }

  function subtypeCompatibility(items, reasons) {
    const athletic = items.filter((item) => ["athletic top", "athletic shorts", "athletic pants", "athletic/running shoes"].includes(item.subtype));
    const formal = items.filter((item) => item.formality >= 4 || ["dress pants", "dress shoes"].includes(item.subtype));
    if (athletic.length && formal.length) {
      reasons.push("Mixes clearly athletic and formal pieces.");
      return -34;
    }
    return 0;
  }

  function lengthCompatibility(items, occasionId, reasons) {
    const top = items.find((item) => item.category === "top");
    const bottom = items.find((item) => item.category === "bottom");
    if (!top || !bottom) return 0;
    if (["casual", "athletic", "gym"].includes(occasionId) && ["sleeveless", "short"].includes(top.sleeveLength) && bottom.bottomLength === "short") return 3;
    if (top.sleeveLength === "long" && bottom.bottomLength === "short") {
      reasons.push("Combines long sleeves with short bottoms.");
      return -3;
    }
    if (top.sleeveLength === "sleeveless" && bottom.bottomLength === "full") return -2;
    return 0;
  }

  function warmthCompatibility(items, reasons) {
    const scale = { very_light: 1, light: 2, medium: 3, warm: 4, very_warm: 5 };
    const values = items.map((item) => scale[item.warmth]).filter(Boolean);
    if (values.length < 2) return 0;
    const spread = Math.max(...values) - Math.min(...values);
    if (spread <= 1) return 3;
    if (spread >= 3) {
      reasons.push("Garments have very different warmth levels.");
      return -10;
    }
    return -3;
  }

  function beltShoeCompatibility(items, reasons) {
    const belt = items.find((item) => item.category === "belt");
    const shoes = items.find((item) => item.category === "shoes");
    if (!belt || !shoes) return 0;
    const beltColor = normalizeToken(belt.primaryColor);
    const shoeColors = itemColors(shoes).map(normalizeToken);
    if (shoeColors.includes(beltColor)) return 10;
    if ([beltColor, ...shoeColors].every((color) => ["brown", "tan", "khaki"].includes(color))) return 7;
    if (belt.formality >= 4 && shoes.formality >= 4) {
      reasons.push("Dress belt and shoe colors do not coordinate closely.");
      return -12;
    }
    return -2;
  }

  function layerCompatibility(items, reasons) {
    const tops = items.filter((item) => item.category === "top");
    const roleBasedTop = tops.length > 1
      ? tops.slice(1).find((item) => (item.layerRoles || []).some((role) => ["mid", "outer"].includes(role)))
      : null;
    const layer = items.find((item) => item.category === "layer") || roleBasedTop;
    if (!layer) return 0;
    const base = items.filter((item) => item.id !== layer.id);
    const spread = base.length ? Math.max(...base.map((item) => Math.abs(item.formality - layer.formality))) : 0;
    if (spread <= 1) return 8;
    if (spread === 2) return -5;
    reasons.push("The layer is much more or less formal than the base outfit.");
    return -20;
  }

  function preferenceScore(value) {
    return { avoid: -26, neutral: 0, like: 7, favorite: 12 }[value] || 0;
  }

  function legacyCompatibility(items) {
    let score = 0;
    for (const item of items) {
      if (!item.legacyFallback) continue;
      const others = items.filter((other) => other.id !== item.id);
      const signals = new Set(others.flatMap((other) => uniqueStrings([
        other.id, other.name, other.category, other.subtype, other.primaryColor, other.secondaryColor,
        ...(other.legacyMatching?.tags || [])
      ])).map(normalizeToken));
      if ((item.legacyMatching?.avoidWithTags || []).some((tag) => signals.has(normalizeToken(tag)))) {
        return { valid: false, score, reason: `${item.name} retains a legacy Never pair tag until it is reviewed.` };
      }
      score += (item.legacyMatching?.worksWithTags || []).filter((tag) => signals.has(normalizeToken(tag))).length * 5;
    }
    return { valid: true, score, reason: "" };
  }

  function validDateOnly(value) {
    if (!value) return "";
    if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  function validDateTime(value) {
    if (!value) return "";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "" : String(value);
  }

  function nullableNumber(value, min, max) {
    if (value === null || value === undefined || String(value).trim() === "") return null;
    const number = Number(value);
    if (!Number.isFinite(number)) return null;
    return Math.max(min, Math.min(max, Math.round(number)));
  }

  function assertNoSensitiveLocation(value, path = "root", seen = new Set()) {
    if (!value || typeof value !== "object") {
      if (typeof value === "string" && /[?&](latitude|longitude)=/i.test(value)) {
        throw migrationError("PRIVACY_VIOLATION", `Coordinate-bearing URL found at ${path}.`);
      }
      return true;
    }
    if (seen.has(value)) return true;
    seen.add(value);
    for (const [key, child] of Object.entries(value)) {
      if (["latitude", "longitude", "accuracy", "coordinates", "locationhistory", "providerurl", "weatherurl"].includes(normalizeToken(key).replace(/[^a-z]/g, ""))) {
        throw migrationError("PRIVACY_VIOLATION", `Sensitive location field found at ${path}.${key}.`);
      }
      assertNoSensitiveLocation(child, `${path}.${key}`, seen);
    }
    return true;
  }

  function stableToken(seed, value) {
    const text = `${seed}|${value || "record"}`;
    let hash = 2166136261;
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
  }

  function titleCase(value) {
    return String(value || "").replace(/(^|[\s/-])\w/g, (letter) => letter.toUpperCase()).replace(/_/g, " ");
  }

  function migrationError(code, message) {
    const error = new Error(message);
    error.code = code;
    return error;
  }

  return {
    SCHEMA_VERSION,
    RECOVERY_KEY,
    LEGACY_RECOVERY_KEY,
    RECOVERY_PREFIX,
    CATEGORIES,
    CATEGORY_ORDER,
    COLOR_PALETTE,
    SUBTYPES,
    SUBTYPE_TEMPLATES,
    FORMALITY_LABELS,
    PATTERNS,
    SLEEVE_LENGTHS,
    BOTTOM_LENGTHS,
    WARMTH_LEVELS,
    RAIN_POLICIES,
    LAYER_ROLES,
    PROTECTION_LEVELS,
    STATUSES,
    PREFERENCES,
    migrateAndValidate,
    validateState,
    createFreshState,
    createItem,
    applyTemplateToItem,
    canonicalPair,
    relationshipType,
    setRelationship,
    canWearTogether,
    semanticCompatibility,
    itemColors,
    normalizeCategory,
    normalizeToken,
    uniqueStrings,
    titleCase,
    assertNoSensitiveLocation
  };
});
