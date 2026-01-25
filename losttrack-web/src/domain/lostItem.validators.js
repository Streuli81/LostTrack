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
 * @param {object} input LostItem (roh oder bereits normalisiert)
 * @param {object} opts
 * @param {"DRAFT"|"COMMIT"} opts.mode
 * @returns {{ ok: boolean, errors: Record<string,string>, value: object }}
 */
export function validateLostItem(input, { mode = VALIDATION_MODE.DRAFT } = {}) {
  const value = normalizeLostItem(input);
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
      // Fehler bewusst auf beide Felder „sichtbar“ machen (UI kann eines davon markieren)
      setErr("item.predefinedKey", "Gegenstand auswählen oder manuell erfassen.");
      setErr("item.manualLabel", "Gegenstand auswählen oder manuell erfassen.");
    }

    // Finder: mindestens Name ODER Telefon ODER E-Mail (dein Modell hat nur "name", nicht first/last)
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

  // Datum grob prüfen (wenn gesetzt)
  if (!isEmpty(value?.foundAt?.date) && !isIsoDate(value.foundAt.date)) {
    setErr("foundAt.date", "Datum muss im Format YYYY-MM-DD sein.");
  }

  // Zeit grob prüfen (wenn gesetzt)
  if (!isEmpty(value?.foundAt?.time) && !isTimeHHMM(value.foundAt.time)) {
    setErr("foundAt.time", "Zeit muss im Format HH:MM sein.");
  }

  // Status (normalizeLostItem setzt bereits korrekt, aber Fehler geben kann UI helfen)
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

function isIsoDate(v) {
  // YYYY-MM-DD (keine echte Kalenderprüfung, aber robust genug fürs UI)
  return /^\d{4}-\d{2}-\d{2}$/.test(String(v).trim());
}

function isTimeHHMM(v) {
  // HH:MM (24h)
  const s = String(v).trim();
  if (!/^\d{2}:\d{2}$/.test(s)) return false;
  const [hh, mm] = s.split(":").map((x) => parseInt(x, 10));
  return hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59;
}
