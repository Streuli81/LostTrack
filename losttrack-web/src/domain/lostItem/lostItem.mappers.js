// C:\Dev\LostTrack\losttrack-web\src\domain\lostItem\lostItem.mappers.js

import { nowIso } from "./lostItem.defaults";

/**
 * Trimmt Strings rekursiv in bestimmten Pfaden (MVP pragmatisch)
 * @param {any} obj
 */
export function normalizeLostItem(obj) {
  const clone = structuredCloneSafe(obj);

  // Finder
  clone.finder.name = (clone.finder.name || "").trim();
  clone.finder.address = (clone.finder.address || "").trim();
  clone.finder.phone = (clone.finder.phone || "").trim();
  clone.finder.email = (clone.finder.email || "").trim();

  // Details
  clone.details.categoryId = (clone.details.categoryId || "").trim();
  clone.details.categoryLabel = (clone.details.categoryLabel || "").trim();
  clone.details.manualLabel = (clone.details.manualLabel || "").trim();
  clone.details.brand = (clone.details.brand || "").trim();
  clone.details.model = (clone.details.model || "").trim();
  clone.details.color = (clone.details.color || "").trim();
  clone.details.serialNumber = (clone.details.serialNumber || "").trim();
  clone.details.description = (clone.details.description || "").trim();
  clone.details.condition = (clone.details.condition || "").trim();

  // Location
  clone.location.place = (clone.location.place || "").trim();
  clone.location.foundAtDate = (clone.location.foundAtDate || "").trim();
  clone.location.foundAtTime = (clone.location.foundAtTime || "").trim();

  // Meta update
  clone.meta.updatedAt = nowIso();

  return clone;
}

/**
 * @param {any} obj
 */
function structuredCloneSafe(obj) {
  if (typeof structuredClone === "function") return structuredClone(obj);
  return JSON.parse(JSON.stringify(obj));
}
