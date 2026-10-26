import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { createEmptyLostItem } from "../src/domain/lostItem.js";
import { prepareCapture, linkCustodyToNotice } from "../src/domain/captureContext.js";
import { validateLostItem } from "../src/domain/lostItem.validators.js";
import { calculateRetention, getRetentionStatus } from "../src/domain/retention.js";
import { dashboardItems } from "../src/domain/dashboard.js";
import { login, getCurrentUser } from "../src/core/auth/auth.js";
import { createUser } from "../src/core/storage/userRepo.js";
import { saveDraft, getDraftById, getLostItemById, commitLostItem, updateLostItem, listAuditLog } from "../src/core/storage/lostItemRepo.js";
import { createBackup, restoreBackup } from "../src/core/storage/backup.js";
import { getWorkflowSummary } from "../src/domain/workflow.js";
import { selectCatalogItem } from "../src/domain/itemCatalog.js";

let data;
beforeEach(() => {
  data = new Map();
  globalThis.localStorage = { get length() { return data.size; }, key: (index) => [...data.keys()][index] ?? null,
    getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, String(value)), removeItem: (key) => data.delete(key) };
  assert.equal(login({ username: "admin", password: "admin" }).ok, true);
});
function input(type = "PUBLIC_GROUND") {
  const empty = createEmptyLostItem();
  return { ...empty, captureVersion: 1, origin: { type, operator: "PostAuto", line: "TEST 123", route: "TEST Horgen", direction: "TEST Bahnhof", vehicleNo: "TEST 4" },
    caseWorker: { id: "forged", name: "Manuell geändert" },
    foundAt: { date: "25.10.2026", time: "09.00", location: "TEST Fundort" },
    finder: { firstName: "TEST Finder", rewardChoice: "WAIVED" }, item: { ...empty.item, manualLabel: "TEST Gegenstand" },
    retention: { ...empty.retention, custodyBasis: "NOTICE_USER_POLICY", noticeDate: "26.10.2026", noticeTime: "14:30", noticeType: "PUBLIC_ANNOUNCEMENT" } };
}

test("Sachbearbeitung und Erfassung werden automatisch gesetzt, Bekanntmachung und Aufbewahrung gekoppelt", () => {
  const next = prepareCapture(input(), getCurrentUser(), { now: "2026-10-26T12:00:00.000Z" });
  assert.equal(next.caseWorker.id, getCurrentUser().id);
  assert.equal(next.capturedAt, "2026-10-26T12:00:00.000Z");
  const validated = validateLostItem(next, { mode: "COMMIT" });
  assert.equal(validated.ok, true, JSON.stringify(validated.errors));
  assert.equal(validated.value.retention.noticeTime, "14.30");
  assert.equal(validated.value.retention.custodyStartTime, "14.30");
  assert.equal(validated.value.retention.custodyStartDate, "26.10.2026");
});

test("Eine noch nicht erfolgte Bekanntmachung erzeugt keine erfundene Aufbewahrungsfrist", () => {
  const item = input();
  item.retention.noticeDate = ""; item.retention.noticeTime = ""; item.retention.noticeType = "";
  item.retention.custodyStartDate = "01.01.2020";
  const linked = linkCustodyToNotice(item);
  assert.equal(linked.retention.custodyStartDate, "");
  assert.equal(calculateRetention(linked).auctionReviewDate, "");
});

for (const [path, value] of [["noticeTime", "29.99"], ["noticeTime", ""], ["noticeDate", "31.02.2026"], ["noticeDate", ""]]) {
  test(`Unvollständige/ungültige Bekanntmachung wird erkannt: ${path}=${value}`, () => {
    const item = input(); item.retention[path] = value;
    assert.equal(validateLostItem(item, { mode: "COMMIT" }).ok, false);
  });
}

test("Neue Erfassungen benötigen Fundumgebung und bei ÖV das Verkehrsunternehmen", () => {
  const item = input("");
  assert.ok(validateLostItem(item, { mode: "COMMIT" }).errors["origin.type"]);
  item.origin.type = "PUBLIC_TRANSPORT"; item.origin.operator = "";
  assert.ok(validateLostItem(item, { mode: "COMMIT" }).errors["origin.operator"]);
  assert.equal(validateLostItem(item, { mode: "DRAFT" }).errors["origin.operator"], undefined);
});

for (const operator of ["PostAuto", "Zimmerbergbus"]) test(`${operator}: keine kommunalen Fristen und keine automatische VBZ-Zuweisung`, () => {
  const item = linkCustodyToNotice(input("PUBLIC_TRANSPORT")); item.origin.operator = operator;
  item.retention.auctionReviewDate = "2027-10-26T00:00:00.000Z";
  const retention = calculateRetention(item);
  assert.equal(retention.ruleKey, "TRANSPORT_REFERRAL");
  assert.equal(retention.auctionReviewDate, "");
  assert.equal(retention.finderAcquisitionReviewDate, "");
  assert.equal(getRetentionStatus(item), "REVIEW_REQUIRED");
  assert.equal(dashboardItems([item])[0]._retentionStatus, "REVIEW_REQUIRED");
  assert.match(getWorkflowSummary(item).overallLabel, /Verkehrsunternehmen/);
  assert.equal(item.origin.operator, operator);
  assert.equal(item.status, "OPEN");
});

test("Andere Fundumgebungen erhalten bis zur Klärung keine pauschale öffentliche Frist", () => {
  for (const type of ["BUILDING", "PRIVATE", "OTHER"]) assert.equal(calculateRetention(linkCustodyToNotice(input(type))).auctionReviewDate, "");
  assert.match(calculateRetention(linkCustodyToNotice(input())).auctionReviewDate, /^2027-10-26/);
  assert.equal(selectCatalogItem(input("PUBLIC_TRANSPORT"), "keys").feeSelection, "UNSET");
  assert.equal(selectCatalogItem(input("PUBLIC_GROUND"), "keys").feeSelection, "KEY");
});

test("Alte Einträge behalten unabhängige Aufbewahrungs- und Anzeigedaten", () => {
  const old = input(); delete old.captureVersion; delete old.retention.custodyBasis; delete old.origin;
  old.retention.custodyStartDate = "01.10.2026";
  assert.equal(prepareCapture(old, getCurrentUser()), old);
  assert.match(calculateRetention(old).auctionReviewDate, /^2027-10-01/);
});

test("Entwurf, definitive Übernahme, Bearbeitung und Sicherung erhalten Metadaten und ÖV-Angaben", () => {
  const draft = saveDraft(input("PUBLIC_TRANSPORT"));
  assert.equal(draft.ok, true);
  assert.equal(draft.item.caseWorker.id, getCurrentUser().id);
  const firstTime = draft.item.capturedAt;
  const again = saveDraft({ ...getDraftById(draft.item.id), capturedAt: "2000-01-01" }, { fromDraft: true });
  assert.equal(again.item.capturedAt, firstTime);
  const committed = commitLostItem(again.item, { fromDraft: true });
  assert.equal(committed.ok, true, JSON.stringify(committed));
  assert.equal(committed.item.capturedAt, firstTime);
  assert.equal(committed.item.retention.auctionReviewDate, "");
  const backup = createBackup();
  const changed = updateLostItem({ ...committed.item, capturedAt: "2000-01-01", origin: { ...committed.item.origin, operator: "Zimmerbergbus" } });
  assert.equal(changed.ok, true);
  assert.equal(changed.item.capturedAt, firstTime);
  assert.equal(getLostItemById(committed.item.id).origin.operator, "Zimmerbergbus");
  assert.ok(listAuditLog().some((entry) => entry.diff?.some((row) => row.path === "origin.operator")));
  restoreBackup(backup, { confirmed: true });
  assert.equal(login({ username: "admin", password: "admin" }).ok, true);
  assert.equal(getLostItemById(committed.item.id).origin.operator, "PostAuto");
  assert.equal(getLostItemById(committed.item.id).capturedAt, firstTime);
});

test("Ein anderer angemeldeter Bearbeiter wird bei definitiver Neuerfassung automatisch übernommen", () => {
  const draft = saveDraft(input()).item;
  const user = createUser({ username: "editor", name: "TEST Editor", password: "editor", role: "EDITOR", active: true });
  assert.equal(user.ok, true);
  assert.equal(login({ username: "editor", password: "editor" }).ok, true);
  const committed = commitLostItem(draft, { fromDraft: true });
  assert.equal(committed.ok, true);
  assert.equal(committed.item.caseWorker.id, getCurrentUser().id);
  assert.equal(committed.item.capturedAt, draft.capturedAt);
});
