import { useEffect, useMemo, useState } from "react";
import { previewNextFundNumber, commitNextFundNumber } from "../utils/fundNumber";

import { createEmptyLostItem } from "../domain/lostItem";
import { saveDraft, commitLostItem } from "../core/storage/lostItemRepo";
import { validateLostItem, VALIDATION_MODE } from "../domain/lostItem.validators";

export default function NewItem() {
  // Fundnummern-Logik (Vorschau vs Commit)
  const [fundNumberPreview, setFundNumberPreview] = useState("");
  const [savedFundNumber, setSavedFundNumber] = useState("");
  const [isFundNumberCommitted, setIsFundNumberCommitted] = useState(false);

  // Domain State
  const [data, setData] = useState(() => createEmptyLostItem());
  const [errors, setErrors] = useState({});

  // Status UI
  const [lastAction, setLastAction] = useState(""); // "draft" | "commit" | ""
  const [lastMessage, setLastMessage] = useState("");

  useEffect(() => {
    // Nur Vorschau (kein Hochzählen) → StrictMode-sicher
    const preview = previewNextFundNumber();
    setFundNumberPreview(preview);

    // Fundnummer als Preview in den Form-State schreiben (read-only)
    setData((prev) => ({
      ...prev,
      fundNo: preview,
    }));
  }, []);

  const displayNumber = isFundNumberCommitted ? savedFundNumber : fundNumberPreview;

  // Helper: Feld-Updates (einfach & stabil)
  function setField(path, value) {
    setData((prev) => setByPath(prev, path, value));
  }

  function showErrors(mode, current) {
    const res = validateLostItem(current, { mode });
    setErrors(res.errors);
    return res;
  }

  // 1) Vorschau speichern → Draft (ohne Fundnummer-Counter zu committen)
  function handleSaveDraft() {
    setLastMessage("");
    setLastAction("");

    // Draft validieren (weiche Checks)
    const { value, errors: vErrors } = showErrors(VALIDATION_MODE.DRAFT, data);

    // Fundnummer bleibt Preview (kein commitNextFundNumber!)
    const result = saveDraft(value);
    setData(result.item);
    setErrors(result.errors || vErrors || {});
    setLastAction("draft");
    setLastMessage("Entwurf (Vorschau) wurde gespeichert. Fundnummer ist noch nicht verbindlich.");
  }

  // 2) Commit → Fundnummer verbindlich + Record + Audit
  function handleCommit() {
    setLastMessage("");
    setLastAction("");

    // Commit validieren (harte Pflichtfelder)
    const res = showErrors(VALIDATION_MODE.COMMIT, data);
    if (!res.ok) {
      setLastAction("commit");
      setLastMessage("Commit nicht möglich: Bitte Pflichtfelder korrigieren.");
      return;
    }

    // Jetzt erst Fundnummer endgültig vergeben (Counter hochzählen)
    const committedFundNo = commitNextFundNumber();

    // Fundnummer ins Objekt schreiben (read-only)
    const withFundNo = {
      ...res.value,
      fundNo: committedFundNo,
    };

    const commitResult = commitLostItem(withFundNo);

    if (!commitResult.ok) {
      // Sollte selten passieren (da bereits validiert), aber robust bleiben
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
  }

  // UI-Helper: Fehler anzeigen
  const err = useMemo(() => (path) => errors?.[path], [errors]);

  return (
    <section style={{ maxWidth: 1100 }}>
      <h2 style={{ margin: "0 0 10px 0" }}>Neue Fundsache</h2>

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
          {isFundNumberCommitted
            ? "Fundnummer ist verbindlich vergeben (Commit)."
            : "Vorschau: Fundnummer wird erst beim Commit verbindlich vergeben."}
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
        />
      </Field>

      <Field label="Sachbearbeiter-Name" error={err("caseWorker.name")}>
        <input
          type="text"
          value={data.caseWorker.name}
          onChange={(e) => setField("caseWorker.name", e.target.value)}
          style={inputStyle(!!err("caseWorker.name"))}
          placeholder='z.B. "M. Streuli"'
        />
      </Field>

      {/* Fundort/-zeit */}
      <div style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: 12 }}>
        <Field label="Funddatum (YYYY-MM-DD)" error={err("foundAt.date")}>
          <input
            type="text"
            value={data.foundAt.date}
            onChange={(e) => setField("foundAt.date", e.target.value)}
            style={inputStyle(!!err("foundAt.date"))}
            placeholder="2026-01-25"
          />
        </Field>

        <Field label="Fundzeit (HH:MM)" error={err("foundAt.time")}>
          <input
            type="text"
            value={data.foundAt.time}
            onChange={(e) => setField("foundAt.time", e.target.value)}
            style={inputStyle(!!err("foundAt.time"))}
            placeholder="14:30"
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
        />
      </Field>

      <Field label="Telefon" error={err("finder.phone")}>
        <input
          type="text"
          value={data.finder.phone}
          onChange={(e) => setField("finder.phone", e.target.value)}
          style={inputStyle(!!err("finder.phone"))}
          placeholder="+41 ..."
        />
      </Field>

      <Field label="E-Mail" error={err("finder.email")}>
        <input
          type="text"
          value={data.finder.email}
          onChange={(e) => setField("finder.email", e.target.value)}
          style={inputStyle(!!err("finder.email"))}
          placeholder="name@mail.ch"
        />
      </Field>

      <div style={{ marginBottom: 14 }}>
        <label style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <input
            type="checkbox"
            checked={!!data.finder.rewardRequested}
            onChange={(e) => setField("finder.rewardRequested", e.target.checked)}
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
        />
      </Field>

      <Field label="Manuell (Label) – optional" error={err("item.manualLabel")}>
        <input
          type="text"
          value={data.item.manualLabel}
          onChange={(e) => setField("item.manualLabel", e.target.value)}
          style={inputStyle(!!err("item.manualLabel"))}
          placeholder='z.B. "Schlüsselbund"'
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
        />
      </Field>

      {/* Buttons */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 18 }}>
        <button
          type="button"
          onClick={handleSaveDraft}
          style={btnStyle(false)}
        >
          Vorschau speichern (Draft)
        </button>

        <button
          type="button"
          onClick={handleCommit}
          style={btnStyle(true)}
        >
          Commit (definitiv)
        </button>

        {lastMessage && (
          <span style={{ color: "var(--muted)" }}>
            {lastMessage}
          </span>
        )}
      </div>

      {/* Hinweis / Debug */}
      <div style={{ marginTop: 14, color: "var(--muted)", fontSize: 13 }}>
        Hinweis: Nach Draft/Commit sollten im Browser LocalStorage neue Keys erscheinen:
        <br />
        <code>losttrack:lostItems.drafts.v1</code>, <code>losttrack:lostItems.records.v1</code>,{" "}
        <code>losttrack:lostItems.audit.v1</code>
      </div>

      {/* Minimaler Platzhalter */}
      {!lastAction && (
        <div style={{ marginTop: 14, color: "var(--muted)" }}>
          Erfassungsformular (Basis): Funddaten, Finder, Gegenstand. Weitere Felder (Fotos, Steps) folgen.
        </div>
      )}
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

function btnStyle(destructive) {
  return {
    padding: "8px 12px",
    borderRadius: 6,
    border: "1px solid #ccc",
    cursor: "pointer",
    background: destructive ? "#f7e8e8" : "#f3f3f3",
  };
}

/**
 * Setzt einen Wert in einem verschachtelten Objekt per "a.b.c"-Pfad.
 * (kein externes Package, robust genug für unser Formular)
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
