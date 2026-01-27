import React, { useEffect, useMemo, useState } from "react";
import {
  listDrafts,
  listLostItems,
  listAuditLog,
  commitLostItem,
} from "../core/storage/lostItemRepo";

// Optional: kleines Datum-Formatting
function fmt(value) {
  if (!value) return "—";
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleString("de-CH");
  } catch {
    return String(value);
  }
}

function safe(v) {
  return v === null || v === undefined ? "" : String(v);
}

/**
 * caseWorker ist bei dir (korrekt) ein Objekt.
 * Damit im UI kein [object Object] erscheint, formatieren wir es lesbar.
 */
function getCaseWorkerLabel(record) {
  const cw = record?.caseWorker;
  if (!cw) return "—";
  if (typeof cw === "string") return cw;
  if (typeof cw === "object") return cw.name || cw.fullName || cw.id || "—";
  return String(cw);
}

/**
 * Gegenstand liegt in record.item (Objekt).
 * Vorrang: manualLabel, sonst predefinedKey, sonst —
 */
function getItemLabel(record) {
  const it = record?.item || {};
  const manual = (it.manualLabel || "").trim();
  if (manual) return manual;

  const key = (it.predefinedKey || "").trim();
  if (key) return key;

  // Fallbacks (falls du später anders speicherst)
  if (record?.gegenstand) return String(record.gegenstand);
  if (record?.itemLabel) return String(record.itemLabel);

  return "—";
}

/**
 * Kurzer Zusatztext aus Merkmalen/Beschreibung (optional)
 */
function getItemHint(record) {
  const it = record?.item || {};
  const desc = (it.description || it.merkmale || "").trim();
  if (desc) return desc;
  // optional: Seriennummer etc.
  const sn = (it.serialNumber || "").trim();
  if (sn) return `SN: ${sn}`;
  return "";
}

export default function Dashboard() {
  const [drafts, setDrafts] = useState([]);
  const [records, setRecords] = useState([]);
  const [audit, setAudit] = useState([]);

  const [lastError, setLastError] = useState("");

  function refresh() {
    setDrafts(listDrafts());
    setRecords(listLostItems());
    setAudit(listAuditLog());
  }

  useEffect(() => {
    refresh();
  }, []);

  const draftsSorted = useMemo(() => {
    return [...drafts].sort((a, b) => {
      const ta = new Date(a.updatedAt ?? a.createdAt ?? 0).getTime();
      const tb = new Date(b.updatedAt ?? b.createdAt ?? 0).getTime();
      return tb - ta;
    });
  }, [drafts]);

  const recordsSorted = useMemo(() => {
    return [...records].sort((a, b) => {
      const ta = new Date(a.updatedAt ?? a.createdAt ?? 0).getTime();
      const tb = new Date(b.updatedAt ?? b.createdAt ?? 0).getTime();
      return tb - ta;
    });
  }, [records]);

  const auditSorted = useMemo(() => {
    return [...audit].sort((a, b) => {
      const ta = new Date(a.at ?? 0).getTime();
      const tb = new Date(b.at ?? 0).getTime();
      return tb - ta;
    });
  }, [audit]);

  function onCommitDraft(draft) {
    setLastError("");
    const res = commitLostItem(draft);

    if (!res?.ok) {
      // Fehler hübsch zusammenfassen
      const msg =
        Array.isArray(res?.errors) && res.errors.length
          ? res.errors
              .map((e) =>
                typeof e === "string"
                  ? e
                  : safe(e?.message ?? e?.path ?? "")
              )
              .filter(Boolean)
              .join(" • ")
          : "Commit fehlgeschlagen (Validierung).";

      setLastError(msg);
      return;
    }

    refresh();
  }

  return (
    <section style={{ maxWidth: 1100 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h2 style={{ margin: "0 0 10px 0" }}>Übersicht</h2>
          <div style={{ color: "var(--muted)" }}>
            Entwürfe, erfasste Fundsachen und Audit-Ereignisse direkt im UI.
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={refresh}>Aktualisieren</button>
        </div>
      </div>

      {lastError ? (
        <div
          style={{
            marginTop: 12,
            padding: 10,
            borderRadius: 10,
            background: "#fff1f0",
            border: "1px solid #ffccc7",
            color: "#a8071a",
            fontSize: 13,
          }}
        >
          {lastError}
        </div>
      ) : null}

      <div style={{ height: 14 }} />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 14,
          alignItems: "start",
        }}
      >
        {/* Drafts */}
        <div
          style={{
            border: "1px solid rgba(0,0,0,0.1)",
            borderRadius: 12,
            padding: 12,
            background: "#fff",
          }}
        >
          <div style={{ fontWeight: 800, marginBottom: 8 }}>
            Entwürfe ({draftsSorted.length})
          </div>

          {draftsSorted.length === 0 ? (
            <div style={{ color: "var(--muted)" }}>
              Keine Entwürfe vorhanden.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {draftsSorted.slice(0, 12).map((d) => (
                <div
                  key={d.id}
                  style={{
                    border: "1px solid rgba(0,0,0,0.08)",
                    borderRadius: 10,
                    padding: 10,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 10,
                    }}
                  >
                    <div
                      style={{
                        fontWeight: 800,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {d.fundNo ? `Fundnr. ${d.fundNo}` : `Draft ${d.id}`}
                    </div>
                    <div
                      style={{
                        color: "var(--muted)",
                        fontSize: 12,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {fmt(d.updatedAt ?? d.createdAt)}
                    </div>
                  </div>

                  <div style={{ marginTop: 6, fontSize: 14, fontWeight: 700 }}>
                    Gegenstand: {getItemLabel(d)}
                  </div>

                  {getItemHint(d) ? (
                    <div
                      style={{
                        marginTop: 6,
                        color: "var(--muted)",
                        fontSize: 13,
                      }}
                    >
                      Merkmale: {getItemHint(d)}
                    </div>
                  ) : null}

                  <div
                    style={{
                      marginTop: 6,
                      color: "var(--muted)",
                      fontSize: 13,
                    }}
                  >
                    Sachbearbeiter: {getCaseWorkerLabel(d)}
                  </div>

                  <div
                    style={{
                      marginTop: 10,
                      display: "flex",
                      gap: 8,
                      flexWrap: "wrap",
                    }}
                  >
                    <button onClick={() => onCommitDraft(d)}>
                      Commit → definitiv
                    </button>
                    <button
                      onClick={() => {
                        navigator.clipboard?.writeText(String(d.id));
                      }}
                    >
                      ID kopieren
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Records */}
        <div
          style={{
            border: "1px solid rgba(0,0,0,0.1)",
            borderRadius: 12,
            padding: 12,
            background: "#fff",
          }}
        >
          <div style={{ fontWeight: 800, marginBottom: 8 }}>
            Erfasste Fundsachen ({recordsSorted.length})
          </div>

          {recordsSorted.length === 0 ? (
            <div style={{ color: "var(--muted)" }}>
              Noch keine Fundsachen erfasst.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {recordsSorted.slice(0, 12).map((it) => (
                <div
                  key={it.id}
                  style={{
                    border: "1px solid rgba(0,0,0,0.10)",
                    borderRadius: 12,
                    padding: 12,
                    background: "#fff",
                    color: "#616672",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 10,
                    }}
                  >
                    <div style={{ fontWeight: 900 }}>
                      {safe(it.fundNo ?? it.fundnummer ?? "—")}
                    </div>
                    <div
                      style={{
                        color: "var(--muted)",
                        fontSize: 12,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {fmt(it.updatedAt ?? it.createdAt)}
                    </div>
                  </div>

                  <div style={{ marginTop: 6, fontSize: 14, fontWeight: 700 }}>
                    Gegenstand: {getItemLabel(it)}
                  </div>

                  {getItemHint(it) ? (
                    <div
                      style={{
                        marginTop: 6,
                        color: "var(--muted)",
                        fontSize: 13,
                      }}
                    >
                      Merkmale: {getItemHint(it)}
                    </div>
                  ) : null}

                  <div style={{ marginTop: 6, color: "var(--muted)", fontSize: 13 }}>
                    Status: {safe(it.status ?? "—")}
                  </div>

                  <div style={{ marginTop: 6, color: "var(--muted)", fontSize: 13 }}>
                    Sachbearbeiter: {getCaseWorkerLabel(it)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Audit */}
        <div
          style={{
            border: "1px solid rgba(0,0,0,0.1)",
            borderRadius: 12,
            padding: 12,
            background: "#fff",
          }}
        >
          <div style={{ fontWeight: 800, marginBottom: 8 }}>
            Audit-Log ({auditSorted.length})
          </div>

          {auditSorted.length === 0 ? (
            <div style={{ color: "var(--muted)" }}>
              Noch keine Audit-Ereignisse.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {auditSorted.slice(0, 20).map((ev) => (
                <div
                  key={ev.id}
                  style={{
                    border: "1px solid rgba(0,0,0,0.08)",
                    borderRadius: 10,
                    padding: 10,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 10,
                    }}
                  >
                    <div style={{ fontWeight: 800 }}>
                      {safe(ev.type ?? "EVENT")}
                    </div>
                    <div
                      style={{
                        color: "var(--muted)",
                        fontSize: 12,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {fmt(ev.at)}
                    </div>
                  </div>

                  <div style={{ marginTop: 6, color: "var(--muted)", fontSize: 13 }}>
                    Fundnr.: {safe(ev.fundNo ?? "—")}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
