import { environmentLabel, isTransportFind, isInstitutionFind, institutionRightsChecked, finderRewardExcluded, legalFinderName, fundRegime, FUND_REGIMES, isReferralOnly } from "../domain/captureContext.js";

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
  const institution = isInstitutionFind(item);
  const excluded = finderRewardExcluded(item);
  const differentSigner = !!item.regime && job.kind === "FUND" && receipt.recipient !== legalFinderName(item);
  const rewardText = isReferralOnly(item) ? "Sonderfall: Finderrechte und allfällige Ansprüche sind gesondert zu prüfen. Hier wird kein persönlicher Finderlohnverzicht erklärt."
    : excluded ? "Haus-/Anstalts- oder ÖV-Fund: kein Finderlohn. Eine persönliche Verzichtserklärung der Fundperson wird nicht abgegeben. Auslagenersatz wird separat geprüft."
    : differentSigner && choice === "WAIVED" ? "Für die erfasste Finderstelle wurde ein Verzicht angegeben. Berechtigung und Wirksamkeit dieser Erklärung sind gesondert zu prüfen; der Überbringer erklärt hier keinen fremden Verzicht."
    : choice === "WAIVED"
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
        <div><strong>{titles[receipt.documentKind || job.kind] || "Quittung"}</strong>{job.reprint && <div>Nachdruck</div>}</div>
      </header>
      <p style={{ overflowWrap: "anywhere" }}>Quittungsnummer: <strong>{receipt.id}</strong><br />
        Fundnummer: <strong>{item.fundNo}</strong><br />
        Datum: {new Date(receipt.printedAt).toLocaleString("de-CH")}<br />
        Sachbearbeitung: {receipt.printedBy || item.caseWorker?.name || "—"}</p>
      <h3>Fundsache</h3>
      {item.regime && <p>Fundregime: {FUND_REGIMES.find(([code]) => code === fundRegime(item))?.[1] || "Noch zu prüfen"}</p>}
      <p>{item.item?.manualLabel || item.item?.predefinedKey || "—"}<br />{item.item?.description}</p>
      <p>Funddatum / Zeit: {item.foundAt?.date || "—"} {item.foundAt?.time || ""}<br />Fundort: {item.foundAt?.location || "—"}</p>
      {item.origin?.type && <p>Fundumgebung: {environmentLabel(item)}
        {isTransportFind(item) && <><br />Verkehrsunternehmen: {item.origin.operator || "Noch zu klären"}
          {item.origin.line && <> · Linie/Kurs: {item.origin.line}</>}
          {item.origin.route && <><br />Haltestelle / Strecke: {item.origin.route}</>}</>}
      </p>}
      <p>{job.kind === "FUND" ? institution ? "Überbringer / abgebende Stelle" : "Finder / Abgeber" : "Empfänger / zahlende oder empfangende Person"}: <strong>{receipt.recipient || "—"}</strong></p>
      {job.kind === "FUND" && <p>{(institution || item.regime) && "Ursprüngliche Fundperson: "}{person(item.finder)}</p>}
      {item.roles && !institution && <p>Rechtlicher Finder / Finderstelle (erfasste Rolle): {legalFinderName(item) || "Noch zu prüfen"}</p>}
      {!!item.contents?.length && <section><h3>Dokumentierter Fundinhalt / Verwahrwerte</h3>
        <ul>{item.contents.map((row) => <li key={row.id}>{row.label}{row.kind === "CASH" && <> – CHF {(row.amountCents / 100).toFixed(2)} ({row.countConfirmed ? "gezählt" : "Zählung noch ungeprüft"})</>} {row.details}</li>)}</ul>
        <p>Verwahrtes Fundbargeld ist keine Gebühr, kein Finderlohn und keine bestätigte Zahlungsbuchung. Eine Herausgabe umfasst die ausdrücklich aufgeführten Übergabepositionen.</p>
      </section>}
      {institution && <p>Einrichtung: {item.institution?.name || "Noch zu klären"}
        {item.institution?.internalLocation && <> · Fundort darin: {item.institution.internalLocation}</>}<br />
        Erfasste rechtliche Finderstelle: {item.institution?.legalFinderName || "Noch zu klären"} ({institutionRightsChecked(item) ? "Zuordnung fachlich geprüft" : "Zuordnung ungeprüft"})
        {item.institution?.deliveringInstitution && <><br />Übergebende Einrichtung: {item.institution.deliveringInstitution}</>}
        {item.institution?.handedToInstitutionDate && <><br />Übergabe an Einrichtung: {item.institution.handedToInstitutionDate}</>}
        {item.institution?.handedToOfficeDate && <><br />Übergabe an Fundbüro: {item.institution.handedToOfficeDate}</>}
      </p>}
      {job.kind === "PAYMENT" && <p><strong>Nur Zahlungsbestätigung – keine weitere Gegenstandsübergabe.</strong></p>}
      {job.kind !== "FUND" && !!receipt.parts?.length && <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead><tr><th style={cell}>Gegenstand</th><th style={cell}>Anzahl</th><th style={cell}>Gebührenposition</th></tr></thead>
        <tbody>{receipt.parts.map((part) => <tr key={part.partId || part.id}>
          <td style={cell}>{part.label}</td><td style={cell}>{part.quantity}</td>
          <td style={cell}>{part.feeLabel || money(part.feeCents)}</td>
        </tr>)}</tbody>
      </table>}
      {job.kind !== "FUND" && <><h3>Getrennte Zahlungspositionen</h3>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead><tr><th style={cell}>Position</th><th style={cell}>Vereinbarter Betrag gesamt</th><th style={cell}>Heute erhalten</th><th style={cell}>Heute ausgezahlt</th></tr></thead>
        <tbody>{Object.entries(paymentNames).map(([category, name]) => <tr key={category}>
          <td style={cell}>{name}</td><td style={cell}>{money(due(category))}</td>
          <td style={cell}>{money(payments.filter((p) => p.category === category && p.type === "IN").reduce((sum, p) => sum + p.amountCents, 0))}</td>
          <td style={cell}>{money(payments.filter((p) => p.category === category && p.type === "OUT").reduce((sum, p) => sum + p.amountCents, 0))}</td>
        </tr>)}</tbody>
      </table>
      <p>Eine vereinbarte Forderung ist keine Bestätigung einer Zahlung. Die Spalten „Heute erhalten“ und „Heute ausgezahlt“ betreffen ausschließlich diesen Quittungsvorgang.</p></>}
      {job.kind !== "FUND" && receipt.expensePayeeSnapshot?.name && <p>Geprüfter Auslagenanspruchsteller: {receipt.expensePayeeSnapshot.name}<br />
        Grundlage: {receipt.expensePayeeSnapshot.basis === "OTHER_BASIS" ? "Gesonderte Anspruchsgrundlage" : "Finderrecht"}. Prüfvermerk: {receipt.expensePayeeSnapshot.note}</p>}
      <p><strong>{institution ? "Finderrolle und Finderlohn:" : "Erklärung zum Finderlohn:"}</strong> {rewardText}</p>
      {receipt.notes && <p>Bemerkung: {receipt.notes}</p>}
      <section style={{ marginTop: 28, border: "1px solid #333", padding: 14, breakInside: "avoid" }}>
        <p>{job.kind === "FUND"
          ? excluded || isReferralOnly(item) || differentSigner ? "Ich bestätige die Abgabe der Fundsache an das Fundbüro und die oben dokumentierten Angaben zur Überbringung."
            : "Ich bestätige die Übergabe der Fundsache an das Fundbüro und die oben festgehaltene Erklärung zum Finderlohn."
          : job.kind === "PAYMENT"
            ? "Ich bestätige die oben aufgeführten Ein- und Auszahlungen."
            : "Ich bestätige den Empfang der aufgeführten Gegenstände und die oben aufgeführten Ein- und Auszahlungen."}</p>
        <div style={{ marginTop: 36, borderTop: "1px solid #111", paddingTop: 8 }}>Unterschrift: {receipt.recipient || "________________"}</div>
      </section>
    </article>
  );
}

const cell = { borderBottom: "1px solid #bbb", padding: "8px 5px", textAlign: "left", verticalAlign: "top" };
