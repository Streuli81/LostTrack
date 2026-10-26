import { hasPermission } from "../auth/auth.js";
import { verifyCashbookChain } from "./lostItemRepo.js";
import { validateStoredWorkflow } from "../../domain/workflow.js";
import { CATALOG_KEY, validateCatalog } from "../../domain/catalogModel.js";
import { validateExpenseClaims } from "../../domain/expenseClaims.js";
import { validateFoundValues } from "../../domain/foundValues.js";

const PREFIX = "losttrack:lostItems.";
const RECORDS = `${PREFIX}records.v1`;
const DRAFTS = `${PREFIX}drafts.v1`;
const AUDIT = `${PREFIX}audit.v1`;
const CASHBOOK = `${PREFIX}cashbook.v1`;
const COUNTERS = `${PREFIX}counters.v1`;
const USERS = `${PREFIX}users.v2`;
const SESSION = `${PREFIX}session.v1`;
const REQUIRED = [RECORDS, DRAFTS, AUDIT, CASHBOOK, COUNTERS, USERS];
const OPTIONAL = [`${PREFIX}users.v1`, "losttrack_users_v1", "losttrack:drafts:v1", CATALOG_KEY];
const FUND_COUNTER = /^losttrack_fundcounter_\d{4}$/;
export const MAX_BACKUP_BYTES = 25 * 1024 * 1024;

function requireAdmin() {
  if (!hasPermission("BACKUP_MANAGE")) throw new Error("Nur ein angemeldeter ADMIN darf Daten sichern oder wiederherstellen.");
}

function isManagedKey(key) {
  return REQUIRED.includes(key) || OPTIONAL.includes(key) || FUND_COUNTER.test(key);
}

function currentKeys() {
  const keys = new Set([...REQUIRED, ...OPTIONAL]);
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && FUND_COUNTER.test(key)) keys.add(key);
  }
  return [...keys];
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function validate(backup) {
  assert(isObject(backup) && backup.format === "LostTrackBackup", "Dies ist keine LostTrack-Sicherungsdatei.");
  assert(backup.version === 1, "Diese Version der Sicherungsdatei wird nicht unterstützt.");
  assert(typeof backup.createdAt === "string" && Number.isFinite(Date.parse(backup.createdAt)), "Das Sicherungsdatum ist ungültig.");
  assert(isObject(backup.data), "Der Datenbereich der Sicherung fehlt.");
  for (const key of REQUIRED) {
    assert(Object.hasOwn(backup.data, key), "Die Sicherung ist unvollständig: Ein erforderlicher Datenbereich fehlt.");
  }
  const parsed = {};
  for (const [key, raw] of Object.entries(backup.data)) {
    assert(isManagedKey(key), "Die Datei enthält einen unbekannten oder unzulässigen Datenbereich.");
    assert(typeof raw === "string", "Ein Datenbereich hat ein ungültiges Format.");
    try { parsed[key] = JSON.parse(raw); }
    catch { throw new Error("Ein gespeicherter Datenbereich ist beschädigt und kann nicht eingelesen werden."); }
    if (key === CATALOG_KEY) {
      const check = validateCatalog(parsed[key]);
      assert(check.ok, check.error);
    } else if (key === COUNTERS) {
      assert(isObject(parsed[key]) && Object.values(parsed[key]).every((v) => Number.isSafeInteger(v) && v >= 0), "Die Nummernzähler sind ungültig.");
    } else if (FUND_COUNTER.test(key)) {
      assert(/^\d+$/.test(raw) && Number.isSafeInteger(parsed[key]) && parsed[key] >= 0, "Ein Fundnummernzähler ist ungültig.");
    } else {
      assert(Array.isArray(parsed[key]) && parsed[key].every(isObject), "Ein Datenbereich muss eine Liste gültiger Einträge enthalten.");
    }
  }
  for (const key of [RECORDS, DRAFTS]) {
    const ids = new Set();
    for (const item of parsed[key]) {
      // Entwürfe dürfen fachlich unvollständig sein und eine leere ID haben.
      assert(typeof item.id === "string" && (key === DRAFTS || item.id.length > 0) &&
        typeof item.fundNo === "string" && isObject(item.foundAt) && isObject(item.item) &&
        isObject(item.finder) && ["OPEN", "RETURNED", "DISPOSED", "TRANSFERRED"].includes(item.status),
      "Eine Fundsache oder ein Entwurf hat eine ungültige Datenstruktur.");
      assert(!item.id || !ids.has(item.id), "Fundsachen oder Entwürfe enthalten doppelte IDs.");
      ids.add(item.id);
      const workflowCheck = validateStoredWorkflow(item);
      const claimsCheck = validateExpenseClaims(item), contentsCheck = validateFoundValues(item);
      assert(claimsCheck.ok, claimsCheck.error);
      assert(contentsCheck.ok, contentsCheck.error);
      assert(workflowCheck.ok, workflowCheck.error || "Ungültige Workflow-Daten.");
    }
  }
  const ids = new Set();
  const names = new Set();
  for (const user of parsed[USERS]) {
    assert(typeof user.id === "string" && user.id.length > 0 && typeof user.name === "string" && user.name.trim() &&
      typeof user.username === "string" && user.username.trim() && typeof user.active === "boolean" &&
      ["ADMIN", "EDITOR", "VIEWER"].includes(user.role) &&
      (user.passwordHash === null || (typeof user.passwordHash === "string" && /^[a-f0-9]{8}$/i.test(user.passwordHash))),
    "Ein Benutzerkonto hat eine ungültige Datenstruktur.");
    assert(!ids.has(user.id) && !names.has(user.username.toLowerCase()), "Die Sicherung enthält doppelte Benutzerkonten.");
    ids.add(user.id);
    names.add(user.username.toLowerCase());
  }
  assert(parsed[USERS].some((u) => u.active && u.role === "ADMIN" && u.passwordHash),
    "Die Sicherung benötigt mindestens einen aktiven ADMIN mit Passwort.");
  assert(parsed[CASHBOOK].every((entry) => ["IN", "OUT"].includes(entry.type) &&
    Number.isSafeInteger(entry.amountCents) && entry.amountCents >= 0 &&
    typeof entry.id === "string" && typeof entry.createdAt === "string"), "Ein Kassenbucheintrag ist ungültig.");
  assert(verifyCashbookChain(parsed[CASHBOOK]).ok, "Die Prüfkette des Kassenbuchs ist beschädigt.");
  return {
    createdAt: backup.createdAt,
    records: parsed[RECORDS].length,
    drafts: parsed[DRAFTS].length,
    users: parsed[USERS].length,
    audit: parsed[AUDIT].length,
    cashbook: parsed[CASHBOOK].length,
  };
}

function parse(text) {
  assert(typeof text === "string" && text.length <= MAX_BACKUP_BYTES && new Blob([text]).size <= MAX_BACKUP_BYTES,
    "Die Sicherungsdatei ist zu groß oder ungültig (höchstens 25 MB).");
  let backup;
  try { backup = JSON.parse(text); }
  catch { throw new Error("Die Datei ist keine lesbare JSON-Sicherung."); }
  return { backup, summary: validate(backup) };
}

export function createBackup() {
  requireAdmin();
  const data = {};
  for (const key of currentKeys()) {
    const raw = localStorage.getItem(key);
    if (raw !== null) data[key] = raw;
    else if (REQUIRED.includes(key)) data[key] = key === COUNTERS ? "{}" : "[]";
  }
  const backup = { format: "LostTrackBackup", version: 1, createdAt: new Date().toISOString(), data };
  validate(backup);
  const text = JSON.stringify(backup, null, 2);
  assert(new Blob([text]).size <= MAX_BACKUP_BYTES, "Die Sicherung überschreitet die unterstützte Größe von 25 MB.");
  return text;
}

export function inspectBackup(text) {
  requireAdmin();
  return parse(text).summary;
}

export function restoreBackup(text, { confirmed = false } = {}) {
  requireAdmin();
  assert(confirmed === true, "Die Wiederherstellung muss ausdrücklich bestätigt werden.");
  // Erneut prüfen, auch wenn die Vorschau bereits angezeigt wurde.
  const { backup, summary } = parse(text);
  const keys = [...new Set([...currentKeys(), ...Object.keys(backup.data), SESSION])];
  const previous = new Map(keys.map((key) => [key, localStorage.getItem(key)]));
  try {
    // Erst entfernen: vermeidet doppelten Speicherbedarf bei einer größeren Sicherung.
    // Synchroner Vorgang; bei einem Fehler den vorherigen Stand wieder einsetzen.
    for (const key of keys) localStorage.removeItem(key);
    for (const [key, raw] of Object.entries(backup.data)) localStorage.setItem(key, raw);
  } catch {
    try {
      for (const key of keys) localStorage.removeItem(key);
      for (const [key, raw] of previous) if (raw !== null) localStorage.setItem(key, raw);
    } catch {
      throw new Error("Die Wiederherstellung und das Zurücksetzen sind fehlgeschlagen. Nicht weiterarbeiten: Bitte die zuvor heruntergeladene Sicherung aufbewahren und Hilfe anfordern.");
    }
    throw new Error("Die Wiederherstellung ist fehlgeschlagen. Der vorherige Datenstand wurde zurückgesetzt. Bitte den verfügbaren Browserspeicher prüfen.");
  }
  return summary;
}
