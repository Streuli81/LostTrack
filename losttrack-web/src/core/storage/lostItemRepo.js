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
  return normalizeAll(storage.getJson(KEY_RECORDS, []));
}

export function listDrafts() {
  return normalizeAll(storage.getJson(KEY_DRAFTS, []));
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
  const found = records.find((x) => x?.id === id) || null;
  return normalizeOne(found);
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

  return normalizeAll(
    sorted.filter((r) => {
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
    })
  );
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

  const updated = normalizeOne({
    ...current,
    status: String(newStatus).toUpperCase(),
    updatedAt: now,
  });

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

  // WICHTIG:
  // - Fundnummer bleibt unverändert
  // - investigationSteps bleibt erhalten, sofern das Formular es nicht mitliefert
  const updated = normalizeOne({
    ...existing,
    ...value,
    fundNo: existing.fundNo,
    investigationSteps: Array.isArray(value.investigationSteps)
      ? value.investigationSteps
      : existing.investigationSteps,
    updatedAt: now,
  });

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

  const draft = normalizeOne(value);

  const drafts = storage.getJson(KEY_DRAFTS, []);
  const nextDrafts = upsertById(drafts, draft);
  storage.setJson(KEY_DRAFTS, nextDrafts);

  appendAudit({
    type: "DRAFT_SAVED",
    fundNo: draft.fundNo || null,
    snapshot: slimSnapshot(draft),
  });

  return { item: draft, errors };
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

  const record = normalizeOne({ ...value });

  if (!record.id) record.id = cryptoId();

  const records = storage.getJson(KEY_RECORDS, []);
  const nextRecords = upsertById(records, record);
  storage.setJson(KEY_RECORDS, nextRecords);

  removeDraftById(record.id);

  appendAudit({
    type: "ITEM_COMMITTED",
    fundNo: record.fundNo || null,
    snapshot: slimSnapshot(record),
  });

  return { ok: true, item: record };
}

/* -------------------------------------------------
 * WRITE – ERMITTLUNGSSCHRITTE
 * ------------------------------------------------- */

/**
 * Fügt einen Ermittlungsschritt zu einer bestehenden Fundsache hinzu.
 * step: { at?: ISO-string, who: string, what: string }
 */
export function addInvestigationStep({ id, step, actor = null }) {
  if (!id) return { ok: false, error: "Missing id" };

  const current = getLostItemById(id);
  if (!current) return { ok: false, error: "Not found" };

  const who = (step?.who ?? "").toString().trim();
  const what = (step?.what ?? "").toString().trim();
  const at = step?.at ? toIsoOrNull(step.at) : new Date().toISOString();

  if (!who) return { ok: false, error: "Feld 'Wer' ist leer." };
  if (!what) return { ok: false, error: "Feld 'Was' ist leer." };
  if (!at) return { ok: false, error: "Ungültiges Datum/Zeit." };

  const newStep = {
    id: cryptoId(),
    at,
    who,
    what,
  };

  const now = new Date().toISOString();

  const updated = normalizeOne({
    ...current,
    investigationSteps: [...(current.investigationSteps || []), newStep],
    updatedAt: now,
  });

  const records = storage.getJson(KEY_RECORDS, []);
  const nextRecords = upsertById(records, updated);
  storage.setJson(KEY_RECORDS, nextRecords);

  appendAudit({
    type: "INVESTIGATION_STEP_ADDED",
    fundNo: updated.fundNo || null,
    snapshot: {
      id: updated.id,
      step: newStep,
      actor,
      at: now,
    },
  });

  return { ok: true, item: updated, step: newStep };
}

/**
 * Löscht einen Ermittlungsschritt (optional, aber praktisch).
 */
export function deleteInvestigationStep({ id, stepId, actor = null }) {
  if (!id) return { ok: false, error: "Missing id" };
  if (!stepId) return { ok: false, error: "Missing stepId" };

  const current = getLostItemById(id);
  if (!current) return { ok: false, error: "Not found" };

  const before = current.investigationSteps || [];
  const after = before.filter((s) => s?.id !== stepId);

  if (after.length === before.length) {
    return { ok: false, error: "Step not found" };
  }

  const now = new Date().toISOString();

  const updated = normalizeOne({
    ...current,
    investigationSteps: after,
    updatedAt: now,
  });

  const records = storage.getJson(KEY_RECORDS, []);
  const nextRecords = upsertById(records, updated);
  storage.setJson(KEY_RECORDS, nextRecords);

  appendAudit({
    type: "INVESTIGATION_STEP_DELETED",
    fundNo: updated.fundNo || null,
    snapshot: {
      id: updated.id,
      stepId,
      actor,
      at: now,
    },
  });

  return { ok: true, item: updated };
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
    investigationSteps: Array.isArray(item?.investigationSteps)
      ? item.investigationSteps.map((s) => ({
          id: s?.id,
          at: s?.at,
          who: s?.who,
          what: s?.what,
        }))
      : [],
  };
}

function cryptoId() {
  return "id_" + Date.now().toString(16) + "_" + Math.random().toString(16).slice(2);
}

/**
 * Migration/Schema-Guard:
 * - stellt sicher, dass investigationSteps immer ein Array ist
 */
function normalizeOne(item) {
  if (!item) return item;
  const out = { ...item };
  if (!Array.isArray(out.investigationSteps)) out.investigationSteps = [];
  return out;
}

function normalizeAll(list) {
  return (list || []).map((x) => normalizeOne(x));
}

function toIsoOrNull(value) {
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString();
  } catch {
    return null;
  }
}
