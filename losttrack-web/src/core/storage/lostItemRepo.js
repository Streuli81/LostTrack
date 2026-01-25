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
