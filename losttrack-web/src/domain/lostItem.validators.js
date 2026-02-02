// src/domain/lostItem.validators.js

import { normalizeLostItem } from "./lostItem";

/**
 * Validation modes
 * - DRAFT: weiche Checks (Format), kaum Pflicht
 * - COMMIT: harte Pflichtfelder
 */
export const VALIDATION_MODE = {
  DRAFT: "DRAFT",
  COMMIT: "COMMIT",
};

/**
 * Validiert eine LostItem-Entität.
 * - Akzeptiert bei Eingabe mehrere Formate für Datum/Zeit
 * - Normalisiert intern auf:
 *   - Datum: DD.MM.YYYY
 *   - Zeit:  HH.MM
 *
 * @param {object} input LostItem (roh oder bereits normalisiert)
 * @param {object} opts
 * @param {"DRAFT"|"COMMIT"} opts.mode
 * @returns {{ ok: boolean, errors: Record<string,string>, value: object }}
 */
export function validateLostItem(input, { mode = VALIDATION_MODE.DRAFT } = {}) {
  const valueRaw = normalizeLostItem(input);
  const errors = {};

  const isCommit = mode === VALIDATION_MODE.COMMIT;

  // -------------------------
  // Helper
  // -------------------------
  const setErr = (path, msg) => {
    if (!errors[path]) errors[path] = msg;
  };

  const isEmpty = (v) => {
    if (v === null || v === undefined) return true;
    if (typeof v === "string") return v.trim() === "";
    return false;
  };

  const hasAny = (...vals) => vals.some((v) => !isEmpty(v));

  const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || "").trim());

  // -------------------------
  // Datum/Zeit normalisieren (wenn gesetzt)
  // -------------------------
  const dateIn = valueRaw?.foundAt?.date || "";
  const timeIn = valueRaw?.foundAt?.time || "";

  const dateNorm = !isEmpty(dateIn) ? normalizeDateInput(dateIn) : "";
  const timeNorm = !isEmpty(timeIn) ? normalizeTimeInput(timeIn) : "";

  // Wir geben IMMER value zurück (für weiterverarbeiten/speichern),
  // aber: falls die Eingabe ungültig ist, behalten wir den Rohwert,
  // damit der Benutzer sieht, was er eingegeben hat.
  const value = {
    ...valueRaw,
    foundAt: {
      ...(valueRaw.foundAt || {}),
      date: dateNorm || (valueRaw?.foundAt?.date || ""),
      time: timeNorm || (valueRaw?.foundAt?.time || ""),
    },
  };

  // -------------------------
  // COMMIT Pflichtfelder
  // -------------------------
  if (isCommit) {
    // Sachbearbeiter
    if (isEmpty(value?.caseWorker?.id)) {
      setErr("caseWorker.id", "Sachbearbeiter muss ausgewählt/erfasst werden.");
    }

    // Funddatum/-zeit/-ort
    if (isEmpty(value?.foundAt?.date)) setErr("foundAt.date", "Funddatum ist Pflicht.");
    if (isEmpty(value?.foundAt?.time)) setErr("foundAt.time", "Fundzeit ist Pflicht.");
    if (isEmpty(value?.foundAt?.location)) setErr("foundAt.location", "Fundort ist Pflicht.");

    // Gegenstand: entweder vordefiniert ODER manuell
    const pre = value?.item?.predefinedKey || "";
    const man = value?.item?.manualLabel || "";
    if (isEmpty(pre) && isEmpty(man)) {
      setErr("item.predefinedKey", "Gegenstand auswählen oder manuell erfassen.");
      setErr("item.manualLabel", "Gegenstand auswählen oder manuell erfassen.");
    }

    // Finder: mindestens Name ODER Telefon ODER E-Mail
    const fnName = value?.finder?.name || "";
    const fnPhone = value?.finder?.phone || "";
    const fnEmail = value?.finder?.email || "";
    if (!hasAny(fnName, fnPhone, fnEmail)) {
      setErr("finder.name", "Finder: Name oder Telefon oder E-Mail ist erforderlich.");
      setErr("finder.phone", "Finder: Name oder Telefon oder E-Mail ist erforderlich.");
      setErr("finder.email", "Finder: Name oder Telefon oder E-Mail ist erforderlich.");
    }
  }

  // -------------------------
  // Format-Checks (Draft + Commit)
  // -------------------------

  // E-Mail nur prüfen, wenn gesetzt
  if (!isEmpty(value?.finder?.email) && !isEmail(value.finder.email)) {
    setErr("finder.email", "E-Mail Format ist ungültig.");
  }

  // Datum prüfen (wenn gesetzt): akzeptiert mehrere Eingaben, normalisiert auf DD.MM.YYYY
  if (!isEmpty(dateIn) && !dateNorm) {
    setErr(
      "foundAt.date",
      "Datum ungültig. Erlaubt: DD.MM.YYYY, DD-MM-YYYY, DD/MM/YYYY oder YYYY-MM-DD."
    );
  }

  // Zeit prüfen (wenn gesetzt): akzeptiert mehrere Eingaben, normalisiert auf HH.MM
  if (!isEmpty(timeIn) && !timeNorm) {
    setErr(
      "foundAt.time",
      "Zeit ungültig. Erlaubt: HH.MM, HH:MM oder HHMM (24h)."
    );
  }

  // Status
  const allowedStatus = new Set(["OPEN", "RETURNED", "DISPOSED", "TRANSFERRED"]);
  if (!allowedStatus.has(value?.status)) {
    setErr("status", "Ungültiger Status.");
  }

  return {
    ok: Object.keys(errors).length === 0,
    errors,
    value,
  };
}

/* ----------------- Local helpers ----------------- */

/**
 * Akzeptiert:
 * - DD.MM.YYYY
 * - DD-MM-YYYY
 * - DD/MM/YYYY
 * - YYYY-MM-DD
 * - YYYY/MM/DD
 * - YYYY.MM.DD
 *
 * Normalisiert auf: DD.MM.YYYY
 * Gibt "" zurück, wenn ungültig.
 */
function normalizeDateInput(v) {
  const s = String(v || "").trim();
  if (!s) return "";

  // ISO/International: YYYY-MM-DD / YYYY/MM/DD / YYYY.MM.DD
  let m = s.match(/^(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})$/);
  if (m) {
    const [, y, mo, d] = m;
    const dd = pad2(d);
    const mm = pad2(mo);
    if (!isValidDateParts(dd, mm, y)) return "";
    return `${dd}.${mm}.${y}`;
  }

  // EU: DD-MM-YYYY / DD/MM/YYYY / DD.MM.YYYY
  m = s.match(/^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})$/);
  if (m) {
    const [, d, mo, y] = m;
    const dd = pad2(d);
    const mm = pad2(mo);
    if (!isValidDateParts(dd, mm, y)) return "";
    return `${dd}.${mm}.${y}`;
  }

  // ✅ Neu: NUR ZIFFERN
  // 8-stellig: DDMMYYYY
  m = s.match(/^(\d{2})(\d{2})(\d{4})$/);
  if (m) {
    const [, d, mo, y] = m;
    const dd = pad2(d);
    const mm = pad2(mo);
    if (!isValidDateParts(dd, mm, y)) return "";
    return `${dd}.${mm}.${y}`;
  }

  // 6-stellig: DDMMYY -> 20YY
  m = s.match(/^(\d{2})(\d{2})(\d{2})$/);
  if (m) {
    const [, d, mo, yy] = m;
    const y = String(2000 + Number(yy));
    const dd = pad2(d);
    const mm = pad2(mo);
    if (!isValidDateParts(dd, mm, y)) return "";
    return `${dd}.${mm}.${y}`;
  }

  // 5-stellig: DMMYY -> 20YY
  m = s.match(/^(\d{1})(\d{2})(\d{2})$/);
  if (m) {
    const [, d, mo, yy] = m;
    const y = String(2000 + Number(yy));
    const dd = pad2(d);
    const mm = pad2(mo);
    if (!isValidDateParts(dd, mm, y)) return "";
    return `${dd}.${mm}.${y}`;
  }

  // 4-stellig: DMYY (AUSLEGUNG: D-M-YY)
  // Beispiel: 2226 => 02.02.2026 / 5126 => 05.01.2026
  m = s.match(/^(\d{1})(\d{1})(\d{2})$/);
  if (m) {
    const [, d, mo, yy] = m;
    const y = String(2000 + Number(yy));
    const dd = pad2(d);
    const mm = pad2(mo);
    if (!isValidDateParts(dd, mm, y)) return "";
    return `${dd}.${mm}.${y}`;
  }

  return "";
}


/**
 * Akzeptiert:
 * - HH.MM
 * - HH:MM
 * - HHMM
 *
 * Normalisiert auf: HH.MM
 * Gibt "" zurück, wenn ungültig.
 */
function normalizeTimeInput(v) {
  const s = String(v || "").trim();
  if (!s) return "";

  // NUR Stunde: "9" oder "14" -> HH.00
  let m = s.match(/^(\d{1,2})$/);
  if (m) {
    const hh = pad2(m[1]);
    const mm = "00";
    if (!isValidTimeParts(hh, mm)) return "";
    return `${hh}.${mm}`;
  }

  // HH:MM oder HH.MM
  m = s.match(/^(\d{1,2})[:.](\d{1,2})$/);
  if (m) {
    const [, hhIn, mmIn] = m;
    const hh = pad2(hhIn);
    const mm = pad2(mmIn);
    if (!isValidTimeParts(hh, mm)) return "";
    return `${hh}.${mm}`;
  }

  // HHMM oder HMM (z.B. 930 -> 09.30)
  m = s.match(/^(\d{3,4})$/);
  if (m) {
    const raw = m[1].padStart(4, "0"); // 930 -> 0930
    const hh = raw.slice(0, 2);
    const mm = raw.slice(2, 4);
    if (!isValidTimeParts(hh, mm)) return "";
    return `${hh}.${mm}`;
  }

  return "";
}

function pad2(x) {
  return String(x).padStart(2, "0");
}

function isValidDateParts(dd, mm, yyyy) {
  const d = Number(dd);
  const m = Number(mm);
  const y = Number(yyyy);
  if (!Number.isInteger(d) || !Number.isInteger(m) || !Number.isInteger(y)) return false;
  if (y < 1900 || y > 2100) return false;
  if (m < 1 || m > 12) return false;
  if (d < 1 || d > 31) return false;

  // echte Kalenderprüfung (31.02. -> invalid)
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

function isValidTimeParts(hh, mm) {
  const h = Number(hh);
  const m = Number(mm);
  if (!Number.isInteger(h) || !Number.isInteger(m)) return false;
  return h >= 0 && h <= 23 && m >= 0 && m <= 59;
}
