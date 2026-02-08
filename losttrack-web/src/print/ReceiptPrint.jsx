// src/print/ReceiptPrint.jsx
import { useEffect, useMemo } from "react";

export default function ReceiptPrint({
  item,
  receiptType, // "FUND_RECEIPT" | "OWNER_RECEIPT" | "FINDER_RECEIPT"
  orgName,
  orgContact,
  receiptNo,
  amount, // number | null
  recipientOverride, // string
  reason, // string
  finderRewardWanted = false, // boolean (ja/nein)
}) {
  const nowIso = useMemo(() => new Date().toISOString(), []);

  // ❗️HIER die einzige relevante Änderung:
  // Übergabe-Datum/Zeit im Format DD.MM.YYYY, HH.MM
  const handoverAt = useMemo(() => fmtDateTimeFixed(nowIso), [nowIso]);

  // Wichtige Daten
  const fundNo = (item?.fundNo || "").toString().trim();
  const label = (item?.item?.manualLabel || item?.item?.predefinedKey || "").toString().trim();
  const desc = (item?.item?.description || "").toString().trim();

  const foundLocation = (item?.foundAt?.location || "").toString().trim();
  const foundDate = (item?.foundAt?.date || "").toString().trim();
  const foundTime = (item?.foundAt?.time || "").toString().trim();

  const caseWorkerName =
    (item?.caseWorker?.name || item?.caseWorker?.id || "").toString().trim() || "—";

  const finder = item?.finder || null;
  const owner = item?.owner || null;
  const collector = item?.collector || null;

  const title = useMemo(() => {
    if (receiptType === "FUND_RECEIPT") return "Fundquittung";
    if (receiptType === "OWNER_RECEIPT") return "Empfangsbestätigung Eigentümer/Abholer";
    if (receiptType === "FINDER_RECEIPT") return "Empfangsbestätigung Finder";
    return "Quittung";
  }, [receiptType]);

  const recipientName = (recipientOverride || "").toString().trim();
  const amountText = amount === null || amount === undefined ? "—" : fmtCHF(amount);

  const showFinderBlock = receiptType === "FUND_RECEIPT";
  const showOwnerBlock = receiptType === "OWNER_RECEIPT";
  const showFinderReceiptBlock = receiptType === "FINDER_RECEIPT";

  const rightSignatureLabel = showOwnerBlock
    ? "Eigentümer / Abholer"
    : "Empfänger / Abgeber";

  useEffect(() => {
    const t = window.setTimeout(() => window.print(), 50);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <div style={page}>
      <style>{printCss}</style>

      <div style={header}>
        <div>
          <div style={orgTitle}>{orgName || "Organisation"}</div>
          <div style={orgSub}>{orgContact || ""}</div>
        </div>

        <div style={{ textAlign: "right" }}>
          <div style={docTitle}>{title}</div>
          <div style={metaGrid}>
            <div style={metaK}>Quittungsnummer</div>
            <div style={metaV}>{receiptNo || "—"}</div>

            <div style={metaK}>Datum</div>
            <div style={metaV}>{handoverAt.split(",")[0]}</div>

            <div style={metaK}>Sachbearbeiter</div>
            <div style={metaV}>{caseWorkerName}</div>
          </div>
        </div>
      </div>

      <div style={hr} />

      <Section title="ANGABEN ZUR FUNDSACHE">
        <div style={grid2}>
          <FieldBox label="Fundnummer" value={fundNo || "—"} />
          <FieldBox label="Datum / Zeit der Übergabe" value={handoverAt} />

          <FieldBox
            span2
            label="Gegenstand"
            value={
              label ? (
                desc ? (
                  <>
                    <div style={{ fontWeight: 800 }}>{label}</div>
                    <div style={{ opacity: 0.85 }}>{desc}</div>
                  </>
                ) : (
                  <div style={{ fontWeight: 800 }}>{label}</div>
                )
              ) : (
                "—"
              )
            }
          />

          <FieldBox label="Fundort" value={foundLocation || "—"} />
          <FieldBox
            label="Fundzeit"
            value={foundDate ? `${foundDate}${foundTime ? `, ${foundTime}` : ""}` : "—"}
          />
        </div>
      </Section>

      {showFinderBlock && (
        <Section title="ANGABEN FINDER">
          <div style={grid2}>
            <FieldBox span2 label="Finder" value={formatPartyInline(finder)} />
            <FieldBox
              span2
              label="Finderlohn gewünscht"
              value={finderRewardWanted ? "ja" : "nein"}
            />
          </div>
        </Section>
      )}

      {showOwnerBlock && (
        <Section title="ANGABEN EIGENTÜMER / ABHOLER">
          <div style={grid2}>
            <FieldBox label="Eigentümer / Abholer" value={formatPartyInline(owner)} />
            <FieldBox label="Übergebener Finderlohn" value={amountText} />
          </div>
        </Section>
      )}

      {showFinderReceiptBlock && (
        <Section title="ANGABEN FINDER / ABHOLUNG">
          <div style={grid2}>
            <FieldBox span2 label="Grund" value={reason || "—"} />
            <FieldBox span2 label="Betrag (Finderlohn)" value={amountText} />
          </div>
        </Section>
      )}

      <Section title="UNTERSCHRIFTEN">
        <div style={sigGrid}>
          <SigBox title="Polizei / Sachbearbeiter" name={caseWorkerName || "—"} />
          <SigBox title={rightSignatureLabel} name={recipientName || "—"} />
        </div>
      </Section>

      <div style={footer}>
        <div style={{ opacity: 0.75 }}>LostTrack – Quittung (Print)</div>
        <div style={{ opacity: 0.75 }}>Erstellt am {handoverAt}</div>
      </div>
    </div>
  );
}

/* ===========================
   FORMAT-HILFSFUNKTION (NEU)
   =========================== */

function fmtDateTimeFixed(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";

  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();

  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");

  return `${dd}.${mm}.${yyyy}, ${hh}.${min}`;
}

/* ===========================
   UNVERÄNDERT: Helper & Styles
   =========================== */

function Section({ title, children }) {
  return (
    <div style={{ marginTop: 18 }}>
      <div style={sectionTitle}>{title}</div>
      <div style={{ marginTop: 10 }}>{children}</div>
    </div>
  );
}

function FieldBox({ label, value, span2 = false }) {
  return (
    <div style={{ ...box, gridColumn: span2 ? "1 / -1" : "auto" }}>
      <div style={boxLabel}>{label}</div>
      <div style={boxValue}>{value ?? "—"}</div>
    </div>
  );
}

function SigBox({ title, name }) {
  return (
    <div style={sigBox}>
      <div style={{ fontWeight: 800 }}>{title}</div>
      <div style={sigLine} />
      <div style={{ fontSize: 12, opacity: 0.85 }}>{name}</div>
    </div>
  );
}

function safeTrim(v) {
  return (v ?? "").toString().trim();
}

function partyDisplayName(p) {
  if (!p) return "";
  const full = `${safeTrim(p.firstName)} ${safeTrim(p.lastName)}`.trim();
  return full || safeTrim(p.name) || "";
}

function partyAddressLines(p) {
  if (!p) return [];
  const street = `${safeTrim(p.street)} ${safeTrim(p.streetNo)}`.trim();
  const city = `${safeTrim(p.zip)} ${safeTrim(p.city)}`.trim();
  return [street, city].filter(Boolean);
}

function formatPartyInline(p) {
  if (!p) return "—";
  const parts = [
    partyDisplayName(p),
    ...partyAddressLines(p),
    p.email ? `E-Mail: ${p.email}` : "",
    p.phone ? `Tel: ${p.phone}` : "",
  ].filter(Boolean);
  return parts.join("\n") || "—";
}

function fmtCHF(n) {
  const num = Number(n);
  if (Number.isNaN(num)) return "—";
  return `CHF ${num.toFixed(2)}`;
}

/* ===========================
   Styles (unverändert)
   =========================== */

const page = { fontFamily: "system-ui", padding: "18mm", color: "#111" };
const header = { display: "flex", justifyContent: "space-between", gap: 18 };
const orgTitle = { fontWeight: 900, fontSize: 18 };
const orgSub = { fontSize: 12, opacity: 0.8 };
const docTitle = { fontWeight: 900, fontSize: 14, marginBottom: 8 };
const metaGrid = { display: "grid", gridTemplateColumns: "120px 1fr", gap: "4px 10px", fontSize: 12 };
const metaK = { opacity: 0.75 };
const metaV = { fontWeight: 700 };
const hr = { height: 1, background: "#222", opacity: 0.25, marginTop: 12 };
const sectionTitle = { fontWeight: 900, fontSize: 12 };
const grid2 = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 };
const box = { border: "1px solid rgba(0,0,0,0.18)", borderRadius: 8, padding: "10px 12px", whiteSpace: "pre-line" };
const boxLabel = { fontSize: 10, opacity: 0.75, marginBottom: 6 };
const boxValue = { fontSize: 12 };
const sigGrid = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 };
const sigBox = { border: "2px solid rgba(0,0,0,0.7)", borderRadius: 10, padding: "10px 12px", minHeight: 70 };
const sigLine = { height: 1, background: "#000", marginTop: 30, marginBottom: 6 };
const footer = { display: "flex", justifyContent: "space-between", marginTop: 18, fontSize: 10 };

const printCss = `
@page { size: A4; margin: 10mm; }
`;
