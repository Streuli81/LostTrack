import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { previewNextFundNumber, commitNextFundNumber } from "../utils/fundNumber";
import { createEmptyLostItem } from "../domain/lostItem";
import { FEE_OPTIONS } from "../domain/workflow.js";
import ItemCatalogSelect from "../components/ItemCatalogSelect.jsx";
import { selectCatalogItem } from "../domain/itemCatalog.js";

import {
  saveDraft,
  commitLostItem,
  getLostItemById,
  getDraftById,
  updateLostItem,
} from "../core/storage/lostItemRepo";

import { validateLostItem, VALIDATION_MODE } from "../domain/lostItem.validators";

export default function NewItem() {
  const { id, draftId } = useParams();
  return <NewItemForm key={id ? `item:${id}` : draftId ? `draft:${draftId}` : "new"}
    recordId={id} draftId={draftId} />;
}

function NewItemForm({ recordId, draftId }) {
  const nav = useNavigate();
  const isEditMode = !!recordId;
  const isDraftMode = !!draftId;
  // Bei einem Wechsel der Adresse wird das Formular durch seinen key neu geladen.
  // Die Initialisierung liest nur; sie speichert und zählt keine Nummern hoch.
  const [initial] = useState(() => {
    const existing = recordId ? getLostItemById(recordId) : draftId ? getDraftById(draftId) : null;
    if ((recordId || draftId) && !existing) return { missing: true, data: createEmptyLostItem(), preview: "" };
    const preview = recordId ? existing.fundNo : previewNextFundNumber();
    const value = existing ? normalizeLostItemDates(existing) : { ...createEmptyLostItem(), id: crypto.randomUUID() };
    return { missing: false, data: { ...value, fundNo: preview,
      ...(!recordId ? { feeSelection: value.feeSelection || "UNSET" } : {}) }, preview };
  });
  const [data, setData] = useState(initial.data);
  const [errors, setErrors] = useState({});
  const [lastMessage, setLastMessage] = useState("");
  const displayNumber = isEditMode ? data.fundNo : initial.preview;

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

    const { value, errors: vErrors } = showErrors(VALIDATION_MODE.DRAFT, data);

    const result = saveDraft(value, { fromDraft: isDraftMode });
    if (result.ok === false) {
      setErrors(result.errors || {});
      setLastMessage(result.error || "Entwurf konnte nicht gespeichert werden.");
      return;
    }
    setData(result.item);
    setErrors(result.errors || vErrors || {});
    setLastMessage("Entwurf wurde gespeichert. Du kannst ihn über die Übersicht weiterbearbeiten.");
  }

  function handleCommitOrUpdate() {
    setLastMessage("");

    const res = showErrors(VALIDATION_MODE.COMMIT, data);
    if (!res.ok) {
      setLastMessage("Speichern nicht möglich: Bitte Pflichtfelder korrigieren.");
      return;
    }

    if (isEditMode) {
      // ✅ Update: keine neue Fundnummer
      const upd = updateLostItem(res.value);
      if (!upd.ok) {
        setErrors(upd.errors || {});
        setLastMessage("Update fehlgeschlagen: Bitte Eingaben prüfen.");
        return;
      }

      setData(upd.item);
      setErrors({});
      setLastMessage("Fundsache wurde aktualisiert.");

      // zurück zur Detailseite
      nav(`/items/${upd.item.id}`);
      return;
    }

    // Ein bereits in einem anderen Fenster übernommener Entwurf darf keine
    // weitere Fundnummer verbrauchen oder den definitiven Datensatz überschreiben.
    const existing = getLostItemById(data.id);
    if (existing) {
      nav(`/items/${existing.id}`);
      return;
    }
    if (isDraftMode && !getDraftById(data.id)) {
      setLastMessage("Der Entwurf wurde nicht gefunden. Bitte die Übersicht aktualisieren.");
      return;
    }

    // Neu-Commit: Fundnummer verbindlich vergeben.
    const committedFundNo = commitNextFundNumber();
    if (!committedFundNo) {
      setLastMessage("Keine Berechtigung zur definitiven Erfassung. Bitte erneut anmelden.");
      return;
    }

    const withFundNo = {
      ...res.value,
      fundNo: committedFundNo,
    };

    const commitResult = commitLostItem(withFundNo, { fromDraft: isDraftMode });

    if (!commitResult.ok) {
      setErrors(commitResult.errors || {});
      setLastMessage(commitResult.error || "Speichern fehlgeschlagen: Bitte Eingaben prüfen.");
      return;
    }

    setData(commitResult.item);

    setErrors({});
    setLastMessage("Fundsache wurde definitiv erfasst (Record + Audit).");

    // direkt zur Detailseite
    nav(`/items/${commitResult.item.id}`);
  }

  // UI-Helper: Fehler anzeigen
  const err = useMemo(() => (path) => errors?.[path], [errors]);

  if (initial.missing) {
    return <section>
      <h2>{isDraftMode ? "Entwurf nicht gefunden" : "Fundsache nicht gefunden"}</h2>
      <p>Der Eintrag ist nicht mehr vorhanden oder wurde bereits definitiv erfasst.</p>
      <Link to="/">Zur Übersicht</Link>
    </section>;
  }

  return (
    <section style={{ maxWidth: 1100 }}>
      <h2 style={{ margin: "0 0 10px 0" }}>{isEditMode ? "Fundsache bearbeiten" : isDraftMode ? "Entwurf weiterbearbeiten" : "Neue Fundsache"}</h2>

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
            : "Vorschau: Die Fundnummer wird erst bei der definitiven Erfassung vergeben."}
        </div>
      </div>

      {/* Sachbearbeiter */}
      <Field label="Sachbearbeiter-ID" error={err("caseWorker.id")}>
        <input
          type="text"
          value={data.caseWorker.id}
          onChange={(e) => setField("caseWorker.id", e.target.value)}
          style={inputStyle(!!err("caseWorker.id"))}
          placeholder='z.B. "3xxx"'
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
            placeholder="01.01.2026"
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

      <h3 style={{ marginTop: 18, marginBottom: 6 }}>Fristdaten nach ZGB</h3>
      <div style={{ color: "var(--muted)", fontSize: 13, marginBottom: 10 }}>
        Das Funddatum löst diese Fristen nicht automatisch aus. Erfasse die tatsächliche Übernahme in die Aufbewahrung
        sowie das Datum der Anzeige oder Bekanntmachung.
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Beginn der Aufbewahrung (Art. 721 ZGB)" error={err("retention.custodyStartDate")}>
          <input
            type="text"
            value={data.retention.custodyStartDate}
            onChange={(e) => setField("retention.custodyStartDate", e.target.value)}
            onBlur={(e) => setField("retention.custodyStartDate", normalizeDate(e.target.value))}
            style={inputStyle(!!err("retention.custodyStartDate"))}
            placeholder="TT.MM.JJJJ"
            autoComplete="off"
            name="retention_custody_start_date"
          />
        </Field>
        <Field label="Datum Anzeige/Bekanntmachung (Art. 722 ZGB)" error={err("retention.noticeDate")}>
          <input
            type="text"
            value={data.retention.noticeDate}
            onChange={(e) => setField("retention.noticeDate", e.target.value)}
            onBlur={(e) => setField("retention.noticeDate", normalizeDate(e.target.value))}
            style={inputStyle(!!err("retention.noticeDate"))}
            placeholder="TT.MM.JJJJ"
            autoComplete="off"
            name="retention_notice_date"
          />
        </Field>
        <Field label="Grundlage des Fristbeginns" error={err("retention.noticeType")}>
          <select
            value={data.retention.noticeType}
            onChange={(e) => setField("retention.noticeType", e.target.value)}
            style={inputStyle(!!err("retention.noticeType"))}
            name="retention_notice_type"
          >
            <option value="">Bitte auswählen</option>
            <option value="POLICE_REPORT">Anzeige bei der Polizei</option>
            <option value="PUBLIC_ANNOUNCEMENT">Öffentliche Bekanntmachung</option>
          </select>
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

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Vorname" error={err("finder.firstName")}>
          <input
            type="text"
            value={data.finder.firstName}
            onChange={(e) => setField("finder.firstName", e.target.value)}
            style={inputStyle(!!err("finder.firstName"))}
            placeholder="Vorname Finder"
            autoComplete="off"
            name="finder_firstName"
          />
        </Field>

        <Field label="Name" error={err("finder.lastName")}>
          <input
            type="text"
            value={data.finder.lastName}
            onChange={(e) => setField("finder.lastName", e.target.value)}
            style={inputStyle(!!err("finder.lastName"))}
            placeholder="Name Finder"
            autoComplete="off"
            name="finder_lastName"
          />
        </Field>

        <Field label="Strasse" error={err("finder.street")}>
          <input
            type="text"
            value={data.finder.street}
            onChange={(e) => setField("finder.street", e.target.value)}
            style={inputStyle(!!err("finder.street"))}
            placeholder="Strasse"
            autoComplete="off"
            name="finder_street"
          />
        </Field>

        <Field label="Nr." error={err("finder.streetNo")}>
          <input
            type="text"
            value={data.finder.streetNo}
            onChange={(e) => setField("finder.streetNo", e.target.value)}
            style={inputStyle(!!err("finder.streetNo"))}
            placeholder="Nr."
            autoComplete="off"
            name="finder_streetNo"
          />
        </Field>

        <Field label="PLZ" error={err("finder.zip")}>
          <input
            type="text"
            value={data.finder.zip}
            onChange={(e) => setField("finder.zip", e.target.value)}
            style={inputStyle(!!err("finder.zip"))}
            placeholder="PLZ"
            autoComplete="off"
            name="finder_zip"
          />
        </Field>

        <Field label="Ort" error={err("finder.city")}>
          <input
            type="text"
            value={data.finder.city}
            onChange={(e) => setField("finder.city", e.target.value)}
            style={inputStyle(!!err("finder.city"))}
            placeholder="Ort"
            autoComplete="off"
            name="finder_city"
          />
        </Field>
      </div>

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

      <fieldset
        aria-describedby={err("finder.rewardChoice") ? "finder-reward-choice-error" : undefined}
        style={{
          border: err("finder.rewardChoice") ? "1px solid #b00020" : "1px solid rgba(0,0,0,0.2)",
          borderRadius: 8,
          margin: "0 0 14px",
          padding: "10px 12px",
        }}
      >
        <legend style={{ fontWeight: 700, padding: "0 4px" }}>Finderlohn</legend>
        <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <input
            type="radio"
            name="finder_reward_choice"
            value="REQUESTED"
            checked={(data.finder.rewardChoice || (data.finder.rewardRequested ? "REQUESTED" : "")) === "REQUESTED"}
            onChange={() => {
              setField("finder.rewardChoice", "REQUESTED");
              setField("finder.rewardRequested", true);
            }}
          />
          Finderlohn ist gewünscht
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            type="radio"
            name="finder_reward_choice"
            value="WAIVED"
            checked={data.finder.rewardChoice === "WAIVED"}
            onChange={() => {
              setField("finder.rewardChoice", "WAIVED");
              setField("finder.rewardRequested", false);
            }}
          />
          Verzicht auf Finderlohn
        </label>
        {err("finder.rewardChoice") ? (
          <div id="finder-reward-choice-error" role="alert" style={{ color: "#b00020", marginTop: 6, fontSize: 13 }}>
            {err("finder.rewardChoice")}
          </div>
        ) : null}
      </fieldset>

      {/* Gegenstand */}
      <h3 style={{ marginTop: 18, marginBottom: 8 }}>Gegenstand</h3>

      <ItemCatalogSelect value={data.item.predefinedKey} label={data.item.manualLabel}
        onChange={(key) => setData((previous) => selectCatalogItem(previous, key, { updateFee: !isEditMode }))} />
      {err("item.predefinedKey") && <p role="alert">{err("item.predefinedKey")}</p>}
      {isEditMode && <p>Bestehende Gebühren und Zahlungen bleiben erhalten. Änderungen daran bitte im Ablauf auf der Detailseite vornehmen.</p>}

      <Field label="Gegenstandsbezeichnung / manuelle Ergänzung" error={err("item.manualLabel")}>
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

      {!isEditMode && <Field label="Gemeindegebühr für diese Sache" error={err("feeSelection")}>
        <select aria-label="Gemeindegebühr für diese Sache" value={data.feeSelection || "UNSET"} onChange={(event) => setField("feeSelection", event.target.value)} style={inputStyle(false)}>
          {FEE_OPTIONS.map((fee) => <option key={fee.code} value={fee.code}>{fee.label}</option>)}
        </select>
        <p>Die Gegenstandsauswahl schlägt die Gebühr automatisch vor: Schlüssel oder ganzer Schlüsselbund CHF 10.00,
          Mobiltelefonvermittlung CHF 20.00, übrige bestimmte Fundsachen gebührenfrei.
          Bei Mobiltelefonen gilt der Betrag für die Vermittlung. Falls keine Vermittlung erfolgt, die Auswahl auf gebührenfrei ändern.
          Die Auswahl allein bestätigt keine Vermittlung und bucht keine Zahlung.
          Finderlohn und Auslagenersatz werden später getrennt festgelegt.
          Mehrere Gegenstände und Mengen kannst du nach der Erfassung im Ablauf ergänzen.</p>
      </Field>}

      {/* Buttons */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 18 }}>
        {!isEditMode && <button type="button" onClick={handleSaveDraft} style={btnStyle(false)}>
          Entwurf speichern
        </button>}

        <button type="button" onClick={handleCommitOrUpdate} style={btnStyle(true)}>
          {isEditMode ? "Änderungen speichern" : "Definitiv erfassen"}
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
    retention: {
      ...(item.retention || {}),
      custodyStartDate:
        normalizeDate(item?.retention?.custodyStartDate || "") || item?.retention?.custodyStartDate || "",
      noticeDate: normalizeDate(item?.retention?.noticeDate || "") || item?.retention?.noticeDate || "",
    },
  };
}
