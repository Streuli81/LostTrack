import { useState } from "react";
import { getCatalog, saveCatalog } from "../core/storage/catalogRepo.js";
import { hasPermission } from "../core/auth/auth.js";
import { FEE_OPTIONS } from "../domain/workflow.js";

const blankItem = (groupId) => ({ key: "", label: "", groupId, aliases: [], feeCode: "UNSET", active: true });

export default function MasterData() {
  const [catalog, setCatalog] = useState(getCatalog);
  const [groupId, setGroupId] = useState("");
  const [groupLabel, setGroupLabel] = useState("");
  const [item, setItem] = useState(() => blankItem(catalog.groups[0].id));
  const [aliases, setAliases] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  if (!hasPermission("MASTERDATA_MANAGE")) return <p>Stammdaten dürfen nur von ADMIN-Benutzern geändert werden.</p>;

  function persist(next) {
    const result = saveCatalog(next, catalog.revision);
    setError(result.ok ? "" : result.error);
    setMessage(result.ok ? "Stammdaten gespeichert. Bestehende Fundsachen und Buchungen bleiben erhalten." : "");
    if (result.ok) setCatalog(result.catalog);
    return result.ok;
  }
  function editItem(key) {
    const selected = catalog.items.find((entry) => entry.key === key) || blankItem(catalog.groups[0].id);
    setItem({ ...selected }); setAliases(selected.aliases.join("\n")); setMessage(""); setError("");
  }
  function saveGroup(event) {
    event.preventDefault();
    const group = { id: groupId || crypto.randomUUID(), label: groupLabel.trim() };
    const groups = groupId ? catalog.groups.map((row) => row.id === groupId ? group : row) : [...catalog.groups, group];
    if (persist({ ...catalog, groups })) { setGroupId(group.id); setGroupLabel(group.label); }
  }
  function saveItem(event) {
    event.preventDefault();
    const entry = { ...item, key: item.key || `custom-${crypto.randomUUID()}`, label: item.label.trim(),
      aliases: [...new Set(aliases.split(/[\n,;]/).map((word) => word.trim()).filter(Boolean))] };
    const items = item.key ? catalog.items.map((row) => row.key === item.key ? entry : row) : [...catalog.items, entry];
    if (persist({ ...catalog, items })) { setItem(entry); setAliases(entry.aliases.join("\n")); }
  }
  return <section style={{ maxWidth: 850 }}>
    <h3>Stammdaten: Gruppen und Gegenstände</h3>
    <p>Hier pflegst du Bezeichnungen, Suchwörter und die vorgeschlagene Gebühr.
      Änderungen gelten für künftige Auswahlen. Bereits erfasste Fundsachen, Gebühren und Quittungen bleiben erhalten.</p>
    <p>Diese Stammdaten werden lokal in diesem Browser gespeichert und mit der LostTrack-Sicherung gesichert.</p>
    {error && <p role="alert" style={{ color: "#b00020" }}>{error}</p>}
    {message && <p role="status">{message}</p>}
    <form onSubmit={saveGroup} style={{ display: "grid", gap: 10, marginBottom: 28 }}>
      <h4>Gruppen</h4>
      <label>Gruppe bearbeiten oder hinzufügen
        <select aria-label="Gruppe bearbeiten" value={groupId} onChange={(event) => {
          setGroupId(event.target.value); setGroupLabel(catalog.groups.find((group) => group.id === event.target.value)?.label || "");
        }}><option value="">Neue Gruppe</option>{catalog.groups.map((group) => <option key={group.id} value={group.id}>{group.label}</option>)}</select>
      </label>
      <label>Gruppenname <input name="group_label" value={groupLabel} required maxLength={200} onChange={(event) => setGroupLabel(event.target.value)} /></label>
      <button type="submit">Gruppe speichern</button>
    </form>
    <form onSubmit={saveItem} style={{ display: "grid", gap: 10 }}>
      <h4>Gegenstände</h4>
      <label>Gegenstand bearbeiten oder hinzufügen
        <select aria-label="Gegenstand bearbeiten" value={item.key} onChange={(event) => editItem(event.target.value)}>
          <option value="">Neuer Gegenstand</option>
          {catalog.items.map((entry) => <option key={entry.key} value={entry.key}>{entry.label}{entry.active ? "" : " (deaktiviert)"}</option>)}
        </select>
      </label>
      <label>Bezeichnung <input name="catalog_item_label" value={item.label} required maxLength={200} onChange={(event) => setItem({ ...item, label: event.target.value })} /></label>
      <label>Gruppe <select aria-label="Gruppe des Gegenstands" value={item.groupId} onChange={(event) => setItem({ ...item, groupId: event.target.value })}>
        {catalog.groups.map((group) => <option key={group.id} value={group.id}>{group.label}</option>)}
      </select></label>
      <label>Suchwörter (eines pro Zeile, oder mit Komma getrennt)
        <textarea name="catalog_aliases" rows={5} value={aliases} onChange={(event) => setAliases(event.target.value)} />
      </label>
      <label>Vorgeschlagene Gemeindegebühr
        <select aria-label="Gebührenvorschlag" value={item.feeCode} onChange={(event) => setItem({ ...item, feeCode: event.target.value })}>
          {FEE_OPTIONS.map((fee) => <option key={fee.code} value={fee.code}>{fee.label}</option>)}
        </select>
      </label>
      <p>Schlüssel / Schlüsselbund CHF 10.00, Mobiltelefonvermittlung CHF 20.00, übrige Fundsachen gebührenfrei.
        Die Mobiltelefongebühr gilt bei Vermittlung. Beträge sind hier nicht änderbar.</p>
      <label><input type="checkbox" checked={item.active} onChange={(event) => setItem({ ...item, active: event.target.checked })} /> In der Erfassung zur Auswahl anbieten</label>
      <p>Deaktivierte Gegenstände bleiben in bestehenden Fundsachen erhalten. Es werden keine Einträge gelöscht.</p>
      <button type="submit">Gegenstand speichern</button>
    </form>
    <details style={{ marginTop: 24 }}><summary>Änderungsprotokoll ({catalog.history.length})</summary>
      {!catalog.history.length && <p>Noch keine Stammdatenänderungen.</p>}
      {[...catalog.history].reverse().map((event) => <div key={event.revision}>
        <p>{new Date(event.at).toLocaleString("de-CH")} – {event.by}</p>
        <ul>{event.changes.map((change) => <li key={`${change.type}-${change.id}`}>
          {change.type === "group" ? "Gruppe" : "Gegenstand"}: {change.before?.label || "Neu"} → {change.after.label}
          <pre style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify({ vorher: change.before, nachher: change.after }, null, 2)}</pre>
        </li>)}</ul>
      </div>)}
    </details>
  </section>;
}
