import { storage } from "./storage.js";
import { getLostItemById, computeLedgerHash, verifyCashbookChain } from "./lostItemRepo.js";
import { hasPermission, getCurrentUserName } from "../auth/auth.js";
import { normalizeWorkflow, getWorkflowSummary, validateWorkflowPlan, validateStoredWorkflow } from "../../domain/workflow.js";

const RECORDS = "lostItems.records.v1";
const AUDIT = "lostItems.audit.v1";
const CASHBOOK = "lostItems.cashbook.v1";
const CATEGORIES = ["FEE", "REWARD", "EXPENSES"];
const HANDOVERS = ["OWNER_HANDOVER", "FINDER_HANDOVER", "TRANSFER"];
const TYPES = { OWNER_HANDOVER: "OWNER_RECEIPT", FINDER_HANDOVER: "FINDER_RECEIPT",
  TRANSFER: "TRANSFER_RECEIPT", PAYMENT: "PAYMENT_RECEIPT", FUND: "FUND_RECEIPT" };
// Nur flüchtige Druckaufträge: Abbruch/Neuladen verändert keinen Datensatz.
const pendingJobs = new Map();
const clone = (value) => structuredClone(value);
const failure = (error) => ({ ok: false, error });

function requirePermission(action) {
  if (!hasPermission(action)) throw new Error("Keine Berechtigung für diesen Vorgang.");
}
function load(id, { closedAllowed = false } = {}) {
  const item = getLostItemById(id);
  if (!item) throw new Error("Fundsache nicht gefunden.");
  const check = validateStoredWorkflow(item);
  if (!check.ok) throw new Error(check.error);
  if (!closedAllowed && item.workflow?.closedAt) throw new Error("Der Vorgang ist abgeschlossen. Bitte zuerst mit Begründung wieder öffnen.");
  return item;
}

function auditSnapshot(item) {
  return { id: item.id, status: item.status, workflow: clone(item.workflow || null), updatedAt: item.updatedAt };
}

function persist(before, after, type, { ledger = null, detail = {} } = {}) {
  const actor = getCurrentUserName();
  const now = new Date().toISOString();
  const records = storage.getJson(RECORDS, []);
  const index = records.findIndex((item) => item.id === before.id);
  if (index < 0 || JSON.stringify(getLostItemById(before.id)) !== JSON.stringify(before)) {
    throw new Error("Der Vorgang wurde zwischenzeitlich geändert. Bitte neu laden.");
  }
  const next = { ...after, updatedAt: now };
  const check = validateStoredWorkflow(next);
  if (!check.ok) throw new Error(check.error);
  records[index] = next;
  const log = storage.getJson(AUDIT, []);
  log.push({ id: crypto.randomUUID(), at: now, type, fundNo: next.fundNo, actor,
    snapshot: { id: next.id, actor, before: auditSnapshot(before), after: auditSnapshot(next), ...detail },
    diff: [{ path: "workflow", from: before.workflow || null, to: next.workflow || null }] });
  const writes = [[RECORDS, records], [AUDIT, log]];
  if (ledger) writes.push([CASHBOOK, ledger]);
  const previous = writes.map(([key]) => [key, localStorage.getItem(`losttrack:${key}`)]);
  try {
    for (const [key, value] of writes) storage.setJson(key, value);
  } catch {
    try {
      for (const [key, raw] of previous) {
        if (raw === null) localStorage.removeItem(`losttrack:${key}`);
        else localStorage.setItem(`losttrack:${key}`, raw);
      }
    } catch {
      throw new Error("Speicherfehler; auch das Zurücksetzen ist fehlgeschlagen. Nicht weiterarbeiten und die letzte Sicherung aufbewahren.");
    }
    throw new Error("Speichern fehlgeschlagen. Der vorherige Datenstand wurde wieder eingesetzt.");
  }
  return next;
}

function printSnapshot(item) {
  return clone({ id: item.id, fundNo: item.fundNo, item: item.item, foundAt: item.foundAt,
    caseWorker: item.caseWorker, finder: item.finder, owner: item.owner, collector: item.collector });
}

function selectedParts(workflow, selections, kind) {
  if (!Array.isArray(selections)) throw new Error("Bitte die herauszugebenden Gegenstände auswählen.");
  if (!HANDOVERS.includes(kind) && selections.length) throw new Error("Eine reine Zahlungs- oder Fundquittung ist keine Herausgabe.");
  if (HANDOVERS.includes(kind) && !selections.length) throw new Error("Bitte mindestens einen Gegenstand zur Übergabe auswählen.");
  const ids = new Set();
  return selections.map(({ partId, quantity }) => {
    const part = workflow.parts.find((entry) => entry.id === partId);
    if (!part || ids.has(partId) || !Number.isSafeInteger(quantity) || quantity <= 0 || quantity > part.quantity - part.handledQuantity) {
      throw new Error("Die ausgewählten Gegenstände oder Mengen sind nicht mehr verfügbar.");
    }
    ids.add(partId);
    return { partId, label: part.label, quantity, feeCode: part.feeCode,
      feeCents: part.feeSnapshot?.cents ?? null, feeLabel: part.feeSnapshot?.label || "Gebühr ungeklärt" };
  });
}

function stagePayments(workflow, selections) {
  if (!Array.isArray(selections) || selections.length > 6) throw new Error("Ungültige Zahlungspositionen.");
  const payments = clone(workflow.payments);
  const seen = new Set();
  // Eingänge zuerst: Auszahlungen dürfen vorhandenes Guthaben nicht überschreiten.
  const ordered = [...selections].sort((a, b) => (a.type === "IN" ? 0 : 1) - (b.type === "IN" ? 0 : 1));
  for (const line of ordered) {
    const { category, type, amountCents } = line;
    const key = `${category}:${type}`;
    if (!CATEGORIES.includes(category) || !["IN", "OUT"].includes(type) || seen.has(key) ||
      !Number.isSafeInteger(amountCents) || amountCents <= 0) throw new Error("Ungültiger Zahlungsbetrag oder doppelte Zahlungsposition.");
    seen.add(key);
    const state = payments[category];
    if (state.dueCents === null) throw new Error("Bitte zuerst den Sollbetrag dieser Zahlungsart klären.");
    if (category === "EXPENSES" && workflow.expensesRecipient === "UNSET") {
      throw new Error("Bitte zuerst den Empfänger des Auslagenersatzes festlegen.");
    }
    if (type === "IN") {
      if (state.receivedCents + amountCents > state.dueCents) throw new Error("Die Einzahlung übersteigt den offenen Sollbetrag.");
      state.receivedCents += amountCents;
    } else {
      if (category === "FEE" || (category === "EXPENSES" && workflow.expensesRecipient === "OFFICE")) {
        throw new Error("Für diese Zahlungsart ist keine Auszahlung an den Finder vorgesehen.");
      }
      if (state.paidCents + amountCents > state.dueCents || state.paidCents + amountCents > state.receivedCents) {
        throw new Error("Die Auszahlung übersteigt den offenen Betrag oder das tatsächlich eingezahlte Guthaben.");
      }
      state.paidCents += amountCents;
    }
  }
  return { payments, lines: ordered.map(({ category, type, amountCents }) => ({ category, type, amountCents })) };
}

export function saveWorkflowPlan({ id, ...plan }) {
  try {
    requirePermission("ITEM_EDIT");
    const before = load(id);
    const result = validateWorkflowPlan(before, plan);
    if (!result.ok) return result;
    const item = persist(before, { ...before, workflow: result.workflow }, "WORKFLOW_PLAN_UPDATED");
    return { ok: true, item };
  } catch (err) { return failure(err.message); }
}

export function prepareWorkflowReceipt({ id, kind, recipient = "", parts = [], payments = [], reason = "" }) {
  try {
    requirePermission("RECEIPT_PRINT");
    const item = load(id);
    if (!Object.hasOwn(TYPES, kind)) throw new Error("Ungültige Quittungsart.");
    if (HANDOVERS.includes(kind)) requirePermission("ITEM_EDIT");
    if (payments.length) requirePermission("CASHBOOK_POST");
    const workflow = normalizeWorkflow(item);
    if (HANDOVERS.includes(kind) && (workflow.blockedReason || workflow.decisionOpen)) {
      throw new Error("Herausgabe gesperrt: Bitte zuerst die Sperre oder offene Entscheidung klären.");
    }
    if (!String(recipient).trim()) throw new Error("Bitte Empfänger beziehungsweise zahlende Person angeben.");
    if (HANDOVERS.includes(kind) && CATEGORIES.some((key) => workflow.payments[key].dueCents === null)) {
      throw new Error("Bitte vor der Herausgabe Gebühren, Finderlohn und Auslagenersatz klären (gegebenenfalls ausdrücklich CHF 0).");
    }
    if (kind === "PAYMENT" && !payments.length) throw new Error("Bitte mindestens eine Zahlung angeben.");
    if (kind === "FUND" && payments.length) throw new Error("Eine Fundannahmequittung enthält keine Zahlungsbuchung.");
    if (kind === "OWNER_HANDOVER" && payments.some((payment) => payment.type === "OUT")) {
      throw new Error("Finderlohn- und Auslagenauszahlungen an den Finder bitte über eine eigene Zahlungsquittung mit dem tatsächlichen Empfänger bestätigen.");
    }
    const receiptParts = selectedParts(workflow, parts, kind);
    const staged = stagePayments(workflow, payments);
    const receiptId = `Q-${new Date().getFullYear()}-${crypto.randomUUID()}`;
    const receipt = { id: receiptId, type: TYPES[kind], workflowKind: kind,
      recipient: String(recipient).trim(), printedAt: new Date().toISOString(), printedBy: getCurrentUserName(),
      parts: receiptParts, payments: staged.lines, chargeSnapshot: clone(workflow.payments),
      notes: String(reason).trim(), expensesRecipient: workflow.expensesRecipient,
      itemSnapshot: printSnapshot(item), workflowVersion: 1 };
    const job = { id: receiptId, kind, receipt, item: printSnapshot(item), sourceVersion: JSON.stringify(item) };
    // Ältere abgebrochene Aufträge nicht unbegrenzt im Speicher halten.
    const now = Date.now();
    for (const [key, pending] of pendingJobs) if (now - pending.at > 60 * 60 * 1000) pendingJobs.delete(key);
    if (pendingJobs.size >= 100) pendingJobs.delete(pendingJobs.keys().next().value);
    pendingJobs.set(job.id, { job: clone(job), at: now });
    return { ok: true, job: clone(job), item };
  } catch (err) { return failure(err.message); }
}

export function confirmWorkflowReceipt({ job, confirmed = false } = {}) {
  try {
    requirePermission("RECEIPT_PRINT");
    if (confirmed !== true) throw new Error("Druck und Übergabe beziehungsweise Zahlung müssen ausdrücklich bestätigt werden.");
    if (!job?.id || !job.item?.id) throw new Error("Druckauftrag nicht gefunden. Bitte neu vorbereiten.");
    const before = load(job.item.id, { closedAllowed: true });
    const existing = before.receipts?.find((receipt) => receipt.id === job.id);
    if (existing) return { ok: true, item: before, receipt: clone(existing), alreadyConfirmed: true };
    const pending = pendingJobs.get(job.id);
    if (!pending || JSON.stringify(job) !== JSON.stringify(pending.job)) {
      throw new Error("Der Druckauftrag wurde verändert oder ist nicht mehr vorhanden. Bitte neu vorbereiten.");
    }
    load(before.id);
    if (JSON.stringify(before) !== pending.job.sourceVersion) {
      throw new Error("Der Vorgang wurde seit der Druckvorbereitung geändert. Bitte die Quittung neu vorbereiten und drucken.");
    }
    const { receipt, kind } = pending.job;
    if (HANDOVERS.includes(kind)) requirePermission("ITEM_EDIT");
    if (receipt.payments.length) requirePermission("CASHBOOK_POST");
    const workflow = normalizeWorkflow(before);
    const selected = selectedParts(workflow, receipt.parts, kind);
    const staged = stagePayments(workflow, receipt.payments);
    workflow.payments = staged.payments;
    const now = new Date().toISOString();
    for (const line of selected) workflow.parts.find((part) => part.id === line.partId).handledQuantity += line.quantity;
    if (HANDOVERS.includes(kind)) workflow.movements.push({ id: crypto.randomUUID(), kind,
      receiptId: receipt.id, recipient: receipt.recipient, parts: selected, confirmedAt: now, actor: getCurrentUserName() });
    const receiptRecord = { ...clone(receipt), confirmedAt: now, confirmedBy: getCurrentUserName() };
    let updated = { ...before, workflow, receipts: [...(before.receipts || []), receiptRecord] };
    if (workflow.parts.every((part) => part.handledQuantity === part.quantity) && HANDOVERS.includes(kind)) {
      updated.status = kind === "TRANSFER" ? "TRANSFERRED" : "RETURNED";
    }
    let ledger = storage.getJson(CASHBOOK, []);
    if (!verifyCashbookChain(ledger).ok) throw new Error("Die Kassenbuch-Prüfkette ist beschädigt. Bitte zuerst klären.");
    for (const line of staged.lines) {
      const prevHash = ledger.at(-1)?.hash || "GENESIS";
      const entry = { id: `K-${crypto.randomUUID()}`, createdAt: now, ...line,
        fundId: before.id, fundNo: before.fundNo || null, label: before.item?.manualLabel || before.item?.predefinedKey || null,
        description: before.item?.description || null, caseWorker: getCurrentUserName(),
        reason: receipt.notes || `${line.category === "FEE" ? "Gebühren" : line.category === "REWARD" ? "Finderlohn" : "Auslagenersatz"}: ${receipt.recipient}`,
        receiptId: receipt.id, prevHash, hash: "" };
      entry.hash = computeLedgerHash(entry, prevHash);
      ledger = [...ledger, entry];
      if (line.category === "REWARD" && line.type === "IN") updated.finderRewardDeposit = {
        ...(updated.finderRewardDeposit || {}), received: true, receivedAt: now,
        amountCents: workflow.payments.REWARD.receivedCents, actor: getCurrentUserName(), ledgerId: entry.id, receiptId: receipt.id };
      if (line.category === "REWARD" && line.type === "OUT") updated.finderReward = {
        ...(updated.finderReward || {}), paidAt: now, amountCents: workflow.payments.REWARD.paidCents,
        paidBy: getCurrentUserName(), cashbookId: entry.id, receiptId: receipt.id };
    }
    updated = persist(before, updated, "WORKFLOW_RECEIPT_CONFIRMED", {
      ledger: staged.lines.length ? ledger : null,
      detail: { receiptId: receipt.id, kind, payments: staged.lines, recipient: receipt.recipient },
    });
    pendingJobs.delete(job.id);
    return { ok: true, item: updated, receipt: receiptRecord };
  } catch (err) { return failure(err.message); }
}

export function reprintWorkflowReceipt({ id, receiptId }) {
  try {
    requirePermission("RECEIPT_PRINT");
    const item = load(id, { closedAllowed: true });
    const receipt = item.receipts?.find((entry) => entry.id === receiptId);
    if (!receipt) throw new Error("Quittung nicht gefunden.");
    if (!receipt.itemSnapshot) throw new Error("Diese alte Quittung enthält keine gespeicherte Druckfassung. Der aktuelle Bericht bleibt verfügbar.");
    return { ok: true, job: { id: receipt.id, kind: receipt.workflowKind, receipt: clone(receipt),
      item: clone(receipt.itemSnapshot), reprint: true } };
  } catch (err) { return failure(err.message); }
}

export function closeWorkflow({ id }) {
  try {
    requirePermission("ITEM_EDIT");
    const before = load(id);
    const summary = getWorkflowSummary(before);
    if (!summary.canClose) throw new Error(`Abschluss noch nicht möglich: ${summary.blockers.join("; ")}`);
    const workflow = { ...summary.workflow, closedAt: new Date().toISOString(), closedBy: getCurrentUserName() };
    return { ok: true, item: persist(before, { ...before, workflow }, "WORKFLOW_CLOSED") };
  } catch (err) { return failure(err.message); }
}

export function reopenWorkflow({ id, reason }) {
  try {
    requirePermission("ITEM_EDIT");
    if (!String(reason || "").trim()) throw new Error("Bitte die Wiedereröffnung begründen.");
    const before = load(id, { closedAllowed: true });
    const workflow = { ...normalizeWorkflow(before), closedAt: null, closedBy: null };
    return { ok: true, item: persist(before, { ...before, workflow }, "WORKFLOW_REOPENED", { detail: { reason: String(reason).trim() } }) };
  } catch (err) { return failure(err.message); }
}

export function recordDisposition({ id, parts, dispositionStatus, reason }) {
  try {
    requirePermission("ITEM_EDIT");
    if (dispositionStatus !== "DISPOSED" || !String(reason || "").trim()) {
      throw new Error("Bitte die Maßnahme und ihre dokumentierte Entscheidungsgrundlage angeben.");
    }
    const before = load(id);
    const workflow = normalizeWorkflow(before);
    if (workflow.blockedReason || workflow.decisionOpen) throw new Error("Bitte zuerst die Sperre oder offene Entscheidung klären.");
    const selected = selectedParts(workflow, parts, "TRANSFER");
    const now = new Date().toISOString();
    for (const line of selected) workflow.parts.find((part) => part.id === line.partId).handledQuantity += line.quantity;
    workflow.movements.push({ id: crypto.randomUUID(), kind: dispositionStatus === "TRANSFERRED" ? "TRANSFER" : "DISPOSITION",
      dispositionStatus, reason: String(reason).trim(), parts: selected, confirmedAt: now, actor: getCurrentUserName() });
    const updated = { ...before, workflow,
      status: workflow.parts.every((part) => part.handledQuantity === part.quantity) ? dispositionStatus : before.status };
    if (workflow.parts.every((part) => part.handledQuantity === part.quantity)) updated.retention = {
      ...(before.retention || {}), completedAt: now, dispositionType: dispositionStatus === "DISPOSED" ? "MANUALLY_DOCUMENTED" : "TRANSFER_TO_OTHER_AUTHORITY" };
    return { ok: true, item: persist(before, updated, "WORKFLOW_DISPOSITION_RECORDED", { detail: { reason: String(reason).trim(), dispositionStatus } }) };
  } catch (err) { return failure(err.message); }
}
