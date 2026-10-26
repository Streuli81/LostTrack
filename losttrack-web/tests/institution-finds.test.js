import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { login } from "../src/core/auth/auth.js";
import { createEmptyLostItem } from "../src/domain/lostItem.js";
import { isInstitutionFind, institutionRightsChecked, finderRecipient, fundReceiptRecipient } from "../src/domain/captureContext.js";
import { validateLostItem } from "../src/domain/lostItem.validators.js";
import { normalizeWorkflow, getWorkflowSummary } from "../src/domain/workflow.js";
import { calculateRetention } from "../src/domain/retention.js";
import * as items from "../src/core/storage/lostItemRepo.js";
import * as workflow from "../src/core/storage/workflowRepo.js";
import { createBackup, restoreBackup } from "../src/core/storage/backup.js";

let store;
beforeEach(() => {
  store = new Map();
  globalThis.localStorage = { get length() { return store.size; }, key: (index) => [...store.keys()][index] ?? null,
    getItem: (key) => store.get(key) ?? null, setItem: (key, value) => store.set(key, String(value)), removeItem: (key) => store.delete(key) };
  assert.equal(login({ username: "admin", password: "admin" }).ok, true);
});
const snapshot = () => [...store];
function input(name = "See-Spital Horgen") {
  const empty = createEmptyLostItem();
  return { ...empty, captureVersion: 1, feeSelection: "NONE", origin: { type: "BUILDING" },
    institution: { name, internalLocation: "TEST Wartebereich", deliveredBy: "TEST Überbringer", deliveringInstitution: name,
      intakeSource: "INSTITUTION", handedToInstitutionDate: "25.10.2026", handedToOfficeDate: "26.10.2026",
      legalFinderName: "", legalFinderContact: "", legalFinderConfirmed: false, reviewNote: "" },
    finder: { ...empty.finder, firstName: "TEST Fundperson", lastName: "Entdecker", rewardChoice: "" },
    foundAt: { date: "25.10.2026", time: "10.00", location: name },
    item: { ...empty.item, manualLabel: "TEST Portemonnaie" },
    retention: { ...empty.retention, custodyBasis: "NOTICE_USER_POLICY", noticeDate: "", noticeTime: "" } };
}
function success(result) { assert.equal(result.ok, true, result.error || JSON.stringify(result)); return result; }
function create(name) { return success(items.commitLostItem(input(name))).item; }
function plan(item, extra = {}) { return workflow.saveWorkflowPlan({ id: item.id, rewardCents: 0, expensesCents: 0, ...extra }); }
function prepare(item, extra = {}) {
  return workflow.prepareWorkflowReceipt({ id: item.id, kind: "FINDER_HANDOVER", recipient: "TEST Stelle",
    parts: [{ partId: "main", quantity: 1 }], ...extra });
}

for (const name of ["See-Spital Horgen", "Migros-Filiale Horgen"]) test(`${name}: Rollen getrennt, keine automatische Finderzuordnung oder private Erwerbsfrist`, () => {
  const item = create(name);
  assert.equal(isInstitutionFind(item), true);
  assert.equal(item.institution.legalFinderName, "");
  assert.equal(institutionRightsChecked(item), false);
  assert.equal(item.finder.rewardChoice, "");
  assert.equal(normalizeWorkflow(item).payments.REWARD.dueCents, 0);
  assert.equal(finderRecipient(item), "");
  assert.equal(fundReceiptRecipient(item), "TEST Überbringer");
  assert.equal(calculateRetention(item).finderAcquisitionReviewDate, "");
  assert.equal(calculateRetention(item).auctionReviewDate, "");
  assert.ok(getWorkflowSummary(item).blockers.some((reason) => reason.includes("Finderstelle")));
});

test("Unbekannte Fundperson ist bei institutioneller Abgabe zulässig; Einrichtung bleibt erforderlich", () => {
  const value = input(); value.finder = {};
  assert.equal(items.commitLostItem(value).ok, true);
  const bad = input(); bad.institution.name = "";
  assert.ok(validateLostItem(bad, { mode: "COMMIT" }).errors["institution.name"]);
});

test("Ungültige Übergabedaten und unbelegte Bestätigung werden abgelehnt", () => {
  const value = input();
  value.institution.handedToOfficeDate = "31.02.2026";
  assert.ok(validateLostItem(value, { mode: "COMMIT" }).errors["institution.handedToOfficeDate"]);
  value.institution.handedToOfficeDate = "26.10.2026";
  value.institution.legalFinderConfirmed = true;
  assert.ok(validateLostItem(value, { mode: "COMMIT" }).errors["institution.reviewNote"]);
});

test("Direkte Personenabgabe und spätere Einrichtungsabgabe bleiben unterscheidbar", () => {
  const value = input(); value.institution.intakeSource = "PERSON"; value.institution.deliveringInstitution = "";
  const draft = success(items.saveDraft(value)).item;
  assert.equal(draft.institution.intakeSource, "PERSON");
  draft.institution.intakeSource = "INSTITUTION"; draft.institution.deliveringInstitution = "TEST Einrichtung";
  const result = success(items.commitLostItem(draft, { fromDraft: true }));
  assert.equal(result.item.institution.intakeSource, "INSTITUTION");
  assert.equal(result.item.institution.deliveringInstitution, "TEST Einrichtung");
  assert.equal(result.item.finder.firstName, "TEST Fundperson");
});

test("Ungeprüfte Finderherausgabe und Finderlohnzahlungen werden ohne Schreibzugriff gesperrt", () => {
  const item = create(); success(plan(item));
  const before = snapshot();
  assert.equal(prepare(item).ok, false);
  assert.equal(workflow.saveWorkflowPlan({ id: item.id, rewardCents: 1000 }).ok, false);
  for (const type of ["IN", "OUT"]) {
    assert.equal(prepare(item, { kind: "PAYMENT", documentKind: "FINDER_HANDOVER", parts: [],
      payments: [{ category: "REWARD", type, amountCents: 1000 }] }).ok, false);
  }
  assert.equal(items.payFinderReward({ id: item.id, amountCents: 1000 }).ok, false);
  assert.equal(items.receiveOwnerReward({ id: item.id, amountCents: 1000 }).ok, false);
  assert.deepEqual(snapshot(), before);
});

test("Manuell geprüfte Finderstelle erlaubt dokumentierte Übergabe und separaten Auslagenersatz", () => {
  let item = create();
  item = success(items.updateLostItem({ ...item, institution: { ...item.institution,
    legalFinderName: "TEST Betreiber See-Spital", legalFinderConfirmed: true, reviewNote: "TEST geprüfte Zuständigkeit und Vollmacht" } })).item;
  assert.equal(finderRecipient(item), "TEST Betreiber See-Spital");
  success(plan(item, { expensesCents: 500, expensesRecipient: "FINDER" }));
  const job = success(prepare(item, { payments: [
    { category: "EXPENSES", type: "IN", amountCents: 500 }, { category: "EXPENSES", type: "OUT", amountCents: 500 },
  ] })).job;
  const confirmed = success(workflow.confirmWorkflowReceipt({ job, confirmed: true }));
  assert.equal(confirmed.item.workflow.payments.REWARD.paidCents, 0);
  assert.equal(confirmed.item.workflow.payments.EXPENSES.paidCents, 500);
  assert.equal(confirmed.receipt.itemSnapshot.institution.legalFinderName, "TEST Betreiber See-Spital");
  assert.equal(items.listCashbookEntries().length, 2);
});

test("Fundquittung funktioniert ohne Rechtebestätigung und enthält getrennte Rollen im Snapshot", () => {
  const item = create();
  const before = snapshot();
  const job = success(prepare(item, { kind: "FUND", parts: [], recipient: fundReceiptRecipient(item) })).job;
  assert.equal(job.item.institution.deliveredBy, "TEST Überbringer");
  assert.equal(job.item.finder.firstName, "TEST Fundperson");
  assert.deepEqual(snapshot(), before);
  success(workflow.confirmWorkflowReceipt({ job, confirmed: true }));
  assert.equal(items.getLostItemById(item.id).status, "OPEN");
  const changed = success(items.updateLostItem({ ...items.getLostItemById(item.id), institution: { ...item.institution, name: "TEST neuer Name" } })).item;
  const reprint = success(workflow.reprintWorkflowReceipt({ id: changed.id, receiptId: job.receipt.id }));
  assert.equal(reprint.job.item.institution.name, item.institution.name);
});

test("Historische Finderlohnbuchungen werden nicht durch eine neue Fundart oder Verzicht gelöscht", () => {
  const item = input(); item.finder.rewardChoice = "WAIVED";
  item.workflow = normalizeWorkflow({ ...item, origin: { type: "PUBLIC_GROUND" }, finder: { rewardChoice: "REQUESTED" } });
  item.workflow.payments.REWARD = { dueCents: 1000, receivedCents: 1000, paidCents: 500 };
  const normalized = normalizeWorkflow(item);
  assert.deepEqual(normalized.payments.REWARD, { dueCents: 1000, receivedCents: 1000, paidCents: 500 });
  assert.ok(getWorkflowSummary(item).blockers.some((reason) => reason.includes("Historische Finderlohnbeträge")));
});

test("Sicherung, Suche und Audit erhalten Einrichtungen, Übergabekette und Finderzuordnung", () => {
  const item = create("Migros-Filiale Horgen");
  const before = createBackup();
  assert.equal(items.searchLostItems({ finder: "Migros" }).length, 1);
  const changed = success(items.updateLostItem({ ...item, institution: { ...item.institution, legalFinderName: "TEST Betreiber" } })).item;
  assert.equal(changed.institution.legalFinderName, "TEST Betreiber");
  assert.ok(items.listAuditLog().some((entry) => entry.diff?.some((row) => row.path === "institution.legalFinderName")));
  restoreBackup(before, { confirmed: true });
  assert.deepEqual(items.getLostItemById(item.id).institution, item.institution);
});
