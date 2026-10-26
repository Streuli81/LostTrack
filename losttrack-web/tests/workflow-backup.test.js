import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { login, isLoggedIn } from "../src/core/auth/auth.js";
import { createEmptyLostItem } from "../src/domain/lostItem.js";
import { getWorkflowSummary } from "../src/domain/workflow.js";
import { createBackup, inspectBackup, restoreBackup } from "../src/core/storage/backup.js";
import * as items from "../src/core/storage/lostItemRepo.js";
import * as workflow from "../src/core/storage/workflowRepo.js";

const RECORDS = "losttrack:lostItems.records.v1";
const CASHBOOK = "losttrack:lostItems.cashbook.v1";
let data;
let item;
let receipt;
const snapshot = () => [...data.entries()].sort(([a], [b]) => a.localeCompare(b));
function success(result) {
  assert.equal(result.ok, true, result.error || JSON.stringify(result));
  return result;
}
function signIn() { success(login({ username: "admin", password: "admin" })); }

beforeEach(() => {
  data = new Map();
  globalThis.localStorage = {
    get length() { return data.size; },
    key: (index) => [...data.keys()][index] ?? null,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
  };
  signIn();
  const input = createEmptyLostItem();
  input.id = "workflow-backup-test";
  input.caseWorker = { id: "test", name: "TEST Sachbearbeitung" };
  input.foundAt = { date: "25.10.2026", time: "10.00", location: "TEST Fundort" };
  input.finder = { firstName: "TEST Finder", rewardChoice: "REQUESTED", rewardRequested: true };
  input.owner = { firstName: "TEST Eigentümer", lastName: "Historischer Name" };
  input.item.manualLabel = "TEST zwei Schlüsselbunde";
  item = success(items.commitLostItem(input)).item;
  success(workflow.saveWorkflowPlan({ id: item.id,
    parts: [{ id: "bundles", label: "Zwei Schlüsselbunde", quantity: 2, feeCode: "KEY_BUNDLE" }],
    rewardCents: 3000, expensesCents: 0, expensesRecipient: "OFFICE", blockedReason: "", decisionOpen: false,
  }));
  const prepared = success(workflow.prepareWorkflowReceipt({ id: item.id, kind: "OWNER_HANDOVER",
    recipient: "TEST Eigentümer Historischer Name", parts: [{ partId: "bundles", quantity: 1 }],
    payments: [{ category: "FEE", type: "IN", amountCents: 1000 },
      { category: "REWARD", type: "IN", amountCents: 500 }], reason: "TEST Teilherausgabe und Teilzahlung",
  }));
  receipt = success(workflow.confirmWorkflowReceipt({ job: prepared.job, confirmed: true })).receipt;
});

test("Sicherung erhält Teilherausgabe, getrennte Zahlungen, Gebühren-Snapshot und Quittung exakt", () => {
  const original = items.getLostItemById(item.id);
  const originalLedger = localStorage.getItem(CASHBOOK);
  const originalAudit = items.listAuditLog();
  const text = createBackup();
  assert.equal(inspectBackup(text).records, 1);
  const exported = JSON.parse(text);
  assert.equal(exported.data[CASHBOOK], originalLedger);
  data.clear();
  signIn();
  restoreBackup(text, { confirmed: true });
  assert.equal(isLoggedIn(), false);
  signIn();
  const restored = items.getLostItemById(item.id);
  assert.deepEqual(restored, original);
  assert.deepEqual(items.listAuditLog(), originalAudit);
  assert.equal(localStorage.getItem(CASHBOOK), originalLedger);
  const summary = getWorkflowSummary(restored);
  assert.equal(summary.physicalStatus, "PARTIAL");
  assert.equal(summary.remainingParts[0].remainingQuantity, 1);
  assert.equal(summary.payments.FEE.dueCents, 2000);
  assert.equal(summary.payments.FEE.receivedCents, 1000);
  assert.equal(summary.payments.REWARD.dueCents, 3000);
  assert.equal(summary.payments.REWARD.receivedCents, 500);
  assert.equal(summary.payments.REWARD.paidCents, 0);
  assert.deepEqual(items.listCashbookEntries().map((entry) => entry.category), ["FEE", "REWARD"]);
  assert.equal(items.verifyCashbookChain().ok, true);
});

test("Historischer Quittungsnachdruck bleibt nach Wiederherstellung unverändert und bucht nicht erneut", () => {
  success(items.updateOwner({ id: item.id, owner: { firstName: "TEST Neuer Eigentümername" } }));
  const text = createBackup();
  restoreBackup(text, { confirmed: true });
  signIn();
  const before = snapshot();
  const reprinted = success(workflow.reprintWorkflowReceipt({ id: item.id, receiptId: receipt.id }));
  assert.equal(reprinted.job.reprint, true);
  assert.deepEqual(reprinted.job.receipt, receipt);
  assert.equal(reprinted.job.receipt.itemSnapshot.owner.firstName, "TEST Eigentümer");
  assert.equal(items.getLostItemById(item.id).owner.firstName, "TEST Neuer Eigentümername");
  assert.deepEqual(snapshot(), before);
  workflow.confirmWorkflowReceipt({ job: reprinted.job, confirmed: true });
  assert.deepEqual(snapshot(), before);
});

test("Gültiger historischer Gebührensatz wird bei Export und Restore nicht auf aktuellen Tarif umgerechnet", () => {
  const records = JSON.parse(localStorage.getItem(RECORDS));
  records[0].workflow.parts[0].feeSnapshot = { ...records[0].workflow.parts[0].feeSnapshot,
    cents: 800, catalog: "TEST_HISTORISCHER_TARIF" };
  records[0].workflow.payments.FEE.dueCents = 1600;
  localStorage.setItem(RECORDS, JSON.stringify(records));
  const text = createBackup();
  restoreBackup(text, { confirmed: true });
  signIn();
  const restored = items.getLostItemById(item.id);
  assert.equal(restored.workflow.parts[0].feeSnapshot.cents, 800);
  assert.equal(restored.workflow.parts[0].feeSnapshot.catalog, "TEST_HISTORISCHER_TARIF");
  assert.equal(restored.workflow.payments.FEE.dueCents, 1600);
  assert.equal(restored.receipts[0].chargeSnapshot.FEE.dueCents, 2000);
  assert.equal(items.verifyCashbookChain().ok, true);
});

const corruptions = [
  ["unbekannte Workflowversion", (record) => { record.workflow.version = 999; }],
  ["negative Gegenstandsmenge", (record) => { record.workflow.parts[0].quantity = -1; }],
  ["zu große herausgegebene Menge", (record) => { record.workflow.parts[0].handledQuantity = 3; }],
  ["Abschluss mit unerledigter Restmenge und Teilzahlung", (record) => { record.workflow.closedAt = "2026-10-25T12:00:00.000Z"; }],
  ["negative Zahlung", (record) => { record.workflow.payments.REWARD.receivedCents = -500; }],
  ["Auszahlung ohne entsprechendes Guthaben", (record) => { record.workflow.payments.REWARD.paidCents = 501; }],
  ["widersprüchliche Gebührensumme", (record) => { record.workflow.payments.FEE.dueCents = 9999; }],
  ["Übergabehistorie mit falscher Gegenstandsreferenz", (record) => { record.workflow.movements[0].parts[0].partId = "fremder-gegenstand"; }],
];

for (const [name, corrupt] of corruptions) {
  test(`Beschädigte Workflow-Sicherung (${name}) wird vor jeder Änderung abgewiesen`, () => {
    const backup = JSON.parse(createBackup());
    const records = JSON.parse(backup.data[RECORDS]);
    corrupt(records[0]);
    backup.data[RECORDS] = JSON.stringify(records);
    const text = JSON.stringify(backup);
    const before = snapshot();
    assert.throws(() => inspectBackup(text));
    assert.throws(() => restoreBackup(text, { confirmed: true }));
    assert.deepEqual(snapshot(), before);
  });
}

test("Veränderte Zahlungsart einer gesicherten Kassenbuchung wird trotz unverändertem Betrag erkannt", () => {
  const backup = JSON.parse(createBackup());
  const ledger = JSON.parse(backup.data[CASHBOOK]);
  ledger[0].category = "EXPENSES";
  backup.data[CASHBOOK] = JSON.stringify(ledger);
  const before = snapshot();
  assert.throws(() => inspectBackup(JSON.stringify(backup)), /Prüfkette/);
  assert.throws(() => restoreBackup(JSON.stringify(backup), { confirmed: true }), /Prüfkette/);
  assert.deepEqual(snapshot(), before);
});
