const paymentNames = { FEE: "Gebühren", REWARD: "Finderlohn", EXPENSES: "Auslagenersatz" };
const titles = {
  OWNER_HANDOVER: "Herausgabequittung Eigentümer / Abholer",
  FINDER_HANDOVER: "Herausgabequittung Finder / Abholer",
  TRANSFER: "Übergabe an zuständige Stelle",
  PAYMENT: "Zahlungsquittung",
  FUND: "Fundquittung",
};

function money(cents) {
  return cents === null || cents === undefined ? "noch ungeklärt" : `CHF ${(cents / 100).toFixed(2)}`;
}

function person(value) {
  if (!value) return "—";
  return [
    [value.firstName, value.lastName].filter(Boolean).join(" ") || value.name,
    [value.street, value.streetNo].filter(Boolean).join(" "),
    [value.zip, value.city].filter(Boolean).join(" ") || value.address,
    value.phone, value.email,
  ].filter(Boolean).join(" · ") || "—";
}

export default function WorkflowReceiptPrint({ job }) {
  const receipt = job.receipt;
  const item = job.item;
  const choice = item.finder?.rewardChoice || (item.finder?.rewardRequested ? "REQUESTED" : "");
  const rewardText = choice === "WAIVED"
    ? "Finder/in verzichtet freiwillig auf Finderlohn. Der Ersatz notwendiger Auslagen bleibt vorbehalten."
    : choice === "REQUESTED" ? "Finderlohn gewünscht." : "Es ist noch keine ausdrückliche Finderlohnwahl erfasst.";
  const amounts = receipt.chargeSnapshot || {};
  const payments = receipt.payments || [];
  const due = (category) => typeof amounts[category] === "object" && amounts[category] !== null
    ? amounts[category].dueCents : amounts[category];
  return (
    <article className="workflow-receipt-sheet">
      <header style={{ display: "flex", justifyContent: "space-between", gap: 20 }}>
        <div><strong>Gemeinde Horgen</strong><div>Fundbüro / Gemeindepolizei</div></div>
        <div><strong>{titles[job.kind] || "Quittung"}</strong>{job.reprint && <div>Nachdruck</div>}</div>
      </header>
      <p style={{ overflowWrap: "anywhere" }}>Quittungsnummer: <strong>{receipt.id}</strong><br />
        Fundnummer: <strong>{item.fundNo}</strong><br />
        Datum: {new Date(receipt.printedAt).toLocaleString("de-CH")}<br />
        Sachbearbeitung: {receipt.printedBy || item.caseWorker?.name || "—"}</p>
      <h3>Fundsache</h3>
      <p>{item.item?.manualLabel || item.item?.predefinedKey || "—"}<br />{item.item?.description}</p>
      <p>Funddatum / Zeit: {item.foundAt?.date || "—"} {item.foundAt?.time || ""}<br />Fundort: {item.foundAt?.location || "—"}</p>
      <p>{job.kind === "FUND" ? "Finder / Abgeber" : "Empfänger / zahlende oder empfangende Person"}: <strong>{receipt.recipient || "—"}</strong></p>
      {job.kind === "FUND" && <p>{person(item.finder)}</p>}
      {!!receipt.parts?.length && <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead><tr><th style={cell}>Gegenstand</th><th style={cell}>Anzahl</th><th style={cell}>Gebührenposition</th></tr></thead>
        <tbody>{receipt.parts.map((part) => <tr key={part.partId || part.id}>
          <td style={cell}>{part.label}</td><td style={cell}>{part.quantity}</td>
          <td style={cell}>{part.feeLabel || money(part.feeCents)}</td>
        </tr>)}</tbody>
      </table>}
      <h3>Getrennte Zahlungspositionen</h3>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead><tr><th style={cell}>Position</th><th style={cell}>Vereinbarter Betrag gesamt</th><th style={cell}>Heute erhalten</th><th style={cell}>Heute ausgezahlt</th></tr></thead>
        <tbody>{Object.entries(paymentNames).map(([category, name]) => <tr key={category}>
          <td style={cell}>{name}</td><td style={cell}>{money(due(category))}</td>
          <td style={cell}>{money(payments.filter((p) => p.category === category && p.type === "IN").reduce((sum, p) => sum + p.amountCents, 0))}</td>
          <td style={cell}>{money(payments.filter((p) => p.category === category && p.type === "OUT").reduce((sum, p) => sum + p.amountCents, 0))}</td>
        </tr>)}</tbody>
      </table>
      <p>Eine vereinbarte Forderung ist keine Bestätigung einer Zahlung. Die Spalten „Heute erhalten“ und „Heute ausgezahlt“ betreffen ausschließlich diesen Quittungsvorgang.</p>
      <p><strong>Erklärung zum Finderlohn:</strong> {rewardText}</p>
      {receipt.notes && <p>Bemerkung: {receipt.notes}</p>}
      <section style={{ marginTop: 28, border: "1px solid #333", padding: 14, breakInside: "avoid" }}>
        <p>{job.kind === "FUND"
          ? "Ich bestätige die Übergabe der Fundsache an das Fundbüro und die oben festgehaltene Erklärung zum Finderlohn."
          : job.kind === "PAYMENT"
            ? "Ich bestätige die oben aufgeführten Ein- und Auszahlungen."
            : "Ich bestätige den Empfang der aufgeführten Gegenstände und die oben aufgeführten Ein- und Auszahlungen."}</p>
        <div style={{ marginTop: 36, borderTop: "1px solid #111", paddingTop: 8 }}>Unterschrift: {receipt.recipient || "________________"}</div>
      </section>
    </article>
  );
}

const cell = { borderBottom: "1px solid #bbb", padding: "8px 5px", textAlign: "left", verticalAlign: "top" };
