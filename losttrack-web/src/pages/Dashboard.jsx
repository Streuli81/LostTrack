import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { hasPermission } from "../core/auth/auth.js";
import { listDrafts, listLostItems } from "../core/storage/lostItemRepo.js";
import { getWorkflowSummary } from "../domain/workflow.js";
import { isTransportFind, isInstitutionFind, institutionRightsChecked } from "../domain/captureContext.js";
import { DASHBOARD_HINTS, dashboardItems, dashboardCounts, filterDashboardItems } from "../domain/dashboard.js";

function dateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString("de-CH");
}
function dateOnly(value) {
  if (!value) return "Noch ungeklärt";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString("de-CH", { timeZone: "UTC" });
}
function itemLabel(record) { return record.item?.manualLabel || record.item?.predefinedKey || "Gegenstand noch nicht erfasst"; }
function workerLabel(record) {
  const worker = record.caseWorker;
  return typeof worker === "string" ? worker : worker?.name || worker?.fullName || worker?.id || "—";
}
const card = { border: "1px solid #868282", borderRadius: 10, padding: 12, minWidth: 0, background: "white" };
const recordLink = { display: "block", color: "inherit", textDecoration: "none", overflowWrap: "anywhere" };

export default function Dashboard() {
  const [data, setData] = useState(() => ({ drafts: listDrafts(), records: listLostItems() }));
  const [params, setParams] = useSearchParams();
  const selectedHint = DASHBOARD_HINTS.find((hint) => hint.code === params.get("hinweis"));
  const records = useMemo(() => dashboardItems(data.records), [data.records]);
  const counts = dashboardCounts(records);
  const visible = filterDashboardItems(records, selectedHint?.code);
  const drafts = [...data.drafts].sort((a, b) => String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || "")));
  const canDraft = hasPermission("ITEM_CREATE");
  function refresh() { setData({ drafts: listDrafts(), records: listLostItems() }); }

  return <section style={{ maxWidth: 1200 }}>
    <header style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 12 }}>
      <div><h2 style={{ marginTop: 0 }}>Übersicht</h2><p>Entwürfe weiterbearbeiten und erfasste Fundsachen öffnen.</p></div>
      <button type="button" onClick={refresh}>Aktualisieren</button>
    </header>
    <nav aria-label="Fundsachen nach Hinweisen" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10, margin: "14px 0" }}>
      {DASHBOARD_HINTS.map((hint) => <Link key={hint.code} to={"/?hinweis=" + hint.code + "#erfasste-fundsachen"}
        data-hint={hint.code} aria-current={selectedHint?.code === hint.code ? "true" : undefined}
        style={{ ...card, color: hint.color, textDecoration: "none", border: selectedHint?.code === hint.code ? "2px solid #2672cc" : card.border }}>
        <span style={{ fontWeight: 700 }}>{hint.label}</span>
        <strong style={{ display: "block", marginTop: 4, fontSize: 24 }}>{counts[hint.code]}</strong>
      </Link>)}
    </nav>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))", gap: 16, alignItems: "start" }}>
      <section style={card} aria-labelledby="drafts-heading">
        <h3 id="drafts-heading" style={{ marginTop: 0 }}>Entwürfe ({drafts.length})</h3>
        {!drafts.length && <p>Keine Entwürfe vorhanden.</p>}
        {!canDraft && drafts.length > 0 && <p>Entwürfe können von ADMIN und EDITOR weiterbearbeitet werden.</p>}
        <div style={{ display: "grid", gap: 10 }}>
          {drafts.map((draft) => {
            const content = <>
              <strong>{itemLabel(draft)}</strong>
              {draft.item?.description && <p>Merkmale: {draft.item.description}</p>}
              <p>Fundort: {draft.foundAt?.location || "—"} · Funddatum: {draft.foundAt?.date || "—"}</p>
              <p>Sachbearbeitung: {workerLabel(draft)}<br />Zuletzt geändert: {dateTime(draft.updatedAt || draft.createdAt)}</p>
              {canDraft && <span style={{ color: "#175ca7", textDecoration: "underline" }}>Entwurf weiterbearbeiten →</span>}
            </>;
            return <article key={draft.id} style={card} data-draft-id={draft.id}>
              {canDraft ? <Link to={"/entwuerfe/" + encodeURIComponent(draft.id) + "/bearbeiten"} style={recordLink}>{content}</Link> : content}
            </article>;
          })}
        </div>
      </section>
      <section id="erfasste-fundsachen" style={card} aria-labelledby="records-heading">
        <h3 id="records-heading" style={{ marginTop: 0 }}>Erfasste Fundsachen ({visible.length}{selectedHint ? " von " + records.length : ""})</h3>
        <div role="status">
          {selectedHint ? <p>Auswahl: <strong>{selectedHint.label}</strong> · <button type="button" onClick={() => setParams({})}>Alle Fundsachen anzeigen</button></p>
            : <p>Alle erfassten Fundsachen. Ein Hinweisfeld oben grenzt die Liste ein.</p>}
        </div>
        {!visible.length && <p>{selectedHint ? "Keine Fundsachen zu diesem Hinweis vorhanden." : "Noch keine Fundsachen erfasst."}</p>}
        <div style={{ display: "grid", gap: 10 }}>
          {visible.map((item) => {
            const summary = getWorkflowSummary(item);
            const hint = DASHBOARD_HINTS.find((entry) => entry.code === item._retentionStatus);
            return <article key={item.id} data-item-id={item.id} style={card}>
              <Link to={"/items/" + encodeURIComponent(item.id)} style={recordLink}>
                <strong>{item.fundNo || "Ohne Fundnummer"} – {itemLabel(item)}</strong>
                <p style={{ color: hint.color, fontWeight: 700 }}>{hint.label}</p>
                {isTransportFind(item) && <p><strong>ÖV-Fund: Zuständigkeit / Weiterleitung prüfen</strong><br />Verkehrsunternehmen: {item.origin.operator || "Noch zu klären"}</p>}
                {isInstitutionFind(item) && <p><strong>Haus-/Anstaltsfund: {item.institution?.name || "Einrichtung noch zu klären"}</strong><br />
                  Finderzuordnung: {institutionRightsChecked(item) ? "Fachlich geprüft" : "Noch zu prüfen"}</p>}
                {item.item?.description && <p>Merkmale: {item.item.description}</p>}
                <p>Fundort: {item.foundAt?.location || "—"} · Funddatum: {item.foundAt?.date || "—"}</p>
                <p>Verbleib: {summary.physicalLabel}<br />Vorgang: {summary.overallLabel}</p>
                <p>Prüfdatum Aufbewahrung: {dateOnly(item.retention?.auctionReviewDate)}<br />Prüfdatum Findererwerb: {dateOnly(item.retention?.finderAcquisitionReviewDate)}</p>
                <p>Sachbearbeitung: {workerLabel(item)}<br />Zuletzt geändert: {dateTime(item.updatedAt || item.createdAt)}</p>
                <span style={{ color: "#175ca7", textDecoration: "underline" }}>{hasPermission("ITEM_EDIT") ? "Fundsache öffnen und weiterbearbeiten →" : "Fundsache ansehen →"}</span>
              </Link>
            </article>;
          })}
        </div>
      </section>
    </div>
  </section>;
}
