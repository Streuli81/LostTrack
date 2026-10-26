function dateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString("de-CH");
}
function display(value) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "ja" : "nein";
  if (typeof value === "object" && Array.isArray(value.parts) && value.payments) {
    const states = value.parts.map((part) => `${part.label}: ${part.handledQuantity || 0} von ${part.quantity} abgegeben / behandelt`);
    for (const [category, label] of [["FEE", "Gebühren"], ["REWARD", "Finderlohn"], ["EXPENSES", "Auslagenersatz"]]) {
      const payment = value.payments[category];
      if (payment) states.push(`${label}: Soll ${payment.dueCents === null ? "ungeklärt" : `CHF ${(payment.dueCents / 100).toFixed(2)}`}, Eingang CHF ${(payment.receivedCents / 100).toFixed(2)}, Ausgang CHF ${(payment.paidCents / 100).toFixed(2)}`);
    }
    if (value.blockedReason) states.push(`Gesperrt: ${value.blockedReason}`);
    if (value.decisionOpen) states.push("Fachliche Entscheidung offen");
    if (value.closedAt) states.push(`Abgeschlossen am ${dateTime(value.closedAt)}`);
    if (value.expensePayee) states.push(`Auslagenanspruchsteller: ${value.expensePayee.name || "ungeklärt"}; Grundlage ${value.expensePayee.basis}; bestätigt ${value.expensePayee.confirmed ? "ja" : "nein"}; ${value.expensePayee.note || ""}`);
    if (value.disposalProceedsCents !== undefined) states.push(`Gesonderter Verwertungserlös CHF ${(value.disposalProceedsCents / 100).toFixed(2)}`);
    if (value.finderRightsReview) states.push(`Finder-/Eigentumsprüfung: ${value.finderRightsReview.confirmed ? "bestätigt" : "offen"}; ${value.finderRightsReview.note || ""}`);
    return states.join(" · ");
  }
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
const events = {
  ITEM_COMMITTED: "Fundsache definitiv erfasst", ITEM_UPDATED: "Fundsache bearbeitet",
  DRAFT_SAVED: "Entwurf gespeichert", STATUS_CHANGED: "Status geändert",
  FINDER_UPDATED: "Finder aktualisiert", OWNER_UPDATED: "Eigentümer aktualisiert", COLLECTOR_UPDATED: "Abholer aktualisiert",
  INVESTIGATION_STEP_ADDED: "Ermittlungsschritt hinzugefügt", INVESTIGATION_STEP_DELETED: "Ermittlungsschritt gelöscht",
  INVESTIGATION_STEP_ADDED_AUTO: "Ermittlungsschritt automatisch ergänzt", RECEIPT_PRINTED: "Quittung erstellt",
  FINDER_REWARD_PAID: "Finderlohn ausgezahlt", FINDER_REWARD_DEPOSIT_RECEIVED: "Finderlohn eingezahlt",
  CASHBOOK_POSTED: "Kassenbucheintrag", DISPOSITION_SET: "Verwertung / Weitergabe dokumentiert",
  WORKFLOW_PLAN_UPDATED: "Ablaufplan aktualisiert", WORKFLOW_RECEIPT_CONFIRMED: "Quittung und tatsächlichen Vorgang bestätigt",
  WORKFLOW_CLOSED: "Gesamtvorgang abgeschlossen", WORKFLOW_REOPENED: "Gesamtvorgang wieder geöffnet",
  WORKFLOW_DISPOSITION_RECORDED: "Freigegebene Verwertung dokumentiert",
};
const pathNames = {
  "regime.type": "Fundregime", "roles.delivererName": "Überbringer", "roles.legalFinderName": "Rechtlicher Finder",
  "expenseClaims": "Auslagenanmeldungen und Entscheidungen", "contents": "Fundinhalt / Verwahrwerte",
  "retention.reportedDate": "Anzeige bei Polizei – Datum", "retention.reportedTime": "Anzeige bei Polizei – Zeit",
  "retention.receivedDate": "Eingang Fundbüro – Datum", "retention.receivedTime": "Eingang Fundbüro – Zeit",
  "retention.finderBasis": "Grundlage der Finderfrist",
  "institution.name": "Einrichtung", "institution.internalLocation": "Fundort innerhalb der Einrichtung",
  "institution.legalFinderName": "Rechtlich relevante Finderstelle", "institution.legalFinderConfirmed": "Finderzuordnung fachlich geprüft",
  "institution.deliveredBy": "Überbringer", "institution.deliveringInstitution": "Übergebende Einrichtung",
  "institution.reviewNote": "Prüfvermerk Finderzuordnung", "institution.handedToInstitutionDate": "Übergabe an Einrichtung",
  "institution.handedToOfficeDate": "Übergabe an Fundbüro",
  "institution.legalFinderContact": "Kontakt Finderstelle", "institution.intakeSource": "Eingang von Person / Einrichtung",
  "origin.type": "Fundumgebung", "origin.operator": "Verkehrsunternehmen", "origin.line": "Linie / Kurs",
  "origin.route": "Haltestelle / Strecke", "origin.direction": "Fahrtrichtung", "origin.vehicleNo": "Fahrzeugnummer",
  "capturedAt": "Erfassungszeitpunkt", "retention.noticeTime": "Bekanntmachungszeit", "retention.custodyStartTime": "Aufbewahrungszeit",
  "status": "Verbleib", "foundAt.date": "Funddatum", "foundAt.time": "Fundzeit", "foundAt.location": "Fundort",
  "item.manualLabel": "Gegenstand", "item.description": "Beschreibung", "caseWorker.name": "Sachbearbeitung",
  "finder.rewardChoice": "Finderlohnwahl", "finder.rewardRequested": "Finderlohn gewünscht",
  "finderReward.paidAt": "Finderlohn ausgezahlt am", "finderReward.amountCents": "Ausgezahlter Finderlohn (Rappen)",
  "finderRewardDeposit.amountCents": "Eingezahlter Finderlohn (Rappen)",
};
function pathLabel(path) {
  if (pathNames[path]) return pathNames[path];
  const [party, field] = path.split(".");
  const parties = { finder: "Finder", owner: "Eigentümer", collector: "Abholer" };
  const fields = { firstName: "Vorname", lastName: "Name", street: "Strasse", streetNo: "Hausnummer", zip: "PLZ", city: "Ort", phone: "Telefon", email: "E-Mail", name: "Name", address: "Adresse" };
  if (parties[party] && fields[field]) return `${parties[party]} – ${fields[field]}`;
  if (path.startsWith("workflow")) return "Ablauf und Zahlungen";
  if (path.startsWith("receipts")) return "Quittungen";
  if (path.startsWith("investigationSteps")) return "Ermittlungsschritte";
  if (path.startsWith("retention")) return "Aufbewahrungs- und Prüfdatum";
  return path;
}
export default function AuditEntries({ entries }) {
  return entries.length ? <div>{entries.map((entry, index) => <article key={entry.id || `${entry.at}:${index}`} style={{ borderBottom: "1px solid #ccc", padding: "10px 0", breakInside: "avoid" }}>
    <strong>{events[entry.type] || entry.type}</strong> · {dateTime(entry.at)} · {entry.actor || entry.snapshot?.actor || "—"}
    {entry.snapshot?.reason && <p>Grund: {entry.snapshot.reason}</p>}
    {entry.snapshot?.step && <p>{entry.snapshot.step.who}: {entry.snapshot.step.what}</p>}
    {entry.snapshot?.receipt && <p>Quittung {entry.snapshot.receipt.id} · {entry.snapshot.receipt.recipient || "—"}</p>}
    {Array.isArray(entry.diff) && <ul>{entry.diff.filter((change) => change.path !== "updatedAt").map((change, i) => <li key={`${change.path}:${i}`} style={{ overflowWrap: "anywhere" }}>
      {pathLabel(change.path)}: {display(change.from)} → {display(change.to)}
    </li>)}</ul>}
  </article>)}</div> : <p>Keine Änderungen protokolliert.</p>;
}
