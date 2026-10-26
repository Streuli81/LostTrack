import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { login } from "../src/core/auth/auth.js";
import { createEmptyLostItem } from "../src/domain/lostItem.js";
import { calculateRetention } from "../src/domain/retention.js";
import { finderRecipient, fundReceiptRecipient, separateDateFields } from "../src/domain/captureContext.js";
import { selectCatalogItem } from "../src/domain/itemCatalog.js";
import { validateExpenseClaims, expenseClaimState } from "../src/domain/expenseClaims.js";
import { getWorkflowSummary } from "../src/domain/workflow.js";
import * as items from "../src/core/storage/lostItemRepo.js";
import * as actions from "../src/core/storage/workflowRepo.js";
import { createBackup, restoreBackup } from "../src/core/storage/backup.js";

let store;
beforeEach(() => {
  store = new Map(); globalThis.localStorage = { get length() { return store.size; }, key: (i) => [...store.keys()][i] ?? null,
    getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
  assert.equal(login({ username: "admin", password: "admin" }).ok, true);
});
function success(result) { assert.equal(result.ok, true, result.error || JSON.stringify(result)); return result; }
function input(type = "NORMAL") {
  const empty = createEmptyLostItem();
  return { ...empty, captureVersion: 1, regime: { type, source: "MANUAL" }, origin: { type: type === "TRANSPORT" ? "PUBLIC_TRANSPORT" : "PUBLIC_GROUND", operator: "TEST Unternehmen" },
    finder: { firstName: "TEST Finder", rewardChoice: "REQUESTED" }, feeSelection: "NONE",
    foundAt: { date: "01.05.2026", time: "10.00", location: "TEST Ort" }, item: { ...empty.item, manualLabel: "TEST Portemonnaie" },
    retention: { ...empty.retention, custodyBasis: "MANUAL_SEPARATE", dateModel: "SEPARATE", reportedDate: "01.05.2026", reportedTime: "10.30",
      noticeDate: "02.05.2026", noticeTime: "11.00", finderBasis: "REPORT", receivedDate: "01.08.2026", custodyStartDate: "01.08.2026", custodyStartTime: "12.00" } };
}
const snapshot = () => [...store];
const claim = (patch = {}) => ({ id: "claim-1", role: "LEGAL_FINDER", basis: "FINDER_LAW", name: "TEST Finder", claimedCents: 600,
  approvedCents: null, reason: "TEST notwendige Sicherung", evidence: "TEST Beleg", decisionNote: "", status: "REPORTED", settlementReceiptId: "", ...patch });
function plan(item, patch = {}) { return actions.saveWorkflowPlan({ id: item.id, rewardCents: 0, expensesCents: 0, ...patch }); }
function prepare(item, patch = {}) { return actions.prepareWorkflowReceipt({ id: item.id, kind: "OWNER_HANDOVER", recipient: "TEST Eigentümer",
  parts: [{ partId: "main", quantity: 1 }], payments: [], ...patch }); }
function confirm(job) { return success(actions.confirmWorkflowReceipt({ job, confirmed: true })); }

test("Getrennte Anzeige und tatsächliche Aufbewahrung erzeugen unterschiedliche Prüfgrenzen", () => {
  const item = success(items.commitLostItem(input())).item;
  assert.equal(item.retention.custodyStartDate, "01.08.2026");
  assert.equal(item.retention.noticeDate, "02.05.2026");
  assert.equal(item.retention.reportedDate, "01.05.2026");
  assert.match(item.retention.auctionReviewDate, /^2027-08-01/);
  assert.match(item.retention.finderAcquisitionReviewDate, /^2031-05-01/);
  assert.match(calculateRetention({ ...item, retention: { ...item.retention, finderBasis: "PUBLICATION" } }).finderAcquisitionReviewDate, /^2031-05-02/);
});

test("Explizite Umstellung alter Anzeigedaten bewahrt die tatsächlichen Ereignisse", () => {
  const old = { retention: { noticeType: "POLICE_REPORT", noticeDate: "01.05.2026", noticeTime: "10.00", custodyStartDate: "01.08.2026", custodyStartTime: "12.00", custodyBasis: "NOTICE_USER_POLICY" } };
  const converted = separateDateFields(old);
  assert.equal(converted.retention.reportedDate, "01.05.2026");
  assert.equal(converted.retention.noticeDate, "");
  assert.equal(converted.retention.custodyStartDate, "01.08.2026");
  assert.equal(converted.retention.custodyStartTime, "12.00");
  assert.equal(converted.retention.finderBasis, "REPORT");
  assert.equal(old.retention.noticeDate, "01.05.2026");
});

test("Ein Fristablauf erzeugt weder Finderlohnzahlung noch automatisch bestätigten Eigentumsanspruch", () => {
  const value = input(); value.retention.reportedDate = "01.05.2000"; value.retention.custodyStartDate = "01.08.2000";
  const item = success(items.commitLostItem(value)).item;
  success(plan(item, { rewardCents: 1000 }));
  const before = snapshot();
  assert.equal(prepare(item, { kind: "FINDER_HANDOVER" }).ok, false);
  assert.equal(prepare(item, { kind: "PAYMENT", parts: [], recipient: "TEST Finder", payments: [{ category: "REWARD", type: "OUT", amountCents: 1000 }] }).ok, false);
  getWorkflowSummary(items.getLostItemById(item.id));
  assert.deepEqual(snapshot(), before);
  assert.equal(items.listCashbookEntries().length, 0);
});

test("Drei unterschiedliche Rollen bleiben getrennt und werden nicht zum Überbringer vereinheitlicht", () => {
  const item = input(); item.roles = { delivererSameAsDiscoverer: false, delivererName: "TEST Überbringer",
    legalFinderSameAsDiscoverer: false, legalFinderName: "TEST rechtlicher Finder" };
  const saved = success(items.commitLostItem(item)).item;
  assert.equal(saved.finder.firstName, "TEST Finder");
  assert.equal(fundReceiptRecipient(saved), "TEST Überbringer");
  assert.equal(finderRecipient(saved), "TEST rechtlicher Finder");
});

for (const type of ["ANIMAL", "DOCUMENT", "DANGEROUS", "REVIEW"]) test(`${type}: nur Erfassung/Fundquittung, keine normale Herausgabe, Zahlung oder Verwertung`, () => {
  const item = success(items.commitLostItem(input(type))).item;
  const before = snapshot();
  assert.equal(item.retention.auctionReviewDate, "");
  assert.equal(item.retention.finderAcquisitionReviewDate, "");
  assert.equal(prepare(item).ok, false);
  assert.equal(prepare(item, { kind: "PAYMENT", parts: [], payments: [{ category: "FEE", type: "IN", amountCents: 1 }] }).ok, false);
  assert.equal(actions.recordDisposition({ id: item.id, dispositionStatus: "DISPOSED", parts: [{ partId: "main", quantity: 1 }], reason: "TEST" }).ok, false);
  assert.equal(getWorkflowSummary(item).canClose, false);
  assert.deepEqual(snapshot(), before);
  assert.equal(prepare(item, { kind: "FUND", parts: [] }).ok, true);
});

test("Pass und Identitätskarte gelangen bei neuer Erfassung vorsichtig in die Sonderprüfung", () => {
  for (const key of ["passport", "idcard"]) {
    const next = selectCatalogItem(input(), key);
    assert.equal(next.regime.type, "DOCUMENT");
    assert.equal(next.feeSelection, "UNSET");
  }
});

test("ÖV-Fund erzeugt keinen persönlichen Finderlohn und sperrt neue Finderlohnzahlungen", () => {
  const item = success(items.commitLostItem(input("TRANSPORT"))).item;
  assert.equal(item.workflow.payments.REWARD.dueCents, 0);
  assert.equal(plan(item, { rewardCents: 1000 }).ok, false);
  assert.equal(items.payFinderReward({ id: item.id, amountCents: 1000 }).ok, false);
});

test("Fundperson-Auslagen beim Hausfund bleiben getrennt und werden nicht automatisch als Finderrecht anerkannt", () => {
  const item = input("HOUSE"); item.institution = { name: "TEST Migros" };
  item.expenseClaims = [claim({ role: "DISCOVERER" })];
  assert.equal(validateExpenseClaims(item).ok, true);
  item.expenseClaims[0] = claim({ role: "DISCOVERER", status: "APPROVED", approvedCents: 600, decisionNote: "TEST" });
  assert.equal(validateExpenseClaims(item).ok, false);
  item.expenseClaims[0].basis = "OTHER_BASIS";
  assert.equal(validateExpenseClaims(item).ok, true);
});

test("Auslagen werden angemeldet, nach Anerkennung/Rückgabe fällig und nur mit echtem Beleg bezahlt", () => {
  let item = success(items.commitLostItem(input())).item;
  item = success(items.updateLostItem({ ...item, expenseClaims: [claim()] })).item;
  assert.match(expenseClaimState(item, item.expenseClaims[0]), /Angemeldet/);
  assert.equal(items.listCashbookEntries().length, 0);
  item = success(items.updateLostItem({ ...item, expenseClaims: [claim({ status: "APPROVED", approvedCents: 600, decisionNote: "TEST Kosten anerkannt" })] })).item;
  assert.match(expenseClaimState(item, item.expenseClaims[0]), /Rückgabe.*offen/);
  success(plan(item, { expensesCents: 600, expensesRecipient: "FINDER", expensePayee: { role: "LEGAL_FINDER", name: "TEST Finder", basis: "FINDER_LAW", confirmed: true, note: "TEST Beleg anerkannt" } }));
  assert.equal(prepare(item, { kind: "PAYMENT", parts: [], recipient: "TEST Finder", payments: [{ category: "EXPENSES", type: "OUT", amountCents: 600 }] }).ok, false);
  item = confirm(success(prepare(item, { payments: [{ category: "EXPENSES", type: "IN", amountCents: 600 }] })).job).item;
  assert.match(expenseClaimState(item, item.expenseClaims[0]), /Fällig/);
  const payout = confirm(success(prepare(item, { kind: "PAYMENT", documentKind: "FINDER_HANDOVER", parts: [], recipient: "TEST Finder",
    payments: [{ category: "EXPENSES", type: "OUT", amountCents: 600 }] })).job);
  item = success(items.updateLostItem({ ...payout.item, expenseClaims: [{ ...item.expenseClaims[0], settlementReceiptId: payout.receipt.id }] })).item;
  assert.match(expenseClaimState(item, item.expenseClaims[0]), /Bezahlt/);
  assert.equal(item.workflow.payments.EXPENSES.paidCents, 600);
});

test("Erfundene Zahlungsbelege können keine Anmeldung als bezahlt ausweisen", () => {
  const item = success(items.commitLostItem(input())).item;
  const falseReceipt = { id: "fake", confirmedAt: new Date().toISOString(), recipient: "TEST Finder", payments: [{ category: "EXPENSES", type: "OUT", amountCents: 600 }] };
  const before = snapshot();
  const fakeClaim = claim({ status: "APPROVED", approvedCents: 600, decisionNote: "TEST", settlementReceiptId: "fake" });
  assert.equal(items.updateLostItem({ ...item, receipts: [falseReceipt], expenseClaims: [fakeClaim] }).ok, false);
  assert.deepEqual(snapshot(), before);
});

test("CHF 250 Fundbargeld werden dokumentiert, aber nie als Gebühren oder automatischer Finderlohn gebucht", () => {
  const value = input(); value.contents = [{ id: "cash", kind: "CASH", label: "TEST Bargeld im Portemonnaie", currency: "CHF", amountCents: 25000, countConfirmed: true, details: "TEST gezählt" }];
  const item = success(items.commitLostItem(value)).item;
  assert.equal(items.listCashbookEntries().length, 0);
  assert.equal(item.workflow.payments.FEE.dueCents, 0);
  assert.equal(item.workflow.payments.REWARD.dueCents, null);
  success(plan(item));
  const disposed = success(actions.recordDisposition({ id: item.id, parts: [{ partId: "main", quantity: 1 }], dispositionStatus: "DISPOSED", reason: "TEST dokumentierte Freigabe", proceedsCents: 30000 })).item;
  assert.equal(disposed.workflow.disposalProceedsCents, 30000);
  assert.equal(items.listCashbookEntries().length, 0);
  assert.equal(actions.closeWorkflow({ id: item.id }).ok, false);
  assert.ok(getWorkflowSummary(disposed).blockers.some((reason) => reason.includes("Fundbargeld")));
  const backup = createBackup();
  restoreBackup(backup, { confirmed: true });
  assert.equal(items.getLostItemById(item.id).contents[0].amountCents, 25000);
  assert.equal(items.getLostItemById(item.id).workflow.disposalProceedsCents, 30000);
});
