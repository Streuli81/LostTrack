import { hasPermission, getCurrentUserName } from "../auth/auth.js";
import { CATALOG_KEY, defaultCatalog, validateCatalog } from "../../domain/catalogModel.js";

export function getCatalog() {
  const raw = typeof localStorage === "undefined" ? null : localStorage.getItem(CATALOG_KEY);
  if (raw === null) return defaultCatalog();
  let catalog;
  try { catalog = JSON.parse(raw); } catch { throw new Error("Die gespeicherten Stammdaten sind beschädigt."); }
  const check = validateCatalog(catalog);
  if (!check.ok) throw new Error(check.error);
  return catalog;
}

export function saveCatalog({ groups, items }, expectedRevision) {
  if (!hasPermission("MASTERDATA_MANAGE")) return { ok: false, error: "Nur ADMIN darf Stammdaten ändern." };
  try {
    const previous = getCatalog();
    if (previous.revision !== expectedRevision) return { ok: false, error: "Die Stammdaten wurden inzwischen geändert. Bitte die Seite neu öffnen." };
    // Bestehende Identitäten erhalten: deaktivieren statt löschen.
    if (previous.groups.some((old) => !groups.some((group) => group.id === old.id)) ||
      previous.items.some((old) => !items.some((item) => item.key === old.key))) {
      return { ok: false, error: "Bestehende Gruppen und Gegenstände erhalten. Gegenstände können deaktiviert werden." };
    }
    const changes = [];
    for (const [type, rows, oldRows, idKey] of [["group", groups, previous.groups, "id"], ["item", items, previous.items, "key"]]) {
      for (const row of rows) {
        const before = oldRows.find((old) => old[idKey] === row[idKey]) || null;
        if (JSON.stringify(before) !== JSON.stringify(row)) changes.push({ type, id: row[idKey], before, after: row });
      }
    }
    if (!changes.length) return { ok: true, catalog: previous };
    const catalog = { version: 1, revision: previous.revision + 1, groups, items,
      history: [...previous.history, { revision: previous.revision + 1, at: new Date().toISOString(),
        by: getCurrentUserName(), changes }] };
    const check = validateCatalog(catalog);
    if (!check.ok) return check;
    localStorage.setItem(CATALOG_KEY, JSON.stringify(catalog));
    return { ok: true, catalog };
  } catch (error) { return { ok: false, error: `Stammdaten nicht gespeichert: ${error.message}` }; }
}
