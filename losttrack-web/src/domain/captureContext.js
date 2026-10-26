export const FIND_ENVIRONMENTS = [
  ["PUBLIC_GROUND", "Öffentlicher Grund"], ["PUBLIC_TRANSPORT", "Öffentliche Verkehrsmittel"],
  ["BUILDING", "Haus-/Anstaltsfund"], ["PRIVATE", "Privatgrund"], ["OTHER", "Sonstiger Fund"],
];
export const FUND_REGIMES = [
  ["NORMAL", "Gewöhnlicher Fund"], ["HOUSE", "Haus-/Anstaltsfund"], ["TRANSPORT", "Öffentlicher Verkehr"],
  ["ANIMAL", "Tierfund – Sonderprüfung"], ["DOCUMENT", "Amtliches Dokument – Sonderprüfung"],
  ["DANGEROUS", "Gefährlicher / Sondergegenstand – Sonderprüfung"], ["REVIEW", "Sonstiger Fund – Einordnung prüfen"],
];
export function fundRegime(item) {
  if (item?.regime) return item.regime.type || "REVIEW";
  return ({ PUBLIC_GROUND: "NORMAL", BUILDING: "HOUSE", PUBLIC_TRANSPORT: "TRANSPORT", PRIVATE: "REVIEW", OTHER: "REVIEW" })[item?.origin?.type] || "NORMAL";
}
export function isReferralOnly(item) { return !["NORMAL", "HOUSE", "TRANSPORT"].includes(fundRegime(item)); }
export function finderRewardExcluded(item) { return ["HOUSE", "TRANSPORT"].includes(fundRegime(item)); }
export function legalFinderName(item) {
  if (isInstitutionFind(item)) return item.institution?.legalFinderName || "";
  if (isTransportFind(item) || item?.roles?.legalFinderSameAsDiscoverer === false) return item.roles?.legalFinderName || "";
  return [item?.finder?.firstName, item?.finder?.lastName].filter(Boolean).join(" ") || item?.finder?.name || "";
}

export function environmentLabel(item) {
  return FIND_ENVIRONMENTS.find(([code]) => code === item?.origin?.type)?.[1] || "Noch nicht zugeordnet (Altbestand)";
}
export function isTransportFind(item) { return fundRegime(item) === "TRANSPORT"; }
export function isInstitutionFind(item) { return fundRegime(item) === "HOUSE"; }
export function institutionRightsChecked(item) {
  return isInstitutionFind(item) && item.institution?.legalFinderConfirmed === true &&
    typeof item.institution.legalFinderName === "string" && !!item.institution.legalFinderName.trim() &&
    typeof item.institution.reviewNote === "string" && !!item.institution.reviewNote.trim();
}
export function fundReceiptRecipient(item) {
  if (isInstitutionFind(item)) return item.institution?.deliveredBy || item.institution?.deliveringInstitution || "";
  if (isTransportFind(item) || item?.roles?.delivererSameAsDiscoverer === false) return item.roles?.delivererName || "";
  return [item.finder?.firstName, item.finder?.lastName].filter(Boolean).join(" ") || item.finder?.name || "";
}
export function finderRecipient(item) {
  if (isInstitutionFind(item)) return item.institution?.legalFinderName || "";
  if (isTransportFind(item) || item?.roles?.legalFinderSameAsDiscoverer === false) return legalFinderName(item);
  return [item.collector?.firstName, item.collector?.lastName].filter(Boolean).join(" ") ||
    item.collector?.name ||
    [item.finder?.firstName, item.finder?.lastName].filter(Boolean).join(" ") || item.finder?.name || "";
}
export function hasSpecialJurisdiction(item) {
  return fundRegime(item) !== "NORMAL";
}
export function separateDateFields(item) {
  if (item.retention?.dateModel === "SEPARATE") return item;
  const retention = { ...item.retention, custodyBasis: "MANUAL_SEPARATE", dateModel: "SEPARATE", finderBasis: "" };
  if (retention.noticeType === "POLICE_REPORT" && !retention.reportedDate) {
    retention.reportedDate = retention.noticeDate || "";
    retention.reportedTime = retention.noticeTime || "";
    retention.noticeDate = ""; retention.noticeTime = "";
    if (retention.reportedDate) retention.finderBasis = "REPORT";
  } else if (retention.noticeType === "PUBLIC_ANNOUNCEMENT" && retention.noticeDate) retention.finderBasis = "PUBLICATION";
  return { ...item, retention };
}

// Bestätigte betriebliche Vorgabe: Bekanntmachung ist der Aufbewahrungsbeginn.
// Keine rechtliche Feststellung über den Beginn gesetzlicher Fristen.
export function linkCustodyToNotice(item) {
  if (item?.retention?.custodyBasis !== "NOTICE_USER_POLICY") return item;
  return { ...item, retention: { ...item.retention,
    custodyStartDate: item.retention.noticeDate || "", custodyStartTime: item.retention.noticeTime || "" } };
}

export function prepareCapture(input, user, { existing = null, keepCaseWorker = false, now = new Date().toISOString() } = {}) {
  if (input?.captureVersion !== 1 && existing?.captureVersion !== 1) return input;
  return linkCustodyToNotice({ ...input,
    captureVersion: 1,
    retention: { ...input.retention, custodyBasis: input.retention?.custodyBasis || existing?.retention?.custodyBasis || "MANUAL_SEPARATE" },
    capturedAt: existing?.capturedAt || existing?.createdAt || now,
    createdAt: existing?.createdAt || now,
    caseWorker: keepCaseWorker && existing ? existing.caseWorker : { id: user?.id || "", name: user?.name || user?.username || "" },
  });
}
