import { useState } from "react";
import { updateLostItem } from "../core/storage/lostItemRepo.js";
import { expenseClaimState } from "../domain/expenseClaims.js";

const fresh = () => ({ id: "", name: "", role: "LEGAL_FINDER", basis: "FINDER_LAW", claimedCents: 0,
  approvedCents: null, reason: "", evidence: "", decisionNote: "", status: "REPORTED", settlementReceiptId: "" });
function money(value) {
  if (value === "") return null;
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(value)) throw new Error("Bitte einen gültigen CHF-Betrag eingeben.");
  const [whole, fraction = ""] = value.replace(",", ".").split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(cents)) throw new Error("Betrag zu gross.");
  return cents;
}
export default function ExpenseClaims({ item, canEdit, onChanged }) {
  const [claim, setClaim] = useState(fresh);
  const [amount, setAmount] = useState("");
  const [approved, setApproved] = useState("");
  const [error, setError] = useState("");
  const claims = item.expenseClaims || [];
  function choose(id) {
    const entry = claims.find((row) => row.id === id) || fresh();
    setClaim({ ...entry }); setAmount((entry.claimedCents / 100).toFixed(2));
    setApproved(entry.approvedCents === null ? "" : (entry.approvedCents / 100).toFixed(2)); setError("");
  }
  function save(event) {
    event.preventDefault();
    try {
      const next = { ...claim, id: claim.id || crypto.randomUUID(), claimedCents: money(amount), approvedCents: money(approved) };
      const result = updateLostItem({ ...item, expenseClaims: claim.id ? claims.map((row) => row.id === claim.id ? next : row) : [...claims, next] });
      if (!result.ok) throw new Error(result.error || Object.values(result.errors || {}).join(" · "));
      setClaim(fresh()); setAmount(""); setApproved(""); setError(""); onChanged?.();
    } catch (err) { setError(err.message); }
  }
  return <details style={{ border: "1px solid #aaa", padding: 14, borderRadius: 8 }}><summary>Auslagen anmelden, prüfen und Belege zuordnen ({claims.length})</summary>
    <p>Eine Anmeldung ist weder eine anerkannte Forderung noch eine Auszahlung. Private Auslagen der Fundperson bei Haus-/Anstalts- oder ÖV-Funden getrennt und gegebenenfalls auf anderer Anspruchsgrundlage prüfen.</p>
    {claims.map((entry) => <p key={entry.id}><strong>{entry.name}</strong> · angemeldet CHF {(entry.claimedCents / 100).toFixed(2)} · {expenseClaimState(item, entry)}<br />{entry.reason}</p>)}
    {error && <p role="alert">{error}</p>}
    {canEdit && <form onSubmit={save} style={{ display: "grid", gap: 10 }}>
      <label>Auslagenanmeldung<select aria-label="Auslagenanmeldung" value={claim.id} onChange={(e) => choose(e.target.value)}><option value="">Neue Anmeldung</option>{claims.map((entry) => <option key={entry.id} value={entry.id}>{entry.name} – {entry.reason}</option>)}</select></label>
      <label>Anspruchstellende Person / Stelle<input name="claim_name" required value={claim.name} onChange={(e) => setClaim({ ...claim, name: e.target.value })} /></label>
      <label>Rolle<select value={claim.role} onChange={(e) => setClaim({ ...claim, role: e.target.value })}>
        <option value="LEGAL_FINDER">Rechtlicher Finder / Finderstelle</option><option value="DISCOVERER">Ursprüngliche Fundperson</option><option value="OFFICE">Fundbüro</option><option value="OTHER">Andere Person / Stelle</option>
      </select></label>
      <label>Anspruchsgrundlage<select value={claim.basis} onChange={(e) => setClaim({ ...claim, basis: e.target.value })}><option value="FINDER_LAW">Finderrecht – erst nach Prüfung und Eigentümerrückgabe</option><option value="OTHER_BASIS">Andere Grundlage – gesondert zu prüfen</option></select></label>
      <label>Angemeldet (CHF)<input name="claim_amount" required value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" /></label>
      <label>Begründung<input name="claim_reason" required value={claim.reason} onChange={(e) => setClaim({ ...claim, reason: e.target.value })} /></label>
      <label>Beleg / Nachweis<input value={claim.evidence} onChange={(e) => setClaim({ ...claim, evidence: e.target.value })} /></label>
      <label>Prüfstand<select name="claim_status" value={claim.status} onChange={(e) => setClaim({ ...claim, status: e.target.value })}><option value="REPORTED">Angemeldet / ungeprüft</option><option value="APPROVED">Fachlich anerkannt</option><option value="REJECTED">Abgelehnt</option></select></label>
      <label>Anerkannt (CHF)<input name="claim_approved" value={approved} onChange={(e) => setApproved(e.target.value)} inputMode="decimal" /></label>
      <label>Dokumentierte Entscheidung<input name="claim_decision" value={claim.decisionNote} onChange={(e) => setClaim({ ...claim, decisionNote: e.target.value })} /></label>
      <label>Bereits bestätigter Auszahlungsbeleg (optional)<select name="claim_receipt" value={claim.settlementReceiptId} onChange={(e) => setClaim({ ...claim, settlementReceiptId: e.target.value })}><option value="">Noch kein Auszahlungsbeleg</option>
        {item.receipts?.filter((receipt) => receipt.confirmedAt && receipt.payments?.some((line) => line.category === "EXPENSES" && line.type === "OUT")).map((receipt) => <option key={receipt.id} value={receipt.id}>{receipt.recipient} – {receipt.id}</option>)}
      </select></label>
      <p>Die Anmeldung und ihre Anerkennung verändern keine Kassenbuchung. Eine Auszahlung erfolgt gesondert über den bestätigten Zahlungsablauf; „bezahlt“ erscheint nur nach Zuordnung eines passenden echten Belegs.</p>
      <button type="submit">Auslagenanmeldung speichern</button>
    </form>}
  </details>;
}
