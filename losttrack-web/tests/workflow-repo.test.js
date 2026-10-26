import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { login, logout } from "../src/core/auth/auth.js";
import { createUser, updateUser } from "../src/core/storage/userRepo.js";
import { createEmptyLostItem } from "../src/domain/lostItem.js";
import { getWorkflowSummary, normalizeWorkflow } from "../src/domain/workflow.js";
import * as items from "../src/core/storage/lostItemRepo.js";
import * as workflow from "../src/core/storage/workflowRepo.js";

let data;
let item;
let editor;
let failWrite;
const snapshot = () => [...data.entries()].sort(([a], [b]) => a.localeCompare(b));
const signIn = (username = "admin") => assert.equal(login({ username, password: username }).ok, true);
function success(result) {
  assert.equal(result.ok, true, result.error || JSON.stringify(result));
  return result;
}
function savePlan(extra = {}) {
  return success(workflow.saveWorkflowPlan({
    id: item.id,
    parts: [{ id: "main", label: "TEST Fundsache", quantity: 1, feeCode: "NONE" }],
    rewardCents: 0, expensesCents: 0, expensesRecipient: "OFFICE",
    blockedReason: "", decisionOpen: false, ...extra,
  })).item;
}
function prepare(extra = {}) {
  return success(workflow.prepareWorkflowReceipt({
    id: item.id, kind: "OWNER_HANDOVER", recipient: "TEST Eigentümer",
    parts: [{ partId: "main", quantity: 1 }], payments: [], reason: "TEST Übergabe", ...extra,
  })).job;
}
function confirm(job) {
  return success(workflow.confirmWorkflowReceipt({ job, confirmed: true }));
}
function pay(payments) {
  return confirm(prepare({ kind: "PAYMENT", parts: [], payments }));
}
const payment = (category, type, amountCents) => ({ category, type, amountCents });

test("Spätere Finderlohnzahlung verwendet das Finderschreiben ohne weitere Herausgabe", () => {
  savePlan({ rewardCents: 1000 });
  confirm(prepare({ payments: [payment("REWARD", "IN", 1000)] }));
  const before = items.getLostItemById(item.id);
  const job = prepare({ kind: "PAYMENT", documentKind: "FINDER_HANDOVER", parts: [],
    recipient: "TEST Finder", payments: [payment("REWARD", "OUT", 1000)] });
  const result = confirm(job);
  assert.equal(result.receipt.documentKind, "FINDER_HANDOVER");
  assert.equal(result.item.workflow.movements.length, before.workflow.movements.length);
  assert.equal(result.item.workflow.payments.REWARD.paidCents, 1000);
  const reprint = success(workflow.reprintWorkflowReceipt({ id: item.id, receiptId: result.receipt.id }));
  assert.equal(reprint.job.receipt.documentKind, "FINDER_HANDOVER");
});

test("Ungültige Schreiben und Auszahlungen im Eigentümerschreiben werden abgewiesen", () => {
  savePlan({ rewardCents: 1000 });
  const before = snapshot();
  for (const params of [
    { kind: "PAYMENT", documentKind: "FUND", payments: [payment("REWARD", "IN", 1000)] },
    { kind: "FUND", documentKind: "OWNER_HANDOVER", payments: [] },
    { kind: "PAYMENT", documentKind: "OWNER_HANDOVER", payments: [payment("REWARD", "OUT", 1000)] },
  ]) {
    assert.equal(workflow.prepareWorkflowReceipt({ id: item.id, recipient: "TEST", parts: [], ...params }).ok, false);
    assert.deepEqual(snapshot(), before);
  }
});

beforeEach(() => {
  data = new Map();
  failWrite = null;
  globalThis.localStorage = {
    get length() { return data.size; },
    key: (index) => [...data.keys()][index] ?? null,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      if (failWrite) failWrite(key);
      data.set(key, String(value));
    },
    removeItem: (key) => data.delete(key),
  };
  signIn();
  editor = success(createUser({ name: "TEST Editor", username: "editor", password: "editor", role: "EDITOR" })).value;
  success(createUser({ name: "TEST Viewer", username: "viewer", password: "viewer", role: "VIEWER" }));
  const input = createEmptyLostItem();
  input.id = "workflow-test-item";
  input.caseWorker = { id: "test", name: "TEST Sachbearbeitung" };
  input.foundAt = { date: "25.10.2026", time: "10.00", location: "TEST Fundort" };
  input.finder = { firstName: "TEST Finder", rewardChoice: "REQUESTED", rewardRequested: true };
  input.owner = { firstName: "TEST Eigentümer", lastName: "Muster" };
  input.item.manualLabel = "TEST Fundsache";
  item = success(items.commitLostItem(input)).item;
});

test("Historische Schlüsselbundtarife und Mobilvermittlung bleiben lesbar und korrekt berechnet", () => {
  const saved = savePlan({ parts: [
    { id: "key", label: "Einzelschlüssel", quantity: 1, feeCode: "KEY" },
    { id: "bundle", label: "Bund mit sieben Schlüsseln", quantity: 1, feeCode: "KEY_BUNDLE" },
    { id: "mobile", label: "Vermittelte Mobiltelefone", quantity: 2, feeCode: "MOBILE_MEDIATION" },
    { id: "other", label: "Regenschirm", quantity: 1, feeCode: "NONE" },
  ], rewardCents: 5000, expensesCents: 700, expensesRecipient: "FINDER" });
  const state = normalizeWorkflow(saved);
  assert.equal(state.payments.FEE.dueCents, 6000);
  assert.equal(state.parts.find((part) => part.id === "bundle").feeSnapshot.cents, 1000);
  assert.equal(state.payments.REWARD.dueCents, 5000);
  assert.equal(state.payments.EXPENSES.dueCents, 700);
  assert.equal(items.listCashbookEntries().length, 0);
});

test("Druckvorbereitung und verworfener Druck verändern keinerlei Geschäftsdaten oder Zähler", () => {
  savePlan({ rewardCents: 2000 });
  const before = snapshot();
  const job = prepare({ payments: [payment("REWARD", "IN", 1000)] });
  assert.ok(job.receipt.id);
  assert.deepEqual(snapshot(), before);
  // Druckabbruch bedeutet: Job verwerfen, keine Bestätigungsfunktion aufrufen.
  assert.equal(getWorkflowSummary(items.getLostItemById(item.id)).physicalStatus, "STORED");
  assert.equal(items.listCashbookEntries().length, 0);
  assert.deepEqual(snapshot(), before);
});

test("Fehlende oder negative Druckbestätigung lässt Herausgabe und Zahlungsstand offen", () => {
  savePlan();
  const job = prepare();
  const before = snapshot();
  for (const confirmed of [undefined, false, "ja"]) {
    assert.equal(workflow.confirmWorkflowReceipt({ job, confirmed }).ok, false);
    assert.deepEqual(snapshot(), before);
  }
});

test("Teilherausgabe lässt Restmenge offen; zweite bestätigte Übergabe erledigt den Verbleib", () => {
  savePlan({ parts: [{ id: "main", label: "Zwei Testgegenstände", quantity: 2, feeCode: "NONE" }] });
  const first = confirm(prepare());
  const partial = getWorkflowSummary(first.item);
  assert.equal(partial.physicalStatus, "PARTIAL");
  assert.equal(partial.remainingParts[0].remainingQuantity, 1);
  assert.equal(partial.canClose, false);
  const second = confirm(prepare());
  assert.equal(second.item.status, "RETURNED");
  assert.equal(getWorkflowSummary(second.item).physicalStatus, "RETURNED");
  assert.equal(getWorkflowSummary(second.item).remainingParts.length, 0);
});

test("Wiederholte Bestätigung erzeugt keine zweite Übergabe, Buchung oder Protokollierung", () => {
  savePlan({ rewardCents: 1500 });
  const job = prepare({ payments: [payment("REWARD", "IN", 1500)] });
  const first = confirm(job);
  const before = snapshot();
  const second = workflow.confirmWorkflowReceipt({ job, confirmed: true });
  assert.equal(second.ok, true, second.error);
  assert.equal(second.receipt.id, first.receipt.id);
  assert.equal(items.listCashbookEntries().length, 1);
  assert.deepEqual(snapshot(), before);
});

test("Gedruckte Teilmenge kann vor Bestätigung nicht durch eine andere Menge ersetzt werden", () => {
  savePlan({ parts: [{ id: "main", label: "Zwei Gegenstände", quantity: 2, feeCode: "NONE" }] });
  const job = prepare();
  const altered = structuredClone(job);
  altered.receipt.parts[0].quantity = 2;
  const before = snapshot();
  assert.equal(workflow.confirmWorkflowReceipt({ job: altered, confirmed: true }).ok, false);
  assert.deepEqual(snapshot(), before);
});

test("Druckdatum eines vorbereiteten Jobs kann nicht nachträglich in die Zukunft verlegt werden", () => {
  savePlan();
  const altered = structuredClone(prepare());
  altered.receipt.printedAt = "2099-12-31T23:59:59.000Z";
  const before = snapshot();
  assert.equal(workflow.confirmWorkflowReceipt({ job: altered, confirmed: true }).ok, false);
  assert.deepEqual(snapshot(), before);
});

test("Ein nach der Druckvorbereitung geänderter Vorgang muss neu vorbereitet werden", () => {
  savePlan();
  const job = prepare();
  savePlan({ blockedReason: "TEST Klärung offen" });
  const before = snapshot();
  assert.equal(workflow.confirmWorkflowReceipt({ job, confirmed: true }).ok, false);
  assert.deepEqual(snapshot(), before);
});

test("Gebühren, Finderlohn und Auslagen lassen sich in Teilzahlungen unabhängig buchen", () => {
  savePlan({ parts: [{ id: "main", label: "Schlüsselbund", quantity: 1, feeCode: "KEY_BUNDLE" }],
    rewardCents: 3000, expensesCents: 800, expensesRecipient: "FINDER" });
  pay([payment("FEE", "IN", 500), payment("REWARD", "IN", 1000), payment("EXPENSES", "IN", 300)]);
  let state = normalizeWorkflow(items.getLostItemById(item.id));
  assert.equal(state.payments.FEE.receivedCents, 500);
  assert.equal(state.payments.REWARD.receivedCents, 1000);
  assert.equal(state.payments.EXPENSES.receivedCents, 300);
  pay([payment("FEE", "IN", 500), payment("REWARD", "IN", 2000), payment("EXPENSES", "IN", 500)]);
  pay([payment("REWARD", "OUT", 1200), payment("EXPENSES", "OUT", 800)]);
  state = normalizeWorkflow(items.getLostItemById(item.id));
  assert.equal(state.payments.FEE.receivedCents, 1000);
  assert.equal(state.payments.REWARD.receivedCents, 3000);
  assert.equal(state.payments.REWARD.paidCents, 1200);
  assert.equal(state.payments.EXPENSES.paidCents, 800);
  assert.equal(items.verifyCashbookChain().ok, true);
});

test("Die Kassenbuch-Prüfkette schützt auch die Zahlungsart einer neuen Buchung", () => {
  savePlan({ rewardCents: 1000 });
  pay([payment("REWARD", "IN", 1000)]);
  assert.equal(items.verifyCashbookChain().ok, true);
  const ledger = JSON.parse(localStorage.getItem("losttrack:lostItems.cashbook.v1"));
  assert.equal(ledger[0].category, "REWARD");
  ledger[0].category = "EXPENSES";
  localStorage.setItem("losttrack:lostItems.cashbook.v1", JSON.stringify(ledger));
  assert.equal(items.verifyCashbookChain().ok, false);
});

test("Fundsache bleibt nach Herausgabe bis zur vollständigen Auszahlung unabgeschlossen", () => {
  savePlan({ rewardCents: 3000 });
  confirm(prepare({ payments: [payment("REWARD", "IN", 3000)] }));
  assert.equal(getWorkflowSummary(items.getLostItemById(item.id)).overallStatus, "SETTLEMENT_OPEN");
  assert.equal(workflow.closeWorkflow({ id: item.id }).ok, false);
  pay([payment("REWARD", "OUT", 1000)]);
  assert.equal(workflow.closeWorkflow({ id: item.id }).ok, false);
  pay([payment("REWARD", "OUT", 2000)]);
  const closed = success(workflow.closeWorkflow({ id: item.id }));
  assert.equal(getWorkflowSummary(closed.item).overallStatus, "CLOSED");
  assert.ok(closed.item.workflow.closedAt);
});

test("Vom Fundbüro getragene Auslagen benötigen nur Eingang, keine weitere Auszahlung", () => {
  savePlan({ expensesCents: 800, expensesRecipient: "OFFICE" });
  confirm(prepare({ payments: [payment("EXPENSES", "IN", 800)] }));
  assert.equal(normalizeWorkflow(items.getLostItemById(item.id)).payments.EXPENSES.paidCents, 0);
  assert.equal(getWorkflowSummary(items.getLostItemById(item.id)).canClose, true);
  success(workflow.closeWorkflow({ id: item.id }));
});

test("Ungeklärte Gebühren, Auslagen oder Empfänger verhindern einen vollständigen Abschluss", () => {
  savePlan({ parts: [{ id: "main", label: "Gebühr ungeklärt", quantity: 1, feeCode: "UNSET" }], expensesCents: null });
  assert.equal(workflow.prepareWorkflowReceipt({ id: item.id, kind: "OWNER_HANDOVER", recipient: "TEST Eigentümer",
    parts: [{ partId: "main", quantity: 1 }], payments: [] }).ok, false);
  assert.equal(workflow.closeWorkflow({ id: item.id }).ok, false);
  savePlan({ expensesCents: 100, expensesRecipient: "UNSET" });
  assert.equal(workflow.closeWorkflow({ id: item.id }).ok, false);
});

test("Sperren und offene Entscheidungen verhindern Herausgabe beziehungsweise Abschluss", () => {
  savePlan({ blockedReason: "TEST Berechtigung ungeklärt" });
  const before = snapshot();
  assert.equal(workflow.prepareWorkflowReceipt({ id: item.id, kind: "OWNER_HANDOVER", recipient: "TEST Eigentümer",
    parts: [{ partId: "main", quantity: 1 }], payments: [] }).ok, false);
  assert.deepEqual(snapshot(), before);
  savePlan();
  confirm(prepare());
  savePlan({ decisionOpen: true });
  assert.equal(workflow.closeWorkflow({ id: item.id }).ok, false);
});

for (const invalid of [-1, 1.5, "100", Number.NaN, Number.MAX_SAFE_INTEGER + 1]) {
  test(`Ungültiger Zahlungsbetrag ${String(invalid)} wird vor Änderungen abgewiesen`, () => {
    savePlan({ rewardCents: 1000 });
    const before = snapshot();
    const result = workflow.prepareWorkflowReceipt({ id: item.id, kind: "PAYMENT", recipient: "TEST Finder",
      parts: [], payments: [payment("REWARD", "IN", invalid)] });
    assert.equal(result.ok, false);
    assert.deepEqual(snapshot(), before);
  });
}

test("Überzahlung und Auszahlung ohne vorhandene Einzahlung werden abgewiesen", () => {
  savePlan({ rewardCents: 1000 });
  const before = snapshot();
  for (const row of [payment("REWARD", "IN", 1001), payment("REWARD", "OUT", 100), payment("FEE", "OUT", 1)]) {
    assert.equal(workflow.prepareWorkflowReceipt({ id: item.id, kind: "PAYMENT", recipient: "TEST Finder", parts: [], payments: [row] }).ok, false);
    assert.deepEqual(snapshot(), before);
  }
});

test("Eigentümer-Herausgabe kann keine Auszahlung an eine andere Person bestätigen", () => {
  savePlan({ rewardCents: 1000 });
  pay([payment("REWARD", "IN", 1000)]);
  const before = snapshot();
  const result = workflow.prepareWorkflowReceipt({ id: item.id, kind: "OWNER_HANDOVER",
    recipient: "TEST Eigentümer", parts: [{ partId: "main", quantity: 1 }],
    payments: [payment("REWARD", "OUT", 1000)] });
  assert.equal(result.ok, false);
  assert.deepEqual(snapshot(), before);
});

test("Mehrfachauswahl derselben Menge oder Zahlungsposition darf keine Grenzen umgehen", () => {
  savePlan({ rewardCents: 1000 });
  const before = snapshot();
  assert.equal(workflow.prepareWorkflowReceipt({ id: item.id, kind: "OWNER_HANDOVER", recipient: "TEST Eigentümer",
    parts: [{ partId: "main", quantity: 1 }, { partId: "main", quantity: 1 }], payments: [] }).ok, false);
  assert.equal(workflow.prepareWorkflowReceipt({ id: item.id, kind: "PAYMENT", recipient: "TEST Eigentümer", parts: [],
    payments: [payment("REWARD", "IN", 600), payment("REWARD", "IN", 600)] }).ok, false);
  assert.deepEqual(snapshot(), before);
});

test("Nachdruck verwendet den historischen Snapshot und verändert keine Geschäftsdaten", () => {
  savePlan();
  const confirmed = confirm(prepare());
  success(items.updateOwner({ id: item.id, owner: { firstName: "Später geänderter Eigentümer" } }));
  const before = snapshot();
  const reprinted = success(workflow.reprintWorkflowReceipt({ id: item.id, receiptId: confirmed.receipt.id }));
  assert.equal(reprinted.job.reprint, true);
  assert.equal(reprinted.job.receipt.id, confirmed.receipt.id);
  assert.equal(reprinted.job.receipt.recipient, "TEST Eigentümer");
  assert.deepEqual(reprinted.job.receipt.parts, confirmed.receipt.parts);
  assert.deepEqual(snapshot(), before);
  workflow.confirmWorkflowReceipt({ job: reprinted.job, confirmed: true });
  assert.deepEqual(snapshot(), before);
});

test("Fundannahme- und reine Zahlungsquittung geben keine Gegenstände heraus", () => {
  savePlan({ rewardCents: 1000 });
  confirm(prepare({ kind: "FUND", parts: [], payments: [] }));
  pay([payment("REWARD", "IN", 1000)]);
  const summary = getWorkflowSummary(items.getLostItemById(item.id));
  assert.equal(summary.physicalStatus, "STORED");
  assert.equal(summary.remainingParts[0].remainingQuantity, 1);
});

test("Persönliche Weitergabe und dokumentierte Verwertung verändern nur gewählte Mengen", () => {
  savePlan({ parts: [
    { id: "a", label: "An Fachstelle", quantity: 1, feeCode: "NONE" },
    { id: "b", label: "Manuell entschiedene Verwertung", quantity: 1, feeCode: "NONE" },
  ] });
  confirm(prepare({ kind: "TRANSFER", recipient: "TEST Fachstelle", parts: [{ partId: "a", quantity: 1 }] }));
  assert.equal(getWorkflowSummary(items.getLostItemById(item.id)).physicalStatus, "PARTIAL");
  const invalidBefore = snapshot();
  assert.equal(workflow.recordDisposition({ id: item.id, parts: [{ partId: "b", quantity: 1 }], dispositionStatus: "DISPOSED", reason: "" }).ok, false);
  assert.deepEqual(snapshot(), invalidBefore);
  success(workflow.recordDisposition({ id: item.id, parts: [{ partId: "b", quantity: 1 }], dispositionStatus: "DISPOSED", reason: "TEST dokumentierter Entscheid; keine rechtliche Freigabe" }));
  const resolved = getWorkflowSummary(items.getLostItemById(item.id));
  assert.equal(resolved.remainingParts.length, 0);
  assert.equal(resolved.physicalStatus, "RESOLVED", "Gemischter Verbleib darf nicht alle Teile als verwertet darstellen");
});

test("Persönliche Weitergabe benötigt eine bestätigte Quittung und darf Disposition nicht umgehen", () => {
  savePlan();
  const before = snapshot();
  const result = workflow.recordDisposition({ id: item.id,
    parts: [{ partId: "main", quantity: 1 }], dispositionStatus: "TRANSFERRED",
    reason: "TEST Weiterleitung ohne Druckbestätigung" });
  assert.equal(result.ok, false);
  assert.deepEqual(snapshot(), before);
});

test("Abgeschlossener Vorgang benötigt eine begründete Wiedereröffnung vor Änderungen", () => {
  savePlan();
  confirm(prepare());
  success(workflow.closeWorkflow({ id: item.id }));
  const before = snapshot();
  assert.equal(workflow.saveWorkflowPlan({ id: item.id, rewardCents: 100 }).ok, false);
  assert.equal(workflow.reopenWorkflow({ id: item.id, reason: " " }).ok, false);
  assert.deepEqual(snapshot(), before);
  const reopened = success(workflow.reopenWorkflow({ id: item.id, reason: "TEST Korrektur der Abrechnung" }));
  assert.equal(reopened.item.workflow.closedAt, null);
  assert.notEqual(getWorkflowSummary(reopened.item).overallStatus, "CLOSED");
  assert.ok(items.listAuditLog().some((entry) => JSON.stringify(entry).includes("TEST Korrektur der Abrechnung")));
});

test("Aktivierter Workflow kann nicht durch alte Status- oder Quittungsfunktionen umgangen werden", () => {
  savePlan({ rewardCents: 1000 });
  const before = snapshot();
  for (const result of [
    items.changeLostItemStatus({ id: item.id, newStatus: "RETURNED" }),
    items.disposeLostItem({ id: item.id, dispositionType: "RECYCLE" }),
    items.createReceipt({ id: item.id, receiptType: "OWNER_RECEIPT", recipient: "TEST", amount: 10 }),
    items.printReceipt({ id: item.id, receiptType: "FINDER_RECEIPT", recipient: "TEST", amount: 10, notes: "Finderlohn-Abholung" }),
    items.postCashbookEntry({ item, type: "IN", amountCents: 1000 }),
    items.receiveOwnerReward({ id: item.id, amountCents: 1000 }),
    items.payFinderReward({ id: item.id, amountCents: 1000 }),
  ]) assert.equal(result.ok, false, JSON.stringify(result));
  assert.deepEqual(snapshot(), before);
});

test("Formular kann nach Geldeingang keinen Finderlohnverzicht samt gefälschter Abrechnung speichern", () => {
  savePlan({ rewardCents: 1000 });
  pay([payment("REWARD", "IN", 1000)]);
  const current = items.getLostItemById(item.id);
  const before = snapshot();
  const forged = structuredClone(current);
  forged.finder.rewardChoice = "WAIVED";
  forged.finder.rewardRequested = false;
  forged.workflow.payments.REWARD = { dueCents: 0, receivedCents: 0, paidCents: 0 };
  const result = items.updateLostItem(forged);
  assert.equal(result.ok, false);
  assert.deepEqual(snapshot(), before);
  const retained = normalizeWorkflow(items.getLostItemById(item.id));
  assert.equal(retained.payments.REWARD.dueCents, 1000);
  assert.equal(retained.payments.REWARD.receivedCents, 1000);
});

test("Abschluss sperrt auch alte Personen-, Fundsachen- und Ermittlungsschreibfunktionen", () => {
  const step = success(items.addInvestigationStep({ id: item.id, step: { who: "TEST", what: "Vor Abschluss" } })).step;
  savePlan();
  confirm(prepare());
  success(workflow.closeWorkflow({ id: item.id }));
  const current = items.getLostItemById(item.id);
  const before = snapshot();
  for (const result of [
    items.updateLostItem({ ...current, item: { ...current.item, description: "Nicht erlaubt" } }),
    items.updateFinder({ id: item.id, finder: { firstName: "Geändert" } }),
    items.updateOwner({ id: item.id, owner: { firstName: "Geändert" } }),
    items.updateCollector({ id: item.id, collector: { firstName: "Geändert" } }),
    items.addInvestigationStep({ id: item.id, step: { who: "TEST", what: "Nicht erlaubt" } }),
    items.deleteInvestigationStep({ id: item.id, stepId: step.id }),
  ]) assert.equal(result.ok, false, JSON.stringify(result));
  assert.deepEqual(snapshot(), before);
});

test("Tatsächliche Legacy-Auszahlung aus finderReward wird ohne neue Buchung übernommen", () => {
  const records = JSON.parse(localStorage.getItem("losttrack:lostItems.records.v1"));
  records[0].finderRewardDeposit = { received: true, amountCents: 4000, receivedAt: "2026-10-25T09:00:00Z" };
  records[0].finderReward = { paidAt: "2026-10-25T10:00:00Z", amountCents: 4000, cashbookId: "TEST-ALT" };
  localStorage.setItem("losttrack:lostItems.records.v1", JSON.stringify(records));
  const before = snapshot();
  const summary = getWorkflowSummary(items.getLostItemById(item.id));
  assert.equal(summary.payments.REWARD.dueCents, 4000);
  assert.equal(summary.payments.REWARD.receivedCents, 4000);
  assert.equal(summary.payments.REWARD.paidCents, 4000);
  assert.deepEqual(snapshot(), before);
});

for (const identity of ["viewer", "abgemeldet", "deaktiviert"]) {
  test(`${identity}: neue Workflowaktionen und bereits vorbereitete Jobs sind gesperrt`, () => {
    savePlan();
    const job = prepare();
    if (identity === "viewer") signIn("viewer");
    if (identity === "abgemeldet") logout();
    if (identity === "deaktiviert") {
      success(updateUser(editor.id, { active: false }));
      localStorage.setItem("losttrack:lostItems.session.v1", JSON.stringify({ userId: editor.id }));
    }
    const before = snapshot();
    for (const result of [
      workflow.saveWorkflowPlan({ id: item.id, rewardCents: 0 }),
      workflow.prepareWorkflowReceipt({ id: item.id, kind: "OWNER_HANDOVER", recipient: "TEST", parts: [{ partId: "main", quantity: 1 }] }),
      workflow.confirmWorkflowReceipt({ job, confirmed: true }),
      workflow.closeWorkflow({ id: item.id }),
      workflow.reopenWorkflow({ id: item.id, reason: "TEST" }),
      workflow.recordDisposition({ id: item.id, parts: [{ partId: "main", quantity: 1 }], dispositionStatus: "DISPOSED", reason: "TEST" }),
    ]) assert.equal(result.ok, false, JSON.stringify(result));
    assert.deepEqual(snapshot(), before);
  });
}

test("EDITOR darf Planung und bestätigte persönliche Herausgabe durchführen", () => {
  signIn("editor");
  savePlan();
  const result = confirm(prepare());
  assert.equal(getWorkflowSummary(result.item).physicalStatus, "RETURNED");
  success(workflow.closeWorkflow({ id: item.id }));
});

test("Ein Speicherfehler nach Teilwrites setzt Vorgang, Kassenbuch und Protokoll zurück", () => {
  savePlan({ rewardCents: 1000 });
  const job = prepare({ payments: [payment("REWARD", "IN", 1000)] });
  const before = snapshot();
  let failed = false;
  failWrite = (key) => {
    if (!failed && key === "losttrack:lostItems.audit.v1") {
      failed = true;
      throw new Error("QuotaExceededError");
    }
  };
  assert.equal(workflow.confirmWorkflowReceipt({ job, confirmed: true }).ok, false);
  assert.equal(failed, true);
  assert.deepEqual(snapshot(), before);
});
