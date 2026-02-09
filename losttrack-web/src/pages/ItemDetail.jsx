// src/pages/ItemDetail.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  getLostItemById,
  changeLostItemStatus,
  updateFinder,
  updateOwner,
  updateCollector,
  listAuditLog,
  printReceipt,
} from "../core/storage/lostItemRepo";

import InvestigationSteps from "../components/InvestigationSteps";
import PartyCardEditor from "../components/PartyCardEditor";
import ReceiptPrint from "../print/ReceiptPrint.jsx";

// ✅ Statusliste an Domain anpassen (sonst kann “Ungültiger Status” passieren)
const STATUS = ["OPEN", "RETURNED", "DISPOSED", "TRANSFERRED"];

/* ---------------------------
 * Generic Accordion (no libs)
 * --------------------------- */

function Accordion({
  title,
  subtitle = null,
  right = null,
  defaultOpen = false,
  onToggle = null,
  children,
}) {
  const [open, setOpen] = useState(!!defaultOpen);

  // verhindert onToggle beim ersten Render (Mount)
  const didMountRef = useRef(false);

  function toggle() {
    setOpen((v) => !v);
  }

  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }
    if (typeof onToggle === "function") onToggle(open);
  }, [open, onToggle]);

  function onKeyDown(e) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggle();
    }
  }

  return (
    <div style={{ border: "1px solid #ccc", borderRadius: 8, overflow: "hidden" }}>
      <div
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onClick={toggle}
        onKeyDown={onKeyDown}
        style={{
          padding: 12,
          cursor: "pointer",
          userSelect: "none",
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 12,
          background: "rgba(255,255,255,0.02)",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <span style={{ fontSize: 14, opacity: 0.8 }}>{open ? "▼" : "▶"}</span>
            <span style={{ fontWeight: "bold" }}>{title}</span>
          </div>

          {subtitle ? (
            <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 4 }}>{subtitle}</div>
          ) : null}
        </div>

        {right ? (
          <div style={{ color: "var(--muted)", fontSize: 13, whiteSpace: "nowrap" }}>{right}</div>
        ) : null}
      </div>

      {open ? <div style={{ padding: 12, borderTop: "1px solid #ccc" }}>{children}</div> : null}
    </div>
  );
}

/* ---------------------------
 * Audit helpers
 * --------------------------- */

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

function nonEmpty(v) {
  const s = (v ?? "").toString().trim();
  return s.length ? s : "—";
}

function labelForPath(path) {
  const map = {
    status: "Status",
    createdAt: "Erfasst am",
    updatedAt: "Aktualisiert am",

    "foundAt.date": "Funddatum",
    "foundAt.time": "Fundzeit",
    "foundAt.location": "Fundort",

    "caseWorker.id": "Sachbearbeiter ID",
    "caseWorker.name": "Sachbearbeiter Name",

    "item.predefinedKey": "Gegenstand (Key)",
    "item.manualLabel": "Gegenstand (Manuell)",
    "item.description": "Beschreibung",

    // ✅ Neu: Finder detailliert
    "finder.firstName": "Finder Vorname",
    "finder.lastName": "Finder Name",
    "finder.street": "Finder Strasse",
    "finder.streetNo": "Finder Nr.",
    "finder.zip": "Finder PLZ",
    "finder.city": "Finder Ort",
    "finder.phone": "Finder Telefon",
    "finder.email": "Finder E-Mail",
    "finder.rewardRequested": "Finderlohn",

    // ✅ Neu: Owner detailliert
    "owner.firstName": "Eigentümer Vorname",
    "owner.lastName": "Eigentümer Name",
    "owner.street": "Eigentümer Strasse",
    "owner.streetNo": "Eigentümer Nr.",
    "owner.zip": "Eigentümer PLZ",
    "owner.city": "Eigentümer Ort",
    "owner.phone": "Eigentümer Telefon",
    "owner.email": "Eigentümer E-Mail",

    // ✅ Neu: Collector detailliert
    "collector.firstName": "Abholer Vorname",
    "collector.lastName": "Abholer Name",
    "collector.street": "Abholer Strasse",
    "collector.streetNo": "Abholer Nr.",
    "collector.zip": "Abholer PLZ",
    "collector.city": "Abholer Ort",
    "collector.phone": "Abholer Telefon",
    "collector.email": "Abholer E-Mail",

    collectorSameAsFinder: "Abholer = Finder",

    // ✅ NEU: Finderlohn-Auszahlung (passend zu lostItemRepo.js)
    "finderRewardPayout.paidAt": "Finderlohn ausbezahlt am",
    "finderRewardPayout.amountCents": "Finderlohn Betrag (Rappen)",
    "finderRewardPayout.actor": "Finderlohn ausbezahlt durch",
    "finderRewardPayout.ledgerId": "Kassenbuch-ID",

    // Legacy (für alte Audit-Einträge)
    "finder.name": "Finder Name (alt)",
    "finder.address": "Finder Adresse (alt)",
    "owner.name": "Eigentümer Name (alt)",
    "owner.address": "Eigentümer Adresse (alt)",
    "collector.name": "Abholer Name (alt)",
    "collector.address": "Abholer Adresse (alt)",

    "receipts.length": "Quittungen (Anzahl)",
  };

  if (!path) return path;

  if (path === "fundNo" || path === "id") return null;

  if (path.startsWith("investigationSteps[")) return "Ermittlungsschritte";
  if (path === "investigationSteps.length") return "Ermittlungsschritte (Anzahl)";

  if (path.startsWith("receipts[")) return "Quittungen";

  return map[path] || path;
}

function prettyValue(v) {
  if (v === null || v === undefined) return "—";
  if (typeof v === "boolean") return v ? "ja" : "nein";
  if (typeof v === "string") return v.trim() ? v : "—";
  if (typeof v === "number") return String(v);
  try {
    const s = JSON.stringify(v);
    if (s.length > 140) return s.slice(0, 140) + "…";
    return s;
  } catch {
    return String(v);
  }
}

function describeAuditEntry(e) {
  const t = e?.type || "UNKNOWN";
  const snap = e?.snapshot || {};
  const actor = (snap?.actor ?? snap?.step?.who ?? snap?.who ?? null) || null;

  if (t === "STATUS_CHANGED") {
    const from = snap?.from ?? "—";
    const to = snap?.to ?? "—";
    return { title: `Status geändert (${from} → ${to})`, actor };
  }

  if (t === "ITEM_COMMITTED") return { title: "Fundsache definitiv erfasst", actor };
  if (t === "ITEM_UPDATED") return { title: "Fundsache bearbeitet", actor };
  if (t === "DRAFT_SAVED") return { title: "Entwurf gespeichert", actor };

  if (t === "INVESTIGATION_STEP_ADDED") {
    const who = snap?.step?.who ? `Wer: ${snap.step.who}` : "";
    const what = snap?.step?.what ? `Was: ${snap.step.what}` : "";
    const detail = [who, what].filter(Boolean).join(" · ");
    return { title: "Ermittlungsschritt hinzugefügt", detail: detail || null, actor };
  }

  if (t === "INVESTIGATION_STEP_DELETED") {
    const who = snap?.step?.who ? `Wer: ${snap.step.who}` : "";
    const what = snap?.step?.what ? `Was: ${snap.step.what}` : "";
    const detail =
      [who, what].filter(Boolean).join(" · ") || (snap?.stepId ? `ID: ${snap.stepId}` : null);
    return { title: "Ermittlungsschritt gelöscht", detail, actor };
  }

  if (t === "INVESTIGATION_STEP_ADDED_AUTO") {
    const who = snap?.step?.who ? `Wer: ${snap.step.who}` : "";
    const what = snap?.step?.what ? `Was: ${snap.step.what}` : "";
    const detail = [who, what].filter(Boolean).join(" · ");
    return {
      title: "Auto-Ermittlungsschritt hinzugefügt",
      detail: detail || null,
      actor: actor || "System",
    };
  }

  if (t === "FINDER_UPDATED") return { title: "Finder aktualisiert", actor };
  if (t === "OWNER_UPDATED") return { title: "Eigentümer aktualisiert", actor };
  if (t === "COLLECTOR_UPDATED") {
    if (snap?.collector === null) return { title: "Abholer entfernt", actor };
    if (snap?.collectorSameAsFinder) return { title: "Abholer = Finder gesetzt", actor };
    return { title: "Abholer aktualisiert", actor };
  }

  if (t === "RECEIPT_PRINTED") {
    const r = snap?.receipt;
    const extra = r?.id ? `(${r.id})` : "";
    return { title: `Quittung gedruckt ${extra}`.trim(), actor };
  }

  // ✅ Finderlohn-Auszahlung (kommt aus lostItemRepo.js: FINDER_REWARD_PAID)
  if (t === "FINDER_REWARD_PAID") {
    const cents = Number(snap?.amountCents || 0) || 0;
    const chf = (cents / 100).toFixed(2);
    const extra = snap?.ledgerId ? `Kasse: ${snap.ledgerId}` : "";
    return { title: `Finderlohn ausbezahlt (CHF ${chf})`, detail: extra || null, actor };
  }

  return { title: t, actor };
}

function normalizeDiffForUi(diff) {
  if (!diff || !Array.isArray(diff) || diff.length === 0) return [];

  const filtered = diff
    .filter((d) => d && d.path && d.path !== "updatedAt")
    .map((d) => ({ ...d, label: labelForPath(d.path) }))
    .filter((d) => d.label);

  return filtered;
}

function DiffList({ diff }) {
  const items = normalizeDiffForUi(diff);
  if (!items.length) return null;

  return (
    <div style={{ marginTop: 6, display: "grid", gap: 6 }}>
      {items.map((d, idx) => (
        <div
          key={`${d.path}-${idx}`}
          style={{
            padding: "6px 10px",
            border: "1px dashed rgba(0,0,0,0.18)",
            borderRadius: 8,
            background: "rgba(0,0,0,0.02)",
          }}
        >
          <div style={{ fontWeight: 700, fontSize: 13 }}>{d.label}</div>
          <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 2 }}>
            {prettyValue(d.from)} → {prettyValue(d.to)}
          </div>
        </div>
      ))}
    </div>
  );
}

function PrintDiffList({ diff }) {
  const items = normalizeDiffForUi(diff);
  if (!items.length) return null;

  return (
    <div className="print-diff">
      {items.map((d, idx) => (
        <div key={`${d.path}-${idx}`} className="print-diff-item">
          <div className="print-diff-k">{d.label}</div>
          <div className="print-diff-v">
            {prettyValue(d.from)} → {prettyValue(d.to)}
          </div>
        </div>
      ))}
    </div>
  );
}

function AuditRow({ entry }) {
  const { title, detail, actor } = describeAuditEntry(entry);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "190px 1fr 160px",
        gap: 12,
        padding: "10px 0",
        borderBottom: "1px solid rgba(0,0,0,0.08)",
        alignItems: "baseline",
      }}
    >
      <div style={{ fontVariantNumeric: "tabular-nums", opacity: 0.85 }}>
        {fmtDateTime(entry?.at)}
      </div>

      <div>
        <div style={{ fontWeight: 700 }}>{title}</div>
        {detail ? (
          <div style={{ marginTop: 3, color: "var(--muted)", fontSize: 13 }}>{detail}</div>
        ) : null}

        <DiffList diff={entry?.diff} />
      </div>

      <div style={{ textAlign: "right", opacity: 0.85 }}>{nonEmpty(actor)}</div>
    </div>
  );
}

/* ---------------------------
 * Receipt helpers (UI)
 * --------------------------- */

function personDisplayName(p) {
  if (!p) return "";
  const fn = (p.firstName || "").toString().trim();
  const ln = (p.lastName || "").toString().trim();
  const legacy = (p.name || "").toString().trim();
  return [fn, ln].filter(Boolean).join(" ").trim() || legacy;
}

function hasName(p) {
  return !!personDisplayName(p);
}

function personAddressLine(p) {
  if (!p) return "";
  const street = (p.street || "").toString().trim();
  const streetNo = (p.streetNo || "").toString().trim();
  const zip = (p.zip || "").toString().trim();
  const city = (p.city || "").toString().trim();
  const legacy = (p.address || "").toString().trim();

  const line1 = [street, streetNo].filter(Boolean).join(" ").trim();
  const line2 = [zip, city].filter(Boolean).join(" ").trim();

  const merged = [line1, line2].filter(Boolean).join(", ").trim();
  return merged || legacy;
}

function toNumberOrNull(v) {
  const s = (v ?? "").toString().trim();
  if (!s) return null;
  const n = Number(s);
  if (Number.isNaN(n)) return null;
  return n;
}

function fmtCHFInline(v) {
  const n = toNumberOrNull(v);
  if (n === null) return "—";
  return `CHF ${n.toFixed(2)}`;
}

function toCentsStrict(chfNumber) {
  if (typeof chfNumber !== "number" || !Number.isFinite(chfNumber)) return null;
  const cents = Math.round(chfNumber * 100);
  if (!Number.isFinite(cents) || cents <= 0) return null;
  return cents;
}

/* ---------------------------
 * Component
 * --------------------------- */

export default function ItemDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const [tick, setTick] = useState(0);

  const [auditOpen, setAuditOpen] = useState(false);
  const [invOpen, setInvOpen] = useState(false);

  // Receipt UI state
  const [receiptMode, setReceiptMode] = useState("REPORT"); // REPORT | RECEIPT
  const [receiptJob, setReceiptJob] = useState(null);

  // Beträge: NUR Polizei trägt ein (Owner gibt ab / Finder holt ab)
  const [ownerRewardAmount, setOwnerRewardAmount] = useState("");
  const [finderReceiptReason, setFinderReceiptReason] = useState("OWNER_UNKNOWN"); // OWNER_UNKNOWN | REWARD_PAYOUT
  const [finderRewardPayoutAmount, setFinderRewardPayoutAmount] = useState("");

  // ✅ Notiz/Grund für Finderlohn-Abholung
  const [finderPayoutNote, setFinderPayoutNote] = useState("");

  const item = useMemo(() => getLostItemById(id), [id, tick]);
  const auditAll = useMemo(() => listAuditLog(), [tick]);

  // ✅ Abholer=Finder Checkbox-State
  const [collectorIsFinder, setCollectorIsFinder] = useState(false);

  useEffect(() => {
    setCollectorIsFinder(!!item?.collectorSameAsFinder);
  }, [item?.collectorSameAsFinder]);

  function refresh() {
    setTick((x) => x + 1);
  }

  if (!item) {
    return (
      <section style={{ maxWidth: 1100 }}>
        <h2>Detail</h2>
        <p>Datensatz nicht gefunden.</p>
        <Link to="/suche">← zurück zur Suche</Link>
      </section>
    );
  }

  const label = item?.item?.manualLabel || item?.item?.predefinedKey || "(kein Gegenstand)";
  const status = (item.status || "OPEN").toUpperCase();

  function setStatus(newStatus) {
    const res = changeLostItemStatus({ id: item.id, newStatus });
    if (res.ok) refresh();
    else alert(res.error || "Statuswechsel fehlgeschlagen");
  }

  // Actor bewusst null lassen: Repo nimmt Login-User automatisch
  const actor = null;

  const auditForItem = useMemo(() => {
    const all = auditAll || [];

    const byId = all.filter((e) => e?.snapshot?.id && e.snapshot.id === item.id);
    if (byId.length > 0) return byId;

    if (item.fundNo) {
      return all.filter((e) => e?.fundNo && e.fundNo === item.fundNo);
    }

    return [];
  }, [auditAll, item.id, item.fundNo]);

  const auditSortedAsc = useMemo(() => {
    const list = [...(auditForItem || [])];
    list.sort((a, b) => String(a?.at || "").localeCompare(String(b?.at || "")));
    return list;
  }, [auditForItem]);

  const auditPreview3 = useMemo(() => auditSortedAsc.slice(-3), [auditSortedAsc]);

  const lastAudit = auditSortedAsc.length ? auditSortedAsc[auditSortedAsc.length - 1] : null;
  const lastAuditInfo = useMemo(() => {
    if (!lastAudit) return null;
    const { title, actor: a } = describeAuditEntry(lastAudit);
    return { at: lastAudit.at, title, actor: a };
  }, [lastAudit]);

  // Organisation (Platzhalter – später ersetzbar durch config)
  const orgName = "Gemeindepolizei …";
  const orgContact = "Adresse / Telefon …";

  function onPrintReport() {
    setReceiptMode("REPORT");
    setReceiptJob(null);
    window.print();
  }

  /**
   * ✅ Zentraler Print-Trigger.
   * Wenn Finderlohn-Abholung aktiv ist, wird finderRewardPayout an printReceipt() übergeben.
   * Damit bucht das Repo zuerst ins Kassenbuch (OUT) und sperrt Doppelzahlungen.
   */
  function triggerReceiptPrint({ receiptType, recipient, amount, reason, finderRewardPayout = null }) {
    const res = printReceipt({
      id: item.id,
      receiptType,
      recipient,
      amount,
      actor,
      notes: reason || null,

      // ✅ optional: { enabled, amountCents, reason }
      finderRewardPayout,
    });

    if (!res?.ok) {
      alert(res?.error || "Quittung konnte nicht erstellt werden.");
      return;
    }

    const receiptNo = res?.receipt?.id || "—";

    setReceiptMode("RECEIPT");
    setReceiptJob({
      type: receiptType,
      receiptNo,
      amount: amount ?? null,
      recipient: recipient || "",
      reason: reason || "",
      orgName,
      orgContact,
    });

    refresh();
  }

  // Bedingungen für Buttons
  const hasFinder = hasName(item?.finder);
  const wantsReward = !!item?.finder?.rewardRequested;

  const hasOwner = hasName(item?.owner);
  const hasCollector = hasName(item?.collector);

  const canOwnerReceipt = hasOwner || hasCollector;
  const canFinderReceipt = hasCollector || hasFinder;

  const ownerRecipientName = (
    personDisplayName(item?.owner) ||
    personDisplayName(item?.collector) ||
    ""
  ).trim();
  const finderRecipientName = (
    personDisplayName(item?.collector) ||
    personDisplayName(item?.finder) ||
    ""
  ).trim();

  const finderReasonText =
    finderReceiptReason === "REWARD_PAYOUT" ? "Finderlohn-Abholung" : "Eigentümer unbekannt";

  const finderAmount =
    finderReceiptReason === "REWARD_PAYOUT" ? toNumberOrNull(finderRewardPayoutAmount) : null;

  const ownerAmount = toNumberOrNull(ownerRewardAmount);

  // ✅ Finderlohn bereits ausbezahlt?
  const rewardPaid = !!item?.finderRewardPayout?.paid;
  const rewardPaidAt = item?.finderRewardPayout?.paidAt || null;
  const rewardPaidCents = Number(item?.finderRewardPayout?.amountCents || 0) || 0;
  const rewardPaidCHF = rewardPaid ? `CHF ${(rewardPaidCents / 100).toFixed(2)}` : null;

  // ✅ Wenn Finderlohn NICHT gewünscht -> Owner-Betrag & Payout-Felder leeren
  useEffect(() => {
    if (!wantsReward) {
      setOwnerRewardAmount("");
      if (finderReceiptReason === "REWARD_PAYOUT") setFinderReceiptReason("OWNER_UNKNOWN");
      setFinderRewardPayoutAmount("");
      setFinderPayoutNote("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantsReward]);

  // ✅ Button sperren: Auszahlung darf nicht nochmals gedruckt werden, wenn schon bezahlt
  const finderReceiptDisabled =
    !canFinderReceipt ||
    (finderReceiptReason === "REWARD_PAYOUT" && (rewardPaid || !wantsReward));

  return (
    <section style={{ maxWidth: 1100 }}>
      <style>{`
        .print-only { display: none; }

        @media print {
          .print-only { display: block; }

          body * { visibility: hidden !important; }
          #print-area, #print-area * { visibility: visible !important; }

          #print-area {
            position: absolute;
            left: 0; top: 0;
            width: 100%;
            padding: 0;
          }

          .no-print { display: none !important; }

          .print-section {
            margin-bottom: 14px;
            padding-bottom: 10px;
            border-bottom: 1px solid rgba(0,0,0,0.25);
          }

          .print-title {
            font-size: 18px;
            font-weight: 900;
            margin-bottom: 8px;
          }

          .print-kv {
            display: grid;
            grid-template-columns: 220px 1fr;
            gap: 6px 12px;
          }

          .print-k { font-weight: 700; }

          .print-audit-row {
            display: grid;
            grid-template-columns: 190px 1fr 160px;
            gap: 12px;
            padding: 8px 0;
            border-bottom: 1px solid rgba(0,0,0,0.12);
          }

          .print-diff {
            margin-top: 6px;
            display: grid;
            gap: 6px;
          }
          .print-diff-item {
            padding: 6px 8px;
            border: 1px dashed rgba(0,0,0,0.22);
            border-radius: 6px;
          }
          .print-diff-k {
            font-weight: 700;
            font-size: 12px;
          }
          .print-diff-v {
            font-size: 12px;
            opacity: 0.85;
            margin-top: 2px;
          }
        }
      `}</style>

      <div
        className="no-print"
        style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}
      >
        <div>
          <h2 style={{ margin: 0 }}>
            {item.fundNo} – {label}
          </h2>
          <div style={{ color: "var(--muted)", fontSize: 13 }}>
            ID: {item.id} · Funddatum: {item?.foundAt?.date || "—"} {item?.foundAt?.time || ""} · Ort:{" "}
            {item?.foundAt?.location || "—"}
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <span style={{ padding: "4px 10px", border: "1px solid #ccc", borderRadius: 999, fontSize: 12 }}>
            {status}
          </span>

          <button type="button" onClick={() => nav(`/items/${item.id}/bearbeiten`)}>
            Bearbeiten
          </button>

          <button type="button" onClick={onPrintReport}>
            Drucken / PDF (Bericht)
          </button>

          <Link to="/suche">Zur Suche</Link>
        </div>
      </div>

      <div style={twoCol}>
        <div style={colStack}>
          <Card title="Sachbearbeiter">
            <Row k="ID" v={item?.caseWorker?.id} />
            <Row k="Name" v={item?.caseWorker?.name} />
          </Card>

          <Card title="Gegenstand">
            <Row k="PredefinedKey" v={item?.item?.predefinedKey} />
            <Row k="Manuell" v={item?.item?.manualLabel} />
            <Row k="Beschreibung" v={item?.item?.description} />
          </Card>

          <Card title="Workflow">
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {STATUS.map((s) => (
                <button key={s} type="button" disabled={status === s} onClick={() => setStatus(s)}>
                  Status → {s}
                </button>
              ))}
            </div>

            <div style={{ marginTop: 12, color: "var(--muted)", fontSize: 13 }}>
              Quittungen sind innerhalb der Karten. Finder bestimmt nur „ja/nein“ für Finderlohn.
            </div>
          </Card>
        </div>

        <div style={colStack}>
          <PartyCardEditor
            title="Finder"
            initialValue={item.finder}
            showRewardRequested={true}
            footer={
              <div style={{ display: "grid", gap: 8 }}>
                <div style={footerRow}>
                  <button
                    type="button"
                    disabled={!hasFinder}
                    onClick={() => {
                      triggerReceiptPrint({
                        receiptType: "FUND_RECEIPT",
                        recipient: personDisplayName(item?.finder),
                        amount: null,
                        reason: "",
                      });
                    }}
                  >
                    Fundquittung drucken
                  </button>

                  <div style={{ color: "var(--muted)", fontSize: 12 }}>
                    {hasFinder ? "aktiv" : "Finder erfassen für Quittung"}
                  </div>
                </div>

                <div style={{ color: "var(--muted)", fontSize: 12 }}>
                  Finderlohn (ja/nein) wird automatisch auf der Quittung aufgeführt.
                </div>
              </div>
            }
            onSave={(finder) => {
              const res = updateFinder({ id: item.id, finder, actor });
              if (res?.ok) refresh();
              return res;
            }}
          />

          <PartyCardEditor
            title="Eigentümer"
            initialValue={item.owner}
            footer={
              <div style={{ display: "grid", gap: 10 }}>
                <div style={{ fontWeight: 700 }}>Empfangsbestätigung Eigentümer/Abholer</div>

                {wantsReward ? (
                  <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                    <label style={labelInline}>
                      Übergebener Finderlohn (CHF)
                      <input
                        value={ownerRewardAmount}
                        onChange={(e) => setOwnerRewardAmount(e.target.value)}
                        placeholder="z.B. 50"
                        style={inputInline}
                      />
                    </label>
                    <div style={{ color: "var(--muted)", fontSize: 12 }}>
                      Vorschau: {fmtCHFInline(ownerRewardAmount)}
                    </div>
                  </div>
                ) : null}

                <div style={footerRow}>
                  <button
                    type="button"
                    disabled={!canOwnerReceipt}
                    onClick={() => {
                      triggerReceiptPrint({
                        receiptType: "OWNER_RECEIPT",
                        recipient: ownerRecipientName,
                        amount: ownerAmount,
                        reason: "",
                      });
                    }}
                  >
                    Empfangsbestätigung drucken
                  </button>

                  <div style={{ color: "var(--muted)", fontSize: 12 }}>
                    {canOwnerReceipt ? "aktiv" : "Eigentümer oder Abholer erfassen"}
                  </div>
                </div>
              </div>
            }
            onSave={(owner) => {
              const res = updateOwner({ id: item.id, owner, actor });
              if (res?.ok) refresh();
              return res;
            }}
          />

          <PartyCardEditor
            title="Abholer"
            initialValue={collectorIsFinder ? item.finder : item.collector}
            allowClear={!collectorIsFinder}
            hideForm={collectorIsFinder}
            footer={
              <div style={{ display: "grid", gap: 12 }}>
                <div style={{ display: "grid", gap: 8 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <input
                      type="checkbox"
                      checked={collectorIsFinder}
                      onChange={(e) => setCollectorIsFinder(e.target.checked)}
                      disabled={!hasFinder && !collectorIsFinder}
                    />
                    Abholer = Finder
                  </label>

                  {!hasFinder ? (
                    <div style={{ color: "var(--muted)", fontSize: 12 }}>
                      (Finder muss zuerst erfasst werden, damit er als Abholer übernommen werden kann.)
                    </div>
                  ) : null}

                  {collectorIsFinder && hasFinder ? (
                    <div style={{ fontSize: 12, color: "var(--muted)" }}>
                      Übernahme aktiv: {nonEmpty(personDisplayName(item.finder))} ·{" "}
                      {nonEmpty(personAddressLine(item.finder))}
                    </div>
                  ) : !collectorIsFinder ? (
                    <div style={{ fontSize: 12, color: "var(--muted)" }}>
                      Personalien nur ausfüllen, wenn Abholer ≠ Finder.
                    </div>
                  ) : null}
                </div>

                <div style={{ fontWeight: 700 }}>Empfangsbestätigung Finder</div>

                <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                  <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <input
                      type="radio"
                      name="finder-reason"
                      checked={finderReceiptReason === "OWNER_UNKNOWN"}
                      onChange={() => setFinderReceiptReason("OWNER_UNKNOWN")}
                    />
                    Eigentümer unbekannt
                  </label>

                  <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <input
                      type="radio"
                      name="finder-reason"
                      checked={finderReceiptReason === "REWARD_PAYOUT"}
                      onChange={() => setFinderReceiptReason("REWARD_PAYOUT")}
                      disabled={!wantsReward || rewardPaid}
                    />
                    Finderlohn-Abholung
                  </label>

                  {!wantsReward ? (
                    <div style={{ color: "var(--muted)", fontSize: 12 }}>
                      (Finderlohn-Abholung nur möglich, wenn Finderlohn gewünscht)
                    </div>
                  ) : null}

                  {rewardPaid ? (
                    <div style={{ color: "var(--muted)", fontSize: 12 }}>
                      Bereits ausbezahlt: {rewardPaidCHF} · {fmtDateTime(rewardPaidAt)}
                      {item?.finderRewardPayout?.ledgerId ? ` · Kasse: ${item.finderRewardPayout.ledgerId}` : ""}
                    </div>
                  ) : null}
                </div>

                {finderReceiptReason === "REWARD_PAYOUT" ? (
                  <div style={{ display: "grid", gap: 10 }}>
                    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                      <label style={labelInline}>
                        Ausbezahlter Finderlohn (CHF)
                        <input
                          value={finderRewardPayoutAmount}
                          onChange={(e) => setFinderRewardPayoutAmount(e.target.value)}
                          placeholder="z.B. 50"
                          style={inputInline}
                        />
                      </label>
                      <div style={{ color: "var(--muted)", fontSize: 12 }}>
                        Vorschau: {fmtCHFInline(finderRewardPayoutAmount)}
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                      <label style={labelInline}>
                        Notiz / Grund
                        <input
                          value={finderPayoutNote}
                          onChange={(e) => setFinderPayoutNote(e.target.value)}
                          placeholder="z.B. Finderlohn-Abholung"
                          style={{ ...inputInline, minWidth: 260 }}
                        />
                      </label>

                      <div style={{ color: "var(--muted)", fontSize: 12 }}>
                        Beim Druck wird automatisch im Kassenbuch gebucht und Doppelzahlung gesperrt.
                      </div>
                    </div>
                  </div>
                ) : null}

                <div style={footerRow}>
                  <button
                    type="button"
                    disabled={finderReceiptDisabled}
                    onClick={() => {
                      // ✅ Wenn Finderlohn-Abholung gewählt: amountCents + Buchung aktivieren
                      let payout = null;

                      if (finderReceiptReason === "REWARD_PAYOUT") {
                        const amountChf = toNumberOrNull(finderRewardPayoutAmount);
                        if (amountChf === null || amountChf <= 0) {
                          alert("Bitte einen gültigen Betrag > 0 eingeben.");
                          return;
                        }
                        const cents = toCentsStrict(amountChf);
                        if (cents === null) {
                          alert("Ungültiger Betrag.");
                          return;
                        }

                        payout = {
                          enabled: true,
                          amountCents: cents,
                          reason: (finderPayoutNote || "").toString().trim() || "Finderlohn-Abholung",
                        };
                      }

                      triggerReceiptPrint({
                        receiptType: "FINDER_RECEIPT",
                        recipient: finderRecipientName,
                        amount: finderAmount,
                        reason: finderReasonText,
                        finderRewardPayout: payout,
                      });
                    }}
                  >
                    Empfangsbestätigung Finder drucken
                  </button>

                  <div style={{ color: "var(--muted)", fontSize: 12 }}>
                    {canFinderReceipt ? "aktiv" : "Abholer oder Finder erfassen"}
                  </div>
                </div>
              </div>
            }
            onSave={(collector) => {
              if (collector === null) {
                const res = updateCollector({
                  id: item.id,
                  collector: null,
                  actor,
                  sameAsFinder: false,
                });
                if (res?.ok) refresh();
                return res;
              }

              if (collectorIsFinder) {
                if (!item.finder) {
                  const res = { ok: false, error: "Finder ist leer. Bitte zuerst Finder erfassen." };
                  return res;
                }
                const res = updateCollector({
                  id: item.id,
                  collector: item.finder,
                  actor,
                  sameAsFinder: true,
                });
                if (res?.ok) refresh();
                return res;
              }

              const res = updateCollector({
                id: item.id,
                collector,
                actor,
                sameAsFinder: false,
              });
              if (res?.ok) refresh();
              return res;
            }}
          />
        </div>
      </div>

      <div className="no-print" style={{ marginTop: 12 }}>
        <Accordion
          title="Ermittlungsschritte"
          subtitle={
            (item.investigationSteps?.length || 0) > 0
              ? `${item.investigationSteps.length} Schritt(e)`
              : "Noch keine Schritte erfasst"
          }
          right={invOpen ? "offen" : "zu"}
          defaultOpen={false}
          onToggle={setInvOpen}
        >
          <InvestigationSteps itemId={item.id} steps={item.investigationSteps} onChanged={refresh} />
        </Accordion>
      </div>

      <div className="no-print" style={{ marginTop: 12 }}>
        <Accordion
          title="Audit-Log / Verlauf"
          subtitle={
            lastAuditInfo
              ? `Letzte Änderung: ${fmtDateTime(lastAuditInfo.at)} – ${lastAuditInfo.title}${
                  lastAuditInfo.actor ? ` (${lastAuditInfo.actor})` : ""
                }`
              : "Keine Einträge"
          }
          right={`${auditSortedAsc.length} total`}
          defaultOpen={false}
          onToggle={setAuditOpen}
        >
          {!auditOpen ? (
            auditPreview3.length ? (
              <div>
                <div style={{ fontWeight: 700, marginBottom: 6, color: "var(--muted)" }}>
                  Letzte 3 Einträge
                </div>
                {auditPreview3.map((e) => (
                  <AuditRow key={e.id || `${e.at}-${e.type}`} entry={e} />
                ))}
              </div>
            ) : (
              <div style={{ color: "var(--muted)" }}>Noch keine Audit-Einträge vorhanden.</div>
            )
          ) : null}

          {auditOpen ? (
            auditSortedAsc.length ? (
              <div>
                {auditSortedAsc.map((e) => (
                  <AuditRow key={e.id || `${e.at}-${e.type}`} entry={e} />
                ))}
              </div>
            ) : (
              <div>Keine Audit-Einträge vorhanden.</div>
            )
          ) : null}
        </Accordion>
      </div>

      <div id="print-area" className="print-only" style={{ marginTop: 16 }}>
        {receiptMode === "RECEIPT" && receiptJob ? (
          <ReceiptPrint
            item={item}
            receiptType={receiptJob.type}
            orgName={receiptJob.orgName}
            orgContact={receiptJob.orgContact}
            receiptNo={receiptJob.receiptNo}
            amount={receiptJob.amount}
            recipientOverride={receiptJob.recipient}
            reason={receiptJob.reason}
            finderRewardWanted={!!item?.finder?.rewardRequested}
          />
        ) : (
          <>
            <div className="print-section">
              <div className="print-title">Fundsache {item.fundNo ? `#${item.fundNo}` : ""}</div>

              <div className="print-kv">
                <div className="print-k">Fundnummer</div>
                <div>{nonEmpty(item.fundNo)}</div>

                <div className="print-k">Status</div>
                <div>{nonEmpty(status)}</div>

                <div className="print-k">ID</div>
                <div>{nonEmpty(item.id)}</div>

                <div className="print-k">Funddatum</div>
                <div>
                  {nonEmpty(item?.foundAt?.date)}{" "}
                  {nonEmpty(item?.foundAt?.time) !== "—" ? item?.foundAt?.time : ""}
                </div>

                <div className="print-k">Fundort</div>
                <div>{nonEmpty(item?.foundAt?.location)}</div>

                <div className="print-k">Sachbearbeiter</div>
                <div>
                  {nonEmpty(item?.caseWorker?.id)}{" "}
                  {nonEmpty(item?.caseWorker?.name) !== "—" ? `– ${item?.caseWorker?.name}` : ""}
                </div>

                <div className="print-k">Gegenstand</div>
                <div>
                  {nonEmpty(label)}
                  {item?.item?.description ? ` – ${item.item.description}` : ""}
                </div>

                <div className="print-k">Finder</div>
                <div>
                  {nonEmpty(personDisplayName(item?.finder))} · {nonEmpty(personAddressLine(item?.finder))} ·{" "}
                  {nonEmpty(item?.finder?.phone)} · {nonEmpty(item?.finder?.email)}
                  {item?.finder?.rewardRequested ? " (Finderlohn gewünscht)" : ""}
                </div>

                <div className="print-k">Eigentümer</div>
                <div>
                  {item?.owner
                    ? `${nonEmpty(personDisplayName(item?.owner))} · ${nonEmpty(
                        personAddressLine(item?.owner)
                      )} · ${nonEmpty(item?.owner?.phone)} · ${nonEmpty(item?.owner?.email)}`
                    : "—"}
                </div>

                <div className="print-k">Abholer</div>
                <div>
                  {item?.collector
                    ? `${nonEmpty(personDisplayName(item?.collector))} · ${nonEmpty(
                        personAddressLine(item?.collector)
                      )} · ${nonEmpty(item?.collector?.phone)} · ${nonEmpty(item?.collector?.email)}`
                    : "—"}
                  {item?.collectorSameAsFinder ? " (Abholer = Finder)" : ""}
                </div>

                <div className="print-k">Finderlohn Auszahlung</div>
                <div>
                  {rewardPaid
                    ? `JA – ${rewardPaidCHF} – ${fmtDateTime(rewardPaidAt)}${
                        item?.finderRewardPayout?.ledgerId ? ` – Kasse: ${item.finderRewardPayout.ledgerId}` : ""
                      }`
                    : wantsReward
                    ? "Noch nicht ausbezahlt"
                    : "Nicht gewünscht"}
                </div>
              </div>
            </div>

            <div className="print-section">
              <div className="print-title">Audit-Log / Verlauf</div>

              {auditSortedAsc.length ? (
                auditSortedAsc.map((e) => {
                  const { title, detail, actor: a } = describeAuditEntry(e);
                  return (
                    <div key={e.id || `${e.at}-${e.type}`} style={{ paddingBottom: 10 }}>
                      <div className="print-audit-row">
                        <div style={{ fontVariantNumeric: "tabular-nums", opacity: 0.85 }}>
                          {fmtDateTime(e?.at)}
                        </div>
                        <div style={{ fontWeight: 700 }}>
                          {title}
                          {detail ? (
                            <div style={{ fontWeight: 400, fontSize: 12, opacity: 0.85, marginTop: 2 }}>
                              {detail}
                            </div>
                          ) : null}
                        </div>
                        <div style={{ textAlign: "right", opacity: 0.85 }}>{nonEmpty(a)}</div>
                      </div>

                      <PrintDiffList diff={e?.diff} />
                    </div>
                  );
                })
              ) : (
                <div>Keine Audit-Einträge vorhanden.</div>
              )}
            </div>
          </>
        )}
      </div>
    </section>
  );
}

/* --- kleine UI-helpers --- */

function Card({ title, children }) {
  return (
    <div style={{ padding: 12, border: "1px solid #ccc", borderRadius: 8 }}>
      <div style={{ fontWeight: "bold", marginBottom: 8 }}>{title}</div>
      <div style={{ display: "grid", gap: 6 }}>{children}</div>
    </div>
  );
}

function Row({ k, v }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: 10 }}>
      <div style={{ color: "var(--muted)" }}>{k}</div>
      <div>{v ? String(v) : "—"}</div>
    </div>
  );
}

/* Layout styles */
const twoCol = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 12,
  marginTop: 16,
};

const colStack = {
  display: "grid",
  gap: 12,
};

const footerRow = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 10,
  flexWrap: "wrap",
};

const labelInline = {
  display: "grid",
  gap: 4,
  fontSize: 12,
  color: "var(--muted)",
};

const inputInline = {
  padding: "6px 8px",
  border: "1px solid rgba(0,0,0,0.18)",
  borderRadius: 8,
  minWidth: 160,
};
