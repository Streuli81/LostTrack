import { ITEM_CATALOG } from "../data/itemCatalog.js";
import { FEE_OPTIONS } from "./workflow.js";

export const CATALOG_KEY = "losttrack:lostItems.catalog.v1";

function defaultFee(key) {
  if (["keys", "car_key"].includes(key)) return "KEY";
  if (key === "key_bundle") return "KEY";
  if (key === "phone") return "MOBILE_MEDIATION";
  return ["other", "access_token"].includes(key) ? "UNSET" : "NONE";
}

export function defaultCatalog() {
  const groups = [...new Set(ITEM_CATALOG.map((item) => item.category))]
    .map((label, index) => ({ id: `group-${index + 1}`, label }));
  return { version: 1, revision: 0, groups,
    items: ITEM_CATALOG.map(({ category, ...item }) => ({ ...item,
      groupId: groups.find((group) => group.label === category).id,
      aliases: [...item.aliases], feeCode: defaultFee(item.key), active: true })), history: [] };
}

function text(value) { return typeof value === "string" && value.trim().length > 0 && value === value.trim() && value.length <= 200; }
function unique(rows, key) { return new Set(rows.map((row) => row[key]?.toLocaleLowerCase("de-CH"))).size === rows.length; }
function validRows(groups, items) {
  return Array.isArray(groups) && groups.length > 0 && groups.length <= 500 &&
    groups.every((group) => group && text(group.id) && text(group.label)) && unique(groups, "id") && unique(groups, "label") &&
    Array.isArray(items) && items.length > 0 && items.length <= 5000 && items.every((item) => item &&
      text(item.key) && text(item.label) && groups.some((group) => group.id === item.groupId) &&
      typeof item.active === "boolean" && FEE_OPTIONS.some((fee) => fee.code === item.feeCode) &&
      Array.isArray(item.aliases) && item.aliases.length <= 100 && item.aliases.every(text) &&
      new Set(item.aliases.map((alias) => alias.toLocaleLowerCase("de-CH"))).size === item.aliases.length) &&
    unique(items, "key") && unique(items, "label");
}

export function validateCatalog(catalog) {
  if (!catalog || catalog.version !== 1 || !Number.isSafeInteger(catalog.revision) || catalog.revision < 0 ||
    !validRows(catalog.groups, catalog.items) || !Array.isArray(catalog.history) ||
    catalog.history.length !== catalog.revision || !catalog.history.every((event, index) => event &&
      event.revision === index + 1 && text(event.by) && typeof event.at === "string" && Number.isFinite(Date.parse(event.at)) &&
      Array.isArray(event.changes) && event.changes.every((change) => change &&
        ["group", "item"].includes(change.type) && text(change.id) &&
        change.after && typeof change.after === "object" && (change.before === null || typeof change.before === "object")))) {
    return { ok: false, error: "Ungültige Stammdaten: eindeutige Namen, gültige Gruppen, Gebühren und Suchwörter erforderlich." };
  }
  return { ok: true };
}
