// src/core/storage/lostItemRepo.js

import { storage } from "./storage.js";
import { validateLostItem, VALIDATION_MODE } from "../../domain/lostItem.validators.js";

/**
 * Storage Keys (versioniert) – getrennt für Revisionssicherheit
 */
const STORAGE_VERSION = "v1";

const KEY_RECORDS = `lostItems.records.${STORAGE_VERSION}`; // definitiv erfasste Fundsachen
const KEY_DRAFTS = `lostItems.drafts.${STORAGE_VERSION}`; // Entwürfe / Vorschau
const KEY_AUDIT = `lostItems.audit.${STORAGE_VERSION}`; // append-only Log
const KEY_COUNTERS = `lostItems.counters.${STORAGE_VERSION}`; // Zähler (z.B. Quittungen, Fundnummern)

// ✅ NEU: Kassenbuch (append-only)
const KEY_CASHBOOK = `lostItems.cashbook.${STORAGE_VERSION}`; // append-only Kassenbuch (Buchungen)

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
 * ✅ NEU: Kassenbuch lesen
 */
export function listCashbookEntries() {
  const list = storage.getJson(KEY_CASHBOOK, []);
  return Array.isArray(list) ? list : [];
}

/**
 * ✅ NEU: Kassenbuch Hash-Kette prüfen (Manipulation erkennbar)
 * Returns: { ok: boolean, error?: string, badIndex?: number }
 */
export function verifyCashbookChain() {
  const entries = listCashbookEntries();

  let prevHash = "GENESIS";
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i] || {};
    const expectedPrev = prevHash;

    if ((e.prevHash || "") !== expectedPrev) {
      return { ok: false, error: "prevHash mismatch", badIndex: i };
    }

    const expectedHash = computeLedgerHash(e, expectedPrev);
    if ((e.hash || "") !== expectedHash) {
      return { ok: false, error: "hash mismatch", badIndex: i };
    }

    prevHash = expectedHash;
  }

  return { ok: true };
}

/**
 * ✅ NEU: Summen im Zeitraum
 * fromIso/toIso: ISO-DateTime oder ISO-Date oder leer
 * Returns: { inCents, outCents, balanceCents, count }
 */
export function getCashbookTotals({ fromIso = "", toIso = "" } = {}) {
  const from = (fromIso || "").trim();
  const to = (toIso || "").trim();

  const entries = listCashbookEntries();

  const inRange = (iso) => {
    const s = (iso || "").toString();
    if (!s) return false;
    // lexicographic OK bei ISO
    if (from && s < from) return false;
    if (to && s > to) return false;
    return true;
  };

  let inCents = 0;
  let outCents = 0;
  let count = 0;

  for (const e of entries) {
    if (!inRange(e.createdAt)) continue;
    const cents = Number(e.amountCents || 0) || 0;
    if (String(e.type).toUpperCase() === "IN") inCents += cents;
    if (String(e.type).toUpperCase() === "OUT") outCents += cents;
    count += 1;
  }

  return {
    inCents,
    outCents,
    balanceCents: inCents - outCents,
    count,
  };
}

/**
 * ✅ NEU: Buchung schreiben (append-only, keine Updates/Deletes!)
 *
 * type: "IN" | "OUT"
 * amountCents: integer >= 0
 * item: Fundsache (Record) – mindestens { id, fundNo, item{...}, caseWorker }
 * reason: string (z.B. "Finderlohn ausbezahlt")
 * caseWorker: string (aktueller Sachbearbeiter)
 *
 * Returns: { ok: boolean, entry?: object, error?: string }
 */
export function postCashbookEntry({ type, amountCents, item, reason, caseWorker, actor = null } = {}) {
  const t = String(type || "").toUpperCase();
  if (!(t === "IN" || t === "OUT")) return { ok: false, error: "Invalid type" };

  const cents = Number(amountCents);
  if (!Number.isFinite(cents) || cents < 0 || Math.floor(cents) !== cents) {
    return { ok: false, error: "Invalid amountCents" };
  }

  if (!item?.id) return { ok: false, error: "Missing item.id" };

  const now = new Date().toISOString();

  const entries = listCashbookEntries();
  const last = entries.length ? entries[entries.length - 1] : null;
  const prevHash = last?.hash || "GENESIS";

  const fundNo = (item?.fundNo || "").toString().trim();
  const label = (item?.item?.manualLabel || item?.item?.predefinedKey || "").toString().trim();
  const description = (item?.item?.description || "").toString().trim();

  const entry = {
    id: nextCashbookId(now),
    createdAt: now,
    type: t,
    amountCents: cents,

    // Referenzen / Kontext
    fundId: item.id,
    fundNo: fundNo || null,
    label: label || null,
    description: description || null,

    caseWorker: (caseWorker ?? item?.caseWorker ?? "").toString().trim() || null,
    reason: (reason ?? "").toString().trim() || null,

    // Revisionskette
    prevHash,
    hash: "", // wird unten gesetzt
  };

  entry.hash = computeLedgerHash(entry, prevHash);

  // append-only persist
  const next = [...entries, entry];
  storage.setJson(KEY_CASHBOOK, next);

  // audit (append-only) – wichtig für Nachvollziehbarkeit
  appendAudit({
    type: "CASHBOOK_POSTED",
    fundNo: fundNo || null,
    snapshot: {
      ledgerId: entry.id,
      ledgerType: entry.type,
      amountCents: entry.amountCents,
      actor,
      caseWorker: entry.caseWorker,
      reason: entry.reason,
      fundId: entry.fundId,
      fundNo: entry.fundNo,
      at: now,
    },
    diff: null,
  });

  return { ok: true, entry };
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
 * ✅ Neu: nächste Fundnummer "anzeigen" (ohne Counter zu erhöhen).
 * Damit kannst du beim Start der Erfassung sofort die Nummer anzeigen,
 * ohne dass Lücken entstehen.
 */
export function peekNextFundNo() {
  const now = new Date().toISOString();
  const records = storage.getJson(KEY_RECORDS, []);
  return peekFundNo(now, records);
}

/**
 * Suche in Records (AND-Verknüpfung)
 * q: { fundNo, finder, item, location, dateFrom, dateTo }
 *
 * ⚠️ Du speicherst final DD.MM.YYYY.
 * Für den Vergleich wandeln wir DD.MM.YYYY → YYYY-MM-DD um.
 */
export function searchLostItems(q = {}) {
  const norm = (s) => (s ?? "").toString().trim().toLowerCase();

  const fundNo = norm(q.fundNo);
  const finder = norm(q.finder);
  const item = norm(q.item);
  const location = norm(q.location);

  // Filterwerte kommen als YYYY-MM-DD (dein UI-Filter), das lassen wir so.
  const df = (q.dateFrom || "").trim(); // YYYY-MM-DD
  const dt = (q.dateTo || "").trim(); // YYYY-MM-DD

  const toIsoDateForCompare = (storedDate) => {
    // storedDate ist bei dir final DD.MM.YYYY (oder leer)
    return ddmmyyyyToIso(storedDate) || "";
  };

  const inDateRange = (storedDateStr) => {
    if (!df && !dt) return true;
    const iso = toIsoDateForCompare(storedDateStr); // YYYY-MM-DD
    if (!iso) return false;
    if (df && iso < df) return false;
    if (dt && iso > dt) return false;
    return true;
  };

  const records = storage.getJson(KEY_RECORDS, []);

  const sorted = [...records].sort((a, b) => (b?.createdAt || "").localeCompare(a?.createdAt || ""));

  const partyFullName = (p) => {
    if (!p) return "";
    // legacy fallback (name)
    const legacy = (p?.name ?? "").toString().trim();
    if (legacy) return legacy;
    const fn = (p?.firstName ?? "").toString().trim();
    const ln = (p?.lastName ?? "").toString().trim();
    return [fn, ln].filter(Boolean).join(" ").trim();
  };

  return normalizeAll(
    sorted.filter((r) => {
      if (fundNo && !norm(r.fundNo).includes(fundNo)) return false;

      if (finder) {
        const fn = norm(partyFullName(r?.finder));
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

  const before = slimSnapshot(current);

  const updated = normalizeOne({
    ...current,
    status: String(newStatus).toUpperCase(),
    updatedAt: now,
  });

  const after = slimSnapshot(updated);

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
      before,
      after,
    },
    diff: diffSnapshots(before, after),
  });

  return { ok: true, item: updated };
}

/* -------------------------------------------------
 * WRITE – UPDATE (EDIT-MODE)
 * ------------------------------------------------- */

export function updateLostItem(input, { actor = null } = {}) {
  // ✅ tolerant einlesen → ISO fürs Validieren
  const normalizedInput = normalizeFoundAtForValidation(input);

  const { ok, value, errors } = validateLostItem(normalizedInput, { mode: VALIDATION_MODE.COMMIT });

  if (!ok) return { ok: false, errors };
  if (!value.id) return { ok: false, errors: { id: "Fehlende ID." } };

  const existing = getLostItemById(value.id);
  if (!existing) return { ok: false, errors: { id: "Datensatz nicht gefunden." } };

  const now = new Date().toISOString();

  const before = slimSnapshot(existing);

  // ✅ final speichern: DD.MM.YYYY / HH.MM
  const formattedValue = formatFoundAtDisplay(value);

  const updated = normalizeOne({
    ...existing,
    ...formattedValue,
    fundNo: existing.fundNo, // ❗ Fundnummer bleibt unverändert

    investigationSteps: Array.isArray(formattedValue.investigationSteps)
      ? formattedValue.investigationSteps
      : existing.investigationSteps,

    owner: formattedValue.owner ?? existing.owner,
    collector: formattedValue.collector ?? existing.collector,

    // ✅ NEU: Flag nicht verlieren bei Edit-Mode
    collectorSameAsFinder:
      typeof formattedValue.collectorSameAsFinder === "boolean"
        ? formattedValue.collectorSameAsFinder
        : existing.collectorSameAsFinder,

    receipts: Array.isArray(existing.receipts) ? existing.receipts : [],

    updatedAt: now,
  });

  const after = slimSnapshot(updated);

  const records = storage.getJson(KEY_RECORDS, []);
  const nextRecords = upsertById(records, updated);
  storage.setJson(KEY_RECORDS, nextRecords);

  appendAudit({
    type: "ITEM_UPDATED",
    fundNo: updated.fundNo || null,
    snapshot: {
      id: updated.id,
      actor,
      at: now,
      before,
      after,
    },
    diff: diffSnapshots(before, after),
  });

  return { ok: true, item: updated };
}

/* -------------------------------------------------
 * WRITE – DRAFT
 * ------------------------------------------------- */

/**
 * ✅ Wichtig: Draft vergibt KEINE Fundnummer.
 * Aber Datum/Zeit wird ebenfalls final formatiert gespeichert.
 */
export function saveDraft(input, { actor = null } = {}) {
  const normalizedInput = normalizeFoundAtForValidation(input);
  const { value, errors } = validateLostItem(normalizedInput, { mode: VALIDATION_MODE.DRAFT });

  const formatted = formatFoundAtDisplay(value);
  const draft = normalizeOne(formatted);

  const drafts = storage.getJson(KEY_DRAFTS, []);
  const existing = drafts.find((d) => d?.id === draft.id) || null;
  const before = existing ? slimSnapshot(normalizeOne(existing)) : null;

  const nextDrafts = upsertById(drafts, draft);
  storage.setJson(KEY_DRAFTS, nextDrafts);

  const after = slimSnapshot(draft);

  appendAudit({
    type: "DRAFT_SAVED",
    fundNo: draft.fundNo || null,
    snapshot: {
      id: draft.id,
      actor,
      at: new Date().toISOString(),
      before,
      after,
    },
    diff: before ? diffSnapshots(before, after) : null,
  });

  return { item: draft, errors };
}

/* -------------------------------------------------
 * WRITE – COMMIT (NEU)
 * ------------------------------------------------- */

/**
 * ✅ Fix: Fundnummer wird beim Commit automatisch vergeben (einmalig).
 * - Wenn input.fundNo fehlt → generieren
 * - Wenn input.fundNo bereits existiert → neu generieren (safety)
 */
export function commitLostItem(input, { actor = null } = {}) {
  const normalizedInput = normalizeFoundAtForValidation(input);
  const { ok, value, errors } = validateLostItem(normalizedInput, { mode: VALIDATION_MODE.COMMIT });
  if (!ok) return { ok: false, errors };

  let record = normalizeOne({ ...value });
  if (!record.id) record.id = cryptoId();

  // ✅ final speichern: DD.MM.YYYY / HH.MM
  record = formatFoundAtDisplay(record);

  const now = new Date().toISOString();
  const records = storage.getJson(KEY_RECORDS, []);

  const inNo = (record.fundNo ?? "").toString().trim();
  const fundNoExists = inNo ? records.some((r) => (r?.fundNo ?? "").toString().trim() === inNo) : false;
  const needsFundNo = !inNo || fundNoExists;

  if (needsFundNo) {
    record = {
      ...record,
      fundNo: nextFundNo(now, records), // ✅ “verbraucht” die Nummer
    };
  } else {
    record = { ...record, fundNo: normalizeFundNo(inNo) };
  }

  const nextRecords = upsertById(records, record);
  storage.setJson(KEY_RECORDS, nextRecords);

  removeDraftById(record.id);

  const after = slimSnapshot(record);

  appendAudit({
    type: "ITEM_COMMITTED",
    fundNo: record.fundNo || null,
    snapshot: {
      id: record.id,
      actor,
      at: now,
      after,
    },
    diff: null,
  });

  return { ok: true, item: record };
}

/* -------------------------------------------------
 * WRITE – QUITTUNGEN (Metadaten + Audit)
 * ------------------------------------------------- */

export function createReceipt({
  id,
  receiptType,
  recipient,
  amount = null,
  actor = null,
  notes = null,
} = {}) {
  if (!id) return { ok: false, error: "Missing id" };
  if (!receiptType) return { ok: false, error: "Missing receiptType" };

  const current = getLostItemById(id);
  if (!current) return { ok: false, error: "Not found" };

  const now = new Date().toISOString();

  const before = slimSnapshot(current);

  const receiptId = nextReceiptId(now);

  const receipt = {
    id: receiptId,
    type: String(receiptType).toUpperCase(),
    recipient: (recipient ?? "").toString().trim(),
    amount: normalizeAmount(amount),
    notes: notes ? String(notes) : null,
    printedAt: now,
    printedBy: (actor ?? "").toString().trim() || "M. S.",
  };

  const updated = normalizeOne({
    ...current,
    receipts: [...(current.receipts || []), receipt],
    updatedAt: now,
  });

  const after = slimSnapshot(updated);

  persistRecord(updated);

  appendAudit({
    type: "RECEIPT_PRINTED",
    fundNo: updated.fundNo || null,
    snapshot: {
      id: updated.id,
      receipt,
      actor: receipt.printedBy,
      at: now,
      before,
      after,
    },
    diff: diffSnapshots(before, after),
  });

  return { ok: true, item: updated, receipt };
}

export function printReceipt(params) {
  return createReceipt(params);
}

/* -------------------------------------------------
 * WRITE – ERMITTLUNGSSCHRITTE
 * ------------------------------------------------- */

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

  const before = slimSnapshot(current);

  const updated = normalizeOne({
    ...current,
    investigationSteps: [...(current.investigationSteps || []), newStep],
    updatedAt: now,
  });

  const after = slimSnapshot(updated);

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
      before,
      after,
    },
    diff: diffSnapshots(before, after),
  });

  return { ok: true, item: updated, step: newStep };
}

export function deleteInvestigationStep({ id, stepId, actor = null }) {
  if (!id) return { ok: false, error: "Missing id" };
  if (!stepId) return { ok: false, error: "Missing stepId" };

  const current = getLostItemById(id);
  if (!current) return { ok: false, error: "Not found" };

  const beforeSteps = current.investigationSteps || [];
  const stepDeleted = beforeSteps.find((s) => s?.id === stepId) || null;

  const afterSteps = beforeSteps.filter((s) => s?.id !== stepId);

  if (afterSteps.length === beforeSteps.length) {
    return { ok: false, error: "Step not found" };
  }

  const now = new Date().toISOString();

  const before = slimSnapshot(current);

  const updated = normalizeOne({
    ...current,
    investigationSteps: afterSteps,
    updatedAt: now,
  });

  const after = slimSnapshot(updated);

  const records = storage.getJson(KEY_RECORDS, []);
  const nextRecords = upsertById(records, updated);
  storage.setJson(KEY_RECORDS, nextRecords);

  appendAudit({
    type: "INVESTIGATION_STEP_DELETED",
    fundNo: updated.fundNo || null,
    snapshot: {
      id: updated.id,
      stepId,
      step: stepDeleted,
      actor,
      at: now,
      before,
      after,
    },
    diff: diffSnapshots(before, after),
  });

  return { ok: true, item: updated };
}

/* -------------------------------------------------
 * WRITE – FINDER / OWNER / COLLECTOR (inline edit)
 * + automatische Ermittlungsschritte
 * ------------------------------------------------- */

export function updateFinder({ id, finder, actor = null }) {
  if (!id) return { ok: false, error: "Missing id" };

  const current = getLostItemById(id);
  if (!current) return { ok: false, error: "Not found" };

  const now = new Date().toISOString();

  const before = slimSnapshot(current);

  const clean = sanitizeFinder(finder);

  const updated = normalizeOne({
    ...current,
    finder: clean,
    updatedAt: now,
  });

  const after = slimSnapshot(updated);

  persistRecord(updated);

  appendAudit({
    type: "FINDER_UPDATED",
    fundNo: updated.fundNo || null,
    snapshot: {
      id: updated.id,
      finder: updated.finder,
      actor,
      at: now,
      before,
      after,
    },
    diff: diffSnapshots(before, after),
  });

  appendAutoInvestigationStep(updated, actor, buildAutoText("Finder", clean));

  return { ok: true, item: updated };
}

export function updateOwner({ id, owner, actor = null }) {
  if (!id) return { ok: false, error: "Missing id" };

  const current = getLostItemById(id);
  if (!current) return { ok: false, error: "Not found" };

  const now = new Date().toISOString();

  const before = slimSnapshot(current);

  const clean = sanitizeParty(owner);

  const updated = normalizeOne({
    ...current,
    owner: clean,
    updatedAt: now,
  });

  const after = slimSnapshot(updated);

  persistRecord(updated);

  appendAudit({
    type: "OWNER_UPDATED",
    fundNo: updated.fundNo || null,
    snapshot: {
      id: updated.id,
      owner: updated.owner,
      actor,
      at: now,
      before,
      after,
    },
    diff: diffSnapshots(before, after),
  });

  appendAutoInvestigationStep(updated, actor, buildAutoText("Eigentümer", clean));

  return { ok: true, item: updated };
}

/**
 * ✅ Abholer aktualisieren + Flag "Abholer = Finder"
 * - sameAsFinder=true: collector wird aus finder übernommen (oder aus übergebenem collector),
 *   und collectorSameAsFinder wird true.
 * - sameAsFinder=false: collector ist eigenständig (oder null) und collectorSameAsFinder false.
 */
export function updateCollector({ id, collector, sameAsFinder = false, actor = null }) {
  if (!id) return { ok: false, error: "Missing id" };

  const current = getLostItemById(id);
  if (!current) return { ok: false, error: "Not found" };

  const now = new Date().toISOString();

  const before = slimSnapshot(current);

  let nextCollector = null;

  if (sameAsFinder) {
    // Finder muss existieren, sonst macht Flag keinen Sinn
    const f = current?.finder;
    if (!f) return { ok: false, error: "Finder ist leer. Bitte zuerst Finder erfassen." };

    // Wenn caller collector mitgibt (z.B. item.finder), ok; sonst übernehmen wir aus current.finder
    nextCollector = sanitizeParty(collector || f);
  } else {
    nextCollector = collector === null ? null : sanitizeParty(collector);
  }

  const updated = normalizeOne({
    ...current,
    collector: nextCollector,
    collectorSameAsFinder: !!sameAsFinder,
    updatedAt: now,
  });

  const after = slimSnapshot(updated);

  persistRecord(updated);

  appendAudit({
    type: "COLLECTOR_UPDATED",
    fundNo: updated.fundNo || null,
    snapshot: {
      id: updated.id,
      collector: updated.collector,
      collectorSameAsFinder: updated.collectorSameAsFinder,
      actor,
      at: now,
      before,
      after,
    },
    diff: diffSnapshots(before, after),
  });

  if (updated.collectorSameAsFinder) {
    appendAutoInvestigationStep(updated, actor, "Abholer = Finder gesetzt.");
  } else if (nextCollector) {
    appendAutoInvestigationStep(updated, actor, buildAutoText("Abholer", nextCollector));
  } else {
    appendAutoInvestigationStep(updated, actor, "Abholer entfernt.");
  }

  return { ok: true, item: updated };
}

/* -------------------------------------------------
 * INTERNAL HELPERS
 * ------------------------------------------------- */

function persistRecord(updated) {
  const records = storage.getJson(KEY_RECORDS, []);
  const next = upsertById(records, updated);
  storage.setJson(KEY_RECORDS, next);
}

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

/**
 * Append-only Audit
 * Optional: event.diff = [{ path, from, to }]
 */
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
 * Slim snapshot für Audit.
 * (Datum/Zeit bleiben im gespeicherten Format DD.MM.YYYY / HH.MM)
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

    // ✅ NEU: Flag ins Audit aufnehmen
    collectorSameAsFinder: !!item.collectorSameAsFinder,

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
    owner: item?.owner || null,
    collector: item?.collector || null,

    receipts: Array.isArray(item?.receipts)
      ? item.receipts.map((r) => ({
          id: r?.id,
          type: r?.type,
          recipient: r?.recipient,
          amount: r?.amount ?? null,
          printedAt: r?.printedAt,
          printedBy: r?.printedBy,
          notes: r?.notes ?? null,
        }))
      : [],
  };
}

function diffSnapshots(before, after) {
  if (!before || !after) return null;

  const changes = [];
  const isObj = (v) => v && typeof v === "object" && !Array.isArray(v);

  const eq = (a, b) => {
    if (a === b) return true;
    if (typeof a === "number" && typeof b === "number" && Number.isNaN(a) && Number.isNaN(b))
      return true;
    return false;
  };

  const walk = (a, b, path) => {
    const aIsObj = isObj(a);
    const bIsObj = isObj(b);

    const aIsArr = Array.isArray(a);
    const bIsArr = Array.isArray(b);

    if (!aIsObj && !bIsObj && !aIsArr && !bIsArr) {
      if (!eq(a, b)) changes.push({ path, from: a ?? null, to: b ?? null });
      return;
    }

    if (aIsArr || bIsArr) {
      const aa = aIsArr ? a : [];
      const bb = bIsArr ? b : [];

      if (aa.length !== bb.length) {
        changes.push({ path: `${path}.length`, from: aa.length, to: bb.length });
      }

      const max = Math.max(aa.length, bb.length);
      for (let i = 0; i < max; i++) {
        const ai = aa[i];
        const bi = bb[i];
        const p = `${path}[${i}]`;

        if (isObj(ai) || isObj(bi) || Array.isArray(ai) || Array.isArray(bi)) {
          const aj = ai === undefined ? null : ai;
          const bj = bi === undefined ? null : bi;
          const as = safeJson(aj);
          const bs = safeJson(bj);
          if (as !== bs) changes.push({ path: p, from: aj, to: bj });
        } else {
          if (!eq(ai, bi)) changes.push({ path: p, from: ai ?? null, to: bi ?? null });
        }
      }
      return;
    }

    const keys = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]);
    for (const k of keys) {
      const nextPath = path ? `${path}.${k}` : k;
      walk(a ? a[k] : undefined, b ? b[k] : undefined, nextPath);
    }
  };

  walk(before, after, "");
  return changes.length ? changes : null;
}

function safeJson(v) {
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

function cryptoId() {
  return "id_" + Date.now().toString(16) + "_" + Math.random().toString(16).slice(2);
}

function normalizeOne(item) {
  if (!item) return item;
  const out = { ...item };
  if (!Array.isArray(out.investigationSteps)) out.investigationSteps = [];
  if (!("owner" in out)) out.owner = null;
  if (!("collector" in out)) out.collector = null;
  if (!Array.isArray(out.receipts)) out.receipts = [];
  if (!out.foundAt || typeof out.foundAt !== "object") out.foundAt = { date: "", time: "", location: "" };

  // ✅ NEU: Default für Flag
  if (!("collectorSameAsFinder" in out)) out.collectorSameAsFinder = false;

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

/* ---------- sanitize helpers ---------- */

/**
 * ✅ Neues Party-Format (wie PartyCardEditor):
 * { firstName, lastName, street, streetNo, zip, city, phone, email }
 */
function sanitizeParty(p) {
  if (!p) return null;

  return {
    firstName: (p.firstName ?? "").toString().trim(),
    lastName: (p.lastName ?? "").toString().trim(),
    zip: (p.zip ?? "").toString().trim(),
    city: (p.city ?? "").toString().trim(),
    street: (p.street ?? "").toString().trim(),
    streetNo: (p.streetNo ?? "").toString().trim(),
    phone: (p.phone ?? "").toString().trim(),
    email: (p.email ?? "").toString().trim(),
  };
}

/**
 * ✅ Neues Finder-Format + rewardRequested:
 * { firstName, lastName, street, streetNo, zip, city, phone, email, rewardRequested }
 */
function sanitizeFinder(f) {
  if (!f) return null;

  return {
    firstName: (f.firstName ?? "").toString().trim(),
    lastName: (f.lastName ?? "").toString().trim(),
    zip: (f.zip ?? "").toString().trim(),
    city: (f.city ?? "").toString().trim(),
    street: (f.street ?? "").toString().trim(),
    streetNo: (f.streetNo ?? "").toString().trim(),
    phone: (f.phone ?? "").toString().trim(),
    email: (f.email ?? "").toString().trim(),
    rewardRequested: !!f.rewardRequested,
  };
}

/* ---------- auto investigation steps ---------- */

function appendAutoInvestigationStep(item, actor, what) {
  const who = (actor ?? "").toString().trim() || "System";

  const now = new Date().toISOString();
  const newStep = {
    id: cryptoId(),
    at: now,
    who,
    what,
  };

  const before = slimSnapshot(item);

  const updated = normalizeOne({
    ...item,
    investigationSteps: [...(item.investigationSteps || []), newStep],
    updatedAt: now,
  });

  const after = slimSnapshot(updated);

  persistRecord(updated);

  appendAudit({
    type: "INVESTIGATION_STEP_ADDED_AUTO",
    fundNo: updated.fundNo || null,
    snapshot: {
      id: updated.id,
      step: newStep,
      actor: who,
      at: now,
      before,
      after,
    },
    diff: diffSnapshots(before, after),
  });
}

function buildAutoText(roleLabel, p) {
  // ✅ kompatibel: neues Format (first/last) + Legacy (name)
  const legacyName = (p?.name || "").toString().trim();
  const name = legacyName || [p?.firstName, p?.lastName].filter(Boolean).join(" ").trim();

  const phone = (p?.phone || "").toString().trim();
  const email = (p?.email || "").toString().trim();

  const parts = [];
  if (name) parts.push(`Name: ${name}`);
  if (phone) parts.push(`Tel: ${phone}`);
  if (email) parts.push(`E-Mail: ${email}`);

  if (parts.length === 0) return `${roleLabel} erfasst/aktualisiert.`;
  return `${roleLabel} erfasst/aktualisiert (${parts.join(", ")}).`;
}

/* -------------------------------------------------
 * DATUM / ZEIT NORMALISIERUNG
 * - Eingabe tolerant
 * - Validierung bekommt ISO (YYYY-MM-DD / HH:MM)
 * - Speicherung final: DD.MM.YYYY / HH.MM
 * ------------------------------------------------- */

function normalizeFoundAtForValidation(input) {
  const out = { ...input };
  const fa = { ...(out.foundAt || {}) };

  // tolerant lesen
  const isoDate = normalizeDateToIsoLoose(fa.date);
  const isoTime = normalizeTimeToIsoLoose(fa.time);

  // validator bekommt ISO
  if ("date" in fa) fa.date = isoDate;
  if ("time" in fa) fa.time = isoTime;

  out.foundAt = fa;
  return out;
}

function formatFoundAtDisplay(input) {
  const out = { ...input };
  const fa = { ...(out.foundAt || {}) };

  // value kann aus Validator kommen (ISO), oder bereits was anderes
  const isoDate = normalizeDateToIsoLoose(fa.date);
  const isoTime = normalizeTimeToIsoLoose(fa.time);

  fa.date = isoToDdMmYyyy(isoDate) || (fa.date ?? "");
  fa.time = isoTimeToHhDotMm(isoTime) || (fa.time ?? "");

  out.foundAt = fa;
  return out;
}

// akzeptiert: YYYY-MM-DD oder DD.MM.YYYY oder D.M.YY oder D/M/YYYY etc.
function normalizeDateToIsoLoose(v) {
  const s = (v ?? "").toString().trim();
  if (!s) return s;

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // DD.MM.YYYY / D.M.YY / mit .-/ gemischt
  const m = s.match(/^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{2,4})$/);
  if (!m) return s;

  let dd = Number(m[1]);
  let mm = Number(m[2]);
  let yy = Number(m[3]);

  if (!Number.isFinite(dd) || !Number.isFinite(mm) || !Number.isFinite(yy)) return s;

  if (yy < 100) yy = 2000 + yy; // CH-Usecase (26 -> 2026)
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return s;

  return `${String(yy).padStart(4, "0")}-${String(mm).padStart(2, "0")}-${String(dd).padStart(
    2,
    "0"
  )}`;
}

// akzeptiert: HH:MM, HH.MM, "1450", "930", "9", "14.5"
function normalizeTimeToIsoLoose(v) {
  const s0 = (v ?? "").toString().trim();
  if (!s0) return s0;

  // HH:MM
  if (/^\d{1,2}:\d{2}$/.test(s0)) {
    const [h, m] = s0.split(":").map((x) => Number(x));
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
      return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    }
    return s0;
  }

  // HH.MM (mit Punkt)
  if (/^\d{1,2}\.\d{1,2}$/.test(s0)) {
    const [hS, mS] = s0.split(".");
    const h = Number(hS);
    const m = Number(mS);
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
      return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    }
    return s0;
  }

  // "14.5" -> 14:05
  const dot = s0.replace(",", ".").match(/^(\d{1,2})\.(\d{1,2})$/);
  if (dot) {
    const h = Number(dot[1]);
    const m = Number(dot[2]);
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
      return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    }
    return s0;
  }

  // "1450" / "930" / "9"
  if (/^\d{1,4}$/.test(s0)) {
    const n = s0.padStart(4, "0");
    const h = Number(n.slice(0, 2));
    const m = Number(n.slice(2, 4));
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
      return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    }
  }

  return s0;
}

function isoToDdMmYyyy(iso) {
  const s = (iso ?? "").toString().trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m, d] = s.split("-");
  return `${d}.${m}.${y}`;
}

function ddmmyyyyToIso(ddmmyyyy) {
  const s = (ddmmyyyy ?? "").toString().trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s; // falls doch mal ISO
  const m = s.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!m) return null;
  const dd = m[1];
  const mm = m[2];
  const yy = m[3];
  return `${yy}-${mm}-${dd}`;
}

function isoTimeToHhDotMm(isoTime) {
  const s = (isoTime ?? "").toString().trim();
  if (!/^\d{2}:\d{2}$/.test(s) && !/^\d{1,2}:\d{2}$/.test(s)) return null;
  const [hS, mS] = s.split(":");
  const h = String(Number(hS)).padStart(2, "0");
  const m = String(Number(mS)).padStart(2, "0");
  return `${h}.${m}`;
}

/* -------------------------------------------------
 * NUMMERIERUNG
 * - Fundnummer: YYYY-00001 (pro Jahr neuer Zähler)
 * - Quittungen: Q-YYYY-NNNN
 * - Kasse:      K-YYYY-NNNNN
 * ------------------------------------------------- */

function normalizeAmount(amount) {
  if (amount === null || amount === undefined) return null;
  const s = String(amount).trim();
  if (!s) return null;
  const n = Number(s);
  if (Number.isNaN(n)) return null;
  return n;
}

function getCounters() {
  const obj = storage.getJson(KEY_COUNTERS, {});
  return obj && typeof obj === "object" && !Array.isArray(obj) ? obj : {};
}

function setCounters(obj) {
  storage.setJson(KEY_COUNTERS, obj && typeof obj === "object" ? obj : {});
}

function nextReceiptId(isoNow) {
  const year = String(isoNow).slice(0, 4);
  const key = `receipt:${year}`;

  const counters = getCounters();
  const current = Number(counters[key] || 0);
  const next = current + 1;

  counters[key] = next;
  setCounters(counters);

  const nnnn = String(next).padStart(4, "0");
  return `Q-${year}-${nnnn}`;
}

/**
 * ✅ NEU: Kassenbuch-ID
 */
function nextCashbookId(isoNow) {
  const year = String(isoNow).slice(0, 4);
  const key = `cashbook:${year}`;

  const counters = getCounters();
  const current = Number(counters[key] || 0);
  const next = current + 1;

  counters[key] = next;
  setCounters(counters);

  const nnnnn = String(next).padStart(5, "0");
  return `K-${year}-${nnnnn}`;
}

/**
 * ✅ Peek: nächste Fundnummer (ohne Counter++)
 */
function peekFundNo(isoNow, existingRecords = []) {
  const year = String(isoNow).slice(0, 4);
  const key = `fundNo:${year}`;

  const counters = getCounters();
  let n = Number(counters[key] || 0);

  while (true) {
    const candidate = `${year}-${String(n + 1).padStart(5, "0")}`;
    const exists = existingRecords.some((r) => (r?.fundNo ?? "").toString().trim() === candidate);
    if (!exists) return candidate;
    n += 1;
  }
}

/**
 * ✅ Fundnummern-Generator (verbraucht Counter)
 * - pro Jahr neuer Zähler
 * - safety: prüft existierende Records
 */
function nextFundNo(isoNow, existingRecords = []) {
  const year = String(isoNow).slice(0, 4);
  const key = `fundNo:${year}`;

  const counters = getCounters();
  let n = Number(counters[key] || 0);

  while (true) {
    n += 1;
    const fundNo = `${year}-${String(n).padStart(5, "0")}`;

    const exists = existingRecords.some((r) => (r?.fundNo ?? "").toString().trim() === fundNo);
    if (!exists) {
      counters[key] = n;
      setCounters(counters);
      return fundNo;
    }
  }
}

/**
 * Normalisiert Fundnummern-Strings, wenn jemand sie manuell schreibt.
 * Akzeptiert:
 * - "2026-1" -> "2026-00001"
 * - "2026-00001" bleibt
 */
function normalizeFundNo(input) {
  const s = (input ?? "").toString().trim();
  if (!s) return s;

  const m = s.match(/^(\d{4})-(\d+)$/);
  if (!m) return s;

  const year = m[1];
  const n = Number(m[2]);
  if (!Number.isFinite(n) || n <= 0) return s;

  return `${year}-${String(n).padStart(5, "0")}`;
}

/* -------------------------------------------------
 * CASHBOOK – Hashing (tamper-evident)
 * Hinweis: kein Kryptobeweis, aber Manipulationen werden erkennbar.
 * ------------------------------------------------- */

function computeLedgerHash(entry, prevHash) {
  const payload = stableLedgerPayload(entry, prevHash);
  return fnv1a32Hex(payload);
}

function stableLedgerPayload(e, prevHash) {
  // Wichtig: deterministisch & ohne "hash" selbst
  const obj = {
    id: e?.id || "",
    createdAt: e?.createdAt || "",
    type: e?.type || "",
    amountCents: Number(e?.amountCents || 0) || 0,
    fundId: e?.fundId || "",
    fundNo: e?.fundNo || "",
    label: e?.label || "",
    description: e?.description || "",
    caseWorker: e?.caseWorker || "",
    reason: e?.reason || "",
    prevHash: prevHash || "",
  };
  return JSON.stringify(obj);
}

// FNV-1a 32-bit (schnell, synchron, ausreichend für "tamper-evident" im UI-Kontext)
function fnv1a32Hex(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    // h *= 16777619 (mit bit-ops)
    h = (h + (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24)) >>> 0;
  }
  return ("00000000" + h.toString(16)).slice(-8);
}
