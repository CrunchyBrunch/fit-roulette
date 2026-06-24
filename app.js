(() => {
  "use strict";

  const STORAGE_KEY = "fitRoulette.v1";

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

  let appState = loadState();
  let currentOutfit = null;
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
    $("#rerollBtn").addEventListener("click", generateAndRender);
    $("#logBtn").addEventListener("click", logCurrentOutfit);
    $("#banBtn").addEventListener("click", banCurrentCombo);

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

    $("#itemForm").addEventListener("submit", saveItemFromForm);
    $("#itemForm").addEventListener("click", handleItemFormClick);
    $("#closeItemDialogBtn").addEventListener("click", closeItemDialog);
    $("#duplicateItemBtn").addEventListener("click", duplicateFromDialog);
    $("#archiveItemBtn").addEventListener("click", toggleArchiveFromDialog);
    $("#permanentDeleteBtn").addEventListener("click", permanentlyDeleteFromDialog);
    $("#itemFormality").addEventListener("input", (event) => {
      $("#formalityOutput").value = event.target.value;
    });
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
  }

  function renderAll() {
    renderBuildAroundOptions();
    renderTagSuggestions();
    renderCloset();
    renderHistory();
    renderSettings();
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
      version: 1,
      wardrobe: demoWardrobe(),
      history: [],
      bannedCombos: []
    });
  }

  function normalizeState(raw) {
    const normalized = {
      version: 1,
      wardrobe: Array.isArray(raw?.wardrobe) ? raw.wardrobe.map(normalizeItem).filter(Boolean) : [],
      history: Array.isArray(raw?.history) ? raw.history.map(normalizeHistoryRecord).filter(Boolean) : [],
      bannedCombos: Array.isArray(raw?.bannedCombos) ? raw.bannedCombos.map(normalizeBannedCombo).filter(Boolean) : []
    };

    if (!normalized.wardrobe.length) {
      normalized.wardrobe = demoWardrobe().map(normalizeItem);
    }

    return normalized;
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
      itemSnapshots: Array.isArray(record.itemSnapshots) ? record.itemSnapshots : []
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
    const buildChip = buildAround ? `<span class="chip accent">Built around ${escapeHtml(buildAround.name)}</span>` : "";

    card.classList.remove("empty-state");
    card.innerHTML = `
      <div class="result-heading">
        <div>
          <p class="eyebrow">${escapeHtml(occasion.label)}</p>
          <h2>Today&apos;s fit</h2>
        </div>
      </div>
      <div class="chip-row">${buildChip}</div>
      <div class="result-list">
        ${currentOutfit.items.map(renderResultItem).join("")}
      </div>
    `;
    actions.hidden = false;
  }

  function renderResultItem(item) {
    const chips = [...item.colors, ...item.tags].slice(0, 5).map(renderChip).join("");
    const image = item.imageUrl
      ? `<img src="${escapeAttribute(item.imageUrl)}" alt="">`
      : escapeHtml(itemInitials(item));

    return `
      <div class="result-item">
        <div class="item-thumb">${image}</div>
        <div>
          <p class="item-kicker">${escapeHtml(CATEGORIES[item.category] || item.category)}</p>
          <h3>${escapeHtml(item.name)}</h3>
          <div class="chip-row">${chips}</div>
        </div>
      </div>
    `;
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
              <p class="small-meta">${escapeHtml(OCCASIONS[record.occasion]?.label || record.occasion)}</p>
            </div>
            <button class="secondary-button" type="button" data-action="delete-log">Delete</button>
          </div>
          <div class="chip-row">
            ${items.map((item) => renderChip(item.name)).join("")}
          </div>
        </article>
      `;
    }).join("");
  }

  function renderSettings() {
    const activeCount = appState.wardrobe.filter((item) => item.active).length;
    const archivedCount = appState.wardrobe.length - activeCount;
    $("#settingsStats").innerHTML = `
      <div class="stat-card"><strong>${activeCount}</strong><span>Active items</span></div>
      <div class="stat-card"><strong>${archivedCount}</strong><span>Archived</span></div>
      <div class="stat-card"><strong>${appState.history.length}</strong><span>Outfits logged</span></div>
      <div class="stat-card"><strong>${appState.bannedCombos.length}</strong><span>Banned combos</span></div>
    `;
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
    $("#itemColors").value = item.colors.join(", ");
    $("#itemTags").value = item.tags.join(", ");
    $("#itemFormality").value = item.formality || 5;
    $("#formalityOutput").value = item.formality || 5;
    $("#itemSeason").value = item.season.join(", ");
    $("#itemWorksWithTags").value = item.worksWithTags.join(", ");
    $("#itemAvoidWithTags").value = item.avoidWithTags.join(", ");
    $("#itemAvoidWithItems").value = formatAvoidItems(item.avoidWithItems).join(", ");
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
    const item = collectItemFromForm();
    const error = validateItem(item);
    if (error) {
      $("#formError").textContent = error;
      $("#formError").hidden = false;
      return;
    }

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
      appState.wardrobe.push({
        ...item,
        id: uid("item"),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      showToast("Item added.");
    }

    saveState();
    closeItemDialog();
    renderAll();
  }

  function collectItemFromForm() {
    return normalizeItem({
      id: $("#itemId").value,
      name: $("#itemName").value.trim(),
      category: $("#itemCategory").value,
      colors: parseCsv($("#itemColors").value),
      tags: parseCsv($("#itemTags").value),
      occasions: $$("input[name='itemOccasion']:checked").map((input) => input.value),
      formality: Number($("#itemFormality").value),
      season: parseCsv($("#itemSeason").value),
      worksWithTags: parseCsv($("#itemWorksWithTags").value),
      avoidWithTags: parseCsv($("#itemAvoidWithTags").value),
      avoidWithItems: resolveAvoidItemTokens(parseCsv($("#itemAvoidWithItems").value), editingItemId),
      imageUrl: $("#itemImageUrl").value.trim(),
      active: $("#itemActive").checked,
      notes: $("#itemNotes").value.trim()
    });
  }

  function validateItem(item) {
    if (!item.name) return "Name is required.";
    if (!item.category) return "Category is required.";
    if (!item.colors.length && !item.tags.length) return "Add at least one color or tag.";
    if (!item.occasions.length) return "Choose at least one occasion.";
    return "";
  }

  function handleItemFormClick(event) {
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

  function generateAndRender() {
    const occasionId = $("#occasionSelect").value;
    const buildAroundId = $("#buildAroundSelect").value;
    currentOutfit = pickOutfit(occasionId, buildAroundId);
    renderResult();
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

    return uniqueItems(selected);
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
        results.push(uniqueItems(outfit));
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
    const formalities = items.map((item) => item.formality);
    if (Math.max(...formalities) - Math.min(...formalities) > occasion.formalityGap) {
      return false;
    }

    for (const item of items) {
      if (!matchesOccasion(item, occasionId)) return false;

      const otherItems = items.filter((other) => other.id !== item.id);
      const otherSignals = new Set(otherItems.flatMap(itemSignals));

      if (item.avoidWithTags.some((tag) => otherSignals.has(normalizeTag(tag)))) {
        return false;
      }

      if (otherItems.some((other) => itemAvoidsItem(item, other))) {
        return false;
      }

      if (item.worksWithTags.length && !item.worksWithTags.some((tag) => otherSignals.has(normalizeTag(tag)))) {
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
    if (!currentOutfit || currentOutfit.error) return;
    const date = new Date().toISOString();
    const itemIds = currentOutfit.items.map((item) => item.id);

    appState.history.unshift({
      id: uid("log"),
      date,
      occasion: currentOutfit.occasion,
      itemIds,
      itemSnapshots: currentOutfit.items.map(snapshotItem)
    });

    const dateOnlyValue = dateOnly(date);
    currentOutfit.items.forEach((outfitItem) => {
      const closetItem = findItem(outfitItem.id);
      if (closetItem) {
        closetItem.lastWorn = dateOnlyValue;
        closetItem.updatedAt = date;
      }
    });

    saveState();
    renderAll();
    showToast("Outfit logged.");
  }

  function banCurrentCombo() {
    if (!currentOutfit || currentOutfit.error) return;
    const itemIds = currentOutfit.items.map((item) => item.id).sort();
    const key = comboKey(itemIds);
    const alreadyBanned = appState.bannedCombos.some((combo) => comboKey(combo.itemIds) === key);

    if (!alreadyBanned) {
      appState.bannedCombos.push({
        id: uid("ban"),
        itemIds,
        occasion: currentOutfit.occasion,
        createdAt: new Date().toISOString()
      });
      saveState();
    }

    showToast("Combo banned.");
    generateAndRender();
    renderSettings();
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
      tags: [...item.tags]
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
