// src/core/storage/lostItemRepo.js

import { storage } from "./storage.js";
import { validateLostItem, VALIDATION_MODE } from "../../domain/lostItem.validators.js";

/**
 * Storage Keys (versioniert) – getrennt für Revisionssicherheit
 */
const STORAGE_VERSION = "v1";

const KEY_RECORDS = `lostItems.records.${STORAGE_VERSION}`; // definitiv erfasste Fundsachen
const KEY_DRAFTS  = `lostItems.drafts.${STORAGE_VERSION}`;  // Entwürfe / Vorschau
const KEY_AUDIT   = `lostItems.audit.${STORAGE_VERSION}`;   // append-only Log

/* -------------------------------------------------
 * READ
 * ------------------------------------------------- */

export function listLostItems() {
  return storage.getJson(KEY_RECORDS, []);
}

export function listDrafts() {
  return storage.getJson(KEY_DRAFTS, []);
}

export function listAuditLog() {
  return storage.getJson(KEY_AUDIT, []);
}

/**
 * Einzelnen Record laden
 */
export function getLostItemById(id) {
  if (!id) return null;
  const records = storage.getJson(KEY_RECORDS, []);
  return records.find((x) => x?.id === id) || null;
}

/**
 * Suche in Records (AND-Verknüpfung: alle gesetzten Filter müssen matchen)
 * q: { fundNo, finder, item, location, dateFrom, dateTo }
 */
export function searchLostItems(q = {}) {
  const norm = (s) => (s ?? "").toString().trim().toLowerCase();

  const fundNo = norm(q.fundNo);
  const finder = norm(q.finder);
  const item = norm(q.item);
  const location = norm(q.location);

  const df = (q.dateFrom || "").trim(); // YYYY-MM-DD
  const dt = (q.dateTo || "").trim();   // YYYY-MM-DD

  const inDateRange = (dateStr) => {
    if (!df && !dt) return true;
    if (!dateStr) return false;

    // bei dir ist foundAt.date bereits "YYYY-MM-DD"
    const d = String(dateStr).slice(0, 10);
    if (df && d < df) return false;
    if (dt && d > dt) return false;
    return true;
  };

  const records = storage.getJson(KEY_RECORDS, []);

  // optional: neueste zuerst (createdAt falls vorhanden)
  const sorted = [...records].sort((a, b) => (b?.createdAt || "").localeCompare(a?.createdAt || ""));

  return sorted.filter((r) => {
    // Fundnummer
    if (fundNo) {
      const rFund = norm(r.fundNo);
      if (!rFund.includes(fundNo)) return false;
    }

    // Finder (Name / Phone / Email)
    if (finder) {
      const fn = norm(r?.finder?.name);
      const fp = norm(r?.finder?.phone);
      const fe = norm(r?.finder?.email);
      if (!(fn.includes(finder) || fp.includes(finder) || fe.includes(finder))) return false;
    }

    // Gegenstand (predefinedKey / manualLabel / description)
    if (item) {
      const pk = norm(r?.item?.predefinedKey);
      const ml = norm(r?.item?.manualLabel);
      const ds = norm(r?.item?.description);
      if (!(pk.includes(item) || ml.includes(item) || ds.includes(item))) return false;
    }

    // Fundort
    if (location) {
      const loc = norm(r?.foundAt?.location);
      if (!loc.includes(location)) return false;
    }

    // Datum (foundAt.date)
    if (!inDateRange(r?.foundAt?.date)) return false;

    return true;
  });
}

/**
 * Statuswechsel: Record updaten + Audit schreiben
 * (Revision-Logik kannst du später erweitern; fürs MVP reicht upsert + audit.)
 */
export function changeLostItemStatus({ id, newStatus, actor = null }) {
  if (!id) return { ok: false, error: "Missing id" };
  if (!newStatus) return { ok: false, error: "Missing newStatus" };

  const current = getLostItemById(id);
  if (!current) return { ok: false, error: "Not found" };

  const now = new Date().toISOString();

  const updated = {
    ...current,
    status: String(newStatus).toUpperCase(),
    updatedAt: now,
  };

  // speichern (upsert)
  const records = storage.getJson(KEY_RECORDS, []);
  const nextRecords = upsertById(records, updated);
  storage.setJson(KEY_RECORDS, nextRecords);

  appendAudit({
    type: "STATUS_CHANGED",
    fundNo: current.fundNo || null,
    snapshot: {
      id: current.id,
      from: current.status || null,
      to: updated.status,
      actor,
      at: now,
    },
  });

  return { ok: true, item: updated };
}

/* -------------------------------------------------
 * WRITE – DRAFT
 * ------------------------------------------------- */

/**
 * Speichert oder aktualisiert einen Entwurf (Vorschau).
 * Keine harten Pflichtfelder (Draft darf auch bei Fehlern gespeichert werden).
 */
export function saveDraft(input) {
  const { value, errors } = validateLostItem(input, { mode: VALIDATION_MODE.DRAFT });

  const drafts = storage.getJson(KEY_DRAFTS, []);
  const nextDrafts = upsertById(drafts, value);
  storage.setJson(KEY_DRAFTS, nextDrafts);

  appendAudit({
    type: "DRAFT_SAVED",
    fundNo: value.fundNo || null,
    snapshot: slimSnapshot(value),
  });

  return { item: value, errors };
}

/* -------------------------------------------------
 * WRITE – COMMIT (definitiv)
 * ------------------------------------------------- */

/**
 * Speichert eine Fundsache definitiv.
 * Pflichtfelder werden geprüft.
 * Draft (falls vorhanden) wird entfernt.
 */
export function commitLostItem(input) {
  const { ok, value, errors } = validateLostItem(input, { mode: VALIDATION_MODE.COMMIT });

  if (!ok) {
    return { ok: false, errors };
  }

  // Commit muss eine stabile ID haben (für Draft-Entfernung, Audit, spätere Referenzen)
  if (!value.id) value.id = cryptoId();

  // Upsert statt blind unshift: verhindert Doppel-Commits desselben Datensatzes
  const records = storage.getJson(KEY_RECORDS, []);
  const nextRecords = upsertById(records, value);
  storage.setJson(KEY_RECORDS, nextRecords);

  // Draft entfernen (falls vorhanden)
  removeDraftById(value.id);

  appendAudit({
    type: "ITEM_COMMITTED",
    fundNo: value.fundNo || null,
    snapshot: slimSnapshot(value),
  });

  return { ok: true, item: value };
}

/* -------------------------------------------------
 * INTERNAL HELPERS
 * ------------------------------------------------- */

function upsertById(list, item) {
  if (!item.id) item.id = cryptoId();

  const idx = list.findIndex((x) => x?.id === item.id);
  if (idx === -1) return [item, ...list];

  const copy = [...list];
  copy[idx] = item;
  return copy;
}

function removeDraftById(id) {
  if (!id) return;

  const drafts = storage.getJson(KEY_DRAFTS, []);
  const nextDrafts = drafts.filter((d) => d?.id !== id);
  storage.setJson(KEY_DRAFTS, nextDrafts);
}

function appendAudit(event) {
  const log = storage.getJson(KEY_AUDIT, []);
  log.push({
    id: cryptoId(),
    at: new Date().toISOString(),
    ...event,
  });
  storage.setJson(KEY_AUDIT, log);
}

/**
 * Reduziertes Objekt fürs Audit (keine Fotos / grossen Datenmengen).
 * Bei Bedarf später erweitern (z.B. photosCount, investigationStepsCount).
 */
function slimSnapshot(item) {
  return {
    id: item.id,
    fundNo: item.fundNo,
    status: item.status,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,

    caseWorker: item.caseWorker,
    foundAt: item.foundAt,
    finder: item.finder,

    item: {
      predefinedKey: item?.item?.predefinedKey || "",
      manualLabel: item?.item?.manualLabel || "",
      category: item?.item?.category || "",
      brand: item?.item?.brand || "",
      type: item?.item?.type || "",
      color: item?.item?.color || "",
      serialNumber: item?.item?.serialNumber || "",
      description: item?.item?.description || "",
      condition: item?.item?.condition || "",
    },
  };
}

/**
 * Einfache, stabile ID (ohne externe Abhängigkeiten).
 */
function cryptoId() {
  return "id_" + Date.now().toString(16) + "_" + Math.random().toString(16).slice(2);
}
