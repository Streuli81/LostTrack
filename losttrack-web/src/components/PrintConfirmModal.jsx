// src/components/PrintConfirmModal.jsx
import { useEffect, useMemo } from "react";

/**
 * PrintConfirmModal
 * - UI-only Bestätigung vor dem eigentlichen printReceipt() + window.print()
 * - Zeigt exakt die relevanten Druckdaten (ohne "Grund", wie gewünscht)
 *
 * Props:
 *  open: boolean
 *  onClose: () => void
 *  onConfirm: () => void
 *
 *  item: LostItem
 *  receiptType: "FUND_RECEIPT" | "OWNER_RECEIPT" | "FINDER_RECEIPT"
 *  recipientOverride: string
 *  amount: number | null
 *  finderRewardWanted: boolean
 *
 *  // optional flags für zusätzliche blockierende Regeln
 *  isFinderRewardPayout: boolean   // true, wenn es um Auszahlung geht (FINDER_RECEIPT + payout)
 *  rewardPaid: boolean            // true, wenn bereits ausbezahlt (soll blockieren)
 */
export default function PrintConfirmModal({
  open,
  onClose,
  onConfirm,

  item,
  receiptType,
  recipientOverride,
  amount,
  finderRewardWanted = false,

  isFinderRewardPayout = false,
  rewardPaid = false,
}) {
  // ESC schließt
  useEffect(() => {
    if (!open) return;
    function onKey(e) {
      if (e.key === "Escape") onClose?.();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const {
    title,
    fundNo,
    label,
    desc,
    foundLocation,
    foundDate,
    foundTime,
    caseWorkerName,

    finder,
    owner,
    collector,

    selectedParty,
    recipientName,
    rightSignatureLabel,

    amountText,
  } = useMemo(() => {
    const fundNo0 = safeTrim(item?.fundNo);
    const label0 = safeTrim(item?.item?.manualLabel) || safeTrim(item?.item?.predefinedKey);
    const desc0 = safeTrim(item?.item?.description);

    const foundLocation0 = safeTrim(item?.foundAt?.location);
    const foundDate0 = safeTrim(item?.foundAt?.date);
    const foundTime0 = safeTrim(item?.foundAt?.time);

    const caseWorkerName0 =
      safeTrim(item?.caseWorker?.name) || safeTrim(item?.caseWorker?.id) || "—";

    const finder0 = item?.finder || null;
    const owner0 = item?.owner || null;
    const collector0 = item?.collector || null;

    const title0 =
      receiptType === "FUND_RECEIPT"
        ? "Fundquittung"
        : receiptType === "OWNER_RECEIPT"
        ? "Empfangsbestätigung Eigentümer/Abholer"
        : receiptType === "FINDER_RECEIPT"
        ? "Empfangsbestätigung Finder/Abholer"
        : "Quittung";

    const selectedParty0 = (() => {
      if (receiptType === "FUND_RECEIPT") return finder0;

      if (receiptType === "OWNER_RECEIPT") {
        // Eigentümer bevorzugen, sonst Abholer
        return hasPartyData(owner0) ? owner0 : collector0;
      }

      if (receiptType === "FINDER_RECEIPT") {
        // Abholer bevorzugen, sonst Finder
        return hasPartyData(collector0) ? collector0 : finder0;
      }

      return collector0 || finder0 || owner0;
    })();

    const recipientName0 = (() => {
      const o = safeTrim(recipientOverride);
      if (o) return o;
      const auto = partyDisplayName(selectedParty0);
      return auto || "—";
    })();

    const rightSignatureLabel0 = receiptType === "OWNER_RECEIPT" ? "Eigentümer / Abholer" : "Empfänger / Abgeber";

    const amountText0 = amount === null || amount === undefined ? "—" : fmtCHF(amount);

    return {
      title: title0,
      fundNo: fundNo0,
      label: label0,
      desc: desc0,
      foundLocation: foundLocation0,
      foundDate: foundDate0,
      foundTime: foundTime0,
      caseWorkerName: caseWorkerName0,

      finder: finder0,
      owner: owner0,
      collector: collector0,

      selectedParty: selectedParty0,
      recipientName: recipientName0,
      rightSignatureLabel: rightSignatureLabel0,

      amountText: amountText0,
    };
  }, [item, receiptType, recipientOverride, amount]);

  const checks = useMemo(() => {
    const errors = [];
    const warnings = [];

    // --- blockierend (⛔) ---
    if (!fundNo) errors.push("Fundnummer fehlt.");
    if (!label) errors.push("Gegenstand fehlt.");

    if (receiptType === "FUND_RECEIPT") {
      if (!hasPartyData(finder) || !partyDisplayName(finder)) errors.push("Finder ist nicht vollständig erfasst (Name fehlt).");
    }

    if (receiptType === "OWNER_RECEIPT") {
      const chosen = hasPartyData(owner) ? owner : collector;
      if (!hasPartyData(chosen) || !partyDisplayName(chosen)) errors.push("Eigentümer/Abholer ist nicht vollständig erfasst (Name fehlt).");
    }

    if (receiptType === "FINDER_RECEIPT") {
      if (!hasPartyData(selectedParty) || !partyDisplayName(selectedParty)) errors.push("Finder/Abholer ist nicht vollständig erfasst (Name fehlt).");
      if (isFinderRewardPayout && rewardPaid) errors.push("Finderlohn wurde bereits ausbezahlt (Druck/Bestätigung gesperrt).");
      if (isFinderRewardPayout) {
        const n = Number(amount);
        if (!Number.isFinite(n) || n <= 0) errors.push("Betrag für Finderlohn-Abholung ist ungültig (muss > 0 sein).");
      }
    }

    // --- warnend (⚠️) ---
    if (!foundLocation) warnings.push("Fundort ist leer.");
    if (!foundDate) warnings.push("Funddatum ist leer.");

    // Kontakt: mind. Tel oder E-Mail (Warnung, nicht blockierend)
    const p = receiptType === "FUND_RECEIPT"
      ? finder
      : receiptType === "OWNER_RECEIPT"
      ? (hasPartyData(owner) ? owner : collector)
      : selectedParty;

    const hasPhone = !!safeTrim(p?.phone);
    const hasEmail = !!safeTrim(p?.email);
    if (p && !hasPhone && !hasEmail) warnings.push("Kontaktangaben fehlen (Telefon und E-Mail leer).");

    // Unterschrift rechts wäre "—" -> lieber warnen (bei dir kann override leer sein)
    if (recipientName === "—") warnings.push("Unterschrift rechts wäre „—“ (Empfängername nicht gesetzt).");

    return { errors, warnings };
  }, [
    receiptType,
    fundNo,
    label,
    foundLocation,
    foundDate,
    finder,
    owner,
    collector,
    selectedParty,
    recipientName,
    isFinderRewardPayout,
    rewardPaid,
    amount,
  ]);

  const canConfirm = checks.errors.length === 0;

  if (!open) return null;

  const partyBlock =
    receiptType === "FUND_RECEIPT" ? (
      <Section title="ANGABEN FINDER">
        <KvGrid>
          <Kv k="Finder" v={<PreLine text={formatPartyInline(finder)} />} span2 />
          <Kv k="Finderlohn gewünscht" v={finderRewardWanted ? "ja" : "nein"} span2 />
        </KvGrid>
      </Section>
    ) : receiptType === "OWNER_RECEIPT" ? (
      <Section title="ANGABEN EIGENTÜMER / ABHOLER">
        <KvGrid>
          <Kv
            k="Eigentümer / Abholer"
            v={<PreLine text={formatPartyInline(hasPartyData(owner) ? owner : collector)} />}
            span2
          />
          <Kv k="Übergebener Finderlohn" v={amountText} span2 />
        </KvGrid>
      </Section>
    ) : (
      <Section title="ANGABEN FINDER / ABHOLUNG">
        <KvGrid>
          <Kv k="Betrag (Finderlohn)" v={amountText} span2 />
          <Kv k="Person (Finder / Abholer)" v={<PreLine text={formatPartyInline(selectedParty)} />} span2 />
        </KvGrid>

        {isFinderRewardPayout ? (
          <div style={noteBox}>
            <div style={{ fontWeight: 800 }}>Hinweis</div>
            <div style={{ marginTop: 4, opacity: 0.85, fontSize: 13 }}>
              Beim Bestätigen wird automatisch im Kassenbuch gebucht und eine Doppelzahlung gesperrt.
            </div>
          </div>
        ) : null}
      </Section>
    );

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={overlay}
      onMouseDown={(e) => {
        // Klick auf Overlay schließt
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div style={modal}>
        <div style={modalHeader}>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <div style={modalTitle}>Druck bestätigen</div>
              <span style={badge}>{title}</span>
            </div>
            <div style={modalSub}>
              Bitte Angaben prüfen. Nach Bestätigung wird die Quittung erstellt und die Druckansicht geöffnet.
            </div>
          </div>

          <button type="button" onClick={onClose} style={iconBtn} aria-label="Schließen">
            ✕
          </button>
        </div>

        <div style={modalBody}>
          <div style={statusBox}>
            <div style={{ fontWeight: 900 }}>
              {checks.errors.length ? `⛔ ${checks.errors.length} Fehler` : `✅ Keine Fehler`}
            </div>
            <div style={{ opacity: 0.9 }}>
              {checks.warnings.length ? `⚠️ ${checks.warnings.length} Warnung(en)` : "⚪ Keine Warnungen"}
            </div>
          </div>

          {(checks.errors.length || checks.warnings.length) ? (
            <div style={{ display: "grid", gap: 8 }}>
              {checks.errors.map((t, i) => (
                <div key={`e-${i}`} style={msgError}>⛔ {t}</div>
              ))}
              {checks.warnings.map((t, i) => (
                <div key={`w-${i}`} style={msgWarn}>⚠️ {t}</div>
              ))}
            </div>
          ) : null}

          <Section title="ANGABEN ZUR FUNDSACHE">
            <KvGrid>
              <Kv k="Fundnummer" v={fundNo || "—"} />
              <Kv k="Sachbearbeiter" v={caseWorkerName || "—"} />

              <Kv
                k="Gegenstand"
                v={
                  label ? (
                    <div>
                      <div style={{ fontWeight: 900 }}>{label}</div>
                      {desc ? <div style={{ opacity: 0.85, marginTop: 2 }}>{desc}</div> : null}
                    </div>
                  ) : (
                    "—"
                  )
                }
                span2
              />

              <Kv k="Fundort" v={foundLocation || "—"} />
              <Kv k="Fundzeit" v={foundDate ? `${foundDate}${foundTime ? `, ${foundTime}` : ""}` : "—"} />
            </KvGrid>
          </Section>

          {partyBlock}

          <Section title="UNTERSCHRIFTEN (VORSCHAU)">
            <KvGrid>
              <Kv k="Polizei / Sachbearbeiter" v={caseWorkerName || "—"} span2 />
              <Kv k={rightSignatureLabel} v={recipientName || "—"} span2 />
            </KvGrid>
          </Section>
        </div>

        <div style={modalFooter}>
          <button type="button" onClick={onClose} style={btnSecondary}>
            Abbrechen
          </button>

          <button
            type="button"
            onClick={() => {
              if (!canConfirm) return;
              onConfirm?.();
            }}
            disabled={!canConfirm}
            style={{
              ...btnPrimary,
              opacity: canConfirm ? 1 : 0.5,
              cursor: canConfirm ? "pointer" : "not-allowed",
            }}
            title={!canConfirm ? "Fehler beheben, bevor gedruckt werden kann." : ""}
          >
            Druck bestätigen
          </button>
        </div>
      </div>
    </div>
  );
}

/* ===========================
   Mini UI parts
   =========================== */

function Section({ title, children }) {
  return (
    <div style={{ marginTop: 14 }}>
      <div style={sectionTitle}>{title}</div>
      <div style={{ marginTop: 10 }}>{children}</div>
    </div>
  );
}

function KvGrid({ children }) {
  return <div style={grid2}>{children}</div>;
}

function Kv({ k, v, span2 = false }) {
  return (
    <div style={{ ...box, gridColumn: span2 ? "1 / -1" : "auto" }}>
      <div style={boxLabel}>{k}</div>
      <div style={boxValue}>{v ?? "—"}</div>
    </div>
  );
}

function PreLine({ text }) {
  return <div style={{ whiteSpace: "pre-line" }}>{text ?? "—"}</div>;
}

/* ===========================
   Helpers copied from ReceiptPrint
   =========================== */

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

const overlay = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.45)",
  display: "grid",
  placeItems: "center",
  padding: 14,
  zIndex: 9999,
};

const modal = {
  width: "min(860px, 96vw)",
  maxHeight: "92vh",
  overflow: "auto",
  background: "#fff",
  color: "#111",
  borderRadius: 12,
  border: "1px solid rgba(0,0,0,0.18)",
  boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
};

const modalHeader = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  padding: "14px 14px 10px 14px",
  borderBottom: "1px solid rgba(0,0,0,0.12)",
  alignItems: "flex-start",
};

const modalTitle = { fontWeight: 900, fontSize: 16 };
const modalSub = { marginTop: 6, fontSize: 13, opacity: 0.8 };

const badge = {
  fontSize: 12,
  fontWeight: 800,
  padding: "4px 10px",
  borderRadius: 999,
  border: "1px solid rgba(0,0,0,0.18)",
  background: "rgba(0,0,0,0.03)",
};

const iconBtn = {
  border: "1px solid rgba(0,0,0,0.18)",
  background: "#fff",
  borderRadius: 10,
  padding: "6px 10px",
  cursor: "pointer",
};

const modalBody = { padding: 14, display: "grid", gap: 12 };

const statusBox = {
  display: "flex",
  justifyContent: "space-between",
  gap: 10,
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid rgba(0,0,0,0.12)",
  background: "rgba(0,0,0,0.03)",
};

const msgError = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid rgba(190,0,0,0.25)",
  background: "rgba(190,0,0,0.06)",
  fontWeight: 700,
};

const msgWarn = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid rgba(180,120,0,0.25)",
  background: "rgba(180,120,0,0.08)",
  fontWeight: 700,
};

const sectionTitle = { fontWeight: 900, fontSize: 12 };

const grid2 = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 10,
};

const box = {
  border: "1px solid rgba(0,0,0,0.18)",
  borderRadius: 10,
  padding: "10px 12px",
  whiteSpace: "normal",
};

const boxLabel = { fontSize: 10, opacity: 0.75, marginBottom: 6 };
const boxValue = { fontSize: 13 };

const noteBox = {
  marginTop: 10,
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid rgba(0,0,0,0.12)",
  background: "rgba(0,0,0,0.03)",
};

const modalFooter = {
  display: "flex",
  justifyContent: "space-between",
  gap: 10,
  padding: 14,
  borderTop: "1px solid rgba(0,0,0,0.12)",
};

const btnSecondary = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid rgba(0,0,0,0.18)",
  background: "#fff",
  cursor: "pointer",
};

const btnPrimary = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid rgba(0,0,0,0.18)",
  background: "rgba(0,0,0,0.06)",
  fontWeight: 900,
};
