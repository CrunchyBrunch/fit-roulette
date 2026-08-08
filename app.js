(() => {
  "use strict";

  const STORAGE_KEY = "fitRoulette.v1";
  const APP_VERSION = "1.4.1";
  const SmartCloset = window.FitRouletteSmartCloset;
  if (!SmartCloset) throw new Error("Smart Closet module failed to load.");
  const SCHEMA_VERSION = SmartCloset.SCHEMA_VERSION;
  const RECOVERY_KEY = SmartCloset.RECOVERY_KEY;

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
        { key: "belt", label: "Belt", categories: ["belt"] },
        { key: "socks", label: "Socks", categories: ["socks"] }
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
        { key: "belt", label: "Belt", categories: ["belt"] },
        { key: "socks", label: "Socks", categories: ["socks"] }
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
      label: "Gym/Errands",
      targetFormality: 1,
      formalityGap: 6,
      slots: [
        { key: "top", label: "Top", categories: ["top"] },
        { key: "bottom", label: "Bottom/Shorts", categories: ["bottom"] },
        { key: "shoes", label: "Shoes", categories: ["shoes"] }
      ]
    }
  };

  const OCCASION_ORDER = ["work", "friday", "casual", "date", "gym"];
  const THEME_VALUES = ["system", "light", "dark"];
  const AFTER_LOGGING_VALUES = ["confirm_keep", "keep", "clear"];
  const WEATHER_CONDITIONS = ["sunny", "cloudy", "rain", "snow", "windy"];
  const BELT_MODES = ["required", "optional", "none"];
  const COLOR_OPTIONS = SmartCloset.COLOR_PALETTE;
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
  let rerollSession = createRerollSession();
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
    $("#useWeather").addEventListener("change", saveWeatherSettings);
    $("#weatherTemperature").addEventListener("change", saveWeatherSettings);
    $("#weatherCondition").addEventListener("change", saveWeatherSettings);
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
    $("#exportRecoveryBtn").addEventListener("click", exportRecoveryPayload);
    $("#importBtn").addEventListener("click", () => $("#importFile").click());
    $("#importFile").addEventListener("change", importBackup);
    $("#resetDemoBtn").addEventListener("click", resetDemoData);
    $("#clearBansBtn").addEventListener("click", clearBannedCombos);
    $("#themeSelect").addEventListener("change", (event) => updateTheme(event.target.value));
    $("#afterLoggingSelect").addEventListener("change", (event) => updateAfterLogging(event.target.value));
    $("#defaultOccasionSelect").addEventListener("change", (event) => updateDefaultOccasion(event.target.value));

    $("#itemForm").addEventListener("submit", saveItemFromForm);
    $("#itemForm").addEventListener("click", handleItemFormClick);
    $("#itemCategory").addEventListener("change", () => {
      renderSubtypeOptions();
      applyTemplate($("#itemSubtype").value);
    });
    $("#itemSubtype").addEventListener("change", () => applyTemplate($("#itemSubtype").value));
    $("#saveGenerateBtn").addEventListener("click", () => saveItemFromEditor({ generateAfter: true }));
    $("#closeItemDialogBtn").addEventListener("click", closeItemDialog);
    $("#addSimilarBtn").addEventListener("click", addSimilarFromDialog);
    $("#permanentDeleteBtn").addEventListener("click", permanentlyDeleteFromDialog);
    $("#itemPrimaryColor").addEventListener("input", updateSelectedColorChip);
    $("#itemName").addEventListener("input", updateEditorTitle);
  }

  function renderStaticOptions() {
    $("#occasionSelect").innerHTML = OCCASION_ORDER.map((id) => {
      const occasion = OCCASIONS[id];
      return `<option value="${occasion.id}">${escapeHtml(occasion.label)}</option>`;
    }).join("");

    const categoryOptions = CATEGORY_ORDER.map((id) => {
      return `<option value="${id}">${escapeHtml(CATEGORIES[id])}</option>`;
    }).join("");

    $("#itemCategory").innerHTML = categoryOptions;
    $("#closetCategory").innerHTML = `<option value="all">All categories</option>${categoryOptions}`;
    renderSubtypeOptions();

    $("#itemOccasions").innerHTML = OCCASION_ORDER.map((id) => {
      const occasion = OCCASIONS[id];
      return `
        <label class="check-pill">
          <input type="checkbox" name="itemOccasion" value="${occasion.id}">
          <span>${escapeHtml(occasion.label)}</span>
        </label>
      `;
    }).join("");

    const quickTemplates = ["polo", "t-shirt", "button-down", "sweater", "jeans", "dress pants", "chinos", "cargos", "athletic shorts", "sneakers", "athletic/running shoes", "dress shoes", "boots", "jacket", "hoodie"];
    $("#templateChips").innerHTML = quickTemplates.map((id) => {
      return `<button class="mini-button" type="button" data-template-id="${escapeAttribute(id)}">${escapeHtml(SmartCloset.titleCase(id))}</button>`;
    }).join("");

    $("#primaryColorChips").innerHTML = COLOR_OPTIONS.map((color) => {
      return `<button class="mini-button" type="button" data-color="${escapeAttribute(SmartCloset.titleCase(color))}">${escapeHtml(SmartCloset.titleCase(color))}</button>`;
    }).join("");

    $("#colorSuggestions").innerHTML = COLOR_OPTIONS.map((color) => `<option value="${escapeAttribute(SmartCloset.titleCase(color))}"></option>`).join("");
    $("#itemPattern").innerHTML = SmartCloset.PATTERNS.map((value) => `<option value="${value}">${escapeHtml(SmartCloset.titleCase(value))}</option>`).join("");
    $("#itemFormality").innerHTML = Object.entries(SmartCloset.FORMALITY_LABELS).map(([value, label]) => `<option value="${value}">${value}. ${escapeHtml(label)}</option>`).join("");
    $("#itemSleeveLength").innerHTML = SmartCloset.SLEEVE_LENGTHS.map((value) => `<option value="${value}">${escapeHtml(SmartCloset.titleCase(value))}</option>`).join("");
    $("#itemBottomLength").innerHTML = SmartCloset.BOTTOM_LENGTHS.map((value) => `<option value="${value}">${escapeHtml(SmartCloset.titleCase(value))}</option>`).join("");
    $("#itemWarmth").innerHTML = SmartCloset.WARMTH_LEVELS.map((value) => `<option value="${value}">${escapeHtml(SmartCloset.titleCase(value))}</option>`).join("");
    $("#itemRainPolicy").innerHTML = SmartCloset.RAIN_POLICIES.map((value) => `<option value="${value}">${escapeHtml(value === "avoid" ? "Avoid rain / snow" : SmartCloset.titleCase(value))}</option>`).join("");

    $("#manualLogOccasion").innerHTML = OCCASION_ORDER.map((id) => {
      return `<option value="${id}">${escapeHtml(OCCASIONS[id].label)}</option>`;
    }).join("");

    $("#defaultOccasionSelect").innerHTML = OCCASION_ORDER.map((id) => {
      return `<option value="${id}">${escapeHtml(OCCASIONS[id].label)}</option>`;
    }).join("");

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
  }

  function initializeGenerateOccasion() {
    $("#occasionSelect").value = validOccasion(appState.settings.defaultOccasion);
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
        migrationInfo.recoveryCreated = preserveRecoveryPayload(saved);
      } catch (recoveryError) {
        console.error(recoveryError);
        return loadFailureState(recoveryError, "Saved closet data is malformed and a recovery copy could not be created. The original data remains untouched.");
      }
      return loadFailureState(error, "Saved closet data is malformed. The original data is untouched and editing is locked until a valid backup is imported.");
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
        migrationInfo.recoveryCreated = preserveRecoveryPayload(saved);
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

  function preserveRecoveryPayload(payload) {
    try {
      if (localStorage.getItem(RECOVERY_KEY) !== null) return false;
      localStorage.setItem(RECOVERY_KEY, payload);
      return true;
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
        enabled: weather.enabled === true,
        temperature: nullableNumber(weather.temperature, -30, 130),
        condition: WEATHER_CONDITIONS.includes(weather.condition) ? weather.condition : "sunny"
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
      note: stringOr(record.note, "")
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
        ${currentOutfit.items.map((item) => renderResultItem(item, currentOutfit, isLogged)).join("")}
      </div>
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

    return `
      <div class="result-item ${changed ? "is-changed" : ""}" data-result-item-id="${escapeAttribute(item.id)}">
        <div class="result-item-copy">
          <p class="item-kicker">${escapeHtml(CATEGORIES[item.category] || item.category)}</p>
          <h3>${escapeHtml(item.name)}</h3>
          ${color}
        </div>
        ${isLogged ? "" : `
          <button class="swap-button" type="button" data-result-action="swap" data-item-id="${escapeAttribute(item.id)}" ${locked ? "disabled" : ""}>
            ${locked ? "Locked" : "Swap"}
          </button>
        `}
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
    }
  }

  function renderCloset() {
    const list = $("#closetList");
    const query = normalizeTag(closetFilters.search);
    const matchingItems = appState.wardrobe
      .filter((item) => closetFilters.showInactive || isAvailable(item))
      .filter((item) => closetFilters.category === "all" || item.category === closetFilters.category)
      .filter((item) => !query || itemSignals(item).some((signal) => signal.includes(query)))
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
      const items = record.itemIds.map((id) => snapshotOrItem(record, id)).filter(Boolean);
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
          ${record.note ? `<p class="history-note">${escapeHtml(record.note)}</p>` : ""}
        </article>
      `;
    }).join("");
  }

  function renderSettings() {
    const activeCount = appState.wardrobe.filter(isAvailable).length;
    const unavailableCount = appState.wardrobe.filter((item) => item.status === "unavailable").length;
    const archivedCount = appState.wardrobe.filter((item) => item.status === "archived").length;
    $("#themeSelect").value = appState.settings.theme;
    $("#afterLoggingSelect").value = appState.settings.afterLogging;
    $("#defaultOccasionSelect").value = appState.settings.defaultOccasion;
    $("#appVersion").textContent = `App version ${APP_VERSION} · Data schema ${appState.schemaVersion}`;
    $("#exportRecoveryBtn").hidden = localStorage.getItem(RECOVERY_KEY) === null && !loadIssue;
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
      $("#occasionSelect").value = appState.settings.defaultOccasion;
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
    $("#useWeather").checked = weather.enabled;
    $("#weatherTemperature").value = weather.temperature ?? "";
    $("#weatherCondition").value = weather.condition;
    $("#weatherInputs").hidden = !weather.enabled;
    $("#weatherSummary").textContent = weather.enabled
      ? `${weather.temperature ?? "--"}°F, ${capitalize(weather.condition)}`
      : "Off";
  }

  function saveWeatherSettings() {
    appState.settings.weather = {
      enabled: $("#useWeather").checked,
      temperature: nullableNumber($("#weatherTemperature").value, -30, 130),
      condition: WEATHER_CONDITIONS.includes($("#weatherCondition").value) ? $("#weatherCondition").value : "sunny"
    };
    saveState();
    renderWeatherControls();
    handleGenerationContextChange();
  }

  function weatherResultLabel() {
    const weather = appState.settings.weather;
    if (!weather.enabled) return "";
    const temperature = weather.temperature === null ? "" : `${weather.temperature}° `;
    return `<span class="weather-badge">${escapeHtml(`${temperature}${capitalize(weather.condition)}`)}</span>`;
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

    $("#itemDialogMode").textContent = editingItemId ? "Editing Smart Closet item" : (addSimilarSourceId ? "Add Similar" : "Quick Add");
    $("#itemId").value = editingItemId || "";
    $("#itemName").value = item.name || "";
    updateEditorTitle();
    $("#itemCategory").value = item.category || "top";
    renderSubtypeOptions(item.subtype);
    $("#itemPrimaryColor").value = item.primaryColor || "";
    $("#itemSecondaryColor").value = item.secondaryColor || "";
    $("#itemPattern").value = item.pattern || "solid";
    $("#itemFormality").value = item.formality || 3;
    $("#itemSleeveLength").value = item.sleeveLength || "unspecified";
    $("#itemBottomLength").value = item.bottomLength || "not_applicable";
    $("#itemWarmth").value = item.warmth || "unspecified";
    $("#itemRainPolicy").value = item.rainPolicy || "unspecified";
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

    $$("input[name='itemOccasion']").forEach((input) => {
      input.checked = item.occasions.includes(input.value);
    });

    $("#addSimilarBtn").hidden = !editingItemId;
    $("#permanentDeleteBtn").hidden = !editingItemId;
    $("#matchingDetails").open = Boolean(editingItemId);
    $("#advancedDetails").open = false;
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
    updateSelectedColorChip();
    $("#itemForm").scrollTop = 0;

    const dialog = $("#itemDialog");
    if (typeof dialog.showModal === "function") {
      dialog.showModal();
    } else {
      dialog.setAttribute("open", "");
    }
  }

  function updateEditorTitle() {
    const name = $("#itemName").value.trim();
    $("#itemDialogTitle").textContent = name || "Add Item";
  }

  function closeItemDialog() {
    closeDialog($("#itemDialog"));
    editingItemId = null;
    addSimilarSourceId = null;
  }

  function saveItemFromForm(event) {
    event.preventDefault();
    saveItemFromEditor({ generateAfter: false });
  }

  function saveItemFromEditor({ generateAfter }) {
    if (storageWriteLocked) {
      showToast("Data is locked to protect the original closet.");
      return;
    }
    const item = collectItemFromForm();
    const error = validateItem(item);
    if (error) {
      $("#formError").textContent = error;
      $("#formError").hidden = false;
      return;
    }

    const now = new Date().toISOString();
    let savedItemId = editingItemId;
    if (editingItemId) {
      const index = appState.wardrobe.findIndex((existing) => existing.id === editingItemId);
      if (index !== -1) {
        appState.wardrobe[index] = {
          ...appState.wardrobe[index],
          ...item,
          id: editingItemId,
          review: { status: "reviewed", reasons: [], reviewedAt: now },
          legacyFallback: false,
          updatedAt: now
        };
      }
      showToast("Item saved.");
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
      appState.wardrobe.push(savedItem);
      savedItemId = savedItem.id;
      showToast("Item added.");
    }

    syncPairRelationships(savedItemId, selectedOptions($("#preferItemsSelect")), selectedOptions($("#neverItemsSelect")), now);
    invalidateGenerationState();
    if (!saveState()) return;
    closeItemDialog();
    renderAll();
    if (generateAfter && savedItemId) {
      generateWithItem(savedItemId);
    }
  }

  function collectItemFromForm() {
    const category = $("#itemCategory").value;
    return {
      id: $("#itemId").value,
      name: $("#itemName").value.trim(),
      category,
      subtype: $("#itemSubtype").value,
      primaryColor: $("#itemPrimaryColor").value.trim(),
      secondaryColor: $("#itemSecondaryColor").value.trim(),
      pattern: $("#itemPattern").value,
      sleeveLength: ["top", "layer"].includes(category) ? $("#itemSleeveLength").value : "not_applicable",
      bottomLength: category === "bottom" ? $("#itemBottomLength").value : "not_applicable",
      occasions: $$("input[name='itemOccasion']:checked").map((input) => input.value),
      formality: Number($("#itemFormality").value),
      beltMode: category === "bottom" ? ($("input[name='itemBeltMode']:checked")?.value || "optional") : "",
      warmth: $("#itemWarmth").value,
      rainPolicy: $("#itemRainPolicy").value,
      status: $("#itemStatus").value,
      preference: $("#itemPreference").value,
      labels: parseCsv($("#itemLabels").value),
      imageUrl: $("#itemImageUrl").value.trim(),
      notes: $("#itemNotes").value.trim()
    };
  }

  function validateItem(item) {
    if (!item.name) return "Name is required.";
    if (!item.category) return "Category is required.";
    if (!item.subtype) return "Subtype is required.";
    if (!item.primaryColor) return "Primary color is required.";
    if (!item.occasions.length) return "Choose at least one occasion.";
    const preferred = selectedOptions($("#preferItemsSelect"));
    const never = selectedOptions($("#neverItemsSelect"));
    if (preferred.some((id) => never.includes(id))) return "An item cannot be both preferred and never paired.";
    return "";
  }

  function handleItemFormClick(event) {
    const templateButton = event.target.closest("[data-template-id]");
    if (templateButton) {
      applyTemplate(templateButton.dataset.templateId);
      return;
    }

    const colorButton = event.target.closest("[data-color]");
    if (colorButton) {
      const selected = normalizeTag($("#itemPrimaryColor").value) === normalizeTag(colorButton.dataset.color);
      $("#itemPrimaryColor").value = selected ? "" : colorButton.dataset.color;
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
    if (template.category === "bottom") {
      const beltInput = $(`input[name='itemBeltMode'][value='${template.beltMode || "optional"}']`);
      if (beltInput) beltInput.checked = true;
    }
    applyOccasions(template.occasions || []);
    renderBeltModeControl();
    showToast(`${SmartCloset.titleCase(templateId)} defaults applied.`);
  }

  function similarItem(source) {
    const now = new Date().toISOString();
    return SmartCloset.createItem({
      name: `${source.name} Similar`,
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
      preference: source.preference,
      labels: [...source.labels],
      beltMode: source.beltMode,
      status: "available",
      lastWorn: null,
      imageUrl: "",
      notes: source.notes,
      legacyFallback: false,
      legacyMatching: {},
      review: { status: "reviewed", reasons: [], reviewedAt: now },
      createdAt: now,
      updatedAt: now
    }, { now });
  }

  function renderPairRelationshipOptions(itemId, clearSelections = false) {
    const relationships = itemId && !clearSelections
      ? appState.pairRelationships.filter((record) => record.itemIds.includes(itemId))
      : [];
    const selectedFor = (type) => new Set(relationships.filter((record) => record.type === type).flatMap((record) => record.itemIds).filter((id) => id !== itemId));
    const render = (type) => {
      const selected = selectedFor(type);
      return appState.wardrobe.filter((item) => item.id !== itemId).sort(sortItems).map((item) => {
        return `<option value="${escapeAttribute(item.id)}" ${selected.has(item.id) ? "selected" : ""}>${escapeHtml(item.name)} — ${escapeHtml(CATEGORIES[item.category])}</option>`;
      }).join("");
    };
    $("#preferItemsSelect").innerHTML = render("prefer");
    $("#neverItemsSelect").innerHTML = render("never");
  }

  function syncPairRelationships(itemId, preferredIds, neverIds, now) {
    appState.pairRelationships = appState.pairRelationships.filter((record) => !record.itemIds.includes(itemId));
    const add = (otherId, type) => {
      const itemIds = SmartCloset.canonicalPair(itemId, otherId);
      if (itemIds.length !== 2) return;
      appState.pairRelationships.push({ id: uid("pair"), type, itemIds, createdAt: now, updatedAt: now });
    };
    unique(preferredIds).forEach((id) => add(id, "prefer"));
    unique(neverIds).forEach((id) => add(id, "never"));
  }

  function renderBeltModeControl() {
    const isBottom = $("#itemCategory").value === "bottom";
    $("#beltModeFieldset").hidden = !isBottom;
    if (isBottom && !$("input[name='itemBeltMode']:checked")) {
      const optional = $("input[name='itemBeltMode'][value='optional']");
      if (optional) optional.checked = true;
    }
  }

  function applyOccasionPreset(preset) {
    const presets = {
      office: ["work", "friday", "date"],
      casual: ["friday", "casual", "gym"],
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

  function updateSelectedColorChip() {
    const selected = normalizeTag($("#itemPrimaryColor").value);
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
    $("#swapDialogTitle").textContent = `Swap ${CATEGORIES[currentItem.category] || "Item"}`;
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
    const excluded = { status: 0, occasion: 0, matching: 0 };
    const eligible = appState.wardrobe
      .filter((item) => item.category === currentItem.category && item.id !== currentItem.id)
      .map((replacement) => {
        if (!isAvailable(replacement)) {
          excluded.status += 1;
          return null;
        }
        if (!matchesOccasion(replacement, occasionId)) {
          excluded.occasion += 1;
          return null;
        }
        const replaced = currentOutfit.items.map((item) => item.id === currentItem.id ? replacement : item);
        const reconciled = reconcileBeltForOutfit(replaced, occasionId, currentOutfit.buildAroundId);
        if (!reconciled || !isCompatibleOutfit(reconciled, occasionId, currentOutfit.buildAroundId)) {
          excluded.matching += 1;
          return null;
        }
        return {
          replacementId: replacement.id,
          items: sortOutfitItems(reconciled),
          score: scoreOutfit(reconciled, occasionId, { buildAroundId: currentOutfit.buildAroundId })
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
    currentOutfit = {
      ...currentOutfit,
      items: choice.items,
      score: choice.score,
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
    closeItemDialog();
    openItemDialog(sourceId, { addSimilar: true });
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
    closeItemDialog();
    renderAll();
    showToast("Item permanently deleted.");
  }

  // Result transitions are intentionally centralized: Generate starts a new
  // viewed-fit session, while Reroll continues the current context. Both clear
  // any prior logged/confirmation state and make the next result loggable once.
  function generateAndRender(options = {}) {
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
    return [...candidates.values()].sort((a, b) => b.score - a.score);
  }

  function chooseCandidate(ranked) {
    const topPool = ranked.slice(0, Math.min(5, ranked.length));
    const index = Math.floor(Math.pow(Math.random(), 1.7) * topPool.length);
    return topPool[index];
  }

  function cloneCandidate(candidate) {
    return {
      ...candidate,
      items: [...candidate.items]
    };
  }

  function addScoredCandidate(map, outfit, occasionId, buildAroundId) {
    if (!outfit || !outfit.length) return;
    if (buildAroundId && !outfit.some((item) => item.id === buildAroundId)) return;
    if (!isCompatibleOutfit(outfit, occasionId, buildAroundId)) return;
    const key = comboKey(outfit.map((item) => item.id));
    if (map.has(key)) return;
    map.set(key, {
      signature: key,
      occasion: occasionId,
      buildAroundId,
      items: sortOutfitItems(outfit),
      score: scoreOutfit(outfit, occasionId, { buildAroundId })
    });
  }

  function createRerollSession(contextKey = "") {
    return {
      contextKey,
      candidates: [],
      seen: new Set(),
      poolSize: 0,
      repeatsEnabled: false,
      message: ""
    };
  }

  function generationContextKey(occasionId = $("#occasionSelect").value, buildAroundId = $("#buildAroundSelect").value) {
    const weather = appState.settings.weather;
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
        rainPolicy: item.rainPolicy
      }));
    return JSON.stringify({
      occasionId,
      buildAroundId,
      weather: {
        enabled: weather.enabled,
        temperature: weather.temperature,
        condition: weather.condition
      },
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
        score: currentOutfit.score
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
    rerollSession = createRerollSession(contextKey);
    rerollSession.candidates = candidates;
    rerollSession.poolSize = candidates.length;
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
      if (!pool.length) return null;
      const item = pool[Math.floor(Math.random() * pool.length)];
      selected.push(item);
      usedIds.add(item.id);
    }

    if (buildAround && !usedIds.has(buildAround.id)) {
      selected.push(buildAround);
    }

    return reconcileBeltForOutfit(uniqueItems(selected), occasion.id, buildAround?.id || "", {
      dropOptionalBelt: Math.random() < 0.3
    });
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
        const withoutOptionalBelt = reconcileBeltForOutfit(uniqueOutfit, occasion.id, buildAround?.id || "", {
          dropOptionalBelt: true
        });
        if (withoutOptionalBelt && comboKey(withoutOptionalBelt.map((item) => item.id)) !== comboKey((reconciled || []).map((item) => item.id))) {
          results.push(withoutOptionalBelt);
        }
        return;
      }

      const slot = slots[index];
      let pool = candidateItems(slot, occasion.id).filter((item) => !usedIds.has(item.id));
      if (buildAround && slotAcceptsItem(slot, buildAround)) {
        pool = [buildAround];
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
      return isAvailable(item) && slot.categories.includes(item.category) && matchesOccasion(item, occasionId);
    });
  }

  function slotAcceptsItem(slot, item) {
    return slot.categories.includes(item.category);
  }

  function isCompatibleOutfit(items, occasionId, buildAroundId = "") {
    if (!items.length || isComboBanned(items)) return false;

    const occasion = OCCASIONS[occasionId];
    if (!occasion) return false;
    const bottoms = items.find((item) => item.category === "bottom");
    const belts = items.filter((item) => item.category === "belt");
    if (bottoms?.beltMode === "none" && belts.length) return false;
    if (bottoms?.beltMode === "required" && occasionSupportsBelts(occasionId) && !belts.length) return false;

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

    score += items.reduce((sum, item) => sum + weatherScore(item), 0);

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

    if (bottoms.beltMode !== "required" || !occasionSupportsBelts(occasionId) || belts.length) {
      return reconciled;
    }

    const baseItems = reconciled.filter((item) => item.category !== "belt");
    const validBelts = candidateItems({ categories: ["belt"] }, occasionId)
      .filter((belt) => isCompatibleOutfit([...baseItems, belt], occasionId))
      .sort((a, b) => scoreOutfit([...baseItems, b], occasionId) - scoreOutfit([...baseItems, a], occasionId));

    if (!validBelts.length) return null;
    reconciled = [...baseItems, validBelts[0]];
    return uniqueItems(reconciled);
  }

  function occasionSupportsBelts(occasionId) {
    const occasion = OCCASIONS[occasionId];
    if (!occasion) return false;
    return [...occasion.slots, ...(occasion.optionalSlots || [])]
      .some((slot) => slot.categories.includes("belt"));
  }

  function weatherScore(item) {
    const weather = appState.settings.weather;
    if (!weather.enabled) return 0;
    let score = 0;
    const temperature = weather.temperature;

    if (temperature !== null) {
      if (item.minTemperature !== null && temperature < item.minTemperature) {
        score -= Math.min(35, (item.minTemperature - temperature) * 2);
      }
      if (item.maxTemperature !== null && temperature > item.maxTemperature) {
        score -= Math.min(35, (temperature - item.maxTemperature) * 2);
      }
      const warmthValue = { very_light: 1, light: 2, medium: 3, warm: 4, very_warm: 5 }[item.warmth];
      if (warmthValue) {
        const targetWarmth = temperature <= 35 ? 5 : temperature <= 50 ? 4 : temperature <= 65 ? 3 : temperature <= 78 ? 2 : 1;
        score -= Math.abs(warmthValue - targetWarmth) * 3;
      }
    }

    if (Array.isArray(item.suitableConditions) && item.suitableConditions.length) {
      score += item.suitableConditions.includes(weather.condition) ? 5 : -8;
    }
    if (["rain", "snow"].includes(weather.condition)) {
      if (item.rainPolicy === "preferred") score += 7;
      else if (item.rainPolicy === "okay") score += 3;
    }
    return score;
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
      note: ""
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

  function addHistoryRecord({ date, occasion, items, source, note }) {
    const validItems = uniqueItems(items).filter(Boolean);
    appState.history.unshift({
      id: uid("log"),
      date,
      occasion: normalizeOccasionToken(occasion) || "casual",
      itemIds: validItems.map((item) => item.id),
      itemSnapshots: validItems.map(snapshotItem),
      source: source === "manual" ? "manual" : "generated",
      note: stringOr(note, "")
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

  function exportRecoveryPayload() {
    const payload = localStorage.getItem(RECOVERY_KEY) ?? (loadIssue ? localStorage.getItem(STORAGE_KEY) : null);
    if (payload === null) {
      showToast("No protected original is available.");
      return;
    }
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `fit-roulette-protected-original-${dateOnly(new Date())}.json`;
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
    if (legacy) {
      try {
        recoveryCreated = preserveRecoveryPayload(rawText);
        if (recoveryCreated) $("#exportRecoveryBtn").hidden = false;
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
    initializeGenerateOccasion();
    renderAll();
    if (legacy && recoveryCreated) showToast("Backup imported. Protected original saved.");
    else if (legacy) showToast("Backup imported. Existing protected original retained.");
    else showToast("Backup imported.");
    return { ok: true, legacy, recoveryCreated };
  }

  function importSchemaVersion(raw) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      throw Object.assign(new Error("Backup root must be an object."), { code: "INVALID_ROOT" });
    }
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
      item.secondaryColor,
      item.pattern,
      item.status,
      SmartCloset.FORMALITY_LABELS[item.formality],
      ...item.labels,
      ...item.occasions,
    ].map(normalizeTag).filter(Boolean));
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
      gym: "gym",
      errands: "gym",
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
        message: rerollSession.message
      }),
      normalizeState,
      openItemDialog,
      pickOutfit,
      isCompatibleOutfit,
      validSwapChoices,
      swapChoiceReport,
      generationContextKey,
      candidateItems,
      scoreOutfit,
      lastExactOutfitDate,
      lastTopBottomPairDate,
      lastItemWornDate,
      addHistoryRecord,
      similarItem,
      sampleWardrobe,
      changedItemIds,
      describeDependentChanges,
      clearChangedHighlights,
      getLoadIssue: () => loadIssue,
      isStorageWriteLocked: () => storageWriteLocked,
      importBackupText,
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
        initializeGenerateOccasion();
        renderAll();
      }
    };
  }
})();
