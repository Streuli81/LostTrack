import { test } from "node:test";
import assert from "node:assert/strict";
import { dashboardItems, dashboardCounts, filterDashboardItems, DASHBOARD_HINTS } from "../src/domain/dashboard.js";
import { normalizeWorkflow } from "../src/domain/workflow.js";

const today = new Date(2026, 9, 26, 12);
function record(id, custodyStartDate) {
  return { id, fundNo: `2026-${id}`, item: { manualLabel: "Testgegenstand" }, status: "OPEN",
    finder: { rewardChoice: "WAIVED" }, retention: { custodyStartDate }, feeSelection: "NONE" };
}
function completed() {
  const item = { ...record("closed", "01.01.2025"), status: "RETURNED" };
  item.workflow = normalizeWorkflow(item);
  item.workflow.payments.EXPENSES.dueCents = 0;
  item.workflow.closedAt = "2026-10-25T10:00:00.000Z";
  return item;
}
const fixtures = () => [record("review", ""), record("urgent", "01.11.2025"),
  record("warning", "25.11.2025"), record("ok", "20.01.2026"), completed()];

test("Die fünf Zähler und ihre Listen verwenden genau dieselbe Zuordnung", () => {
  const source = fixtures();
  const before = structuredClone(source);
  const items = dashboardItems(source, today);
  const counts = dashboardCounts(items);
  assert.deepEqual(counts, { REVIEW_REQUIRED: 1, URGENT: 1, WARNING: 1, OK: 1, COMPLETED: 1 });
  for (const hint of DASHBOARD_HINTS) {
    const result = filterDashboardItems(items, hint.code);
    assert.equal(result.length, counts[hint.code]);
    assert.ok(result.every((item) => item._retentionStatus === hint.code));
  }
  assert.deepEqual(source, before);
});

test("Alle Fundsachen bleiben erreichbar, auch mehr als zwölf und bei aufgehobenem Filter", () => {
  const items = dashboardItems(Array.from({ length: 20 }, (_, index) => record(String(index), "")), today);
  assert.equal(filterDashboardItems(items, "REVIEW_REQUIRED").length, 20);
  assert.equal(filterDashboardItems(items, "OK").length, 0);
  assert.equal(filterDashboardItems(items, null).length, 20);
  assert.equal(filterDashboardItems(items, "unbekannt").length, 20);
});

test("Abschluss und Wiederöffnung werden aus dem aktuellen Ablauf übernommen", () => {
  const item = completed();
  assert.equal(dashboardItems([item], today)[0]._retentionStatus, "COMPLETED");
  item.retention.completedAt = "2026-10-25T10:00:00.000Z";
  item.workflow.closedAt = null;
  assert.equal(dashboardItems([item], today)[0]._retentionStatus, "REVIEW_REQUIRED");
  item.workflow.closedAt = "2026-10-25T10:00:00.000Z";
  item.workflow.payments.FEE.receivedCents = 500;
  assert.notEqual(dashboardItems([item], today)[0]._retentionStatus, "COMPLETED");
});

test("Ein alter Fristabschluss bleibt ohne neuen Ablauf als solcher erkennbar", () => {
  const item = record("legacy", "");
  item.retention.completedAt = "2025-01-01T00:00:00.000Z";
  assert.equal(dashboardItems([item], today)[0]._retentionStatus, "COMPLETED");
});
