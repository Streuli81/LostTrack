import { FIND_ENVIRONMENTS, FUND_REGIMES, isReferralOnly, isTransportFind, isInstitutionFind, hasSpecialJurisdiction } from "../domain/captureContext.js";

const input = { width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #aaa", boxSizing: "border-box" };
const grid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, marginBottom: 16 };

export default function CaptureContextFields({ data, setField, errors, normalizeDate, normalizeTime, onSeparateDates }) {
  const transport = isTransportFind(data);
  const automatic = data.retention?.custodyBasis === "NOTICE_USER_POLICY";
  function field(label, path, { readOnly = false, date = false, time = false, name, value, placeholder } = {}) {
    const content = value ?? path.split(".").reduce((object, key) => object?.[key], data) ?? "";
    return <label style={{ display: "grid", gap: 6 }}>{label}
      <input type="text" name={name || path.replaceAll(".", "_")} value={content} readOnly={readOnly}
        onChange={readOnly ? undefined : (event) => setField(path, event.target.value)}
        onBlur={readOnly ? undefined : (event) => {
          if (date || time) setField(path, (date ? normalizeDate : normalizeTime)(event.target.value) || event.target.value);
        }} placeholder={placeholder || (date ? "TT.MM.JJJJ" : time ? "HH.MM" : "")}
        style={{ ...input, ...(readOnly ? { background: "#eee", color: "#333" } : {}) }} />
      {errors?.[path] && <span role="alert" style={{ color: "#b00020" }}>{errors[path]}</span>}
    </label>;
  }
  return <>
    <h3>Fundart / Fundregime</h3>
    <label style={{ display: "grid", gap: 6 }}>Rechtliche Einordnung (bewusst auswählen)
      <select name="regime_type" value={data.regime?.type || ""} onChange={(event) => setField("regime.type", event.target.value)} style={input}>
        <option value="">Bitte auswählen (Altbestand: bisherige Einordnung bleibt erhalten)</option>
        {FUND_REGIMES.map(([code, label]) => <option key={code} value={code}>{label}</option>)}
      </select>
      {errors?.["regime.type"] && <span role="alert">{errors["regime.type"]}</span>}
    </label>
    {isReferralOnly(data) && <p role="status"><strong>Sonderfall: nur dokumentieren und zuständige Stelle klären.</strong> Keine normale Herausgabe, Fristberechnung, Auszahlung oder Verwertung. Die Auswahl löst keinen Transport aus.</p>}
    <h3>Sachbearbeitung und Zeitpunkte</h3>
    <div style={grid}>
      {field("Sachbearbeitung (angemeldete Person)", "caseWorker.name", { readOnly: true, name: "caseworker_name" })}
      {field("Erfassungsdatum / -zeit (automatisch)", "capturedAt", { readOnly: true,
        value: new Date(data.capturedAt || data.createdAt).toLocaleString("de-CH", { timeZone: "Europe/Zurich" }) })}
      {field("Funddatum", "foundAt.date", { date: true, name: "found_date" })}
      {field("Fundzeit", "foundAt.time", { time: true, name: "found_time" })}
      {field("Anzeige bei Polizei – Datum", "retention.reportedDate", { date: true })}
      {field("Anzeige bei Polizei – Zeit (falls bekannt)", "retention.reportedTime", { time: true })}
      {field("Bekanntmachungsdatum", "retention.noticeDate", { date: true })}
      {field("Bekanntmachungszeit", "retention.noticeTime", { time: true })}
      {field("Eingang Fundbüro – Datum", "retention.receivedDate", { date: true })}
      {field("Eingang Fundbüro – Zeit (falls bekannt)", "retention.receivedTime", { time: true })}
      {field("Beginn Aufbewahrung – Datum" + (automatic ? " (automatisch)" : " (Altbestand)"), "retention.custodyStartDate", { date: true, readOnly: automatic })}
      {field("Beginn Aufbewahrung – Zeit" + (automatic ? " (automatisch)" : " (Altbestand)"), "retention.custodyStartTime", { time: true, readOnly: automatic })}
    </div>
    {data.retention?.dateModel === "SEPARATE" && <label style={{ display: "grid", gap: 6 }}>Grundlage der gesonderten Finderfrist
      <select name="retention_finderBasis" value={data.retention.finderBasis || ""} onChange={(event) => setField("retention.finderBasis", event.target.value)} style={input}>
        <option value="">Noch nicht festgelegt – keine Finderfrist berechnen</option><option value="REPORT">Anzeige bei Polizei</option><option value="PUBLICATION">Bekanntmachung</option>
      </select>{errors?.["retention.finderBasis"] && <span role="alert">{errors["retention.finderBasis"]}</span>}
    </label>}
    <p>Fund, Anzeige, Bekanntmachung, Eingang und tatsächlicher Aufbewahrungsbeginn sind getrennte Ereignisse. Unbekannte Angaben leer lassen. Eine Prüfgrenze ist keine Herausgabe-, Eigentums- oder Verwertungsfreigabe.</p>
    {data.retention?.dateModel !== "SEPARATE" && <p>{automatic ? "Dieser ältere Eintrag verwendet noch die frühere Kopplung an die Bekanntmachung." : "Dieser Eintrag verwendet noch das frühere Datumsmodell."}
      <button type="button" onClick={onSeparateDates}>Getrennte Zeitpunkte aktivieren, bisherige Angaben zuordnen</button></p>}
    {data.captureVersion !== 1 && <p>Bei diesem älteren Eintrag bleiben die bisherigen Sachbearbeitungs- und Aufbewahrungsangaben erhalten. Eine bestehende Anzeige wird nicht automatisch in eine Bekanntmachung umgedeutet.</p>}
    <h3>Fundumgebung / Fundart</h3>
    <label style={{ display: "grid", gap: 6, marginBottom: 14 }}>Fundumgebung auswählen
      <select name="origin_type" value={data.origin?.type || ""} onChange={(event) => setField("origin.type", event.target.value)} style={input}>
        <option value="">Bitte auswählen</option>{FIND_ENVIRONMENTS.map(([code, label]) => <option key={code} value={code}>{label}</option>)}
      </select>
      {errors?.["origin.type"] && <span role="alert">{errors["origin.type"]}</span>}
    </label>
    {transport && <section style={{ border: "1px solid #d39b22", borderRadius: 8, padding: 12, marginBottom: 16 }}>
      <strong>ÖV-Fundsache – Zuständigkeit des Verkehrsunternehmens prüfen</strong>
      <p>Zur persönlichen Weiterleitung an das zuständige Unternehmen erfassen. Keine automatische Zuordnung an die VBZ und keine normale Horgner Aufbewahrungs- oder Verwertungsfrist.</p>
      <div style={grid}>
        {field("Verkehrsunternehmen", "origin.operator", { placeholder: "Zum Beispiel PostAuto oder AHW Busbetriebe" })}
        {field("Linie / Kurs", "origin.line")}
        {field("Haltestelle / Strecke", "origin.route")}
        {field("Fahrtrichtung", "origin.direction")}
        {field("Fahrzeugnummer (falls bekannt)", "origin.vehicleNo")}
      </div>
      <p>Das tatsächliche Verkehrsunternehmen selbst bestimmen. Bei Zimmerbergbus den zuständigen Betreiber der Linie prüfen; der Markenname allein ordnet die Sache keinem bestimmten Betrieb zu. Die Erfassung bestätigt noch keine Übergabe.</p>
    </section>}
    {isInstitutionFind(data) && <section style={{ border: "1px solid #d39b22", borderRadius: 8, padding: 12, marginBottom: 16 }}>
      <h4>Haus-/Anstaltsfund – Einrichtung und Finderrolle</h4>
      <p>Zum Beispiel Spital, Migros-Filiale, Restaurant, Hotel oder Schwimmbad. Fundperson, Überbringer und rechtlich relevante Finderstelle werden getrennt dokumentiert. Funddatum und Fundzeit stehen oben.</p>
      <div style={grid}>
        {field("Einrichtung / Betrieb", "institution.name")}
        {field("Genauer Fundort innerhalb der Einrichtung", "institution.internalLocation")}
        {field("Übergabe an die Einrichtung – Datum (falls erfolgt)", "institution.handedToInstitutionDate", { date: true })}
        {field("Übergabe an das Fundbüro – Datum (falls erfolgt)", "institution.handedToOfficeDate", { date: true })}
        {field("Überbringer / Kontaktperson", "institution.deliveredBy")}
        {field("Übergebende Einrichtung (falls zutreffend)", "institution.deliveringInstitution")}
        {field("Rechtlicher Finder / zuständige Finderstelle (manuell zu prüfen)", "institution.legalFinderName")}
        {field("Kontakt der rechtlich relevanten Finderstelle", "institution.legalFinderContact")}
      </div>
      <label style={{ display: "grid", gap: 6 }}>Eingang beim Fundbüro
        <select name="institution_intakeSource" value={data.institution?.intakeSource || "UNKNOWN"} onChange={(event) => setField("institution.intakeSource", event.target.value)} style={input}>
          <option value="UNKNOWN">Noch zu klären</option><option value="PERSON">Direkt von Fundperson / Überbringer</option>
          <option value="INSTITUTION">Von der Einrichtung übergeben</option>
        </select>
      </label>
      <p>Ein Eintrag in einem Datumsfeld dokumentiert eine Angabe zur bisherigen Übergabekette. Er bestätigt keine neue Herausgabe aus dem Fundbüro.</p>
      <label><input type="checkbox" name="institution_legalFinderConfirmed" checked={data.institution?.legalFinderConfirmed === true}
        onChange={(event) => setField("institution.legalFinderConfirmed", event.target.checked)} /> Zuständige Finderstelle und Berechtigung fachlich geprüft</label>
      {field("Prüfvermerk / Grundlage der Finderzuordnung", "institution.reviewNote")}
      <p>Kein Finderlohn bei dieser Fundart; das ist kein persönlicher Verzicht der Fundperson. Auslagenersatz bleibt separat. Keine automatische Zuweisung späteren Eigentums an die Fundperson oder die Einrichtung.</p>
    </section>}
    {!isInstitutionFind(data) && <section style={{ marginBottom: 16 }}><h3>Überbringer und rechtlicher Finder</h3>
      {!transport && <label><input type="checkbox" checked={data.roles?.delivererSameAsDiscoverer !== false} onChange={(event) => setField("roles.delivererSameAsDiscoverer", event.target.checked)} /> Fundperson ist zugleich Überbringer</label>}
      {(transport || data.roles?.delivererSameAsDiscoverer === false) && <div style={grid}>
        {field("Überbringer (Person / Organisation)", "roles.delivererName")}{field("Kontakt Überbringer", "roles.delivererContact")}
      </div>}
      {!transport && <label><input type="checkbox" checked={data.roles?.legalFinderSameAsDiscoverer !== false} onChange={(event) => setField("roles.legalFinderSameAsDiscoverer", event.target.checked)} /> Fundperson ist nach bewusster Einordnung auch rechtlicher Finder</label>}
      {(transport || data.roles?.legalFinderSameAsDiscoverer === false) && <div style={grid}>
        {field("Rechtlich relevante Finderstelle (manuell prüfen)", "roles.legalFinderName")}{field("Kontakt Finderstelle", "roles.legalFinderContact")}
      </div>}
      <p>Diese Rollen werden nicht allein anhand eines Orts- oder Markennamens bestimmt. Die Abgabe durch einen Überbringer weist ihm keine Finderrechte zu.</p>
    </section>}
    {!transport && hasSpecialJurisdiction(data) && <p>Für diese Fundumgebung sind Zuständigkeit und Fristen gesondert zu klären. Die normale Horgner Frist wird nicht automatisch angewendet.</p>}
  </>;
}
