// src/pages/Cashbook.jsx
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { listCashbookEntries, verifyCashbookChain } from "../core/storage/lostItemRepo";

function fmtDateTime(value) {
  if (!value) return "—";
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleString("de-CH");
  } catch {
    return String(value);
  }
}

function fmtDateOnly(value) {
  if (!value) return "—";
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleDateString("de-CH");
  } catch {
    return String(value);
  }
}

// YYYY-MM-DD (für input[type="date"])
function toYmd(d) {
  const yyyy = String(d.getFullYear());
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function startOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}
function endOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}
function startOfYear(d) {
  return new Date(d.getFullYear(), 0, 1, 0, 0, 0, 0);
}
function endOfYear(d) {
  return new Date(d.getFullYear(), 11, 31, 23, 59, 59, 999);
}

function parseDateInputToRangeStart(dateStr) {
  if (!dateStr) return null;
  const m = String(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const [, y, mo, d] = m;
  const dt = new Date(Number(y), Number(mo) - 1, Number(d), 0, 0, 0, 0);
  if (Number.isNaN(dt.getTime())) return null;
  return dt;
}

function parseDateInputToRangeEndInclusive(dateStr) {
  if (!dateStr) return null;
  const m = String(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const [, y, mo, d] = m;
  const dt = new Date(Number(y), Number(mo) - 1, Number(d), 23, 59, 59, 999);
  if (Number.isNaN(dt.getTime())) return null;
  return dt;
}

function centsToCHF(cents) {
  const n = Number(cents || 0) || 0;
  return `CHF ${(n / 100).toFixed(2)}`;
}

function typeLabel(t) {
  const u = String(t || "").toUpperCase();
  if (u === "IN") return "Einnahme";
  if (u === "OUT") return "Ausgabe";
  return u || "—";
}

function inRange(createdAtIso, startDateStr, endDateStr) {
  const hasStart = !!startDateStr;
  const hasEnd = !!endDateStr;
  if (!hasStart && !hasEnd) return true;

  const d = new Date(createdAtIso);
  if (Number.isNaN(d.getTime())) return false;

  if (hasStart) {
    const s = parseDateInputToRangeStart(startDateStr);
    if (s && d < s) return false;
  }
  if (hasEnd) {
    const e = parseDateInputToRangeEndInclusive(endDateStr);
    if (e && d > e) return false;
  }
  return true;
}

function compareYmd(a, b) {
  // a/b: YYYY-MM-DD (lexicographically comparable)
  if (!a || !b) return 0;
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

export default function Cashbook() {
  const [tick, setTick] = useState(0);

  // Zeitraum (leer = alles)
  const [rangeStart, setRangeStart] = useState(""); // YYYY-MM-DD
  const [rangeEnd, setRangeEnd] = useState(""); // YYYY-MM-DD

  const allEntries = useMemo(() => {
    const list = listCashbookEntries();
    const sorted = [...(list || [])].sort((a, b) =>
      String(b?.createdAt || "").localeCompare(String(a?.createdAt || ""))
    );
    return sorted;
  }, [tick]);

  const entries = useMemo(() => {
    return (allEntries || []).filter((e) => inRange(e?.createdAt, rangeStart, rangeEnd));
  }, [allEntries, rangeStart, rangeEnd]);

  const totals = useMemo(() => {
    let inCents = 0;
    let outCents = 0;
    for (const e of entries) {
      const amt = Number(e?.amountCents || 0) || 0;
      const t = String(e?.type || "").toUpperCase();
      if (t === "IN") inCents += amt;
      else if (t === "OUT") outCents += amt;
    }
    return { inCents, outCents, balanceCents: inCents - outCents };
  }, [entries]);

  const integrity = useMemo(() => verifyCashbookChain(), [tick]);

  const inCents = totals?.inCents || 0;
  const outCents = totals?.outCents || 0;
  const balCents = totals?.balanceCents || 0;

  const printedAtIso = useMemo(() => new Date().toISOString(), []);
  const printedAt = useMemo(() => fmtDateTime(printedAtIso), [printedAtIso]);

  const rangeLabel = useMemo(() => {
    if (!rangeStart && !rangeEnd) return "Gesamter Zeitraum";
    const from = rangeStart ? fmtDateOnly(parseDateInputToRangeStart(rangeStart)) : "—";
    const to = rangeEnd ? fmtDateOnly(parseDateInputToRangeEndInclusive(rangeEnd)) : "—";
    return `Zeitraum: ${from} bis ${to}`;
  }, [rangeStart, rangeEnd]);

  function onPrint() {
    window.print();
  }

  function onResetRange() {
    setRangeStart("");
    setRangeEnd("");
  }

  // ---------- Quick Presets ----------
  function setPreset(startDate, endDate) {
    // startDate/endDate: Date
    const s = startDate ? toYmd(startDate) : "";
    const e = endDate ? toYmd(endDate) : "";
    setRangeStart(s);
    setRangeEnd(e);
  }

  function presetThisMonth() {
    const now = new Date();
    setPreset(startOfMonth(now), endOfMonth(now));
  }
  function presetLastMonth() {
    const now = new Date();
    const d = new Date(now.getFullYear(), now.getMonth() - 1, 1, 12, 0, 0, 0);
    setPreset(startOfMonth(d), endOfMonth(d));
  }
  function presetThisYear() {
    const now = new Date();
    setPreset(startOfYear(now), endOfYear(now));
  }
  function presetLastYear() {
    const now = new Date();
    const d = new Date(now.getFullYear() - 1, 0, 1, 12, 0, 0, 0);
    setPreset(startOfYear(d), endOfYear(d));
  }

  // Eingaben robust halten: wenn Start > End, End automatisch anpassen (und umgekehrt)
  function onChangeStart(v) {
    if (rangeEnd && v && compareYmd(v, rangeEnd) > 0) {
      setRangeStart(v);
      setRangeEnd(v);
      return;
    }
    setRangeStart(v);
  }
  function onChangeEnd(v) {
    if (rangeStart && v && compareYmd(v, rangeStart) < 0) {
      setRangeStart(v);
      setRangeEnd(v);
      return;
    }
    setRangeEnd(v);
  }

  return (
    <section style={{ maxWidth: 1100 }}>
      <style>{`
        .print-only { display: none; }
        .no-print { display: block; }

        .table {
          width: 100%;
          border-collapse: collapse;
        }
        .table th, .table td {
          padding: 10px 8px;
          border-bottom: 1px solid rgba(0,0,0,0.08);
          text-align: left;
          vertical-align: top;
          font-size: 13px;
        }
        .chip {
          display: inline-block;
          padding: 2px 10px;
          border-radius: 999px;
          border: 1px solid rgba(0,0,0,0.15);
          font-size: 12px;
          white-space: nowrap;
        }

        .range-row {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          align-items: end;
          margin-top: 12px;
        }
        .field {
          display: grid;
          gap: 6px;
        }
        .field label {
          font-size: 12px;
          color: var(--muted);
        }
        .field input[type="date"]{
          padding: 8px 10px;
          border-radius: 10px;
          border: 1px solid var(--border);
          background: var(--panel);
          color: var(--text);
        }

        .preset-row{
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 10px;
        }
        .preset-row button{
          padding: 8px 10px;
        }

        @media print {

        /* Fix: Seitenzähler nicht bei 0 starten */
          html, body {
            counter-reset: page 1;
          }

          .no-print { display: none !important; }
          .print-only { display: block !important; }
          body { background: #fff !important; }

          @page {
            size: A4 portrait;
            margin: 12mm 10mm 14mm 10mm;
          }

          html, body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            color: #000;
            font-size: 10.5pt;
          }

          .cashbook-print-title {
            font-size: 14pt;
            font-weight: 800;
            margin: 0 0 4mm 0;
          }
          .cashbook-print-meta {
            font-size: 9.5pt;
            margin: 0 0 5mm 0;
          }
          .cashbook-print-meta strong { font-weight: 800; }

          /* Footer: zuverlässig nur "Seite X" */
          .print-footer {
            position: fixed;
            left: 10mm;
            right: 10mm;
            bottom: 6mm;
            font-size: 9pt;
            display: flex;
            justify-content: space-between;
            gap: 10mm;
          }
          .print-page-counter::after {
            content: "Seite " counter(page);
          }

          .cashbook-table {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
          }
          .cashbook-table th,
          .cashbook-table td {
            border-bottom: 1px solid #bbb;
            padding: 2.2mm 1.8mm;
            vertical-align: top;
            word-wrap: break-word;
            overflow-wrap: anywhere;
            font-size: 9.5pt;
          }
          .cashbook-table th {
            font-weight: 800;
            border-bottom: 2px solid #444;
            font-size: 9.5pt;
          }

          .col-datetime { width: 16%; white-space: nowrap; }
          .col-type { width: 7%; text-align: right; white-space: nowrap; }
          .col-amount { width: 10%; text-align: right; white-space: nowrap; }
          .col-fundno { width: 14%; white-space: nowrap; }
          .col-reason { width: 28%; }
          .col-user { width: 10%; }
          .col-ledgerid { width: 15%; white-space: nowrap; }

          tr {
            break-inside: avoid;
            page-break-inside: avoid;
          }
        }
      `}</style>

      {/* ---------- SCREEN ---------- */}
      <div
        className="no-print"
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          alignItems: "center",
        }}
      >
        <div>
          <h2 style={{ margin: 0 }}>Kassenbuch</h2>
          <div style={{ color: "var(--muted)", fontSize: 13 }}>
            Append-only · Integrität:{" "}
            {integrity?.ok ? (
              <span className="chip">intakt ✅</span>
            ) : (
              <span className="chip">
                FEHLER ❌ (Index {integrity?.badIndex ?? "?"}: {integrity?.error || "unknown"})
              </span>
            )}
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button type="button" onClick={() => setTick((x) => x + 1)}>
            Aktualisieren
          </button>
          <button type="button" onClick={onPrint}>
            Drucken / PDF
          </button>
          <Link to="/">Zur Übersicht</Link>
        </div>
      </div>

      {/* Range controls */}
      <div
        className="no-print"
        style={{
          marginTop: 12,
          padding: 12,
          border: "1px solid var(--border)",
          borderRadius: 12,
          background: "var(--panel)",
        }}
      >
        <div style={{ fontWeight: 800, marginBottom: 8 }}>Auswertung (Zeitraum)</div>

        <div className="range-row">
          <div className="field">
            <label>Von (Startdatum)</label>
            <input type="date" value={rangeStart} onChange={(e) => onChangeStart(e.target.value)} />
          </div>

          <div className="field">
            <label>Bis (Enddatum)</label>
            <input type="date" value={rangeEnd} onChange={(e) => onChangeEnd(e.target.value)} />
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "end" }}>
            <button type="button" onClick={onResetRange}>
              Zeitraum zurücksetzen
            </button>
          </div>

          <div style={{ marginLeft: "auto", color: "var(--muted)", fontSize: 13 }}>
            {rangeLabel}
          </div>
        </div>

        {/* Quick Presets */}
        <div className="preset-row">
          <button type="button" onClick={presetThisMonth}>Dieser Monat</button>
          <button type="button" onClick={presetLastMonth}>Letzter Monat</button>
          <button type="button" onClick={presetThisYear}>Dieses Jahr</button>
          <button type="button" onClick={presetLastYear}>Letztes Jahr</button>
        </div>
      </div>

      <div className="no-print" style={{ display: "grid", gap: 12, marginTop: 14 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          <Box title="Einnahmen">{centsToCHF(inCents)}</Box>
          <Box title="Ausgaben">{centsToCHF(outCents)}</Box>
          <Box title="Saldo">{centsToCHF(balCents)}</Box>
        </div>

        <div style={{ padding: 12, border: "1px solid var(--border)", borderRadius: 12, background: "var(--panel)" }}>
          <div style={{ fontWeight: 800, marginBottom: 8 }}>Buchungen ({entries.length})</div>

          {entries.length ? (
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: 170 }}>Datum/Zeit</th>
                  <th style={{ width: 110 }}>Typ</th>
                  <th style={{ width: 120 }}>Betrag</th>
                  <th style={{ width: 170 }}>Fundnummer</th>
                  <th>Beschreibung / Grund</th>
                  <th style={{ width: 160 }}>Sachbearbeiter</th>
                  <th style={{ width: 120 }}>Ledger-ID</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e?.id || `${e?.createdAt}-${e?.fundId}`}>
                    <td>{fmtDateTime(e?.createdAt)}</td>
                    <td>
                      <span className="chip">{typeLabel(e?.type)}</span>
                    </td>
                    <td>{centsToCHF(e?.amountCents)}</td>
                    <td>{e?.fundNo || "—"}</td>
                    <td>
                      <div style={{ fontWeight: 700 }}>{e?.label || "—"}</div>
                      <div style={{ color: "var(--muted)" }}>{e?.description || ""}</div>
                      <div style={{ marginTop: 6, color: "var(--muted)" }}>
                        {e?.reason ? `Grund: ${e.reason}` : "—"}
                      </div>
                    </td>
                    <td>{e?.caseWorker || "—"}</td>
                    <td>{e?.id || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{ color: "var(--muted)" }}>
              Keine Kassenbuch-Einträge im gewählten Zeitraum.
            </div>
          )}
        </div>
      </div>

      {/* ---------- PRINT ---------- */}
      <div className="print-only">
        <div className="cashbook-print-title">Kassenbuch</div>

        <div className="cashbook-print-meta">
          <strong>Auswertung:</strong> {rangeLabel}
          <br />
          <strong>Gedruckt:</strong> {printedAt} · <strong>Integrität:</strong>{" "}
          {integrity?.ok ? "intakt ✅" : `FEHLER ❌ (Index ${integrity?.badIndex ?? "?"}: ${integrity?.error || "unknown"})`}
          <br />
          <strong>Einnahmen:</strong> {centsToCHF(inCents)} · <strong>Ausgaben:</strong> {centsToCHF(outCents)} ·{" "}
          <strong>Saldo:</strong> {centsToCHF(balCents)} · <strong>Buchungen:</strong> {entries.length}
        </div>

        {entries.length ? (
          <table className="cashbook-table">
            <thead>
              <tr>
                <th className="col-datetime">Datum/Zeit</th>
                <th className="col-type">Typ</th>
                <th className="col-amount">Betrag</th>
                <th className="col-fundno">Fundnummer</th>
                <th className="col-reason">Grund</th>
                <th className="col-user">Sachbearb.</th>
                <th className="col-ledgerid">Ledger-ID</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e?.id || `${e?.createdAt}-${e?.fundId}`}>
                  <td className="col-datetime">{fmtDateTime(e?.createdAt)}</td>
                  <td className="col-type">{String(e?.type || "").toUpperCase()}</td>
                  <td className="col-amount">{centsToCHF(e?.amountCents)}</td>
                  <td className="col-fundno">{e?.fundNo || "—"}</td>
                  <td className="col-reason">{e?.reason || "—"}</td>
                  <td className="col-user">{e?.caseWorker || "—"}</td>
                  <td className="col-ledgerid">{e?.id || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div>Keine Einträge im gewählten Zeitraum.</div>
        )}

        <div className="print-footer">
          <div>LostTrack – Kassenbuch</div>
          <div className="print-page-counter" />
        </div>
      </div>
    </section>
  );
}

function Box({ title, children }) {
  return (
    <div style={{ padding: 12, border: "1px solid var(--border)", borderRadius: 12, background: "var(--panel)" }}>
      <div style={{ fontSize: 12, color: "var(--muted)" }}>{title}</div>
      <div style={{ fontSize: 22, fontWeight: 900, marginTop: 6 }}>{children}</div>
    </div>
  );
}
