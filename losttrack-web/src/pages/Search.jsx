import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { searchLostItems } from "../core/storage/lostItemRepo";

export default function Search() {
  const nav = useNavigate();

  // Filter
  const [fundNo, setFundNo] = useState("");
  const [finder, setFinder] = useState("");
  const [item, setItem] = useState("");
  const [location, setLocation] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const results = useMemo(() => {
    return searchLostItems({ fundNo, finder, item, location, dateFrom, dateTo });
  }, [fundNo, finder, item, location, dateFrom, dateTo]);

  return (
    <section style={{ maxWidth: 1100 }}>
      <h2 style={{ margin: "0 0 10px 0" }}>Suche</h2>

      {/* Filter */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: 12,
          padding: 12,
          border: "1px solid #ccc",
          borderRadius: 8,
          marginBottom: 16,
        }}
      >
        <Field label="Fundnummer">
          <input
            type="text"
            value={fundNo}
            onChange={(e) => setFundNo(e.target.value)}
            placeholder="z.B. 2026-00030"
            style={inputStyle()}
          />
        </Field>

        <Field label="Finder (Name / Telefon / E-Mail)">
          <input
            type="text"
            value={finder}
            onChange={(e) => setFinder(e.target.value)}
            placeholder="z.B. Meier / 079... / mail@..."
            style={inputStyle()}
          />
        </Field>

        <Field label="Gegenstand (Key / Label / Beschreibung)">
          <input
            type="text"
            value={item}
            onChange={(e) => setItem(e.target.value)}
            placeholder='z.B. "wallet" / "Schlüsselbund"'
            style={inputStyle()}
          />
        </Field>

        <Field label="Fundort">
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="z.B. Bahnhof, Perron 2"
            style={inputStyle()}
          />
        </Field>

        <Field label="Datum von">
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={inputStyle()} />
        </Field>

        <Field label="Datum bis">
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={inputStyle()} />
        </Field>

        <div style={{ gridColumn: "1 / -1", display: "flex", gap: 10, alignItems: "center" }}>
          <button
            type="button"
            onClick={() => {
              setFundNo("");
              setFinder("");
              setItem("");
              setLocation("");
              setDateFrom("");
              setDateTo("");
            }}
            style={btnStyle(false)}
          >
            Filter leeren
          </button>

          <div style={{ color: "var(--muted)", fontSize: 13 }}>
            Treffer: <b>{results.length}</b>
          </div>
        </div>
      </div>

      {/* Trefferliste */}
      {results.length === 0 ? (
        <div style={{ color: "var(--muted)" }}>
          Keine Treffer. (Tipp: Wenn noch keine definitiven Records existieren, zuerst unter „Neu“ committen.)
        </div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {results.map((r) => {
            const label = r?.item?.manualLabel || r?.item?.predefinedKey || "(kein Gegenstand)";
            const status = (r.status || "OPEN").toUpperCase();

            return (
              <div
                key={r.id}
                role="button"
                tabIndex={0}
                onClick={() => nav(`/items/${r.id}`)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") nav(`/items/${r.id}`);
                }}
                style={{
                  padding: 12,
                  border: "1px solid #ccc",
                  borderRadius: 8,
                  cursor: "pointer",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <div style={{ fontWeight: "bold" }}>
                    {r.fundNo || "(ohne Fundnummer)"} – {label}
                  </div>

                  <span style={pillStyle()}>{status}</span>
                </div>

                <div style={{ marginTop: 6, display: "flex", gap: 14, flexWrap: "wrap", color: "var(--muted)", fontSize: 13 }}>
                  <span>Finder: {r?.finder?.name || "—"}</span>
                  <span>Tel: {r?.finder?.phone || "—"}</span>
                  <span>Ort: {r?.foundAt?.location || "—"}</span>
                  <span>Datum: {r?.foundAt?.date || "—"}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

/* ----------------- UI helpers ----------------- */

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 6 }}>
      <label style={{ display: "block", fontWeight: "bold", marginBottom: 6 }}>{label}</label>
      {children}
    </div>
  );
}

function inputStyle() {
  return {
    width: "100%",
    padding: "8px 10px",
    borderRadius: 6,
    border: "1px solid #ccc",
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

function pillStyle() {
  return {
    padding: "4px 10px",
    borderRadius: 999,
    border: "1px solid #ccc",
    fontSize: 12,
    whiteSpace: "nowrap",
  };
}
