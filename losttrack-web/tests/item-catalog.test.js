import { test } from "node:test";
import assert from "node:assert/strict";
import { ITEM_CATALOG } from "../src/data/itemCatalog.js";
import { searchItems, catalogFee, selectCatalogItem } from "../src/domain/itemCatalog.js";
import { normalizeWorkflow } from "../src/domain/workflow.js";
import { normalizeLostItem } from "../src/domain/lostItem.js";

test("Alle 80 Gegenstände sind eindeutig und über ihre Suchwörter auffindbar", () => {
  assert.equal(ITEM_CATALOG.length, 80);
  assert.equal(new Set(ITEM_CATALOG.map((entry) => entry.key)).size, 80);
  for (const entry of ITEM_CATALOG) for (const query of [entry.label, ...entry.aliases]) {
    assert.ok(searchItems(query).some((match) => match.key === entry.key), query);
  }
});

test("Schweizer Synonyme, Umlaute und mehrdeutige Wörter", () => {
  for (const query of ["Handy", "Natel", " SMARTPHONE "]) assert.ok(searchItems(query).some((x) => x.key === "phone"));
  for (const query of ["Schal", "Foular", "Foulard"]) assert.ok(searchItems(query).some((x) => x.key === "scarf"));
  assert.ok(searchItems("Schluesselbund").some((x) => x.key === "key_bundle"));
  assert.ok(searchItems("Roller").length >= 2);
  assert.deepEqual(searchItems("unbekannterSuchbegriff123"), []);
  assert.equal(searchItems("").length, 80);
});

test("Auswahl übernimmt Bezeichnung und Gebühr in die spätere Zahlungsplanung", () => {
  const original = { item: { description: "rot", manualLabel: "alt" }, feeSelection: "UNSET" };
  for (const [key, fee, cents] of [["keys", "KEY", 1000], ["key_bundle", "KEY_BUNDLE", 1000],
    ["car_key", "KEY", 1000], ["phone", "MOBILE_MEDIATION", 2000], ["scarf", "NONE", 0]]) {
    const selected = selectCatalogItem(original, key);
    assert.equal(selected.feeSelection, fee);
    assert.equal(selected.item.description, "rot");
    assert.equal(selected.item.manualLabel, ITEM_CATALOG.find((entry) => entry.key === key).label);
    assert.equal(normalizeLostItem(selected).item.manualLabel, selected.item.manualLabel);
    const workflow = normalizeWorkflow(selected);
    assert.equal(workflow.payments.FEE.dueCents, cents);
    assert.equal(workflow.payments.FEE.receivedCents, 0);
    assert.equal(workflow.movements.length, 0);
  }
  assert.equal(original.item.manualLabel, "alt");
});

test("Gegenstandswechsel entfernt die vorherige Gebühr; offene Fälle bleiben offen", () => {
  const phone = selectCatalogItem({ item: {} }, "phone");
  assert.equal(selectCatalogItem(phone, "scarf").feeSelection, "NONE");
  assert.equal(selectCatalogItem(phone, "").feeSelection, "UNSET");
  for (const key of ["access_token", "other", "unbekannt"]) assert.equal(catalogFee(key), "UNSET");
  assert.equal(catalogFee("keychain_empty"), "NONE");
});

test("Bearbeitung verändert weder vorhandenen Gebührenplan noch Zahlungsdaten", () => {
  const data = { item: {}, feeSelection: "NONE", workflow: { payments: { FEE: { receivedCents: 1000 } } } };
  const selected = selectCatalogItem(data, "phone", { updateFee: false });
  assert.equal(selected.feeSelection, "NONE");
  assert.deepEqual(selected.workflow, data.workflow);
  const legacy = { item: { predefinedKey: "bag", manualLabel: "Alte Tasche" } };
  assert.equal(selectCatalogItem(legacy, "bag"), legacy);
});
