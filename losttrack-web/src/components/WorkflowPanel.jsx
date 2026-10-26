import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { isInstitutionFind, fundReceiptRecipient, finderRecipient, finderRewardExcluded, isReferralOnly } from "../domain/captureContext.js";
import { defaultExpensePayee } from "../domain/expenseClaims.js";
import ExpenseClaims from "./ExpenseClaims.jsx";
import { hasPermission } from "../core/auth/auth.js";
import { FEE_OPTIONS, SELECTABLE_FEES, currentFeeCode, getWorkflowSummary } from "../domain/workflow.js";
import { saveWorkflowPlan, prepareWorkflowReceipt, confirmWorkflowReceipt, reprintWorkflowReceipt,
  closeWorkflow, reopenWorkflow, recordDisposition } from "../core/storage/workflowRepo.js";
import WorkflowReceiptPrint from "../print/WorkflowReceiptPrint.jsx";

const names = { FEE: "Gebühren", REWARD: "Finderlohn", EXPENSES: "Auslagenersatz" };
const kinds = [
  ["FUND", "Fundquittung"],
  ["OWNER_HANDOVER", "Herausgabe an Eigentümer"],
  ["FINDER_HANDOVER", "Herausgabe an Finder"],
];

function money(cents) {
  return cents === null || cents === undefined ? "noch ungeklärt" : `CHF ${(cents / 100).toFixed(2)}`;
}

function inputAmount(cents) { return cents === null || cents === undefined ? "" : (cents / 100).toFixed(2); }
function cents(text, blankIsNull = true) {
  const value = String(text).trim();
  if (!value) return blankIsNull ? null : 0;
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(value)) throw new Error("Bitte einen Betrag mit höchstens zwei Nachkommastellen eingeben, beispielsweise 10.00.");
  const [whole, fraction = ""] = value.replace(",", ".").split(".");
  const result = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(result)) throw new Error("Der Betrag ist zu groß.");
  return result;
}

function personName(value) { return [value?.firstName, value?.lastName].filter(Boolean).join(" ") || value?.name || ""; }

function MoneyTable({ payments, expensesRecipient }) {
  return <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse" }}>
    <thead><tr>{["Zahlungsart", "Soll gesamt", "Eingenommen", "Ausgezahlt", "Einnahme offen", "Auszahlung offen"].map((label) => <th key={label} style={cell}>{label}</th>)}</tr></thead>
    <tbody>{Object.entries(names).map(([category, label]) => {
      const payment = payments[category];
      const outRequired = category === "REWARD" || (category === "EXPENSES" && expensesRecipient !== "OFFICE");
      return <tr key={category}>
        <td style={cell}>{label}</td><td style={cell}>{money(payment.dueCents)}</td>
        <td style={cell}>{money(payment.receivedCents)}</td><td style={cell}>{money(payment.paidCents)}</td>
        <td style={cell}>{money(payment.dueCents === null ? null : payment.dueCents - payment.receivedCents)}</td>
        <td style={cell}>{outRequired ? money(payment.dueCents === null ? null : payment.dueCents - payment.paidCents) : "nicht erforderlich"}</td>
      </tr>;
    })}</tbody>
  </table></div>;
}

function PlanEditor({ item, summary, onSaved, onError, onDirty }) {
  const workflow = summary.workflow;
  const [parts, setParts] = useState(() => workflow.parts.map((part) => ({ ...part, feeCode: currentFeeCode(part.feeCode) })));
  const [reward, setReward] = useState(inputAmount(workflow.payments.REWARD.dueCents));
  const [expenses, setExpenses] = useState(inputAmount(workflow.payments.EXPENSES.dueCents));
  const [expensesRecipient, setExpensesRecipient] = useState(workflow.expensesRecipient || "UNSET");
  const [expensePayee, setExpensePayee] = useState(() => workflow.expensePayee || defaultExpensePayee(item));
  const [finderRightsReview, setFinderRightsReview] = useState(() => workflow.finderRightsReview || { confirmed: false, note: "" });
  const [blockedReason, setBlockedReason] = useState(workflow.blockedReason || "");
  const [decisionOpen, setDecisionOpen] = useState(!!workflow.decisionOpen);
  const institution = finderRewardExcluded(item);
  const waived = !institution && item.finder?.rewardChoice === "WAIVED";

  function updatePart(index, patch) {
    onDirty();
    setParts((current) => current.map((part, position) => position === index ? { ...part, ...patch } : part));
  }
  function onSubmit(event) {
    event.preventDefault();
    try {
      const result = saveWorkflowPlan({ id: item.id, parts, rewardCents: institution || waived ? 0 : cents(reward),
        expensesCents: cents(expenses), expensesRecipient, ...(item.regime ? { expensePayee, finderRightsReview } : {}), blockedReason, decisionOpen });
      if (!result.ok) throw new Error(result.error || "Der Ablaufplan konnte nicht gespeichert werden.");
      onSaved("Gegenstände und Zahlungspositionen wurden gespeichert.");
    } catch (error) { onError(error.message); }
  }
  return <details style={card} open={!item.workflow}>
    <summary style={{ cursor: "pointer", fontWeight: 700 }}>Gegenstände, Gebühren und offene Aufgaben festlegen</summary>
    <form onSubmit={onSubmit} style={stack}>
      <p>Ein Schlüssel oder ganzer Schlüsselbund kostet CHF 10.00. Die tatsächliche Vermittlung eines Mobiltelefons kostet CHF 20.00 pro Telefon. Andere Fundsachen sind gebührenfrei. Bitte den passenden Fall bewusst auswählen.</p>
      <div style={{ overflowX: "auto" }}><table style={{ width: "100%" }}>
        <thead><tr><th style={cell}>Gegenstand</th><th style={cell}>Gebührenauswahl</th><th style={cell}>Aktion</th></tr></thead>
        <tbody>{parts.map((part, index) => <tr key={part.id}>
          <td style={cell}><input aria-label={`Gegenstand ${index + 1}`} value={part.label}
            onChange={(event) => updatePart(index, { label: event.target.value })} required style={input} />
            {part.quantity > 1 && <small>Bisher gespeicherter Bestand: {part.quantity}; bereits abgegeben: {part.handledQuantity || 0}. Diese Mengen bleiben erhalten.</small>}</td>
          <td style={cell}><select aria-label={`Gebühr für Gegenstand ${index + 1}`} value={part.feeCode}
            onChange={(event) => updatePart(index, { feeCode: event.target.value })} style={input}>
            {SELECTABLE_FEES.map((option) => <option key={option.code} value={option.code}>{option.label}</option>)}
          </select></td>
          <td style={cell}><button type="button" disabled={!!part.handledQuantity || parts.length === 1}
            onClick={() => { onDirty(); setParts((current) => current.filter((entry) => entry.id !== part.id)); }}>Entfernen</button></td>
        </tr>)}</tbody>
      </table></div>
      <div><button type="button" disabled={parts.length >= 100} onClick={() => { onDirty(); setParts((current) => [...current,
        { id: crypto.randomUUID(), label: "", quantity: 1, handledQuantity: 0, feeCode: "UNSET" }]); }}>Weiteren Gegenstand hinzufügen</button></div>
      <div style={columns}>
        <label style={field}>Finderlohn gesamt (CHF)
          <input value={institution || waived ? "0.00" : reward} disabled={institution || waived} onChange={(event) => { onDirty(); setReward(event.target.value); }} inputMode="decimal" placeholder="Leer = noch ungeklärt" style={input} />
          {institution && <span>Finderlohn bei Haus-/Anstaltsfund gesperrt; kein persönlicher Verzicht. Historische Buchungen bleiben unverändert und müssen bei Abweichungen geklärt werden.</span>}
          {waived && <span>Ausdrücklicher Finderlohnverzicht liegt vor.</span>}
        </label>
        <label style={field}>Auslagenersatz gesamt (CHF)
          <input value={expenses} onChange={(event) => { onDirty(); setExpenses(event.target.value); }} inputMode="decimal" placeholder="Leer = noch ungeklärt" style={input} />
        </label>
        <label style={field}>An wen geht der Auslagenersatz?
          <select value={expensesRecipient} onChange={(event) => { onDirty(); setExpensesRecipient(event.target.value); }} style={input}>
            <option value="UNSET">Noch ungeklärt / bei CHF 0 nicht erforderlich</option>
            <option value="FINDER">{institution ? "Geprüfte Finderstelle / andere berechtigte Person" : "Finder / andere berechtigte Person"}</option>
            <option value="OFFICE">Fundbüro – Kosten bereits ausgelegt</option>
          </select>
        </label>
      </div>
      {item.regime && <fieldset style={card}><legend>Auslagen: tatsächlicher Anspruchsteller und Freigabe</legend>
        <label style={field}>Person / Stelle<input name="expense_payee_name" value={expensePayee.name} onChange={(e) => { onDirty(); setExpensePayee({ ...expensePayee, name: e.target.value, confirmed: false }); }} /></label>
        <label style={field}>Anspruchsteller-Rolle<select value={expensePayee.role} onChange={(e) => { onDirty(); setExpensePayee({ ...expensePayee, role: e.target.value, confirmed: false }); }}>
          <option value="LEGAL_FINDER">Rechtlicher Finder / Finderstelle</option><option value="DISCOVERER">Ursprüngliche Fundperson</option><option value="OFFICE">Fundbüro</option><option value="OTHER">Andere berechtigte Person / Stelle</option>
        </select></label>
        <label style={field}>Grundlage<select value={expensePayee.basis} onChange={(e) => { onDirty(); setExpensePayee({ ...expensePayee, basis: e.target.value, confirmed: false }); }}><option value="FINDER_LAW">Finderrecht – Rückgabe an Eigentümer erforderlich</option><option value="OTHER_BASIS">Andere Grundlage – gesonderte dokumentierte Entscheidung</option></select></label>
        <label style={field}>Begründete Freigabe<input name="expense_payee_note" value={expensePayee.note} onChange={(e) => { onDirty(); setExpensePayee({ ...expensePayee, note: e.target.value }); }} /></label>
        <label><input type="checkbox" checked={expensePayee.confirmed} onChange={(e) => { onDirty(); setExpensePayee({ ...expensePayee, confirmed: e.target.checked }); }} /> Anspruchsteller und anerkannte Auslagen fachlich geprüft</label>
        <p>Bei positiven Auslagen mit Auszahlung sind Person, Grundlage und Freigabe erforderlich. Eine Anmeldung oder ein Fristablauf löst keine Zahlung aus. Private Kosten eines Entdeckers bei Haus-/Anstalts- oder ÖV-Funden sind kein automatischer Anspruch aus Finderrecht.</p>
      </fieldset>}
      <p>Wenn keine Auslagen anfallen, ausdrücklich 0.00 eintragen. Leer bedeutet „noch ungeklärt“ und verhindert den Gesamtabschluss. Ein Finderlohnverzicht ist kein Verzicht auf Auslagenersatz.</p>
      <label style={field}>Herausgabesperre – Begründung (leer = keine Sperre)
        <input value={blockedReason} onChange={(event) => { onDirty(); setBlockedReason(event.target.value); }} style={input} />
      </label>
      {item.regime && <fieldset style={card}><legend>Gesonderte Finder-/Eigentumsanspruchsprüfung</legend>
        <p>Nur für eine tatsächliche Herausgabe an den rechtlichen Finder. Dies ist keine Finderlohnzahlung und keine automatische Freigabe nach einem oder fünf Jahren. Voraussetzungen und allfällige frühere Verwertung gesondert prüfen.</p>
        <label style={field}>Dokumentierte Entscheidung<input value={finderRightsReview.note} onChange={(e) => { onDirty(); setFinderRightsReview({ confirmed: false, note: e.target.value }); }} /></label>
        <label><input type="checkbox" checked={finderRightsReview.confirmed} onChange={(e) => { onDirty(); setFinderRightsReview({ ...finderRightsReview, confirmed: e.target.checked }); }} /> Zuständige Stelle hat den konkreten Anspruch / die Herausgabe geprüft und freigegeben</label>
      </fieldset>}
      <label><input type="checkbox" checked={decisionOpen} onChange={(event) => { onDirty(); setDecisionOpen(event.target.checked); }} /> Eine fachliche Entscheidung ist noch offen</label>
      <div><button type="submit">Plan speichern</button></div>
    </form>
  </details>;
}

function ReceiptComposer({ item, summary, onPrepare, onError }) {
  const [kind, setKind] = useState("FUND");
  const [recipient, setRecipient] = useState(fundReceiptRecipient(item));
  const [selected, setSelected] = useState(() => Object.fromEntries(summary.remainingParts.map((part) => [part.id, true])));
  const [paymentOnly, setPaymentOnly] = useState(false);
  const [amounts, setAmounts] = useState({});
  const [reason, setReason] = useState("");
  const handling = kind !== "FUND" && !paymentOnly;
  const paymentInputs = [
    ["FEE", "IN", "Gebühren – Einnahme heute"],
    ["REWARD", "IN", "Finderlohn – Einzahlung heute"], ["REWARD", "OUT", "Finderlohn – Auszahlung heute"],
    ["EXPENSES", "IN", "Auslagenersatz – Einnahme heute"], ["EXPENSES", "OUT", "Auslagenersatz – Auszahlung heute"],
  ].filter(([category, type]) => (!finderRewardExcluded(item) || category !== "REWARD") && (kind !== "OWNER_HANDOVER" || type !== "OUT"));

  function changeKind(value) {
    setKind(value);
    setPaymentOnly(false);
    setAmounts({});
    setRecipient(value === "FUND" ? fundReceiptRecipient(item) : value === "FINDER_HANDOVER"
      ? finderRecipient(item)
      : personName(item.owner) || personName(item.collector));
  }
  function onSubmit(event) {
    event.preventDefault();
    try {
      const parts = handling ? summary.remainingParts.filter((part) => selected[part.id])
        .map((part) => ({ partId: part.id, quantity: part.remainingQuantity })) : [];
      const payments = kind === "FUND" ? [] : paymentInputs.map(([category, type]) => ({
        category, type, amountCents: cents(amounts[`${category}:${type}`] || "", false),
      })).filter((payment) => payment.amountCents > 0);
      onPrepare({ id: item.id, kind: paymentOnly ? "PAYMENT" : kind,
        ...(paymentOnly ? { documentKind: kind } : {}), recipient, parts, payments, reason });
    } catch (error) { onError(error.message); }
  }

  return <section style={card}>
    <h4 style={{ marginTop: 0 }}>Schreiben vorbereiten und drucken</h4>
    <p>Die folgenden Aktionen verwenden den gespeicherten Plan. Vor dem Druck werden noch keine Gegenstände als übergeben markiert und keine Zahlungen gebucht.</p>
    <form onSubmit={onSubmit} style={stack}>
      <label style={field}>Schreiben<select value={kind} onChange={(event) => changeKind(event.target.value)} style={input}>
        {kinds.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select></label>
      {isInstitutionFind(item) && kind === "FINDER_HANDOVER" && <p>Bei diesem Haus-/Anstaltsfund ist die fachlich geprüfte Finderstelle gemeint. Die ursprüngliche Fundperson ist nicht automatisch Empfängerin. Eine Vertretungsberechtigung muss fachlich geprüft sein.</p>}
      {kind !== "FUND" && <label><input type="checkbox" checked={paymentOnly} onChange={(event) => setPaymentOnly(event.target.checked)} /> Nur Zahlung zu diesem Schreiben, keine weitere Gegenstandsübergabe</label>}
      <label style={field}>Empfänger / zahlende oder empfangende Person
        <input value={recipient} onChange={(event) => setRecipient(event.target.value)} required style={input} />
      </label>
      {handling && <fieldset style={card}><legend>Welche Gegenstände werden jetzt abgegeben?</legend>
        {summary.remainingParts.length ? summary.remainingParts.map((part) => <label key={part.id} style={{ ...field, marginBottom: 10 }}>
          {part.label} – noch vorhanden: {part.remainingQuantity}
          <input type="checkbox" checked={!!selected[part.id]}
            onChange={(event) => setSelected((current) => ({ ...current, [part.id]: event.target.checked }))} /> Diesen Gegenstand übergeben
        </label>) : <p>Es sind keine Gegenstände mehr beim Fundbüro vorhanden.</p>}
      </fieldset>}
      {kind !== "FUND" && <fieldset style={card}><legend>Tatsächlich in diesem Vorgang zu bestätigende Zahlungen</legend>
          <div style={columns}>{paymentInputs.map(([category, type, label]) => <label key={`${category}:${type}`} style={field}>{label} (CHF)
            <input value={amounts[`${category}:${type}`] || ""} inputMode="decimal" placeholder="Leer = keine Buchung"
              disabled={category === "EXPENSES" && type === "OUT" && summary.workflow.expensesRecipient === "OFFICE"}
              onChange={(event) => setAmounts((current) => ({ ...current, [`${category}:${type}`]: event.target.value }))} style={input} />
          </label>)}</div>
          <p>Teilzahlungen sind möglich. Gebühr, Finderlohn und Auslagenersatz bleiben getrennt. Die Zahlungen auf dieser Quittung betreffen die oben genannte Person; für verschiedene Personen getrennte Quittungen erstellen. Bei einer reinen Zahlung findet keine Gegenstandsübergabe statt.</p>
        </fieldset>}
      <label style={field}>Bemerkung / Grund
        <textarea value={reason} onChange={(event) => setReason(event.target.value)} style={input} />
      </label>
      <div><button type="submit">Quittung vorbereiten und drucken</button></div>
    </form>
  </section>;
}

function DispositionEditor({ item, summary, onSaved, onError }) {
  const [selected, setSelected] = useState({});
  const [reason, setReason] = useState("");
  const [proceeds, setProceeds] = useState("");
  function submit(event) {
    event.preventDefault();
    const parts = summary.remainingParts.filter((part) => selected[part.id])
      .map((part) => ({ partId: part.id, quantity: part.remainingQuantity }));
    let proceedsCents;
    try { proceedsCents = cents(proceeds); } catch (error) { return onError(error.message); }
    const result = recordDisposition({ id: item.id, parts, dispositionStatus: "DISPOSED", reason,
      ...(proceedsCents !== null ? { proceedsCents } : {}) });
    if (!result.ok) return onError(result.error || "Die Verwertung konnte nicht gespeichert werden.");
    onSaved("Die dokumentierte Verwertung wurde gespeichert. Offene Zahlungen bleiben sichtbar.");
  }
  return <details style={card}><summary>Verwertung dokumentieren (kein Schreiben)</summary>
    <p>Nur eine bereits fachlich freigegebene Verwertung dokumentieren. Ein Fristablauf ist keine automatische Freigabe.</p>
    <form onSubmit={submit} style={stack}>
      {summary.remainingParts.map((part) => <label key={part.id}><input type="checkbox" checked={!!selected[part.id]}
        onChange={(event) => setSelected({ ...selected, [part.id]: event.target.checked })} /> {part.label}</label>)}
      <label style={field}>Dokumentierte Freigabe und Grund<textarea required value={reason} onChange={(event) => setReason(event.target.value)} style={input} /></label>
      <label style={field}>Tatsächlicher Verwertungserlös (CHF, falls vorhanden)<input value={proceeds} onChange={(e) => setProceeds(e.target.value)} inputMode="decimal" /></label>
      <p>Ein Erlös wird als gesonderter Fundwert dokumentiert. Keine automatische Gebühreneinnahme, Auszahlung oder Beendigung von Finderrechten.</p>
      <button type="submit">Freigegebene Verwertung dokumentieren</button>
    </form>
  </details>;
}

export default function WorkflowPanel({ item, onChanged }) {
  const summary = getWorkflowSummary(item);
  const canEdit = hasPermission("ITEM_EDIT");
  const canPrint = hasPermission("RECEIPT_PRINT");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [job, setJob] = useState(null);
  const [printPhase, setPrintPhase] = useState("idle");
  const [reopenReason, setReopenReason] = useState("");
  const [planDirty, setPlanDirty] = useState(false);
  const [planReset, setPlanReset] = useState(0);
  const startedJob = useRef(null);
  const confirming = useRef(false);
  const closed = !!summary.workflow.closedAt;
  const formKey = `${item.id}:${item.updatedAt}:${JSON.stringify(item.workflow || null)}`;

  function saved(text) { setError(""); setMessage(text); setPlanDirty(false); onChanged?.(); }
  function failed(text) { setMessage(""); setError(text); }

  useEffect(() => {
    if (!job) return undefined;
    const timer = window.setTimeout(() => {
      if (startedJob.current === job.id) return;
      startedJob.current = job.id;
      document.body.dataset.losttrackPrint = "workflow";
      setPrintPhase("printing");
      try {
        window.print();
        setPrintPhase("awaiting");
      } catch {
        delete document.body.dataset.losttrackPrint;
        setPrintPhase("failed");
        setError("Der Druckdialog konnte nicht geöffnet werden. Es wurde nichts bestätigt oder gebucht.");
      }
    }, 120);
    return () => {
      window.clearTimeout(timer);
      delete document.body.dataset.losttrackPrint;
    };
  }, [job]);

  function prepare(params) {
    if (planDirty) return failed("Bitte zuerst die Änderungen an Gegenständen und Zahlungspositionen speichern oder verwerfen.");
    setError(""); setMessage("");
    const result = prepareWorkflowReceipt(params);
    if (!result.ok) return failed(result.error || "Die Quittung konnte nicht vorbereitet werden.");
    startedJob.current = null;
    setPrintPhase("printing");
    setJob(result.job);
  }
  function cancelPrint() {
    setJob(null); setPrintPhase("idle");
    delete document.body.dataset.losttrackPrint;
    setMessage("Der Druckvorgang wurde beendet. Es wurde keine neue Herausgabe oder Zahlung bestätigt.");
    onChanged?.();
  }
  function confirmPrint() {
    if (!job || job.reprint || confirming.current) return;
    confirming.current = true;
    try {
      const result = confirmWorkflowReceipt({ job, confirmed: true });
      if (!result.ok) return failed(result.error || "Die Bestätigung ist fehlgeschlagen. Bitte Daten aktualisieren und den Druck erneut vorbereiten.");
      setJob(null); setPrintPhase("idle");
      delete document.body.dataset.losttrackPrint;
      saved("Quittung, tatsächliche Übergabe und angegebene Zahlungen wurden bestätigt. Der Gesamtabschluss wird gesondert geprüft.");
    } finally { confirming.current = false; }
  }
  function reprint(receiptId) {
    const result = reprintWorkflowReceipt({ id: item.id, receiptId });
    if (!result.ok) return failed(result.error || "Diese Quittung kann nicht nachgedruckt werden.");
    setError(""); setMessage(""); startedJob.current = null;
    setPrintPhase("printing"); setJob({ ...result.job, reprint: true });
  }
  function finish() {
    const result = closeWorkflow({ id: item.id });
    if (!result.ok) return failed(result.error || "Der Vorgang kann noch nicht abgeschlossen werden.");
    saved("Der Vorgang ist vollständig abgeschlossen.");
  }
  function reopen(event) {
    event.preventDefault();
    const result = reopenWorkflow({ id: item.id, reason: reopenReason });
    if (!result.ok) return failed(result.error || "Der Vorgang konnte nicht wieder geöffnet werden.");
    setReopenReason(""); saved("Der Vorgang wurde mit Begründung wieder geöffnet.");
  }

  const handoverJob = job && ["OWNER_HANDOVER", "FINDER_HANDOVER", "TRANSFER"].includes(job.kind);
  return <section style={stack} className="workflow-panel">
    <style>{printStyles}</style>
    <div style={card}>
      <h3 style={{ marginTop: 0 }}>Ablauf und Zahlungen</h3>
      <p><strong>Verbleib:</strong> {summary.physicalLabel}<br /><strong>Gesamtvorgang:</strong> {summary.overallLabel}</p>
      <h4>Gegenstände und Bestand</h4>
      <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead><tr>{["Gegenstand", "Gesamt", "Abgegeben / behandelt", "Noch vorhanden", "Gebührenauswahl"].map((label) => <th key={label} style={cell}>{label}</th>)}</tr></thead>
        <tbody>{summary.workflow.parts.map((part) => <tr key={part.id}>
          <td style={cell}>{part.label}</td><td style={cell}>{part.quantity}</td><td style={cell}>{part.handledQuantity}</td>
          <td style={cell}>{part.quantity - part.handledQuantity}</td><td style={cell}>{part.feeSnapshot?.label || FEE_OPTIONS.find((option) => option.code === part.feeCode)?.label || "Noch ungeklärt"}</td>
        </tr>)}</tbody>
      </table></div>
      <h4>Gebühren, Finderlohn und Auslagenersatz</h4>
      <MoneyTable payments={summary.payments} expensesRecipient={summary.workflow.expensesRecipient} />
      {summary.workflow.disposalProceedsCents > 0 && <p><strong>Gesonderter Verwertungserlös: {money(summary.workflow.disposalProceedsCents)}</strong><br />
        Als Fundwert dokumentiert, nicht automatisch als Gebühreneinnahme gebucht oder an Finder ausgezahlt. Die weitere Abwicklung ist offen.</p>}
      {!!summary.blockers.length && <div><h4>Noch zu erledigen</h4><ul>{summary.blockers.map((reason, index) => <li key={`${index}:${reason}`}>{reason}</li>)}</ul></div>}
      {!summary.blockers.length && !closed && <p>Alle Voraussetzungen sind erfüllt. Der Vorgang kann abgeschlossen werden.</p>}
      {error && <p role="alert" style={{ color: "#b00020" }}>{error}</p>}
      {message && <p role="status">{message}</p>}
      {canEdit && !closed && <button type="button" disabled={!summary.canClose || !!job || planDirty} onClick={finish}>Vorgang vollständig abschließen</button>}
      {canEdit && closed && <form onSubmit={reopen} style={{ ...field, maxWidth: 600 }}>
        <label style={field}>Begründung für die Wiederöffnung<input required value={reopenReason} onChange={(event) => setReopenReason(event.target.value)} style={input} /></label>
        <button type="submit">Vorgang wieder öffnen</button>
      </form>}
    </div>
    {canEdit && !closed && !job && <PlanEditor key={`plan:${formKey}:${planReset}`} item={item} summary={summary} onSaved={saved} onError={failed} onDirty={() => setPlanDirty(true)} />}
    {planDirty && <p role="status">Der Plan enthält ungespeicherte Änderungen. Bitte vor einer Quittung speichern.
      {" "}<button type="button" onClick={() => { setPlanDirty(false); setPlanReset((value) => value + 1); }}>Planänderungen verwerfen</button></p>}
    {canEdit && canPrint && !closed && !job && !planDirty && <ReceiptComposer key={`receipt:${formKey}`} item={item} summary={summary} onPrepare={prepare} onError={failed} />}
    <ExpenseClaims key={`claims:${formKey}`} item={item} canEdit={canEdit && !closed && !job && !planDirty && !isReferralOnly(item)} onChanged={onChanged} />
    {canEdit && !isReferralOnly(item) && !closed && !job && !planDirty && summary.remainingParts.length > 0 && <DispositionEditor key={`disposition:${formKey}`} item={item} summary={summary} onSaved={saved} onError={failed} />}
    <details style={card}><summary style={{ cursor: "pointer", fontWeight: 700 }}>Bestätigte Übergaben und Verwertungen ({summary.workflow.movements.length})</summary>
      {summary.workflow.movements.length ? <ul>{summary.workflow.movements.map((movement) => <li key={movement.id} style={{ margin: "10px 0" }}>
        {kinds.find(([value]) => value === movement.kind)?.[1] || (movement.kind === "DISPOSITION" ? "Dokumentierte Verwertung" : "Dokumentierter Verbleib")}
        {" · "}{new Date(movement.confirmedAt).toLocaleString("de-CH")}{movement.recipient ? ` · ${movement.recipient}` : ""}
        {movement.actor ? ` · ${movement.actor}` : ""}
        <ul>{movement.parts?.map((part) => <li key={part.partId}>{part.label || "Gegenstand"}: {part.quantity}</li>)}</ul>
        {movement.reason && <p>Grund / Entscheidungsgrundlage: {movement.reason}</p>}
      </li>)}</ul> : <p>Für ältere Datensätze kann der bisherige Verbleib übernommen sein, ohne dass bereits eine neue Übergabebestätigung vorliegt. Der bisherige Änderungsverlauf bleibt erhalten.</p>}
    </details>
    <details style={card}><summary style={{ cursor: "pointer", fontWeight: 700 }}>Quittungen ({item.receipts?.length || 0})</summary>
      {item.receipts?.length ? <ul>{item.receipts.map((receipt) => <li key={receipt.id} style={{ margin: "10px 0", overflowWrap: "anywhere" }}>
        {receipt.id} · {receipt.recipient || "—"} · {receipt.printedAt ? new Date(receipt.printedAt).toLocaleString("de-CH") : "—"}{" "}
        {!receipt.confirmedAt && <strong>Altbeleg ohne nachträgliche Druck- oder Übergabebestätigung. </strong>}
        {canPrint && receipt.itemSnapshot && <button type="button" disabled={!!job} onClick={() => reprint(receipt.id)}>Nachdrucken</button>}
        {!receipt.itemSnapshot && <span>Alte Quittungsdaten ohne gespeicherte Druckfassung; im Bericht enthalten.</span>}
      </li>)}</ul> : <p>Noch keine bestätigte Quittung vorhanden.</p>}
    </details>
    {job && <div role="dialog" aria-modal="true" aria-labelledby="workflow-print-question" style={overlay}>
      <div style={{ ...card, background: "var(--panel, white)", maxWidth: 720, width: "100%", maxHeight: "90vh", overflowY: "auto" }}>
        <h3 id="workflow-print-question">{job.reprint ? "Nachdruck" : "Druck und tatsächlichen Vorgang bestätigen"}</h3>
        <p>Quittung {job.receipt.id}</p>
        {job.reprint ? <p>Dies ist ein Nachdruck. Es werden keine weiteren Übergaben oder Zahlungen gespeichert.</p>
          : <>
            <p>{handoverJob ? "Wurde die Quittung erfolgreich gedruckt und wurden die aufgeführten Gegenstände persönlich übergeben?"
              : job.kind === "PAYMENT" ? "Wurde die Quittung erfolgreich gedruckt und wurden die aufgeführten Zahlungen tatsächlich ausgeführt?"
                : "Wurde die Fundquittung erfolgreich gedruckt und wurde die Annahme tatsächlich bestätigt?"}</p>
            <p>Bei Druckabbruch, fehlender Übergabe oder fehlender Zahlung bitte nicht bestätigen. Ohne Bestätigung bleibt der Vorgang unverändert.</p>
          </>}
        {error && <p role="alert" style={{ color: "#b00020" }}>{error}</p>}
        {printPhase === "printing" && <p>Der Druckdialog wird geöffnet. Nach dem Schließen kannst du hier antworten.</p>}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {!job.reprint && <button type="button" disabled={printPhase !== "awaiting"} onClick={confirmPrint}>Ja, gedruckt und Vorgang tatsächlich erfolgt</button>}
          <button type="button" onClick={cancelPrint}>{job.reprint ? "Nachdruck schließen" : "Abgebrochen / nicht erfolgt"}</button>
          {printPhase !== "printing" && <button type="button" onClick={() => {
            startedJob.current = null; setPrintPhase("printing"); setJob({ ...job });
          }}>Druck erneut versuchen</button>}
        </div>
      </div>
    </div>}
    {job && createPortal(<div id="workflow-receipt-print"><WorkflowReceiptPrint job={job} /></div>, document.body)}
  </section>;
}

const input = { padding: "8px", border: "1px solid #aaa", borderRadius: 6, width: "100%", boxSizing: "border-box" };
const field = { display: "grid", gap: 6 };
const stack = { display: "grid", gap: 14 };
const columns = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 12 };
const card = { border: "1px solid #bbb", borderRadius: 8, padding: 14, minWidth: 0 };
const cell = { textAlign: "left", padding: "8px 6px", borderBottom: "1px solid #ddd", verticalAlign: "top" };
const overlay = { position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 1000 };
const printStyles = `
#workflow-receipt-print { display: none; }
@media print {
  @page { size: A4; margin: 12mm; }
  html, body[data-losttrack-print="workflow"] { height: auto !important; min-height: 0 !important; }
  body[data-losttrack-print="workflow"] > * { display: none !important; }
  body[data-losttrack-print="workflow"] > #workflow-receipt-print { display: block !important; position: static; width: auto; margin: 0; padding: 0; background: white; color: black; }
  .workflow-receipt-sheet { color: black; background: white; padding: 0; font-family: system-ui, sans-serif; font-size: 10pt; overflow-wrap: anywhere; }
  .workflow-receipt-sheet p { margin: 8px 0; }
  .workflow-receipt-sheet h3 { margin: 12px 0 6px; }
  .workflow-receipt-sheet tr { break-inside: avoid; }
}
`;
