import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { hasPermission } from "../core/auth/auth.js";
import { getLostItemById, updateFinder, updateOwner, updateCollector } from "../core/storage/lostItemRepo.js";
import { getWorkflowSummary } from "../domain/workflow.js";
import InvestigationSteps from "../components/InvestigationSteps.jsx";
import PartyCardEditor from "../components/PartyCardEditor.jsx";
import WorkflowPanel from "../components/WorkflowPanel.jsx";

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
    return states.join(" · ");
  }
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
function person(value) {
  if (!value) return "—";
  return [[value.firstName, value.lastName].filter(Boolean).join(" ") || value.name,
    [value.street, value.streetNo].filter(Boolean).join(" "),
    [value.zip, value.city].filter(Boolean).join(" ") || value.address,
    value.phone, value.email].filter(Boolean).join(" · ") || "—";
}
function Row({ label, value }) {
  return <div style={{ display: "grid", gridTemplateColumns: "minmax(120px, 180px) 1fr", gap: 10 }}><span style={{ color: "var(--muted)" }}>{label}</span><span style={{ overflowWrap: "anywhere" }}>{display(value)}</span></div>;
}
function Card({ title, children }) { return <section style={card}><h3 style={{ marginTop: 0 }}>{title}</h3><div style={{ display: "grid", gap: 8 }}>{children}</div></section>; }

export default function ItemDetail() {
  const { id } = useParams();
  return <DetailContent key={id} id={id} />;
}
function DetailContent({ id }) {
  const [data, setData] = useState(() => ({ item: getLostItemById(id) }));
  const [error, setError] = useState("");
  const item = data.item;
  const canEdit = hasPermission("ITEM_EDIT");
  function refresh() { setData({ item: getLostItemById(id) }); }
  if (!item) return <section><h2>Fundsache nicht gefunden</h2><p>Der Datensatz ist nicht mehr vorhanden.</p><Link to="/suche">Zur Suche</Link></section>;

  const summary = getWorkflowSummary(item);
  const closed = !!summary.workflow.closedAt;
  const itemLabel = item.item?.manualLabel || item.item?.predefinedKey || "Fundsache";
  const saveParty = (method, patch) => {
    const result = method({ id: item.id, ...patch });
    if (result.ok) refresh();
    return result;
  };
  function collectorFromFinder() {
    const result = updateCollector({ id: item.id, collector: item.finder, sameAsFinder: true });
    if (!result.ok) setError(result.error || "Der Finder konnte nicht als Abholer übernommen werden.");
    else { setError(""); refresh(); }
  }
  function printReport() {
    try { window.print(); }
    catch { setError("Der Druckdialog konnte nicht geöffnet werden."); }
  }
  const rewardChoice = item.finder?.rewardChoice || (item.finder?.rewardRequested ? "REQUESTED" : "");
  const rewardLabel = rewardChoice === "WAIVED" ? "Ausdrücklicher Verzicht" : rewardChoice === "REQUESTED" ? "Finderlohn gewünscht" : "Noch keine ausdrückliche Wahl";

  return <section style={{ maxWidth: 1300 }}>
    <style>{printCss}</style>
    <div className="screen-detail" style={{ display: "grid", gap: 16 }}>
      <header style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div><h2 style={{ marginTop: 0 }}>{item.fundNo} – {itemLabel}</h2><p>Funddatum: {item.foundAt?.date || "—"} {item.foundAt?.time || ""} · Fundort: {item.foundAt?.location || "—"}</p></div>
        <div style={{ display: "flex", alignItems: "start", gap: 10, flexWrap: "wrap" }}>
          {canEdit && !closed && <Link to={`/items/${item.id}/bearbeiten`}>Grunddaten bearbeiten</Link>}
          <button type="button" onClick={refresh}>Aktualisieren</button>
          <button type="button" onClick={printReport}>Bericht drucken / PDF</button><Link to="/suche">Zur Suche</Link>
        </div>
      </header>
      {error && <p role="alert" style={{ color: "#b00020" }}>{error}</p>}
      <div style={columns}>
        <Card title="Gegenstand und Sachbearbeitung">
          <Row label="Gegenstand" value={itemLabel} /><Row label="Beschreibung" value={item.item?.description} />
          <Row label="Kategorie" value={item.item?.category} /><Row label="Marke / Typ" value={[item.item?.brand, item.item?.type].filter(Boolean).join(" / ")} />
          <Row label="Farbe / Zustand" value={[item.item?.color, item.item?.condition].filter(Boolean).join(" / ")} />
          <Row label="Seriennummer" value={item.item?.serialNumber} /><Row label="Geschätzter Wert" value={item.item?.estimatedValueCHF ? `CHF ${Number(item.item.estimatedValueCHF).toFixed(2)}` : "—"} />
          <Row label="Sachbearbeitung" value={typeof item.caseWorker === "string" ? item.caseWorker : [item.caseWorker?.id, item.caseWorker?.name].filter(Boolean).join(" – ")} />
          <Row label="Bemerkungen" value={item.notes} /><Row label="Erfasst / aktualisiert" value={`${dateTime(item.createdAt)} / ${dateTime(item.updatedAt)}`} />
        </Card>
        <Card title="Aufbewahrung und Finderlohnwahl">
          <Row label="Aufbewahrung ab" value={item.retention?.custodyStartDate} /><Row label="Anzeige / Bekanntmachung" value={item.retention?.noticeDate} />
          <Row label="Prüfdatum Verwertung" value={item.retention?.auctionReviewDate ? dateTime(item.retention.auctionReviewDate) : "Noch ungeklärt"} />
          <Row label="Prüfdatum Findererwerb" value={item.retention?.finderAcquisitionReviewDate ? dateTime(item.retention.finderAcquisitionReviewDate) : "Noch ungeklärt"} />
          <Row label="Finderlohnwahl" value={rewardLabel} />
          <p>Ein Prüfdatum gibt keine automatische Herausgabe oder Verwertung frei. Fachliche und rechtliche Voraussetzungen sind gesondert zu prüfen.</p>
        </Card>
      </div>
      <WorkflowPanel item={item} onChanged={refresh} />
      <fieldset disabled={closed} style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}>
        {closed && <p>Der Vorgang ist abgeschlossen. Für weitere Änderungen muss er mit Begründung wieder geöffnet werden.</p>}
        <div style={columns}>
          <PartyCardEditor title="Finder" initialValue={item.finder} showRewardRequested onSave={(finder) => saveParty(updateFinder, { finder })} />
          <PartyCardEditor title="Eigentümer" initialValue={item.owner} onSave={(owner) => saveParty(updateOwner, { owner })} />
          <PartyCardEditor title="Abholer" initialValue={item.collectorSameAsFinder ? item.finder : item.collector} allowClear
            footer={canEdit && <button type="button" onClick={collectorFromFinder}>Finder als Abholer übernehmen</button>}
            onSave={(collector) => saveParty(updateCollector, { collector, sameAsFinder: false })} />
        </div>
        <details style={{ ...card, marginTop: 16 }}><summary style={{ fontWeight: 700, cursor: "pointer" }}>Ermittlungsschritte ({item.investigationSteps?.length || 0})</summary>
          <InvestigationSteps itemId={item.id} steps={item.investigationSteps} onChanged={refresh} />
        </details>
      </fieldset>
    </div>
    <article className="report-detail">
      <h1>Fundbüro Horgen – Fundsachenbericht</h1><h2>{item.fundNo} – {itemLabel}</h2>
      <Row label="Verbleib" value={summary.physicalLabel} /><Row label="Gesamtvorgang" value={summary.overallLabel} />
      <Row label="Funddatum / Zeit" value={`${item.foundAt?.date || "—"} ${item.foundAt?.time || ""}`} /><Row label="Fundort" value={item.foundAt?.location} />
      <Row label="Beschreibung" value={item.item?.description} /><Row label="Finder" value={person(item.finder)} /><Row label="Finderlohnwahl" value={rewardLabel} />
      <Row label="Eigentümer" value={person(item.owner)} /><Row label="Abholer" value={person(item.collectorSameAsFinder ? item.finder : item.collector)} />
      <Row label="Bemerkungen" value={item.notes} />
      <h3>Zahlungen</h3>{Object.entries(summary.payments).map(([category, payment]) => <Row key={category}
        label={{ FEE: "Gebühren", REWARD: "Finderlohn", EXPENSES: "Auslagenersatz" }[category]}
        value={`Soll ${payment.dueCents === null ? "ungeklärt" : `CHF ${(payment.dueCents / 100).toFixed(2)}`} · eingenommen CHF ${(payment.receivedCents / 100).toFixed(2)} · ausgezahlt CHF ${(payment.paidCents / 100).toFixed(2)}`} />)}
      <h3>Gegenstände</h3><ul>{summary.workflow.parts.map((part) => <li key={part.id}>{part.label}: {part.quantity} gesamt, {part.handledQuantity} abgegeben / behandelt</li>)}</ul>
      <h3>Ermittlungsschritte</h3>{item.investigationSteps?.map((step) => <p key={step.id}>{dateTime(step.at)} · {step.who} · {step.what}</p>)}
    </article>
  </section>;
}
const card = { padding: 14, border: "1px solid #bbb", borderRadius: 8, minWidth: 0 };
const columns = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(270px, 1fr))", gap: 14 };
const printCss = `
.report-detail { display: none; }
@media print {
  @page { size: A4; margin: 12mm; }
  .app-sidebar, .app-topbar, .app-userbar { display: none !important; }
  .app-shell, .app-main, .app-content { display: block !important; padding: 0 !important; margin: 0 !important; min-height: 0 !important; }
  body:not([data-losttrack-print="workflow"]) .screen-detail { display: none !important; }
  body:not([data-losttrack-print="workflow"]) .report-detail { display: block; color: black; background: white; font: 11pt system-ui, sans-serif; }
  .report-detail h3 { break-after: avoid; }
}
`;
