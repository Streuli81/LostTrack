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
 * Suche in Records (AND-Verknüpfung)
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

    const d = String(dateStr).slice(0, 10);
    if (df && d < df) return false;
    if (dt && d > dt) return false;
    return true;
  };

  const records = storage.getJson(KEY_RECORDS, []);

  const sorted = [...records].sort((a, b) =>
    (b?.createdAt || "").localeCompare(a?.createdAt || "")
  );

  return sorted.filter((r) => {
    if (fundNo && !norm(r.fundNo).includes(fundNo)) return false;

    if (finder) {
      const fn = norm(r?.finder?.name);
      const fp = norm(r?.finder?.phone);
      const fe = norm(r?.finder?.email);
      if (!(fn.includes(finder) || fp.includes(finder) || fe.includes(finder))) return false;
    }

    if (item) {
      const pk = norm(r?.item?.predefinedKey);
      const ml = norm(r?.item?.manualLabel);
      const ds = norm(r?.item?.description);
      if (!(pk.includes(item) || ml.includes(item) || ds.includes(item))) return false;
    }

    if (location && !norm(r?.foundAt?.location).includes(location)) return false;

    if (!inDateRange(r?.foundAt?.date)) return false;

    return true;
  });
}

/* -------------------------------------------------
 * WRITE – STATUS
 * ------------------------------------------------- */

/**
 * Statuswechsel: Record updaten + Audit schreiben
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
 * WRITE – UPDATE (EDIT-MODE)
 * ------------------------------------------------- */

/**
 * Aktualisiert eine bestehende Fundsache (Bearbeiten).
 * - keine neue Fundnummer
 * - harte Validierung (COMMIT)
 * - Audit-Eintrag
 */
export function updateLostItem(input, { actor = null } = {}) {
  const { ok, value, errors } = validateLostItem(input, { mode: VALIDATION_MODE.COMMIT });

  if (!ok) return { ok: false, errors };
  if (!value.id) return { ok: false, errors: { id: "Fehlende ID." } };

  const existing = getLostItemById(value.id);
  if (!existing) return { ok: false, errors: { id: "Datensatz nicht gefunden." } };

  const now = new Date().toISOString();

  const updated = {
    ...existing,
    ...value,
    fundNo: existing.fundNo, // ❗ Fundnummer bleibt unverändert
    updatedAt: now,
  };

  const records = storage.getJson(KEY_RECORDS, []);
  const nextRecords = upsertById(records, updated);
  storage.setJson(KEY_RECORDS, nextRecords);

  appendAudit({
    type: "ITEM_UPDATED",
    fundNo: updated.fundNo || null,
    snapshot: slimSnapshot(updated),
  });

  return { ok: true, item: updated };
}

/* -------------------------------------------------
 * WRITE – DRAFT
 * ------------------------------------------------- */

/**
 * Speichert oder aktualisiert einen Entwurf (Vorschau).
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
 * WRITE – COMMIT (NEU)
 * ------------------------------------------------- */

/**
 * Speichert eine Fundsache definitiv (Neu-Erfassung).
 */
export function commitLostItem(input) {
  const { ok, value, errors } = validateLostItem(input, { mode: VALIDATION_MODE.COMMIT });

  if (!ok) return { ok: false, errors };

  if (!value.id) value.id = cryptoId();

  const records = storage.getJson(KEY_RECORDS, []);
  const nextRecords = upsertById(records, value);
  storage.setJson(KEY_RECORDS, nextRecords);

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
      description: item?.item?.description || "",
    },
  };
}

function cryptoId() {
  return "id_" + Date.now().toString(16) + "_" + Math.random().toString(16).slice(2);
}
