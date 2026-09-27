(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FitRouletteManualSlots = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  // Manual records are evidence, not generator candidates. Only occupancy is
  // checked here; occasion, availability, pair rules and scoring are untouched.
  const labels = { upper: "base top / optional layer", bottom: "bottom", shoes: "shoes", belt: "belt", socks: "socks" };
  function group(item) {
    if (["top", "layer"].includes(item?.category)) return "upper";
    return ["bottom", "shoes", "belt", "socks"].includes(item?.category) ? item.category : "";
  }
  function roles(item) {
    if (group(item) !== "upper") return [];
    const saved = Array.isArray(item.layerRoles) ? item.layerRoles : [];
    const result = [];
    // Missing legacy top roles remain conservatively base-only. A known layer
    // category without roles remains one optional layer, never a second base.
    if (item.category === "top" && (!saved.length || saved.includes("base"))) result.push("base");
    if (saved.some((role) => role === "mid" || role === "outer") || (item.category === "layer" && !saved.length)) result.push("layer");
    return result;
  }
  function fits(items) {
    if (!items.length) return true;
    if (group(items[0]) !== "upper") return items.length <= 1;
    if (items.length > 2) return false;
    const assign = (index, occupied) => index === items.length || roles(items[index]).some((role) =>
      !occupied.includes(role) && assign(index + 1, [...occupied, role]));
    return assign(0, []);
  }
  function uniqueItems(items) {
    const seen = new Set();
    return items.filter((item) => item?.id && !seen.has(String(item.id)) && seen.add(String(item.id)));
  }
  function conflicts(items) {
    const distinct = uniqueItems(items);
    return Object.keys(labels).flatMap((key) => {
      const members = distinct.filter((item) => group(item) === key);
      return fits(members) ? [] : [{ group: key, label: labels[key], itemIds: members.map((item) => String(item.id)) }];
    });
  }
  function select(items, incoming) {
    const current = uniqueItems(items);
    if (current.some((item) => item.id === incoming.id)) return { itemIds: current.map((item) => item.id), removedIds: [] };
    const key = group(incoming);
    const kept = [incoming];
    const removedIds = [];
    // Prefer a constrained base alongside a flexible sweater regardless of
    // selection order. Ties retain the earlier selected garment.
    const peers = current.filter((item) => key && group(item) === key)
      .sort((a, b) => roles(a).length - roles(b).length);
    for (const peer of peers) {
      if (fits([...kept, peer])) kept.push(peer);
      else removedIds.push(peer.id);
    }
    return { itemIds: [...current.filter((item) => !removedIds.includes(item.id)).map((item) => item.id), incoming.id], removedIds };
  }
  function newConflicts(items, originalItems = []) {
    const original = conflicts(originalItems);
    return conflicts(items).filter((conflict) => !original.some((saved) =>
      saved.group === conflict.group && conflict.itemIds.every((id) => saved.itemIds.includes(id))));
  }
  return { group, roles, conflicts, select, newConflicts };
});
