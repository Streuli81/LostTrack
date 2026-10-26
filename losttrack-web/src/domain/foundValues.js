export function validateFoundValues(item) {
  if (item.contents === undefined) return { ok: true };
  const ids = new Set();
  if (!Array.isArray(item.contents) || item.contents.length > 100 || item.contents.some((row) => {
    const bad = !row || typeof row.id !== "string" || !row.id || ids.has(row.id) || !["ITEM", "CASH"].includes(row.kind) ||
      typeof row.label !== "string" || !row.label.trim() || row.label.length > 1000 || typeof row.details !== "string" || row.details.length > 4000 ||
      (row.kind === "CASH" && (!Number.isSafeInteger(row.amountCents) || row.amountCents < 0 || row.currency !== "CHF" || typeof row.countConfirmed !== "boolean"));
    if (row) ids.add(row.id); return bad;
  })) return { ok: false, error: "Ungültige Fundbestandteile. Bargeld benötigt einen CHF-Betrag und einen ausdrücklichen Zählstand." };
  if (!Number.isSafeInteger(cashInContents(item))) return { ok: false, error: "Die Bargeldsumme ist zu gross." };
  return { ok: true };
}
export function cashInContents(item) { return (item.contents || []).filter((row) => row.kind === "CASH").reduce((sum, row) => sum + row.amountCents, 0); }
