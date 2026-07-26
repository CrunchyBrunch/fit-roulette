(() => {
  "use strict";

  const STORAGE_KEY = "fitRoulette.v1";
  const APP_VERSION = "1.3.1";

  const CATEGORIES = {
    top: "Top",
    pants: "Pants",
    shoes: "Shoes",
    belt: "Belt",
    socks: "Socks",
    outerwear: "Outerwear",
    accessory: "Accessory"
  };

  const CATEGORY_ORDER = ["top", "pants", "shoes", "belt", "socks", "outerwear", "accessory"];

  const OCCASIONS = {
    work: {
      id: "work",
      label: "Work / Office",
      targetFormality: 7,
      formalityGap: 3,
      slots: [
        { key: "top", label: "Top", categories: ["top"] },
        { key: "pants", label: "Pants", categories: ["pants"] },
        { key: "shoes", label: "Shoes", categories: ["shoes"] },
        { key: "belt", label: "Belt", categories: ["belt"] },
        { key: "socks", label: "Socks", categories: ["socks"] }
      ]
    },
    friday: {
      id: "friday",
      label: "Friday Jeans",
      targetFormality: 5,
      formalityGap: 4,
      slots: [
        { key: "top", label: "Top", categories: ["top"] },
        { key: "pants", label: "Jeans/Pants", categories: ["pants"] },
        { key: "shoes", label: "Shoes", categories: ["shoes"] },
        { key: "belt", label: "Belt", categories: ["belt"] },
        { key: "socks", label: "Socks", categories: ["socks"] }
      ]
    },
    casual: {
      id: "casual",
      label: "Casual",
      targetFormality: 4,
      formalityGap: 5,
      slots: [
        { key: "top", label: "Top", categories: ["top"] },
        { key: "pants", label: "Pants", categories: ["pants"] },
        { key: "shoes", label: "Shoes", categories: ["shoes"] }
      ]
    },
    date: {
      id: "date",
      label: "Date",
      targetFormality: 6,
      formalityGap: 4,
      slots: [
        { key: "top", label: "Top", categories: ["top"] },
        { key: "pants", label: "Pants", categories: ["pants"] },
        { key: "shoes", label: "Shoes", categories: ["shoes"] }
      ],
      optionalSlots: [
        { key: "extra", label: "Extra", categories: ["accessory", "belt"], chance: 0.7 }
      ]
    },
    gym: {
      id: "gym",
      label: "Gym/Errands",
      targetFormality: 3,
      formalityGap: 6,
      slots: [
        { key: "top", label: "Top", categories: ["top"] },
        { key: "pants", label: "Pants/Shorts", categories: ["pants"] },
        { key: "shoes", label: "Shoes", categories: ["shoes"] }
      ]
    }
  };

  const OCCASION_ORDER = ["work", "friday", "casual", "date", "gym"];
  const THEME_VALUES = ["system", "light", "dark"];
  const WEATHER_CONDITIONS = ["sunny", "cloudy", "rain", "snow", "windy"];
  const BELT_MODES = ["required", "optional", "none"];
  const COLOR_OPTIONS = ["black", "white", "off-white", "navy", "light blue", "gray", "dark gray", "khaki", "tan", "brown", "olive"];
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

  const ITEM_TEMPLATES = {
    polo: { label: "Polo", category: "top", tags: ["polo", "smart casual"], occasions: ["work", "friday", "casual", "date"], formality: 6, worksWithTags: ["navy", "gray", "black", "khaki", "jeans", "olive", "brown"] },
    tshirt: { label: "T-Shirt", category: "top", tags: ["t-shirt", "casual"], occasions: ["casual", "gym"], formality: 3, worksWithTags: ["jeans", "black", "gray", "navy", "olive"] },
    dress_pants: { label: "Dress Pants", category: "pants", tags: ["dress pants", "office", "pressed"], occasions: ["work", "friday", "date"], formality: 7, beltMode: "optional", worksWithTags: ["polo", "dress shoes", "belt", "black", "navy", "gray", "tan"], avoidWithTags: ["athletic", "running"] },
    jeans: { label: "Jeans", category: "pants", tags: ["jeans", "denim", "casual"], occasions: ["friday", "casual", "date", "gym"], formality: 4, beltMode: "optional", worksWithTags: ["polo", "t-shirt", "sneakers", "boots"] },
    cargos: { label: "Cargos", category: "pants", tags: ["cargo", "cargos", "casual", "errands"], occasions: ["casual", "gym"], formality: 3, beltMode: "optional", worksWithTags: ["sneakers", "boots", "black", "gray", "olive"], avoidWithTags: ["dress shoes", "pressed"] },
    dress_shoes: { label: "Dress Shoes", category: "shoes", tags: ["dress shoes", "office", "date"], occasions: ["work", "friday", "date"], formality: 8, worksWithTags: ["dress pants", "belt", "black", "navy", "gray", "khaki"], avoidWithTags: ["cargo", "athletic", "running"] },
    sneakers: { label: "Sneakers", category: "shoes", tags: ["sneakers", "casual"], occasions: ["friday", "casual", "gym"], formality: 3, worksWithTags: ["jeans", "cargo", "black", "gray", "navy"] },
    boots: { label: "Boots", category: "shoes", tags: ["boots", "casual", "date"], occasions: ["friday", "casual", "date"], formality: 5, worksWithTags: ["jeans", "khaki", "brown", "olive", "navy"] },
    belt: { label: "Belt", category: "belt", tags: ["belt"], occasions: ["work", "friday", "casual", "date"], formality: 6, worksWithTags: ["dress shoes", "jeans", "dress pants"] },
    socks: { label: "Socks", category: "socks", tags: ["socks"], occasions: ["work", "friday", "date"], formality: 5, worksWithTags: ["dress shoes", "black", "brown", "navy", "gray"] }
  };

  const MATCH_CHIPS = {
    top: {
      works: [
        ["works with navy pants", ["navy", "pants"]],
        ["works with gray pants", ["gray", "pants"]],
        ["works with black pants", ["black", "pants"]],
        ["works with khaki pants", ["khaki", "pants"]],
        ["works with jeans", ["jeans"]],
        ["works with olive", ["olive"]],
        ["works with brown", ["brown"]]
      ],
      avoid: [["avoid cargos", ["cargo", "cargos"]], ["avoid athletic", ["athletic", "running"]]]
    },
    pants: {
      works: [
        ["works with white tops", ["white", "top"]],
        ["works with black tops", ["black", "top"]],
        ["works with gray tops", ["gray", "top"]],
        ["works with navy tops", ["navy", "top"]],
        ["works with light blue tops", ["light blue", "top"]],
        ["works with tan tops", ["tan", "top"]],
        ["works with off-white tops", ["off-white", "top"]]
      ],
      avoid: [["avoid running shoes", ["running"]], ["avoid dress shoes", ["dress shoes"]]]
    },
    shoes: {
      works: [
        ["works with black belt", ["black", "belt"]],
        ["works with brown belt", ["brown", "belt"]],
        ["works with jeans", ["jeans"]],
        ["works with navy pants", ["navy", "pants"]],
        ["works with gray pants", ["gray", "pants"]],
        ["works with khaki pants", ["khaki", "pants"]],
        ["office-safe", ["office", "dress pants"]],
        ["casual-only", ["casual", "jeans", "cargo"]]
      ],
      avoid: [["avoid cargos", ["cargo", "cargos"]], ["avoid dress outfits", ["dress pants", "office"]]]
    },
    belt: {
      works: [
        ["works with black shoes", ["black", "shoes"]],
        ["works with brown shoes", ["brown", "shoes"]],
        ["works with dress outfits", ["dress pants", "dress shoes", "office"]],
        ["works with casual outfits", ["jeans", "casual"]]
      ],
      avoid: []
    },
    socks: {
      works: [
        ["office-safe", ["office", "dress shoes"]],
        ["casual", ["casual", "sneakers"]],
        ["black shoes", ["black", "shoes"]],
        ["brown shoes", ["brown", "shoes"]],
        ["navy pants", ["navy", "pants"]],
        ["gray pants", ["gray", "pants"]]
      ],
      avoid: []
    },
    outerwear: { works: [["works with casual", ["casual"]], ["works with office", ["office"]]], avoid: [] },
    accessory: { works: [["works with casual", ["casual"]], ["works with date", ["date"]]], avoid: [] }
  };

  let appState = loadState();
  let currentOutfit = null;
  let resultState = "empty";
  let pendingBanFeedback = null;
  let swapTargetItemId = null;
  let logInProgress = false;
  let editingItemId = null;
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
    $("#generateBtn").addEventListener("click", generateAndRender);
    $("#rerollBtn").addEventListener("click", () => generateAndRender({ comparePrevious: true }));
    $("#logBtn").addEventListener("click", logCurrentOutfit);
    $("#banBtn").addEventListener("click", banCurrentCombo);
    $("#outfitResult").addEventListener("click", handleResultAction);
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
    $("#historyList").addEventListener("click", handleHistoryAction);

    $("#exportBtn").addEventListener("click", exportBackup);
    $("#importBtn").addEventListener("click", () => $("#importFile").click());
    $("#importFile").addEventListener("change", importBackup);
    $("#resetDemoBtn").addEventListener("click", resetDemoData);
    $("#clearBansBtn").addEventListener("click", clearBannedCombos);
    $("#themeSelect").addEventListener("change", (event) => updateTheme(event.target.value));

    $("#itemForm").addEventListener("submit", saveItemFromForm);
    $("#itemForm").addEventListener("click", handleItemFormClick);
    $("#itemCategory").addEventListener("change", () => {
      renderGuidedMatchChips();
      renderBeltModeControl();
    });
    $("#copyMatchingBtn").addEventListener("click", copyMatchingFromSelectedItem);
    $("#saveGenerateBtn").addEventListener("click", () => saveItemFromEditor({ generateAfter: true }));
    $("#closeItemDialogBtn").addEventListener("click", closeItemDialog);
    $("#duplicateItemBtn").addEventListener("click", duplicateFromDialog);
    $("#archiveItemBtn").addEventListener("click", toggleArchiveFromDialog);
    $("#permanentDeleteBtn").addEventListener("click", permanentlyDeleteFromDialog);
    $("#itemFormality").addEventListener("input", (event) => {
      $("#formalityOutput").value = event.target.value;
    });
    $("#itemPrimaryColor").addEventListener("input", updateSelectedColorChip);
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

    $("#itemOccasions").innerHTML = OCCASION_ORDER.map((id) => {
      const occasion = OCCASIONS[id];
      return `
        <label class="check-pill">
          <input type="checkbox" name="itemOccasion" value="${occasion.id}">
          <span>${escapeHtml(occasion.label)}</span>
        </label>
      `;
    }).join("");

    $("#templateChips").innerHTML = Object.entries(ITEM_TEMPLATES).map(([id, template]) => {
      return `<button class="mini-button" type="button" data-template-id="${escapeAttribute(id)}">${escapeHtml(template.label)}</button>`;
    }).join("");

    $("#primaryColorChips").innerHTML = COLOR_OPTIONS.map((color) => {
      return `<button class="mini-button" type="button" data-color="${escapeAttribute(color)}">${escapeHtml(color)}</button>`;
    }).join("");

    $("#manualLogOccasion").innerHTML = OCCASION_ORDER.map((id) => {
      return `<option value="${id}">${escapeHtml(OCCASIONS[id].label)}</option>`;
    }).join("");

    $("#itemWeatherConditions").innerHTML = WEATHER_CONDITIONS.map((condition) => {
      return `
        <label class="check-pill compact-check">
          <input type="checkbox" name="itemWeatherCondition" value="${condition}">
          <span>${escapeHtml(capitalize(condition))}</span>
        </label>
      `;
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
    renderTagSuggestions();
    renderCloset();
    renderHistory();
    renderSettings();
    renderWeatherControls();
    renderResult();
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

    try {
      return normalizeState(JSON.parse(saved));
    } catch (error) {
      console.error(error);
      const fresh = createDefaultState();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
      return fresh;
    }
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
    } catch (error) {
      console.error(error);
      showToast("Could not save locally. Storage may be full.");
    }
  }

  function createDefaultState() {
    return normalizeState({
      version: 3,
      wardrobe: demoWardrobe(),
      history: [],
      bannedCombos: [],
      feedback: [],
      settings: {
        theme: "system",
        weather: {
          enabled: false,
          temperature: null,
          condition: "sunny"
        }
      }
    });
  }

  function normalizeState(raw) {
    const settings = normalizeSettings(raw?.settings);
    const normalized = {
      version: Math.max(3, Number(raw?.version) || 1),
      wardrobe: Array.isArray(raw?.wardrobe) ? raw.wardrobe.map(normalizeItem).filter(Boolean) : [],
      history: Array.isArray(raw?.history) ? raw.history.map(normalizeHistoryRecord).filter(Boolean) : [],
      bannedCombos: Array.isArray(raw?.bannedCombos) ? raw.bannedCombos.map(normalizeBannedCombo).filter(Boolean) : [],
      feedback: Array.isArray(raw?.feedback) ? raw.feedback.map(normalizeFeedbackRecord).filter(Boolean) : [],
      settings
    };

    if (!normalized.wardrobe.length) {
      normalized.wardrobe = demoWardrobe().map(normalizeItem);
    }

    return normalized;
  }

  function normalizeSettings(settings) {
    const theme = THEME_VALUES.includes(settings?.theme) ? settings.theme : "system";
    const weather = settings?.weather && typeof settings.weather === "object" ? settings.weather : {};
    return {
      theme,
      weather: {
        enabled: weather.enabled === true,
        temperature: nullableNumber(weather.temperature, -30, 130),
        condition: WEATHER_CONDITIONS.includes(weather.condition) ? weather.condition : "sunny"
      }
    };
  }

  function normalizeItem(item) {
    if (!item || typeof item !== "object") return null;
    const category = CATEGORIES[item.category] ? item.category : "top";
    const occasions = toArray(item.occasions).map(normalizeOccasionToken).filter(Boolean);

    return {
      id: stringOr(item.id, uid("item")),
      name: stringOr(item.name, "Unnamed Item"),
      category,
      colors: toArray(item.colors),
      tags: toArray(item.tags),
      occasions: unique(occasions.length ? occasions : ["casual"]),
      season: toArray(item.season),
      formality: clampNumber(item.formality, 1, 10, 5),
      worksWithTags: toArray(item.worksWithTags),
      avoidWithTags: toArray(item.avoidWithTags),
      avoidWithItems: toArray(item.avoidWithItems),
      beltMode: category === "pants" && BELT_MODES.includes(item.beltMode) ? item.beltMode : (category === "pants" ? "optional" : ""),
      minTemperature: nullableNumber(item.minTemperature, -30, 130),
      maxTemperature: nullableNumber(item.maxTemperature, -30, 130),
      suitableConditions: toArray(item.suitableConditions).map(normalizeTag).filter((condition) => WEATHER_CONDITIONS.includes(condition)),
      rainSafe: typeof item.rainSafe === "boolean" ? item.rainSafe : null,
      warmthLevel: nullableNumber(item.warmthLevel, 1, 5),
      imageUrl: stringOr(item.imageUrl || item.image || "", ""),
      lastWorn: validDateOnly(item.lastWorn) || null,
      active: item.active !== false && item.unavailable !== true,
      notes: stringOr(item.notes, ""),
      createdAt: stringOr(item.createdAt, new Date().toISOString()),
      updatedAt: stringOr(item.updatedAt, new Date().toISOString())
    };
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

  function renderBuildAroundOptions() {
    const select = $("#buildAroundSelect");
    const selected = select.value || "";
    const activeItems = appState.wardrobe.filter((item) => item.active).sort(sortItems);
    const groups = CATEGORY_ORDER.map((category) => {
      const items = activeItems.filter((item) => item.category === category);
      if (!items.length) return "";
      const options = items.map((item) => {
        return `<option value="${escapeAttribute(item.id)}">${escapeHtml(item.name)}</option>`;
      }).join("");
      return `<optgroup label="${escapeAttribute(CATEGORIES[category])}">${options}</optgroup>`;
    }).join("");

    select.innerHTML = `<option value="">Any item</option>${groups}`;
    select.value = appState.wardrobe.some((item) => item.id === selected && item.active) ? selected : "";
  }

  function renderTagSuggestions() {
    const commonTags = [
      "office",
      "casual",
      "date",
      "errands",
      "summer",
      "winter",
      "polo",
      "jeans",
      "dress pants",
      "dress shoes",
      "sneakers",
      "black",
      "navy",
      "gray",
      "khaki",
      "tan",
      "olive"
    ];
    const closetTags = appState.wardrobe.flatMap((item) => [
      ...item.colors,
      ...item.tags,
      ...item.season,
      ...item.worksWithTags,
      ...item.avoidWithTags
    ]);
    const suggestions = unique([...commonTags, ...closetTags].map(normalizeTag)).filter(Boolean).sort();
    const quickTags = ["office", "casual", "date", "jeans", "dress pants", "sneakers", "summer", "winter"];

    $("#tagSuggestions").innerHTML = suggestions.map((tag) => {
      return `<option value="${escapeAttribute(tag)}"></option>`;
    }).join("");

    $("#itemQuickTags").innerHTML = quickTags.map((tag) => {
      return `<button class="mini-button" type="button" data-quick-tag="${escapeAttribute(tag)}">${escapeHtml(tag)}</button>`;
    }).join("");
  }

  function renderResult() {
    const card = $("#outfitResult");
    const actions = $("#resultActions");

    if (resultState === "logged") {
      card.classList.remove("empty-state");
      card.innerHTML = `
        <div class="log-success" role="status">
          <span class="success-mark" aria-hidden="true">&#10003;</span>
          <div>
            <h2>Fit logged.</h2>
            <p>Make the day great.</p>
          </div>
          <button class="primary-button" type="button" data-result-action="generate-another">Generate Another</button>
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

    card.classList.remove("empty-state");
    card.innerHTML = `
      <div class="result-heading">
        <div>
          <p class="eyebrow">${escapeHtml(occasion.label)}</p>
          <h2>Today&apos;s fit</h2>
        </div>
        ${weatherResultLabel()}
      </div>
      <div class="chip-row">${buildChip}</div>
      <div class="result-list">
        ${currentOutfit.items.map((item) => renderResultItem(item, currentOutfit)).join("")}
      </div>
    `;
    actions.hidden = false;
  }

  function renderResultItem(item, outfit) {
    const changed = toArray(outfit.changedItemIds).includes(item.id);
    const locked = outfit.buildAroundId === item.id;
    const color = item.colors[0] ? `<span>${escapeHtml(item.colors[0])}</span>` : "";

    return `
      <div class="result-item ${changed ? "is-changed" : ""}" data-result-item-id="${escapeAttribute(item.id)}">
        <div class="result-item-copy">
          <p class="item-kicker">${escapeHtml(CATEGORIES[item.category] || item.category)}</p>
          <h3>${escapeHtml(item.name)}</h3>
          ${color}
        </div>
        <button class="swap-button" type="button" data-result-action="swap" data-item-id="${escapeAttribute(item.id)}" ${locked ? "disabled" : ""}>
          ${locked ? "Locked" : "Swap"}
        </button>
      </div>
    `;
  }

  function handleResultAction(event) {
    const button = event.target.closest("[data-result-action]");
    if (!button) return;
    if (button.dataset.resultAction === "generate-another") {
      resultState = "empty";
      generateAndRender();
    } else if (button.dataset.resultAction === "swap") {
      openSwapDialog(button.dataset.itemId);
    }
  }

  function renderCloset() {
    const list = $("#closetList");
    const query = normalizeTag(closetFilters.search);
    const items = appState.wardrobe
      .filter((item) => closetFilters.showInactive || item.active)
      .filter((item) => closetFilters.category === "all" || item.category === closetFilters.category)
      .filter((item) => !query || itemSignals(item).some((signal) => signal.includes(query)))
      .sort(sortItems);

    if (!items.length) {
      list.innerHTML = `<article class="closet-card"><p class="small-meta">No matching items.</p></article>`;
      return;
    }

    list.innerHTML = items.map(renderClosetCard).join("");
  }

  function renderClosetCard(item) {
    const occasionLabels = item.occasions.map((id) => OCCASIONS[id]?.label || id);
    const chips = [
      renderChip(CATEGORIES[item.category]),
      ...item.colors.slice(0, 3).map(renderChip),
      ...item.tags.slice(0, 4).map(renderChip),
      ...occasionLabels.slice(0, 2).map((label) => renderChip(label, "accent"))
    ].join("");

    const status = item.active ? "" : `<span class="chip">Archived</span>`;
    const lastWorn = item.lastWorn ? `Last worn ${formatShortDate(item.lastWorn)}` : "Not logged yet";
    const archiveLabel = item.active ? "Archive" : "Restore";

    return `
      <article class="closet-card ${item.active ? "" : "is-inactive"}" data-item-id="${escapeAttribute(item.id)}">
        <div class="card-topline">
          <div class="card-title-wrap">
            <h3>${escapeHtml(item.name)}</h3>
            <p class="small-meta">${escapeHtml(lastWorn)} - Formality ${item.formality}</p>
          </div>
          ${status}
        </div>
        <div class="chip-row">${chips}</div>
        <div class="card-actions">
          <button class="secondary-button edit-action" type="button" data-action="edit">Edit</button>
          <button class="secondary-button" type="button" data-action="duplicate">Duplicate</button>
          <button class="secondary-button" type="button" data-action="archive">${archiveLabel}</button>
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
    const activeCount = appState.wardrobe.filter((item) => item.active).length;
    const archivedCount = appState.wardrobe.length - activeCount;
    $("#themeSelect").value = appState.settings.theme;
    $("#appVersion").textContent = `App version ${APP_VERSION}`;
    $("#settingsStats").innerHTML = `
      <div class="stat-card"><strong>${activeCount}</strong><span>Active items</span></div>
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
    } else if (button.dataset.action === "duplicate") {
      openItemDialog(itemId, { duplicate: true });
    } else if (button.dataset.action === "archive") {
      toggleArchive(itemId);
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
    const item = options.duplicate && source
      ? { ...source, id: "", name: `${source.name} Copy`, active: true }
      : source || emptyItem();

    editingItemId = source && !options.duplicate ? item.id : null;

    $("#itemDialogMode").textContent = editingItemId ? "Edit item" : "Closet item";
    $("#itemDialogTitle").textContent = editingItemId ? "Edit Item" : "Add Item";
    $("#itemId").value = editingItemId || "";
    $("#itemName").value = item.name || "";
    $("#itemCategory").value = item.category || "top";
    $("#itemPrimaryColor").value = item.colors[0] || "";
    $("#itemSecondaryColors").value = item.colors.slice(1).join(", ");
    $("#itemTags").value = item.tags.join(", ");
    $("#itemFormality").value = item.formality || 5;
    $("#formalityOutput").value = item.formality || 5;
    $("#itemSeason").value = item.season.join(", ");
    $("#itemWorksWithTags").value = item.worksWithTags.join(", ");
    $("#itemAvoidWithTags").value = item.avoidWithTags.join(", ");
    $("#itemAvoidWithItems").value = formatAvoidItems(item.avoidWithItems).join(", ");
    $$("input[name='itemBeltMode']").forEach((input) => {
      input.checked = input.value === item.beltMode;
    });
    $("#itemMinTemperature").value = item.minTemperature ?? "";
    $("#itemMaxTemperature").value = item.maxTemperature ?? "";
    $("#itemRainSafe").value = item.rainSafe === true ? "yes" : item.rainSafe === false ? "no" : "";
    $("#itemWarmthLevel").value = item.warmthLevel ?? "";
    $$("input[name='itemWeatherCondition']").forEach((input) => {
      input.checked = item.suitableConditions.includes(input.value);
    });
    $("#itemImageUrl").value = item.imageUrl || "";
    $("#itemNotes").value = item.notes || "";
    $("#itemActive").checked = item.active !== false;
    $("#formError").hidden = true;
    $("#formError").textContent = "";

    $$("input[name='itemOccasion']").forEach((input) => {
      input.checked = item.occasions.includes(input.value);
    });

    $("#duplicateItemBtn").hidden = !editingItemId;
    $("#archiveItemBtn").hidden = !editingItemId;
    $("#archiveItemBtn").textContent = item.active ? "Archive" : "Restore";
    $("#advancedDeleteDetails").hidden = !editingItemId;
    $("#matchingDetails").open = Boolean(editingItemId);
    $("#advancedTagsDetails").open = false;
    renderCopyMatchingOptions(editingItemId);
    renderAvoidItemsOptions(item.avoidWithItems, editingItemId);
    renderGuidedMatchChips();
    renderBeltModeControl();
    updateSelectedColorChip();

    const dialog = $("#itemDialog");
    if (typeof dialog.showModal === "function") {
      dialog.showModal();
    } else {
      dialog.setAttribute("open", "");
    }
    $("#itemName").focus();
  }

  function closeItemDialog() {
    $("#itemDialog").close();
    editingItemId = null;
  }

  function saveItemFromForm(event) {
    event.preventDefault();
    saveItemFromEditor({ generateAfter: false });
  }

  function saveItemFromEditor({ generateAfter }) {
    const item = collectItemFromForm();
    const error = validateItem(item);
    if (error) {
      $("#formError").textContent = error;
      $("#formError").hidden = false;
      return;
    }

    let savedItemId = editingItemId;
    if (editingItemId) {
      const index = appState.wardrobe.findIndex((existing) => existing.id === editingItemId);
      if (index !== -1) {
        appState.wardrobe[index] = {
          ...appState.wardrobe[index],
          ...item,
          id: editingItemId,
          updatedAt: new Date().toISOString()
        };
      }
      showToast("Item saved.");
    } else {
      const savedItem = {
        ...item,
        id: uid("item"),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      appState.wardrobe.push(savedItem);
      savedItemId = savedItem.id;
      showToast("Item added.");
    }

    saveState();
    closeItemDialog();
    renderAll();
    if (generateAfter && savedItemId) {
      generateWithItem(savedItemId);
    }
  }

  function collectItemFromForm() {
    const primaryColor = $("#itemPrimaryColor").value.trim();
    const secondaryColors = parseCsv($("#itemSecondaryColors").value);
    const rawAvoidItems = parseCsv($("#itemAvoidWithItems").value);
    const selectedAvoidItems = selectedOptions($("#avoidItemsSelect"));
    return normalizeItem({
      id: $("#itemId").value,
      name: $("#itemName").value.trim(),
      category: $("#itemCategory").value,
      colors: unique([primaryColor, ...secondaryColors].filter(Boolean)),
      tags: parseCsv($("#itemTags").value),
      occasions: $$("input[name='itemOccasion']:checked").map((input) => input.value),
      formality: Number($("#itemFormality").value),
      season: parseCsv($("#itemSeason").value),
      worksWithTags: parseCsv($("#itemWorksWithTags").value),
      avoidWithTags: parseCsv($("#itemAvoidWithTags").value),
      avoidWithItems: unique([...resolveAvoidItemTokens(rawAvoidItems, editingItemId), ...selectedAvoidItems]),
      beltMode: $("input[name='itemBeltMode']:checked")?.value || "optional",
      minTemperature: nullableNumber($("#itemMinTemperature").value, -30, 130),
      maxTemperature: nullableNumber($("#itemMaxTemperature").value, -30, 130),
      suitableConditions: $$("input[name='itemWeatherCondition']:checked").map((input) => input.value),
      rainSafe: $("#itemRainSafe").value === "yes" ? true : $("#itemRainSafe").value === "no" ? false : null,
      warmthLevel: nullableNumber($("#itemWarmthLevel").value, 1, 5),
      imageUrl: $("#itemImageUrl").value.trim(),
      active: $("#itemActive").checked,
      notes: $("#itemNotes").value.trim()
    });
  }

  function validateItem(item) {
    if (!item.name) return "Name is required.";
    if (!item.category) return "Category is required.";
    if (!item.colors.length) return "Primary color is required.";
    if (!item.occasions.length) return "Choose at least one occasion.";
    if (item.minTemperature !== null && item.maxTemperature !== null && item.minTemperature > item.maxTemperature) {
      return "Minimum temperature must be lower than maximum temperature.";
    }
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
      $("#itemPrimaryColor").value = colorButton.dataset.color;
      updateSelectedColorChip();
      return;
    }

    const matchButton = event.target.closest("[data-match-kind]");
    if (matchButton) {
      const target = matchButton.dataset.matchKind === "avoid" ? $("#itemAvoidWithTags") : $("#itemWorksWithTags");
      appendCsvValues(target, parseCsv(matchButton.dataset.matchTags));
      renderGuidedMatchChips();
      return;
    }

    const presetButton = event.target.closest("[data-occasion-preset]");
    if (presetButton) {
      applyOccasionPreset(presetButton.dataset.occasionPreset);
      return;
    }

    const tagButton = event.target.closest("[data-quick-tag]");
    if (tagButton) {
      appendCsvValue($("#itemTags"), tagButton.dataset.quickTag);
    }
  }

  function applyTemplate(templateId) {
    const template = ITEM_TEMPLATES[templateId];
    if (!template) return;
    $("#itemCategory").value = template.category;
    $("#itemFormality").value = template.formality;
    $("#formalityOutput").value = template.formality;
    mergeCsvValues($("#itemTags"), template.tags || []);
    mergeCsvValues($("#itemWorksWithTags"), template.worksWithTags || []);
    mergeCsvValues($("#itemAvoidWithTags"), template.avoidWithTags || []);
    if (template.category === "pants") {
      const beltInput = $(`input[name='itemBeltMode'][value='${template.beltMode || "optional"}']`);
      if (beltInput) beltInput.checked = true;
    }
    applyOccasions(template.occasions || []);
    renderGuidedMatchChips();
    renderBeltModeControl();
    showToast(`${template.label} template applied.`);
  }

  function copyMatchingFromSelectedItem() {
    const source = findItem($("#copyMatchingSelect").value);
    if (!source) {
      showToast("Choose an item to copy from.");
      return;
    }
    applyOccasions(source.occasions);
    $("#itemFormality").value = source.formality;
    $("#formalityOutput").value = source.formality;
    $("#itemWorksWithTags").value = source.worksWithTags.join(", ");
    $("#itemAvoidWithTags").value = source.avoidWithTags.join(", ");
    $("#itemAvoidWithItems").value = formatAvoidItems(source.avoidWithItems).join(", ");
    if (source.category === "pants" && $("#itemCategory").value === "pants") {
      const beltInput = $(`input[name='itemBeltMode'][value='${source.beltMode}']`);
      if (beltInput) beltInput.checked = true;
    }
    $("#itemMinTemperature").value = source.minTemperature ?? "";
    $("#itemMaxTemperature").value = source.maxTemperature ?? "";
    $("#itemRainSafe").value = source.rainSafe === true ? "yes" : source.rainSafe === false ? "no" : "";
    $("#itemWarmthLevel").value = source.warmthLevel ?? "";
    $$("input[name='itemWeatherCondition']").forEach((input) => {
      input.checked = source.suitableConditions.includes(input.value);
    });
    renderAvoidItemsOptions(source.avoidWithItems, editingItemId);
    renderGuidedMatchChips();
    showToast(`Copied matching from ${source.name}.`);
  }

  function renderBeltModeControl() {
    const isBottom = $("#itemCategory").value === "pants";
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

  function appendCsvValue(input, value) {
    const values = parseCsv(input.value);
    if (!values.map(normalizeTag).includes(normalizeTag(value))) {
      values.push(value);
    }
    input.value = values.join(", ");
    input.focus();
  }

  function appendCsvValues(input, values) {
    values.forEach((value) => appendCsvValue(input, value));
  }

  function mergeCsvValues(input, values) {
    const existing = parseCsv(input.value);
    values.forEach((value) => {
      if (!existing.map(normalizeTag).includes(normalizeTag(value))) {
        existing.push(value);
      }
    });
    input.value = existing.join(", ");
  }

  function applyOccasions(occasions) {
    const selected = new Set(occasions);
    $$("input[name='itemOccasion']").forEach((input) => {
      input.checked = selected.has(input.value);
    });
  }

  function renderCopyMatchingOptions(currentId) {
    const options = appState.wardrobe
      .filter((item) => item.id !== currentId)
      .sort(sortItems)
      .map((item) => `<option value="${escapeAttribute(item.id)}">${escapeHtml(item.name)}</option>`)
      .join("");
    $("#copyMatchingSelect").innerHTML = `<option value="">Choose similar item</option>${options}`;
  }

  function renderAvoidItemsOptions(selectedValues = [], currentId = null) {
    const selected = new Set(selectedValues.map(normalizeTag));
    $("#avoidItemsSelect").innerHTML = appState.wardrobe
      .filter((item) => item.id !== currentId)
      .sort(sortItems)
      .map((item) => {
        const isSelected = selected.has(normalizeTag(item.id)) || selected.has(normalizeTag(item.name));
        return `<option value="${escapeAttribute(item.id)}" ${isSelected ? "selected" : ""}>${escapeHtml(item.name)}</option>`;
      })
      .join("");
  }

  function renderGuidedMatchChips() {
    const category = $("#itemCategory").value || "top";
    const groups = MATCH_CHIPS[category] || MATCH_CHIPS.accessory;
    const worksTags = new Set(parseCsv($("#itemWorksWithTags").value).map(normalizeTag));
    const avoidTags = new Set(parseCsv($("#itemAvoidWithTags").value).map(normalizeTag));

    $("#worksMatchChips").innerHTML = renderMatchButtons(groups.works, "works", worksTags);
    $("#avoidMatchChips").innerHTML = renderMatchButtons(groups.avoid, "avoid", avoidTags) || `<span class="small-meta">No common avoid chips for this category.</span>`;
  }

  function renderMatchButtons(chips, kind, selectedTags) {
    return chips.map(([label, tags]) => {
      const isSelected = tags.some((tag) => selectedTags.has(normalizeTag(tag)));
      return `<button class="mini-button ${isSelected ? "is-selected" : ""}" type="button" data-match-kind="${kind}" data-match-tags="${escapeAttribute(tags.join(", "))}">${escapeHtml(label)}</button>`;
    }).join("");
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
    renderBuildAroundOptions();
    $("#buildAroundSelect").value = item.id;
    generateAndRender();
  }

  function openSwapDialog(itemId) {
    if (!currentOutfit || currentOutfit.error || currentOutfit.buildAroundId === itemId) return;
    const currentItem = currentOutfit.items.find((item) => item.id === itemId);
    if (!currentItem) return;

    const choices = validSwapChoices(currentItem);
    if (!choices.length) {
      showToast("No compatible swaps are available.");
      return;
    }
    if (choices.length === 1) {
      applySwapChoice(currentItem.id, choices[0]);
      return;
    }

    swapTargetItemId = currentItem.id;
    $("#swapDialogTitle").textContent = `Swap ${CATEGORIES[currentItem.category] || "Item"}`;
    $("#swapChoices").innerHTML = choices.slice(0, 8).map((choice) => {
      const replacement = choice.items.find((item) => item.id === choice.replacementId);
      return `
        <button class="swap-choice" type="button" data-replacement-id="${escapeAttribute(choice.replacementId)}">
          <span>
            <strong>${escapeHtml(replacement.name)}</strong>
            <small>${escapeHtml(replacement.colors[0] || CATEGORIES[replacement.category])}</small>
          </span>
          <span aria-hidden="true">&rsaquo;</span>
        </button>
      `;
    }).join("");
    openDialog($("#swapDialog"));
  }

  function validSwapChoices(currentItem) {
    const occasionId = currentOutfit.occasion;
    return appState.wardrobe
      .filter((item) => item.active && item.category === currentItem.category && item.id !== currentItem.id)
      .filter((item) => matchesOccasion(item, occasionId))
      .map((replacement) => {
        const replaced = currentOutfit.items.map((item) => item.id === currentItem.id ? replacement : item);
        const reconciled = reconcileBeltForOutfit(replaced, occasionId, currentOutfit.buildAroundId);
        if (!reconciled || !isCompatibleOutfit(reconciled, occasionId)) return null;
        return {
          replacementId: replacement.id,
          items: sortOutfitItems(reconciled),
          score: scoreOutfit(reconciled, occasionId)
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score);
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
      changedItemIds: changedItemIds(previousItems, choice.items)
    };
    resultState = "outfit";
    swapTargetItemId = null;
    closeDialog($("#swapDialog"));
    renderResult();
    scrollResultIntoView();
    flashChangedRows();
    const changedItem = currentOutfit.items.find((item) => item.id === choice.replacementId);
    showToast(changedItem ? `Swapped to ${changedItem.name}.` : "Item swapped.");
  }

  function duplicateFromDialog() {
    if (!editingItemId) return;
    closeItemDialog();
    openItemDialog(editingItemId, { duplicate: true });
  }

  function toggleArchiveFromDialog() {
    if (!editingItemId) return;
    toggleArchive(editingItemId);
    closeItemDialog();
  }

  function toggleArchive(itemId) {
    const item = findItem(itemId);
    if (!item) return;
    item.active = !item.active;
    item.updatedAt = new Date().toISOString();
    saveState();
    renderAll();
    showToast(item.active ? "Item restored." : "Item archived.");
  }

  function permanentlyDeleteFromDialog() {
    if (!editingItemId) return;
    const item = findItem(editingItemId);
    if (!item) return;
    const confirmed = window.confirm(`Permanently delete "${item.name}"? Outfit history keeps saved snapshots.`);
    if (!confirmed) return;

    appState.wardrobe = appState.wardrobe.filter((existing) => existing.id !== editingItemId);
    appState.wardrobe.forEach((existing) => {
      existing.avoidWithItems = existing.avoidWithItems.filter((ref) => normalizeTag(ref) !== normalizeTag(editingItemId));
    });
    saveState();
    closeItemDialog();
    renderAll();
    showToast("Item permanently deleted.");
  }

  function generateAndRender(options = {}) {
    const occasionId = $("#occasionSelect").value;
    const buildAroundId = $("#buildAroundSelect").value;
    const previousItems = currentOutfit?.items || [];
    currentOutfit = pickOutfit(occasionId, buildAroundId);
    resultState = currentOutfit?.error ? "error" : "outfit";
    logInProgress = false;
    if (!currentOutfit.error) {
      currentOutfit.changedItemIds = options.comparePrevious
        ? changedItemIds(previousItems, currentOutfit.items)
        : currentOutfit.items.map((item) => item.id);
    }
    renderResult();
    scrollResultIntoView();
    flashChangedRows();
  }

  function pickOutfit(occasionId, buildAroundId) {
    const occasion = OCCASIONS[occasionId];
    if (!occasion) {
      return { error: "Choose an occasion." };
    }

    const buildAround = buildAroundId ? findItem(buildAroundId) : null;
    if (buildAroundId && (!buildAround || !buildAround.active)) {
      return { error: "That build-around item is not active." };
    }

    if (buildAround && !matchesOccasion(buildAround, occasionId)) {
      return { error: "That item is not tagged for this occasion." };
    }

    const candidates = new Map();
    for (let i = 0; i < 900; i += 1) {
      const outfit = randomOutfit(occasion, buildAround);
      addScoredCandidate(candidates, outfit, occasionId, buildAround?.id || "");
    }

    if (candidates.size < 8) {
      enumerateOutfits(occasion, buildAround, 2400).forEach((outfit) => {
        addScoredCandidate(candidates, outfit, occasionId, buildAround?.id || "");
      });
    }

    const ranked = [...candidates.values()].sort((a, b) => b.score - a.score);
    if (!ranked.length) {
      return { error: "No compatible fit found. Loosen an avoid tag or add another active item." };
    }

    const topPool = ranked.slice(0, Math.min(5, ranked.length));
    const index = Math.floor(Math.pow(Math.random(), 1.7) * topPool.length);
    return topPool[index];
  }

  function addScoredCandidate(map, outfit, occasionId, buildAroundId) {
    if (!outfit || !outfit.length) return;
    if (buildAroundId && !outfit.some((item) => item.id === buildAroundId)) return;
    if (!isCompatibleOutfit(outfit, occasionId)) return;
    const key = comboKey(outfit.map((item) => item.id));
    if (map.has(key)) return;
    map.set(key, {
      occasion: occasionId,
      buildAroundId,
      items: sortOutfitItems(outfit),
      score: scoreOutfit(outfit, occasionId)
    });
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
      return item.active && slot.categories.includes(item.category) && matchesOccasion(item, occasionId);
    });
  }

  function slotAcceptsItem(slot, item) {
    return slot.categories.includes(item.category);
  }

  function isCompatibleOutfit(items, occasionId) {
    if (!items.length || isComboBanned(items)) return false;

    const occasion = OCCASIONS[occasionId];
    if (!occasion) return false;
    const bottoms = items.find((item) => item.category === "pants");
    const belts = items.filter((item) => item.category === "belt");
    if (bottoms?.beltMode === "none" && belts.length) return false;
    if (bottoms?.beltMode === "required" && occasionSupportsBelts(occasionId) && !belts.length) return false;

    const formalities = items.map((item) => item.formality);
    if (Math.max(...formalities) - Math.min(...formalities) > occasion.formalityGap) {
      return false;
    }

    for (const item of items) {
      if (!matchesOccasion(item, occasionId)) return false;
      if (isWeatherClearlyUnsuitable(item)) return false;

      const otherItems = items.filter((other) => other.id !== item.id);
      const otherSignals = new Set(otherItems.flatMap(itemSignals));

      if (item.avoidWithTags.some((tag) => otherSignals.has(normalizeTag(tag)))) {
        return false;
      }

      if (otherItems.some((other) => itemAvoidsItem(item, other))) {
        return false;
      }

    }

    return true;
  }

  function scoreOutfit(items, occasionId) {
    const occasion = OCCASIONS[occasionId];
    let score = 100;

    // Hard compatibility checks happen before scoring. This score stays soft:
    // recent wear lowers the rank instead of banning an item, so small closets
    // still produce outfits when there are no fresh alternatives.
    const formalities = items.map((item) => item.formality);
    const averageFormality = average(formalities);
    const formalitySpread = Math.max(...formalities) - Math.min(...formalities);
    score -= Math.abs(averageFormality - occasion.targetFormality) * 5;
    score -= formalitySpread * 2.5;

    // Positive worksWithTags matches lift combos that the user has explicitly
    // marked as good pairings. Shared color/tag vocabulary gets a smaller bump.
    for (const item of items) {
      const otherSignals = new Set(items.filter((other) => other.id !== item.id).flatMap(itemSignals));
      const matches = item.worksWithTags.filter((tag) => otherSignals.has(normalizeTag(tag))).length;
      score += matches * 8;
    }

    const sharedTagCount = countSharedSignals(items);
    score += Math.min(sharedTagCount, 8) * 1.5;
    score += items.reduce((sum, item) => sum + weatherScore(item), 0);

    const exactLastWorn = lastExactOutfitDate(items);
    const exactDays = daysSince(exactLastWorn);
    if (exactDays !== null && exactDays <= 14) {
      score -= 120 - exactDays * 5;
    }

    for (const item of items) {
      const itemDays = daysSince(lastItemWornDate(item));
      if (itemDays === null) continue;

      if (item.category === "top" && itemDays <= 4) {
        score -= 70 - itemDays * 12;
      } else if (item.category === "pants" && itemDays <= 2) {
        score -= 48 - itemDays * 12;
      } else if (item.category === "shoes" && itemDays <= 1) {
        score -= 36 - itemDays * 10;
      } else if (itemDays <= 7) {
        score -= 10 - itemDays;
      }
    }

    score += Math.random() * 16;
    return score;
  }

  function reconcileBeltForOutfit(items, occasionId, buildAroundId = "", options = {}) {
    let reconciled = uniqueItems(items);
    const bottoms = reconciled.find((item) => item.category === "pants");
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

  function isWeatherClearlyUnsuitable(item) {
    const weather = appState.settings.weather;
    if (!weather.enabled) return false;
    const temperature = weather.temperature;

    if (temperature !== null) {
      if (item.minTemperature !== null && temperature < item.minTemperature - 15) return true;
      if (item.maxTemperature !== null && temperature > item.maxTemperature + 10) return true;
      if (item.warmthLevel >= 4 && temperature >= 82) return true;
      if (item.warmthLevel === 1 && temperature <= 15) return true;
    }

    return ["rain", "snow"].includes(weather.condition)
      && item.category === "shoes"
      && item.rainSafe === false;
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
      if (item.warmthLevel !== null) {
        const targetWarmth = temperature <= 35 ? 5 : temperature <= 50 ? 4 : temperature <= 65 ? 3 : temperature <= 78 ? 2 : 1;
        score -= Math.abs(item.warmthLevel - targetWarmth) * 3;
      }
    }

    if (item.suitableConditions.length) {
      score += item.suitableConditions.includes(weather.condition) ? 5 : -8;
    }
    if (weather.condition === "rain" && item.rainSafe === true) score += 6;
    return score;
  }

  function countSharedSignals(items) {
    const counts = new Map();
    items.forEach((item) => {
      unique([...item.colors, ...item.tags].map(normalizeTag)).forEach((signal) => {
        counts.set(signal, (counts.get(signal) || 0) + 1);
      });
    });
    return [...counts.values()].filter((count) => count > 1).length;
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
    currentOutfit = null;
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
        occasion: currentOutfit.occasion,
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

    const wornDate = dateOnly(date);
    validItems.forEach((outfitItem) => {
      const closetItem = findItem(outfitItem.id);
      if (closetItem) {
        closetItem.lastWorn = wornDate;
        closetItem.updatedAt = new Date().toISOString();
      }
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
      .filter((item) => includeUnavailable || item.active)
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
                <span>${escapeHtml(item.name)}${item.active ? "" : " (unavailable)"}</span>
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
        pair[0].avoidWithItems = unique([...pair[0].avoidWithItems, pair[1].id]);
        pair[1].avoidWithItems = unique([...pair[1].avoidWithItems, pair[0].id]);
        pair.forEach((item) => {
          item.updatedAt = new Date().toISOString();
        });
      }
    }

    saveState();
    finishBanFeedback();
  }

  function feedbackPairForReason(reason, itemIds) {
    const items = itemIds.map(findItem).filter(Boolean);
    const top = items.find((item) => item.category === "top");
    const pants = items.find((item) => item.category === "pants");
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
    generateAndRender({ comparePrevious: true });
  }

  function deleteHistoryRecord(logId) {
    const record = appState.history.find((entry) => entry.id === logId);
    if (!record) return;
    const confirmed = window.confirm("Delete this outfit log?");
    if (!confirmed) return;

    appState.history = appState.history.filter((entry) => entry.id !== logId);
    record.itemIds.forEach((itemId) => {
      const item = findItem(itemId);
      if (!item) return;
      item.lastWorn = latestHistoryDateForItem(itemId);
      item.updatedAt = new Date().toISOString();
    });

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

  function importBackup(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const incoming = normalizeState(JSON.parse(String(reader.result)));
        const confirmed = window.confirm("Import this backup and replace current local data?");
        if (!confirmed) return;
        appState = incoming;
        currentOutfit = null;
        resultState = "empty";
        saveState();
        renderAll();
        showToast("Backup imported.");
      } catch (error) {
        console.error(error);
        showToast("Import failed. Check the JSON file.");
      } finally {
        event.target.value = "";
      }
    };
    reader.readAsText(file);
  }

  function resetDemoData() {
    const confirmed = window.confirm("Reset wardrobe, history, and banned combos to demo data?");
    if (!confirmed) return;
    appState = createDefaultState();
    currentOutfit = null;
    resultState = "empty";
    saveState();
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

  function lastItemWornDate(item) {
    const latestFromHistory = latestHistoryDateForItem(item.id);
    if (!latestFromHistory) return item.lastWorn || null;
    if (!item.lastWorn) return latestFromHistory;
    return new Date(latestFromHistory) > new Date(item.lastWorn) ? latestFromHistory : item.lastWorn;
  }

  function latestHistoryDateForItem(itemId) {
    const record = appState.history
      .filter((entry) => entry.itemIds.includes(itemId))
      .sort((a, b) => new Date(b.date) - new Date(a.date))[0];
    return record ? dateOnly(record.date) : null;
  }

  function itemAvoidsItem(item, other) {
    const refs = item.avoidWithItems.map(normalizeTag);
    return refs.includes(normalizeTag(other.id)) || refs.includes(normalizeTag(other.name));
  }

  function itemSignals(item) {
    return unique([
      item.id,
      item.name,
      item.category,
      CATEGORIES[item.category] || item.category,
      ...item.colors,
      ...item.tags,
      ...item.occasions,
      ...item.season
    ].map(normalizeTag).filter(Boolean));
  }

  function snapshotItem(item) {
    return {
      id: item.id,
      name: item.name,
      category: item.category,
      colors: [...item.colors],
      tags: [...item.tags],
      beltMode: item.beltMode || "",
      minTemperature: item.minTemperature,
      maxTemperature: item.maxTemperature,
      suitableConditions: [...item.suitableConditions],
      rainSafe: item.rainSafe,
      warmthLevel: item.warmthLevel
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
    if (a.active !== b.active) return a.active ? -1 : 1;
    const categoryDiff = CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category);
    if (categoryDiff) return categoryDiff;
    return a.name.localeCompare(b.name);
  }

  function emptyItem() {
    return normalizeItem({
      name: "",
      category: "top",
      colors: [],
      tags: [],
      occasions: ["casual"],
      season: [],
      formality: 5,
      worksWithTags: [],
      avoidWithTags: [],
      avoidWithItems: [],
      beltMode: "optional",
      minTemperature: null,
      maxTemperature: null,
      suitableConditions: [],
      rainSafe: null,
      warmthLevel: null,
      imageUrl: "",
      active: true,
      notes: ""
    });
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
    setTimeout(() => {
      $$(".result-item.is-changed").forEach((row) => row.classList.remove("is-changed"));
    }, 1600);
  }

  function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return;
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch((error) => {
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
      item("Light Blue Ralph Lauren Polo", "top", {
        colors: ["light blue"],
        tags: ["polo", "ralph lauren", "smart casual", "summer"],
        occasions: ["work", "friday", "casual", "date"],
        season: ["spring", "summer"],
        formality: 6,
        worksWithTags: ["navy", "gray", "khaki", "tan", "dark jeans"]
      }),
      item("Black Ralph Lauren Polo", "top", {
        colors: ["black"],
        tags: ["polo", "ralph lauren", "smart casual"],
        occasions: ["work", "friday", "casual", "date", "gym"],
        season: ["all season"],
        formality: 6,
        worksWithTags: ["gray", "khaki", "black", "jeans", "olive"]
      }),
      item("Navy Ralph Lauren Polo", "top", {
        colors: ["navy"],
        tags: ["polo", "ralph lauren", "smart casual"],
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
      item("Brown Levi's", "pants", {
        colors: ["brown"],
        tags: ["levis", "jeans", "brown jeans", "casual"],
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
      item("Black/White Converse Mids", "shoes", {
        colors: ["black", "white"],
        tags: ["sneakers", "converse", "casual", "canvas"],
        occasions: ["friday", "casual", "gym"],
        season: ["spring", "summer", "fall"],
        formality: 3,
        worksWithTags: ["jeans", "cargo", "black", "gray"]
      }),
      item("Off-white New Balance Sneakers", "shoes", {
        colors: ["off-white", "cream"],
        tags: ["sneakers", "new balance", "casual", "errands"],
        occasions: ["friday", "casual", "gym"],
        season: ["spring", "summer"],
        formality: 4,
        worksWithTags: ["jeans", "cargo", "khaki", "olive", "light blue"]
      }),
      item("Black Brooks Sneakers", "shoes", {
        colors: ["black"],
        tags: ["sneakers", "brooks", "running", "athletic", "errands"],
        occasions: ["casual", "gym"],
        season: ["all season"],
        formality: 2,
        worksWithTags: ["cargo", "jeans", "black", "gray"]
      }),
      item("White/Blue Jordan Mids", "shoes", {
        colors: ["white", "blue"],
        tags: ["sneakers", "jordan", "casual"],
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
})();
