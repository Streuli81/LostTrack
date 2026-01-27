// src/pages/ItemDetail.jsx
import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getLostItemById, changeLostItemStatus } from "../core/storage/lostItemRepo";

const STATUS = ["OPEN", "IN_PROGRESS", "CLOSED"];

export default function ItemDetail() {
  const { id } = useParams();
  const [tick, setTick] = useState(0);

  const item = useMemo(() => getLostItemById(id), [id, tick]);

  if (!item) {
    return (
      <section style={{ maxWidth: 1100 }}>
        <h2>Detail</h2>
        <p>Datensatz nicht gefunden.</p>
        <Link to="/suche">← zurück zur Suche</Link>
      </section>
    );
  }

  const label = item?.item?.manualLabel || item?.item?.predefinedKey || "(kein Gegenstand)";
  const status = (item.status || "OPEN").toUpperCase();

  function setStatus(newStatus) {
    const res = changeLostItemStatus({ id: item.id, newStatus });
    if (res.ok) setTick((x) => x + 1);
    else alert(res.error || "Statuswechsel fehlgeschlagen");
  }

  return (
    <section style={{ maxWidth: 1100 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
        <div>
          <h2 style={{ margin: 0 }}>
            {item.fundNo} – {label}
          </h2>
          <div style={{ color: "var(--muted)", fontSize: 13 }}>
            ID: {item.id} · Funddatum: {item?.foundAt?.date || "—"} {item?.foundAt?.time || ""} · Ort:{" "}
            {item?.foundAt?.location || "—"}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ padding: "4px 10px", border: "1px solid #ccc", borderRadius: 999, fontSize: 12 }}>
            {status}
          </span>
          <Link to="/suche">Zur Suche</Link>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 16 }}>
        <Card title="Sachbearbeiter">
          <Row k="ID" v={item?.caseWorker?.id} />
          <Row k="Name" v={item?.caseWorker?.name} />
        </Card>

        <Card title="Finder">
          <Row k="Name" v={item?.finder?.name} />
          <Row k="Telefon" v={item?.finder?.phone} />
          <Row k="E-Mail" v={item?.finder?.email} />
          <Row k="Finderlohn" v={item?.finder?.rewardRequested ? "Ja" : "Nein"} />
        </Card>

        <Card title="Gegenstand">
          <Row k="PredefinedKey" v={item?.item?.predefinedKey} />
          <Row k="Manuell" v={item?.item?.manualLabel} />
          <Row k="Beschreibung" v={item?.item?.description} />
        </Card>

        <Card title="Workflow">
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {STATUS.map((s) => (
              <button key={s} type="button" disabled={status === s} onClick={() => setStatus(s)}>
                Status → {s}
              </button>
            ))}
          </div>

          <div style={{ marginTop: 12, color: "var(--muted)", fontSize: 13 }}>
            Bearbeiten / Quittung folgt als nächster Schritt.
          </div>
        </Card>
      </div>
    </section>
  );
}

/* --- kleine UI-helpers --- */

function Card({ title, children }) {
  return (
    <div style={{ padding: 12, border: "1px solid #ccc", borderRadius: 8 }}>
      <div style={{ fontWeight: "bold", marginBottom: 8 }}>{title}</div>
      <div style={{ display: "grid", gap: 6 }}>{children}</div>
    </div>
  );
}

function Row({ k, v }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: 10 }}>
      <div style={{ color: "var(--muted)" }}>{k}</div>
      <div>{v ? String(v) : "—"}</div>
    </div>
  );
}
