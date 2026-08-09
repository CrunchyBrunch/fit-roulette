(() => {
  "use strict";

  const STORAGE_KEY = "fitRoulette.v1";
  const APP_VERSION = "1.5.1";
  const ContextEngine = window.FitRouletteContextEngine;
  if (!ContextEngine) throw new Error("Context Engine module failed to load.");
  const SmartCloset = window.FitRouletteSmartCloset;
  if (!SmartCloset) throw new Error("Smart Closet module failed to load.");
  const SCHEMA_VERSION = SmartCloset.SCHEMA_VERSION;
  const RECOVERY_KEY = SmartCloset.RECOVERY_KEY;
  const LEGACY_RECOVERY_KEY = SmartCloset.LEGACY_RECOVERY_KEY;
  const RECOVERY_PREFIX = SmartCloset.RECOVERY_PREFIX;

  const CATEGORIES = SmartCloset.CATEGORIES;

  const CATEGORY_ORDER = SmartCloset.CATEGORY_ORDER;
  const BUILD_AROUND_GROUPS = [
    { id: "tops", label: "Tops", categories: ["top"] },
    { id: "bottoms", label: "Bottoms", categories: ["bottom"] },
    { id: "shoes", label: "Shoes", categories: ["shoes"] },
    { id: "layers", label: "Layers", categories: ["layer"] },
    { id: "accessories", label: "Accessories", categories: ["accessory", "socks"] },
    { id: "belts", label: "Belts", categories: ["belt"] }
  ];

  const OCCASIONS = {
    work: {
      id: "work",
      label: "Work / Office",
      targetFormality: 4,
      formalityGap: 3,
      slots: [
        { key: "top", label: "Top", categories: ["top"] },
        { key: "bottom", label: "Bottom", categories: ["bottom"] },
        { key: "shoes", label: "Shoes", categories: ["shoes"] },
        { key: "belt", label: "Belt", categories: ["belt"] }
      ]
    },
    friday: {
      id: "friday",
      label: "Friday Jeans",
      targetFormality: 3,
      formalityGap: 4,
      slots: [
        { key: "top", label: "Top", categories: ["top"] },
        { key: "bottom", label: "Jeans/Bottom", categories: ["bottom"] },
        { key: "shoes", label: "Shoes", categories: ["shoes"] },
        { key: "belt", label: "Belt", categories: ["belt"] }
      ]
    },
    casual: {
      id: "casual",
      label: "Casual",
      targetFormality: 2,
      formalityGap: 5,
      slots: [
        { key: "top", label: "Top", categories: ["top"] },
        { key: "bottom", label: "Bottom", categories: ["bottom"] },
        { key: "shoes", label: "Shoes", categories: ["shoes"] }
      ]
    },
    date: {
      id: "date",
      label: "Date",
      targetFormality: 3,
      formalityGap: 4,
      slots: [
        { key: "top", label: "Top", categories: ["top"] },
        { key: "bottom", label: "Bottom", categories: ["bottom"] },
        { key: "shoes", label: "Shoes", categories: ["shoes"] }
      ],
      optionalSlots: [
        { key: "extra", label: "Extra", categories: ["accessory", "belt"], chance: 0.7 }
      ]
    },
    gym: {
      id: "gym",
      label: "Legacy Gym / Errands",
      targetFormality: 1,
      formalityGap: 6,
      slots: [
        { key: "top", label: "Top", categories: ["top"] },
        { key: "bottom", label: "Bottom/Shorts", categories: ["bottom"] },
        { key: "shoes", label: "Shoes", categories: ["shoes"] }
      ]
    },
    athletic: {
      id: "athletic",
      label: "Athletic",
      targetFormality: 1,
      formalityGap: 6,
      slots: [
        { key: "top", label: "Top", categories: ["top"] },
        { key: "bottom", label: "Bottom/Shorts", categories: ["bottom"] },
        { key: "shoes", label: "Shoes", categories: ["shoes"] }
      ]
    }
  };

  const OCCASION_ORDER = ["work", "friday", "casual", "date", "athletic"];
  const THEME_VALUES = ["system", "light", "dark"];
  const AFTER_LOGGING_VALUES = ["confirm_keep", "keep", "clear"];
  const BELT_MODES = ["required", "optional", "none"];
  const COLOR_OPTIONS = SmartCloset.COLOR_PALETTE;
  const CUSTOM_COLOR_VALUE = "__custom__";
  const FEEDBACK_REASONS = [
    ["colors", "These colors do not work together"],
    ["top_pants", "Top and pants do not work together"],
    ["shoes", "Shoes do not work with the outfit"],
    ["belt_shoes", "Belt and shoes do not match"],
    ["too_formal", "Too formal"],
    ["too_casual", "Too casual"],
    ["weather", "Wrong for the weather"],
    ["exact", "I only dislike this exact outfit"],
    ["other", "Other"]
  ];

  let storageWriteLocked = false;
  let loadIssue = null;
  let migrationInfo = { migrated: false, recoveryCreated: false };
  let appState = loadState();
  let currentOutfit = null;
  let resultState = "empty";
  let pendingBanFeedback = null;
  let swapTargetItemId = null;
  let logInProgress = false;
  let editingItemId = null;
  let addSimilarSourceId = null;
  let itemSaveInProgress = false;
  let itemEditorBaseline = "";
  let itemEditorOriginalColors = { primary: "", secondary: "" };
  let pendingEditorExit = null;
  let unloadGuardActive = false;
  let relationshipRendered = { prefer: false, never: false };
  let rerollSession = createRerollSession();
  let contextSession = createContextSession();
  let weatherBusy = false;
  let weatherRefreshPromise = null;
  let weatherMessage = "";
  let weatherSessionFetchedAt = "";
  let locationPermission = "unknown";
  let automaticAttemptWithoutPermissionsApi = false;
  let generationPromise = null;
  const weatherClient = ContextEngine.createWeatherClient({
    fetchImpl: typeof window.fetch === "function" ? window.fetch.bind(window) : null,
    geolocation: navigator.geolocation
  });
  let closetFilters = {
    search: "",
    category: "all",
    showInactive: false
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    applyTheme(appState.settings.theme);
    renderStaticOptions();
    initializeGenerateOccasion();
    bindEvents();
    renderAll();
    registerServiceWorker();
    initializeAutomaticWeather();
  }

  function bindEvents() {
    $$(".tab-button").forEach((button) => {
      button.addEventListener("click", () => setActiveScreen(button.dataset.screen));
    });

    $("#quickAddBtn").addEventListener("click", () => {
      setActiveScreen("closet");
      openItemDialog();
    });

    $("#addItemBtn").addEventListener("click", () => openItemDialog());
    $("#generateBtn").addEventListener("click", () => generateAndRender({ mode: "generate" }));
    $("#rerollBtn").addEventListener("click", () => generateAndRender({ mode: "reroll" }));
    $("#logBtn").addEventListener("click", logCurrentOutfit);
    $("#banBtn").addEventListener("click", banCurrentCombo);
    $("#outfitResult").addEventListener("click", handleResultAction);
    $("#todayLoggedNotice").addEventListener("click", (event) => {
      if (event.target.closest("[data-today-log-id]")) setActiveScreen("history");
    });
    $("#manualLogGenerateBtn").addEventListener("click", openManualLogDialog);
    $("#manualLogHistoryBtn").addEventListener("click", openManualLogDialog);
    $("#manualLogForm").addEventListener("submit", saveManualLog);
    $("#closeManualLogBtn").addEventListener("click", () => closeDialog($("#manualLogDialog")));
    $("#manualIncludeUnavailable").addEventListener("change", renderManualItemPicker);
    $("#swapChoices").addEventListener("click", handleSwapChoice);
    $("#closeSwapDialogBtn").addEventListener("click", () => closeDialog($("#swapDialog")));
    $("#feedbackForm").addEventListener("submit", saveBanFeedback);
    $("#feedbackForm").addEventListener("change", updateFeedbackOtherVisibility);
    $("#dismissFeedbackBtn").addEventListener("click", finishBanFeedback);
    $("#skipFeedbackBtn").addEventListener("click", finishBanFeedback);
    $("#useCurrentLocationBtn").addEventListener("click", () => refreshWeather({ force: true, userInitiated: true }));
    $("#refreshWeatherBtn").addEventListener("click", () => refreshWeather({ force: true, userInitiated: true }));
    $("#disableWeatherBtn").addEventListener("click", disableAutomaticWeather);
    $("#contextMode").addEventListener("change", handleContextControlChange);
    $("#acceptStaleWeather").addEventListener("change", handleContextControlChange);
    $("#manualTemperature").addEventListener("input", handleContextControlChange);
    $("#manualCondition").addEventListener("change", handleContextControlChange);
    $("#temperatureUnit").addEventListener("change", changeTemperatureUnit);
    $("#feelsAdjustment").addEventListener("change", handleContextControlChange);
    $("#contextExposure").addEventListener("change", handleContextControlChange);
    $("#expectRain").addEventListener("change", handleContextControlChange);
    $("#ignoreWeather").addEventListener("change", handleContextControlChange);
    $("#occasionSelect").addEventListener("change", handleGenerationContextChange);
    $("#buildAroundCategorySelect").addEventListener("change", handleBuildAroundCategoryChange);
    $("#buildAroundSelect").addEventListener("change", handleGenerationContextChange);
    $("#resetViewedFitsBtn").addEventListener("click", resetViewedFits);

    $("#closetSearch").addEventListener("input", (event) => {
      closetFilters.search = event.target.value;
      renderCloset();
    });

    $("#closetCategory").addEventListener("change", (event) => {
      closetFilters.category = event.target.value;
      renderCloset();
    });

    $("#showInactive").addEventListener("change", (event) => {
      closetFilters.showInactive = event.target.checked;
      renderCloset();
    });

    $("#closetList").addEventListener("click", handleClosetAction);
    $("#freshSetup").addEventListener("click", handleFreshSetupAction);
    $("#reviewQueue").addEventListener("click", handleReviewQueueAction);
    $("#historyList").addEventListener("click", handleHistoryAction);

    $("#exportBtn").addEventListener("click", exportBackup);
    $("#recoveryDownloads").addEventListener("click", handleRecoveryDownload);
    $("#importBtn").addEventListener("click", () => $("#importFile").click());
    $("#importFile").addEventListener("change", importBackup);
    $("#resetDemoBtn").addEventListener("click", resetDemoData);
    $("#clearBansBtn").addEventListener("click", clearBannedCombos);
    $("#themeSelect").addEventListener("change", (event) => updateTheme(event.target.value));
    $("#afterLoggingSelect").addEventListener("change", (event) => updateAfterLogging(event.target.value));
    $("#defaultOccasionSelect").addEventListener("change", (event) => updateDefaultOccasion(event.target.value));

    $("#itemForm").addEventListener("submit", saveItemFromForm);
    $("#itemForm").addEventListener("click", handleItemFormClick);
    $("#itemForm").addEventListener("input", updateEditorDirtyState);
    $("#itemForm").addEventListener("change", updateEditorDirtyState);
    $("#itemCategory").addEventListener("change", () => {
      renderSubtypeOptions();
      applyTemplate($("#itemSubtype").value);
    });
    $("#itemSubtype").addEventListener("change", () => applyTemplate($("#itemSubtype").value));
    $("#itemPattern").addEventListener("change", updateSecondaryColorAvailability);
    $("#itemPrimaryColor").addEventListener("change", () => updateColorControl("primary", true));
    $("#itemSecondaryColor").addEventListener("change", () => updateColorControl("secondary", true));
    $("#preferItemsGroup").addEventListener("change", () => renderRelationshipChoiceGroup("prefer"));
    $("#neverItemsGroup").addEventListener("change", () => renderRelationshipChoiceGroup("never"));
    $("#preferDetails").addEventListener("toggle", () => handleRelationshipDisclosureToggle("prefer"));
    $("#neverDetails").addEventListener("toggle", () => handleRelationshipDisclosureToggle("never"));
    $("#preferItemsChoices").addEventListener("change", handleRelationshipChoice);
    $("#neverItemsChoices").addEventListener("change", handleRelationshipChoice);
    $("#preferItemsLegacy").addEventListener("change", handleRelationshipChoice);
    $("#neverItemsLegacy").addEventListener("change", handleRelationshipChoice);
    $("#saveGenerateBtn").addEventListener("click", () => saveItemFromEditor({ generateAfter: true }));
    $("#saveAddSimilarBtn").addEventListener("click", () => saveItemFromEditor({ addSimilarAfter: true }));
    $("#closeItemDialogBtn").addEventListener("click", () => requestEditorExit("close"));
    $("#addSimilarBtn").addEventListener("click", addSimilarFromDialog);
    $("#permanentDeleteBtn").addEventListener("click", permanentlyDeleteFromDialog);
    $("#itemName").addEventListener("input", updateEditorTitle);
    $("#itemDialog").addEventListener("cancel", handleItemDialogCancel);
    $("#itemDialog").addEventListener("click", handleItemDialogBackdrop);
    $("#saveItemExitBtn").addEventListener("click", savePendingEditorExit);
    $("#discardItemExitBtn").addEventListener("click", discardPendingEditorExit);
    $("#continueItemExitBtn").addEventListener("click", continuePendingEditorExit);
    $("#itemExitDialog").addEventListener("cancel", (event) => {
      event.preventDefault();
      continuePendingEditorExit();
    });
    window.addEventListener("popstate", handleEditorNavigation);
  }

  function renderStaticOptions() {
    renderGenerateOccasionOptions();

    const categoryOptions = CATEGORY_ORDER.map((id) => {
      return `<option value="${id}">${escapeHtml(CATEGORIES[id])}</option>`;
    }).join("");

    $("#itemCategory").innerHTML = categoryOptions;
    $("#closetCategory").innerHTML = `<option value="all">All categories</option>${categoryOptions}`;
    renderSubtypeOptions();

    renderItemOccasionOptions(false);

    const quickTemplates = ["polo", "t-shirt", "button-down", "sweater", "jeans", "dress pants", "chinos", "cargos", "athletic shorts", "sneakers", "athletic/running shoes", "dress shoes", "boots", "jacket", "hoodie"];
    $("#templateChips").innerHTML = quickTemplates.map((id) => {
      return `<button class="mini-button" type="button" data-template-id="${escapeAttribute(id)}">${escapeHtml(SmartCloset.titleCase(id))}</button>`;
    }).join("");

    $("#primaryColorChips").innerHTML = COLOR_OPTIONS.map((color) => {
      return `<button class="mini-button" type="button" data-color="${escapeAttribute(SmartCloset.titleCase(color))}">${escapeHtml(SmartCloset.titleCase(color))}</button>`;
    }).join("");

    renderColorOptions();
    $("#itemPattern").innerHTML = SmartCloset.PATTERNS.map((value) => `<option value="${value}">${escapeHtml(SmartCloset.titleCase(value))}</option>`).join("");
    $("#itemFormality").innerHTML = Object.entries(SmartCloset.FORMALITY_LABELS).map(([value, label]) => `<option value="${value}">${value}. ${escapeHtml(label)}</option>`).join("");
    $("#itemSleeveLength").innerHTML = SmartCloset.SLEEVE_LENGTHS.map((value) => `<option value="${value}">${escapeHtml(SmartCloset.titleCase(value))}</option>`).join("");
    $("#itemBottomLength").innerHTML = SmartCloset.BOTTOM_LENGTHS.map((value) => `<option value="${value}">${escapeHtml(SmartCloset.titleCase(value))}</option>`).join("");
    $("#itemWarmth").innerHTML = SmartCloset.WARMTH_LEVELS.map((value) => `<option value="${value}">${escapeHtml(SmartCloset.titleCase(value))}</option>`).join("");
    $("#itemRainPolicy").innerHTML = SmartCloset.RAIN_POLICIES.map((value) => `<option value="${value}">${escapeHtml(value === "avoid" ? "Avoid rain / snow" : SmartCloset.titleCase(value))}</option>`).join("");
    const protectionOptions = SmartCloset.PROTECTION_LEVELS.map((value) => `<option value="${value}">${escapeHtml(value === "protected" ? "Protective" : SmartCloset.titleCase(value))}</option>`).join("");
    $("#itemRainProtection").innerHTML = protectionOptions;
    $("#itemWindProtection").innerHTML = protectionOptions;

    $("#manualLogOccasion").innerHTML = OCCASION_ORDER.map((id) => {
      return `<option value="${id}">${escapeHtml(OCCASIONS[id].label)}</option>`;
    }).join("");

    renderDefaultOccasionOptions();

    $("#feedbackChoices").innerHTML = FEEDBACK_REASONS.map(([value, label]) => {
      return `
        <label class="feedback-choice">
          <input type="radio" name="feedbackReason" value="${value}">
          <span>${escapeHtml(label)}</span>
        </label>
      `;
    }).join("");
  }

  function renderAll() {
    renderGenerateOccasionOptions();
    renderBuildAroundOptions();
    renderLabelSuggestions();
    renderDataSafetyNotice();
    renderFreshSetup();
    renderReviewQueue();
    renderCloset();
    renderHistory();
    renderSettings();
    renderWeatherControls();
    renderResult();
    renderTodayLoggedNotice();
    renderRerollSessionStatus();
  }

  function renderSubtypeOptions(selectedValue = "") {
    const category = $("#itemCategory")?.value || "top";
    const values = SmartCloset.SUBTYPES[category] || ["other"];
    $("#itemSubtype").innerHTML = values.map((value) => `<option value="${escapeAttribute(value)}">${escapeHtml(SmartCloset.titleCase(value))}</option>`).join("");
    $("#itemSubtype").value = values.includes(selectedValue) ? selectedValue : values[0];
    $("#sleeveLengthField").hidden = !["top", "layer"].includes(category);
    $("#bottomLengthField").hidden = category !== "bottom";
    renderLayerControls();
  }

  function renderItemOccasionOptions(includeLegacy) {
    const ids = includeLegacy ? [...OCCASION_ORDER, "gym"] : OCCASION_ORDER;
    $("#itemOccasions").innerHTML = ids.map((id) => {
      const occasion = OCCASIONS[id];
      return `
        <label class="check-pill ${id === "gym" ? "legacy-occasion" : ""}">
          <input type="checkbox" name="itemOccasion" value="${occasion.id}">
          <span>${escapeHtml(occasion.label)}${id === "gym" ? " (stored; choose Athletic or Casual when known)" : ""}</span>
        </label>
      `;
    }).join("");
  }

  function renderDefaultOccasionOptions() {
    const includeLegacy = appState.settings.defaultOccasion === "gym";
    const ids = includeLegacy ? [...OCCASION_ORDER, "gym"] : OCCASION_ORDER;
    $("#defaultOccasionSelect").innerHTML = ids.map((id) => `<option value="${id}">${escapeHtml(OCCASIONS[id].label)}</option>`).join("");
  }

  function renderGenerateOccasionOptions() {
    const select = $("#occasionSelect");
    const previous = select.value;
    const includeLegacy = appState.wardrobe.some((item) => item.occasions.includes("gym"))
      || appState.history.some((record) => record.occasion === "gym")
      || appState.settings.defaultOccasion === "gym";
    const ids = includeLegacy ? [...OCCASION_ORDER, "gym"] : OCCASION_ORDER;
    select.innerHTML = ids.map((id) => {
      const occasion = OCCASIONS[id];
      const suffix = id === "gym" ? " (legacy closet only)" : "";
      return `<option value="${occasion.id}">${escapeHtml(occasion.label + suffix)}</option>`;
    }).join("");
    select.value = ids.includes(previous) ? previous : (ids.includes(appState.settings.defaultOccasion) ? appState.settings.defaultOccasion : "work");
  }

  function initializeGenerateOccasion() {
    const saved = validOccasion(appState.settings.defaultOccasion);
    $("#occasionSelect").value = OCCASION_ORDER.includes(saved) || (saved === "gym" && $("#occasionSelect").innerHTML.includes('value="gym"')) ? saved : "work";
  }

  function setActiveScreen(screenName) {
    $$(".screen").forEach((screen) => {
      screen.classList.toggle("is-active", screen.id === `screen-${screenName}`);
    });

    $$(".tab-button").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.screen === screenName);
    });
  }

  function loadState() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) {
      const fresh = createDefaultState();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
      return fresh;
    }

    let raw;
    try {
      raw = JSON.parse(saved);
    } catch (error) {
      try {
        migrationInfo.recoveryCreated = preserveRecoveryPayload(saved).created;
      } catch (recoveryError) {
        console.error(recoveryError);
        return loadFailureState(recoveryError, "Saved closet data is malformed and a recovery copy could not be created. The original data remains untouched.");
      }
      return loadFailureState(error, "Saved closet data is malformed. The original data is untouched and editing is locked until a valid backup is imported.");
    }

    try {
      SmartCloset.assertNoSensitiveLocation(raw);
    } catch (error) {
      return loadFailureState(error, "Saved data contains a prohibited location field. The primary value remains untouched and editing is locked.");
    }

    const incomingVersion = Number(raw?.schemaVersion ?? raw?.version ?? 1);
    if (Number.isFinite(incomingVersion) && incomingVersion > SCHEMA_VERSION) {
      return loadFailureState(
        Object.assign(new Error(`Unsupported future schema ${incomingVersion}.`), { code: "UNSUPPORTED_FUTURE_SCHEMA" }),
        `This closet uses schema ${incomingVersion}, which is newer than this app supports. No data was changed.`
      );
    }

    try {
      if (!Number.isFinite(incomingVersion) || incomingVersion < SCHEMA_VERSION) {
        migrationInfo.recoveryCreated = preserveRecoveryPayload(saved).created;
      }
      const result = SmartCloset.migrateAndValidate(raw);
      if (result.migrated) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(result.state));
        migrationInfo.migrated = true;
      }
      return result.state;
    } catch (error) {
      console.error(error);
      return loadFailureState(error, "Smart Closet migration could not be completed safely. The original data is untouched and editing is locked.");
    }
  }

  function preserveRecoveryPayload(payload, options = {}) {
    try {
      const existing = localStorage.getItem(RECOVERY_KEY);
      if (existing === payload) return { created: false, key: RECOVERY_KEY, retained: true };
      if (existing === null) {
        localStorage.setItem(RECOVERY_KEY, payload);
        return { created: true, key: RECOVERY_KEY, retained: true };
      }
      if (options.allowAdditional !== true) return { created: false, key: RECOVERY_KEY, retained: false };
      const key = `${RECOVERY_PREFIX}${Date.now().toString(36)}.${Math.random().toString(36).slice(2, 8)}`;
      localStorage.setItem(key, payload);
      return { created: true, key, retained: true };
    } catch (error) {
      console.error(error);
      throw Object.assign(new Error("Could not create the required recovery copy."), { code: "RECOVERY_WRITE_FAILED" });
    }
  }

  function loadFailureState(error, message) {
    storageWriteLocked = true;
    loadIssue = { code: error?.code || "LOAD_FAILED", message };
    const safeState = SmartCloset.createFreshState();
    safeState.setup = { completed: true, choice: "recovery" };
    return safeState;
  }

  function saveState() {
    if (storageWriteLocked) {
      showToast("Data is locked to protect the original closet. Import a valid backup to continue.");
      return false;
    }
    try {
      SmartCloset.validateState(appState);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
      return true;
    } catch (error) {
      console.error(error);
      showToast("Could not save locally. Storage may be full.");
      return false;
    }
  }

  function createDefaultState() {
    return SmartCloset.createFreshState();
  }

  function normalizeState(raw) {
    return SmartCloset.migrateAndValidate(raw).state;
  }

  function normalizeSettings(settings) {
    const theme = THEME_VALUES.includes(settings?.theme) ? settings.theme : "system";
    const afterLogging = AFTER_LOGGING_VALUES.includes(settings?.afterLogging) ? settings.afterLogging : "confirm_keep";
    const defaultOccasion = validOccasion(settings?.defaultOccasion);
    const weather = settings?.weather && typeof settings.weather === "object" ? settings.weather : {};
    return {
      theme,
      afterLogging,
      defaultOccasion,
      weather: {
        automatic: weather.automatic === true,
        unit: ContextEngine.UNITS.includes(weather.unit) ? weather.unit : "f",
        cached: ContextEngine.normalizeCachedWeather(weather.cached),
        legacyManual: weather.legacyManual && typeof weather.legacyManual === "object" ? weather.legacyManual : null
      }
    };
  }

  function normalizeItem(item) {
    return SmartCloset.createItem(item);
  }

  function normalizeHistoryRecord(record) {
    if (!record || typeof record !== "object") return null;
    const itemIds = unique(toArray(record.itemIds || record.items).map(String));
    if (!itemIds.length) return null;
    return {
      id: stringOr(record.id, uid("log")),
      date: stringOr(record.date, new Date().toISOString()),
      occasion: normalizeOccasionToken(record.occasion) || "casual",
      itemIds,
      itemSnapshots: Array.isArray(record.itemSnapshots) ? record.itemSnapshots : [],
      source: record.source === "manual" ? "manual" : "generated",
      note: stringOr(record.note, ""),
      context: ContextEngine.normalizeHistoryContext(record.context)
    };
  }

  function normalizeBannedCombo(combo) {
    if (!combo || typeof combo !== "object") return null;
    const itemIds = unique(toArray(combo.itemIds).map(String)).sort();
    if (!itemIds.length) return null;
    return {
      id: stringOr(combo.id, uid("ban")),
      itemIds,
      occasion: normalizeOccasionToken(combo.occasion) || "",
      createdAt: stringOr(combo.createdAt, new Date().toISOString())
    };
  }

  function normalizeFeedbackRecord(record) {
    if (!record || typeof record !== "object") return null;
    const validReasons = FEEDBACK_REASONS.map(([value]) => value);
    return {
      id: stringOr(record.id, uid("feedback")),
      bannedComboId: stringOr(record.bannedComboId, ""),
      reason: validReasons.includes(record.reason) ? record.reason : "other",
      itemIds: unique(toArray(record.itemIds).map(String)),
      pairItemIds: unique(toArray(record.pairItemIds).map(String)).slice(0, 2),
      note: stringOr(record.note, ""),
      createdAt: stringOr(record.createdAt, new Date().toISOString())
    };
  }

  function renderBuildAroundOptions(options = {}) {
    const categorySelect = $("#buildAroundCategorySelect");
    const itemSelect = $("#buildAroundSelect");
    const itemField = $("#buildAroundItemField");
    const activeItems = appState.wardrobe.filter(isAvailable).sort(sortItems);
    const availableGroups = buildAroundGroups(activeItems);
    const requestedItemId = options.selectedItemId ?? itemSelect.value ?? "";
    const selectedItem = activeItems.find((item) => item.id === requestedItemId) || null;
    const selectedItemGroup = selectedItem ? buildAroundGroupForItem(selectedItem, availableGroups) : null;
    let categoryId = selectedItemGroup?.id || options.categoryId || categorySelect.value || "";

    if (!availableGroups.some((group) => group.id === categoryId)) {
      categoryId = "";
    }

    categorySelect.innerHTML = [
      `<option value="">Any item</option>`,
      ...availableGroups.map((group) => `<option value="${escapeAttribute(group.id)}">${escapeHtml(group.label)}</option>`)
    ].join("");
    categorySelect.value = categoryId;

    const selectedGroup = availableGroups.find((group) => group.id === categoryId) || null;
    if (!selectedGroup) {
      itemSelect.innerHTML = `<option value="">Any item</option>`;
      itemSelect.value = "";
      itemField.hidden = true;
      return;
    }

    itemSelect.innerHTML = [
      `<option value="">Choose item</option>`,
      ...selectedGroup.items.map((item) => {
        return `<option value="${escapeAttribute(item.id)}">${escapeHtml(buildAroundItemLabel(item, activeItems))}</option>`;
      })
    ].join("");
    itemSelect.value = selectedGroup.items.some((item) => item.id === requestedItemId) ? requestedItemId : "";
    itemField.hidden = false;
  }

  function buildAroundGroups(activeItems) {
    const groups = BUILD_AROUND_GROUPS.map((group) => ({
      ...group,
      items: activeItems.filter((item) => group.categories.includes(item.category))
    })).filter((group) => group.items.length);
    const knownCategories = new Set(BUILD_AROUND_GROUPS.flatMap((group) => group.categories));
    const otherItems = activeItems.filter((item) => !knownCategories.has(item.category));
    if (otherItems.length) {
      groups.push({ id: "other", label: "Other", categories: [], items: otherItems });
    }
    return groups;
  }

  function buildAroundGroupForItem(item, groups = buildAroundGroups(appState.wardrobe.filter(isAvailable))) {
    return groups.find((group) => group.items.some((candidate) => candidate.id === item.id)) || null;
  }

  function buildAroundItemLabel(item, activeItems) {
    const duplicateName = activeItems.some((candidate) => {
      return candidate.id !== item.id && normalizeTag(candidate.name) === normalizeTag(item.name);
    });
    if (!duplicateName) return item.name;
    const detail = item.primaryColor || CATEGORIES[item.category] || item.category;
    return `${item.name} (${detail})`;
  }

  function handleBuildAroundCategoryChange(event) {
    renderBuildAroundOptions({ categoryId: event.target.value, selectedItemId: "" });
    handleGenerationContextChange();
  }

  function handleGenerationContextChange() {
    rerollSession = createRerollSession();
    renderRerollSessionStatus();
  }

  function renderLabelSuggestions() {
    const suggestions = unique(appState.wardrobe.flatMap((item) => item.labels || []).map(normalizeTag)).filter(Boolean).sort();
    $("#labelSuggestions").innerHTML = suggestions.map((label) => `<option value="${escapeAttribute(label)}"></option>`).join("");
  }

  function renderDataSafetyNotice() {
    const notice = $("#dataSafetyNotice");
    if (!loadIssue) {
      notice.hidden = true;
      notice.textContent = "";
      return;
    }
    notice.hidden = false;
    notice.innerHTML = `<strong>Closet data protected.</strong> ${escapeHtml(loadIssue.message)} <span class="notice-code">${escapeHtml(loadIssue.code)}</span>`;
  }

  function renderFreshSetup() {
    const setup = $("#freshSetup");
    if (appState.setup?.completed || loadIssue) {
      setup.hidden = true;
      setup.innerHTML = "";
      return;
    }
    setup.hidden = false;
    setup.innerHTML = `
      <p class="eyebrow">New closet</p>
      <h2 id="freshSetupTitle">How would you like to start?</h2>
      <p class="small-meta">This choice only appears on a genuinely fresh installation.</p>
      <div class="setup-actions">
        <button class="secondary-button" type="button" data-setup-choice="empty">Start with an empty closet</button>
        <button class="primary-button" type="button" data-setup-choice="quick_add">Add clothes with Quick Add</button>
        <button class="secondary-button" type="button" data-setup-choice="sample">Explore a sample closet</button>
      </div>`;
  }

  function handleFreshSetupAction(event) {
    const button = event.target.closest("[data-setup-choice]");
    if (!button || storageWriteLocked) return;
    const choice = button.dataset.setupChoice;
    if (choice === "sample") appState.wardrobe = sampleWardrobe();
    appState.setup = { completed: true, choice };
    invalidateGenerationState();
    saveState();
    renderAll();
    if (choice === "quick_add") openItemDialog();
  }

  function renderReviewQueue() {
    const queue = $("#reviewQueue");
    const items = appState.wardrobe.filter((item) => item.review?.status === "needs_review");
    if (!items.length) {
      queue.hidden = true;
      queue.innerHTML = "";
      return;
    }
    queue.hidden = false;
    queue.innerHTML = `
      <div class="review-queue-heading">
        <div><p class="eyebrow">Smart Closet</p><h2 id="reviewQueueTitle">Review Smart Closet Settings</h2></div>
        <span class="count-badge">${items.length}</span>
      </div>
      <p class="small-meta">Generation remains available. Review inferred or ambiguous details whenever convenient.</p>
      <div class="review-items">${items.slice(0, 6).map((item) => `
        <button type="button" class="review-item" data-review-id="${escapeAttribute(item.id)}">
          <span><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.review.reasons[0] || "Confirm structured settings.")}</small></span>
          <span aria-hidden="true">&rsaquo;</span>
        </button>`).join("")}</div>
      ${items.length > 6 ? `<p class="small-meta">${items.length - 6} more items remain in the queue.</p>` : ""}`;
  }

  function handleReviewQueueAction(event) {
    const button = event.target.closest("[data-review-id]");
    if (button) openItemDialog(button.dataset.reviewId);
  }

  function renderTodayLoggedNotice() {
    const notice = $("#todayLoggedNotice");
    const today = dateOnly(new Date());
    const record = appState.history.find((entry) => entry.source === "manual" && dateOnly(entry.date) === today);
    if (!record) {
      notice.hidden = true;
      notice.innerHTML = "";
      return;
    }
    notice.hidden = false;
    notice.innerHTML = `<span><strong>Today's fit is logged</strong><small>From your history</small></span><button class="text-button compact" type="button" data-today-log-id="${escapeAttribute(record.id)}">View in History</button>`;
  }

  function renderResult() {
    const card = $("#outfitResult");
    const actions = $("#resultActions");

    if (resultState === "logged" && !currentOutfit) {
      card.classList.remove("empty-state");
      card.innerHTML = `
        <div class="log-success" role="status">
          <span class="success-mark" aria-hidden="true">&#10003;</span>
          <div>
            <h2>Fit logged.</h2>
            <p>Make the day great.</p>
          </div>
          <div class="logged-result-actions">
            <button class="secondary-button" type="button" data-result-action="reroll">Reroll</button>
            <button class="primary-button" type="button" data-result-action="generate-another">Generate Another</button>
          </div>
        </div>
      `;
      actions.hidden = true;
      return;
    }

    if (!currentOutfit) {
      card.classList.add("empty-state");
      card.innerHTML = "<p>No outfit yet.</p>";
      actions.hidden = true;
      return;
    }

    if (currentOutfit.error) {
      card.classList.add("empty-state");
      card.innerHTML = `<p>${escapeHtml(currentOutfit.error)}</p>`;
      actions.hidden = true;
      return;
    }

    const occasion = OCCASIONS[currentOutfit.occasion];
    const buildAround = currentOutfit.buildAroundId ? findItem(currentOutfit.buildAroundId) : null;
    const buildChip = buildAround ? `<span class="chip accent">Locked: ${escapeHtml(buildAround.name)}</span>` : "";
    const isLogged = resultState === "logged";
    const loggedConfirmation = isLogged
      ? renderLoggedConfirmation(appState.settings.afterLogging === "keep")
      : "";

    card.classList.remove("empty-state");
    card.innerHTML = `
      ${loggedConfirmation}
      <div class="result-heading">
        <div>
          <p class="eyebrow">${escapeHtml(occasion.label)}</p>
          <h2>Today&apos;s fit</h2>
        </div>
        ${weatherResultLabel()}
      </div>
      <div class="chip-row">${buildChip}</div>
      <div class="result-list">
        ${displayOutfitItems(currentOutfit).map((item) => renderResultItem(item, currentOutfit, isLogged)).join("")}
      </div>
      ${renderContextExplanation(currentOutfit)}
      ${currentOutfit.sockMessage ? `<p class="result-change-note" role="status">${escapeHtml(currentOutfit.sockMessage)}</p>` : ""}
      ${currentOutfit.changeNote ? `<p class="result-change-note" role="status">${escapeHtml(currentOutfit.changeNote)}</p>` : ""}
    `;
    actions.hidden = isLogged;
  }

  function renderLoggedConfirmation(subtle) {
    if (subtle) {
      return `
        <div class="logged-indicator" role="status">
          <strong>&#10003; Logged</strong>
          <div class="logged-inline-actions">
            <button class="text-button compact" type="button" data-result-action="reroll">Reroll</button>
            <button class="secondary-button compact" type="button" data-result-action="generate-another">Generate Another</button>
          </div>
        </div>
      `;
    }
    return `
      <div class="log-confirmation" role="status">
        <div>
          <strong>Fit logged.</strong>
          <span>Make the day great.</span>
        </div>
        <div class="logged-inline-actions">
          <button class="text-button compact" type="button" data-result-action="reroll">Reroll</button>
          <button class="primary-button compact" type="button" data-result-action="generate-another">Generate Another</button>
        </div>
      </div>
    `;
  }

  function renderResultItem(item, outfit, isLogged = false) {
    const changed = toArray(outfit.changedItemIds).includes(item.id);
    const locked = outfit.buildAroundId === item.id;
    const color = item.primaryColor ? `<span>${escapeHtml(item.primaryColor)}</span>` : "";
    const bottom = outfit.items.find((candidate) => candidate.category === "bottom");
    const removableOptionalBelt = item.category === "belt" && bottom?.beltMode === "optional" && !locked && !isLogged;
    const removableAutomaticLayer = item.id === outfit.automaticLayerId && !locked && !isLogged;
    const removableAction = removableAutomaticLayer
      ? `<button class="text-button compact" type="button" data-result-action="remove-layer">Remove Layer</button>`
      : (removableOptionalBelt ? `<button class="text-button compact" type="button" data-result-action="remove-belt">Remove Belt</button>` : "");

    return `
      <div class="result-item ${changed ? "is-changed" : ""}" data-result-item-id="${escapeAttribute(item.id)}">
        <div class="result-item-copy">
          <p class="item-kicker">${escapeHtml(CATEGORIES[item.category] || item.category)}</p>
          <h3>${escapeHtml(item.name)}</h3>
          ${color}
        </div>
        ${isLogged ? "" : (removableAction ? `
          <div class="result-item-actions">
            ${removableAction}
            <button class="swap-button" type="button" data-result-action="swap" data-item-id="${escapeAttribute(item.id)}">Swap</button>
          </div>
        ` : `
          <button class="swap-button" type="button" data-result-action="swap" data-item-id="${escapeAttribute(item.id)}" ${locked ? "disabled" : ""}>
            ${locked ? "Locked" : "Swap"}
          </button>
        `)}
      </div>
    `;
  }

  function handleResultAction(event) {
    const button = event.target.closest("[data-result-action]");
    if (!button) return;
    if (button.dataset.resultAction === "generate-another") {
      generateAndRender({ mode: "generate" });
    } else if (button.dataset.resultAction === "reroll") {
      generateAndRender({ mode: "reroll" });
    } else if (button.dataset.resultAction === "swap") {
      openSwapDialog(button.dataset.itemId);
    } else if (button.dataset.resultAction === "remove-belt") {
      removeOptionalBelt();
    } else if (button.dataset.resultAction === "remove-layer") {
      removeAutomaticLayer();
    }
  }

  function renderContextExplanation(outfit) {
    if (!outfit?.context || outfit.context.source === "none") return "";
    const layer = outfit.automaticLayerId ? outfit.items.find((item) => item.id === outfit.automaticLayerId) : null;
    const assessment = ContextEngine.scoreOutfitContext(outfit.items, outfit.context);
    const explanation = ContextEngine.describeContext(outfit.context, {
      unit: appState.settings.weather.unit,
      layerName: layer?.name || "",
      shortfall: assessment.shortfall
    });
    const timing = outfit.context.fetchedAt
      ? ` Fetched ${formatContextTime(outfit.context.fetchedAt)}.`
      : "";
    return `<p class="context-explanation">${escapeHtml(explanation + timing)}</p>`;
  }

  function renderCloset() {
    const list = $("#closetList");
    const matchingItems = appState.wardrobe
      .filter((item) => closetFilters.showInactive || isAvailable(item))
      .filter((item) => closetFilters.category === "all" || item.category === closetFilters.category)
      .filter((item) => matchesClosetSearch(item, closetFilters.search))
      .sort(sortItems);

    if (!matchingItems.length) {
      list.innerHTML = `<article class="closet-card"><p class="small-meta">No matching items.</p></article>`;
      return;
    }

    if (!closetFilters.showInactive) {
      list.innerHTML = matchingItems.map(renderClosetCard).join("");
      return;
    }

    const archivedItems = matchingItems.filter((item) => item.status === "archived");
    const unavailableItems = matchingItems.filter((item) => item.status === "unavailable");
    const activeItems = matchingItems.filter(isAvailable);
    const archivedSection = archivedItems.length
      ? renderClosetGroup("Archived", archivedItems, "archived")
      : "";
    const activeSection = activeItems.length
      ? renderClosetGroup("Available", activeItems, "active")
      : "";
    const unavailableSection = unavailableItems.length
      ? renderClosetGroup("Unavailable", unavailableItems, "unavailable")
      : "";
    list.innerHTML = `${archivedSection}${unavailableSection}${activeSection}`;
  }

  function renderClosetGroup(title, items, tone) {
    return `
      <section class="closet-group closet-group-${tone}" aria-label="${escapeAttribute(title)}">
        <h3 class="closet-group-title">${escapeHtml(title)}</h3>
        <div class="closet-group-list">${items.map(renderClosetCard).join("")}</div>
      </section>
    `;
  }

  function renderClosetCard(item) {
    const occasionLabels = item.occasions.map((id) => OCCASIONS[id]?.label || id);
    const chips = [
      renderChip(CATEGORIES[item.category]),
      renderChip(SmartCloset.titleCase(item.subtype)),
      ...(item.layerRoles || []).map((role) => renderChip(`${SmartCloset.titleCase(role)} layer`, "accent")),
      ...SmartCloset.itemColors(item).map(renderChip),
      ...item.labels.slice(0, 3).map(renderChip),
      ...occasionLabels.slice(0, 2).map((label) => renderChip(label, "accent"))
    ].join("");

    const status = isAvailable(item) ? "" : `<span class="chip">${escapeHtml(SmartCloset.titleCase(item.status))}</span>`;
    const lastWornDate = lastItemWornDate(item);
    const lastWorn = lastWornDate ? `Last worn ${formatShortDate(lastWornDate)}` : "Not logged yet";
    const review = item.review?.status === "needs_review" ? `<span class="chip warning">Needs review</span>` : "";

    return `
      <article class="closet-card ${isAvailable(item) ? "" : "is-inactive"}" data-item-id="${escapeAttribute(item.id)}">
        <div class="card-topline">
          <div class="card-title-wrap">
            <h3>${escapeHtml(item.name)}</h3>
            <p class="small-meta">${escapeHtml(lastWorn)} - ${escapeHtml(SmartCloset.FORMALITY_LABELS[item.formality])}</p>
          </div>
          <div class="status-chips">${review}${status}</div>
        </div>
        <div class="chip-row">${chips}</div>
        <div class="card-actions">
          <button class="secondary-button edit-action" type="button" data-action="edit">Edit</button>
          <button class="secondary-button" type="button" data-action="add-similar">Add Similar</button>
        </div>
      </article>
    `;
  }

  function renderHistory() {
    const list = $("#historyList");
    const records = [...appState.history].sort((a, b) => new Date(b.date) - new Date(a.date));

    if (!records.length) {
      list.innerHTML = `<article class="history-card"><p class="small-meta">No logged outfits yet.</p></article>`;
      return;
    }

    list.innerHTML = records.map((record) => {
      const items = displayOutfitItems(record.itemIds.map((id) => snapshotOrItem(record, id)).filter(Boolean));
      return `
        <article class="history-card" data-log-id="${escapeAttribute(record.id)}">
          <div class="history-topline">
            <div>
              <h3>${escapeHtml(formatLongDate(record.date))}</h3>
              <p class="small-meta">${escapeHtml(OCCASIONS[record.occasion]?.label || record.occasion)}${record.source === "manual" ? " - Manual log" : ""}</p>
            </div>
            <button class="secondary-button" type="button" data-action="delete-log">Delete</button>
          </div>
          <div class="chip-row">
            ${items.map((item) => renderChip(item.name)).join("")}
          </div>
          ${record.context ? `<p class="small-meta history-context">${escapeHtml(historyContextLabel(record.context))}</p>` : ""}
          ${record.note ? `<p class="history-note">${escapeHtml(record.note)}</p>` : ""}
        </article>
      `;
    }).join("");
  }

  function historyContextLabel(context) {
    if (context.source === "ignored") return "Weather ignored";
    const temperature = context.temperatureC === null ? "" : `${ContextEngine.formatTemperature(context.temperatureC, appState.settings.weather.unit)} · `;
    const source = { current: "Current", cached: "Cached", manual: "Manual" }[context.source] || "Context";
    const layer = context.automaticLayerRemoved ? " · Suggested layer removed" : (context.automaticLayerSuggested ? " · Layer suggested" : "");
    return `${temperature}${source} · ${SmartCloset.titleCase(context.condition)}${layer}`;
  }

  function renderSettings() {
    const activeCount = appState.wardrobe.filter(isAvailable).length;
    const unavailableCount = appState.wardrobe.filter((item) => item.status === "unavailable").length;
    const archivedCount = appState.wardrobe.filter((item) => item.status === "archived").length;
    $("#themeSelect").value = appState.settings.theme;
    $("#afterLoggingSelect").value = appState.settings.afterLogging;
    renderDefaultOccasionOptions();
    $("#defaultOccasionSelect").value = appState.settings.defaultOccasion;
    $("#appVersion").textContent = `App version ${APP_VERSION} · Data schema ${appState.schemaVersion}`;
    renderRecoveryDownloads();
    $("#settingsStats").innerHTML = `
      <div class="stat-card"><strong>${activeCount}</strong><span>Available</span></div>
      <div class="stat-card"><strong>${unavailableCount}</strong><span>Unavailable</span></div>
      <div class="stat-card"><strong>${archivedCount}</strong><span>Archived</span></div>
      <div class="stat-card"><strong>${appState.history.length}</strong><span>Outfits logged</span></div>
      <div class="stat-card"><strong>${appState.bannedCombos.length}</strong><span>Banned combos</span></div>
    `;
  }

  function updateTheme(theme) {
    appState.settings.theme = THEME_VALUES.includes(theme) ? theme : "system";
    applyTheme(appState.settings.theme);
    saveState();
    renderSettings();
    showToast("Theme saved.");
  }

  function updateAfterLogging(value) {
    appState.settings.afterLogging = AFTER_LOGGING_VALUES.includes(value) ? value : "confirm_keep";
    saveState();
    renderSettings();
    showToast("After Logging saved.");
  }

  function updateDefaultOccasion(value) {
    appState.settings.defaultOccasion = validOccasion(value);
    if (!currentOutfit) {
      $("#occasionSelect").value = OCCASION_ORDER.includes(appState.settings.defaultOccasion) ? appState.settings.defaultOccasion : "work";
      handleGenerationContextChange();
    }
    saveState();
    renderSettings();
    showToast("Default occasion saved.");
  }

  function applyTheme(theme) {
    const resolvedTheme = THEME_VALUES.includes(theme) ? theme : "system";
    if (resolvedTheme === "system") {
      document.documentElement.removeAttribute("data-theme");
    } else {
      document.documentElement.dataset.theme = resolvedTheme;
    }
  }

  function renderWeatherControls() {
    const weather = appState.settings.weather;
    const freshness = ContextEngine.weatherFreshness(weather.cached);
    const effective = currentEffectiveContext();
    $("#contextMode").value = contextSession.mode;
    $("#manualContextInputs").hidden = contextSession.mode !== "manual";
    $("#manualTemperature").value = contextSession.manualTemperatureC === null
      ? ""
      : Math.round(displayTemperatureValue(contextSession.manualTemperatureC, weather.unit) * 10) / 10;
    $("#manualCondition").value = contextSession.manualCondition;
    $("#temperatureUnit").value = weather.unit;
    $("#temperatureUnitSuffix").textContent = weather.unit === "c" ? "°C" : "°F";
    $("#feelsAdjustment").value = contextSession.adjustment;
    $("#contextExposure").value = contextSession.exposure;
    $("#expectRain").checked = contextSession.rainExpected;
    $("#ignoreWeather").checked = contextSession.ignore;
    $("#acceptStaleWeather").checked = contextSession.acceptStale;
    $("#staleWeatherControl").hidden = contextSession.mode !== "automatic" || freshness !== "stale";
    $("#refreshWeatherBtn").hidden = !weather.automatic && !weather.cached;
    $("#disableWeatherBtn").hidden = !weather.automatic && !weather.cached;
    $("#useCurrentLocationBtn").disabled = weatherBusy;
    $("#refreshWeatherBtn").disabled = weatherBusy;

    let status = weatherMessage;
    if (weatherBusy) status = "Refreshing current conditions…";
    else if (!status && weather.cached) {
      const label = freshness === "fresh"
        ? (weatherSessionFetchedAt === weather.cached.fetchedAt ? "Current" : "Cached current")
        : (freshness === "stale" ? "Stale cached" : "Expired cached");
      status = `${label}; fetched ${formatContextTime(weather.cached.fetchedAt)}. ${freshness === "expired" ? "It will not affect generation." : ""}`.trim();
    } else if (!status && locationPermission === "denied") status = "Location is denied. Manual context remains available.";
    else if (!status && locationPermission === "unavailable") status = "Location is unavailable. Manual context remains available.";
    else if (!status) status = "No location request has been made.";
    $("#weatherStatus").textContent = status;
    $("#weatherSummary").textContent = contextSummary(effective);
  }

  function weatherResultLabel() {
    const context = currentOutfit?.context;
    if (!context || context.source === "none") return "";
    return `<span class="weather-badge">${escapeHtml(contextSummary(context))}</span>`;
  }

  function createContextSession() {
    const weather = appState?.settings?.weather || {};
    return {
      mode: weather.automatic || weather.cached ? "automatic" : "manual",
      manualTemperatureC: null,
      manualCondition: "unknown",
      adjustment: "same",
      exposure: "outdoors",
      rainExpected: false,
      ignore: false,
      acceptStale: false
    };
  }

  function currentEffectiveContext() {
    const unit = appState.settings.weather.unit;
    return ContextEngine.deriveEffectiveContext({
      mode: contextSession.mode,
      cachedWeather: appState.settings.weather.cached,
      currentSessionFetchedAt: weatherSessionFetchedAt,
      acceptStale: contextSession.acceptStale,
      manualTemperature: contextSession.manualTemperatureC === null
        ? null : displayTemperatureValue(contextSession.manualTemperatureC, unit),
      manualCondition: contextSession.manualCondition,
      unit,
      adjustment: contextSession.adjustment,
      exposure: contextSession.exposure,
      rainExpected: contextSession.rainExpected,
      ignore: contextSession.ignore
    });
  }

  function handleContextControlChange() {
    contextSession.mode = $("#contextMode").value === "automatic" ? "automatic" : "manual";
    contextSession.acceptStale = $("#acceptStaleWeather").checked;
    contextSession.manualTemperatureC = ContextEngine.nullableTemperature(
      $("#manualTemperature").value,
      appState.settings.weather.unit
    );
    contextSession.manualCondition = ContextEngine.CONDITIONS.includes($("#manualCondition").value)
      ? $("#manualCondition").value : "unknown";
    contextSession.adjustment = ContextEngine.ADJUSTMENTS.includes($("#feelsAdjustment").value)
      ? $("#feelsAdjustment").value : "same";
    contextSession.exposure = ContextEngine.EXPOSURES.includes($("#contextExposure").value)
      ? $("#contextExposure").value : "outdoors";
    contextSession.rainExpected = $("#expectRain").checked;
    contextSession.ignore = $("#ignoreWeather").checked;
    weatherMessage = "";
    handleGenerationContextChange();
    renderWeatherControls();
  }

  function changeTemperatureUnit() {
    const previousUnit = appState.settings.weather.unit;
    contextSession.manualTemperatureC = ContextEngine.nullableTemperature(
      $("#manualTemperature").value,
      previousUnit
    );
    appState.settings.weather.unit = $("#temperatureUnit").value === "c" ? "c" : "f";
    if (!saveState()) appState.settings.weather.unit = previousUnit;
    handleGenerationContextChange();
    renderWeatherControls();
  }

  async function initializeAutomaticWeather() {
    locationPermission = await ContextEngine.permissionState(navigator.permissions, navigator.geolocation);
    if (!appState.settings.weather.automatic || locationPermission !== "granted") {
      renderWeatherControls();
      return;
    }
    if (ContextEngine.weatherFreshness(appState.settings.weather.cached) === "fresh") {
      renderWeatherControls();
      return;
    }
    await refreshWeather({ force: false, userInitiated: false });
  }

  function resolveAutomaticContextForGeneration() {
    if (!appState.settings.weather.automatic || contextSession.mode !== "automatic" || contextSession.ignore) return null;
    if (ContextEngine.weatherFreshness(appState.settings.weather.cached) === "fresh") return null;
    return (async () => {
      locationPermission = await ContextEngine.permissionState(navigator.permissions, navigator.geolocation);
      if (locationPermission === "granted") {
        await refreshWeather({ force: false, userInitiated: false, generationInitiated: true });
        return;
      }
      if (locationPermission === "unsupported" && !automaticAttemptWithoutPermissionsApi) {
        automaticAttemptWithoutPermissionsApi = true;
        await refreshWeather({ force: false, userInitiated: false, generationInitiated: true });
        return;
      }
      const label = locationPermission === "prompt"
        ? "Location permission still needs an explicit Use Current Location action."
        : (locationPermission === "denied"
          ? "Location permission is unavailable."
          : "Current location is unavailable in this browser.");
      weatherMessage = `${label} Automatic weather remains enabled; using the available fallback.`;
      renderWeatherControls();
    })();
  }

  function refreshWeather(options = {}) {
    if (weatherRefreshPromise) return weatherRefreshPromise;
    weatherRefreshPromise = performWeatherRefresh(options)
      .finally(() => { weatherRefreshPromise = null; });
    return weatherRefreshPromise;
  }

  async function performWeatherRefresh(options = {}) {
    if (options.userInitiated) automaticAttemptWithoutPermissionsApi = false;
    const previousWeather = { ...appState.settings.weather };
    const previousMode = contextSession.mode;
    const previousAcceptStale = contextSession.acceptStale;
    const previousSessionFetchedAt = weatherSessionFetchedAt;
    weatherBusy = true;
    weatherMessage = "";
    renderWeatherControls();
    try {
      const record = await weatherClient.refresh({ force: options.force === true, maximumAge: options.force ? 0 : ContextEngine.FRESH_MAX_MS });
      appState.settings.weather.cached = record;
      appState.settings.weather.automatic = true;
      contextSession.mode = "automatic";
      contextSession.acceptStale = false;
      weatherSessionFetchedAt = record.fetchedAt;
      locationPermission = "granted";
      if (!saveState()) throw Object.assign(new Error("Weather was fetched but could not be saved."), { code: "STORAGE_WRITE_FAILED" });
      weatherMessage = `Current conditions fetched ${formatContextTime(record.fetchedAt)}.`;
      handleGenerationContextChange();
      return true;
    } catch (error) {
      if (error?.code === "STORAGE_WRITE_FAILED") {
        appState.settings.weather = previousWeather;
        contextSession.mode = previousMode;
        contextSession.acceptStale = previousAcceptStale;
        weatherSessionFetchedAt = previousSessionFetchedAt;
      }
      if (error?.code === "REQUEST_CANCELLED") return false;
      if (error?.code === "RATE_LIMITED") {
        weatherMessage = "Automatic weather was refreshed recently. Using the available context fallback.";
        return false;
      }
      if (error?.code === "LOCATION_DENIED") locationPermission = "denied";
      if (["LOCATION_UNAVAILABLE", "LOCATION_TIMEOUT"].includes(error?.code)) locationPermission = "unavailable";
      if (!navigator.permissions && ["LOCATION_DENIED", "LOCATION_UNAVAILABLE", "LOCATION_TIMEOUT"].includes(error?.code)) {
        automaticAttemptWithoutPermissionsApi = true;
      }
      weatherMessage = `${error?.message || "Weather could not be refreshed."} Manual context remains available.`;
      if (options.userInitiated && !appState.settings.weather.cached) contextSession.mode = "manual";
      return false;
    } finally {
      weatherBusy = false;
      renderWeatherControls();
    }
  }

  function disableAutomaticWeather() {
    weatherClient.cancel();
    const previousWeather = { ...appState.settings.weather };
    const previousMode = contextSession.mode;
    const previousAcceptStale = contextSession.acceptStale;
    const previousSessionFetchedAt = weatherSessionFetchedAt;
    appState.settings.weather.automatic = false;
    appState.settings.weather.cached = null;
    contextSession.mode = "manual";
    contextSession.acceptStale = false;
    weatherSessionFetchedAt = "";
    automaticAttemptWithoutPermissionsApi = false;
    weatherMessage = "Automatic weather disabled and cached context deleted. Closet data was not changed.";
    if (!saveState()) {
      appState.settings.weather = previousWeather;
      contextSession.mode = previousMode;
      contextSession.acceptStale = previousAcceptStale;
      weatherSessionFetchedAt = previousSessionFetchedAt;
      weatherMessage = "Automatic weather could not be disabled because local storage was unavailable.";
    }
    handleGenerationContextChange();
    renderWeatherControls();
  }

  function contextSummary(context) {
    if (!context || context.source === "none") {
      if (context?.availability === "expired") return "Expired";
      if (context?.availability === "stale") return "Stale available";
      return context?.mode === "automatic" ? "No current weather" : "Manual ready";
    }
    if (context.ignored) return "Ignored";
    const temperature = context.effectiveTemperatureC === null ? "" : `${ContextEngine.formatTemperature(context.effectiveTemperatureC, appState.settings.weather.unit)} · `;
    const source = context.source === "cached"
      ? (context.availability === "stale" ? "Stale cached" : "Cached current")
      : ({ current: "Current", manual: "Manual" }[context.source] || "Context");
    return `${temperature}${source}${context.adjusted ? " · Adjusted" : ""}`;
  }

  function displayTemperatureValue(celsius, unit) {
    return unit === "c" ? Number(celsius) : ContextEngine.celsiusToFahrenheit(Number(celsius));
  }

  function formatContextTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "at an unknown time";
    return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(date);
  }

  function handleClosetAction(event) {
    const button = event.target.closest("[data-action]");
    if (!button) return;
    const card = button.closest("[data-item-id]");
    const itemId = card?.dataset.itemId;
    if (!itemId) return;

    if (button.dataset.action === "edit") {
      openItemDialog(itemId);
    } else if (button.dataset.action === "add-similar") {
      openItemDialog(itemId, { addSimilar: true });
    }
  }

  function handleHistoryAction(event) {
    const button = event.target.closest("[data-action='delete-log']");
    if (!button) return;
    const card = button.closest("[data-log-id]");
    const logId = card?.dataset.logId;
    if (!logId) return;
    deleteHistoryRecord(logId);
  }

  function openItemDialog(itemId = null, options = {}) {
    const source = itemId ? findItem(itemId) : null;
    const item = options.addSimilar && source ? similarItem(source) : source || emptyItem();
    editingItemId = source && !options.addSimilar ? item.id : null;
    addSimilarSourceId = options.addSimilar && source ? source.id : null;
    itemEditorOriginalColors = { primary: item.primaryColor || "", secondary: item.secondaryColor || "" };

    $("#itemDialogMode").textContent = editingItemId ? "Editing Smart Closet item" : (addSimilarSourceId ? "Add Similar" : "Quick Add");
    $("#itemId").value = editingItemId || "";
    $("#itemName").value = item.name || "";
    updateEditorTitle();
    $("#itemCategory").value = item.category || "top";
    renderSubtypeOptions(item.subtype);
    setColorControl("primary", item.primaryColor || "");
    setColorControl("secondary", item.secondaryColor || "");
    $("#itemPattern").value = item.pattern || "solid";
    $("#itemFormality").value = item.formality || 3;
    $("#itemSleeveLength").value = item.sleeveLength || "unspecified";
    $("#itemBottomLength").value = item.bottomLength || "not_applicable";
    $("#itemWarmth").value = item.warmth || "unspecified";
    $("#itemRainPolicy").value = item.rainPolicy || "unspecified";
    $("#itemRainProtection").value = item.rainProtection || "unspecified";
    $("#itemWindProtection").value = item.windProtection || "unspecified";
    $$("input[name='itemLayerRole']").forEach((input) => {
      input.checked = (item.layerRoles || []).includes(input.value);
    });
    $("#itemStatus").value = item.status || "available";
    $("#itemPreference").value = item.preference || "neutral";
    $("#itemLabels").value = (item.labels || []).join(", ");
    $$("input[name='itemBeltMode']").forEach((input) => {
      input.checked = input.value === item.beltMode;
    });
    $("#itemImageUrl").value = item.imageUrl || "";
    $("#itemImageField").hidden = !item.imageUrl;
    $("#itemNotes").value = item.notes || "";
    $("#formError").hidden = true;
    $("#formError").textContent = "";
    itemSaveInProgress = false;

    renderItemOccasionOptions(item.occasions.includes("gym"));
    $$("input[name='itemOccasion']").forEach((input) => {
      input.checked = item.occasions.includes(input.value);
    });

    $("#addSimilarBtn").hidden = !editingItemId;
    $("#permanentDeleteBtn").hidden = !editingItemId;
    $("#matchingDetails").open = Boolean(editingItemId);
    $("#advancedDetails").open = false;
    $("#preferDetails").open = false;
    $("#neverDetails").open = false;
    relationshipRendered = { prefer: false, never: false };
    const reviewReasons = item.review?.reasons || [];
    $("#itemReviewNotice").hidden = item.review?.status !== "needs_review";
    $("#itemReviewNotice").innerHTML = reviewReasons.length
      ? `<strong>Review requested</strong><ul>${reviewReasons.map((reason) => `<li>${escapeHtml(reason)}</li>`).join("")}</ul>`
      : "";
    $("#legacyMatchingNotice").hidden = !item.legacyFallback;
    $("#legacyMatchingNotice").textContent = item.legacyFallback
      ? "Legacy matching remains active for this migrated item. Saving valid Smart Closet settings will retire only this item's fallback; the legacy data remains preserved."
      : "";
    renderPairRelationshipOptions(item.id, options.addSimilar === true);
    renderBeltModeControl();
    renderLayerControls();
    updateSecondaryColorAvailability();
    updateSelectedColorChip();

    const dialog = $("#itemDialog");
    if (typeof dialog.showModal === "function") {
      dialog.showModal();
    } else {
      dialog.setAttribute("open", "");
    }
    resetItemEditorScroll();
    itemEditorBaseline = itemEditorSnapshot();
    updateEditorDirtyState();
    if (options.addSimilar && typeof $("#itemName").focus === "function") $("#itemName").focus({ preventScroll: true });
  }

  function updateEditorTitle() {
    const name = $("#itemName").value.trim();
    $("#itemDialogTitle").textContent = name || "Add Item";
  }

  function closeItemDialog(options = {}) {
    if (!options.force) return requestEditorExit(options.reason || "close", options);
    return finalizeEditorClose();
  }

  function finalizeEditorClose() {
    closeDialog($("#itemExitDialog"));
    closeDialog($("#itemDialog"));
    editingItemId = null;
    addSimilarSourceId = null;
    itemEditorBaseline = "";
    itemEditorOriginalColors = { primary: "", secondary: "" };
    pendingEditorExit = null;
    updateBeforeUnloadGuard(false);
    return true;
  }

  function requestEditorExit(reason = "close", options = {}) {
    const dialog = $("#itemDialog");
    if (!dialog.open && !(typeof dialog.hasAttribute === "function" && dialog.hasAttribute("open"))) return true;
    const continuation = typeof options.continuation === "function" ? options.continuation : null;
    if (!isItemEditorDirty()) {
      finalizeEditorClose();
      continuation?.();
      return true;
    }
    pendingEditorExit = { reason, continuation };
    $("#itemExitDescription").textContent = reason === "navigation"
      ? "Save or discard this item before leaving the editor."
      : "This item has unsaved changes.";
    openDialog($("#itemExitDialog"));
    return false;
  }

  function savePendingEditorExit() {
    const continuation = pendingEditorExit?.continuation || null;
    closeDialog($("#itemExitDialog"));
    pendingEditorExit = null;
    saveItemFromEditor({ afterSave: continuation });
  }

  function discardPendingEditorExit() {
    const continuation = pendingEditorExit?.continuation || null;
    finalizeEditorClose();
    continuation?.();
  }

  function continuePendingEditorExit() {
    pendingEditorExit = null;
    closeDialog($("#itemExitDialog"));
    updateBeforeUnloadGuard(isItemEditorDirty());
  }

  function handleItemDialogCancel(event) {
    event.preventDefault();
    requestEditorExit("escape");
  }

  function handleItemDialogBackdrop(event) {
    if (event.target === $("#itemDialog")) requestEditorExit("backdrop");
  }

  function handleEditorNavigation() {
    if ($("#itemDialog").open) requestEditorExit("navigation");
  }

  function isItemEditorDirty() {
    return Boolean(itemEditorBaseline && itemEditorSnapshot() !== itemEditorBaseline);
  }

  function updateEditorDirtyState() {
    updateBeforeUnloadGuard(isItemEditorDirty());
  }

  function updateBeforeUnloadGuard(active) {
    const shouldBeActive = active === true;
    if (shouldBeActive === unloadGuardActive) return;
    if (shouldBeActive) window.addEventListener("beforeunload", handleItemBeforeUnload);
    else window.removeEventListener?.("beforeunload", handleItemBeforeUnload);
    unloadGuardActive = shouldBeActive;
  }

  function handleItemBeforeUnload(event) {
    if (!isItemEditorDirty()) return;
    event.preventDefault();
    event.returnValue = "";
  }

  function saveItemFromForm(event) {
    event.preventDefault();
    saveItemFromEditor({ generateAfter: false });
  }

  function saveItemFromEditor({ generateAfter = false, addSimilarAfter = false, afterSave = null } = {}) {
    const dialog = $("#itemDialog");
    if (!dialog.open && !(typeof dialog.hasAttribute === "function" && dialog.hasAttribute("open"))) return false;
    if (storageWriteLocked) {
      showToast("Data is locked to protect the original closet.");
      return false;
    }
    if (itemSaveInProgress) return false;
    itemSaveInProgress = true;

    try {
      const item = collectItemFromForm();
      const issue = validateItem(item);
      if (issue) {
        showItemFormError(issue);
        return false;
      }

      const now = new Date().toISOString();
      const nextState = JSON.parse(JSON.stringify(appState));
      let savedItemId = editingItemId;
      let successMessage = "Item saved.";
      if (editingItemId) {
        const index = nextState.wardrobe.findIndex((existing) => existing.id === editingItemId);
        if (index === -1) {
          showItemFormError({ message: "This item no longer exists. Close the editor and try again.", selector: "#formError" });
          return false;
        }
        nextState.wardrobe[index] = {
          ...nextState.wardrobe[index],
          ...item,
          id: editingItemId,
          review: { status: "reviewed", reasons: [], reviewedAt: now },
          legacyFallback: false,
          updatedAt: now
        };
      } else {
        const savedItem = SmartCloset.createItem({
          ...item,
          id: uid("item"),
          status: "available",
          review: { status: "reviewed", reasons: [], reviewedAt: now },
          legacyFallback: false,
          legacyMatching: {},
          lastWorn: null,
          createdAt: now,
          updatedAt: now
        }, { now });
        nextState.wardrobe.push(savedItem);
        savedItemId = savedItem.id;
        successMessage = "Item added.";
      }

      syncPairRelationships(nextState, savedItemId, selectedOptions($("#preferItemsSelect")), selectedOptions($("#neverItemsSelect")), now);
      if (!persistEditorState(nextState)) {
        showItemFormError({ message: "Item was not saved. Local storage may be full or unavailable.", selector: "#formError" });
        return false;
      }

      appState = nextState;
      invalidateGenerationState();
      closeItemDialog({ force: true });
      renderAll();
      showToast(successMessage);
      if (addSimilarAfter && savedItemId) {
        openItemDialog(savedItemId, { addSimilar: true });
      } else if (typeof afterSave === "function") {
        afterSave(savedItemId);
      } else if (generateAfter && savedItemId) {
        generateWithItem(savedItemId);
      }
      return true;
    } finally {
      itemSaveInProgress = false;
    }
  }

  function persistEditorState(nextState) {
    try {
      SmartCloset.validateState(nextState);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
      return true;
    } catch (error) {
      console.error(error);
      return false;
    }
  }

  function collectItemFromForm() {
    const category = $("#itemCategory").value;
    return {
      id: $("#itemId").value,
      name: $("#itemName").value.trim(),
      category,
      subtype: $("#itemSubtype").value,
      primaryColor: colorControlValue("primary"),
      secondaryColor: $("#itemPattern").value === "solid" ? "" : colorControlValue("secondary"),
      pattern: $("#itemPattern").value,
      sleeveLength: ["top", "layer"].includes(category) ? $("#itemSleeveLength").value : "not_applicable",
      bottomLength: category === "bottom" ? $("#itemBottomLength").value : "not_applicable",
      occasions: $$("input[name='itemOccasion']:checked").map((input) => input.value),
      formality: Number($("#itemFormality").value),
      beltMode: category === "bottom" ? ($("input[name='itemBeltMode']:checked")?.value || "optional") : "",
      warmth: $("#itemWarmth").value,
      rainPolicy: $("#itemRainPolicy").value,
      layerRoles: ["top", "layer"].includes(category)
        ? $$("input[name='itemLayerRole']:checked").map((input) => input.value)
        : [],
      rainProtection: ["top", "layer"].includes(category) ? $("#itemRainProtection").value : "none",
      windProtection: ["top", "layer"].includes(category) ? $("#itemWindProtection").value : "none",
      status: $("#itemStatus").value,
      preference: $("#itemPreference").value,
      labels: parseCsv($("#itemLabels").value),
      imageUrl: $("#itemImageUrl").value.trim(),
      notes: $("#itemNotes").value.trim()
    };
  }

  function validateItem(item) {
    if (!item.name) return { message: "Name is required.", selector: "#itemName" };
    if (!item.category) return { message: "Category is required.", selector: "#itemCategory" };
    if (!item.subtype) return { message: "Subtype is required.", selector: "#itemSubtype" };
    if (!item.primaryColor) return { message: "Primary color is required. Choose a listed color or enter a custom color.", selector: "#itemPrimaryColor" };
    if (!validColorValue(item.primaryColor, "primary")) return { message: "Primary color must be a clear name using letters, numbers, spaces, hyphens, slashes, apostrophes, or parentheses.", selector: "#itemPrimaryColorCustom" };
    if (item.secondaryColor && !validColorValue(item.secondaryColor, "secondary")) return { message: "Secondary color must be a clear color name.", selector: "#itemSecondaryColorCustom" };
    if (!item.occasions.length) return { message: "Choose at least one occasion.", selector: "#itemOccasions" };
    if (["top", "layer"].includes(item.category) && !item.layerRoles.length) {
      return { message: "Choose at least one eligible layer role.", selector: "#layerRoleFieldset" };
    }
    const preferred = selectedOptions($("#preferItemsSelect"));
    const never = selectedOptions($("#neverItemsSelect"));
    if (preferred.some((id) => never.includes(id))) return { message: "An item cannot be both preferred and never paired.", selector: "#preferDetails" };
    return null;
  }

  function handleItemFormClick(event) {
    const templateButton = event.target.closest("[data-template-id]");
    if (templateButton) {
      applyTemplate(templateButton.dataset.templateId);
      return;
    }

    const colorButton = event.target.closest("[data-color]");
    if (colorButton) {
      const selected = normalizeTag(colorControlValue("primary")) === normalizeTag(colorButton.dataset.color);
      setColorControl("primary", selected ? "" : colorButton.dataset.color);
      updateSelectedColorChip();
      return;
    }

    const presetButton = event.target.closest("[data-occasion-preset]");
    if (presetButton) {
      applyOccasionPreset(presetButton.dataset.occasionPreset);
      return;
    }

  }

  function applyTemplate(templateId) {
    const template = SmartCloset.SUBTYPE_TEMPLATES[templateId];
    if (!template) return;
    $("#itemCategory").value = template.category;
    renderSubtypeOptions(templateId);
    $("#itemFormality").value = template.formality;
    $("#itemPattern").value = template.pattern;
    $("#itemSleeveLength").value = template.sleeveLength;
    $("#itemBottomLength").value = template.bottomLength;
    $("#itemWarmth").value = template.warmth;
    $("#itemRainPolicy").value = template.rainPolicy;
    $("#itemRainProtection").value = template.rainProtection;
    $("#itemWindProtection").value = template.windProtection;
    $$("input[name='itemLayerRole']").forEach((input) => {
      input.checked = (template.layerRoles || []).includes(input.value);
    });
    if (template.category === "bottom") {
      const beltInput = $(`input[name='itemBeltMode'][value='${template.beltMode || "optional"}']`);
      if (beltInput) beltInput.checked = true;
    }
    applyOccasions(template.occasions || []);
    renderBeltModeControl();
    renderLayerControls();
    updateSecondaryColorAvailability();
    refreshPairRelationshipOptions();
    showToast(`${SmartCloset.titleCase(templateId)} defaults applied.`);
  }

  function similarItem(source) {
    const now = new Date().toISOString();
    const similar = SmartCloset.createItem({
      name: "",
      category: source.category,
      subtype: source.subtype,
      primaryColor: source.primaryColor,
      secondaryColor: source.secondaryColor,
      pattern: source.pattern,
      sleeveLength: source.sleeveLength,
      bottomLength: source.bottomLength,
      formality: source.formality,
      occasions: [...source.occasions],
      warmth: source.warmth,
      rainPolicy: source.rainPolicy,
      layerRoles: [...source.layerRoles],
      rainProtection: source.rainProtection,
      windProtection: source.windProtection,
      preference: source.preference,
      labels: [...source.labels],
      beltMode: source.beltMode,
      status: "available",
      lastWorn: null,
      imageUrl: "",
      notes: "",
      legacyFallback: false,
      legacyMatching: {},
      review: { status: "reviewed", reasons: [], reviewedAt: now },
      createdAt: now,
      updatedAt: now
    }, { now });
    return { ...similar, name: "", notes: "", imageUrl: "", status: "available", lastWorn: null };
  }

  function renderPairRelationshipOptions(itemId, clearSelections = false, selectionOverride = null) {
    const relationships = itemId && !clearSelections
      ? appState.pairRelationships.filter((record) => record.itemIds.includes(itemId))
      : [];
    const selectedFor = (type) => new Set(selectionOverride?.[type] || relationships
      .filter((record) => record.type === type)
      .flatMap((record) => record.itemIds)
      .filter((id) => id !== itemId));

    ["prefer", "never"].forEach((type) => {
      const selected = selectedFor(type);
      const optionItems = [...selected].map(findItem).filter(Boolean).sort(sortItems);
      $(`#${type}ItemsSelect`).innerHTML = optionItems.map((item) => {
        return `<option value="${escapeAttribute(item.id)}" ${selected.has(item.id) ? "selected" : ""}>${escapeHtml(item.name)}</option>`;
      }).join("");
      $(`#${type}ItemsGroup`).innerHTML = `<option value="">Open to load compatible garments</option>`;
      $(`#${type}ItemsChoices`).innerHTML = "";
      $(`#${type}ItemsLegacy`).innerHTML = "";
      $(`#${type}ItemsLegacy`).hidden = true;
      relationshipRendered[type] = false;
      updateRelationshipCount(type);
    });
  }

  function handleRelationshipDisclosureToggle(type) {
    if ($(`#${type}Details`).open && !relationshipRendered[type]) renderRelationshipDisclosure(type);
  }

  function renderRelationshipDisclosure(type) {
    const candidates = relationshipCandidates();
    const priorGroup = $(`#${type}ItemsGroup`).value;
    const groups = CATEGORY_ORDER.map((category) => ({
      category,
      items: candidates.filter((item) => item.category === category)
    })).filter((group) => group.items.length);
    $(`#${type}ItemsGroup`).innerHTML = groups.length
      ? groups.map((group) => `<option value="${group.category}">${escapeHtml(CATEGORIES[group.category])} (${group.items.length})</option>`).join("")
      : `<option value="">No compatible groups</option>`;
    if (groups.some((group) => group.category === priorGroup)) $(`#${type}ItemsGroup`).value = priorGroup;
    renderRelationshipChoiceGroup(type, candidates);
    renderLegacyRelationshipChoices(type, editingItemId, candidates);
    relationshipRendered[type] = true;
  }

  function relationshipCandidates(itemId = editingItemId) {
    const draft = {
      ...(itemId ? findItem(itemId) : emptyItem()),
      id: itemId || "__draft_item__",
      category: $("#itemCategory").value || "top",
      layerRoles: $$("input[name='itemLayerRole']:checked").map((input) => input.value)
    };
    return appState.wardrobe
      .filter((item) => item.id !== itemId && SmartCloset.canWearTogether(draft, item))
      .sort(sortItems);
  }

  function renderRelationshipChoiceGroup(type, providedCandidates = null) {
    if (!$(`#${type}Details`).open) return;
    const group = $(`#${type}ItemsGroup`).value;
    const selected = new Set(selectedOptions($(`#${type}ItemsSelect`)));
    const items = (providedCandidates || relationshipCandidates()).filter((item) => item.category === group);
    $(`#${type}ItemsChoices`).innerHTML = items.length ? items.map((item) => `
      <label class="relationship-choice">
        <input type="checkbox" data-relationship-type="${type}" data-relationship-item-id="${escapeAttribute(item.id)}" ${selected.has(item.id) ? "checked" : ""}>
        <span>${escapeHtml(item.name)}${isAvailable(item) ? "" : ` (${escapeHtml(SmartCloset.titleCase(item.status))})`}</span>
      </label>
    `).join("") : `<p class="small-meta">No compatible garments in this group.</p>`;
  }

  function renderLegacyRelationshipChoices(type, itemId = editingItemId, providedCandidates = null) {
    const selected = new Set(selectedOptions($(`#${type}ItemsSelect`)));
    const compatibleIds = new Set((providedCandidates || relationshipCandidates(itemId)).map((item) => item.id));
    const incompatible = [...selected].map(findItem).filter((item) => item && !compatibleIds.has(item.id));
    const container = $(`#${type}ItemsLegacy`);
    container.hidden = !incompatible.length;
    container.innerHTML = incompatible.length ? `
      <strong>Stored exceptions (not used for matching)</strong>
      ${incompatible.map((item) => `
        <label class="relationship-choice">
          <input type="checkbox" data-relationship-type="${type}" data-relationship-item-id="${escapeAttribute(item.id)}" checked>
          <span>${escapeHtml(item.name)} — incompatible wearable slot; clear to remove</span>
        </label>
      `).join("")}
    ` : "";
  }

  function handleRelationshipChoice(event) {
    const input = event.target.closest("[data-relationship-type][data-relationship-item-id]");
    if (!input) return;
    const type = input.dataset.relationshipType;
    const otherType = type === "prefer" ? "never" : "prefer";
    setRelationshipSelection(type, input.dataset.relationshipItemId, input.checked);
    if (input.checked) setRelationshipSelection(otherType, input.dataset.relationshipItemId, false);
    renderRelationshipChoiceGroup(type);
    renderRelationshipChoiceGroup(otherType);
    renderLegacyRelationshipChoices(type);
    renderLegacyRelationshipChoices(otherType);
    updateRelationshipCount(type);
    updateRelationshipCount(otherType);
    updateEditorDirtyState();
  }

  function setRelationshipSelection(type, itemId, selected) {
    const select = $(`#${type}ItemsSelect`);
    let option = Array.from(select.options || []).find((entry) => entry.value === itemId);
    if (!option && selected) {
      option = document.createElement("option");
      option.value = itemId;
      option.textContent = findItem(itemId)?.name || itemId;
      option.selected = true;
      if (typeof select.appendChild === "function") select.appendChild(option);
    }
    if (option) option.selected = selected;
    if (option && !selected && typeof option.remove === "function") option.remove();
  }

  function updateRelationshipCount(type) {
    const count = selectedOptions($(`#${type}ItemsSelect`)).length;
    $(`#${type}ItemsCount`).textContent = `${count} selected`;
  }

  function refreshPairRelationshipOptions() {
    renderPairRelationshipOptions(editingItemId, false, {
      prefer: selectedOptions($("#preferItemsSelect")),
      never: selectedOptions($("#neverItemsSelect"))
    });
    ["prefer", "never"].forEach((type) => {
      if ($(`#${type}Details`).open) renderRelationshipDisclosure(type);
    });
  }

  function syncPairRelationships(state, itemId, preferredIds, neverIds, now) {
    const desired = new Map();
    unique(preferredIds).forEach((otherId) => desired.set(SmartCloset.canonicalPair(itemId, otherId).join("|"), "prefer"));
    unique(neverIds).forEach((otherId) => desired.set(SmartCloset.canonicalPair(itemId, otherId).join("|"), "never"));
    const existingForItem = state.pairRelationships.filter((record) => record.itemIds.includes(itemId));
    const untouched = state.pairRelationships.filter((record) => !record.itemIds.includes(itemId));
    const updated = [];
    desired.forEach((type, pairKey) => {
      if (!pairKey.includes("|")) return;
      const existing = existingForItem.find((record) => record.itemIds.join("|") === pairKey && record.type === type);
      updated.push(existing || { id: uid("pair"), type, itemIds: pairKey.split("|"), createdAt: now, updatedAt: now });
    });
    state.pairRelationships = [...untouched, ...updated];
  }

  function renderBeltModeControl() {
    const isBottom = $("#itemCategory").value === "bottom";
    $("#beltModeFieldset").hidden = !isBottom;
    if (isBottom && !$("input[name='itemBeltMode']:checked")) {
      const optional = $("input[name='itemBeltMode'][value='optional']");
      if (optional) optional.checked = true;
    }
  }

  function renderLayerControls() {
    const applicable = ["top", "layer"].includes($("#itemCategory").value);
    $("#layerRoleFieldset").hidden = !applicable;
    $("#itemRainProtection").disabled = !applicable;
    $("#itemWindProtection").disabled = !applicable;
    if (!applicable) {
      $$("input[name='itemLayerRole']").forEach((input) => { input.checked = false; });
      $("#itemRainProtection").value = "none";
      $("#itemWindProtection").value = "none";
    }
  }

  function applyOccasionPreset(preset) {
    const presets = {
      office: ["work", "friday", "date"],
      casual: ["friday", "casual", "athletic"],
      all: OCCASION_ORDER,
      clear: []
    };
    const selected = new Set(presets[preset] || []);
    $$("input[name='itemOccasion']").forEach((input) => {
      input.checked = selected.has(input.value);
    });
  }

  function applyOccasions(occasions) {
    const selected = new Set(occasions);
    $$("input[name='itemOccasion']").forEach((input) => {
      input.checked = selected.has(input.value);
    });
  }

  function renderColorOptions() {
    const canonicalOptions = COLOR_OPTIONS.map((color) => {
      const value = SmartCloset.titleCase(color);
      return `<option value="${escapeAttribute(value)}">${escapeHtml(value)}</option>`;
    }).join("");
    $("#itemPrimaryColor").innerHTML = `<option value="">Choose a color</option>${canonicalOptions}<option value="${CUSTOM_COLOR_VALUE}">Custom color…</option>`;
    $("#itemSecondaryColor").innerHTML = `<option value="">No secondary color</option>${canonicalOptions}<option value="${CUSTOM_COLOR_VALUE}">Custom color…</option>`;
  }

  function setColorControl(kind, value) {
    const select = $(`#item${capitalize(kind)}Color`);
    const custom = $(`#item${capitalize(kind)}ColorCustom`);
    const exact = String(value || "");
    const canonical = COLOR_OPTIONS.find((color) => normalizeTag(color) === normalizeTag(exact));
    if (!exact) {
      select.value = "";
      custom.value = "";
    } else if (canonical) {
      select.value = SmartCloset.titleCase(canonical);
      custom.value = "";
    } else {
      select.value = CUSTOM_COLOR_VALUE;
      custom.value = exact;
    }
    updateColorControl(kind, false);
  }

  function updateColorControl(kind, focusCustom = false) {
    const select = $(`#item${capitalize(kind)}Color`);
    const custom = $(`#item${capitalize(kind)}ColorCustom`);
    custom.hidden = select.value !== CUSTOM_COLOR_VALUE;
    custom.disabled = custom.hidden || (kind === "secondary" && $("#itemPattern").value === "solid");
    if (focusCustom && !custom.hidden && typeof custom.focus === "function") custom.focus();
    if (kind === "primary") updateSelectedColorChip();
  }

  function colorControlValue(kind) {
    const select = $(`#item${capitalize(kind)}Color`);
    if (select.value === CUSTOM_COLOR_VALUE) return $(`#item${capitalize(kind)}ColorCustom`).value.trim();
    return select.value.trim();
  }

  function validColorValue(value, kind) {
    const text = String(value || "").trim();
    if (text && text === itemEditorOriginalColors[kind]) return true;
    return Boolean(text && text.length <= 40 && /^[\p{L}\p{N}][\p{L}\p{N}\s/&'().-]*$/u.test(text));
  }

  function updateSecondaryColorAvailability() {
    const solid = $("#itemPattern").value === "solid";
    $("#itemSecondaryColor").disabled = solid;
    $("#secondaryColorField").classList.toggle("is-disabled", solid);
    $("#secondaryColorHint").hidden = !solid;
    updateColorControl("secondary");
  }

  function showItemFormError(issue) {
    const error = $("#formError");
    error.textContent = issue.message;
    error.hidden = false;
    const field = $(issue.selector || "#formError") || error;
    let details = typeof field.closest === "function" ? field.closest("details") : null;
    while (details) {
      details.open = true;
      details = typeof details.parentElement?.closest === "function" ? details.parentElement.closest("details") : null;
    }
    const reveal = () => {
      if (typeof field.scrollIntoView === "function") field.scrollIntoView({ behavior: "smooth", block: "center" });
      if (field !== error && typeof field.focus === "function") field.focus({ preventScroll: true });
    };
    if (typeof window.requestAnimationFrame === "function") window.requestAnimationFrame(reveal);
    else reveal();
  }

  function resetItemEditorScroll() {
    const form = $("#itemForm");
    const dialog = $("#itemDialog");
    const reset = () => {
      form.scrollTop = 0;
      dialog.scrollTop = 0;
      if (typeof form.scrollTo === "function") form.scrollTo({ top: 0, left: 0, behavior: "auto" });
      if (typeof dialog.scrollTo === "function") dialog.scrollTo({ top: 0, left: 0, behavior: "auto" });
    };
    reset();
    if (typeof window.requestAnimationFrame === "function") window.requestAnimationFrame(reset);
  }

  function itemEditorSnapshot() {
    return JSON.stringify({
      item: collectItemFromForm(),
      prefer: selectedOptions($("#preferItemsSelect")).sort(),
      never: selectedOptions($("#neverItemsSelect")).sort()
    });
  }

  function updateSelectedColorChip() {
    const selected = normalizeTag(colorControlValue("primary"));
    $$("[data-color]").forEach((button) => {
      button.classList.toggle("is-selected", normalizeTag(button.dataset.color) === selected);
    });
  }

  function selectedOptions(select) {
    return Array.from(select.selectedOptions || []).map((option) => option.value).filter(Boolean);
  }

  function generateWithItem(itemId) {
    const item = findItem(itemId);
    if (!item) return;
    setActiveScreen("generate");
    $("#occasionSelect").value = item.occasions[0] || "casual";
    const group = buildAroundGroupForItem(item);
    renderBuildAroundOptions({ categoryId: group?.id || "other", selectedItemId: item.id });
    generateAndRender({ mode: "generate" });
  }

  function openSwapDialog(itemId) {
    if (!currentOutfit || currentOutfit.error || currentOutfit.buildAroundId === itemId) return;
    const currentItem = currentOutfit.items.find((item) => item.id === itemId);
    if (!currentItem) return;

    const report = swapChoiceReport(currentItem);
    const choices = report.eligible;
    if (!choices.length) {
      showToast(`No eligible replacements. ${report.excludedSummary}`);
      return;
    }

    swapTargetItemId = currentItem.id;
    const swapLabel = currentOutfit.automaticLayerId === currentItem.id ? "Layer" : (CATEGORIES[currentItem.category] || "Item");
    $("#swapDialogTitle").textContent = `Swap ${swapLabel}`;
    $("#swapSummary").textContent = `${choices.length} eligible replacement${choices.length === 1 ? "" : "s"}. ${report.excludedSummary}`;
    $("#swapChoices").innerHTML = choices.map((choice) => {
      const replacement = choice.items.find((item) => item.id === choice.replacementId);
      return `
        <button class="swap-choice" type="button" data-replacement-id="${escapeAttribute(choice.replacementId)}">
          <span>
            <strong>${escapeHtml(replacement.name)}</strong>
            <small>${escapeHtml(replacement.primaryColor || CATEGORIES[replacement.category])}</small>
          </span>
          <span aria-hidden="true">&rsaquo;</span>
        </button>
      `;
    }).join("");
    openDialog($("#swapDialog"));
  }

  function validSwapChoices(currentItem) {
    return swapChoiceReport(currentItem).eligible;
  }

  function swapChoiceReport(currentItem) {
    const occasionId = currentOutfit.occasion;
    const swappingAutomaticLayer = currentOutfit.automaticLayerId === currentItem.id;
    const excluded = { status: 0, occasion: 0, matching: 0 };
    const eligible = appState.wardrobe
      .filter((item) => item.id !== currentItem.id
        && (swappingAutomaticLayer
          ? hasAutomaticLayerRole(item)
          : (item.category === currentItem.category
            && (currentItem.category !== "top" || (item.layerRoles || []).includes("base")))))
      .map((replacement) => {
        if (!isAvailable(replacement)) {
          excluded.status += 1;
          return null;
        }
        if (!matchesOccasion(replacement, occasionId)) {
          excluded.occasion += 1;
          return null;
        }
        if (swappingAutomaticLayer && !isAutomaticLayerCandidate(replacement)) {
          excluded.matching += 1;
          return null;
        }
        const replaced = currentOutfit.items.map((item) => item.id === currentItem.id ? replacement : item);
        const reconciled = reconcileBeltForOutfit(replaced, occasionId, currentOutfit.buildAroundId, {
          dropOptionalBelt: currentOutfit.optionalBeltRemoved === true
        });
        const sockResolution = reconciled
          ? reconcileSocksForOutfit(reconciled, occasionId, currentOutfit.buildAroundId)
          : null;
        if (!sockResolution || !isCompatibleOutfit(sockResolution.items, occasionId, currentOutfit.buildAroundId)) {
          excluded.matching += 1;
          return null;
        }
        return {
          replacementId: replacement.id,
          items: sortOutfitItems(sockResolution.items),
          automaticLayerId: currentOutfit.automaticLayerId === currentItem.id ? replacement.id : currentOutfit.automaticLayerId,
          automaticSockId: sockResolution.automaticSockId,
          sockMessage: sockResolution.message,
          score: scoreOutfit(sockResolution.items, occasionId, { buildAroundId: currentOutfit.buildAroundId, context: currentOutfit.context }) + sockResolution.scorePenalty
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score);
    const details = Object.entries(excluded).filter(([, count]) => count).map(([reason, count]) => `${count} ${reason}`).join(", ");
    return { eligible, excluded, excludedSummary: details ? `Excluded: ${details}.` : "No other items were excluded." };
  }

  function handleSwapChoice(event) {
    const button = event.target.closest("[data-replacement-id]");
    if (!button || !swapTargetItemId) return;
    const currentItem = currentOutfit?.items.find((item) => item.id === swapTargetItemId);
    const choice = currentItem
      ? validSwapChoices(currentItem).find((candidate) => candidate.replacementId === button.dataset.replacementId)
      : null;
    if (!choice) {
      closeDialog($("#swapDialog"));
      showToast("That swap is no longer available.");
      return;
    }
    applySwapChoice(swapTargetItemId, choice);
  }

  function applySwapChoice(previousItemId, choice) {
    const previousItems = currentOutfit.items;
    const nextBottom = choice.items.find((item) => item.category === "bottom");
    const optionalBeltRemoved = currentOutfit.optionalBeltRemoved === true
      && nextBottom?.beltMode === "optional"
      && !choice.items.some((item) => item.category === "belt");
    currentOutfit = {
      ...currentOutfit,
      items: choice.items,
      score: choice.score,
      automaticLayerId: choice.automaticLayerId || "",
      automaticSockId: choice.automaticSockId || "",
      sockMessage: choice.sockMessage || "",
      optionalBeltRemoved,
      changedItemIds: changedItemIds(previousItems, choice.items),
      changeNote: describeDependentChanges(previousItems, choice.items)
    };
    resultState = "outfit";
    swapTargetItemId = null;
    closeDialog($("#swapDialog"));
    trackCurrentOutfitInSession();
    renderResult();
    renderRerollSessionStatus();
    scrollResultIntoView();
    flashChangedRows();
    const changedItem = currentOutfit.items.find((item) => item.id === choice.replacementId);
    showToast(changedItem ? `Swapped to ${changedItem.name}.` : "Item swapped.");
  }

  function addSimilarFromDialog() {
    if (!editingItemId) return;
    const sourceId = editingItemId;
    requestEditorExit("add-similar", {
      continuation: () => openItemDialog(sourceId, { addSimilar: true })
    });
  }

  function permanentlyDeleteFromDialog() {
    if (!editingItemId) return;
    const item = findItem(editingItemId);
    if (!item) return;
    const confirmed = window.confirm(`Permanently delete "${item.name}"? Outfit history keeps saved snapshots.`);
    if (!confirmed) return;

    appState.wardrobe = appState.wardrobe.filter((existing) => existing.id !== editingItemId);
    appState.pairRelationships = appState.pairRelationships.filter((record) => !record.itemIds.includes(editingItemId));
    invalidateGenerationState();
    saveState();
    closeItemDialog({ force: true });
    renderAll();
    showToast("Item permanently deleted.");
  }

  // Result transitions are intentionally centralized: Generate starts a new
  // viewed-fit session, while Reroll continues the current context. Both clear
  // any prior logged/confirmation state and make the next result loggable once.
  function generateAndRender(options = {}) {
    if (generationPromise) return generationPromise;
    const resolution = resolveAutomaticContextForGeneration();
    $("#generateBtn").disabled = true;
    $("#rerollBtn").disabled = true;
    generationPromise = Promise.resolve(resolution)
      .catch((error) => {
        weatherMessage = `${error?.message || "Weather could not be resolved."} Automatic weather remains enabled; using the available fallback.`;
        renderWeatherControls();
      })
      .then(() => performGenerationAndRender(options))
      .finally(() => {
        generationPromise = null;
        $("#generateBtn").disabled = false;
        $("#rerollBtn").disabled = false;
      });
    return generationPromise;
  }

  function performGenerationAndRender(options = {}) {
    const mode = options.mode === "reroll" ? "reroll" : "generate";
    const occasionId = $("#occasionSelect").value;
    const buildAroundId = $("#buildAroundSelect").value;
    const previousOutfit = currentOutfit && !currentOutfit.error ? currentOutfit : null;
    const previousItems = previousOutfit?.items || [];
    beginResultTransition(mode);
    currentOutfit = pickOutfit(occasionId, buildAroundId, {
      mode,
      currentSignature: previousItems.length ? comboKey(previousItems.map((item) => item.id)) : ""
    });
    resultState = currentOutfit?.error ? "error" : "outfit";
    if (!currentOutfit.error) {
      currentOutfit.changedItemIds = mode === "reroll"
        ? changedItemIds(previousItems, currentOutfit.items)
        : currentOutfit.items.map((item) => item.id);
      currentOutfit.changeNote = mode === "reroll"
        ? describeDependentChanges(previousItems, currentOutfit.items)
        : "";
    }
    renderResult();
    renderRerollSessionStatus();
    scrollResultIntoView();
    flashChangedRows();
    return currentOutfit;
  }

  function beginResultTransition(mode) {
    resultState = "empty";
    logInProgress = false;
    if (mode === "generate") {
      rerollSession = createRerollSession();
    }
  }

  function pickOutfit(occasionId, buildAroundId, options = {}) {
    const occasion = OCCASIONS[occasionId];
    if (!occasion) {
      return { error: "Choose an occasion." };
    }

    const buildAround = buildAroundId ? findItem(buildAroundId) : null;
    if (buildAroundId && (!buildAround || !isAvailable(buildAround))) {
      return { error: "That build-around item is not available." };
    }

    if (buildAround && !matchesOccasion(buildAround, occasionId)) {
      return { error: "That item is explicitly excluded from this occasion." };
    }

    const contextKey = generationContextKey(occasionId, buildAroundId);
    if (rerollSession.contextKey !== contextKey) {
      rerollSession = createRerollSession(contextKey);
    }

    if (!rerollSession.candidates.length) {
      rerollSession.candidates = buildCandidatePool(occasion, buildAround);
      rerollSession.poolSize = rerollSession.candidates.length;
    }

    const ranked = rerollSession.candidates;
    if (!ranked.length) {
      return { error: "No eligible fit found. Review item status, occasion eligibility, or Never pair settings." };
    }

    const unseen = ranked.filter((candidate) => !rerollSession.seen.has(candidate.signature));
    let choice;
    if (unseen.length) {
      const freshAlternatives = unseen.filter((candidate) => candidate.signature !== options.currentSignature);
      choice = chooseCandidate(freshAlternatives.length ? freshAlternatives : unseen);
      rerollSession.seen.add(choice.signature);
      if (rerollSession.seen.size >= rerollSession.poolSize && rerollSession.poolSize > 1) {
        rerollSession.repeatsEnabled = true;
        rerollSession.message = `You've seen all ${rerollSession.poolSize} valid outfits for these settings. Repeats are now allowed.`;
      }
      return cloneCandidate(choice);
    }

    rerollSession.repeatsEnabled = true;
    if (ranked.length === 1) {
      rerollSession.message = "Only one valid outfit matches these settings.";
      rerollSession.seen.add(ranked[0].signature);
      return cloneCandidate(ranked[0]);
    }

    rerollSession.message = `You've seen all ${ranked.length} valid outfits for these settings. Repeats are now allowed.`;
    const alternatives = ranked.filter((candidate) => candidate.signature !== options.currentSignature);
    choice = chooseCandidate(alternatives.length ? alternatives : ranked);
    return cloneCandidate(choice);
  }

  function buildCandidatePool(occasion, buildAround) {
    const candidates = new Map();
    for (let i = 0; i < 700; i += 1) {
      const outfit = randomOutfit(occasion, buildAround);
      addScoredCandidate(candidates, outfit, occasion.id, buildAround?.id || "");
    }

    enumerateOutfits(occasion, buildAround, 2200).forEach((outfit) => {
      addScoredCandidate(candidates, outfit, occasion.id, buildAround?.id || "");
    });
    const ranked = [...candidates.values()].sort((a, b) => b.score - a.score);
    return ranked.some((candidate) => !candidate.sockMessage)
      ? ranked.filter((candidate) => !candidate.sockMessage)
      : ranked;
  }

  function chooseCandidate(ranked) {
    const topPool = ranked.slice(0, Math.min(5, ranked.length));
    const index = Math.floor(Math.pow(Math.random(), 1.7) * topPool.length);
    return topPool[index];
  }

  function cloneCandidate(candidate) {
    return {
      ...candidate,
      items: [...candidate.items],
      context: candidate.context ? { ...candidate.context } : null
    };
  }

  function addScoredCandidate(map, outfit, occasionId, buildAroundId) {
    if (!outfit || !outfit.length) return;
    if (buildAroundId && !outfit.some((item) => item.id === buildAroundId)) return;
    if (!isCompatibleOutfit(outfit, occasionId, buildAroundId)) return;
    const sockResolution = reconcileSocksForOutfit(outfit, occasionId, buildAroundId);
    if (!sockResolution || !isCompatibleOutfit(sockResolution.items, occasionId, buildAroundId)) return;
    const context = currentEffectiveContext();
    const variants = [{
      items: sortOutfitItems(sockResolution.items),
      automaticLayerId: "",
      automaticSockId: sockResolution.automaticSockId,
      sockMessage: sockResolution.message,
      sockScorePenalty: sockResolution.scorePenalty
    }];
    if (ContextEngine.shouldConsiderLayer(sockResolution.items, context)) {
      const layerChoice = appState.wardrobe
        .filter((item) => isAutomaticLayerCandidate(item) && matchesOccasion(item, occasionId))
        .filter((item) => !sockResolution.items.some((selected) => selected.id === item.id))
        .map((layer) => sortOutfitItems([...sockResolution.items, layer]))
        .filter((items) => isCompatibleOutfit(items, occasionId, buildAroundId))
        .sort((a, b) => scoreOutfit(b, occasionId, { buildAroundId, context }) - scoreOutfit(a, occasionId, { buildAroundId, context }))[0];
      if (layerChoice) {
        const automaticLayer = layerChoice.find((item) => !sockResolution.items.some((base) => base.id === item.id));
        variants.push({
          items: layerChoice,
          automaticLayerId: automaticLayer?.id || "",
          automaticSockId: sockResolution.automaticSockId,
          sockMessage: sockResolution.message,
          sockScorePenalty: sockResolution.scorePenalty
        });
      }
    }
    variants.forEach((variant) => addCandidateVariant(map, variant, occasionId, buildAroundId, context));
  }

  function addCandidateVariant(map, variant, occasionId, buildAroundId, context) {
    const key = comboKey(variant.items.map((item) => item.id));
    if (map.has(key)) return;
    const assessment = ContextEngine.scoreOutfitContext(variant.items, context);
    map.set(key, {
      signature: key,
      occasion: occasionId,
      buildAroundId,
      items: variant.items,
      automaticLayerId: variant.automaticLayerId,
      automaticSockId: variant.automaticSockId || "",
      sockMessage: variant.sockMessage || "",
      automaticLayerSuggested: Boolean(variant.automaticLayerId),
      automaticLayerRemoved: false,
      context: { ...context },
      contextAssessment: assessment,
      score: scoreOutfit(variant.items, occasionId, { buildAroundId, context }) + (variant.sockScorePenalty || 0)
    });
  }

  function createRerollSession(contextKey = "") {
    return {
      contextKey,
      candidates: [],
      seen: new Set(),
      poolSize: 0,
      repeatsEnabled: false,
      message: "",
      automaticLayerSuppressed: false
    };
  }

  function generationContextKey(occasionId = $("#occasionSelect").value, buildAroundId = $("#buildAroundSelect").value) {
    const effectiveContext = currentEffectiveContext();
    const wardrobeContext = appState.wardrobe
      .filter(isAvailable)
      .map((item) => ({
        id: item.id,
        category: item.category,
        subtype: item.subtype,
        occasions: item.occasions,
        formality: item.formality,
        primaryColor: item.primaryColor,
        secondaryColor: item.secondaryColor,
        pattern: item.pattern,
        sleeveLength: item.sleeveLength,
        bottomLength: item.bottomLength,
        preference: item.preference,
        legacyFallback: item.legacyFallback,
        legacyMatching: item.legacyFallback ? item.legacyMatching : undefined,
        beltMode: item.beltMode,
        warmth: item.warmth,
        rainPolicy: item.rainPolicy,
        layerRoles: item.layerRoles,
        rainProtection: item.rainProtection,
        windProtection: item.windProtection
      }));
    return JSON.stringify({
      occasionId,
      buildAroundId,
      context: effectiveContext,
      bannedCombos: appState.bannedCombos.map((combo) => comboKey(combo.itemIds)).sort(),
      pairRelationships: appState.pairRelationships.map((record) => `${record.type}:${record.itemIds.join("|")}`).sort(),
      history: appState.history.map((record) => `${record.id}:${record.date}:${comboKey(record.itemIds)}`).sort(),
      wardrobeContext
    });
  }

  function trackCurrentOutfitInSession() {
    if (!currentOutfit || currentOutfit.error || resultState !== "outfit") return;
    const contextKey = generationContextKey(currentOutfit.occasion, currentOutfit.buildAroundId || "");
    if (rerollSession.contextKey !== contextKey) {
      rerollSession = createRerollSession(contextKey);
    }
    const signature = comboKey(currentOutfit.items.map((item) => item.id));
    if (!rerollSession.candidates.some((candidate) => candidate.signature === signature)) {
      rerollSession.candidates.push({
        signature,
        occasion: currentOutfit.occasion,
        buildAroundId: currentOutfit.buildAroundId || "",
        items: [...currentOutfit.items],
        score: currentOutfit.score,
        automaticLayerId: currentOutfit.automaticLayerId || "",
        automaticLayerSuggested: currentOutfit.automaticLayerSuggested === true,
        automaticLayerRemoved: currentOutfit.automaticLayerRemoved === true,
        context: currentOutfit.context ? { ...currentOutfit.context } : currentEffectiveContext()
      });
      rerollSession.poolSize = rerollSession.candidates.length;
    }
    rerollSession.seen.add(signature);
    if (rerollSession.poolSize > 1 && rerollSession.seen.size >= rerollSession.poolSize) {
      rerollSession.repeatsEnabled = true;
      rerollSession.message = `You've seen all ${rerollSession.poolSize} valid outfits for these settings. Repeats are now allowed.`;
    }
  }

  function renderRerollSessionStatus() {
    const status = $("#rerollSessionStatus");
    const resetButton = $("#resetViewedFitsBtn");
    if (!currentOutfit || currentOutfit.error || resultState !== "outfit") {
      status.hidden = true;
      return;
    }
    const contextKey = generationContextKey(currentOutfit.occasion, currentOutfit.buildAroundId || "");
    if (rerollSession.contextKey !== contextKey || !rerollSession.poolSize) {
      status.hidden = true;
      return;
    }

    const viewedCount = Math.min(rerollSession.seen.size, rerollSession.poolSize);
    let text = `${viewedCount} of ${rerollSession.poolSize} combinations viewed`;
    if (rerollSession.poolSize === 1) {
      text = rerollSession.message || "Only one valid outfit matches these settings.";
    } else if (rerollSession.repeatsEnabled) {
      text = `All ${rerollSession.poolSize} valid combinations viewed - repeats enabled`;
    }
    $("#rerollSessionText").textContent = text;
    resetButton.hidden = rerollSession.poolSize <= 1;
    status.hidden = false;
  }

  function resetViewedFits() {
    if (!currentOutfit || currentOutfit.error) return;
    const contextKey = generationContextKey(currentOutfit.occasion, currentOutfit.buildAroundId || "");
    const candidates = rerollSession.contextKey === contextKey ? rerollSession.candidates : [];
    const automaticLayerSuppressed = rerollSession.automaticLayerSuppressed === true;
    rerollSession = createRerollSession(contextKey);
    rerollSession.candidates = candidates;
    rerollSession.poolSize = candidates.length;
    rerollSession.automaticLayerSuppressed = automaticLayerSuppressed;
    trackCurrentOutfitInSession();
    renderRerollSessionStatus();
    showToast("Viewed fits reset.");
  }

  function randomOutfit(occasion, buildAround) {
    const slots = slotsForAttempt(occasion, buildAround, true);
    const selected = [];
    const usedIds = new Set();

    for (const slot of slots) {
      let pool = candidateItems(slot, occasion.id).filter((item) => !usedIds.has(item.id));
      if (buildAround && slotAcceptsItem(slot, buildAround)) {
        pool = [buildAround];
      }
      if (!pool.length && slot.categories.includes("belt")) continue;
      if (!pool.length) return null;
      const item = pool[Math.floor(Math.random() * pool.length)];
      selected.push(item);
      usedIds.add(item.id);
    }

    if (buildAround && !usedIds.has(buildAround.id)) {
      selected.push(buildAround);
    }

    return reconcileBeltForOutfit(uniqueItems(selected), occasion.id, buildAround?.id || "");
  }

  function enumerateOutfits(occasion, buildAround, maxCombos) {
    const slotPlans = [
      slotsForAttempt(occasion, buildAround, false),
      slotsForAttempt(occasion, buildAround, true)
    ];
    const results = [];

    for (const slots of slotPlans) {
      walkSlots(0, [], new Set(), slots);
      if (results.length >= maxCombos) break;
    }

    return results;

    function walkSlots(index, selected, usedIds, slots) {
      if (results.length >= maxCombos) return;
      if (index >= slots.length) {
        const outfit = [...selected];
        if (buildAround && !usedIds.has(buildAround.id)) {
          outfit.push(buildAround);
        }
        const uniqueOutfit = uniqueItems(outfit);
        const reconciled = reconcileBeltForOutfit(uniqueOutfit, occasion.id, buildAround?.id || "");
        if (reconciled) results.push(reconciled);
        return;
      }

      const slot = slots[index];
      let pool = candidateItems(slot, occasion.id).filter((item) => !usedIds.has(item.id));
      if (buildAround && slotAcceptsItem(slot, buildAround)) {
        pool = [buildAround];
      }

      if (!pool.length && slot.categories.includes("belt")) {
        walkSlots(index + 1, selected, usedIds, slots);
        return;
      }

      for (const item of pool) {
        usedIds.add(item.id);
        selected.push(item);
        walkSlots(index + 1, selected, usedIds, slots);
        selected.pop();
        usedIds.delete(item.id);
      }
    }
  }

  function slotsForAttempt(occasion, buildAround, allowOptionalChance) {
    const slots = [...occasion.slots];
    const optionalSlots = occasion.optionalSlots || [];

    optionalSlots.forEach((slot) => {
      const shouldForce = buildAround && slotAcceptsItem(slot, buildAround);
      const shouldUse = shouldForce || (allowOptionalChance && Math.random() < slot.chance);
      if (shouldUse) {
        slots.push(slot);
      }
    });

    return slots;
  }

  function candidateItems(slot, occasionId) {
    return appState.wardrobe.filter((item) => {
      return isAvailable(item) && slotAcceptsItem(slot, item) && matchesOccasion(item, occasionId);
    });
  }

  function footwearSockPolicy(shoes) {
    const subtype = normalizeTag(shoes?.subtype);
    if (subtype === "sandals") {
      return { mode: "sockless", preferredSubtypes: [] };
    }
    if (subtype === "dress shoes") {
      return { mode: "required", preferredSubtypes: ["dress socks"] };
    }
    if (["sneakers", "athletic/running shoes", "boots"].includes(subtype)) {
      return {
        mode: "required",
        preferredSubtypes: subtype === "athletic/running shoes" ? ["athletic socks", "casual socks"] : ["casual socks", "athletic socks", "dress socks"]
      };
    }
    return { mode: "required", preferredSubtypes: ["casual socks", "athletic socks", "dress socks", "no-show socks"] };
  }

  function reconcileSocksForOutfit(items, occasionId, buildAroundId = "") {
    const unique = uniqueItems(items);
    const shoes = unique.find((item) => item.category === "shoes");
    if (!shoes) return { items: unique, automaticSockId: "", message: "", scorePenalty: 0 };
    const policy = footwearSockPolicy(shoes);
    const existingSocks = unique.filter((item) => item.category === "socks");
    const baseItems = unique.filter((item) => item.category !== "socks");
    const lockedSock = existingSocks.find((sock) => sock.id === buildAroundId);

    if (policy.mode === "sockless") {
      if (lockedSock) return null;
      return { items: baseItems, automaticSockId: "", message: "", scorePenalty: 0 };
    }

    const compatibleExisting = existingSocks.find((sock) => isCompatibleOutfit([...baseItems, sock], occasionId, buildAroundId));
    if (compatibleExisting) {
      return { items: [...baseItems, compatibleExisting], automaticSockId: "", message: "", scorePenalty: 0 };
    }
    if (lockedSock) return null;

    const preferredRank = new Map(policy.preferredSubtypes.map((subtype, index) => [subtype, index]));
    const candidates = candidateItems({ categories: ["socks"] }, occasionId)
      .filter((sock) => isCompatibleOutfit([...baseItems, sock], occasionId, buildAroundId))
      .sort((a, b) => {
        const rankA = preferredRank.has(a.subtype) ? preferredRank.get(a.subtype) : policy.preferredSubtypes.length + 1;
        const rankB = preferredRank.has(b.subtype) ? preferredRank.get(b.subtype) : policy.preferredSubtypes.length + 1;
        if (rankA !== rankB) return rankA - rankB;
        return scoreOutfit([...baseItems, b], occasionId, { buildAroundId, randomize: false })
          - scoreOutfit([...baseItems, a], occasionId, { buildAroundId, randomize: false });
      });
    const selected = candidates[0];
    if (!selected) {
      return {
        items: baseItems,
        automaticSockId: "",
        message: "No compatible socks are available for these shoes.",
        scorePenalty: -400
      };
    }
    return { items: [...baseItems, selected], automaticSockId: selected.id, message: "", scorePenalty: 0 };
  }

  function isAutomaticLayerCandidate(item) {
    return isAvailable(item) && hasAutomaticLayerRole(item);
  }

  function hasAutomaticLayerRole(item) {
    return ["top", "layer"].includes(item.category)
      && Array.isArray(item.layerRoles)
      && item.layerRoles.some((role) => ["mid", "outer"].includes(role));
  }

  function slotAcceptsItem(slot, item) {
    if (!slot.categories.includes(item.category)) return false;
    if (slot.key === "top" && item.category === "top") {
      return Array.isArray(item.layerRoles) && item.layerRoles.includes("base");
    }
    return true;
  }

  function isCompatibleOutfit(items, occasionId, buildAroundId = "") {
    if (!items.length || isComboBanned(items)) return false;

    const occasion = OCCASIONS[occasionId];
    if (!occasion) return false;
    const bottoms = items.find((item) => item.category === "bottom");
    const belts = items.filter((item) => item.category === "belt");
    if (bottoms?.beltMode === "none" && belts.length) return false;
    if (bottoms?.beltMode === "required" && !belts.length) return false;

    return SmartCloset.semanticCompatibility(items, occasionId, {
      settings: appState.settings,
      pairRelationships: appState.pairRelationships,
      buildAroundId
    }).valid;
  }

  function scoreOutfit(items, occasionId, options = {}) {
    const occasion = OCCASIONS[occasionId];
    let score = 100;

    const semantic = SmartCloset.semanticCompatibility(items, occasionId, {
      settings: appState.settings,
      pairRelationships: appState.pairRelationships,
      buildAroundId: options.buildAroundId || ""
    });
    if (!semantic.valid) return -Infinity;
    score += semantic.score;

    const formalities = items.map((item) => item.formality);
    const averageFormality = average(formalities);
    const formalitySpread = Math.max(...formalities) - Math.min(...formalities);
    score -= Math.abs(averageFormality - occasion.targetFormality) * 5;
    score -= formalitySpread * 2.5;

    const context = options.context || currentEffectiveContext();
    score += ContextEngine.scoreOutfitContext(items, context).score;

    const exactLastWorn = lastExactOutfitDate(items);
    const exactDays = daysSince(exactLastWorn);
    if (exactDays !== null && exactDays <= 14) {
      score -= 220 - exactDays * 8;
    }

    const pairLastWorn = lastTopBottomPairDate(items);
    const pairDays = daysSince(pairLastWorn);
    if (pairDays !== null && pairDays <= 7) {
      score -= 110 - pairDays * 10;
    }

    for (const item of items) {
      const itemDays = daysSince(lastItemWornDate(item));
      if (itemDays === null) continue;

      if (item.category === "top" && itemDays <= 3) {
        score -= 60 - itemDays * 12;
      } else if (item.category === "bottom" && itemDays <= 2) {
        score -= 36 - itemDays * 10;
      } else if (item.category === "shoes" && itemDays <= 1) {
        score -= 18 - itemDays * 6;
      } else if (itemDays <= 7) {
        score -= 10 - itemDays;
      }
    }

    if (options.randomize !== false) {
      score += Math.random() * 16;
    }
    return score;
  }

  function reconcileBeltForOutfit(items, occasionId, buildAroundId = "", options = {}) {
    let reconciled = uniqueItems(items);
    const bottoms = reconciled.find((item) => item.category === "bottom");
    if (!bottoms) return reconciled;

    const belts = reconciled.filter((item) => item.category === "belt");
    if (bottoms.beltMode === "none") {
      if (belts.some((belt) => belt.id === buildAroundId)) return null;
      return reconciled.filter((item) => item.category !== "belt");
    }

    if (bottoms.beltMode === "optional" && options.dropOptionalBelt && !belts.some((belt) => belt.id === buildAroundId)) {
      return reconciled.filter((item) => item.category !== "belt");
    }

    const baseItems = reconciled.filter((item) => item.category !== "belt");
    const compatibleExistingBelt = belts.find((belt) => isCompatibleOutfit([...baseItems, belt], occasionId, buildAroundId));
    if (compatibleExistingBelt) return [...baseItems, compatibleExistingBelt];
    if (belts.some((belt) => belt.id === buildAroundId)) return null;

    const validBelts = candidateItems({ categories: ["belt"] }, occasionId)
      .filter((belt) => isCompatibleOutfit([...baseItems, belt], occasionId, buildAroundId))
      .sort((a, b) => scoreOutfit([...baseItems, b], occasionId) - scoreOutfit([...baseItems, a], occasionId));

    if (!validBelts.length) return bottoms.beltMode === "required" ? null : baseItems;
    reconciled = [...baseItems, validBelts[0]];
    return uniqueItems(reconciled);
  }

  function removeOptionalBelt() {
    if (!currentOutfit || currentOutfit.error || resultState !== "outfit") return false;
    const bottom = currentOutfit.items.find((item) => item.category === "bottom");
    const belt = currentOutfit.items.find((item) => item.category === "belt");
    if (!bottom || bottom.beltMode !== "optional" || !belt || currentOutfit.buildAroundId === belt.id) return false;
    const previousItems = currentOutfit.items;
    const nextItems = previousItems.filter((item) => item.category !== "belt");
    currentOutfit = {
      ...currentOutfit,
      items: nextItems,
      score: scoreOutfit(nextItems, currentOutfit.occasion, { buildAroundId: currentOutfit.buildAroundId, context: currentOutfit.context }),
      optionalBeltRemoved: true,
      changedItemIds: [belt.id],
      changeNote: "Optional belt removed."
    };
    trackCurrentOutfitInSession();
    renderResult();
    renderRerollSessionStatus();
    showToast("Optional belt removed. Logging will record no belt.");
    return true;
  }

  function removeAutomaticLayer() {
    if (!currentOutfit || currentOutfit.error || resultState !== "outfit" || !currentOutfit.automaticLayerId) return false;
    const layer = currentOutfit.items.find((item) => item.id === currentOutfit.automaticLayerId);
    if (!layer || currentOutfit.buildAroundId === layer.id) return false;
    const nextItems = currentOutfit.items.filter((item) => item.id !== layer.id);
    currentOutfit = {
      ...currentOutfit,
      items: nextItems,
      score: scoreOutfit(nextItems, currentOutfit.occasion, { buildAroundId: currentOutfit.buildAroundId, context: currentOutfit.context }),
      automaticLayerId: "",
      automaticLayerSuggested: true,
      automaticLayerRemoved: true,
      contextAssessment: ContextEngine.scoreOutfitContext(nextItems, currentOutfit.context),
      changedItemIds: [layer.id],
      changeNote: "Optional layer removed."
    };
    rerollSession.automaticLayerSuppressed = true;
    rerollSession.candidates = rerollSession.candidates.filter((candidate) => !candidate.automaticLayerId);
    const retainedSignatures = new Set(rerollSession.candidates.map((candidate) => candidate.signature));
    rerollSession.seen = new Set([...rerollSession.seen].filter((signature) => retainedSignatures.has(signature)));
    rerollSession.poolSize = rerollSession.candidates.length;
    trackCurrentOutfitInSession();
    renderResult();
    renderRerollSessionStatus();
    showToast("Optional layer removed. Logging will record only what remains.");
    return true;
  }

  function logCurrentOutfit() {
    if (!currentOutfit || currentOutfit.error || logInProgress) return;
    logInProgress = true;
    const date = new Date().toISOString();
    addHistoryRecord({
      date,
      occasion: currentOutfit.occasion,
      items: currentOutfit.items,
      source: "generated",
      note: "",
      context: ContextEngine.historyContextSnapshot(currentOutfit.context, {
        suggested: currentOutfit.automaticLayerSuggested,
        removed: currentOutfit.automaticLayerRemoved
      })
    });
    if (appState.settings.afterLogging === "clear") {
      currentOutfit = null;
    }
    rerollSession.candidates = [];
    rerollSession.poolSize = 0;
    resultState = "logged";
    saveState();
    renderAll();
  }

  function banCurrentCombo() {
    if (!currentOutfit || currentOutfit.error) return;
    const itemIds = currentOutfit.items.map((item) => item.id).sort();
    const key = comboKey(itemIds);
    let bannedCombo = appState.bannedCombos.find((combo) => comboKey(combo.itemIds) === key);

    if (!bannedCombo) {
      bannedCombo = {
        id: uid("ban"),
        itemIds,
        createdAt: new Date().toISOString()
      };
      appState.bannedCombos.push(bannedCombo);
    }

    pendingBanFeedback = {
      bannedComboId: bannedCombo.id,
      itemIds,
      occasion: currentOutfit.occasion
    };
    saveState();
    renderSettings();
    openFeedbackDialog();
    showToast("Combo banned.");
  }

  function addHistoryRecord({ date, occasion, items, source, note, context = null }) {
    const validItems = uniqueItems(items).filter(Boolean);
    appState.history.unshift({
      id: uid("log"),
      date,
      occasion: normalizeOccasionToken(occasion) || "casual",
      itemIds: validItems.map((item) => item.id),
      itemSnapshots: validItems.map(snapshotItem),
      source: source === "manual" ? "manual" : "generated",
      note: stringOr(note, ""),
      context: ContextEngine.normalizeHistoryContext(context)
    });

  }

  function openManualLogDialog() {
    $("#manualLogDate").value = dateOnly(new Date().toISOString());
    $("#manualLogOccasion").value = $("#occasionSelect").value || "casual";
    $("#manualIncludeUnavailable").checked = false;
    $("#manualLogNote").value = "";
    $("#manualLogError").hidden = true;
    renderManualItemPicker();
    openDialog($("#manualLogDialog"));
  }

  function renderManualItemPicker() {
    const includeUnavailable = $("#manualIncludeUnavailable").checked;
    const selectedIds = new Set($$("input[name='manualItem']:checked").map((input) => input.value));
    const items = appState.wardrobe
      .filter((item) => includeUnavailable || isAvailable(item))
      .sort(sortItems);

    $("#manualItemPicker").innerHTML = CATEGORY_ORDER.map((category) => {
      const categoryItems = items.filter((item) => item.category === category);
      if (!categoryItems.length) return "";
      return `
        <fieldset class="manual-category">
          <legend>${escapeHtml(CATEGORIES[category])}</legend>
          <div class="manual-choice-list">
            ${categoryItems.map((item) => `
              <label class="check-pill">
                <input type="checkbox" name="manualItem" value="${escapeAttribute(item.id)}" ${selectedIds.has(item.id) ? "checked" : ""}>
                <span>${escapeHtml(item.name)}${isAvailable(item) ? "" : ` (${escapeHtml(item.status)})`}</span>
              </label>
            `).join("")}
          </div>
        </fieldset>
      `;
    }).join("");
  }

  function saveManualLog(event) {
    event.preventDefault();
    const itemIds = $$("input[name='manualItem']:checked").map((input) => input.value);
    const items = itemIds.map(findItem).filter(Boolean);
    if (!items.length) {
      $("#manualLogError").textContent = "Choose at least one item.";
      $("#manualLogError").hidden = false;
      return;
    }

    const selectedDate = validDateOnly($("#manualLogDate").value);
    if (!selectedDate) {
      $("#manualLogError").textContent = "Choose a valid date.";
      $("#manualLogError").hidden = false;
      return;
    }

    addHistoryRecord({
      date: `${selectedDate}T12:00:00`,
      occasion: $("#manualLogOccasion").value,
      items,
      source: "manual",
      note: $("#manualLogNote").value.trim()
    });
    rerollSession = createRerollSession();
    saveState();
    closeDialog($("#manualLogDialog"));
    renderAll();
    setActiveScreen("history");
    showToast("Outfit logged.");
  }

  function openFeedbackDialog() {
    $$("input[name='feedbackReason']").forEach((input) => {
      input.checked = false;
    });
    $("#feedbackOther").value = "";
    $("#feedbackOtherField").hidden = true;
    openDialog($("#feedbackDialog"));
  }

  function updateFeedbackOtherVisibility() {
    $("#feedbackOtherField").hidden = $("input[name='feedbackReason']:checked")?.value !== "other";
  }

  function saveBanFeedback(event) {
    event.preventDefault();
    if (!pendingBanFeedback) return;
    const reason = $("input[name='feedbackReason']:checked")?.value;
    if (!reason) {
      showToast("Choose a reason or tap Skip.");
      return;
    }

    const pairItemIds = feedbackPairForReason(reason, pendingBanFeedback.itemIds);
    appState.feedback.push(normalizeFeedbackRecord({
      id: uid("feedback"),
      bannedComboId: pendingBanFeedback.bannedComboId,
      reason,
      itemIds: pendingBanFeedback.itemIds,
      pairItemIds,
      note: reason === "other" ? $("#feedbackOther").value.trim() : "",
      createdAt: new Date().toISOString()
    }));

    if (pairItemIds.length === 2 && ["colors", "top_pants", "shoes", "belt_shoes"].includes(reason)) {
      const pair = pairItemIds.map(findItem).filter(Boolean);
      if (pair.length === 2 && window.confirm(`Also mark "${pair[0].name}" and "${pair[1].name}" as incompatible?`)) {
        const itemIds = SmartCloset.canonicalPair(pair[0].id, pair[1].id);
        appState.pairRelationships = appState.pairRelationships.filter((record) => record.itemIds.join("|") !== itemIds.join("|"));
        appState.pairRelationships.push({ id: uid("pair"), type: "never", itemIds, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
        rerollSession = createRerollSession();
      }
    }

    saveState();
    finishBanFeedback();
  }

  function feedbackPairForReason(reason, itemIds) {
    const items = itemIds.map(findItem).filter(Boolean);
    const top = items.find((item) => item.category === "top");
    const pants = items.find((item) => item.category === "bottom");
    const shoes = items.find((item) => item.category === "shoes");
    const belt = items.find((item) => item.category === "belt");
    if (["colors", "top_pants"].includes(reason) && top && pants) return [top.id, pants.id];
    if (reason === "shoes" && shoes && pants) return [shoes.id, pants.id];
    if (reason === "belt_shoes" && belt && shoes) return [belt.id, shoes.id];
    return [];
  }

  function finishBanFeedback() {
    closeDialog($("#feedbackDialog"));
    pendingBanFeedback = null;
    generateAndRender({ mode: "reroll" });
  }

  function deleteHistoryRecord(logId) {
    const record = appState.history.find((entry) => entry.id === logId);
    if (!record) return;
    const confirmed = window.confirm("Delete this outfit log?");
    if (!confirmed) return;

    appState.history = appState.history.filter((entry) => entry.id !== logId);
    invalidateGenerationState();
    saveState();
    renderAll();
    showToast("Log deleted.");
  }

  function exportBackup() {
    const data = JSON.stringify(appState, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `fit-roulette-backup-${dateOnly(new Date().toISOString())}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    showToast("Backup exported.");
  }

  function renderRecoveryDownloads() {
    const container = $("#recoveryDownloads");
    const records = protectedOriginals();
    container.innerHTML = records.length ? `
      <p class="small-meta"><strong>Protected originals</strong> — retained exactly and never overwritten.</p>
      ${records.map((record) => `<button class="secondary-button" type="button" data-recovery-key="${escapeAttribute(record.key)}">${escapeHtml(record.label)}</button>`).join("")}
    ` : "";
  }

  function protectedOriginals() {
    const keys = new Set([LEGACY_RECOVERY_KEY, RECOVERY_KEY]);
    if (typeof localStorage.key === "function" && Number.isFinite(Number(localStorage.length))) {
      for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index);
        if (key?.startsWith(RECOVERY_PREFIX)) keys.add(key);
      }
    }
    const records = [...keys]
      .filter((key) => localStorage.getItem(key) !== null)
      .map((key) => ({
        key,
        label: key === LEGACY_RECOVERY_KEY
          ? "Download protected original before schema 4"
          : (key === RECOVERY_KEY ? "Download protected original before schema 5" : "Download retained legacy import original")
      }));
    if (loadIssue && localStorage.getItem(STORAGE_KEY) !== null) {
      records.push({ key: STORAGE_KEY, label: "Download current unreadable primary (unchanged)" });
    }
    return records;
  }

  function handleRecoveryDownload(event) {
    const button = event.target.closest("[data-recovery-key]");
    if (button) exportRecoveryPayload(button.dataset.recoveryKey);
  }

  function exportRecoveryPayload(key = RECOVERY_KEY) {
    const payload = localStorage.getItem(key);
    if (payload === null) {
      showToast("No protected original is available.");
      return;
    }
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    const label = key === LEGACY_RECOVERY_KEY ? "schema4" : (key === RECOVERY_KEY ? "schema5" : "retained");
    anchor.download = `fit-roulette-protected-original-${label}-${dateOnly(new Date())}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    showToast("Protected original downloaded.");
  }

  function importBackup(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      importBackupText(String(reader.result));
      event.target.value = "";
    };
    reader.readAsText(file);
  }

  function importBackupText(rawText, confirmImport = () => window.confirm("Import this backup and replace current local data?")) {
    let raw;
    let sourceSchema;
    try {
      raw = JSON.parse(rawText);
      sourceSchema = importSchemaVersion(raw);
    } catch (error) {
      console.error(error);
      showToast("Import failed. Check the JSON file.");
      return { ok: false, error };
    }

    if (!confirmImport()) return { ok: false, cancelled: true };

    const legacy = sourceSchema < SCHEMA_VERSION;
    let recoveryCreated = false;
    let recoveryKey = "";
    if (legacy) {
      try {
        const recovery = preserveRecoveryPayload(rawText, { allowAdditional: true });
        if (!recovery.retained) throw Object.assign(new Error("Confirmed legacy import could not be retained exactly."), { code: "RECOVERY_WRITE_FAILED" });
        recoveryCreated = recovery.created;
        recoveryKey = recovery.key;
        renderRecoveryDownloads();
      } catch (error) {
        console.error(error);
        showToast("Import stopped because a protected original could not be created.");
        return { ok: false, error };
      }
    }

    let incoming;
    try {
      incoming = SmartCloset.migrateAndValidate(raw).state;
      SmartCloset.validateState(incoming);
    } catch (error) {
      console.error(error);
      showToast("Import failed. Check the JSON file.");
      return { ok: false, error };
    }

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(incoming));
    } catch (error) {
      console.error(error);
      showToast("Import failed. Current closet data could not be replaced.");
      return { ok: false, error };
    }

    appState = incoming;
    storageWriteLocked = false;
    loadIssue = null;
    currentOutfit = null;
    resultState = "empty";
    logInProgress = false;
    rerollSession = createRerollSession();
    contextSession = createContextSession();
    weatherMessage = "";
    weatherSessionFetchedAt = "";
    initializeGenerateOccasion();
    renderAll();
    if (legacy && recoveryCreated) showToast("Backup imported. Protected original saved.");
    else if (legacy) showToast("Backup imported. Existing protected original retained.");
    else showToast("Backup imported.");
    return { ok: true, legacy, recoveryCreated, recoveryKey };
  }

  function importSchemaVersion(raw) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      throw Object.assign(new Error("Backup root must be an object."), { code: "INVALID_ROOT" });
    }
    SmartCloset.assertNoSensitiveLocation(raw);
    const declaredSchema = raw.schemaVersion ?? raw.version;
    const schemaVersion = Number(declaredSchema ?? 1);
    if (declaredSchema !== undefined && (!Number.isFinite(schemaVersion) || schemaVersion < 1)) {
      throw Object.assign(new Error("Backup schema version must be a positive number."), { code: "INVALID_SCHEMA" });
    }
    if (schemaVersion > SCHEMA_VERSION) {
      throw Object.assign(new Error(`Schema ${schemaVersion} is newer than this app supports.`), { code: "UNSUPPORTED_FUTURE_SCHEMA" });
    }
    return schemaVersion;
  }

  function resetDemoData() {
    const confirmed = window.confirm("Replace this closet, history, pair preferences, and banned outfits with the generalized sample closet? This cannot be undone from inside the app.");
    if (!confirmed) return;
    appState = createDefaultState();
    appState.wardrobe = sampleWardrobe();
    appState.setup = { completed: true, choice: "sample" };
    currentOutfit = null;
    resultState = "empty";
    logInProgress = false;
    rerollSession = createRerollSession();
    contextSession = createContextSession();
    weatherSessionFetchedAt = "";
    saveState();
    initializeGenerateOccasion();
    renderAll();
    showToast("Demo data reset.");
  }

  function clearBannedCombos() {
    if (!appState.bannedCombos.length) {
      showToast("No banned combos to clear.");
      return;
    }
    const confirmed = window.confirm("Clear all banned combos?");
    if (!confirmed) return;
    appState.bannedCombos = [];
    saveState();
    renderAll();
    showToast("Banned combos cleared.");
  }

  function matchesOccasion(item, occasionId) {
    return item.occasions.includes(occasionId);
  }

  function isComboBanned(items) {
    const key = comboKey(items.map((item) => item.id));
    return appState.bannedCombos.some((combo) => comboKey(combo.itemIds) === key);
  }

  function comboKey(ids) {
    return unique(ids.map(String)).sort().join("|");
  }

  function lastExactOutfitDate(items) {
    const key = comboKey(items.map((item) => item.id));
    const record = appState.history
      .filter((entry) => comboKey(entry.itemIds) === key)
      .sort((a, b) => new Date(b.date) - new Date(a.date))[0];
    return record ? dateOnly(record.date) : null;
  }

  function lastTopBottomPairDate(items) {
    const top = items.find((item) => item.category === "top");
    const bottom = items.find((item) => item.category === "bottom");
    if (!top || !bottom) return null;
    const record = appState.history
      .filter((entry) => entry.itemIds.includes(top.id) && entry.itemIds.includes(bottom.id))
      .sort((a, b) => new Date(b.date) - new Date(a.date))[0];
    return record ? dateOnly(record.date) : null;
  }

  function lastItemWornDate(item) {
    const latestFromHistory = latestHistoryDateForItem(item.id);
    return latestFromHistory || item.lastWorn || null;
  }

  function latestHistoryDateForItem(itemId) {
    const record = appState.history
      .filter((entry) => entry.itemIds.includes(itemId))
      .sort((a, b) => new Date(b.date) - new Date(a.date))[0];
    return record ? dateOnly(record.date) : null;
  }

  function itemSignals(item) {
    return unique([
      item.id,
      item.name,
      item.category,
      CATEGORIES[item.category] || item.category,
      item.subtype,
      item.primaryColor,
      item.pattern === "solid" ? "" : item.secondaryColor,
      item.pattern,
      item.status,
      item.warmth,
      item.rainProtection,
      item.windProtection,
      ...(item.layerRoles || []),
      String(item.formality),
      SmartCloset.FORMALITY_LABELS[item.formality],
      ...item.labels,
      ...item.occasions,
      ...item.occasions.map((occasion) => OCCASIONS[occasion]?.label || ""),
    ].map(normalizeTag).filter(Boolean));
  }

  function matchesClosetSearch(item, query) {
    const terms = normalizeTag(query).split(/\s+/).filter(Boolean);
    if (!terms.length) return true;
    const signals = itemSignals(item);
    return terms.every((term) => signals.some((signal) => signal.includes(term)));
  }

  function snapshotItem(item) {
    return {
      id: item.id,
      name: item.name,
      category: item.category,
      subtype: item.subtype,
      primaryColor: item.primaryColor,
      secondaryColor: item.secondaryColor,
      pattern: item.pattern,
      sleeveLength: item.sleeveLength,
      bottomLength: item.bottomLength,
      formality: item.formality,
      occasions: [...item.occasions],
      warmth: item.warmth,
      rainPolicy: item.rainPolicy,
      layerRoles: [...(item.layerRoles || [])],
      rainProtection: item.rainProtection,
      windProtection: item.windProtection,
      preference: item.preference,
      labels: [...item.labels],
      beltMode: item.beltMode || "",
      imageUrl: item.imageUrl || ""
    };
  }

  function snapshotOrItem(record, itemId) {
    return findItem(itemId) || record.itemSnapshots.find((item) => item.id === itemId) || { id: itemId, name: "Deleted item" };
  }

  function sortOutfitItems(items) {
    return [...items].sort((a, b) => CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category));
  }

  function displayOutfitItems(outfitOrItems) {
    const outfit = Array.isArray(outfitOrItems) ? { items: outfitOrItems, automaticLayerId: "" } : (outfitOrItems || { items: [] });
    const ranks = { top: 0, layer: 2, bottom: 3, belt: 4, socks: 5, shoes: 6, accessory: 7 };
    return (outfit.items || [])
      .map((item, index) => ({ item, index }))
      .sort((a, b) => {
        const rankA = a.item.id === outfit.automaticLayerId ? 1 : (ranks[a.item.category] ?? 8);
        const rankB = b.item.id === outfit.automaticLayerId ? 1 : (ranks[b.item.category] ?? 8);
        return rankA - rankB || a.index - b.index || String(a.item.id || "").localeCompare(String(b.item.id || ""));
      })
      .map((entry) => entry.item);
  }

  function uniqueItems(items) {
    const seen = new Set();
    return items.filter((item) => {
      if (!item || seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
  }

  function sortItems(a, b) {
    const statusOrder = { available: 0, unavailable: 1, archived: 2 };
    if (a.status !== b.status) return (statusOrder[a.status] ?? 3) - (statusOrder[b.status] ?? 3);
    const categoryDiff = CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category);
    if (categoryDiff) return categoryDiff;
    return a.name.localeCompare(b.name);
  }

  function emptyItem() {
    const item = SmartCloset.createItem({
      name: "",
      category: "top",
      subtype: "other",
      primaryColor: "",
      secondaryColor: "",
      pattern: "solid",
      sleeveLength: "unspecified",
      bottomLength: "not_applicable",
      occasions: ["casual"],
      formality: 2,
      beltMode: "optional",
      warmth: "unspecified",
      rainPolicy: "unspecified",
      layerRoles: ["base"],
      rainProtection: "unspecified",
      windProtection: "unspecified",
      status: "available",
      preference: "neutral",
      labels: [],
      imageUrl: "",
      notes: "",
      legacyFallback: false,
      legacyMatching: {},
      review: { status: "reviewed", reasons: [], reviewedAt: new Date().toISOString() }
    });
    item.name = "";
    return item;
  }

  function resolveAvoidItemTokens(tokens, currentId) {
    return tokens.map((token) => {
      const normalized = normalizeTag(token);
      const match = appState.wardrobe.find((item) => {
        return item.id !== currentId && (normalizeTag(item.id) === normalized || normalizeTag(item.name) === normalized);
      });
      return match ? match.id : token;
    });
  }

  function formatAvoidItems(values) {
    return values.map((value) => {
      const item = appState.wardrobe.find((candidate) => candidate.id === value || normalizeTag(candidate.name) === normalizeTag(value));
      return item ? item.name : value;
    });
  }

  function findItem(itemId) {
    return appState.wardrobe.find((item) => item.id === itemId) || null;
  }

  function isAvailable(item) {
    return item?.status === "available";
  }

  function invalidateGenerationState(options = {}) {
    rerollSession = createRerollSession();
    swapTargetItemId = null;
    if (options.preserveCurrent) return;
    currentOutfit = null;
    resultState = "empty";
    logInProgress = false;
  }

  function openDialog(dialog) {
    if (!dialog) return;
    if (typeof dialog.showModal === "function") {
      dialog.showModal();
    } else {
      dialog.setAttribute("open", "");
    }
  }

  function closeDialog(dialog) {
    if (!dialog) return;
    if (typeof dialog.close === "function") {
      try {
        dialog.close();
      } catch (error) {
        dialog.removeAttribute("open");
      }
    } else {
      dialog.removeAttribute("open");
    }
  }

  function changedItemIds(previousItems, nextItems) {
    const previousIds = new Set((previousItems || []).map((item) => item.id));
    return (nextItems || []).filter((item) => !previousIds.has(item.id)).map((item) => item.id);
  }

  function describeDependentChanges(previousItems, nextItems) {
    if (!previousItems.length) return "";
    const previousBelt = previousItems.find((item) => item.category === "belt");
    const nextBelt = nextItems.find((item) => item.category === "belt");
    if (!previousBelt && nextBelt) return "Belt added to match the new bottoms.";
    if (previousBelt && !nextBelt) return "Belt removed to match the new bottoms.";
    if (previousBelt && nextBelt && previousBelt.id !== nextBelt.id) return "Belt updated to match the new bottoms.";
    return "";
  }

  function scrollResultIntoView() {
    const card = $("#outfitResult");
    if (!card || typeof card.scrollIntoView !== "function") return;
    const run = () => card.scrollIntoView({ behavior: "smooth", block: "start" });
    if (typeof window.requestAnimationFrame === "function") {
      window.requestAnimationFrame(run);
    } else {
      run();
    }
  }

  function flashChangedRows() {
    setTimeout(clearChangedHighlights, 1250);
  }

  function clearChangedHighlights() {
    $$(".result-item.is-changed").forEach((row) => row.classList.remove("is-changed"));
  }

  function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return;
    window.addEventListener("load", () => {
      navigator.serviceWorker.register(`./sw.js?v=${APP_VERSION}`, { updateViaCache: "none" }).catch((error) => {
        console.info("Service worker registration skipped.", error);
      });
    });
  }

  function renderChip(label, tone = "") {
    if (!label) return "";
    const className = tone ? `chip ${tone}` : "chip";
    return `<span class="${className}">${escapeHtml(label)}</span>`;
  }

  function showToast(message) {
    const toast = $("#toast");
    toast.textContent = message;
    toast.hidden = false;
    clearTimeout(showToast.timeoutId);
    showToast.timeoutId = setTimeout(() => {
      toast.hidden = true;
    }, 2200);
  }

  function parseCsv(value) {
    if (Array.isArray(value)) return toArray(value);
    return String(value || "")
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
  }

  function toArray(value) {
    if (Array.isArray(value)) {
      return value.map((part) => String(part).trim()).filter(Boolean);
    }
    return parseCsv(value);
  }

  function unique(values) {
    return [...new Set(values.filter(Boolean))];
  }

  function uniqueTags(values) {
    const seen = new Set();
    return toArray(values).filter((value) => {
      const normalized = normalizeTag(value);
      if (!normalized || seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    });
  }

  function normalizeTag(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
  }

  function normalizeOccasionToken(value) {
    const token = normalizeTag(value).replace(/[^a-z0-9]+/g, "");
    const aliases = {
      work: "work",
      office: "work",
      workoffice: "work",
      friday: "friday",
      fridayjeans: "friday",
      casual: "casual",
      date: "date",
      athletic: "athletic",
      exercise: "athletic",
      training: "athletic",
      gym: "gym",
      errands: "casual",
      gymerrands: "gym"
    };
    return aliases[token] || (OCCASIONS[value] ? value : "");
  }

  function validOccasion(value) {
    const normalized = normalizeOccasionToken(value);
    return OCCASIONS[normalized] ? normalized : "work";
  }

  function stringOr(value, fallback) {
    const text = String(value ?? "").trim();
    return text || fallback;
  }

  function clampNumber(value, min, max, fallback) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.max(min, Math.min(max, Math.round(number)));
  }

  function nullableNumber(value, min, max) {
    if (value === null || value === undefined || String(value).trim() === "") return null;
    const number = Number(value);
    if (!Number.isFinite(number)) return null;
    return Math.max(min, Math.min(max, Math.round(number)));
  }

  function average(values) {
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }

  function dateOnly(value) {
    if (!value) return "";
    if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return value;
    }
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function validDateOnly(value) {
    if (!value) return "";
    return dateOnly(value);
  }

  function daysSince(dateValue) {
    if (!dateValue) return null;
    const date = new Date(`${dateOnly(dateValue)}T00:00:00`);
    if (Number.isNaN(date.getTime())) return null;
    const today = new Date(`${dateOnly(new Date().toISOString())}T00:00:00`);
    return Math.max(0, Math.floor((today - date) / 86400000));
  }

  function formatShortDate(value) {
    return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(`${dateOnly(value)}T12:00:00`));
  }

  function formatLongDate(value) {
    return new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
  }

  function itemInitials(item) {
    return item.name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0]?.toUpperCase())
      .join("") || "?";
  }

  function capitalize(value) {
    const text = String(value || "");
    return text ? text[0].toUpperCase() + text.slice(1) : "";
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function escapeAttribute(value) {
    return escapeHtml(value);
  }

  function uid(prefix) {
    const random = Math.random().toString(36).slice(2, 9);
    return `${prefix}_${Date.now().toString(36)}_${random}`;
  }

  function slug(value) {
    return normalizeTag(value).replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  }

  function sampleWardrobe() {
    const now = "2026-08-07T12:00:00.000Z";
    const make = (id, name, subtype, color, overrides = {}) => {
      const template = SmartCloset.SUBTYPE_TEMPLATES[subtype];
      return SmartCloset.createItem({
        id,
        name,
        ...template,
        primaryColor: color,
        secondaryColor: "",
        status: "available",
        preference: "neutral",
        labels: ["sample"],
        review: { status: "reviewed", reasons: [], reviewedAt: now },
        legacyFallback: false,
        legacyMatching: {},
        createdAt: now,
        updatedAt: now,
        ...overrides
      }, { now });
    };
    return [
      make("sample_white_tee", "White T-Shirt", "t-shirt", "White"),
      make("sample_blue_button_down", "Light Blue Button-Down", "button-down", "Light Blue"),
      make("sample_navy_polo", "Navy Polo", "polo", "Navy"),
      make("sample_gray_hoodie", "Gray Hoodie", "hoodie", "Gray"),
      make("sample_dark_jeans", "Dark Blue Jeans", "jeans", "Navy"),
      make("sample_khaki_chinos", "Khaki Chinos", "chinos", "Khaki"),
      make("sample_black_shorts", "Black Athletic Shorts", "athletic shorts", "Black"),
      make("sample_white_sneakers", "White Sneakers", "sneakers", "White"),
      make("sample_running_shoes", "Black Running Shoes", "athletic/running shoes", "Black"),
      make("sample_brown_dress_shoes", "Brown Dress Shoes", "dress shoes", "Brown"),
      make("sample_brown_belt", "Brown Dress Belt", "dress belt", "Brown"),
      make("sample_navy_socks", "Navy Dress Socks", "dress socks", "Navy")
    ];
  }

  function demoWardrobe() {
    const item = (name, category, options) => normalizeItem({
      id: `item_${slug(name)}`,
      name,
      category,
      active: true,
      lastWorn: null,
      imageUrl: "",
      notes: "",
      createdAt: "2026-06-24T00:00:00.000Z",
      updatedAt: "2026-06-24T00:00:00.000Z",
      ...options
    });

    return [
      item("Light Blue Polo", "top", {
        colors: ["light blue"],
        tags: ["polo", "smart casual", "summer"],
        occasions: ["work", "friday", "casual", "date"],
        season: ["spring", "summer"],
        formality: 6,
        worksWithTags: ["navy", "gray", "khaki", "tan", "dark jeans"]
      }),
      item("Black Polo", "top", {
        colors: ["black"],
        tags: ["polo", "smart casual"],
        occasions: ["work", "friday", "casual", "date", "gym"],
        season: ["all season"],
        formality: 6,
        worksWithTags: ["gray", "khaki", "black", "jeans", "olive"]
      }),
      item("Navy Polo", "top", {
        colors: ["navy"],
        tags: ["polo", "smart casual"],
        occasions: ["work", "friday", "casual", "date"],
        season: ["all season"],
        formality: 6,
        worksWithTags: ["gray", "khaki", "brown", "tan", "dark jeans"]
      }),
      item("Gray Polo", "top", {
        colors: ["gray"],
        tags: ["polo", "casual", "office", "errands"],
        occasions: ["work", "friday", "casual", "date", "gym"],
        season: ["all season"],
        formality: 5,
        worksWithTags: ["black", "navy", "olive", "jeans"]
      }),
      item("Navy Dress Pants", "pants", {
        colors: ["navy"],
        tags: ["dress pants", "office", "pressed"],
        occasions: ["work", "friday", "date"],
        season: ["all season"],
        formality: 7,
        avoidWithTags: ["athletic", "running"]
      }),
      item("Black Dress Pants", "pants", {
        colors: ["black"],
        tags: ["dress pants", "black pants", "office", "pressed"],
        occasions: ["work", "friday", "date"],
        season: ["all season"],
        formality: 7,
        avoidWithTags: ["athletic", "running"]
      }),
      item("Gray Dress Pants", "pants", {
        colors: ["gray"],
        tags: ["dress pants", "office", "pressed"],
        occasions: ["work", "friday", "date"],
        season: ["all season"],
        formality: 7,
        avoidWithTags: ["athletic", "running"]
      }),
      item("Khaki Dress Pants", "pants", {
        colors: ["khaki"],
        tags: ["dress pants", "office", "summer"],
        occasions: ["work", "friday", "date"],
        season: ["spring", "summer", "fall"],
        formality: 6,
        avoidWithTags: ["athletic", "running"]
      }),
      item("Light Jeans", "pants", {
        colors: ["light blue"],
        tags: ["jeans", "light jeans", "denim", "casual"],
        occasions: ["friday", "casual", "gym"],
        season: ["spring", "summer"],
        formality: 4,
        avoidWithTags: ["dress shoes"]
      }),
      item("Dark Jeans", "pants", {
        colors: ["dark blue"],
        tags: ["jeans", "dark jeans", "denim", "casual", "date"],
        occasions: ["friday", "casual", "date", "gym"],
        season: ["all season"],
        formality: 5
      }),
      item("Dark Gray Jeans", "pants", {
        colors: ["dark gray"],
        tags: ["jeans", "dark jeans", "denim", "casual"],
        occasions: ["friday", "casual", "date", "gym"],
        season: ["all season"],
        formality: 5
      }),
      item("Olive Cargos", "pants", {
        colors: ["olive"],
        tags: ["cargo", "cargos", "casual", "errands"],
        occasions: ["casual", "gym"],
        season: ["spring", "fall"],
        formality: 3,
        avoidWithTags: ["dress shoes", "pressed"]
      }),
      item("Black Cargos", "pants", {
        colors: ["black"],
        tags: ["cargo", "cargos", "casual", "errands"],
        occasions: ["casual", "gym"],
        season: ["all season"],
        formality: 3,
        avoidWithTags: ["dress shoes", "pressed"]
      }),
      item("Brown Jeans", "pants", {
        colors: ["brown"],
        tags: ["jeans", "brown jeans", "casual"],
        occasions: ["friday", "casual", "date"],
        season: ["fall", "winter"],
        formality: 4
      }),
      item("Black Dress Shoes", "shoes", {
        colors: ["black"],
        tags: ["dress shoes", "leather", "office", "date"],
        occasions: ["work", "friday", "date"],
        season: ["all season"],
        formality: 8,
        worksWithTags: ["black", "gray", "navy", "dress pants", "belt"],
        avoidWithTags: ["cargo", "athletic", "running"]
      }),
      item("Dark Gray Dress Shoes", "shoes", {
        colors: ["dark gray"],
        tags: ["dress shoes", "office", "date"],
        occasions: ["work", "friday", "date"],
        season: ["all season"],
        formality: 7,
        worksWithTags: ["black", "gray", "navy", "dress pants", "belt"],
        avoidWithTags: ["cargo", "athletic", "running"]
      }),
      item("Brown/Tan Dress Shoes", "shoes", {
        colors: ["brown", "tan"],
        tags: ["dress shoes", "leather", "office", "date"],
        occasions: ["work", "friday", "date"],
        season: ["spring", "summer", "fall"],
        formality: 7,
        worksWithTags: ["khaki", "navy", "brown", "tan", "dress pants", "belt"],
        avoidWithTags: ["black pants", "cargo", "athletic", "running"]
      }),
      item("Black Belt", "belt", {
        colors: ["black"],
        tags: ["belt", "leather", "office", "date"],
        occasions: ["work", "friday", "casual", "date"],
        season: ["all season"],
        formality: 6,
        worksWithTags: ["black", "gray", "navy", "dress shoes", "jeans"]
      }),
      item("Black/White High-Top Sneakers", "shoes", {
        colors: ["black", "white"],
        tags: ["sneakers", "high-top", "casual", "canvas"],
        occasions: ["friday", "casual", "gym"],
        season: ["spring", "summer", "fall"],
        formality: 3,
        worksWithTags: ["jeans", "cargo", "black", "gray"]
      }),
      item("Off-White Casual Sneakers", "shoes", {
        colors: ["off-white", "cream"],
        tags: ["sneakers", "casual", "errands"],
        occasions: ["friday", "casual", "gym"],
        season: ["spring", "summer"],
        formality: 4,
        worksWithTags: ["jeans", "cargo", "khaki", "olive", "light blue"]
      }),
      item("Black Running Sneakers", "shoes", {
        colors: ["black"],
        tags: ["sneakers", "running", "athletic", "errands"],
        occasions: ["casual", "gym"],
        season: ["all season"],
        formality: 2,
        worksWithTags: ["cargo", "jeans", "black", "gray"]
      }),
      item("White/Blue High-Top Sneakers", "shoes", {
        colors: ["white", "blue"],
        tags: ["sneakers", "high-top", "casual"],
        occasions: ["friday", "casual", "gym"],
        season: ["spring", "summer"],
        formality: 4,
        worksWithTags: ["jeans", "navy", "gray", "light blue"]
      }),
      item("Tan Suede Boots", "shoes", {
        colors: ["tan"],
        tags: ["boots", "suede", "casual", "date"],
        occasions: ["friday", "casual", "date"],
        season: ["fall", "winter", "spring"],
        formality: 5,
        worksWithTags: ["jeans", "khaki", "brown", "olive", "navy"]
      }),
      item("Black Socks", "socks", {
        colors: ["black"],
        tags: ["socks", "office"],
        occasions: ["work", "friday", "date"],
        season: ["all season"],
        formality: 5,
        worksWithTags: ["black", "gray", "navy", "dress shoes"]
      }),
      item("Gray Socks", "socks", {
        colors: ["gray"],
        tags: ["socks", "office"],
        occasions: ["work", "friday", "date"],
        season: ["all season"],
        formality: 5,
        worksWithTags: ["gray", "navy", "black", "dress shoes"]
      }),
      item("Navy Socks", "socks", {
        colors: ["navy"],
        tags: ["socks", "office"],
        occasions: ["work", "friday", "date"],
        season: ["all season"],
        formality: 5,
        worksWithTags: ["navy", "brown", "tan", "dress shoes"]
      })
    ];
  }

  if (window.__FIT_ROULETTE_TESTING__ === true) {
    window.__fitRouletteTest = {
      getState: () => appState,
      getCurrentOutfit: () => currentOutfit,
      getRerollSession: () => ({
        contextKey: rerollSession.contextKey,
        poolSize: rerollSession.poolSize,
        seen: [...rerollSession.seen],
        repeatsEnabled: rerollSession.repeatsEnabled,
        message: rerollSession.message,
        automaticLayerSuppressed: rerollSession.automaticLayerSuppressed
      }),
      normalizeState,
      openItemDialog,
      closeItemDialog,
      requestEditorExit,
      isItemEditorDirty,
      updateBeforeUnloadGuard,
      saveItemFromEditor,
      collectItemFromForm,
      validateItem,
      setColorControl,
      colorControlValue,
      updateSecondaryColorAvailability,
      relationshipCandidates,
      syncPairRelationships,
      matchesClosetSearch,
      pickOutfit,
      isCompatibleOutfit,
      validSwapChoices,
      swapChoiceReport,
      applySwapChoice,
      generationContextKey,
      candidateItems,
      scoreOutfit,
      reconcileSocksForOutfit,
      footwearSockPolicy,
      displayOutfitItems,
      renderResult,
      lastExactOutfitDate,
      lastTopBottomPairDate,
      lastItemWornDate,
      addHistoryRecord,
      similarItem,
      sampleWardrobe,
      changedItemIds,
      describeDependentChanges,
      reconcileBeltForOutfit,
      removeOptionalBelt,
      removeAutomaticLayer,
      isAutomaticLayerCandidate,
      currentEffectiveContext,
      refreshWeather,
      resolveAutomaticContextForGeneration,
      generateAndRender,
      disableAutomaticWeather,
      protectedOriginals,
      preserveRecoveryPayload,
      logCurrentOutfit,
      clearChangedHighlights,
      getLoadIssue: () => loadIssue,
      isStorageWriteLocked: () => storageWriteLocked,
      importBackupText,
      setContextSession(value) {
        contextSession = { ...contextSession, ...(value || {}) };
        renderWeatherControls();
      },
      setCurrentOutfit(outfit) {
        currentOutfit = outfit;
        resultState = outfit?.error ? "error" : (outfit ? "outfit" : "empty");
      },
      replaceState(raw) {
        appState = normalizeState(raw);
        currentOutfit = null;
        resultState = "empty";
        logInProgress = false;
        rerollSession = createRerollSession();
        contextSession = createContextSession();
        weatherSessionFetchedAt = "";
        automaticAttemptWithoutPermissionsApi = false;
        generationPromise = null;
        initializeGenerateOccasion();
        renderAll();
      }
    };
  }
})();
