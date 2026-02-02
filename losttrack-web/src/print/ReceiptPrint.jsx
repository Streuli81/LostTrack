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
  const nowPrint = useMemo(() => fmtDateTime(nowIso), [nowIso]);

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

  // Übergabezeitpunkt: wir nehmen "jetzt" als Übergabezeitpunkt im Druck (Erstversion)
  const handoverAt = nowPrint;

  // Titel rechts oben
  const title = useMemo(() => {
    if (receiptType === "FUND_RECEIPT") return "Fundquittung";
    if (receiptType === "OWNER_RECEIPT") return "Empfangsbestätigung Eigentümer/Abholer";
    if (receiptType === "FINDER_RECEIPT") return "Empfangsbestätigung Finder";
    return "Quittung";
  }, [receiptType]);

  // Empfänger/Person (Name im Unterschriftenfeld rechts)
  const recipientName = (recipientOverride || "").toString().trim();

  // Betrag (bei OWNER_RECEIPT = übergebener Finderlohn, bei FINDER_RECEIPT = ausbezahlter Finderlohn)
  const amountText = amount === null || amount === undefined ? "—" : fmtCHF(amount);

  // Spezifische Labels/Blöcke
  const showFinderBlock = receiptType === "FUND_RECEIPT";
  const showOwnerBlock = receiptType === "OWNER_RECEIPT";
  const showFinderReceiptBlock = receiptType === "FINDER_RECEIPT";

  // OWNER_RECEIPT Datenschutz:
  // - Abholer NICHT anzeigen
  // - Feld "Empfänger (Unterschrift)" NICHT anzeigen
  // - Unterschrift rechts umbenennen: "Eigentümer / Abholer"
  const rightSignatureLabel = showOwnerBlock ? "Eigentümer / Abholer" : "Empfänger / Abgeber";

  // Automatisch drucken, sobald die Komponente im Print-Area gerendert wurde
  useEffect(() => {
    // minimal verzögert, damit Layout sicher steht
    const t = window.setTimeout(() => window.print(), 50);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <div style={page}>
      <style>{printCss}</style>

      {/* Kopf */}
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
            <div style={metaV}>{nowPrint.split(",")[0] || nowPrint}</div>

            <div style={metaK}>Sachbearbeiter</div>
            <div style={metaV}>{caseWorkerName}</div>
          </div>
        </div>
      </div>

      <div style={hr} />

      {/* Angaben zur Fundsache */}
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
                  <div>
                    <div style={{ fontWeight: 800 }}>{label}</div>
                    <div style={{ opacity: 0.85 }}>{desc}</div>
                  </div>
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

      {/* FUND_RECEIPT: Finder */}
      {showFinderBlock ? (
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
      ) : null}

      {/* OWNER_RECEIPT: Eigentümer/Abholer (Abholer NICHT anzeigen) */}
      {showOwnerBlock ? (
        <Section title="ANGABEN EIGENTÜMER / ABHOLER">
          <div style={grid2}>
            {/* ✅ links: Eigentümer/Abholer */}
            <FieldBox label="Eigentümer / Abholer" value={formatPartyInline(owner)} />

            {/* ✅ rechts: Übergebener Finderlohn */}
            <FieldBox label="Übergebener Finderlohn" value={amountText} />

            {/* ✅ Feld "Empfänger (Unterschrift)" entfernt */}
          </div>
        </Section>
      ) : null}

      {/* FINDER_RECEIPT */}
      {showFinderReceiptBlock ? (
        <Section title="ANGABEN FINDER / ABHOLUNG">
          <div style={grid2}>
            <FieldBox span2 label="Grund" value={reason ? reason : "—"} />
            <FieldBox span2 label="Betrag (Finderlohn)" value={amountText} />
          </div>
        </Section>
      ) : null}

      {/* Unterschriften */}
      <Section title="UNTERSCHRIFTEN">
        <div style={sigGrid}>
          <SigBox title="Polizei / Sachbearbeiter" name={caseWorkerName || "—"} />
          <SigBox title={rightSignatureLabel} name={recipientName || "—"} />
        </div>
      </Section>

      {/* Footer */}
      <div style={footer}>
        <div style={{ opacity: 0.75 }}>LostTrack – Quittung (Print)</div>
        <div style={{ opacity: 0.75 }}>Erstellt am {nowPrint}</div>
      </div>
    </div>
  );
}

/* ---------------------------
 * UI building blocks
 * --------------------------- */

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

function formatPartyInline(p) {
  if (!p) return "—";
  const name = (p?.name || "").toString().trim();
  const address = (p?.address || "").toString().trim();
  const email = (p?.email || "").toString().trim();
  const phone = (p?.phone || "").toString().trim();

  const parts = [];
  if (name) parts.push(name);
  if (address) parts.push(address);
  if (email) parts.push(`E-Mail: ${email}`);
  if (phone) parts.push(`Tel: ${phone}`);

  return parts.length ? parts.join("\n") : "—";
}

/* ---------------------------
 * Formatting helpers
 * --------------------------- */

function fmtDateTime(value) {
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleString("de-CH");
  } catch {
    return String(value);
  }
}

function fmtCHF(n) {
  const num = Number(n);
  if (Number.isNaN(num)) return "—";
  return `CHF ${num.toFixed(2)}`;
}

/* ---------------------------
 * Styles
 * --------------------------- */

const page = {
  fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
  color: "#111",
  padding: "18mm",
};

const header = {
  display: "flex",
  justifyContent: "space-between",
  gap: 18,
  alignItems: "flex-start",
};

const orgTitle = { fontWeight: 900, fontSize: 18 };
const orgSub = { fontSize: 12, opacity: 0.8, marginTop: 2 };

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

const sectionTitle = {
  fontWeight: 900,
  fontSize: 12,
  letterSpacing: 0.6,
};

const grid2 = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 10,
};

const box = {
  border: "1px solid rgba(0,0,0,0.18)",
  borderRadius: 8,
  padding: "10px 12px",
  whiteSpace: "pre-line",
};

const boxLabel = { fontSize: 10, opacity: 0.75, marginBottom: 6 };
const boxValue = { fontSize: 12 };

const sigGrid = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 14,
  marginTop: 10,
};

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
  opacity: 0.85,
};

const footer = {
  display: "flex",
  justifyContent: "space-between",
  marginTop: 18,
  fontSize: 10,
};

const printCss = `
@page { size: A4; margin: 10mm; }
`;
