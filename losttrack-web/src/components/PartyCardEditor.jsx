// src/components/PartyCardEditor.jsx
import { useEffect, useState } from "react";

export default function PartyCardEditor({
  title,
  initialValue,
  onSave,
  showRewardRequested = false,
  allowClear = false, // für Abholer: "Entfernen"

  // ✅ NEU: Footer-Slot für "Quittungen / Zusatzfelder"
  footer = null, // ReactNode
  footerDivider = true, // Divider-Linie zwischen Form und Footer
}) {
  const [value, setValue] = useState(empty(showRewardRequested));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    setValue({
      name: initialValue?.name || "",
      address: initialValue?.address || "",
      phone: initialValue?.phone || "",
      email: initialValue?.email || "",
      ...(showRewardRequested ? { rewardRequested: !!initialValue?.rewardRequested } : {}),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, JSON.stringify(initialValue || {})]);

  async function save() {
    setBusy(true);
    setErr("");
    setMsg("");
    try {
      const res = await onSave(value);
      if (!res?.ok) {
        setErr(res?.error || "Speichern fehlgeschlagen.");
        return;
      }
      setMsg("Gespeichert.");
      window.setTimeout(() => setMsg(""), 1200);
    } catch (e) {
      setErr(e?.message || "Speichern fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  async function clear() {
    if (!allowClear) return;
    if (!window.confirm(`${title} wirklich entfernen?`)) return;

    setBusy(true);
    setErr("");
    setMsg("");
    try {
      const res = await onSave(null); // null = entfernen
      if (!res?.ok) {
        setErr(res?.error || "Entfernen fehlgeschlagen.");
        return;
      }
      setMsg("Entfernt.");
      window.setTimeout(() => setMsg(""), 1200);
    } catch (e) {
      setErr(e?.message || "Entfernen fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title={title}>
      {err ? <Notice kind="error">{err}</Notice> : null}
      {msg ? <Notice kind="ok">{msg}</Notice> : null}

      <div style={grid2}>
        <Field
          label="Name"
          value={value.name}
          onChange={(v) => setValue({ ...value, name: v })}
          disabled={busy}
        />
        <Field
          label="Adresse"
          value={value.address}
          onChange={(v) => setValue({ ...value, address: v })}
          disabled={busy}
        />
        <Field
          label="Telefon"
          value={value.phone}
          onChange={(v) => setValue({ ...value, phone: v })}
          disabled={busy}
        />
        <Field
          label="E-Mail"
          value={value.email}
          onChange={(v) => setValue({ ...value, email: v })}
          disabled={busy}
        />
      </div>

      {showRewardRequested ? (
        <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
          <input
            type="checkbox"
            checked={!!value.rewardRequested}
            onChange={(e) => setValue({ ...value, rewardRequested: e.target.checked })}
            disabled={busy}
          />
          Finderlohn gewünscht
        </label>
      ) : null}

      <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end", gap: 8 }}>
        {allowClear ? (
          <button type="button" onClick={clear} disabled={busy}>
            Entfernen
          </button>
        ) : null}
        <button type="button" onClick={save} disabled={busy}>
          Speichern
        </button>
      </div>

      {/* ✅ NEU: Footer innerhalb der Karte */}
      {footer ? (
        <div style={{ marginTop: 12 }}>
          {footerDivider ? <div style={divider} /> : null}
          <div style={{ marginTop: 10 }}>{footer}</div>
        </div>
      ) : null}
    </Card>
  );
}

/* UI helpers */

function Card({ title, children }) {
  return (
    <div style={{ padding: 12, border: "1px solid #ccc", borderRadius: 8 }}>
      <div style={{ fontWeight: "bold", marginBottom: 8 }}>{title}</div>
      <div style={{ display: "grid", gap: 10 }}>{children}</div>
    </div>
  );
}

function Notice({ kind, children }) {
  const styles =
    kind === "error"
      ? { background: "#fff3f3", border: "1px solid #f1b2b2" }
      : { background: "#f2fff3", border: "1px solid #b9e7bf" };

  return (
    <div style={{ ...styles, padding: 10, borderRadius: 8 }}>
      {children}
    </div>
  );
}

function Field({ label, value, onChange, disabled }) {
  return (
    <div>
      <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>{label}</div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        style={{
          width: "100%",
          padding: "8px 10px",
          borderRadius: 8,
          border: "1px solid #ccc",
        }}
      />
    </div>
  );
}

const grid2 = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 10,
};

const divider = {
  height: 1,
  background: "rgba(255,255,255,0.12)",
};

function empty(showRewardRequested) {
  return {
    name: "",
    address: "",
    phone: "",
    email: "",
    ...(showRewardRequested ? { rewardRequested: false } : {}),
  };
}
