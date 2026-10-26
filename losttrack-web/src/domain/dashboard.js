import { calculateRetention, getRetentionStatus } from "./retention.js";
import { getWorkflowSummary } from "./workflow.js";

export const DASHBOARD_HINTS = [
  { code: "REVIEW_REQUIRED", label: "Prüfung erforderlich", color: "#333" },
  { code: "URGENT", label: "Frist läuft bald ab", color: "#b00020" },
  { code: "WARNING", label: "Frist nähert sich", color: "#965000" },
  { code: "OK", label: "Im hinterlegten Fristlauf", color: "#006e36" },
  { code: "COMPLETED", label: "Abgeschlossen", color: "#616672" },
];

export function dashboardItems(records, today = new Date()) {
  return records.map((record) => {
    const retention = { ...record.retention, ...calculateRetention(record) };
    const workflow = getWorkflowSummary(record);
    // Ein neuer Ablauf ist erst mit vollständiger Erledigung abgeschlossen.
    // Eine Wiederöffnung darf nicht durch ein altes Fristabschlussfeld verdeckt werden.
    const status = record.workflow
      ? workflow.overallStatus === "CLOSED" ? "COMPLETED"
        : getRetentionStatus({ ...record, retention: { ...retention, completedAt: null } }, today)
      : getRetentionStatus({ ...record, retention }, today);
    return { ...record, retention, _retentionStatus: status };
  }).sort((a, b) => DASHBOARD_HINTS.findIndex((hint) => hint.code === a._retentionStatus) -
    DASHBOARD_HINTS.findIndex((hint) => hint.code === b._retentionStatus) ||
    String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || "")));
}

export function dashboardCounts(items) {
  return Object.fromEntries(DASHBOARD_HINTS.map((hint) => [hint.code,
    items.filter((item) => item._retentionStatus === hint.code).length]));
}

export function filterDashboardItems(items, status) {
  return DASHBOARD_HINTS.some((hint) => hint.code === status)
    ? items.filter((item) => item._retentionStatus === status) : items;
}
