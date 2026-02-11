// src/domain/retention.js

/**
 * Zürich – Öffentlicher Grund
 * ----------------------------------
 * Storage: 12 Monate
 * Ownership: 5 Jahre (Art. 722 ZGB)
 */

export const RETENTION_RULES = {
  PUBLIC_GROUND_ZH: {
    storageDays: 365,
    ownershipDays: 1825,
    label: "ZH_PUBLIC_GROUND_12M",
  },
};

/**
 * Berechnet Fristen ab Funddatum
 */
export function calculateRetention(item) {
  const fundDate = item?.foundAt?.date;
  if (!fundDate) return null;

  const start = new Date(fundDate);

  const rule = RETENTION_RULES.PUBLIC_GROUND_ZH;

  const storageDeadline = addDays(start, rule.storageDays);
  const ownershipDeadline = addDays(start, rule.ownershipDays);

  return {
    ruleKey: "PUBLIC_GROUND_ZH",
    startDate: start.toISOString(),
    storageDeadline: storageDeadline.toISOString(),
    ownershipDeadline: ownershipDeadline.toISOString(),
    completedAt: "",
    dispositionType: null,
  };
}

/**
 * Bewertet den aktuellen Status
 */
export function getRetentionStatus(item) {
  const now = new Date();
  const storageDeadline = new Date(item?.retention?.storageDeadline);

  const diff = daysBetween(now, storageDeadline);

  if (item?.retention?.completedAt) return "COMPLETED";
  if (diff < 0) return "VERWERTBAR";
  if (diff < 14) return "URGENT";
  if (diff < 60) return "WARNING";
  return "OK";
}

/**
 * Hilfsfunktionen
 */
function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function daysBetween(a, b) {
  return Math.floor((b - a) / (1000 * 60 * 60 * 24));
}
