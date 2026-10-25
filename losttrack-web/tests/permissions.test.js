import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { can } from "../src/core/auth/permissions.js";
import { login, logout, hasPermission } from "../src/core/auth/auth.js";
import { createUser, updateUser } from "../src/core/storage/userRepo.js";
import { createEmptyLostItem } from "../src/domain/lostItem.js";
import * as repo from "../src/core/storage/lostItemRepo.js";
import { commitNextFundNumber } from "../src/utils/fundNumber.js";

let data;
let item;
let draft;
let step;
let editor;
let viewer;
const signIn = (username) => assert.equal(login({ username, password: username }).ok, true);
const snapshot = () => [...data.entries()].sort(([a], [b]) => a.localeCompare(b));

beforeEach(() => {
  data = new Map();
  globalThis.localStorage = {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, String(value)),
  };
  signIn("admin");
  editor = createUser({ name: "Editor", username: "editor", password: "editor", role: "EDITOR", active: true }).value;
  viewer = createUser({ name: "Viewer", username: "viewer", password: "viewer", role: "VIEWER", active: true }).value;
  const input = createEmptyLostItem();
  input.caseWorker = { id: "test", name: "Test" };
  input.foundAt = { date: "25.10.2026", time: "10.00", location: "Testort" };
  input.finder = { firstName: "Finder", rewardRequested: true, rewardChoice: "REQUESTED" };
  input.item.manualLabel = "Testgegenstand";
  const committed = repo.commitLostItem(input);
  assert.equal(committed.ok, true);
  item = committed.item;
  draft = repo.saveDraft({ ...input, id: "draft-test", fundNo: "" }).item;
  step = repo.addInvestigationStep({ id: item.id, step: { who: "Test", what: "Ermittelt" } }).step;
});

const writes = [
  ["Entwurf speichern", () => repo.saveDraft(draft)],
  ["Entwurf definitiv erfassen", () => repo.commitLostItem(draft)],
  ["Fundsache bearbeiten", () => repo.updateLostItem(item)],
  ["Status ändern", () => repo.changeLostItemStatus({ id: item.id, newStatus: "RETURNED" })],
  ["Verwertung speichern", () => repo.disposeLostItem({ id: item.id, dispositionType: "RECYCLE" })],
  ["Finder ändern", () => repo.updateFinder({ id: item.id, finder: { firstName: "Neu", rewardChoice: "WAIVED" } })],
  ["Eigentümer ändern", () => repo.updateOwner({ id: item.id, owner: { firstName: "Neu" } })],
  ["Abholer ändern", () => repo.updateCollector({ id: item.id, collector: { firstName: "Neu" } })],
  ["Ermittlungsschritt hinzufügen", () => repo.addInvestigationStep({ id: item.id, step: { who: "Test", what: "Neu" } })],
  ["Ermittlungsschritt löschen", () => repo.deleteInvestigationStep({ id: item.id, stepId: step.id })],
  ["Kassenbucheintrag schreiben", () => repo.postCashbookEntry({ type: "IN", amountCents: 500, item })],
  ["Finderlohn einzahlen", () => repo.receiveOwnerReward({ id: item.id, amountCents: 500 })],
  ["Finderlohn auszahlen", () => repo.payFinderReward({ id: item.id, amountCents: 500 })],
  ["Fundquittung erstellen", () => repo.createReceipt({ id: item.id, receiptType: "FUND_RECEIPT", recipient: "Finder" })],
  ["Quittung mit Einzahlung drucken", () => repo.printReceipt({ id: item.id, receiptType: "OWNER_RECEIPT", amount: 5 })],
  ["Quittung mit Auszahlung drucken", () => repo.printReceipt({ id: item.id, receiptType: "FINDER_RECEIPT", amount: 5, notes: "Finderlohn-Abholung" })],
];

const deniedSessions = {
  VIEWER: () => signIn("viewer"),
  abgemeldet: () => logout(),
  deaktiviert: () => {
    assert.equal(updateUser(editor.id, { active: false }).ok, true);
    localStorage.setItem("losttrack:lostItems.session.v1", JSON.stringify({ userId: editor.id }));
  },
  "unbekannte Rolle": () => {
    const users = JSON.parse(localStorage.getItem("losttrack:lostItems.users.v2"));
    users.find((u) => u.id === viewer.id).role = "UNBEKANNT";
    localStorage.setItem("losttrack:lostItems.users.v2", JSON.stringify(users));
    signIn("viewer");
  },
};

for (const [session, activate] of Object.entries(deniedSessions)) {
  for (const [name, write] of writes) {
    test(`${session}: ${name} wird ohne Datenänderung abgewiesen`, () => {
      activate();
      const before = snapshot();
      const result = write();
      assert.equal(result.ok, false);
      assert.match(result.error, /Berechtigung/);
      assert.deepEqual(snapshot(), before, "Auch Protokolle, Nummernzähler und Buchungen müssen unverändert bleiben");
    });
  }
  test(`${session}: Fundnummernzähler bleibt unverändert`, () => {
    activate();
    const before = snapshot();
    assert.equal(commitNextFundNumber(), null);
    assert.deepEqual(snapshot(), before);
  });
}

for (const role of ["admin", "editor"]) {
  for (const [name, write] of writes) {
    test(`${role}: ${name} ist weiterhin möglich`, () => {
      signIn(role);
      const before = snapshot();
      const result = write();
      assert.notEqual(result.ok, false, JSON.stringify(result));
      assert.notDeepEqual(snapshot(), before);
      assert.equal(repo.verifyCashbookChain().ok, true);
    });
  }
}

test("VIEWER kann Fundsachen, Entwürfe, Protokolle und Kassenbuch ohne Änderungen lesen", () => {
  repo.postCashbookEntry({ type: "IN", amountCents: 500, item });
  signIn("viewer");
  const before = snapshot();
  assert.equal(repo.listLostItems().length, 1);
  assert.equal(repo.getLostItemById(item.id).id, item.id);
  assert.equal(repo.listDrafts().length, 1);
  assert.equal(repo.searchLostItems({ item: "Testgegenstand" }).length, 1);
  assert.ok(repo.listAuditLog().length > 0);
  assert.equal(repo.listCashbookEntries().length, 1);
  assert.equal(repo.getCashbookTotals().inCents, 500);
  assert.equal(repo.verifyCashbookChain().ok, true);
  assert.equal(hasPermission("ITEM_VIEW"), true);
  assert.equal(hasPermission("CASHBOOK_VIEW"), true);
  assert.deepEqual(snapshot(), before);
});

test("Rechte werden bei jedem Aufruf neu geprüft, auch nach Rollenwechsel", () => {
  // Ein zuvor geöffneter Editor-Bildschirm darf nach Herabstufung nicht schreiben.
  assert.equal(updateUser(editor.id, { role: "VIEWER" }).ok, true);
  signIn("editor");
  const before = snapshot();
  assert.equal(repo.changeLostItemStatus({ id: item.id, newStatus: "RETURNED" }).ok, false);
  assert.deepEqual(snapshot(), before);
});

test("Gemeinsame Rechteprüfung verweigert fehlende Benutzer und unbekannte Aktionen", () => {
  assert.equal(can(null, "ITEM_EDIT"), false);
  assert.equal(can({ role: "ADMIN", active: false }, "ITEM_EDIT"), false);
  assert.equal(can({ role: "ADMIN", disabled: true }, "ITEM_EDIT"), false);
  assert.equal(can({ role: "UNBEKANNT", active: true }, "ITEM_VIEW"), false);
  assert.equal(can({ role: "ADMIN", active: true }, "UNBEKANNT"), false);
});
