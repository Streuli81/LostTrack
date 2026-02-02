// src/components/InvestigationSteps.jsx
import { useMemo, useState } from "react";
import {
  addInvestigationStep,
  deleteInvestigationStep,
} from "../core/storage/lostItemRepo";

function fmtDateTime(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso);
    return d.toLocaleString("de-CH");
  } catch {
    return String(iso);
  }
}

export default function InvestigationSteps({ itemId, steps, onChanged }) {
  const [who, setWho] = useState("");
  const [what, setWhat] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // chronologisch (alt → neu). Wenn du neu → alt willst: sort umdrehen oder reverse().
  const sorted = useMemo(() => {
    const arr = Array.isArray(steps) ? steps : [];
    return [...arr].sort((a, b) => new Date(a.at) - new Date(b.at));
  }, [steps]);

  function handleAdd(e) {
    e.preventDefault();
    setError("");
    setBusy(true);

    try {
      const res = addInvestigationStep({
        id: itemId,
        step: { who, what },
      });

      if (!res?.ok) {
        setError(res?.error || "Speichern fehlgeschlagen.");
        return;
      }

      setWho("");
      setWhat("");
      onChanged?.();
    } catch (err) {
      setError(err?.message || "Speichern fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  function handleDelete(stepId) {
    if (!window.confirm("Ermittlungsschritt wirklich löschen?")) return;

    setError("");
    try {
      const res = deleteInvestigationStep({ id: itemId, stepId });
      if (!res?.ok) {
        setError(res?.error || "Löschen fehlgeschlagen.");
        return;
      }
      onChanged?.();
    } catch (err) {
      setError(err?.message || "Löschen fehlgeschlagen.");
    }
  }

  return (
    <Card title="Ermittlungsschritte">
      {error ? (
        <div
          style={{
            background: "#fff3f3",
            border: "1px solid #f1b2b2",
            padding: 10,
            borderRadius: 8,
            marginBottom: 10,
          }}
        >
          {error}
        </div>
      ) : null}

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={th}>Datum/Zeit</th>
              <th style={th}>Wer</th>
              <th style={th}>Was</th>
              <th style={thRight}>Aktion</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td style={td} colSpan={4}>
                  Keine Ermittlungsschritte erfasst.
                </td>
              </tr>
            ) : (
              sorted.map((s) => (
                <tr key={s.id}>
                  <td style={td}>{fmtDateTime(s.at)}</td>
                  <td style={td}>{s.who || "—"}</td>
                  <td style={td}>{s.what || "—"}</td>
                  <td style={tdRight}>
                    <button
                      type="button"
                      onClick={() => handleDelete(s.id)}
                      style={btnDanger}
                      title="Löschen"
                    >
                      Löschen
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <form onSubmit={handleAdd} style={{ marginTop: 12 }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 220px" }}>
            <label style={label}>Wer</label>
            <input
              value={who}
              onChange={(e) => setWho(e.target.value)}
              placeholder="z.B. Müller / Patrouille A"
              style={input}
              disabled={busy}
            />
          </div>

          <div style={{ flex: "3 1 420px" }}>
            <label style={label}>Was</label>
            <input
              value={what}
              onChange={(e) => setWhat(e.target.value)}
              placeholder="z.B. Telefonat, Abgleich, Übergabe, Rücksprache..."
              style={input}
              disabled={busy}
            />
          </div>

          <div style={{ alignSelf: "end" }}>
            <button type="submit" disabled={busy}>
              + Schritt hinzufügen
            </button>
          </div>
        </div>
      </form>
    </Card>
  );
}

/* kleine UI helpers (im gleichen Stil wie deine Cards) */

function Card({ title, children }) {
  return (
    <div style={{ padding: 12, border: "1px solid #ccc", borderRadius: 8 }}>
      <div style={{ fontWeight: "bold", marginBottom: 8 }}>{title}</div>
      <div style={{ display: "grid", gap: 10 }}>{children}</div>
    </div>
  );
}

const th = {
  textAlign: "left",
  borderBottom: "1px solid #ddd",
  padding: "8px 6px",
  whiteSpace: "nowrap",
};
const thRight = { ...th, textAlign: "right" };

const td = {
  borderBottom: "1px solid #eee",
  padding: "8px 6px",
  verticalAlign: "top",
};
const tdRight = { ...td, textAlign: "right", whiteSpace: "nowrap" };

const label = { display: "block", fontSize: 12, color: "var(--muted)", marginBottom: 4 };
const input = {
  width: "100%",
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px solid #ccc",
};

const btnDanger = {
  padding: "6px 10px",
  borderRadius: 10,
  border: "1px solid #b00020",
  background: "white",
  color: "#b00020",
  cursor: "pointer",
};
