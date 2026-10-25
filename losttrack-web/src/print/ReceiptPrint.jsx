// src/print/ReceiptPrint.jsx
import { useEffect, useMemo } from "react";

export default function ReceiptPrint({
  item,
  receiptType, // "FUND_RECEIPT" | "OWNER_RECEIPT" | "FINDER_RECEIPT"
  orgName,
  orgContact,
  receiptNo,
  amount, // number | null
  recipientOverride, // string (optional)
  reason, // string
  finderRewardWanted = false, // boolean (ja/nein)
}) {
  const nowIso = useMemo(() => new Date().toISOString(), []);

  // Übergabe-Datum/Zeit im Format DD.MM.YYYY, HH.MM
  const handoverAt = useMemo(() => fmtDateTimeFixed(nowIso), [nowIso]);

  // Wichtige Daten
  const fundNo = (item?.fundNo || "").toString().trim();
  const label = (item?.item?.manualLabel || item?.item?.predefinedKey || "")
    .toString()
    .trim();
  const desc = (item?.item?.description || "").toString().trim();

  const foundLocation = (item?.foundAt?.location || "").toString().trim();
  const foundDate = (item?.foundAt?.date || "").toString().trim();
  const foundTime = (item?.foundAt?.time || "").toString().trim();

  const caseWorkerName =
    (item?.caseWorker?.name || item?.caseWorker?.id || "").toString().trim() ||
    "—";

  const finder = item?.finder || null;
  const owner = item?.owner || null;
  const collector = item?.collector || null;

  const title = useMemo(() => {
    if (receiptType === "FUND_RECEIPT") return "Fundquittung";
    if (receiptType === "OWNER_RECEIPT")
      return "Empfangsbestätigung Eigentümer/Abholer";
    if (receiptType === "FINDER_RECEIPT")
      return "Empfangsbestätigung Finder/Abholer";
    return "Quittung";
  }, [receiptType]);

  const amountText =
    amount === null || amount === undefined ? "—" : fmtCHF(amount);

  const showFinderBlock = receiptType === "FUND_RECEIPT";
  const showOwnerBlock = receiptType === "OWNER_RECEIPT";
  const showFinderReceiptBlock = receiptType === "FINDER_RECEIPT";

  // ✅ Person automatisch bestimmen (Finder / Abholer / Eigentümer)
  const selectedParty = useMemo(() => {
    if (receiptType === "FUND_RECEIPT") return finder;

    if (receiptType === "OWNER_RECEIPT") {
      // Eigentümer bevorzugen, sonst Abholer
      return hasPartyData(owner) ? owner : collector;
    }

    if (receiptType === "FINDER_RECEIPT") {
      // Abholer bevorzugen, sonst Finder
      return hasPartyData(collector) ? collector : finder;
    }

    return collector || finder || owner;
  }, [receiptType, finder, owner, collector]);

  const recipientName = useMemo(() => {
    const o = (recipientOverride || "").toString().trim();
    if (o) return o;
    const auto = partyDisplayName(selectedParty);
    return auto || "—";
  }, [recipientOverride, selectedParty]);

  const rightSignatureLabel = showOwnerBlock
    ? "Eigentümer / Abholer"
    : "Empfänger / Abgeber";
  const rewardChoice = item?.finder?.rewardChoice || (finderRewardWanted ? "REQUESTED" : "");
  const fundReceiptRewardText = rewardChoice === "REQUESTED"
    ? "Finderlohn gewünscht"
    : rewardChoice === "WAIVED"
      ? "Finder/in verzichtet freiwillig auf Finderlohn. Der Ersatz notwendiger Auslagen bleibt vorbehalten."
      : "Keine ausdrückliche Wahl erfasst";

  // ✅ FIX: Auto-Print nur 1x (React StrictMode / Remounts)
  useEffect(() => {
    // Key so wählen, dass er pro Quittung stabil ist
    const key = `lt.autoprint.receipt.${receiptNo || "na"}.${receiptType || "na"}`;

    try {
      const last = Number(sessionStorage.getItem(key) || "0");
      const now = Date.now();

      // 60s Cooldown: verhindert Double-Print, erlaubt späteres Re-Print
      if (last && now - last < 60_000) return;

      sessionStorage.setItem(key, String(now));
    } catch {
      // wenn sessionStorage blockiert: ohne Schutz weiter (selten)
    }

    const t = window.setTimeout(() => window.print(), 120);
    return () => window.clearTimeout(t);
  }, [receiptNo, receiptType]);

  return (
    <div className="receipt-page" style={page}>
      <style>{printCss}</style>

      {/* Inhalt separat, damit wir im Print gezielt paddings steuern können */}
      <div className="receipt-content" style={content}>
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
              value={
                foundDate
                  ? `${foundDate}${foundTime ? `, ${foundTime}` : ""}`
                  : "—"
              }
            />
          </div>
        </Section>

        {showFinderBlock && (
          <Section title="ANGABEN FINDER">
            <div style={grid2}>
              <FieldBox span2 label="Finder" value={formatPartyInline(finder)} />
              <FieldBox
                span2
                label="Erklärung zum Finderlohn"
                value={fundReceiptRewardText}
              />
            </div>
          </Section>
        )}

        {showOwnerBlock && (
          <Section title="ANGABEN EIGENTÜMER / ABHOLER">
            <div style={grid2}>
              <FieldBox
                span2
                label="Eigentümer / Abholer"
                value={formatPartyInline(hasPartyData(owner) ? owner : collector)}
              />
              <FieldBox
                span2
                label="Übergebener Finderlohn"
                value={amountText}
              />
            </div>
          </Section>
        )}

        {showFinderReceiptBlock && (
          <Section title="ANGABEN FINDER / ABHOLUNG">
            <div style={grid2}>
              <FieldBox span2 label="Grund" value={reason || "—"} />
              <FieldBox span2 label="Betrag (Finderlohn)" value={amountText} />
              <FieldBox
                span2
                label="Person (Finder / Abholer)"
                value={formatPartyInline(selectedParty)}
              />
            </div>
          </Section>
        )}

        <Section title={showFinderBlock ? "UNTERSCHRIFT FINDER/IN" : "UNTERSCHRIFTEN"}>
          {showFinderBlock ? (
            <div style={{ ...sigBox, minHeight: 76 }}>
              <div style={{ fontSize: 12 }}>
                Ich bestätige die Übergabe der Fundsache und die oben festgehaltene Erklärung zum Finderlohn.
              </div>
              <div style={sigLine} />
              <div style={{ fontSize: 12, opacity: 0.85 }}>{recipientName || "—"}</div>
            </div>
          ) : (
            <div style={sigGrid}>
              <SigBox
                title="Polizei / Sachbearbeiter"
                name={caseWorkerName || "—"}
              />
              <SigBox title={rightSignatureLabel} name={recipientName || "—"} />
            </div>
          )}
        </Section>

        <div style={footer}>
          <div style={{ opacity: 0.75 }}>LostTrack – Quittung (Print)</div>
          <div style={{ opacity: 0.75 }}>Erstellt am {handoverAt}</div>
        </div>
      </div>
    </div>
  );
}

/* ===========================
   FORMAT-HILFSFUNKTION
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
   Helper
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
  if (full) return full;
  return safeTrim(p.name) || "";
}

function partyAddressLines(p) {
  if (!p) return [];
  const street = `${safeTrim(p.street)} ${safeTrim(p.streetNo)}`.trim();
  const city = `${safeTrim(p.zip)} ${safeTrim(p.city)}`.trim();
  const lines = [street, city].filter(Boolean);
  if (lines.length === 0 && safeTrim(p.address)) return [safeTrim(p.address)];
  return lines;
}

function formatPartyInline(p) {
  if (!p) return "—";
  const parts = [
    partyDisplayName(p),
    ...partyAddressLines(p),
    safeTrim(p.email) ? `E-Mail: ${safeTrim(p.email)}` : "",
    safeTrim(p.phone) ? `Tel: ${safeTrim(p.phone)}` : "",
  ].filter(Boolean);

  return parts.join("\n") || "—";
}

function hasPartyData(p) {
  if (!p) return false;
  const keys = [
    safeTrim(p.firstName),
    safeTrim(p.lastName),
    safeTrim(p.name),
    safeTrim(p.street),
    safeTrim(p.streetNo),
    safeTrim(p.zip),
    safeTrim(p.city),
    safeTrim(p.address),
    safeTrim(p.phone),
    safeTrim(p.email),
  ];
  return keys.some((x) => !!x);
}

function fmtCHF(n) {
  const num = Number(n);
  if (Number.isNaN(num)) return "—";
  return `CHF ${num.toFixed(2)}`;
}

/* ===========================
   Styles
   =========================== */

const page = {
  fontFamily: "system-ui",
  color: "#111",
  // Kein padding hier: das machen wir im content
};

const content = {
  padding: "18mm", // Screen/Default
};

const header = { display: "flex", justifyContent: "space-between", gap: 18 };
const orgTitle = { fontWeight: 900, fontSize: 18 };
const orgSub = { fontSize: 12, opacity: 0.8 };
const docTitle = { fontWeight: 900, fontSize: 14, marginBottom: 8 };
const metaGrid = {
  display: "grid",
  gridTemplateColumns: "120px 1fr",
  gap: "4px 10px",
  fontSize: 12,
};
const metaK = { opacity: 0.75 };
const metaV = { fontWeight: 700 };
const hr = { height: 1, background: "#222", opacity: 0.25, marginTop: 12 };
const sectionTitle = { fontWeight: 900, fontSize: 12 };
const grid2 = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 };
const box = {
  border: "1px solid rgba(0,0,0,0.18)",
  borderRadius: 8,
  padding: "10px 12px",
  whiteSpace: "pre-line",
};
const boxLabel = { fontSize: 10, opacity: 0.75, marginBottom: 6 };
const boxValue = { fontSize: 12 };
const sigGrid = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 };
const sigBox = {
  border: "2px solid rgba(0,0,0,0.7)",
  borderRadius: 10,
  padding: "10px 12px",
  minHeight: 70,
};
const sigLine = {
  height: 1,
  background: "#000",
  marginTop: 30,
  marginBottom: 6,
};
const footer = {
  display: "flex",
  justifyContent: "space-between",
  marginTop: 18,
  fontSize: 10,
};

const printCss = `
@page { size: A4; margin: 8mm; }

@media print {
  html, body {
    margin: 0 !important;
    padding: 0 !important;
    height: auto !important;
    min-height: auto !important;
    background: #fff !important;
    overflow: visible !important;
  }

  /* Der wichtigste Teil gegen die leere Seite 2 */
  .receipt-page {
    padding: 0 !important;
    margin: 0 !important;
    height: auto !important;
    min-height: auto !important;
    overflow: visible !important;

    /* Micro-Overflow abfangen (Chrome/Edge) */
    zoom: 0.97; /* wenn nötig: 0.96 */
  }

  .receipt-content {
    padding: 0 !important;
    margin: 0 !important;
  }

  /* letzte Elemente dürfen keinen extra Abstand erzeugen */
  .receipt-page *:last-child {
    margin-bottom: 0 !important;
    padding-bottom: 0 !important;
  }

  * {
    page-break-before: auto !important;
    page-break-after: auto !important;
    break-before: auto !important;
    break-after: auto !important;
  }

  body {
    color: #111 !important;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
}
`;
