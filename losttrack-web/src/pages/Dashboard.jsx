// src/pages/Dashboard.jsx

import React, { useEffect, useMemo, useState } from "react";
import { hasPermission } from "../core/auth/auth.js";
import {
  listDrafts,
  listLostItems,
  listAuditLog,
  commitLostItem,
} from "../core/storage/lostItemRepo";

// ✅ Phase 1: Retention
import { calculateRetention, getRetentionStatus } from "../domain/retention";

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

/* -----------------------------
 * ✅ Fristen: UI Helper
 * ----------------------------- */

function retentionBadge(status) {
  const s = String(status || "").toUpperCase();

  const base = {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    fontSize: 12,
    padding: "4px 10px",
    borderRadius: 999,
    border: "1px solid rgba(0,0,0,0.08)",
    whiteSpace: "nowrap",
  };

  const dot = (bg) => ({
    width: 10,
    height: 10,
    borderRadius: 999,
    background: bg,
    boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.15)",
  });

  if (s === "REVIEW_REQUIRED") {
    return {
      label: "AUFBEWAHRUNG PRÜFEN",
      style: { ...base, background: "rgba(0,0,0,0.04)" },
      dotStyle: dot("rgba(0,0,0,0.55)"),
      hint: "Aufbewahrungsdatum fehlt/ist ungültig oder die Einjahresgrenze ist erreicht. Eine Versteigerung braucht zusätzlich vorgängige Auskündung und Bewilligung der zuständigen Behörde (Art. 721 ZGB).",
    };
  }
  if (s === "URGENT") {
    return {
      style: { ...base, background: "rgba(255,0,0,0.06)" },
      dotStyle: dot("rgba(220,0,0,0.9)"),
      label: "FRIST LÄUFT BALD AB",
      hint: "Die Einjahresgrenze ab Beginn der Aufbewahrung nähert sich. Sie erlaubt keine automatische Verwertung.",
    };
  }
  if (s === "WARNING") {
    return {
      label: "FRIST NÄHERT SICH",
      style: { ...base, background: "rgba(255,165,0,0.10)" },
      dotStyle: dot("rgba(245,140,0,0.95)"),
      hint: "Die Einjahresgrenze ab Beginn der Aufbewahrung nähert sich. Sie erlaubt keine automatische Verwertung.",
    };
  }
  if (s === "COMPLETED") {
    return {
      label: "ABGESCHLOSSEN",
      style: { ...base, background: "rgba(0,128,0,0.07)" },
      dotStyle: dot("rgba(0,140,60,0.95)"),
      hint: "Verwertung/Abschluss erfasst",
    };
  }

  return {
    label: "FRIST LÄUFT",
    style: { ...base, background: "rgba(0,128,0,0.04)" },
    dotStyle: dot("rgba(0,140,60,0.65)"),
    hint: "Die Einjahresgrenze nach Art. 721 ZGB liegt mehr als 60 Tage in der Zukunft.",
  };
}

function countStatuses(list) {
  const c = { OK: 0, WARNING: 0, URGENT: 0, REVIEW_REQUIRED: 0, COMPLETED: 0 };
  for (const r of list || []) {
    const s = String(r?._retentionStatus || "REVIEW_REQUIRED").toUpperCase();
    if (c[s] === undefined) c[s] = 0;
    c[s] += 1;
  }
  return c;
}

function weightStatus(s) {
  const x = String(s || "").toUpperCase();
  if (x === "REVIEW_REQUIRED") return 0;
  if (x === "URGENT") return 1;
  if (x === "WARNING") return 2;
  if (x === "OK") return 3;
  if (x === "COMPLETED") return 4;
  return 9;
}

function StatusCard({ title, value, tone }) {
  const style = {
    borderRadius: 12,
    padding: "10px 10px",
    border: "1px solid rgba(0,0,0,0.10)",
    background: "#fff",
  };

  let head = { color: "#616672" };
  if (tone === "red") head = { color: "rgba(200,0,0,0.85)" };
  if (tone === "orange") head = { color: "rgba(200,110,0,0.90)" };
  if (tone === "green") head = { color: "rgba(0,120,60,0.85)" };
  if (tone === "dark") head = { color: "rgba(0,0,0,0.85)" };
  if (tone === "muted") head = { color: "rgba(0,0,0,0.55)" };

  return (
    <div style={style}>
      <div style={{ fontSize: 12, fontWeight: 800, ...head }}>{title}</div>
      <div style={{ fontSize: 22, fontWeight: 900, marginTop: 4, color: "#111" }}>
        {Number(value || 0)}
      </div>
    </div>
  );
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

  // ✅ Records: zusätzlich Retention-Status berechnen + kritisch zuerst sortieren
  const recordsWithStatus = useMemo(() => {
    return [...records].map((r) => {
      const hasRetention =
        r?.retention &&
        (r.retention.custodyStartDate || r.retention.noticeDate || r.retention.auctionReviewDate);

      // best effort: wenn retention fehlt, im UI berechnen (ohne Persist)
      const computed = !hasRetention ? calculateRetention(r) : null;
      const temp = computed ? { ...r, retention: { ...(r.retention || {}), ...computed } } : r;

      const st = getRetentionStatus(temp);
      return { ...temp, _retentionStatus: st };
    });
  }, [records]);

  const recordsSorted = useMemo(() => {
    return [...recordsWithStatus].sort((a, b) => {
      const wa = weightStatus(a?._retentionStatus);
      const wb = weightStatus(b?._retentionStatus);
      if (wa !== wb) return wa - wb;

      const ta = new Date(a.updatedAt ?? a.createdAt ?? 0).getTime();
      const tb = new Date(b.updatedAt ?? b.createdAt ?? 0).getTime();
      return tb - ta;
    });
  }, [recordsWithStatus]);

  const statusCounts = useMemo(() => countStatuses(recordsWithStatus), [recordsWithStatus]);

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
          : res?.error || "Commit fehlgeschlagen (Validierung).";

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

      {/* ✅ Fristen-Summary */}
      <div style={{ height: 14 }} />
      <div
        style={{
          display: "grid",
        gridTemplateColumns: "repeat(5, 1fr)",
          gap: 10,
        }}
      >
        <StatusCard title="PRÜFUNG ERFORDERLICH" value={statusCounts.REVIEW_REQUIRED} tone="dark" />
        <StatusCard title="FRIST LÄUFT BALD AB" value={statusCounts.URGENT} tone="red" />
        <StatusCard title="FRIST NÄHERT SICH" value={statusCounts.WARNING} tone="orange" />
        <StatusCard title="IM HINTERLEGTEN FRISTLAUF" value={statusCounts.OK} tone="green" />
        <StatusCard title="ABGESCHLOSSEN" value={statusCounts.COMPLETED} tone="muted" />
      </div>

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
                    {hasPermission("ITEM_CREATE") && <button onClick={() => onCommitDraft(d)}>
                      Commit → definitiv
                    </button>}
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
              {recordsSorted.slice(0, 12).map((it) => {
                const badge = retentionBadge(it._retentionStatus);
                const auctionDate = it?.retention?.auctionReviewDate ? fmt(it.retention.auctionReviewDate) : "—";
                const finderDate = it?.retention?.finderAcquisitionReviewDate
                  ? fmt(it.retention.finderAcquisitionReviewDate)
                  : "—";

                return (
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
                        alignItems: "baseline",
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

                    {/* ✅ Ampel + Frist */}
                    <div style={{ marginTop: 8, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                      <span title={badge.hint} style={badge.style}>
                        <span style={badge.dotStyle} />
                        {badge.label}
                      </span>
                      <span style={{ fontSize: 12, color: "var(--muted)" }}>
                        Einjahresgrenze Art. 721 (Auktion prüfen): <b>{auctionDate}</b>
                      </span>
                      <span style={{ fontSize: 12, color: "var(--muted)" }}>
                        5-Jahresfrist Art. 722 (Finder-Erwerb prüfen): <b>{finderDate}</b>
                      </span>
                    </div>

                    <div style={{ marginTop: 8, fontSize: 14, fontWeight: 700 }}>
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
                );
              })}
            </div>
          )}
        </div>

        {/* Audit (optional – du hattest es vorbereitet, hier minimal anzeigen) */}
        <div
          style={{
            border: "1px solid rgba(0,0,0,0.1)",
            borderRadius: 12,
            padding: 12,
            background: "#fff",
          }}
        >
          <div style={{ fontWeight: 800, marginBottom: 8 }}>
            Audit (letzte 12)
          </div>

          {auditSorted.length === 0 ? (
            <div style={{ color: "var(--muted)" }}>Kein Audit vorhanden.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {auditSorted.slice(0, 12).map((e) => (
                <div
                  key={e.id}
                  style={{
                    border: "1px solid rgba(0,0,0,0.08)",
                    borderRadius: 10,
                    padding: 10,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <div style={{ fontWeight: 900 }}>{safe(e.type || "—")}</div>
                    <div style={{ color: "var(--muted)", fontSize: 12, whiteSpace: "nowrap" }}>
                      {fmt(e.at)}
                    </div>
                  </div>
                  <div style={{ marginTop: 6, color: "var(--muted)", fontSize: 13 }}>
                    Fundnr.: {safe(e.fundNo || "—")} · Actor: {safe(e.actor || "—")}
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
