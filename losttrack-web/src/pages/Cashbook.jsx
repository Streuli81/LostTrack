// src/pages/Cashbook.jsx
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  listCashbookEntries,
  getCashbookTotals,
  verifyCashbookChain,
} from "../core/storage/lostItemRepo";

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

export default function Cashbook() {
  const [tick, setTick] = useState(0);

  const entries = useMemo(() => {
    const list = listCashbookEntries();
    const sorted = [...(list || [])].sort((a, b) => String(b?.createdAt || "").localeCompare(String(a?.createdAt || "")));
    return sorted;
  }, [tick]);

  const totals = useMemo(() => getCashbookTotals({}), [tick]);

  const integrity = useMemo(() => verifyCashbookChain(), [tick]);

  const inCents = totals?.inCents || 0;
  const outCents = totals?.outCents || 0;
  const balCents = totals?.balanceCents || 0;

  function onPrint() {
    window.print();
  }

  return (
    <section style={{ maxWidth: 1100 }}>
      <style>{`
        .print-only { display: none; }
        @media print {
          .no-print { display: none !important; }
          .print-only { display: block; }
          body { background: #fff !important; }
        }
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
      `}</style>

      <div className="no-print" style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
        <div>
          <h2 style={{ margin: 0 }}>Kassenbuch</h2>
          <div style={{ color: "var(--muted)", fontSize: 13 }}>
            Append-only · Integrität:{" "}
            {integrity?.ok ? (
              <span className="chip">intakt ✅</span>
            ) : (
              <span className="chip">FEHLER ❌ (Index {integrity?.badIndex ?? "?"}: {integrity?.error || "unknown"})</span>
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
            <div style={{ color: "var(--muted)" }}>Noch keine Kassenbuch-Einträge vorhanden.</div>
          )}
        </div>
      </div>

      {/* ---------- PRINT ---------- */}
      <div className="print-only" style={{ padding: 16 }}>
        <h2 style={{ marginTop: 0 }}>Kassenbuch</h2>
        <div style={{ marginBottom: 10 }}>
          Integrität: {integrity?.ok ? "intakt ✅" : `FEHLER ❌ (Index ${integrity?.badIndex ?? "?"}: ${integrity?.error || "unknown"})`}
        </div>

        <div style={{ marginBottom: 12 }}>
          <strong>Einnahmen:</strong> {centsToCHF(inCents)} ·{" "}
          <strong>Ausgaben:</strong> {centsToCHF(outCents)} ·{" "}
          <strong>Saldo:</strong> {centsToCHF(balCents)}
        </div>

        <table className="table">
          <thead>
            <tr>
              <th style={{ width: 170 }}>Datum/Zeit</th>
              <th style={{ width: 80 }}>Typ</th>
              <th style={{ width: 110 }}>Betrag</th>
              <th style={{ width: 160 }}>Fundnummer</th>
              <th>Grund</th>
              <th style={{ width: 150 }}>Sachbearbeiter</th>
              <th style={{ width: 110 }}>Ledger-ID</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e?.id || `${e?.createdAt}-${e?.fundId}`}>
                <td>{fmtDateTime(e?.createdAt)}</td>
                <td>{String(e?.type || "").toUpperCase()}</td>
                <td>{centsToCHF(e?.amountCents)}</td>
                <td>{e?.fundNo || "—"}</td>
                <td>{e?.reason || "—"}</td>
                <td>{e?.caseWorker || "—"}</td>
                <td>{e?.id || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
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
