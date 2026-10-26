import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { createEmptyLostItem } from "../src/domain/lostItem.js";
import { login } from "../src/core/auth/auth.js";
import { createUser } from "../src/core/storage/userRepo.js";
import { createBackup, restoreBackup } from "../src/core/storage/backup.js";
import { saveDraft, listDrafts, getDraftById, commitLostItem, listLostItems,
  listAuditLog, updateLostItem } from "../src/core/storage/lostItemRepo.js";

let data;
const snapshot = () => [...data.entries()];
const signIn = (username = "admin") => assert.equal(login({ username, password: username }).ok, true);

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
});

function complete(draft) {
  return { ...draft, caseWorker: { id: "test", name: "Test" },
    foundAt: { date: "25.10.2026", time: "10.00", location: "Testort" },
    finder: { firstName: "Finder", rewardChoice: "WAIVED" },
    item: { ...draft.item, manualLabel: "Schlüsselbund" } };
}

test("Neue Entwürfe erhalten unterschiedliche feste IDs ohne Fundnummernvergabe", () => {
  const first = saveDraft(createEmptyLostItem());
  const second = saveDraft(createEmptyLostItem());
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.ok(first.item.id);
  assert.notEqual(first.item.id, second.item.id);
  assert.equal(listDrafts().length, 2);
  assert.equal(listLostItems().length, 0);
  assert.equal(localStorage.getItem("losttrack:lostItems.counters.v1"), null);
});

test("Entwurf öffnen, ergänzen und mehrfach speichern aktualisiert denselben Eintrag", () => {
  const first = saveDraft(createEmptyLostItem()).item;
  const loaded = getDraftById(first.id);
  assert.deepEqual(loaded, first);
  loaded.item.manualLabel = "Schlüsselbund";
  loaded.foundAt.location = "Bahnhof";
  for (let i = 0; i < 3; i++) {
    const result = saveDraft(loaded, { fromDraft: true });
    assert.equal(result.ok, true);
    assert.equal(result.item.id, first.id);
    assert.equal(result.item.createdAt, first.createdAt);
  }
  assert.equal(listDrafts().length, 1);
  assert.equal(getDraftById(first.id).item.manualLabel, "Schlüsselbund");
  assert.equal(getDraftById(first.id).foundAt.location, "Bahnhof");
  assert.equal(listLostItems().length, 0);
  assert.ok(listAuditLog().some((e) => e.type === "DRAFT_SAVED" && e.diff?.length));
});

test("Unvollständiger Entwurf bleibt nach fehlgeschlagener definitiver Übernahme erhalten", () => {
  const draft = saveDraft(createEmptyLostItem()).item;
  const before = snapshot();
  assert.equal(commitLostItem(draft, { fromDraft: true }).ok, false);
  assert.deepEqual(snapshot(), before);
  assert.equal(listDrafts().length, 1);
});

test("Definitive Übernahme entfernt nur den gewählten Entwurf und protokolliert einmal", () => {
  const draft = saveDraft(complete(createEmptyLostItem())).item;
  const other = saveDraft(createEmptyLostItem()).item;
  const result = commitLostItem(draft, { fromDraft: true });
  assert.equal(result.ok, true);
  assert.equal(result.item.id, draft.id);
  assert.match(result.item.fundNo, /^\d{4}-\d{5}$/);
  assert.equal(getDraftById(draft.id), null);
  assert.equal(getDraftById(other.id).id, other.id);
  assert.equal(listLostItems().length, 1);
  assert.equal(listAuditLog().filter((e) => e.type === "ITEM_COMMITTED").length, 1);
});

test("Erneute Übernahme verändert weder endgültige Fundsache noch Zähler oder Protokoll", () => {
  const draft = saveDraft(complete(createEmptyLostItem())).item;
  const first = commitLostItem(draft, { fromDraft: true });
  // Nachträgliche Bearbeitung darf nicht durch einen alten geöffneten Entwurf verloren gehen.
  assert.equal(updateLostItem({ ...first.item, item: { ...first.item.item, description: "Aktuelle Beschreibung" } }).ok, true);
  const before = snapshot();
  const second = commitLostItem(draft, { fromDraft: true });
  assert.equal(second.ok, true);
  assert.equal(second.alreadyCommitted, true);
  assert.equal(second.item.fundNo, first.item.fundNo);
  assert.equal(second.item.item.description, "Aktuelle Beschreibung");
  assert.deepEqual(snapshot(), before);
});

test("Definitive Fundsachen können nicht erneut als Entwurf gespeichert werden", () => {
  const draft = saveDraft(complete(createEmptyLostItem())).item;
  commitLostItem(draft, { fromDraft: true });
  const before = snapshot();
  assert.equal(saveDraft(draft, { fromDraft: true }).ok, false);
  assert.deepEqual(snapshot(), before);
  assert.equal(listDrafts().length, 0);
});

test("Fehlender Entwurf wird beim Laden, Speichern und Übernehmen nicht neu angelegt", () => {
  const missing = { ...complete(createEmptyLostItem()), id: "nicht-vorhanden" };
  const before = snapshot();
  assert.equal(getDraftById(missing.id), null);
  assert.equal(saveDraft(missing, { fromDraft: true }).ok, false);
  assert.equal(commitLostItem(missing, { fromDraft: true }).ok, false);
  assert.deepEqual(snapshot(), before);
});

test("Alte Entwürfe ohne ID bleiben beim Lesen unverändert und lassen sich weiterbearbeiten", () => {
  const raw = JSON.stringify([createEmptyLostItem(), { ...createEmptyLostItem(), notes: "Zweiter Altentwurf" }]);
  localStorage.setItem("losttrack:lostItems.drafts.v1", raw);
  const listed = listDrafts();
  assert.notEqual(listed[0].id, listed[1].id);
  assert.equal(localStorage.getItem("losttrack:lostItems.drafts.v1"), raw);
  const first = getDraftById(listed[0].id);
  const saved = saveDraft({ ...first, notes: "Ergänzt" }, { fromDraft: true });
  assert.equal(saved.ok, true);
  assert.equal(saved.item.id, listed[0].id);
  assert.equal(listDrafts().length, 2);
  assert.equal(getDraftById(saved.item.id).notes, "Ergänzt");
});

test("Alten Entwurf ohne ID direkt übernehmen entfernt ihn aus der Liste", () => {
  localStorage.setItem("losttrack:lostItems.drafts.v1", JSON.stringify([complete(createEmptyLostItem())]));
  const draft = listDrafts()[0];
  assert.equal(commitLostItem(draft, { fromDraft: true }).ok, true);
  assert.equal(listDrafts().length, 0);
  assert.equal(listLostItems().length, 1);
  const before = snapshot();
  assert.equal(commitLostItem(draft, { fromDraft: true }).alreadyCommitted, true);
  assert.deepEqual(snapshot(), before);
});

test("Entwurfs-ID und Angaben überstehen eine Sicherung und Wiederherstellung", () => {
  const draft = saveDraft(createEmptyLostItem()).item;
  const text = createBackup();
  restoreBackup(text, { confirmed: true });
  signIn();
  assert.deepEqual(getDraftById(draft.id), draft);
  assert.equal(saveDraft({ ...draft, notes: "Nach Wiederherstellung" }, { fromDraft: true }).ok, true);
  assert.equal(listDrafts().length, 1);
});

test("VIEWER kann auch weiterbearbeitete Entwürfe nicht speichern oder übernehmen", () => {
  const draft = saveDraft(complete(createEmptyLostItem())).item;
  createUser({ name: "Viewer", username: "viewer", password: "viewer", role: "VIEWER" });
  signIn("viewer");
  const before = snapshot();
  assert.equal(getDraftById(draft.id).id, draft.id);
  assert.equal(saveDraft(draft, { fromDraft: true }).ok, false);
  assert.equal(commitLostItem(draft, { fromDraft: true }).ok, false);
  assert.deepEqual(snapshot(), before);
});
