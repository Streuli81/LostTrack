import { isInstitutionFind, isTransportFind, legalFinderName, institutionRightsChecked } from "./captureContext.js";

export function ownerReturnConfirmed(item) {
  return item.workflow?.movements?.some((movement) => movement.kind === "OWNER_HANDOVER") === true;
}
export function validateExpenseClaims(item) {
  const claims = item.expenseClaims;
  if (claims === undefined) return { ok: true };
  const fail = (error) => ({ ok: false, error });
  if (!Array.isArray(claims) || claims.length > 100) return fail("Ungültige Auslagenanmeldungen.");
  const ids = new Set(), allocated = new Map();
  for (const claim of claims) {
    if (!claim || typeof claim.id !== "string" || ids.has(claim.id) || !claim.id ||
      !["LEGAL_FINDER", "DISCOVERER", "OFFICE", "OTHER"].includes(claim.role) ||
      !["FINDER_LAW", "OTHER_BASIS"].includes(claim.basis) || !["REPORTED", "APPROVED", "REJECTED"].includes(claim.status) ||
      !Number.isSafeInteger(claim.claimedCents) || claim.claimedCents < 0 ||
      (claim.approvedCents !== null && (!Number.isSafeInteger(claim.approvedCents) || claim.approvedCents < 0)) ||
      ["name", "reason", "evidence", "decisionNote"].some((key) => typeof claim[key] !== "string" || claim[key].length > 4000) ||
      !claim.name.trim() || !claim.reason.trim()) return fail("Auslagen benötigen Person/Stelle, Betrag, Begründung und gültige Prüfungsangaben.");
    ids.add(claim.id);
    if (claim.status === "APPROVED" && (!claim.decisionNote.trim() || claim.approvedCents === null)) return fail("Anerkennung nur mit Betrag und dokumentierter Entscheidung.");
    if (claim.status === "REJECTED" && !claim.decisionNote.trim()) return fail("Eine Ablehnung benötigt eine dokumentierte Entscheidung.");
    if (claim.status === "APPROVED" && claim.role !== "LEGAL_FINDER" && claim.basis === "FINDER_LAW" && (isInstitutionFind(item) || isTransportFind(item))) {
      return fail("Die Fundperson hat bei Haus-/Anstalts- und ÖV-Funden nicht automatisch einen Anspruch aus Finderrecht. Andere Anspruchsgrundlagen separat prüfen.");
    }
    if (claim.status === "APPROVED" && claim.basis === "FINDER_LAW" &&
      (!legalFinderName(item) || claim.name !== legalFinderName(item) || isInstitutionFind(item) && !institutionRightsChecked(item))) return fail("Für Anerkennung aus Finderrecht die tatsächliche Finderstelle und Berechtigung prüfen.");
    if (claim.settlementReceiptId) {
      const receipt = item.receipts?.find((entry) => entry.id === claim.settlementReceiptId && entry.confirmedAt);
      const paid = receipt?.payments?.filter((line) => line.category === "EXPENSES" && line.type === "OUT").reduce((sum, line) => sum + line.amountCents, 0) || 0;
      if (!receipt || claim.status !== "APPROVED" || receipt.recipient !== claim.name || !paid) return fail("Bezahlt nur mit bestätigtem Auslagen-Auszahlungsbeleg für diese Person/Stelle.");
      allocated.set(receipt.id, (allocated.get(receipt.id) || 0) + claim.approvedCents);
      if (allocated.get(receipt.id) > paid) return fail("Die zugeordneten Auslagen übersteigen die tatsächliche Auszahlung.");
    }
  }
  return { ok: true };
}
export function expenseClaimState(item, claim) {
  if (claim.settlementReceiptId && validateExpenseClaims(item).ok) return "Bezahlt – bestätigter Beleg zugeordnet";
  if (claim.status === "REJECTED") return "Abgelehnt – siehe Entscheidung";
  if (claim.status !== "APPROVED") return "Angemeldet – Prüfung offen";
  if (claim.basis === "OTHER_BASIS") return "Geprüft – gesonderte Anspruchsgrundlage / Abwicklung";
  return ownerReturnConfirmed(item) ? "Fällig nach dokumentierter Anerkennung und Eigentümerrückgabe" : "Anerkannt – Rückgabe an Eigentümer noch offen";
}
export function defaultExpensePayee(item) {
  return { role: "LEGAL_FINDER", name: legalFinderName(item), basis: "FINDER_LAW", confirmed: false, note: "" };
}
