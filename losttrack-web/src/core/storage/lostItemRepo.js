// src/core/storage/lostItemRepo.js

import { storage } from "./storage.js";
import { validateLostItem, VALIDATION_MODE } from "../../domain/lostItem.validators.js";
import { getCurrentUserName } from "../auth/auth.js";

/**
 * Storage Keys (versioniert) – getrennt für Revisionssicherheit
 */
const STORAGE_VERSION = "v1";

const KEY_RECORDS = `lostItems.records.${STORAGE_VERSION}`; // definitiv erfasste Fundsachen
const KEY_DRAFTS = `lostItems.drafts.${STORAGE_VERSION}`; // Entwürfe / Vorschau
const KEY_AUDIT = `lostItems.audit.${STORAGE_VERSION}`; // append-only Log
const KEY_COUNTERS = `lostItems.counters.${STORAGE_VERSION}`; // Zähler (z.B. Quittungen, Fundnummern)

// ✅ Kassenbuch (append-only)
const KEY_CASHBOOK = `lostItems.cashbook.${STORAGE_VERSION}`; // append-only Kassenbuch

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
 * ✅ Kassenbuch lesen (append-only)
 */
export function listCashbookEntries() {
  const list = storage.getJson(KEY_CASHBOOK, []);
  return Array.isArray(list) ? list : [];
}

/**
 * ✅ Kassenbuch Hash-Kette prüfen (Manipulation erkennbar)
 */
export function verifyCashbookChain() {
  const entries = listCashbookEntries();
  let prevHash = "GENESIS";

  for (let i = 0; i < entries.length; i++) {
    const e = entries[i] || {};
    if ((e.prevHash || "") !== prevHash) {
      return { ok: false, error: "prevHash mismatch", badIndex: i };
    }

    const expected = computeLedgerHash(e, prevHash);
    if ((e.hash || "") !== expected) {
      return { ok: false, error: "hash mismatch", badIndex: i };
    }

    prevHash = expected;
  }

  return { ok: true };
}

/**
 * ✅ Summen im Zeitraum (ISO strings)
 */
export function getCashbookTotals({ fromIso = "", toIso = "" } = {}) {
  const from = (fromIso || "").trim();
  const to = (toIso || "").trim();

  const inRange = (iso) => {
    const s = (iso || "").toString();
    if (!s) return false;
    if (from && s < from) return false;
    if (to && s > to) return false;
    return true;
  };

  let inCents = 0;
  let outCents = 0;
  let count = 0;

  for (const e of listCashbookEntries()) {
    if (!inRange(e.createdAt)) continue;
    const cents = Number(e.amountCents || 0) || 0;
    const t = String(e.type || "").toUpperCase();
    if (t === "IN") inCents += cents;
    if (t === "OUT") outCents += cents;
    count += 1;
  }

  return { inCents, outCents, balanceCents: inCents - outCents, count };
}

/**
 * ✅ Buchung schreiben (append-only)
 * actor/caseWorker werden automatisch aus Login gezogen, falls nicht übergeben.
 *
 * amountCents: integer, z.B. CHF 12.50 => 1250
 */
export function postCashbookEntry({
  type, // "IN" | "OUT"
  amountCents,
  item, // LostItem (Record)
  reason = null,
  caseWorker = null,
  actor = null,
} = {}) {
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

  const by = (actor ?? getCurrentUserName() ?? "").toString().trim() || null;
  const cw =
    (caseWorker ?? getCurrentUserName() ?? item?.caseWorker ?? "")
      ?.toString?.()
      ?.trim?.() || null;

  const entry = {
    id: nextCashbookId(now),
    createdAt: now,
    type: t,
    amountCents: cents,

    fundId: item.id,
    fundNo: fundNo || null,
    label: label || null,
    description: description || null,

    caseWorker: cw,
    reason: (reason ?? "").toString().trim() || null,

    prevHash,
    hash: "",
  };

  entry.hash = computeLedgerHash(entry, prevHash);

  storage.setJson(KEY_CASHBOOK, [...entries, entry]);

  // ✅ Audit dazu (append-only)
  appendAudit({
    type: "CASHBOOK_POSTED",
    fundNo: fundNo || null,
    actor: by,
    snapshot: {
      ledgerId: entry.id,
      ledgerType: entry.type,
      amountCents: entry.amountCents,
      actor: by,
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
 * ✅ Finderlohn-Auszahlung:
 * - schreibt OUT ins Kassenbuch
 * - sperrt Doppelzahlung über item.finderRewardPayout.paid
 * - markiert die Fundsache (persistiert im Record)
 */
export function payFinderReward({
  id, // fundId
  amountCents,
  reason = "Finderlohn-Abholung",
  actor = null,
  caseWorker = null,
} = {}) {
  if (!id) return { ok: false, error: "Missing id" };

  const item = getLostItemById(id);
  if (!item) return { ok: false, error: "Not found" };

  // ✅ Doppelzahlung sperren (Record-Flag)
  if (item?.finderRewardPayout?.paid === true) {
    return { ok: false, error: "Finderlohn wurde bereits ausbezahlt (Doppelzahlung gesperrt)." };
  }

  const res = postCashbookEntry({
    type: "OUT",
    amountCents,
    item,
    reason,
    actor: actor ?? getCurrentUserName() ?? null,
    caseWorker: caseWorker ?? getCurrentUserName() ?? item?.caseWorker ?? null,
  });

  if (!res.ok) return res;

  // ✅ Fundsache markieren (Sperre)
  const now = new Date().toISOString();
  const updated = normalizeOne({
    ...item,
    finderRewardPayout: {
      paid: true,
      paidAt: now,
      amountCents: Number(amountCents) || 0,
      ledgerId: res.entry?.id || null,
      reason: (reason ?? "").toString().trim() || null,
      actor: (actor ?? getCurrentUserName() ?? "").toString().trim() || null,
    },
    updatedAt: now,
  });

  persistRecord(updated);

  appendAudit({
    type: "FINDER_REWARD_PAID",
    fundNo: updated.fundNo || null,
    snapshot: {
      id: updated.id,
      fundNo: updated.fundNo || null,
      amountCents: updated.finderRewardPayout?.amountCents || 0,
      ledgerId: updated.finderRewardPayout?.ledgerId || null,
      actor: updated.finderRewardPayout?.actor || null,
      at: now,
    },
    diff: null,
    actor: updated.finderRewardPayout?.actor || null,
  });

  return { ok: true, entry: res.entry, item: updated };
}

/**
 * Optional:
 * IN-Buchung (Eigentümer zahlt Finderlohn ein / hinterlegt Betrag).
 */
export function receiveOwnerReward({
  id, // fundId
  amountCents,
  reason = "Finderlohn-Einzahlung (Eigentümer)",
  actor = null,
  caseWorker = null,
} = {}) {
  if (!id) return { ok: false, error: "Missing id" };

  const item = getLostItemById(id);
  if (!item) return { ok: false, error: "Not found" };

  return postCashbookEntry({
    type: "IN",
    amountCents,
    item,
    reason,
    actor: actor ?? getCurrentUserName() ?? null,
    caseWorker: caseWorker ?? getCurrentUserName() ?? item?.caseWorker ?? null,
  });
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
 */
export function peekNextFundNo() {
  const now = new Date().toISOString();
  const records = storage.getJson(KEY_RECORDS, []);
  return peekFundNo(now, records);
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
  const dt = (q.dateTo || "").trim(); // YYYY-MM-DD

  const toIsoDateForCompare = (storedDate) => ddmmyyyyToIso(storedDate) || "";

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
    actor,
  });

  return { ok: true, item: updated };
}

/* -------------------------------------------------
 * WRITE – UPDATE (EDIT-MODE)
 * ------------------------------------------------- */

export function updateLostItem(input, { actor = null } = {}) {
  const normalizedInput = normalizeFoundAtForValidation(input);
  const { ok, value, errors } = validateLostItem(normalizedInput, { mode: VALIDATION_MODE.COMMIT });

  if (!ok) return { ok: false, errors };
  if (!value.id) return { ok: false, errors: { id: "Fehlende ID." } };

  const existing = getLostItemById(value.id);
  if (!existing) return { ok: false, errors: { id: "Datensatz nicht gefunden." } };

  const now = new Date().toISOString();
  const before = slimSnapshot(existing);

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

    collectorSameAsFinder:
      typeof formattedValue.collectorSameAsFinder === "boolean"
        ? formattedValue.collectorSameAsFinder
        : existing.collectorSameAsFinder,

    receipts: Array.isArray(existing.receipts) ? existing.receipts : [],

    // ✅ payout-Flag immer behalten
    finderRewardPayout: existing.finderRewardPayout ?? null,

    updatedAt: now,
  });

  const after = slimSnapshot(updated);

  const records = storage.getJson(KEY_RECORDS, []);
  const nextRecords = upsertById(records, updated);
  storage.setJson(KEY_RECORDS, nextRecords);

  appendAudit({
    type: "ITEM_UPDATED",
    fundNo: updated.fundNo || null,
    snapshot: { id: updated.id, actor, at: now, before, after },
    diff: diffSnapshots(before, after),
    actor,
  });

  return { ok: true, item: updated };
}

/* -------------------------------------------------
 * WRITE – DRAFT
 * ------------------------------------------------- */

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
    snapshot: { id: draft.id, actor, at: new Date().toISOString(), before, after },
    diff: before ? diffSnapshots(before, after) : null,
    actor,
  });

  return { item: draft, errors };
}

/* -------------------------------------------------
 * WRITE – COMMIT (NEU)
 * ------------------------------------------------- */

export function commitLostItem(input, { actor = null } = {}) {
  const normalizedInput = normalizeFoundAtForValidation(input);
  const { ok, value, errors } = validateLostItem(normalizedInput, { mode: VALIDATION_MODE.COMMIT });
  if (!ok) return { ok: false, errors };

  let record = normalizeOne({ ...value });
  if (!record.id) record.id = cryptoId();

  const logged = getCurrentUserName();
  if (!record.caseWorker) record.caseWorker = logged || record.caseWorker || null;

  record = formatFoundAtDisplay(record);

  const now = new Date().toISOString();
  const records = storage.getJson(KEY_RECORDS, []);

  const inNo = (record.fundNo ?? "").toString().trim();
  const fundNoExists = inNo ? records.some((r) => (r?.fundNo ?? "").toString().trim() === inNo) : false;
  const needsFundNo = !inNo || fundNoExists;

  if (needsFundNo) {
    record = { ...record, fundNo: nextFundNo(now, records) };
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
    snapshot: { id: record.id, actor, at: now, after },
    diff: null,
    actor,
  });

  return { ok: true, item: record };
}

/* -------------------------------------------------
 * WRITE – QUITTUNGEN (Metadaten + Audit)
 * ------------------------------------------------- */

/**
 * createReceipt:
 * ✅ optional finderRewardPayout:
 *   { enabled: boolean, amountCents: number, reason?: string }
 * Wenn enabled=true, wird VOR dem Receipt automatisch payFinderReward ausgeführt.
 */
export function createReceipt({
  id,
  receiptType,
  recipient,
  amount = null,
  actor = null,
  notes = null,

  // ✅ NEU: Finderlohn-Abholung -> Kassenbuch OUT
  finderRewardPayout = null,
} = {}) {
  if (!id) return { ok: false, error: "Missing id" };
  if (!receiptType) return { ok: false, error: "Missing receiptType" };

  let current = getLostItemById(id);
  if (!current) return { ok: false, error: "Not found" };

  // ✅ Wenn Finderlohn-Abholung aktiv: zuerst ins Kassenbuch schreiben (und Doppelzahlung sperren)
  let cashbookInfo = null;
  if (finderRewardPayout && finderRewardPayout.enabled === true) {
    const cents = Number(finderRewardPayout.amountCents);
    if (!Number.isFinite(cents) || cents <= 0 || Math.floor(cents) !== cents) {
      return { ok: false, error: "Ungültiger Finderlohn-Betrag (amountCents)." };
    }

    const payoutRes = payFinderReward({
      id,
      amountCents: cents,
      reason: finderRewardPayout.reason || "Finderlohn-Abholung",
      actor: actor ?? getCurrentUserName() ?? null,
      caseWorker: getCurrentUserName() ?? current?.caseWorker ?? null,
    });

    if (!payoutRes.ok) {
      // Doppelzahlung / Fehler -> blockieren (damit nicht ohne Buchung gedruckt wird)
      return payoutRes;
    }

    cashbookInfo = {
      ledgerId: payoutRes.entry?.id || null,
      amountCents: cents,
      reason: finderRewardPayout.reason || "Finderlohn-Abholung",
    };

    current = payoutRes.item; // bereits persistiert, aber wir arbeiten weiter mit aktuellem Stand
  }

  const now = new Date().toISOString();
  const before = slimSnapshot(current);

  const receiptId = nextReceiptId(now);
  const printedBy = (actor ?? getCurrentUserName() ?? "").toString().trim() || "System";

  const receipt = {
    id: receiptId,
    type: String(receiptType).toUpperCase(),
    recipient: (recipient ?? "").toString().trim(),
    amount: normalizeAmount(amount),
    notes: notes ? String(notes) : null,
    printedAt: now,
    printedBy,

    // ✅ Referenz zur Kassenbuchbuchung (falls vorhanden)
    cashbook: cashbookInfo,
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
    snapshot: { id: updated.id, receipt, actor: printedBy, at: now, before, after },
    diff: diffSnapshots(before, after),
    actor: printedBy,
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

  const newStep = { id: cryptoId(), at, who, what };
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
    snapshot: { id: updated.id, step: newStep, actor, at: now, before, after },
    diff: diffSnapshots(before, after),
    actor,
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
  if (afterSteps.length === beforeSteps.length) return { ok: false, error: "Step not found" };

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
    snapshot: { id: updated.id, stepId, step: stepDeleted, actor, at: now, before, after },
    diff: diffSnapshots(before, after),
    actor,
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
    snapshot: { id: updated.id, finder: updated.finder, actor, at: now, before, after },
    diff: diffSnapshots(before, after),
    actor,
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
    snapshot: { id: updated.id, owner: updated.owner, actor, at: now, before, after },
    diff: diffSnapshots(before, after),
    actor,
  });

  appendAutoInvestigationStep(updated, actor, buildAutoText("Eigentümer", clean));

  return { ok: true, item: updated };
}

export function updateCollector({ id, collector, sameAsFinder = false, actor = null }) {
  if (!id) return { ok: false, error: "Missing id" };

  const current = getLostItemById(id);
  if (!current) return { ok: false, error: "Not found" };

  const now = new Date().toISOString();
  const before = slimSnapshot(current);

  let nextCollector = null;

  if (sameAsFinder) {
    const f = current?.finder;
    if (!f) return { ok: false, error: "Finder ist leer. Bitte zuerst Finder erfassen." };
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
    actor,
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
 * ✅ Wenn actor nicht übergeben, wird automatisch Login-User gesetzt
 */
function appendAudit(event) {
  const log = storage.getJson(KEY_AUDIT, []);
  const autoActor = (getCurrentUserName() || "System").toString().trim() || "System";

  const e = { ...event };
  if (!e.actor) e.actor = autoActor;

  if (e.snapshot && typeof e.snapshot === "object" && e.snapshot !== null) {
    if (!("actor" in e.snapshot) || !e.snapshot.actor) {
      e.snapshot = { ...e.snapshot, actor: e.actor };
    }
  }

  log.push({
    id: cryptoId(),
    at: new Date().toISOString(),
    ...e,
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
    collectorSameAsFinder: !!item.collectorSameAsFinder,

    // ✅ neu: payout snapshot
    finderRewardPayout: item?.finderRewardPayout || null,

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
          cashbook: r?.cashbook ?? null,
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
    if (typeof a === "number" && typeof b === "number" && Number.isNaN(a) && Number.isNaN(b)) return true;
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

      if (aa.length !== bb.length) changes.push({ path: `${path}.length`, from: aa.length, to: bb.length });

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
  if (!("collectorSameAsFinder" in out)) out.collectorSameAsFinder = false;

  // ✅ NEU: Finderlohn-Auszahlung (Sperre)
  if (!("finderRewardPayout" in out)) out.finderRewardPayout = null;

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
  const who = (actor ?? "").toString().trim() || getCurrentUserName() || "System";

  const now = new Date().toISOString();
  const newStep = { id: cryptoId(), at: now, who, what };

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
    snapshot: { id: updated.id, step: newStep, actor: who, at: now, before, after },
    diff: diffSnapshots(before, after),
    actor: who,
  });
}

function buildAutoText(roleLabel, p) {
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
 * ------------------------------------------------- */

function normalizeFoundAtForValidation(input) {
  const out = { ...input };
  const fa = { ...(out.foundAt || {}) };

  const isoDate = normalizeDateToIsoLoose(fa.date);
  const isoTime = normalizeTimeToIsoLoose(fa.time);

  if ("date" in fa) fa.date = isoDate;
  if ("time" in fa) fa.time = isoTime;

  out.foundAt = fa;
  return out;
}

function formatFoundAtDisplay(input) {
  const out = { ...input };
  const fa = { ...(out.foundAt || {}) };

  const isoDate = normalizeDateToIsoLoose(fa.date);
  const isoTime = normalizeTimeToIsoLoose(fa.time);

  fa.date = isoToDdMmYyyy(isoDate) || (fa.date ?? "");
  fa.time = isoTimeToHhDotMm(isoTime) || (fa.time ?? "");

  out.foundAt = fa;
  return out;
}

function normalizeDateToIsoLoose(v) {
  const s = (v ?? "").toString().trim();
  if (!s) return s;

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  const m = s.match(/^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{2,4})$/);
  if (!m) return s;

  let dd = Number(m[1]);
  let mm = Number(m[2]);
  let yy = Number(m[3]);

  if (!Number.isFinite(dd) || !Number.isFinite(mm) || !Number.isFinite(yy)) return s;

  if (yy < 100) yy = 2000 + yy;
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return s;

  return `${String(yy).padStart(4, "0")}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
}

function normalizeTimeToIsoLoose(v) {
  const s0 = (v ?? "").toString().trim();
  if (!s0) return s0;

  if (/^\d{1,2}:\d{2}$/.test(s0)) {
    const [h, m] = s0.split(":").map((x) => Number(x));
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    return s0;
  }

  if (/^\d{1,2}\.\d{1,2}$/.test(s0)) {
    const [hS, mS] = s0.split(".");
    const h = Number(hS);
    const m = Number(mS);
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    return s0;
  }

  const dot = s0.replace(",", ".").match(/^(\d{1,2})\.(\d{1,2})$/);
  if (dot) {
    const h = Number(dot[1]);
    const m = Number(dot[2]);
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    return s0;
  }

  if (/^\d{1,4}$/.test(s0)) {
    const n = s0.padStart(4, "0");
    const h = Number(n.slice(0, 2));
    const m = Number(n.slice(2, 4));
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
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
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

function isoTimeToHhDotMm(isoTime) {
  const s = (isoTime ?? "").toString().trim();
  if (!/^\d{1,2}:\d{2}$/.test(s)) return null;
  const [hS, mS] = s.split(":");
  const h = String(Number(hS)).padStart(2, "0");
  const m = String(Number(mS)).padStart(2, "0");
  return `${h}.${m}`;
}

/* -------------------------------------------------
 * NUMMERIERUNG
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

  return `Q-${year}-${String(next).padStart(4, "0")}`;
}

function nextCashbookId(isoNow) {
  const year = String(isoNow).slice(0, 4);
  const key = `cashbook:${year}`;

  const counters = getCounters();
  const current = Number(counters[key] || 0);
  const next = current + 1;

  counters[key] = next;
  setCounters(counters);

  return `K-${year}-${String(next).padStart(4, "0")}`;
}

function peekFundNo(isoNow, existingRecords = []) {
  const year = String(isoNow).slice(0, 4);
  const counters = getCounters();
  let n = Number(counters[`fundNo:${year}`] || 0);

  while (true) {
    const candidate = `${year}-${String(n + 1).padStart(5, "0")}`;
    const exists = existingRecords.some((r) => (r?.fundNo ?? "").toString().trim() === candidate);
    if (!exists) return candidate;
    n += 1;
  }
}

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
 * KASSENBUCH – Hash-Kette
 * ------------------------------------------------- */

function fnv1a32Hex(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h + (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24)) >>> 0;
  }
  return ("00000000" + h.toString(16)).slice(-8);
}

function computeLedgerHash(entry, prevHash) {
  const payload = {
    prevHash: prevHash || "GENESIS",
    id: entry?.id || "",
    createdAt: entry?.createdAt || "",
    type: entry?.type || "",
    amountCents: Number(entry?.amountCents || 0) || 0,

    fundId: entry?.fundId || "",
    fundNo: entry?.fundNo || "",
    label: entry?.label || "",
    description: entry?.description || "",

    caseWorker: entry?.caseWorker || "",
    reason: entry?.reason || "",
  };

  return fnv1a32Hex(JSON.stringify(payload));
}
