import { useState } from "react";
import { Link } from "react-router-dom";
import { hasPermission } from "../core/auth/auth.js";
import { listAuditLog } from "../core/storage/lostItemRepo.js";
import AuditEntries from "../components/AuditEntries.jsx";

export default function AuditLog() {
  const [entries, setEntries] = useState(listAuditLog);
  const [query, setQuery] = useState("");
  if (!hasPermission("AUDIT_VIEW")) return <p>Das Änderungsprotokoll steht nur ADMIN-Benutzern zur Verfügung.</p>;
  const needle = query.trim().toLocaleLowerCase("de-CH");
  const visible = [...entries].filter((entry) => JSON.stringify(entry).toLocaleLowerCase("de-CH").includes(needle))
    .sort((a, b) => String(b.at || "").localeCompare(String(a.at || "")));
  return <section>
    <h3>Änderungsprotokoll (Audit)</h3>
    <p>Protokollierte Änderungen an Fundsachen und Entwürfen. Die Anzeige verändert keine Einträge.</p>
    <label>Protokoll durchsuchen <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Fundnummer, Benutzer oder Suchwort" /></label>
    <button type="button" onClick={() => setEntries(listAuditLog())}>Aktualisieren</button>
    <p role="status">{visible.length} von {entries.length} Ereignissen</p>
    {visible.map((entry, index) => {
      const id = entry.snapshot?.id || entry.snapshot?.fundId;
      return <article key={entry.id || `${entry.at}:${index}`} style={{ border: "1px solid #ccc", borderRadius: 8, padding: 10, marginBottom: 10 }}>
        <p>Fundnummer: {entry.fundNo || "Noch nicht vergeben"}
          {id && entry.fundNo && <> · <Link to={`/items/${encodeURIComponent(id)}`}>Fundsache öffnen</Link></>}</p>
        <AuditEntries entries={[entry]} />
      </article>;
    })}
    {!visible.length && <p>Keine passenden Protokolleinträge vorhanden.</p>}
    <p>Die Protokolle liegen lokal im Browser und sind gegen direkte Änderungen am Browserspeicher nicht geschützt.</p>
  </section>;
}
