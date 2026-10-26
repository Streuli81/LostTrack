// src/domain/lostItem.validators.js

import { normalizeLostItem } from "./lostItem.js";
import { FIND_ENVIRONMENTS, FUND_REGIMES, finderRewardExcluded, isReferralOnly, linkCustodyToNotice, isInstitutionFind, institutionRightsChecked } from "./captureContext.js";
import { validateExpenseClaims } from "./expenseClaims.js";
import { validateFoundValues } from "./foundValues.js";

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
  const valueRaw = normalizeLostItem(linkCustodyToNotice(input));
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
  const custodyDateIn = valueRaw?.retention?.custodyStartDate || "";
  const noticeDateIn = valueRaw?.retention?.noticeDate || "";
  const custodyDateNorm = !isEmpty(custodyDateIn) ? normalizeDateInput(custodyDateIn) : "";
  const noticeDateNorm = !isEmpty(noticeDateIn) ? normalizeDateInput(noticeDateIn) : "";
  const noticeTimeIn = valueRaw?.retention?.noticeTime || "";
  const custodyTimeIn = valueRaw?.retention?.custodyStartTime || "";
  const noticeTimeNorm = noticeTimeIn ? normalizeTimeInput(noticeTimeIn) : "";
  const custodyTimeNorm = custodyTimeIn ? normalizeTimeInput(custodyTimeIn) : "";

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
    retention: {
      ...(valueRaw.retention || {}),
      custodyStartDate: custodyDateNorm || custodyDateIn,
      noticeDate: noticeDateNorm || noticeDateIn,
      noticeTime: noticeTimeNorm || noticeTimeIn,
      custodyStartTime: custodyTimeNorm || custodyTimeIn,
    },
  };

  // -------------------------
  // COMMIT Pflichtfelder
  // -------------------------
  if (isCommit) {
    if (value.captureVersion === 1 && !FIND_ENVIRONMENTS.some(([code]) => code === value.origin?.type)) {
      setErr("origin.type", "Bitte die Fundumgebung auswählen.");
    }
    if (value.origin?.type === "PUBLIC_TRANSPORT" && isEmpty(value.origin.operator)) {
      setErr("origin.operator", "Bitte das zuständige Verkehrsunternehmen angeben.");
    }
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

    // ✅ Finder: mindestens Vorname ODER Nachname ODER Telefon ODER E-Mail
    const fnFirst = value?.finder?.firstName || "";
    const fnLast = value?.finder?.lastName || "";
    const fnPhone = value?.finder?.phone || "";
    const fnEmail = value?.finder?.email || "";

    if (!finderRewardExcluded(value) && !isReferralOnly(value) && !hasAny(fnFirst, fnLast, fnPhone, fnEmail)) {
      const msg = "Finder: Name oder Telefon oder E-Mail ist erforderlich.";
      setErr("finder.firstName", msg);
      setErr("finder.lastName", msg);
      setErr("finder.phone", msg);
      setErr("finder.email", msg);
    }

    if (!finderRewardExcluded(value) && !isReferralOnly(value) && !new Set(["REQUESTED", "WAIVED"]).has(value?.finder?.rewardChoice)) {
      setErr("finder.rewardChoice", "Bitte Finderlohn wünschen oder ausdrücklich darauf verzichten.");
    }
  }

  // -------------------------
  // Format-Checks (Draft + Commit)
  // -------------------------

  // E-Mail nur prüfen, wenn gesetzt
  const claimCheck = validateExpenseClaims(value);
  if (!claimCheck.ok) setErr("expenseClaims", claimCheck.error);
  const contentsCheck = validateFoundValues(value);
  if (!contentsCheck.ok) setErr("contents", contentsCheck.error);
  if (value.regime !== undefined && (!value.regime || typeof value.regime !== "object" ||
    (isCommit || value.regime.type) && !FUND_REGIMES.some(([code]) => code === value.regime.type))) setErr("regime.type", "Bitte ein gültiges Fundregime auswählen.");
  if (value.roles !== undefined && (!value.roles || typeof value.roles !== "object" || Array.isArray(value.roles))) setErr("roles.delivererName", "Ungültige Personenrollen.");
  else if (value.roles) for (const [key, raw] of Object.entries(value.roles)) {
    if (["delivererSameAsDiscoverer", "legalFinderSameAsDiscoverer"].includes(key) ? typeof raw !== "boolean" : typeof raw !== "string" || raw.length > 2000) setErr(`roles.${key}`, "Ungültige Rollenangabe.");
  }
  for (const key of ["reportedDate", "receivedDate"]) {
    const raw = value.retention?.[key];
    if (raw) { const date = normalizeDateInput(raw); if (!date) setErr(`retention.${key}`, "Ungültiges Datum (TT.MM.JJJJ)."); else value.retention[key] = date; }
  }
  for (const key of ["reportedTime", "receivedTime"]) {
    const raw = value.retention?.[key];
    if (raw) { const time = normalizeTimeInput(raw); if (!time) setErr(`retention.${key}`, "Ungültige Zeit (HH.MM)."); else value.retention[key] = time; }
  }
  if (value.retention?.dateModel === "SEPARATE") {
    const basis = value.retention.finderBasis;
    if (basis && !["REPORT", "PUBLICATION"].includes(basis)) setErr("retention.finderBasis", "Ungültige Fristgrundlage.");
    if (basis === "REPORT" && !value.retention.reportedDate) setErr("retention.reportedDate", "Das gewählte Anzeigedatum fehlt.");
    if (basis === "PUBLICATION" && !value.retention.noticeDate) setErr("retention.noticeDate", "Das gewählte Bekanntmachungsdatum fehlt.");
  }
  if (value.institution !== undefined) {
    if (!value.institution || typeof value.institution !== "object" || Array.isArray(value.institution)) setErr("institution.name", "Ungültige Angaben zur Einrichtung.");
    else {
      value.institution = { ...value.institution };
      for (const key of ["name", "internalLocation", "deliveredBy", "deliveringInstitution", "legalFinderName", "legalFinderContact", "reviewNote"]) {
        const raw = value.institution[key];
        if (raw !== undefined && (typeof raw !== "string" || raw.length > 2000)) setErr(`institution.${key}`, "Bitte einen Text mit höchstens 2000 Zeichen eingeben.");
      }
      for (const key of ["handedToInstitutionDate", "handedToOfficeDate"]) {
        const raw = value.institution[key];
        if (raw) {
          const normalized = normalizeDateInput(raw);
          if (!normalized) setErr(`institution.${key}`, "Bitte ein gültiges Datum (TT.MM.JJJJ) eingeben.");
          else value.institution[key] = normalized;
        }
      }
      if (value.institution.intakeSource && !["UNKNOWN", "PERSON", "INSTITUTION"].includes(value.institution.intakeSource)) setErr("institution.intakeSource", "Ungültige Herkunft der Übergabe.");
      if (value.institution.legalFinderConfirmed !== undefined && typeof value.institution.legalFinderConfirmed !== "boolean") setErr("institution.reviewNote", "Die Prüfung muss ausdrücklich bestätigt werden.");
    }
  }
  if (isInstitutionFind(value)) {
    if (isCommit && isEmpty(value.institution?.name)) setErr("institution.name", "Bitte die Einrichtung / den Betrieb angeben.");
    if (value.institution?.legalFinderConfirmed === true && !institutionRightsChecked(value)) setErr("institution.reviewNote", "Bitte rechtliche Finderstelle und Prüfgrundlage erfassen.");
    if (isCommit && value.institution?.intakeSource === "INSTITUTION" && isEmpty(value.institution.deliveringInstitution)) setErr("institution.deliveringInstitution", "Bitte die übergebende Einrichtung angeben.");
    if (isCommit && value.institution?.intakeSource === "PERSON" && isEmpty(value.institution.deliveredBy)) setErr("institution.deliveredBy", "Bitte den Überbringer angeben.");
  }
  if (value.origin !== undefined) {
    if (!value.origin || typeof value.origin !== "object" || Array.isArray(value.origin)) setErr("origin.type", "Ungültige Fundumgebung.");
    else for (const key of ["type", "operator", "line", "route", "direction", "vehicleNo"]) {
      if (value.origin[key] !== undefined && (typeof value.origin[key] !== "string" || value.origin[key].length > 500)) setErr(`origin.${key}`, "Bitte einen Text mit höchstens 500 Zeichen eingeben.");
    }
  }
  if (value.origin?.type && !FIND_ENVIRONMENTS.some(([code]) => code === value.origin.type)) setErr("origin.type", "Ungültige Fundumgebung.");
  if (noticeTimeIn && !noticeTimeNorm) setErr("retention.noticeTime", "Ungültige Bekanntmachungszeit. Bitte HH.MM eingeben.");
  if (custodyTimeIn && !custodyTimeNorm) setErr("retention.custodyStartTime", "Ungültige Aufbewahrungszeit. Bitte HH.MM eingeben.");
  if (value.captureVersion === 1) {
    if (noticeDateIn && !noticeTimeIn) setErr("retention.noticeTime", "Bitte die Bekanntmachungszeit angeben.");
    if (noticeTimeIn && !noticeDateIn) setErr("retention.noticeDate", "Bitte das Bekanntmachungsdatum angeben.");
  }
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

  if (!isEmpty(custodyDateIn) && !custodyDateNorm) {
    setErr("retention.custodyStartDate", "Ungültiges Datum. Bitte TT.MM.JJJJ eingeben.");
  }
  if (!isEmpty(noticeDateIn) && !noticeDateNorm) {
    setErr("retention.noticeDate", "Ungültiges Datum. Bitte TT.MM.JJJJ eingeben.");
  }
  if (value.retention?.dateModel !== "SEPARATE" && !isEmpty(noticeDateIn) && isEmpty(value?.retention?.noticeType)) {
    setErr("retention.noticeType", "Bitte angeben, ob die Frist mit Anzeige oder Bekanntmachung beginnt.");
  }
  if (value.retention?.dateModel !== "SEPARATE" && isEmpty(noticeDateIn) && !isEmpty(value?.retention?.noticeType)) {
    setErr("retention.noticeDate", "Bitte das Datum der Anzeige oder Bekanntmachung erfassen.");
  }
  if (!isEmpty(value?.retention?.noticeType) && !["POLICE_REPORT", "PUBLIC_ANNOUNCEMENT"].includes(value.retention.noticeType)) {
    setErr("retention.noticeType", "Ungültige Grundlage des Fristbeginns.");
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
