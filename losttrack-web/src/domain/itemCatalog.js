import { getCatalog } from "../core/storage/catalogRepo.js";
import { currentFeeCode } from "./workflow.js";
import { hasSpecialJurisdiction } from "./captureContext.js";

function searchable(value) {
  return String(value ?? "").toLocaleLowerCase("de-CH")
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

export function searchItems(query, catalog = getCatalog()) {
  const words = searchable(query).split(/\s+/).filter(Boolean);
  return catalog.items.filter((item) => {
    if (!item.active) return false;
    const group = catalog.groups.find((group) => group.id === item.groupId)?.label || "";
    const text = searchable([item.label, group, ...item.aliases].join(" "));
    return words.every((word) => text.includes(word));
  });
}

export function catalogFee(key, catalog = getCatalog()) {
  return currentFeeCode(catalog.items.find((item) => item.key === key)?.feeCode || "UNSET");
}

export function selectCatalogItem(data, key, { updateFee = true } = {}) {
  const catalog = getCatalog();
  const entry = catalog.items.find((item) => item.key === key && item.active);
  if (key && !entry) return data;
  const context = data.regime && ["idcard", "passport"].includes(key)
    ? { ...data, regime: { type: "DOCUMENT", source: "CATALOG_REVIEW" } } : data;
  return { ...context, item: { ...data.item, predefinedKey: key, manualLabel: entry?.label || "" },
    ...(updateFee ? { feeSelection: hasSpecialJurisdiction(context) ? "UNSET" : catalogFee(key, catalog) } : {}) };
}
