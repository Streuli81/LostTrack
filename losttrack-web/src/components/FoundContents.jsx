import { useState } from "react";

export default function FoundContents({ data, onChange }) {
  const [error, setError] = useState("");
  const rows = data.contents || [];
  function update(index, patch) { onChange(rows.map((row, i) => i === index ? { ...row, ...patch } : row)); }
  return <section><h3>Inhalt / Fundbestandteile</h3>
    <p>Zum Beispiel ein Portemonnaie, Bargeld, Karten und Ausweise einzeln dokumentieren. Gefundenes Bargeld ist ein verwahrter Fundwert, keine Gemeindegebühr und kein Finderlohn. Es wird hierdurch nichts im Kassenbuch gebucht.</p>
    {error && <p role="alert">{error}</p>}
    {rows.map((row, index) => <fieldset key={row.id} style={{ marginBottom: 10 }}><legend>Bestandteil {index + 1}</legend>
      <label>Art<select value={row.kind} onChange={(e) => update(index, { kind: e.target.value, countConfirmed: false })}><option value="ITEM">Gegenstand / Karte / Ausweis</option><option value="CASH">Bargeld (CHF)</option></select></label>
      <label>Bezeichnung<input value={row.label} onChange={(e) => update(index, { label: e.target.value })} /></label>
      {row.kind === "CASH" && <><label>Bargeldbetrag (CHF)<input key={row.id} value={row.amountText ?? (row.amountCents / 100).toFixed(2)} inputMode="decimal"
        onChange={(e) => update(index, { amountText: e.target.value, amountCents: null, countConfirmed: false })} onBlur={(e) => {
        const text = e.target.value.replace(",", ".");
        if (!/^\d+(?:\.\d{1,2})?$/.test(text) || !Number.isSafeInteger(Math.round(Number(text) * 100))) return setError("Bitte einen gültigen Bargeldbetrag eingeben und das Feld verlassen.");
        setError(""); update(index, { amountCents: Math.round(Number(text) * 100), countConfirmed: false });
      }} /></label>
      <label><input type="checkbox" checked={row.countConfirmed} onChange={(e) => update(index, { countConfirmed: e.target.checked })} /> Bargeldbetrag gezählt und geprüft</label></>}
      <label>Merkmale / Inhalt<textarea value={row.details} onChange={(e) => update(index, { details: e.target.value })} /></label>
      <button type="button" onClick={() => onChange(rows.filter((_, i) => i !== index))}>Bestandteil entfernen</button>
    </fieldset>)}
    <button type="button" onClick={() => onChange([...rows, { id: crypto.randomUUID(), kind: "ITEM", label: "", details: "", currency: "CHF", amountCents: 0, countConfirmed: false }])}>Fundbestandteil hinzufügen</button>
  </section>;
}
