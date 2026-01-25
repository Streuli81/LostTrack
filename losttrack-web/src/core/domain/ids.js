export function makeLostId(prefix = "LT") {
  // Einfach, lokal stabil, ohne Backend: LT-YYYYMMDD-XXXXXX
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const rand = Math.random().toString(16).slice(2, 8).toUpperCase();
  return `${prefix}-${y}${m}${day}-${rand}`;
}
