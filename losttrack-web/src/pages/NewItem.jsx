import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { previewNextFundNumber, commitNextFundNumber } from "../utils/fundNumber";
import { createEmptyLostItem } from "../domain/lostItem";

import {
  saveDraft,
  commitLostItem,
  getLostItemById,
  updateLostItem,
} from "../core/storage/lostItemRepo";

import { validateLostItem, VALIDATION_MODE } from "../domain/lostItem.validators";

export default function NewItem() {
  const nav = useNavigate();
  const { id } = useParams();

  const isEditMode = !!id;

  // Fundnummern-Logik (Vorschau vs Commit) – im Edit-Mode NICHT neu vergeben
  const [fundNumberPreview, setFundNumberPreview] = useState("");
  const [savedFundNumber, setSavedFundNumber] = useState("");
  const [isFundNumberCommitted, setIsFundNumberCommitted] = useState(false);

  // Domain State
  const [data, setData] = useState(() => createEmptyLostItem());
  const [errors, setErrors] = useState({});

  // Status UI
  const [lastAction, setLastAction] = useState(""); // "draft" | "commit" | "update" | ""
  const [lastMessage, setLastMessage] = useState("");

  useEffect(() => {
    setLastMessage("");
    setLastAction("");
    setErrors({});

    if (isEditMode) {
      const existing = getLostItemById(id);

      if (!existing) {
        setData(createEmptyLostItem());
        setLastMessage("Bearbeiten nicht möglich: Datensatz nicht gefunden.");
        return;
      }

      // ✅ Normalisieren beim Laden (damit Anzeige final ist)
      const normalizedExisting = normalizeLostItemDates(existing);

      setData(normalizedExisting);

      // Fundnummer im Edit-Modus immer als verbindlich anzeigen
      setSavedFundNumber(normalizedExisting.fundNo || "");
      setIsFundNumberCommitted(true);
      setFundNumberPreview(normalizedExisting.fundNo || "");
      return;
    }

    // Neu: nur Vorschau (StrictMode-sicher)
    const preview = previewNextFundNumber();
    setFundNumberPreview(preview);

    setData((prev) => ({
      ...prev,
      fundNo: preview,
    }));

    setSavedFundNumber("");
    setIsFundNumberCommitted(false);
  }, [isEditMode, id]);

  const displayNumber = isEditMode
    ? (data.fundNo || savedFundNumber || "")
    : (isFundNumberCommitted ? savedFundNumber : fundNumberPreview);

  // Helper: Feld-Updates (einfach & stabil)
  function setField(path, value) {
    setData((prev) => setByPath(prev, path, value));
  }

  function showErrors(mode, current) {
    // ✅ Sicherstellen: vor Validierung sind Datum/Zeit im finalen Format
    const normalized = normalizeLostItemDates(current);
    const res = validateLostItem(normalized, { mode });
    setErrors(res.errors);
    return { ...res, value: normalized };
  }

  function handleSaveDraft() {
    setLastMessage("");
    setLastAction("");

    const { value, errors: vErrors } = showErrors(VALIDATION_MODE.DRAFT, data);

    const result = saveDraft(value);
    setData(result.item);
    setErrors(result.errors || vErrors || {});
    setLastAction("draft");
    setLastMessage(isEditMode ? "Entwurf wurde gespeichert (Edit-Modus)." : "Entwurf (Vorschau) wurde gespeichert.");
  }

  function handleCommitOrUpdate() {
    setLastMessage("");
    setLastAction("");

    const res = showErrors(VALIDATION_MODE.COMMIT, data);
    if (!res.ok) {
      setLastAction(isEditMode ? "update" : "commit");
      setLastMessage("Speichern nicht möglich: Bitte Pflichtfelder korrigieren.");
      return;
    }

    if (isEditMode) {
      // ✅ Update: keine neue Fundnummer
      const upd = updateLostItem(res.value);
      if (!upd.ok) {
        setErrors(upd.errors || {});
        setLastAction("update");
        setLastMessage("Update fehlgeschlagen: Bitte Eingaben prüfen.");
        return;
      }

      setData(upd.item);
      setErrors({});
      setLastAction("update");
      setLastMessage("Fundsache wurde aktualisiert.");

      // zurück zur Detailseite
      nav(`/items/${upd.item.id}`);
      return;
    }

    // ✅ Neu-Commit: Fundnummer verbindlich vergeben (Counter hochzählen)
    const committedFundNo = commitNextFundNumber();

    const withFundNo = {
      ...res.value,
      fundNo: committedFundNo,
    };

    const commitResult = commitLostItem(withFundNo);

    if (!commitResult.ok) {
      setErrors(commitResult.errors || {});
      setLastAction("commit");
      setLastMessage("Commit fehlgeschlagen: Bitte Eingaben prüfen.");
      return;
    }

    setData(commitResult.item);
    setSavedFundNumber(committedFundNo);
    setIsFundNumberCommitted(true);

    setErrors({});
    setLastAction("commit");
    setLastMessage("Fundsache wurde definitiv erfasst (Record + Audit).");

    // direkt zur Detailseite
    nav(`/items/${commitResult.item.id}`);
  }

  // UI-Helper: Fehler anzeigen
  const err = useMemo(() => (path) => errors?.[path], [errors]);

  return (
    <section style={{ maxWidth: 1100 }}>
      <h2 style={{ margin: "0 0 10px 0" }}>{isEditMode ? "Fundsache bearbeiten" : "Neue Fundsache"}</h2>

      {/* Fundnummer */}
      <div style={{ marginBottom: 20 }}>
        <label style={{ display: "block", fontWeight: "bold" }}>Fundnummer</label>
        <input
          type="text"
          value={displayNumber}
          readOnly
          style={{
            width: 220,
            padding: "6px 8px",
            backgroundColor: "#f3f3f3",
            border: "1px solid #ccc",
            borderRadius: 4,
            fontWeight: "bold",
          }}
        />

        <div style={{ marginTop: 6, color: "var(--muted)", fontSize: 13 }}>
          {isEditMode
            ? "Edit-Modus: Fundnummer bleibt unverändert."
            : (isFundNumberCommitted
                ? "Fundnummer ist verbindlich vergeben (Commit)."
                : "Vorschau: Fundnummer wird erst beim Commit verbindlich vergeben.")}
        </div>
      </div>

      {/* Sachbearbeiter */}
      <Field label="Sachbearbeiter-ID" error={err("caseWorker.id")}>
        <input
          type="text"
          value={data.caseWorker.id}
          onChange={(e) => setField("caseWorker.id", e.target.value)}
          style={inputStyle(!!err("caseWorker.id"))}
          placeholder='z.B. "ms"'
          autoComplete="off"
          name="caseworker_id"
        />
      </Field>

      <Field label="Sachbearbeiter-Name" error={err("caseWorker.name")}>
        <input
          type="text"
          value={data.caseWorker.name}
          onChange={(e) => setField("caseWorker.name", e.target.value)}
          style={inputStyle(!!err("caseWorker.name"))}
          placeholder='z.B. "M. Streuli"'
          autoComplete="off"
          name="caseworker_name"
        />
      </Field>

      {/* Fundort/-zeit */}
      <div style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: 12 }}>
        <Field label="Funddatum" error={err("foundAt.date")}>
          <input
            type="text"
            value={data.foundAt.date}
            onChange={(e) => setField("foundAt.date", e.target.value)}
            onBlur={(e) => {
              const normalized = normalizeDate(e.target.value);
              setField("foundAt.date", normalized);
            }}
            style={inputStyle(!!err("foundAt.date"))}
            placeholder="25.01.2026"
            autoComplete="off"
            name="found_date"
          />
        </Field>

        <Field label="Fundzeit" error={err("foundAt.time")}>
          <input
            type="text"
            value={data.foundAt.time}
            onChange={(e) => setField("foundAt.time", e.target.value)}
            onBlur={(e) => {
              const normalized = normalizeTime(e.target.value);
              setField("foundAt.time", normalized);
            }}
            style={inputStyle(!!err("foundAt.time"))}
            placeholder="14.30"
            autoComplete="off"
            name="found_time"
          />
        </Field>
      </div>

      <Field label="Fundort (Freitext)" error={err("foundAt.location")}>
        <input
          type="text"
          value={data.foundAt.location}
          onChange={(e) => setField("foundAt.location", e.target.value)}
          style={inputStyle(!!err("foundAt.location"))}
          placeholder="z.B. Bahnhof, Perron 2"
          autoComplete="off"
          name="found_location"
        />
      </Field>

      {/* Finder */}
      <h3 style={{ marginTop: 18, marginBottom: 8 }}>Finder</h3>

      <Field label="Name" error={err("finder.name")}>
        <input
          type="text"
          value={data.finder.name}
          onChange={(e) => setField("finder.name", e.target.value)}
          style={inputStyle(!!err("finder.name"))}
          placeholder="Name Finder"
          autoComplete="off"
          name="finder_name"
        />
      </Field>

      <Field label="Adresse" error={err("finder.address")}>
        <input
          autoComplete="off"
          name="finder_address"
          type="text"
          value={data.finder.address}
          onChange={(e) => setField("finder.address", e.target.value)}
          style={inputStyle(!!err("finder.address"))}
          placeholder="Adresse Finder"
        />
      </Field>

      <Field label="Telefon" error={err("finder.phone")}>
        <input
          type="text"
          value={data.finder.phone}
          onChange={(e) => setField("finder.phone", e.target.value)}
          style={inputStyle(!!err("finder.phone"))}
          placeholder="+41 ..."
          autoComplete="off"
          name="finder_phone"
        />
      </Field>

      <Field label="E-Mail" error={err("finder.email")}>
        <input
          type="text"
          value={data.finder.email}
          onChange={(e) => setField("finder.email", e.target.value)}
          style={inputStyle(!!err("finder.email"))}
          placeholder="name@mail.ch"
          autoComplete="off"
          name="finder_email"
        />
      </Field>

      <div style={{ marginBottom: 14 }}>
        <label style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <input
            type="checkbox"
            checked={!!data.finder.rewardRequested}
            onChange={(e) => setField("finder.rewardRequested", e.target.checked)}
            name="finder_reward_requested"
          />
          Finderlohn gewünscht
        </label>
      </div>

      {/* Gegenstand */}
      <h3 style={{ marginTop: 18, marginBottom: 8 }}>Gegenstand</h3>

      <Field label="Vordefiniert (Key) – optional" error={err("item.predefinedKey")}>
        <input
          type="text"
          value={data.item.predefinedKey}
          onChange={(e) => setField("item.predefinedKey", e.target.value)}
          style={inputStyle(!!err("item.predefinedKey"))}
          placeholder='z.B. "wallet"'
          autoComplete="off"
          name="item_predefined_key"
        />
      </Field>

      <Field label="Manuell (Label) – optional" error={err("item.manualLabel")}>
        <input
          type="text"
          value={data.item.manualLabel}
          onChange={(e) => setField("item.manualLabel", e.target.value)}
          style={inputStyle(!!err("item.manualLabel"))}
          placeholder='z.B. "Schlüsselbund"'
          autoComplete="off"
          name="item_manual_label"
        />
      </Field>

      <Field label="Beschreibung / Merkmale" error={err("item.description")}>
        <textarea
          value={data.item.description}
          onChange={(e) => setField("item.description", e.target.value)}
          style={{
            ...inputStyle(!!err("item.description")),
            minHeight: 80,
            resize: "vertical",
          }}
          placeholder="Aussehen, Nummern, Besonderheiten..."
          autoComplete="off"
          name="item_description"
        />
      </Field>

      {/* Buttons */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 18 }}>
        <button type="button" onClick={handleSaveDraft} style={btnStyle(false)}>
          Draft speichern
        </button>

        <button type="button" onClick={handleCommitOrUpdate} style={btnStyle(true)}>
          {isEditMode ? "Update (speichern)" : "Commit (definitiv)"}
        </button>

        {lastMessage && <span style={{ color: "var(--muted)" }}>{lastMessage}</span>}
      </div>

      {/* Hinweis */}
      <div style={{ marginTop: 14, color: "var(--muted)", fontSize: 13 }}>
        Hinweis: Records/Drafts/Audit liegen in LocalStorage unter:
        <br />
        <code>lostItems.drafts.v1</code>, <code>lostItems.records.v1</code>, <code>lostItems.audit.v1</code>
      </div>
    </section>
  );
}

/* ----------------- UI helpers ----------------- */

function Field({ label, error, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: "block", fontWeight: "bold", marginBottom: 6 }}>
        {label}
      </label>
      {children}
      {error ? (
        <div style={{ marginTop: 6, color: "#B00020", fontSize: 13 }}>{error}</div>
      ) : null}
    </div>
  );
}

function inputStyle(hasError) {
  return {
    width: "100%",
    padding: "8px 10px",
    borderRadius: 6,
    border: `1px solid ${hasError ? "#B00020" : "#ccc"}`,
    outline: "none",
  };
}

function btnStyle(primary) {
  return {
    padding: "8px 12px",
    borderRadius: 6,
    border: "1px solid #ccc",
    cursor: "pointer",
    background: primary ? "#f0f0f0" : "#f3f3f3",
  };
}

/**
 * Setzt einen Wert in einem verschachtelten Objekt per "a.b.c"-Pfad.
 */
function setByPath(obj, path, value) {
  const parts = path.split(".");
  const copy = { ...obj };
  let cur = copy;

  for (let i = 0; i < parts.length - 1; i++) {
    const k = parts[i];
    cur[k] = { ...(cur[k] || {}) };
    cur = cur[k];
  }

  cur[parts[parts.length - 1]] = value;
  return copy;
}

/* ----------------- Date / Time normalization ----------------- */

/**
 * Akzeptiert:
 * - DD.MM.YYYY
 * - DD-MM-YYYY
 * - DD/MM/YYYY
 * - YYYY-MM-DD
 * - YYYY/MM/DD
 * - YYYY.MM.DD
 * - DDMMYYYY
 * - DDMMYY
 * - DDMM
 *
 * Gibt zurück:
 * - DD.MM.YYYY
 * - oder "" bei ungültig
 */
function normalizeDate(value) {
  if (!value) return "";
  const v = String(value).trim();
  if (!v) return "";

  let m;

  // ISO / International: YYYY-MM-DD / YYYY/MM/DD / YYYY.MM.DD
  m = v.match(/^(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})$/);
  if (m) {
    const [, y, mo, d] = m;
    const dd = pad2(d);
    const mm = pad2(mo);
    if (!isValidDateParts(dd, mm, y)) return "";
    return `${dd}.${mm}.${y}`;
  }

  // EU: DD-MM-YYYY / DD/MM/YYYY / DD.MM.YYYY
  m = v.match(/^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})$/);
  if (m) {
    const [, d, mo, y] = m;
    const dd = pad2(d);
    const mm = pad2(mo);
    if (!isValidDateParts(dd, mm, y)) return "";
    return `${dd}.${mm}.${y}`;
  }

  // NUR ZIFFERN: DDMMYYYY
  m = v.match(/^(\d{2})(\d{2})(\d{4})$/);
  if (m) {
    const [, d, mo, y] = m;
    const dd = pad2(d);
    const mm = pad2(mo);
    if (!isValidDateParts(dd, mm, y)) return "";
    return `${dd}.${mm}.${y}`;
  }

  // NUR ZIFFERN: DDMMYY -> 20YY
  m = v.match(/^(\d{2})(\d{2})(\d{2})$/);
  if (m) {
    const [, d, mo, yy] = m;
    const y = String(2000 + Number(yy));
    const dd = pad2(d);
    const mm = pad2(mo);
    if (!isValidDateParts(dd, mm, y)) return "";
    return `${dd}.${mm}.${y}`;
  }

  // NUR ZIFFERN: DDMM -> aktuelles Jahr
  m = v.match(/^(\d{2})(\d{2})$/);
  if (m) {
    const [, d, mo] = m;
    const y = String(new Date().getFullYear());
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
 * - HMM   (z. B. 930)
 * - H / HH
 *
 * Gibt zurück:
 * - HH.MM
 * - oder "" bei ungültig
 */
function normalizeTime(value) {
  if (!value) return "";
  const v = String(value).trim();
  if (!v) return "";

  let m;

  // NUR STUNDE: "9" oder "14" -> HH.00
  m = v.match(/^(\d{1,2})$/);
  if (m) {
    const hh = pad2(m[1]);
    const mm = "00";
    if (!isValidTimeParts(hh, mm)) return "";
    return `${hh}.${mm}`;
  }

  // HH:MM oder HH.MM (Minuten auch 1-stellig)
  m = v.match(/^(\d{1,2})[:.](\d{1,2})$/);
  if (m) {
    const [, h, min] = m;
    const hh = pad2(h);
    const mm = pad2(min);
    if (!isValidTimeParts(hh, mm)) return "";
    return `${hh}.${mm}`;
  }

  // HHMM oder HMM (z. B. 930 -> 09.30)
  m = v.match(/^(\d{3,4})$/);
  if (m) {
    const raw = m[1].padStart(4, "0");
    const hh = raw.slice(0, 2);
    const mm = raw.slice(2, 4);
    if (!isValidTimeParts(hh, mm)) return "";
    return `${hh}.${mm}`;
  }

  return "";
}

function pad2(v) {
  return String(v).padStart(2, "0");
}

function isValidDateParts(dd, mm, yyyy) {
  const d = Number(dd);
  const m = Number(mm);
  const y = Number(yyyy);
  if (!Number.isInteger(d) || !Number.isInteger(m) || !Number.isInteger(y)) return false;
  if (y < 1900 || y > 2100) return false;
  if (m < 1 || m > 12) return false;
  if (d < 1 || d > 31) return false;

  // echte Kalenderprüfung
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

function isValidTimeParts(hh, mm) {
  const h = Number(hh);
  const m = Number(mm);
  if (!Number.isInteger(h) || !Number.isInteger(m)) return false;
  if (h < 0 || h > 23) return false;
  if (m < 0 || m > 59) return false;
  return true;
}

/**
 * Normalisiert foundAt.date und foundAt.time in einem LostItem-Objekt
 * (ohne Mutation des Originals).
 */
function normalizeLostItemDates(item) {
  if (!item) return item;

  const dateNorm = normalizeDate(item?.foundAt?.date || "");
  const timeNorm = normalizeTime(item?.foundAt?.time || "");

  return {
    ...item,
    foundAt: {
      ...(item.foundAt || {}),
      date: dateNorm || (item?.foundAt?.date || ""),
      time: timeNorm || (item?.foundAt?.time || ""),
    },
  };
}
