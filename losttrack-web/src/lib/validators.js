// C:\Dev\LostTrack\losttrack-web\src\lib\validators.js

export function isEmailLike(value) {
  const v = String(value || "").trim();
  if (!v) return true; // leer = ok
  // pragmatischer Check (MVP)
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

export function isPhoneLike(value) {
  const v = String(value || "").trim();
  if (!v) return true;
  // erlaubt +, Leerzeichen, Klammern, Bindestrich, Zahlen
  return /^[0-9+\s()\-]{6,}$/.test(v);
}

export function isValidDateYYYYMMDD(value) {
  const v = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const [y, m, d] = v.split("-").map((x) => Number(x));
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

export function isValidTimeHHMM(value) {
  const v = String(value || "").trim();
  if (!/^\d{2}:\d{2}$/.test(v)) return false;
  const [h, m] = v.split(":").map((x) => Number(x));
  return h >= 0 && h <= 23 && m >= 0 && m <= 59;
}
