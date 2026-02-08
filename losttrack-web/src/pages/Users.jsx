// src/pages/Users.jsx
import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  listUsers,
  createUser,
  updateUser,
  deleteUser,
  setCurrentUserId,
  getCurrentUser,
} from "../core/storage/userRepo";

const ROLES = ["ADMIN", "EDITOR", "VIEWER"];

export default function Users() {
  const [tick, setTick] = useState(0);

  const me = useMemo(() => getCurrentUser(), [tick]);
  const users = useMemo(() => listUsers(), [tick]);

  const [form, setForm] = useState({
    name: "",
    username: "",
    role: "EDITOR",
    active: true,
  });

  function refresh() {
    setTick((t) => t + 1);
  }

  function onCreate(e) {
    e.preventDefault();
    const name = form.name.trim();
    const username = form.username.trim();
    if (!name || !username) return;

    const res = createUser({ ...form, name, username });
    if (!res.ok) {
      alert(res.error || "Benutzer konnte nicht erstellt werden.");
      return;
    }
    setForm({ name: "", username: "", role: "EDITOR", active: true });
    refresh();
  }

  function onUpdate(id, patch) {
    const res = updateUser(id, patch);
    if (!res.ok) {
      alert(res.error || "Update fehlgeschlagen.");
      return;
    }
    refresh();
  }

  function onDelete(id) {
    if (!confirm("Benutzer wirklich löschen?")) return;
    const res = deleteUser(id);
    if (!res.ok) {
      alert(res.error || "Löschen fehlgeschlagen.");
      return;
    }
    refresh();
  }

  function onSwitchUser(id) {
    setCurrentUserId(id);
    refresh();
  }

  return (
    <section style={{ maxWidth: 1100 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
        <h2 style={{ margin: 0 }}>Benutzer</h2>
        <div style={{ marginLeft: "auto", opacity: 0.8 }}>
          Angemeldet: <strong>{me?.name || "—"}</strong>{" "}
          <span style={{ marginLeft: 8 }}>({me?.role || "—"})</span>
        </div>
      </div>

      <p style={{ marginTop: 8, opacity: 0.8 }}>
        Hier definierst du, wer <strong>Eintragungen</strong> machen darf.
        Empfehlung: <strong>EDITOR</strong> für Sachbearbeiter, <strong>VIEWER</strong>{" "}
        für reine Leserechte, <strong>ADMIN</strong> nur für wenige.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
        {/* Create */}
        <div
          style={{
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 12,
            padding: 14,
          }}
        >
          <h3 style={{ marginTop: 0 }}>Neuen Benutzer anlegen</h3>

          <form onSubmit={onCreate} style={{ display: "grid", gap: 10 }}>
            <label style={{ display: "grid", gap: 6 }}>
              Name
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="z.B. M. Muster"
              />
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              Benutzername (Login/Identifikation)
              <input
                value={form.username}
                onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                placeholder="z.B. mmuster"
              />
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              Rolle
              <select
                value={form.role}
                onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </label>

            <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
              />
              Aktiv
            </label>

            <button type="submit">Benutzer erstellen</button>
          </form>
        </div>

        {/* List */}
        <div
          style={{
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 12,
            padding: 14,
          }}
        >
          <h3 style={{ marginTop: 0 }}>Bestehende Benutzer</h3>

          {users.length === 0 ? (
            <p style={{ opacity: 0.8 }}>
              Keine Benutzer gefunden (sollte mind. „Admin“ sein).
            </p>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {users.map((u) => {
                const isMe = me?.id === u.id;
                return (
                  <div
                    key={u.id}
                    style={{
                      border: "1px solid rgba(255,255,255,0.08)",
                      borderRadius: 10,
                      padding: 12,
                    }}
                  >
                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700 }}>
                          {u.name}{" "}
                          {isMe ? (
                            <span style={{ fontWeight: 600, opacity: 0.8 }}>(aktuell)</span>
                          ) : null}
                        </div>
                        <div style={{ opacity: 0.8 }}>
                          {u.username} · Rolle: <strong>{u.role}</strong> ·{" "}
                          {u.active ? "aktiv" : "inaktiv"}
                        </div>
                      </div>

                      <button onClick={() => onSwitchUser(u.id)} disabled={isMe}>
                        Als Benutzer nutzen
                      </button>
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: 10,
                        marginTop: 10,
                      }}
                    >
                      <label style={{ display: "grid", gap: 6 }}>
                        Rolle
                        <select
                          value={u.role}
                          onChange={(e) => onUpdate(u.id, { role: e.target.value })}
                        >
                          {ROLES.map((r) => (
                            <option key={r} value={r}>
                              {r}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label style={{ display: "grid", gap: 6 }}>
                        Status
                        <select
                          value={u.active ? "active" : "inactive"}
                          disabled={isMe} // verhindert Selbst-Deaktivierung (UI)
                          title={isMe ? "Du kannst dich nicht selbst deaktivieren." : undefined}
                          onChange={(e) =>
                            onUpdate(u.id, { active: e.target.value === "active" })
                          }
                        >
                          <option value="active">aktiv</option>
                          <option value="inactive">inaktiv</option>
                        </select>
                      </label>
                    </div>

                    <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
                      <button
                        onClick={() =>
                          onUpdate(u.id, { name: prompt("Name", u.name) || u.name })
                        }
                      >
                        Name ändern
                      </button>
                      <button
                        onClick={() =>
                          onUpdate(u.id, {
                            username: prompt("Benutzername", u.username) || u.username,
                          })
                        }
                      >
                        Benutzername ändern
                      </button>
                      <button
                        onClick={() => onDelete(u.id)}
                        disabled={isMe || u.role === "ADMIN"}
                        title={
                          u.role === "ADMIN"
                            ? "Admins nicht löschen (Sicherheitsregel)"
                            : undefined
                        }
                      >
                        Löschen
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div style={{ marginTop: 14, opacity: 0.8 }}>
            <Link to="/">← zurück</Link>
          </div>
        </div>
      </div>
    </section>
  );
}
