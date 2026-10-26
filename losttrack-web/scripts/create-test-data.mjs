import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { log } from "node:console";
import { createEmptyLostItem } from "../src/domain/lostItem.js";
import { getRetentionStatus } from "../src/domain/retention.js";
import { login, isLoggedIn } from "../src/core/auth/auth.js";
import { createUser } from "../src/core/storage/userRepo.js";
import { storage } from "../src/core/storage/storage.js";
import { createBackup, inspectBackup, restoreBackup } from "../src/core/storage/backup.js";
import * as repo from "../src/core/storage/lostItemRepo.js";
import { saveWorkflowPlan, closeWorkflow } from "../src/core/storage/workflowRepo.js";
import { normalizeWorkflow } from "../src/domain/workflow.js";

// Ausschließlich flüchtiger Speicher in diesem Node-Prozess. Kein Browserzugriff.
const data = new Map();
globalThis.localStorage = {
  get length() { return data.size; },
  key: (index) => [...data.keys()][index] ?? null,
  getItem: (key) => data.get(key) ?? null,
  setItem: (key, value) => data.set(key, String(value)),
  removeItem: (key) => data.delete(key),
};
function checked(result) {
  assert.equal(result.ok, true, JSON.stringify(result));
  return result;
}
checked(login({ username: "admin", password: "admin" }));
for (const [username, role, active] of [
  ["editor", "EDITOR", true], ["viewer", "VIEWER", true], ["inaktiv", "EDITOR", false],
]) {
  checked(createUser({ name: `TEST ${username}`, username, password: "LostTrack-Test!", role, active }));
}

const cases = [
  ["Schlüsselbund", "WAIVED", "Verzicht auf Fundquittung prüfen"],
  ["Portemonnaie", "REQUESTED", "Finderlohn gewünscht; Eigentümer noch unbekannt"],
  ["Brille", "WAIVED", "Eigentümer bekannt; Herausgabe ohne Finderlohn testen"],
  ["Armbanduhr", "REQUESTED", "Einzahlung und spätere Auszahlung von CHF 25 testen"],
  ["Rucksack", "REQUESTED", "CHF 30 bereits eingezahlt; Auszahlung und Doppeleinnahme prüfen"],
  ["Kamera", "REQUESTED", "CHF 40 ein- und ausbezahlt; Doppelauszahlung prüfen"],
  ["Regenschirm", "WAIVED", "Bereits zurückgegeben; Status und Protokoll ansehen"],
  ["Mobiltelefon", "WAIVED", "Mehrere Ermittlungsschritte und Änderungen ansehen"],
  ["Kopfhörer", "WAIVED", "Fristanzeige dringend am Referenztag 25.10.2026"],
  ["Veloschloss", "WAIVED", "Fristanzeige Warnung am Referenztag 25.10.2026"],
  ["Handschuhe", "WAIVED", "Fristanzeige Prüfung erforderlich; Datum liegt zurück"],
  ["Sporttasche", "WAIVED", "Aufbewahrungsbeginn fehlt; Prüfung erforderlich"],
  ["Bargeld-Testumschlag", "REQUESTED", "CHF 6000 Testwert; Bargeld- und Hochwertmerkmale ansehen"],
  ["Defekter Koffer", "WAIVED", "Technischer Beispielstatus verwertet; keine rechtliche Freigabe"],
  ["Fahrradhelm", "WAIVED", "Technischer Beispielstatus übertragen; keine rechtliche Freigabe"],
];

function makeItem(index, label, choice, purpose) {
  const item = createEmptyLostItem();
  item.id = `TEST-FALL-${String(index).padStart(2, "0")}`;
  item.fundNo = `2026-${String(index).padStart(5, "0")}`;
  item.caseWorker = { id: "TEST", name: "TEST Sachbearbeitung" };
  item.foundAt = { date: `${String(index).padStart(2, "0")}.10.2026`, time: "10.15",
    location: index % 2 ? "TEST Bahnhof Musterort" : "TEST Gemeindehaus Musterort" };
  item.finder = { firstName: `Testperson ${index}`, lastName: "Musterfinder",
    street: "TEST Musterweg", streetNo: String(index), zip: "0000", city: "TEST Musterort",
    phone: "", email: `finder${index}@example.invalid`, rewardChoice: choice,
    rewardRequested: choice === "REQUESTED" };
  item.item.manualLabel = `TEST ${String(index).padStart(2, "0")} – ${label}`;
  item.item.description = `Nur Testdaten. ${purpose}. Keine echte Fundsache.`;
  item.notes = `TESTDATEN – ${purpose}`;
  item.retention.custodyStartDate = "15.10.2026";
  item.retention.noticeDate = "16.10.2026";
  item.retention.noticeType = "POLICE_REPORT";
  return item;
}
function owner(index) {
  return { firstName: `TEST Eigentümer ${index}`, lastName: "Musterperson",
    street: "TEST Beispielgasse", streetNo: "1", zip: "0000", city: "TEST Musterort",
    phone: "", email: `owner${index}@example.invalid` };
}

for (let i = 0; i < cases.length; i++) {
  const number = i + 1;
  const input = makeItem(number, ...cases[i]);
  if ([3, 4, 5, 6, 7].includes(number)) input.owner = owner(number);
  if (number === 9) input.retention.custodyStartDate = "02.11.2025";
  if (number === 10) input.retention.custodyStartDate = "05.12.2025";
  if (number === 11) input.retention.custodyStartDate = "01.09.2025";
  if ([9, 10, 11].includes(number)) input.foundAt.date = input.retention.custodyStartDate;
  if (number === 12) input.retention.custodyStartDate = "";
  if (number === 13) {
    input.item.category = "CASH";
    input.item.estimatedValueCHF = 6000;
  }
  checked(repo.commitLostItem(input));
  checked(repo.addInvestigationStep({ id: input.id, step: {
    who: "TEST Sachbearbeitung", what: `Testfall vorbereitet: ${cases[i][2]}. Alle Angaben erfunden.`,
  } }));
  if ([1, 2].includes(number)) checked(repo.createReceipt({ id: input.id, receiptType: "FUND_RECEIPT",
    recipient: `TEST Finder ${number}`, notes: "Nur Testquittung – keine echte Übergabe" }));
  if ([5, 6].includes(number)) checked(repo.createReceipt({ id: input.id, receiptType: "OWNER_RECEIPT",
    recipient: `TEST Eigentümer ${number}`, amount: number === 5 ? 30 : 40 }));
  if (number === 6) checked(repo.createReceipt({ id: input.id, receiptType: "FINDER_RECEIPT",
    recipient: "TEST Finder 6", amount: 40, notes: "Finderlohn-Abholung" }));
  if (number === 7) {
    checked(repo.createReceipt({ id: input.id, receiptType: "OWNER_RECEIPT", recipient: "TEST Eigentümer 7" }));
    checked(repo.changeLostItemStatus({ id: input.id, newStatus: "RETURNED" }));
  }
  if (number === 8) {
    checked(repo.addInvestigationStep({ id: input.id, step: { who: "TEST Zentrale", what: "Erfundener Abgleich ohne Treffer" } }));
    checked(repo.updateOwner({ id: input.id, owner: owner(number) }));
    checked(repo.addInvestigationStep({ id: input.id, step: { who: "TEST Sachbearbeitung", what: "Fiktive Nachricht an Eigentümer vorbereitet" } }));
  }
  if ([14, 15].includes(number)) checked(repo.disposeLostItem({ id: input.id,
    dispositionType: number === 14 ? "RECYCLE" : "TRANSFER_TO_MUNICIPAL_ACCOUNT" }));
}

const incomplete = makeItem(16, "Entwurf unvollständig", "", "Angaben ergänzen und erneut speichern");
incomplete.fundNo = "";
incomplete.caseWorker = { id: "", name: "" };
incomplete.foundAt = { date: "", time: "", location: "" };
incomplete.finder = { ...incomplete.finder, firstName: "", lastName: "", email: "" };
checked(repo.saveDraft(incomplete));
const ready = makeItem(17, "Entwurf vollständig", "REQUESTED", "Direkt oder nach Weiterbearbeitung definitiv erfassen");
ready.fundNo = "";
checked(repo.saveDraft(ready));
const choiceMissing = makeItem(18, "Entwurf ohne Finderlohnwahl", "", "Definitive Übernahme muss zunächst scheitern; Wahl ergänzen");
choiceMissing.fundNo = "";
checked(repo.saveDraft(choiceMissing));

// Alle definitiven Beispiele für den aktuellen Ablauf vorbereiten. Alte
// Zahlungsbelege bleiben als solche erhalten; keine Übergabe wird nachträglich erfunden.
for (const record of repo.listLostItems()) {
  const number = Number(record.id.slice(-2));
  const current = normalizeWorkflow(record);
  const feeCode = number === 1 ? "KEY_BUNDLE" : number === 8 ? "MOBILE_MEDIATION" : "NONE";
  checked(saveWorkflowPlan({ id: record.id,
    parts: current.parts.map((part) => ({ ...part, feeCode })),
    rewardCents: record.finder.rewardChoice === "WAIVED" ? 0
      : current.payments.REWARD.dueCents ?? (number === 13 ? 5000 : 2500),
    expensesCents: 0, expensesRecipient: "UNSET", blockedReason: "", decisionOpen: false,
  }));
  if ([7, 14, 15].includes(number)) checked(closeWorkflow({ id: record.id }));
}

// Beide bestehenden Nummernwege an den gleichen Test-Ausgangsstand anpassen.
const counters = storage.getJson("lostItems.counters.v1", {});
counters["fundNo:2026"] = 15;
storage.setJson("lostItems.counters.v1", counters);
localStorage.setItem("losttrack_fundcounter_2026", "15");

const text = createBackup();
assert.deepEqual({ ...inspectBackup(text), createdAt: null }, {
  createdAt: null, records: 15, drafts: 3, users: 4, audit: repo.listAuditLog().length, cashbook: 3,
});
assert.equal(repo.getCashbookTotals().balanceCents, 3000);
assert.equal(repo.verifyCashbookChain().ok, true);
const referenceDay = new Date(2026, 9, 25, 12);
for (const [number, expected] of [[9, "URGENT"], [10, "WARNING"], [11, "REVIEW_REQUIRED"], [12, "REVIEW_REQUIRED"], [14, "COMPLETED"], [15, "COMPLETED"]]) {
  assert.equal(getRetentionStatus(repo.getLostItemById(`TEST-FALL-${String(number).padStart(2, "0")}`), referenceDay), expected);
}

// Importprobe in einen zweiten leeren, ebenfalls nur flüchtigen Bestand.
data.clear();
checked(login({ username: "admin", password: "admin" }));
restoreBackup(text, { confirmed: true });
assert.equal(isLoggedIn(), false);
checked(login({ username: "editor", password: "LostTrack-Test!" }));
assert.equal(repo.listLostItems().length, 15);
assert.equal(repo.listDrafts().length, 3);
assert.equal(repo.verifyCashbookChain().ok, true);
assert.equal(login({ username: "inaktiv", password: "LostTrack-Test!" }).ok, false);

const outputDirectory = new URL("../test-data/", import.meta.url);
await mkdir(outputDirectory, { recursive: true });
await writeFile(new URL("LostTrack-Testdaten.json", outputDirectory), text, "utf8");
log("Testdatei erstellt und Import geprüft: test-data/LostTrack-Testdaten.json");
log("15 definitive Fundsachen, 3 Entwürfe, 4 Benutzer, 3 Buchungen; Test-Kassensaldo CHF 30.");
