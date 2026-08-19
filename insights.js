(function (root, factory) {
  const smartCloset = root?.FitRouletteSmartCloset
    || (typeof require === "function" ? require("./smart-closet.js") : null);
  const contextEngine = root?.FitRouletteContextEngine
    || (typeof require === "function" ? require("./context-engine.js") : null);
  const api = factory(smartCloset, contextEngine);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FitRouletteInsights = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (SmartCloset, ContextEngine) {
  "use strict";

  const ANALYSIS_VERSION = 1;
  const COVERAGE_TUPLE_LIMIT = 50000;
  const RANGE_VALUES = ["30", "90", "all"];
  const CANONICAL_COLORS = new Set((SmartCloset?.COLOR_PALETTE || []).map(normalizeToken));
  const CATEGORY_LABELS = SmartCloset?.CATEGORIES || {};
  const STATUS_LABELS = { available: "Currently Available", unavailable: "Unavailable", archived: "Archived" };
  const SOURCE_LABELS = { manual: "Manual", generated: "Generated" };

  function analyzeInsights(state, options = {}) {
    const now = validNow(options.now);
    const range = RANGE_VALUES.includes(String(options.range)) ? String(options.range) : "all";
    return {
      analysisVersion: ANALYSIS_VERSION,
      generatedForDate: localDateKey(now),
      range,
      readiness: analyzeDataReadiness(state, { now }),
      composition: analyzeComposition(state, { scope: options.scope || "all" }),
      activity: analyzeLoggedActivity(state, { now, range })
    };
  }

  function analyzeDataReadiness(state, options = {}) {
    const safeState = stateObject(state);
    const now = validNow(options.now);
    const wardrobe = arrayOrEmpty(safeState.wardrobe);
    const history = arrayOrEmpty(safeState.history);
    const liveById = new Map(wardrobe.map((item) => [String(item?.id || ""), item]));
    const status = countEnum(wardrobe, (item) => item?.status, ["available", "unavailable", "archived"]);
    const reviewed = wardrobe.filter((item) => item?.review?.status === "reviewed").length;
    const needsReview = wardrobe.filter((item) => item?.review?.status === "needs_review").length;
    const legacyFallback = wardrobe.filter((item) => item?.legacyFallback === true).length;
    const unresolvedRecords = countUnresolvedRecords(safeState);
    const customColorItems = wardrobe.filter(hasCustomColor).length;

    let validDateCount = 0;
    let invalidDateCount = 0;
    let futureDateCount = 0;
    let earliest = null;
    let latest = null;
    const loggedDays = new Set();
    let logsWithUsableSnapshots = 0;
    let snapshotCompleteLogs = 0;
    let currentFallbackLogs = 0;
    let brokenReferenceCount = 0;
    let contextLogs = 0;
    let ignoredContextLogs = 0;
    let manualWithoutContext = 0;

    history.forEach((record) => {
      const date = normalizeHistoryDate(record?.date, now);
      if (!date.valid) invalidDateCount += 1;
      else if (date.future) futureDateCount += 1;
      else {
        validDateCount += 1;
        loggedDays.add(date.dateKey);
        if (!earliest || date.epochDay < earliest.epochDay) earliest = date;
        if (!latest || date.epochDay > latest.epochDay) latest = date;
      }

      const ids = uniqueItemIds(record);
      const resolutions = ids.map((id) => resolveHistoricalItem(record, id, liveById));
      if (resolutions.some((entry) => entry.source === "snapshot")) logsWithUsableSnapshots += 1;
      if (ids.length && resolutions.every((entry) => entry.source === "snapshot")) snapshotCompleteLogs += 1;
      if (resolutions.some((entry) => entry.source === "current")) currentFallbackLogs += 1;
      brokenReferenceCount += resolutions.filter((entry) => entry.source === "unresolved").length;

      if (record?.context && typeof record.context === "object") {
        contextLogs += 1;
        if (record.context.source === "ignored") ignoredContextLogs += 1;
      } else if (record?.source === "manual") {
        manualWithoutContext += 1;
      }
    });

    const manual = history.filter((record) => record?.source === "manual").length;
    const generated = history.length - manual;
    return {
      currentCloset: {
        total: wardrobe.length,
        available: status.available,
        unavailable: status.unavailable,
        archived: status.archived,
        reviewed,
        needsReview,
        legacyFallback,
        unresolvedRecords,
        customColorItems,
        availableReviewText: status.available
          ? `${wardrobe.filter((item) => item?.status === "available" && item?.review?.status === "needs_review").length} of ${status.available} available garments still need review.`
          : "No garments are currently available."
      },
      history: {
        totalLogs: history.length,
        usableDateLogs: validDateCount,
        loggedDays: loggedDays.size,
        earliestDate: earliest?.dateKey || "",
        latestDate: latest?.dateKey || "",
        manual,
        generated,
        legacySourceCaveat: generated > 0,
        logsWithUsableSnapshots,
        snapshotCompleteLogs,
        currentFallbackLogs,
        brokenReferenceCount,
        contextLogs,
        ignoredContextLogs,
        manualWithoutContext,
        futureDateCount,
        invalidDateCount,
        evidenceText: history.length
          ? `Based on ${history.length} logged outfit${history.length === 1 ? "" : "s"} across ${loggedDays.size} logged day${loggedDays.size === 1 ? "" : "s"}.`
          : "No logged outfits are available yet.",
        contextText: history.length
          ? `Weather context is available for ${contextLogs} of ${history.length} logs.`
          : "No logged context is available.",
        limitations: compactStrings([
          generated > 0 ? "Some older records may have been normalized as generated." : "",
          manualWithoutContext > 0 ? "Manual logs may not include weather context." : "",
          futureDateCount > 0 ? `${futureDateCount} future-dated record${futureDateCount === 1 ? " is" : "s are"} excluded from time calculations.` : "",
          invalidDateCount > 0 ? `${invalidDateCount} record${invalidDateCount === 1 ? " has" : "s have"} an invalid date and is excluded from time calculations.` : "",
          brokenReferenceCount > 0 ? `${brokenReferenceCount} logged garment reference${brokenReferenceCount === 1 ? " is" : "s are"} unresolved.` : ""
        ])
      },
      dataQuality: {
        customColorText: customColorItems
          ? `Custom colors are counted by their saved names for ${customColorItems} garment${customColorItems === 1 ? "" : "s"}.`
          : "All saved colors use the canonical color list.",
        blankDateText: "A blank day means no outfit was logged, not that no outfit was used."
      }
    };
  }

  function analyzeComposition(state, options = {}) {
    const safeState = stateObject(state);
    const allItems = arrayOrEmpty(safeState.wardrobe);
    const scope = options.scope === "available" ? "available" : "all";
    const items = scope === "available" ? allItems.filter((item) => item?.status === "available") : allItems;
    const denominatorLabel = scope === "available" ? "Currently Available" : "All current garments";
    const itemIds = new Set(items.map((item) => String(item?.id || "")));
    const relationships = arrayOrEmpty(safeState.pairRelationships)
      .filter((relationship) => arrayOrEmpty(relationship?.itemIds).every((id) => itemIds.has(String(id))));

    return {
      scope,
      denominator: items.length,
      denominatorLabel,
      status: breakdown(allItems, (item) => [item?.status], (value) => STATUS_LABELS[value] || titleCase(value)),
      review: breakdown(items, (item) => [item?.review?.status || "unknown"], (value) => value === "needs_review" ? "Needs review" : value === "reviewed" ? "Reviewed" : "Unknown"),
      category: breakdown(items, (item) => [item?.category], (value) => CATEGORY_LABELS[value] || titleCase(value)),
      subtype: breakdown(items, (item) => [item?.subtype], titleCase),
      primaryColor: breakdown(items, (item) => [cleanString(item?.primaryColor) || "Unspecified"], identity),
      secondaryColor: breakdown(items, (item) => item?.pattern !== "solid" && cleanString(item?.secondaryColor) ? [cleanString(item.secondaryColor)] : [], identity),
      colorFamily: breakdown(items, (item) => {
        const colors = [item?.primaryColor, item?.pattern !== "solid" ? item?.secondaryColor : ""].map(cleanString).filter(Boolean);
        return colors.map((color) => CANONICAL_COLORS.has(normalizeToken(color)) ? titleCase(normalizeToken(color)) : "Custom / Unclassified");
      }, identity),
      pattern: breakdown(items, (item) => [item?.pattern], titleCase),
      formality: breakdown(items, (item) => [Number.isInteger(item?.formality) ? String(item.formality) : "unknown"], (value) => value === "unknown" ? "Unknown" : `${value}. ${SmartCloset?.FORMALITY_LABELS?.[value] || "Formality"}`),
      occasion: breakdown(items, (item) => arrayOrEmpty(item?.occasions), occasionLabel),
      layerRole: breakdown(items, (item) => arrayOrEmpty(item?.layerRoles), titleCase),
      warmth: breakdown(items, (item) => [item?.warmth], titleCase),
      rainProtection: breakdown(items, (item) => [item?.rainProtection], protectionLabel),
      windProtection: breakdown(items, (item) => [item?.windProtection], protectionLabel),
      preference: breakdown(items, (item) => [item?.preference], titleCase),
      pairRules: {
        total: relationships.length,
        prefer: relationships.filter((relationship) => relationship?.type === "prefer").length,
        never: relationships.filter((relationship) => relationship?.type === "never").length,
        denominatorLabel
      },
      limitations: compactStrings([
        "Counts describe current inventory, not closet quality.",
        items.some(hasCustomColor) ? "Custom colors remain exact saved strings and are not assigned an invented color family." : "",
        items.some((item) => item?.review?.status === "needs_review") ? "Some metadata is incomplete." : ""
      ])
    };
  }

  function analyzeLoggedActivity(state, options = {}) {
    const safeState = stateObject(state);
    const now = validNow(options.now);
    const today = normalizeHistoryDate(localDateKey(now), now);
    const range = RANGE_VALUES.includes(String(options.range)) ? String(options.range) : "all";
    const wardrobe = arrayOrEmpty(safeState.wardrobe);
    const liveById = new Map(wardrobe.map((item) => [String(item?.id || ""), item]));
    const prepared = arrayOrEmpty(safeState.history).map((record, index) => ({ record, index, date: normalizeHistoryDate(record?.date, now) }));
    const selected = prepared.filter((entry) => entry.date.valid && !entry.date.future && dateInRange(entry.date, today, range));
    const sortedNewest = [...selected].sort((a, b) => b.date.epochDay - a.date.epochDay || a.index - b.index);
    const loggedDays = new Set(selected.map((entry) => entry.date.dateKey));
    const itemCounts = new Map();
    const lastDates = new Map();
    const identityById = new Map();
    const categoryCounts = new Map();
    let unresolvedCategories = 0;
    const exactOutfits = new Map();
    const pairs = new Map();

    sortedNewest.forEach((entry) => {
      const ids = uniqueItemIds(entry.record);
      const signature = ids.slice().sort().join("|");
      if (signature) {
        const existing = exactOutfits.get(signature) || { signature, count: 0, itemIds: ids.slice().sort() };
        existing.count += 1;
        exactOutfits.set(signature, existing);
      }
      ids.forEach((id) => {
        itemCounts.set(id, (itemCounts.get(id) || 0) + 1);
        if (!lastDates.has(id) || entry.date.epochDay > lastDates.get(id).epochDay) lastDates.set(id, entry.date);
        const occurrence = resolveHistoricalItem(entry.record, id, liveById);
        if (!identityById.has(id)) identityById.set(id, occurrenceIdentity(occurrence, id));
        const category = cleanString(occurrence.item?.category);
        if (category) categoryCounts.set(category, (categoryCounts.get(category) || 0) + 1);
        else unresolvedCategories += 1;
      });
      for (let first = 0; first < ids.length; first += 1) {
        for (let second = first + 1; second < ids.length; second += 1) {
          const pairIds = [ids[first], ids[second]].sort();
          const key = pairIds.join("|");
          const existing = pairs.get(key) || { itemIds: pairIds, count: 0 };
          existing.count += 1;
          pairs.set(key, existing);
        }
      }
    });

    const available = wardrobe.filter((item) => item?.status === "available");
    const garmentActivity = available.map((item) => {
      const id = String(item?.id || "");
      const count = itemCounts.get(id) || 0;
      const last = lastDates.get(id) || null;
      const legacy = count === 0 ? normalizeHistoryDate(item?.lastWorn, now) : null;
      const days = last ? today.epochDay - last.epochDay : null;
      return {
        id,
        name: cleanString(item?.name) || "Unnamed garment",
        count,
        countText: count ? `Appears in ${count} logged outfit${count === 1 ? "" : "s"}.` : "No logged appearances in this range.",
        lastLoggedDate: last?.dateKey || "",
        daysSinceLastLogged: days,
        lastLoggedText: last ? `Last logged ${days} day${days === 1 ? "" : "s"} ago.` : "Not logged in this range.",
        legacyLastWorn: legacy?.valid && !legacy.future ? legacy.dateKey : "",
        legacyLimitation: legacy?.valid && !legacy.future ? "Lower-confidence legacy recency; no applicable history record exists in this range." : ""
      };
    }).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name) || a.id.localeCompare(b.id));

    const counts = garmentActivity.map((item) => item.count);
    const mostCount = counts.length ? Math.max(...counts) : 0;
    const leastCount = counts.length ? Math.min(...counts) : 0;
    const appearsAvailable = garmentActivity.filter((item) => item.count > 0).length;
    const invalidDates = prepared.filter((entry) => !entry.date.valid).length;
    const futureDates = prepared.filter((entry) => entry.date.valid && entry.date.future).length;
    const statusContribution = { available: 0, unavailable: 0, archived: 0, unresolved: 0 };
    selected.forEach((entry) => uniqueItemIds(entry.record).forEach((id) => {
      const status = liveById.get(id)?.status;
      if (Object.hasOwn(statusContribution, status)) statusContribution[status] += 1;
      else statusContribution.unresolved += 1;
    }));

    return {
      range,
      rangeLabel: range === "all" ? "All logged history" : `Last ${range} days`,
      totalLoggedOutfits: selected.length,
      loggedDays: loggedDays.size,
      evidenceText: `Based on ${selected.length} logged outfit${selected.length === 1 ? "" : "s"} across ${loggedDays.size} logged day${loggedDays.size === 1 ? "" : "s"}.`,
      garmentActivity,
      mostLogged: garmentActivity.filter((item) => item.count === mostCount),
      leastLogged: garmentActivity.filter((item) => item.count === leastCount),
      exactRepetition: [...exactOutfits.values()].filter((entry) => entry.count > 1).map((entry) => ({ ...entry, labels: entry.itemIds.map((id) => identityById.get(id)?.name || liveById.get(id)?.name || "Unresolved garment") })).sort((a, b) => b.count - a.count || a.signature.localeCompare(b.signature)),
      coWear: [...pairs.values()].map((entry) => ({ ...entry, labels: entry.itemIds.map((id) => identityById.get(id)?.name || liveById.get(id)?.name || "Unresolved garment") })).sort((a, b) => b.count - a.count || a.itemIds.join("|").localeCompare(b.itemIds.join("|"))),
      occasion: breakdown(selected, (entry) => [entry.record?.occasion || "unknown"], occasionLabel),
      source: breakdown(selected, (entry) => [entry.record?.source === "manual" ? "manual" : "generated"], (value) => SOURCE_LABELS[value]),
      categoryUse: [...categoryCounts.entries()].map(([key, count]) => ({ key, label: CATEGORY_LABELS[key] || titleCase(key), count })).sort(stableCountSort),
      unresolvedCategoryAppearances: unresolvedCategories,
      layerLoggedAppearances: categoryCounts.get("layer") || 0,
      beltLoggedAppearances: categoryCounts.get("belt") || 0,
      sockLoggedAppearances: categoryCounts.get("socks") || 0,
      context: {
        contextLogs: selected.filter((entry) => entry.record?.context && typeof entry.record.context === "object").length,
        ignoredLogs: selected.filter((entry) => entry.record?.context?.source === "ignored").length,
        source: breakdown(selected.filter((entry) => entry.record?.context), (entry) => [entry.record.context.source], (value) => value === "ignored" ? "Weather ignored" : titleCase(value))
      },
      currentUtilization: { numerator: appearsAvailable, denominator: available.length, text: `${appearsAvailable} of ${available.length} currently available garments appear in the selected logged history.` },
      currentStatusContribution: statusContribution,
      excludedDateRecords: { invalid: invalidDates, future: futureDates },
      limitations: compactStrings([
        `Active range: ${range === "all" ? "All logged history" : `Last ${range} days`}.`,
        "These counts describe explicitly logged history.",
        "A blank day means no outfit was logged, not that no outfit was used.",
        selected.some((entry) => entry.record?.source !== "manual") ? "Some older records may have been normalized as generated." : "",
        futureDates ? `${futureDates} future-dated record${futureDates === 1 ? " is" : "s are"} excluded.` : "",
        invalidDates ? `${invalidDates} invalid-date record${invalidDates === 1 ? " is" : "s are"} excluded.` : ""
      ])
    };
  }

  function analyzeCoverage(state, options = {}) {
    const safeState = stateObject(state);
    const occasion = options.occasion && typeof options.occasion === "object" ? options.occasion : null;
    const occasionId = cleanString(occasion?.id);
    const tupleLimit = Math.max(1, Math.min(COVERAGE_TUPLE_LIMIT, Number(options.tupleLimit) || COVERAGE_TUPLE_LIMIT));
    const wardrobe = arrayOrEmpty(safeState.wardrobe);
    const active = wardrobe.filter((item) => item?.status === "available" && arrayOrEmpty(item?.occasions).includes(occasionId)).sort(stableItemSort);
    const buildAroundId = cleanString(options.buildAroundId);
    const buildAround = buildAroundId ? active.find((item) => String(item?.id) === buildAroundId) : null;
    const context = normalizeCoverageContext(options.context);
    const requiredSlotInventory = arrayOrEmpty(occasion?.slots).map((slot) => ({ key: cleanString(slot?.key), label: cleanString(slot?.label) || titleCase(slot?.key), count: active.filter((item) => arrayOrEmpty(slot?.categories).includes(item?.category) && (slot?.key !== "top" || arrayOrEmpty(item?.layerRoles).includes("base"))).length }));
    const missingRequiredSlots = requiredSlotInventory.filter((slot) => slot.count === 0 && slot.key !== "belt");
    const baseTops = active.filter((item) => item?.category === "top" && arrayOrEmpty(item?.layerRoles).includes("base"));
    const bottoms = active.filter((item) => item?.category === "bottom");
    const shoes = active.filter((item) => item?.category === "shoes");
    const belts = active.filter((item) => item?.category === "belt");
    const socks = active.filter((item) => item?.category === "socks");
    const accessories = active.filter((item) => item?.category === "accessory");
    const layers = active.filter((item) => ["top", "layer"].includes(item?.category) && arrayOrEmpty(item?.layerRoles).some((role) => ["mid", "outer"].includes(role)));
    const neverPairs = new Set(arrayOrEmpty(safeState.pairRelationships).filter((record) => record?.type === "never").map((record) => pairKey(record?.itemIds)));
    const banned = new Set(arrayOrEmpty(safeState.bannedCombos).map((record) => outfitKey(record?.itemIds)));
    const validSignatures = new Set();
    const itemCounts = new Map();
    let attemptedTuples = 0;
    let incompleteSockCandidates = 0;
    let capped = false;

    if (occasionId && occasion && !missingRequiredSlots.length && (!buildAroundId || buildAround)) {
      outer:
      for (const top of baseTops) {
        for (const bottom of bottoms) {
          for (const shoe of shoes) {
            const beltChoices = coverageBelts(bottom, belts, buildAround);
            const accessoryChoices = coverageAccessories(occasion, accessories, buildAround);
            for (const belt of beltChoices) for (const accessory of accessoryChoices) {
              const withoutSocksOrLayer = uniqueItems([top, bottom, shoe, belt, accessory].filter(Boolean));
              const sockResolution = coverageSockChoices(withoutSocksOrLayer, shoe, socks, buildAround, occasionId, bottom, neverPairs, banned);
              if (sockResolution.fallback) incompleteSockCandidates += 1;
              for (const sock of sockResolution.choices) {
                const withoutLayer = uniqueItems([...withoutSocksOrLayer, sock].filter(Boolean));
                const layerChoices = coverageLayers(withoutLayer, layers, buildAround, context);
                for (const layer of layerChoices) {
                  if (attemptedTuples >= tupleLimit) { capped = true; break outer; }
                  attemptedTuples += 1;
                  const items = uniqueItems([...withoutLayer, layer].filter(Boolean));
                  if (buildAroundId && !items.some((item) => String(item?.id) === buildAroundId)) continue;
                  if (!coverageCompatible(items, occasionId, bottom, neverPairs, banned)) continue;
                  const signature = outfitKey(items.map((item) => item.id));
                  if (validSignatures.has(signature)) continue;
                  validSignatures.add(signature);
                  items.forEach((item) => itemCounts.set(String(item.id), (itemCounts.get(String(item.id)) || 0) + 1));
                }
              }
            }
          }
        }
      }
    }

    const exact = !capped;
    const validCount = validSignatures.size;
    const eligibleBuildAround = active
      .filter((item) => !buildAroundId || String(item?.id || "") === buildAroundId)
      .map((item) => ({ id: String(item?.id || ""), name: cleanString(item?.name) || "Unnamed garment", count: itemCounts.get(String(item?.id || "")) || 0 }));
    const lowBuildAround = exact ? eligibleBuildAround.filter((item) => item.count <= 2).sort((a, b) => a.count - b.count || a.name.localeCompare(b.name) || a.id.localeCompare(b.id)) : [];
    return {
      occasionId,
      occasionLabel: cleanString(occasion?.label) || occasionId,
      buildAroundId,
      buildAroundName: buildAround ? cleanString(buildAround.name) : "",
      contextLabel: context.coverageLabel,
      tupleLimit,
      attemptedTuples,
      validCount,
      capped,
      countText: capped ? `At least ${validCount} valid combination${validCount === 1 ? "" : "s"}.` : `${validCount} valid combination${validCount === 1 ? "" : "s"}.`,
      capText: capped ? "Analysis capped for performance." : "Exact count within the analysis budget.",
      requiredSlotInventory,
      missingRequiredSlots,
      incompleteSockCandidates,
      lowBuildAround,
      evidenceType: "Current compatibility analysis",
      metadataLimitations: { needsReview: active.filter((item) => item?.review?.status === "needs_review").length, legacyFallback: active.filter((item) => item?.legacyFallback === true).length, unresolvedRecords: countUnresolvedRecords(safeState) },
      limitations: compactStrings([
        "Uses current inventory, availability, occasion eligibility, pair exclusions, exact bans, belt rules, sock reconciliation, and the released single-layer model.",
        "Physical layer fit is not modeled.",
        capped ? "Counts for individual Build Around garments are lower bounds and are not classified as zero or few." : "",
        incompleteSockCandidates ? `${incompleteSockCandidates} incomplete sock candidate${incompleteSockCandidates === 1 ? " was" : "s were"} not counted as valid combinations.` : "",
        active.some((item) => item?.review?.status === "needs_review") ? "Some metadata is incomplete." : ""
      ])
    };
  }

  function evaluateCloset(state, options = {}) {
    const now = validNow(options.now);
    const readiness = analyzeDataReadiness(state, { now });
    const composition = analyzeComposition(state, { scope: "available" });
    const activity = analyzeLoggedActivity(state, { now, range: options.range || "all" });
    const coverage = options.coverage || null;
    const available = arrayOrEmpty(stateObject(state).wardrobe).filter((item) => item?.status === "available");
    const formalities = available.map((item) => Number(item?.formality)).filter(Number.isFinite);
    const rainProtection = available.filter((item) => ["light", "protected"].includes(item?.rainProtection)).length;
    const windProtection = available.filter((item) => ["light", "protected"].includes(item?.windProtection)).length;
    const sufficient = Boolean(coverage && !coverage.capped && coverage.validCount > 0 && !coverage.missingRequiredSlots.length);
    return {
      label: "Closet Evaluation",
      cards: [
        { type: "Metadata", title: "Data readiness", value: `${readiness.currentCloset.reviewed} reviewed · ${readiness.currentCloset.needsReview} need review`, evidence: readiness.currentCloset.availableReviewText, limitation: "Review readiness describes metadata, not garment quality." },
        { type: "Inventory", title: "Formality range", value: formalities.length ? `${Math.min(...formalities)} to ${Math.max(...formalities)}` : "No currently available formality data", evidence: `Based on ${formalities.length} currently available garment${formalities.length === 1 ? "" : "s"}.`, limitation: "A wider range is not inherently better." },
        { type: "Inventory", title: "Weather properties", value: `${rainProtection} rain-protective · ${windProtection} wind-protective`, evidence: `Based on ${available.length} currently available garments.`, limitation: "This describes saved properties, not a need or safety guarantee." },
        { type: "Logged-history evidence", title: "Current logged utilization", value: activity.currentUtilization.text, evidence: activity.evidenceText, limitation: "Unlogged use is not represented." },
        { type: "Compatibility", title: "Selected current coverage", value: coverage ? coverage.countText : "Run Current Coverage to include compatibility evidence.", evidence: coverage ? `${coverage.occasionLabel} · ${coverage.contextLabel}` : "No compatibility analysis supplied.", limitation: coverage ? coverage.limitations.join(" ") : "Coverage is computed only on request." }
      ],
      conclusion: sufficient ? "Current coverage appears sufficient for the selected needs." : coverage ? "The selected analysis shows current inventory or compatibility constraints; it does not imply a purchase recommendation." : "Run Current Coverage to evaluate a selected occasion and context.",
      limitations: ["No overall grade is produced.", "Results do not change matching or generation.", ...composition.limitations]
    };
  }

  function normalizeHistoryDate(value, now = new Date()) {
    const comparisonNow = validNow(now);
    const text = cleanString(value);
    if (!text) return invalidDateResult(text);
    const date = /^\d{4}-\d{2}-\d{2}$/.test(text) ? new Date(`${text}T12:00:00`) : new Date(text);
    if (Number.isNaN(date.getTime())) return invalidDateResult(text);
    const dateKey = localDateKey(date);
    if (!validDateKey(dateKey)) return invalidDateResult(text);
    const epochDay = epochDayFromKey(dateKey);
    return { raw: text, valid: true, future: epochDay > epochDayFromKey(localDateKey(comparisonNow)), dateKey, epochDay };
  }

  function resolveHistoricalItem(record, itemId, liveById) {
    const id = String(itemId || "");
    const snapshot = arrayOrEmpty(record?.itemSnapshots).find((item) => String(item?.id || "") === id && usableSnapshot(item));
    if (snapshot) return { id, source: "snapshot", item: snapshot };
    const live = liveById instanceof Map ? liveById.get(id) : null;
    if (live) return { id, source: "current", item: live };
    return { id, source: "unresolved", item: null };
  }

  function uniqueItemIds(record) {
    const seen = new Set();
    return arrayOrEmpty(record?.itemIds || record?.items).map((value) => String(value || "").trim()).filter((value) => {
      if (!value || seen.has(value)) return false;
      seen.add(value);
      return true;
    });
  }

  function coverageCompatible(items, occasionId, bottom, neverPairs, banned) {
    if (!items.length || banned.has(outfitKey(items.map((item) => item?.id)))) return false;
    const belts = items.filter((item) => item?.category === "belt");
    if (bottom?.beltMode === "none" && belts.length) return false;
    if (bottom?.beltMode === "required" && !belts.length) return false;
    for (let first = 0; first < items.length; first += 1) for (let second = first + 1; second < items.length; second += 1) if (neverPairs.has(pairKey([items[first]?.id, items[second]?.id]))) return false;
    return SmartCloset?.semanticCompatibility ? SmartCloset.semanticCompatibility(items, occasionId, { pairRelationships: [], buildAroundId: "" }).valid : true;
  }

  function coverageBelts(bottom, belts, buildAround) {
    if (bottom?.beltMode === "none") return buildAround?.category === "belt" ? [] : [null];
    if (buildAround?.category === "belt") return [buildAround];
    if (bottom?.beltMode === "required") return belts;
    return [null, ...belts];
  }

  function coverageSockChoices(baseItems, shoes, socks, buildAround, occasionId, bottom, neverPairs, banned) {
    if (footwearSockMode(shoes) === "sockless") {
      return { choices: buildAround?.category === "socks" ? [] : [null], fallback: false };
    }
    if (buildAround?.category === "socks") {
      const compatible = coverageCompatible([...baseItems, buildAround], occasionId, bottom, neverPairs, banned);
      return { choices: compatible ? [buildAround] : [], fallback: false };
    }
    const compatible = socks.filter((sock) => coverageCompatible([...baseItems, sock], occasionId, bottom, neverPairs, banned));
    return compatible.length ? { choices: compatible, fallback: false } : { choices: [null], fallback: true };
  }

  function coverageAccessories(occasion, accessories, buildAround) {
    if (buildAround?.category === "accessory") return [buildAround];
    return arrayOrEmpty(occasion?.optionalSlots).some((slot) => arrayOrEmpty(slot?.categories).includes("accessory")) ? [null, ...accessories] : [null];
  }

  function coverageLayers(baseItems, layers, buildAround, context) {
    const buildIsLayer = buildAround && (buildAround.category === "layer" || (buildAround.category === "top" && !arrayOrEmpty(buildAround.layerRoles).includes("base") && arrayOrEmpty(buildAround.layerRoles).some((role) => ["mid", "outer"].includes(role))));
    if (buildIsLayer) return [buildAround];
    const selectedIds = new Set(arrayOrEmpty(baseItems).map((item) => String(item?.id || "")));
    const eligibleLayers = layers.filter((item) => !selectedIds.has(String(item?.id || "")));
    return ContextEngine?.shouldConsiderLayer?.(baseItems, context) ? [null, ...eligibleLayers] : [null];
  }

  function normalizeCoverageContext(value) {
    if (value && typeof value === "object" && !Array.isArray(value)) return { ...value, coverageLabel: cleanString(value.coverageLabel) || "Selected context" };
    return { active: false, ignored: false, source: "none", effectiveTemperatureC: null, condition: "unknown", precipitationBucket: "none", windBucket: "calm", exposure: "outdoors", rainExpected: false, coverageLabel: "Neutral context" };
  }

  function coverageContextPreset(value) {
    const preset = cleanString(value) || "neutral";
    const base = normalizeCoverageContext();
    if (preset === "cold") return { ...base, active: true, source: "manual", effectiveTemperatureC: 4, condition: "clear", coverageLabel: "Cold, mostly outdoors" };
    if (preset === "rain") return { ...base, active: true, source: "manual", effectiveTemperatureC: 12, condition: "rain", precipitationBucket: "light", rainExpected: true, coverageLabel: "Rain expected" };
    if (preset === "wind") return { ...base, active: true, source: "manual", effectiveTemperatureC: 12, condition: "wind", windBucket: "windy", coverageLabel: "Windy, mostly outdoors" };
    if (preset === "hot") return { ...base, active: true, source: "manual", effectiveTemperatureC: 30, condition: "clear", coverageLabel: "Hot, mostly outdoors" };
    return base;
  }

  function footwearSockMode(shoes) { return normalizeToken(shoes?.subtype) === "sandals" ? "sockless" : "required"; }

  function breakdown(items, valuesFor, labelFor) {
    const counts = new Map();
    arrayOrEmpty(items).forEach((item) => [...new Set(arrayOrEmpty(valuesFor(item)).map((value) => cleanString(value) || "Unspecified"))].forEach((value) => counts.set(value, (counts.get(value) || 0) + 1)));
    return [...counts.entries()].map(([key, count]) => ({ key, label: labelFor(key), count })).sort(stableCountSort);
  }

  function countEnum(items, getter, values) {
    const result = Object.fromEntries(values.map((value) => [value, 0]));
    arrayOrEmpty(items).forEach((item) => { const value = getter(item); if (Object.hasOwn(result, value)) result[value] += 1; });
    return result;
  }

  function countUnresolvedRecords(state) {
    const unresolved = state?.unresolvedRecords && typeof state.unresolvedRecords === "object" ? state.unresolvedRecords : {};
    return Object.values(unresolved).reduce((sum, records) => sum + arrayOrEmpty(records).length, 0) + arrayOrEmpty(state?.unresolvedPairRelationships).length;
  }

  function hasCustomColor(item) {
    return [item?.primaryColor, item?.pattern !== "solid" ? item?.secondaryColor : ""].map(cleanString).filter(Boolean).some((color) => !CANONICAL_COLORS.has(normalizeToken(color)));
  }

  function usableSnapshot(item) {
    return Boolean(item && typeof item === "object" && !Array.isArray(item) && cleanString(item.id) && ["name", "category", "subtype", "primaryColor", "formality", "occasions", "pattern"].some((key) => item[key] !== undefined && item[key] !== null && item[key] !== ""));
  }

  function occurrenceIdentity(occurrence, id) { return { id, name: cleanString(occurrence.item?.name) || "Unresolved garment", source: occurrence.source }; }
  function dateInRange(date, today, range) { const difference = today.epochDay - date.epochDay; return range === "all" || (difference >= 0 && difference < Number(range)); }
  function invalidDateResult(raw) { return { raw, valid: false, future: false, dateKey: "", epochDay: null }; }
  function validNow(value) { const date = value instanceof Date ? new Date(value.getTime()) : new Date(value || Date.now()); return Number.isNaN(date.getTime()) ? new Date() : date; }
  function localDateKey(date) { const value = date instanceof Date ? date : new Date(date); return Number.isNaN(value.getTime()) ? "" : `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`; }
  function validDateKey(value) { if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false; const [year, month, day] = value.split("-").map(Number); const check = new Date(`${value}T12:00:00`); return !Number.isNaN(check.getTime()) && check.getFullYear() === year && check.getMonth() + 1 === month && check.getDate() === day; }
  function epochDayFromKey(value) { const [year, month, day] = String(value).split("-").map(Number); return Math.floor(Date.UTC(year, month - 1, day) / 86400000); }
  function pairKey(ids) { return [...new Set(arrayOrEmpty(ids).map((id) => String(id || "")).filter(Boolean))].sort().join("|"); }
  function outfitKey(ids) { return pairKey(ids); }
  function uniqueItems(items) { const seen = new Set(); return arrayOrEmpty(items).filter((item) => { const id = String(item?.id || ""); if (!id || seen.has(id)) return false; seen.add(id); return true; }); }
  function compactStrings(values) { return arrayOrEmpty(values).map(cleanString).filter(Boolean); }
  function arrayOrEmpty(value) { return Array.isArray(value) ? value : []; }
  function stateObject(value) { return value && typeof value === "object" && !Array.isArray(value) ? value : {}; }
  function cleanString(value) { return String(value ?? "").trim(); }
  function normalizeToken(value) { return cleanString(value).toLowerCase().replace(/\s+/g, " "); }
  function identity(value) { return String(value); }
  function titleCase(value) { return cleanString(value).replace(/_/g, " ").replace(/(^|[\s/-])\w/g, (letter) => letter.toUpperCase()); }
  function occasionLabel(value) { return { work: "Work / Office", friday: "Friday Jeans", casual: "Casual", date: "Date", athletic: "Athletic", gym: "Legacy Gym / Errands", unknown: "Unknown" }[value] || titleCase(value); }
  function protectionLabel(value) { return value === "protected" ? "Protective" : titleCase(value); }
  function stableItemSort(first, second) { return String(first?.id || "").localeCompare(String(second?.id || "")); }
  function stableCountSort(first, second) { return second.count - first.count || String(first.label).localeCompare(String(second.label)) || String(first.key).localeCompare(String(second.key)); }

  return {
    ANALYSIS_VERSION,
    COVERAGE_TUPLE_LIMIT,
    RANGE_VALUES,
    analyzeInsights,
    analyzeDataReadiness,
    analyzeComposition,
    analyzeLoggedActivity,
    analyzeCoverage,
    evaluateCloset,
    normalizeHistoryDate,
    resolveHistoricalItem,
    uniqueItemIds,
    coverageContextPreset,
    outfitKey,
    pairKey
  };
});
