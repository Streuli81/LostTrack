import { useEffect, useState } from "react";
import { previewNextFundNumber, commitNextFundNumber } from "../utils/fundNumber";

export default function NewItem() {
  const [fundNumberPreview, setFundNumberPreview] = useState("");
  const [savedFundNumber, setSavedFundNumber] = useState("");
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    // Nur Vorschau (kein Hochzählen) → StrictMode-sicher
    const preview = previewNextFundNumber();
    setFundNumberPreview(preview);
  }, []);

  function handleSave() {
    if (isSaved) return;

    // Erst beim Speichern wird der Counter hochgezählt und die Nummer "verbrieft"
    const committed = commitNextFundNumber();
    setSavedFundNumber(committed);
    setIsSaved(true);
  }

  const displayNumber = isSaved ? savedFundNumber : fundNumberPreview;

  return (
    <section style={{ maxWidth: 1100 }}>
      <h2 style={{ margin: "0 0 10px 0" }}>Neue Fundsache</h2>

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
          {isSaved
            ? "Nummer ist vergeben und gespeichert."
            : "Vorschau: Nummer wird erst beim Speichern verbindlich vergeben."}
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 16 }}>
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaved}
          style={{
            padding: "8px 12px",
            borderRadius: 6,
            border: "1px solid #ccc",
            cursor: isSaved ? "not-allowed" : "pointer",
          }}
        >
          Speichern (Test)
        </button>

        {isSaved && (
          <span style={{ color: "var(--muted)" }}>
            Du kannst jetzt in Schritt 5/6 das echte Formular + Persistenz anschliessen.
          </span>
        )}
      </div>

      <div style={{ color: "var(--muted)" }}>
        Platzhalter: Erfassungsformular gemäss Erfassungslogik.
      </div>
    </section>
  );
}
