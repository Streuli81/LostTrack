import { useRef, useState } from "react";
import { hasPermission } from "../core/auth/auth.js";
import { createBackup, inspectBackup, restoreBackup, MAX_BACKUP_BYTES } from "../core/storage/backup.js";

function download(text) {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `LostTrack-Sicherung-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  document.body.appendChild(link);
  try { link.click(); }
  finally {
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

export default function SettingsHome() {
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [selected, setSelected] = useState(null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const selection = useRef(0);

  if (!hasPermission("BACKUP_MANAGE")) {
    return <p>Datensicherung und Wiederherstellung stehen nur ADMIN-Benutzern zur Verfügung.</p>;
  }

  function onDownload() {
    setError("");
    setMessage("");
    try {
      download(createBackup());
      setMessage("Der Download wurde angefordert. Bitte prüfen, ob die Sicherungsdatei im Downloadordner gespeichert wurde.");
    } catch (err) { setError(err.message); }
  }

  async function onSelectFile(event) {
    const request = ++selection.current;
    const file = event.target.files?.[0];
    setSelected(null);
    setConfirmed(false);
    setError("");
    setMessage("");
    if (!file) { setBusy(false); return; }
    setBusy(true);
    try {
      if (file.size > MAX_BACKUP_BYTES) throw new Error("Die Sicherungsdatei darf höchstens 25 MB groß sein.");
      const text = await file.text();
      if (request !== selection.current) return;
      const summary = inspectBackup(text);
      setSelected({ name: file.name, text, summary });
    } catch (err) {
      if (request === selection.current) setError(err.message);
    } finally {
      if (request === selection.current) setBusy(false);
    }
  }

  function onRestore() {
    setError("");
    setMessage("");
    if (!selected || !confirmed) return;
    setBusy(true);
    try {
      restoreBackup(selected.text, { confirmed });
      // Alte Ansichtsstände verwerfen und mit einem wiederhergestellten Konto anmelden.
      window.location.assign("/login?restored=1");
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 800, display: "grid", gap: 20 }}>
      <h3>Lokale Datensicherung</h3>
      <p>Die Daten liegen in diesem Browser. Git und GitHub sichern diese Daten nicht.
        Lade regelmäßig eine Sicherungsdatei herunter und bewahre sie an einem sicheren Ort auf.</p>
      <p>Die Datei enthält Fundsachen, Entwürfe, Benutzer einschließlich Passwortprüfwerten,
        Quittungsdaten, Kassenbuch, Änderungsprotokolle, Nummernzähler und angepasste Stammdaten.
        Sie ist <strong>nicht verschlüsselt</strong> und enthält Personendaten.
        Nur an berechtigte Personen weitergeben. Eine Anmeldung wird nicht mitgesichert.</p>
      {error && <p role="alert" style={{ color: "#b00020" }}>{error}</p>}
      {message && <p role="status">{message}</p>}
      <section>
        <h4>1. Aktuellen Stand sichern</h4>
        <button type="button" disabled={busy} onClick={onDownload}>Sicherungsdatei herunterladen</button>
      </section>
      <section>
        <h4>2. Sicherung wiederherstellen</h4>
        <p>Eine Wiederherstellung <strong>ersetzt den gesamten lokalen LostTrack-Datenbestand</strong> durch
          den Stand der Datei. Neuere Einträge und Änderungen gehen dabei verloren.
          Sichere deshalb zuerst den aktuellen Stand. Schließe vor der Wiederherstellung andere LostTrack-Tabs
          und -Fenster. Anschließend wirst du abgemeldet und benötigst die Zugangsdaten eines Kontos aus der Sicherung.</p>
        <label>Sicherungsdatei auswählen (.json)
          <input type="file" accept=".json,application/json" onChange={onSelectFile} />
        </label>
        {busy && !selected && <p role="status">Die Sicherungsdatei wird geprüft …</p>}
        {selected && (
          <div style={{ marginTop: 16 }}>
            <p><strong>Geprüfte Datei:</strong> {selected.name}<br />
              Erstellt am {new Date(selected.summary.createdAt).toLocaleString("de-CH")}</p>
            <table>
              <thead><tr><th>Daten in der Sicherung</th><th>Anzahl</th></tr></thead>
              <tbody>
                <tr><td>Definitive Fundsachen</td><td>{selected.summary.records}</td></tr>
                <tr><td>Entwürfe</td><td>{selected.summary.drafts}</td></tr>
                <tr><td>Benutzer</td><td>{selected.summary.users}</td></tr>
                <tr><td>Änderungsprotokolle</td><td>{selected.summary.audit}</td></tr>
                <tr><td>Kassenbucheinträge</td><td>{selected.summary.cashbook}</td></tr>
              </tbody>
            </table>
            <p>Die Struktur und die Kassenbuch-Prüfkette wurden geprüft.
              Das bestätigt weder die Herkunft der Datei noch die fachliche Richtigkeit aller Einträge.
              Verwende nur eigene oder vertrauenswürdige Sicherungen.</p>
            <label style={{ display: "flex", gap: 8, margin: "16px 0" }}>
              <input type="checkbox" checked={confirmed} disabled={busy}
                onChange={(event) => setConfirmed(event.target.checked)} />
              Ich habe eine aktuelle Sicherung aufbewahrt und möchte die lokalen Daten
              durch den angezeigten Stand ersetzen. Die Zugangsdaten aus dieser Sicherung sind mir bekannt.
            </label>
            <button type="button" disabled={!confirmed || busy} onClick={onRestore}>Daten jetzt ersetzen</button>
          </div>
        )}
      </section>
    </div>
  );
}
