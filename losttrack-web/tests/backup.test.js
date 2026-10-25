import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { createBackup, inspectBackup, restoreBackup, MAX_BACKUP_BYTES } from "../src/core/storage/backup.js";
import { login, logout, isLoggedIn } from "../src/core/auth/auth.js";
import { createUser } from "../src/core/storage/userRepo.js";
import { createEmptyLostItem } from "../src/domain/lostItem.js";
import * as repo from "../src/core/storage/lostItemRepo.js";
import { commitNextFundNumber } from "../src/utils/fundNumber.js";

const PREFIX = "losttrack:lostItems.";
let data;
let failWrite;
let item;
const snapshot = () => [...data.entries()].sort(([a], [b]) => a.localeCompare(b));
const signIn = (username = "admin") => assert.equal(login({ username, password: username }).ok, true);

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
  for (const role of ["EDITOR", "VIEWER"]) {
    const username = role.toLowerCase();
    assert.equal(createUser({ name: role, username, password: username, role, active: true }).ok, true);
  }
  const input = createEmptyLostItem();
  input.caseWorker = { id: "test", name: "Test" };
  input.foundAt = { date: "25.10.2026", time: "10.00", location: "Testort" };
  input.finder = { firstName: "Finder", rewardChoice: "WAIVED" };
  input.item.manualLabel = "Testgegenstand";
  item = repo.commitLostItem(input).item;
  repo.saveDraft({ ...input, id: "draft-test", fundNo: "" });
  repo.addInvestigationStep({ id: item.id, step: { who: "Test", what: "Ermittelt" } });
  repo.createReceipt({ id: item.id, receiptType: "FUND_RECEIPT", recipient: "Finder" });
  repo.postCashbookEntry({ type: "IN", amountCents: 500, item });
  commitNextFundNumber();
  localStorage.setItem("fremde-app", "fremde Daten");
  localStorage.setItem("losttrack_users_v1", JSON.stringify([{ id: "alt", name: "Alt" }]));
  localStorage.setItem("losttrack:drafts:v1", JSON.stringify([{ id: "alter-entwurf" }]));
});

test("Export enthält alle vorhandenen Geschäftsbereiche, keine Sitzung oder fremden Daten", () => {
  const before = snapshot();
  const text = createBackup();
  const backup = JSON.parse(text);
  const summary = inspectBackup(text);
  assert.equal(backup.format, "LostTrackBackup");
  assert.equal(backup.version, 1);
  assert.deepEqual({ ...summary, createdAt: null }, { createdAt: null, records: 1, drafts: 1, users: 3, audit: repo.listAuditLog().length, cashbook: 1 });
  assert.equal(Object.hasOwn(backup.data, `${PREFIX}session.v1`), false);
  assert.equal(Object.hasOwn(backup.data, "fremde-app"), false);
  for (const [key, value] of data) {
    if (key !== `${PREFIX}session.v1` && key !== "fremde-app") assert.equal(backup.data[key], value, key);
  }
  assert.deepEqual(snapshot(), before, "Export und Vorschau verändern keine Daten");
});

test("Wiederherstellung ersetzt exakt, erhält Quittungen und Protokolle und meldet ab", () => {
  const text = createBackup();
  const expected = JSON.parse(text).data;
  repo.changeLostItemStatus({ id: item.id, newStatus: "RETURNED" });
  repo.postCashbookEntry({ type: "OUT", amountCents: 100, item });
  createUser({ name: "Neu", username: "neu", password: "neu", role: "VIEWER" });
  localStorage.setItem("losttrack_fundcounter_2030", "123");
  localStorage.setItem(`${PREFIX}users.v1`, "[]");
  const summary = restoreBackup(text, { confirmed: true });
  assert.equal(summary.records, 1);
  assert.equal(localStorage.getItem(`${PREFIX}session.v1`), null);
  assert.equal(localStorage.getItem("losttrack_fundcounter_2030"), null);
  assert.equal(localStorage.getItem(`${PREFIX}users.v1`), null);
  for (const [key, value] of Object.entries(expected)) assert.equal(localStorage.getItem(key), value, key);
  assert.equal(localStorage.getItem("fremde-app"), "fremde Daten");
  assert.equal(isLoggedIn(), false);
  signIn();
  assert.equal(repo.getLostItemById(item.id).status, "OPEN");
  assert.equal(repo.getLostItemById(item.id).receipts.length, 1);
  assert.equal(repo.verifyCashbookChain().ok, true);
});

test("Nummernzähler laufen nach einer Wiederherstellung weiter", () => {
  const text = createBackup();
  const counter = Number(localStorage.getItem(`losttrack_fundcounter_${new Date().getFullYear()}`));
  restoreBackup(text, { confirmed: true });
  signIn();
  assert.equal(commitNextFundNumber(), `${new Date().getFullYear()}-${String(counter + 1).padStart(5, "0")}`);
  const receipt = repo.createReceipt({ id: item.id, receiptType: "FUND_RECEIPT" });
  assert.equal(receipt.ok, true);
  assert.match(receipt.receipt.id, /-0002$/);
});

test("Sicherung lässt sich in einem frisch eingerichteten Browserbestand wiederherstellen", () => {
  const text = createBackup();
  const expectedId = item.id;
  data.clear();
  signIn();
  assert.equal(repo.listLostItems().length, 0);
  restoreBackup(text, { confirmed: true });
  assert.equal(isLoggedIn(), false);
  signIn("editor");
  assert.equal(repo.getLostItemById(expectedId).receipts.length, 1);
  assert.equal(repo.listCashbookEntries().length, 1);
  assert.equal(repo.verifyCashbookChain().ok, true);
});

test("Frischer Browserbestand kann mit leeren Geschäftsbereichen gesichert werden", () => {
  data.clear();
  signIn();
  const summary = inspectBackup(createBackup());
  assert.equal(summary.records, 0);
  assert.equal(summary.drafts, 0);
  assert.equal(summary.cashbook, 0);
  assert.equal(summary.users, 1);
});

for (const role of ["editor", "viewer", "abgemeldet"]) {
  test(`${role} darf weder exportieren, prüfen noch wiederherstellen`, () => {
    const text = createBackup();
    if (role === "abgemeldet") logout(); else signIn(role);
    const before = snapshot();
    assert.throws(() => createBackup(), /ADMIN/);
    assert.throws(() => inspectBackup(text), /ADMIN/);
    assert.throws(() => restoreBackup(text, { confirmed: true }), /ADMIN/);
    assert.deepEqual(snapshot(), before);
  });
}

test("Ohne ausdrückliche Bestätigung werden keine Daten ersetzt", () => {
  const text = createBackup();
  const before = snapshot();
  assert.throws(() => restoreBackup(text), /bestätigt/);
  assert.throws(() => restoreBackup(text, { confirmed: "ja" }), /bestätigt/);
  assert.deepEqual(snapshot(), before);
});

const corruptions = [
  ["falsches Format", (b) => { b.format = "AndereApp"; }],
  ["unbekannte Version", (b) => { b.version = 2; }],
  ["ungültiges Datum", (b) => { b.createdAt = "unbekannt"; }],
  ["fehlender Bereich", (b) => { delete b.data[`${PREFIX}records.v1`]; }],
  ["fremder Schlüssel", (b) => { b.data["fremde-app"] = '"überschrieben"'; }],
  ["eingeschleuste Sitzung", (b) => { b.data[`${PREFIX}session.v1`] = '{"userId":"u_admin"}'; }],
  ["beschädigtes JSON", (b) => { b.data[`${PREFIX}records.v1`] = "{"; }],
  ["falscher Listentyp", (b) => { b.data[`${PREFIX}drafts.v1`] = "{}"; }],
  ["unbrauchbare Fundsache", (b) => { b.data[`${PREFIX}records.v1`] = '[{"id":"x"}]'; }],
  ["doppelte Fundsache", (b) => {
    const items = JSON.parse(b.data[`${PREFIX}records.v1`]);
    b.data[`${PREFIX}records.v1`] = JSON.stringify([...items, items[0]]);
  }],
  ["fehlendes Admin-Konto", (b) => { b.data[`${PREFIX}users.v2`] = "[]"; }],
  ["doppelter Benutzer", (b) => {
    const users = JSON.parse(b.data[`${PREFIX}users.v2`]);
    b.data[`${PREFIX}users.v2`] = JSON.stringify([...users, users[0]]);
  }],
  ["ungültige Passwortdaten", (b) => {
    const users = JSON.parse(b.data[`${PREFIX}users.v2`]);
    users[0].passwordHash = "beliebig";
    b.data[`${PREFIX}users.v2`] = JSON.stringify(users);
  }],
  ["negativer Zähler", (b) => { b.data[`${PREFIX}counters.v1`] = '{"receipt:2026":-1}'; }],
  ["ungültiger Fundzähler", (b) => { b.data.losttrack_fundcounter_2030 = "1.5"; }],
  ["veränderte Kassenbuchung", (b) => {
    const ledger = JSON.parse(b.data[`${PREFIX}cashbook.v1`]);
    ledger[0].amountCents = 999;
    b.data[`${PREFIX}cashbook.v1`] = JSON.stringify(ledger);
  }],
];
for (const [name, corrupt] of corruptions) {
  test(`Ungültige Sicherung (${name}) wird vor jeder Änderung abgewiesen`, () => {
    const backup = JSON.parse(createBackup());
    corrupt(backup);
    const text = JSON.stringify(backup);
    const before = snapshot();
    assert.throws(() => inspectBackup(text));
    assert.throws(() => restoreBackup(text, { confirmed: true }));
    assert.deepEqual(snapshot(), before);
  });
}

test("Unlesbare und zu große Dateien werden abgewiesen", () => {
  const before = snapshot();
  assert.throws(() => inspectBackup("keine JSON-Datei"), /JSON/);
  assert.throws(() => inspectBackup(" ".repeat(MAX_BACKUP_BYTES + 1)), /groß/);
  assert.deepEqual(snapshot(), before);
});

test("Speicherfehler setzt alle alten Daten und die Sitzung zurück", () => {
  const text = createBackup();
  repo.changeLostItemStatus({ id: item.id, newStatus: "RETURNED" });
  const before = snapshot();
  let failed = false;
  failWrite = (key) => {
    if (!failed && key === `${PREFIX}users.v2`) {
      failed = true;
      throw new Error("QuotaExceededError");
    }
  };
  assert.throws(() => restoreBackup(text, { confirmed: true }), /vorherige Datenstand wurde zurückgesetzt/);
  assert.equal(failed, true);
  assert.deepEqual(snapshot(), before);
  assert.equal(isLoggedIn(), true);
});

test("Auch ein fehlgeschlagenes Zurücksetzen wird ausdrücklich gemeldet", () => {
  const text = createBackup();
  failWrite = () => { throw new Error("Speicher nicht verfügbar"); };
  assert.throws(() => restoreBackup(text, { confirmed: true }), /Nicht weiterarbeiten/);
});
