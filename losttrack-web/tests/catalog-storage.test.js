import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { CATALOG_KEY, defaultCatalog } from "../src/domain/catalogModel.js";
import { getCatalog, saveCatalog } from "../src/core/storage/catalogRepo.js";
import { searchItems, selectCatalogItem } from "../src/domain/itemCatalog.js";
import { login, logout } from "../src/core/auth/auth.js";
import { createUser } from "../src/core/storage/userRepo.js";
import { createBackup, inspectBackup, restoreBackup } from "../src/core/storage/backup.js";

let data;
beforeEach(() => {
  data = new Map();
  globalThis.localStorage = {
    get length() { return data.size; }, key: (index) => [...data.keys()][index] ?? null,
    getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
  };
  assert.equal(login({ username: "admin", password: "admin" }).ok, true);
});

function extend() {
  const catalog = getCatalog();
  catalog.groups.push({ id: "test-group", label: "Testgruppe" });
  catalog.items.push({ key: "test-item", label: "Testgegenstand", groupId: "test-group",
    aliases: ["Testsynonym"], feeCode: "NONE", active: true });
  return catalog;
}

test("Lesen des Ausgangskatalogs schreibt nichts und liefert unabhängige Kopien", () => {
  const before = [...data];
  const catalog = getCatalog();
  assert.equal(catalog.items.length, 80);
  catalog.items[0].aliases.push("verändert");
  assert.notDeepEqual(catalog, getCatalog());
  assert.deepEqual([...data], before);
});

test("ADMIN ergänzt Gruppe, Gegenstand und Suchwörter mit protokolliertem Stand", () => {
  const result = saveCatalog(extend(), 0);
  assert.equal(result.ok, true);
  assert.equal(getCatalog().revision, 1);
  assert.equal(searchItems("Testsynonym")[0].key, "test-item");
  assert.equal(selectCatalogItem({ item: {} }, "test-item").feeSelection, "NONE");
  assert.equal(getCatalog().history[0].changes.length, 2);
  assert.equal(getCatalog().history[0].by, "Admin");
});

test("Umbenennen und Umgruppieren ändert bestehende Fundsachen und Gebühren nicht", () => {
  const saved = selectCatalogItem({ item: {} }, "phone");
  const original = structuredClone(saved);
  const catalog = extend();
  const phone = catalog.items.find((item) => item.key === "phone");
  phone.label = "Mobilgerät"; phone.aliases.push("Funkgerät"); phone.groupId = "test-group"; phone.feeCode = "NONE";
  catalog.groups[0].label = "Zugangsmittel";
  assert.equal(saveCatalog(catalog, 0).ok, true);
  assert.equal(searchItems("Funkgerät")[0].label, "Mobilgerät");
  assert.equal(searchItems("Zugangsmittel").length > 0, true);
  assert.equal(selectCatalogItem({ item: {} }, "phone").feeSelection, "NONE");
  assert.deepEqual(saved, original);
  assert.equal(getCatalog().history[0].changes.find((row) => row.id === "phone").before.label, "Mobiltelefon");
});

test("Deaktivierte Gegenstände sind nicht neu auswählbar; ihre Daten bleiben erhalten", () => {
  const catalog = getCatalog();
  catalog.items.find((item) => item.key === "phone").active = false;
  assert.equal(saveCatalog(catalog, 0).ok, true);
  assert.equal(searchItems("Natel").length, 0);
  const old = { item: { predefinedKey: "phone", manualLabel: "Mobiltelefon" } };
  assert.equal(selectCatalogItem(old, "phone"), old);
  assert.ok(getCatalog().items.some((item) => item.key === "phone"));
});

for (const role of ["EDITOR", "VIEWER"]) test(`${role} darf Stammdaten lesen, aber nicht speichern`, () => {
  assert.equal(createUser({ username: role, name: role, password: "test-password", role, active: true }).ok, true);
  assert.equal(login({ username: role, password: "test-password" }).ok, true);
  const before = [...data];
  assert.equal(getCatalog().items.length, 80);
  assert.equal(saveCatalog(extend(), 0).ok, false);
  assert.deepEqual([...data], before);
});

test("Abgemeldete und deaktivierte Benutzer dürfen nicht schreiben", () => {
  const catalog = extend();
  logout();
  assert.equal(saveCatalog(catalog, 0).ok, false);
  login({ username: "admin", password: "admin" });
  const key = "losttrack:lostItems.users.v2";
  const users = JSON.parse(localStorage.getItem(key));
  users[0].active = false; localStorage.setItem(key, JSON.stringify(users));
  assert.equal(saveCatalog(catalog, 0).ok, false);
  assert.equal(localStorage.getItem(CATALOG_KEY), null);
});

for (const [name, mutate] of [
  ["doppelter Gruppenname", (c) => { c.groups[1].label = c.groups[0].label; }],
  ["doppelter Gegenstand", (c) => { c.items[1].label = c.items[0].label; }],
  ["fehlende Gruppe", (c) => { c.items[0].groupId = "unbekannt"; }],
  ["ungültige Gebühr", (c) => { c.items[0].feeCode = "CHF_999"; }],
  ["leerer Name", (c) => { c.items[0].label = ""; }],
  ["doppelte Suchwörter", (c) => { c.items[0].aliases = ["Natel", "natel"]; }],
  ["entfernter Gegenstand", (c) => { c.items.pop(); }],
  ["entfernte Gruppe", (c) => { c.groups.pop(); }],
]) test(`Ungültige Stammdaten werden ohne Schreibzugriff abgelehnt: ${name}`, () => {
  const catalog = getCatalog(); mutate(catalog);
  const before = [...data];
  assert.equal(saveCatalog(catalog, 0).ok, false);
  assert.deepEqual([...data], before);
});

test("Ein veralteter Bearbeitungsstand überschreibt keine zwischenzeitlichen Änderungen", () => {
  assert.equal(saveCatalog(extend(), 0).ok, true);
  const before = localStorage.getItem(CATALOG_KEY);
  assert.equal(saveCatalog(defaultCatalog(), 0).ok, false);
  assert.equal(localStorage.getItem(CATALOG_KEY), before);
});

test("Speicherfehler erhält den vorherigen Katalog", () => {
  const before = getCatalog();
  const write = localStorage.setItem;
  localStorage.setItem = () => { throw new Error("Speicher voll"); };
  assert.equal(saveCatalog(extend(), 0).ok, false);
  localStorage.setItem = write;
  assert.deepEqual(getCatalog(), before);
});

test("Sicherung und Wiederherstellung enthalten Stammdaten samt Änderungsverlauf", () => {
  assert.equal(saveCatalog(extend(), 0).ok, true);
  const before = getCatalog();
  const backup = createBackup();
  assert.ok(JSON.parse(backup).data[CATALOG_KEY]);
  const changed = getCatalog(); changed.items[0].label = "Neuer Name";
  assert.equal(saveCatalog(changed, 1).ok, true);
  restoreBackup(backup, { confirmed: true });
  assert.deepEqual(getCatalog(), before);
});

test("Alte Sicherung ohne Stammdaten stellt wieder den Ausgangskatalog her", () => {
  const oldBackup = createBackup();
  assert.equal(saveCatalog(extend(), 0).ok, true);
  restoreBackup(oldBackup, { confirmed: true });
  assert.deepEqual(getCatalog(), defaultCatalog());
});

test("Beschädigter Katalog und fehlerhafte Sicherung werden ausdrücklich abgelehnt", () => {
  const backup = JSON.parse(createBackup());
  const broken = defaultCatalog(); broken.items[0].groupId = "nicht-vorhanden";
  backup.data[CATALOG_KEY] = JSON.stringify(broken);
  const before = [...data];
  assert.throws(() => inspectBackup(JSON.stringify(backup)), /Stammdaten/);
  assert.deepEqual([...data], before);
  localStorage.setItem(CATALOG_KEY, "kein JSON");
  assert.throws(() => getCatalog(), /beschädigt/);
});
